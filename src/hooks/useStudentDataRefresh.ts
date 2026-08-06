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
 * CALLS: getStudentData (localDB.ts), dispatch(setStudentData) (studentSlice).
 * USED BY: BookmarksScreen / MistakesScreen / NotesScreen (call once at top of the
 * component). Safe to call from any screen; no-ops when currentStudent is null.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { getStudentData } from '../database/localDB';
import { setStudentData } from '../store/studentSlice';

export const useStudentDataRefresh = () => {
  const dispatch = useDispatch();
  const currentStudentId = useSelector((s: any) => s.student.currentStudent?.id);
  const syncStatus = useSelector((s: any) => s.sync.status);
  const prevSyncStatusRef = useRef(syncStatus);

  /** Same student data / manifest + chunks -> Redux studentData. */
  const reload = useCallback(() => {
    if (!currentStudentId) return;
    getStudentData(currentStudentId)
      .then((d: any) => { if (d) dispatch(setStudentData(d)); })
      .catch(() => {});
  }, [currentStudentId, dispatch]);

  // Focus reload is gated while a sync is in flight: the pull writes SQLite in one
  // atomic batch per student, so reloading mid-pull would render PARTIAL data
  // (a trickle: bookmarks first, then notes, then highlights). Skipping the reload
  // keeps the last consistent state on screen; the syncing->synced watcher below
  // then applies EVERYTHING in one shot. (Fresh devices show blank until done —
  // intended.)
  useFocusEffect(useCallback(() => {
    if (syncStatus === 'syncing') return;
    reload();
  }, [reload, syncStatus]));

  useEffect(() => {
    const prev = prevSyncStatusRef.current;
    prevSyncStatusRef.current = syncStatus;
    if (prev === 'syncing' && syncStatus !== 'syncing') reload();
  }, [syncStatus, reload]);
};