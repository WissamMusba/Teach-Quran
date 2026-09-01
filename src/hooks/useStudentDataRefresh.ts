/**
 * FILE: src/hooks/useStudentDataRefresh.ts
 * ROLE: The three annotation list screens (Bookmarks, Mistakes, Notes) render purely
 *       from Redux s.student.studentData, but the live annotation data is written
 *       to SQLite canvas chunks (page_N / surah_N) and splits. Redux studentData is
 *       only refreshed when QuranViewScreen mounts or after QuranViewScreen.tsx:528
 *       sync watcher fires — so opening a list screen right after a same-device edit
 *       (word highlight / note save) or after a cross-device pull shows STALE data
 *       even though SQLite is already fresh.
 * FLOW: 1) on screen focus -> getStudentData(sid) (aggregates chunk highlights+notes,
 *       manifest bookmarks/lastRead) -> dispatch setStudentData (fresh data in Redux);
 *       2) on sync status transition syncing->synced -> reload() again so a pull that
 *       landed while this screen was focused appears without re-navigating.
 * PERF: reload() first takes a CHEAP freshness snapshot (3 aggregate COUNT/SUM queries +
 *       the one manifest row) and compares it against the snapshot captured on the last
 *       successful load for this student. When the DB is provably unchanged, the heavy
 *       getStudentData re-read (full canvas rows + JSON.parse of every chunk + all audio
 *       ranges + manifest) is SKIPPED entirely — the screen keeps its in-memory Redux
 *       render with zero JS-thread/bridge churn and zero re-render on focus. The snapshot
 *       includes the manifest's exact text, so bookmark/lastRead edits always pass the
 *       gate; identical re-focuses (the common case) never touch the big query.
 * CALLS: getStudentData / getDB (localDB.ts), dispatch(setStudentData) (studentSlice).
 * USED BY: BookmarksScreen / MistakesScreen / NotesScreen (call once at top of the
 *          component). Safe to call from any screen; no-ops when currentStudent is null.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { getStudentData, getManifest, getDB } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';

// Freshness snapshot per student:id of the last SUCCESSFUL load. A re-focus that computes
// the identical snapshot (i.e. nothing in SQLite changed since the load) skips getStudentData.
// A fresh snapshot never misses an edit: any bookmark/lastRead change rewrites the manifest
// text, any chunk/audio edit bumps SUM(v), any pull rewrites serverTs/COUNT/SUM(serverTs).
const loadedSnapshotPerStudent = new Map<string, string>();

// In-flight de-dupe: useFocusEffect + the syncing->synced watcher can fire in the same tick;
// both callers then share ONE getStudentData promise instead of running it twice.
let inFlight: { studentId: string; promise: Promise<any> } | null = null;

/** Cheap DB-side summary of everything getStudentData reads — a lossless change detector. */
const freshnessSnapshot = async (studentId: string): Promise<string | null> => {
  try {
    const db = getDB();
    if (!db) return null;
    const [manifest, chunks, audio] = await Promise.all([
      db.executeSql(`SELECT manifest, serverTs FROM student_manifest_cache WHERE studentId=?`, [studentId]),
      db.executeSql(
        `SELECT COUNT(*) AS n, COALESCE(SUM(v),0) AS vs, COALESCE(SUM(serverTs),0) AS ts FROM student_data_cache WHERE studentId=?`,
        [studentId]),
      db.executeSql(
        `SELECT COUNT(*) AS n, COALESCE(SUM(v),0) AS vs FROM audio_notes_cache WHERE studentId=?`,
        [studentId]),
    ]);
    const m = manifest && manifest[0] && manifest[0].rows && manifest[0].rows.length
      ? manifest[0].rows.item(0) : null;
    const c = chunks && chunks[0] && chunks[0].rows && chunks[0].rows.length
      ? chunks[0].rows.item(0) : null;
    const a = audio && audio[0] && audio[0].rows && audio[0].rows.length
      ? audio[0].rows.item(0) : null;
    const manifestText = m ? m.manifest : '';
    return `${m ? m.serverTs : 0}|${manifestText}|${c ? `${c.n}/${c.vs}/${c.ts}` : '0/0/0'}|${a ? `${a.n}/${a.vs}` : '0/0'}`;
  } catch { return null; }
};

// P2-I — shared freshness gate for the OTHER getStudentData callers that run for a FIXED
// current student (QuranViewScreen's sync watcher + canvas-open path, App.tsx post-pull
// refresh). The same snapshot/map the hook uses, so SQLite-provable-unchanged reads are
// skipped before the heavy getStudentData chunk read runs — and every participant updates
// the shared map, so a reload by one never triggers a redundant reload by another.
export const getFreshnessSnapshot = freshnessSnapshot;
export const studentDataIsCurrent = (studentId: string, snapshot: string | null) =>
  snapshot !== null && loadedSnapshotPerStudent.get(studentId) === snapshot;
export const markStudentDataLoaded = (studentId: string, snapshot: string | null) => {
  loadedSnapshotPerStudent.set(studentId, snapshot === null ? 'loaded' : snapshot);
};

export const useStudentDataRefresh = () => {
  const dispatch = useDispatch();
  const currentStudentId = useSelector((s: any) => s.student.currentStudent?.id);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const prevSyncStatusRef = useRef(syncStatus);

  /** Same student data / manifest + chunks -> Redux studentData (skips no-op reloads). */
  const reload = useCallback(() => {
    if (!currentStudentId) return;
    if (inFlight && inFlight.studentId === currentStudentId) return inFlight.promise;
    const load = (async () => {
      try {
        // Fast-seed manifest: instant ~2ms bookmarks and lastRead load while heavy chunks aggregate
        getManifest(currentStudentId).then((m) => {
          if (m?.data?.bookmarks || m?.data?.lastRead) {
            dispatch(setStudentData({
              bookmarks: m.data.bookmarks || {},
              lastRead: m.data.lastRead || null,
              highlights: {},
              notes: {},
              drawings: {},
              schemaVersion: m.data.schemaVersion || 3,
              v: m.data.v || 0,
            }));
          }
        }).catch(() => {});

        const snapshot = await freshnessSnapshot(currentStudentId);
        if (snapshot !== null && loadedSnapshotPerStudent.get(currentStudentId) === snapshot) return;
        const d = await getStudentData(currentStudentId);
        if (!d) return;
        loadedSnapshotPerStudent.set(currentStudentId, snapshot === null ? 'loaded' : snapshot);
        dispatch(setStudentData(d));
      } catch { /* same safety net as before: ignore read/dispatch failures */ }
    })();
    inFlight = { studentId: currentStudentId, promise: load };
    load.finally(() => { if (inFlight?.studentId === currentStudentId) inFlight = null; }).catch(() => {});
    return load;
  }, [currentStudentId, dispatch]);

  // Focus reload is gated while a sync is in flight: the pull writes SQLite in one
  // atomic batch per student, so reloading mid-pull would render PARTIAL data
  // (a trickle: bookmarks first, then notes, then highlights). Skipping the reload
  // keeps the last consistent state on screen; the syncing->synced watcher below
  // then applies EVERYTHING in one shot. (Fresh devices show blank until done —
  // intended.)
  useFocusEffect(useCallback(() => {
    if (syncStatus === 'syncing') return;
    void reload();
  }, [reload, syncStatus]));

  useEffect(() => {
    const prev = prevSyncStatusRef.current;
    prevSyncStatusRef.current = syncStatus;
    if (prev === 'syncing' && syncStatus !== 'syncing') void reload();
  }, [syncStatus, reload]);
};