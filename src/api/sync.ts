import { firestore, getUserId } from './firebase';
import { Dimensions } from 'react-native';
import {
  getDirtyCanvasesByStudent, getAllCanvasesWithStrokesByStudent, rangeKeyForPage,
  getChunk, markSynced, bumpAttempt,
  getManifest, saveManifestLocal, saveChunkNoQueue,
  getAudioNotesRange, saveAudioNotesRange, migrateLegacyAudioNotes,
  getLastPushAt, setLastPushAt, cacheStudentList,
  getLastPullAt, savePullBatch,
  hasStrokesDirtySession, clearStrokesDirtySession,
} from '../database/localDB';
import { compactStroke, denormalizeStroke, hPadFor } from '../utils/stroke';

const CHUNK_TX_SLICE = 100;            // transactional chunk push: 100 reads + ~102 writes stays under Firestore's 500-op transaction ceiling

const manifestRef = (userId: string) => firestore().collection('users').doc(userId).collection('meta').doc('sync_manifest');
/** Per-student subtree for the user-level sync_manifest doc (merged with {merge:true} so only this student changes). */
const manifestSubtree = (sid: string, fields: { v?: number; pages?: Record<string, any>; audio?: Record<string, any> }) => ({ students: { [sid]: fields } });

/** Last-write-wins pick for the synced reading mark (lastRead). Missing updatedAt counts as oldest. */
const newerLastRead = (local: any, cloud: any) => {
  if (!local) return cloud || null;
  if (!cloud) return local;
  const lt = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
  const ct = cloud.updatedAt ? new Date(cloud.updatedAt).getTime() : 0;
  return ct > lt ? cloud : local;
};

let inFlight: Promise<any> | null = null;
let pendingPull = false;               // a pull request arrived while syncing: re-run after

export const requestSync = async (opts?: { pull?: boolean }): Promise<any> => {
  if (inFlight) {
    if (opts?.pull) pendingPull = true;
    return inFlight.then(() => {
      if (!pendingPull) return { success: true, pushed: 0, pulled: 0, skipped: true };
      pendingPull = false;
      return requestSync({ pull: true });
    });
  }
  inFlight = (async () => {
    const userId = getUserId();
    if (!userId) return { success: false, error: 'Not authenticated' };
    try {
      const pushed = await pushAllDirty(userId);
      let pulled = 0;
      let manifestChanged = false;
      if (opts?.pull) {
        const r = await pullRemote(userId);
        pulled = r.pulled;
        manifestChanged = r.manifestChanged;
      }
      return { success: true, pushed, pulled, manifestChanged };
    } catch (e: any) {
      console.warn('Sync failed:', e?.message);
      return { success: false, error: e?.message };
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
};

/** v1-compat entry (App.tsx / DashboardScreen keep calling this name). */
export const processSyncQueue = async (opts?: { pull?: boolean }) => requestSync(opts);

/**
 * Push pass — transactional max(local, cloud)+1 versions (NO FieldValue.increment):
 * every chunk slice runs inside a single Firestore transaction that reads the cloud
 * draws docs + overview, writes each doc with v = max(cloud, local) + 1, and skips
 * docs whose cloud v is strictly newer (a stale device can never regress a version).
 * After a commit the LOCAL manifest mirror is bumped to the pushed values, so the
 * next pull sees cloud.v === local.v and skips.
 * Queue row types:
 *   - chunk keys (page_N / surah_N)  -> students/{sid}/draws/{k}  (highlights+notes ONLY; strokes stripped)
 *   - '_manifest'                    -> students/{sid}/meta/overview (bookmarks + lastRead;
 *                                      lastRead now syncs LWW, newest updatedAt wins)
 *   - '_audio_r_..'                  -> students/{sid}/audioNotes/{range} (10-page audio-note registry)
 * Every push also merges the student's chunk into the user-level sync_manifest
 * ({users/{uid}/meta/sync_manifest}) inside the SAME transaction — zero extra
 * round-trips — so pulls can diff per-student versions with a single manifest read.
 */
const pushAllDirty = async (userId: string): Promise<number> => {
  let pushed = 0;
  let pushPassSucceeded = false;
  try {
  const groups = await getDirtyCanvasesByStudent();
  for (const [sid, keys] of Object.entries(groups)) {
    if (!keys.length) continue;

    await migrateLegacyAudioNotes(sid);
    const studRef = firestore().collection('users').doc(userId).collection('students').doc(sid);

    const manifestKeys = keys.filter((k: string) => k === '_manifest');
    const audioKeys = keys.filter((k: string) => k.startsWith('_audio_'));
    const canvasKeys = keys.filter((k: string) => k !== '_manifest' && !k.startsWith('_audio_'));

    // ---- annotations chunks (drawings excluded: lazy per-range via pushDrawings) ----
    // TRANSACTIONAL slice push (mirrors the bookmark transaction below): the cloud
    // overview + every draws doc in the slice are read INSIDE the transaction, and
    // each written v = max(cloud, local) + 1 — a stale device can never regress a
    // version, and two devices pushing the same student concurrently stay monotonic
    // (directional pulls never skip newer data). A chunk whose cloud v is strictly
    // newer is SKIPPED (cloud wins); its queue row is cleared only after the local
    // manifest mirror records the cloud v, so the next pull diff converges. Slice
    // size CHUNK_TX_SLICE keeps the tx ≤ ~204 ops (Firestore ceiling is 500).
    let offset = 0;
    while (offset < canvasKeys.length) {
      const slice = canvasKeys.slice(offset, offset + CHUNK_TX_SLICE);
      offset += slice.length;
      const m = await getManifest(sid);
      const overviewRef = studRef.collection('meta').doc('overview');
      let overviewV = 0;
      let mirrorPages: Record<string, any> = {};
      let writtenKeys: string[] = [];
      let missingKeys: string[] = [];
      let staleVs: Record<string, number> = {};
      try {
        const committed = await firestore().runTransaction(async (tx: any) => {
          const ovSnap: any = await tx.get(overviewRef);
          const cloudOV: number = ovSnap.exists ? ((ovSnap.data() as any)?.v || 0) : 0;
          const writes: Array<{ doc: any; data: any }> = [];
          mirrorPages = {};
          missingKeys = [];
          staleVs = {};
          writtenKeys = [];
          for (const k of slice) {
            const local = await getChunk(sid, k);
            if (!local) { missingKeys.push(k); console.warn('pushAllDirty: missing local chunk, dropping', sid, k); continue; }
            const snap: any = await tx.get(studRef.collection('draws').doc(k));
            const cloudV: number = snap.exists ? ((snap.data() as any)?.v || 0) : 0;
            // cloud strictly newer -> local stale; skip so the write never regresses the cloud doc.
            if (cloudV > local.v) { staleVs[k] = cloudV; continue; }
            const v = Math.max(cloudV, local.v) + 1;
            const { strokes, ...annotations } = local.data;
            writes.push({ doc: studRef.collection('draws').doc(k), data: { ...annotations, v, updatedAt: firestore.FieldValue.serverTimestamp() } });
            mirrorPages[k] = { v };
            writtenKeys.push(k);
          }
          if (writes.length === 0) return false;   // nothing written this slice — no overview bump
          overviewV = Math.max(m.data.v || 0, cloudOV) + 1;
          const patch: Record<string, any> = { v: overviewV, updatedAt: firestore.FieldValue.serverTimestamp() };
          for (const [k, meta] of Object.entries(mirrorPages)) patch[`pages.${k}.v`] = meta.v;
          if (m.data.lastRead) patch.lastRead = m.data.lastRead;   // reading mark now syncs (LWW on pull)
          tx.set(overviewRef, patch, { merge: true });
          const pageVs: Record<string, number> = {};
          for (const [k, meta] of Object.entries(mirrorPages)) pageVs[k] = meta.v;
          tx.set(manifestRef(userId), manifestSubtree(sid, { v: overviewV, pages: pageVs }), { merge: true });
          for (const w of writes) tx.set(w.doc, w.data);
          return true;
        });
        if (committed && writtenKeys.length) {
          await setLastPushAt(sid, Date.now());
          for (const k of writtenKeys) await markSynced(sid, k);
          // Stale keys are effectively synced-away (content safely newer in the cloud)
          // and dropped rows never had a chunk at all: clear their rows too, but first
          // mirror the CLOUD v the stale keys were skipped at, so the local manifest
          // matches the cloud and the next pull diff converges.
          const skipKeys = [...Object.keys(staleVs), ...missingKeys];
          for (const k of skipKeys) await markSynced(sid, k);
          await saveManifestLocal(sid, { ...m.data, pages: { ...(m.data.pages || {}), ...mirrorPages, ...staleVs }, v: overviewV }, Date.now(), false);
          pushed += writtenKeys.length;
        } else {
          // nothing written this slice — every key was missing or stale. Stale-only
          // slices still mirror the cloud v so the pull diff converges; all-missing
          // slices keep the pre-transactional drop behavior (clear the rows).
          if (Object.keys(staleVs).length) {
            await saveManifestLocal(sid, { ...m.data, pages: { ...(m.data.pages || {}), ...staleVs }, v: m.data.v }, Date.now(), false);
          }
          for (const k of slice) await markSynced(sid, k);
        }
      } catch (e) {
        console.warn(`push failed ${sid}`, e);
        for (const k of slice) await bumpAttempt(sid, k);
      }
    }

    // ---- manifest (bookmarks + lastRead — now pushed too) — own batch so it pushes even with no dirty chunks ----
    if (manifestKeys.length) {
      const m = await getManifest(sid);
      const overviewRef = studRef.collection('meta').doc('overview');
      // TRANSACTIONAL merge: cloud overview read + overview write + user manifest
      // write happen atomically, so two devices pushing at once cannot lose each
      // other's bookmarks or regress the version number (v = max(local, cloud) + 1).
      // Bookmarks merge per-key by createdAt (newer wins). lastRead also syncs and
      // merges last-write-wins by updatedAt (missing updatedAt = oldest).
      let merged: Record<string, any> = {};
      let del: Record<string, any> = {};
      try {
        const overviewV = await firestore().runTransaction(async (tx: any) => {
          const snap: any = await tx.get(overviewRef);
          const cloud: any = snap.exists ? (snap.data() || {}) : {};
          const cloudV: number = cloud.v || 0;
          const cloudBookmarks: Record<string, any> = cloud.bookmarks || {};
          const localBookmarks: Record<string, any> = m.data.bookmarks || {};
          // ---- Tombstones: a deleted bookmark key must never be resurrected by the
          // merge below (the old merge re-added every cloud key absent locally, making
          // deletion impossible after first sync). Tombstones carry the deletion
          // timestamp; a bookmark RE-CREATED after its tombstone is allowed to live and
          // consumes the tombstone. Union local + cloud tombstone sets (newest wins) so
          // both devices converge on the same deletion state.
          const tsOf = (v: any): number => (typeof v === 'string' ? (Date.parse(v) || 0) : (Number(v) || 0));
          del = { ...((cloud.deletedBookmarks as Record<string, any>) || {}) };
          for (const [k, v] of Object.entries((m.data.deletedBookmarks as Record<string, any>) || {})) {
            if (del[k] === undefined || tsOf(v) >= tsOf(del[k])) del[k] = v;
          }
          const keys = new Set([...Object.keys(localBookmarks), ...Object.keys(cloudBookmarks)]);
          for (const k of keys) {
            const lv = localBookmarks[k];
            const cv = cloudBookmarks[k];
            const lts = lv?.createdAt ? new Date(lv.createdAt).getTime() : 0;
            const cts = cv?.createdAt ? new Date(cv.createdAt).getTime() : 0;
            const best = lts >= cts ? lv : cv;
            const bts = best?.createdAt ? new Date(best.createdAt).getTime() : 0;
            const tts = del[k] !== undefined ? tsOf(del[k]) : 0;
            if (tts && tts >= bts) continue;    // deleted at or after the bookmark was made: stays deleted
            if (tts && bts > tts) delete del[k]; // re-bookmarked after the deletion: tombstone consumed
            merged[k] = best;
          }
          const v = Math.max(m.data.v || 0, cloudV) + 1;
          const lr = newerLastRead(m.data.lastRead, cloud.lastRead);
          const patch: Record<string, any> = { v, updatedAt: firestore.FieldValue.serverTimestamp(), bookmarks: merged, deletedBookmarks: del };
          if (lr) patch.lastRead = lr;
          tx.set(overviewRef, patch, { merge: true });
          tx.set(manifestRef(userId), manifestSubtree(sid, { v, pages: m.data.pages || {} }), { merge: true });
          return v;
        });
        await setLastPushAt(sid, Date.now());
        for (const k of manifestKeys) await markSynced(sid, k);
        // Persist the MERGED bookmark map + tombstones locally too, so this device keeps
        // the cloud bookmarks it merged with (not just its own) and remembers deletions.
        await saveManifestLocal(sid, { ...m.data, bookmarks: merged, deletedBookmarks: del, v: overviewV }, Date.now(), false);
        pushed++;
      } catch (e) { console.warn(`manifest push failed ${sid}`, e); for (const k of manifestKeys) await bumpAttempt(sid, k); }
    }

    // ---- audio-note ranges: one doc per 10-page group ----
    for (const q of audioKeys) {
      const rangeKey = q.replace('_audio_', '');
      const cur = await getAudioNotesRange(sid, rangeKey);
      try {
        await firestore().batch()
          .set(studRef.collection('audioNotes').doc(rangeKey), {
            entries: cur.entries || {},
            v: cur.v || 0,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          })
          .set(manifestRef(userId), manifestSubtree(sid, { audio: { [rangeKey]: cur.v || 0 } }), { merge: true })
          .commit();
        await markSynced(sid, q);
        pushed++;
      } catch (e) { console.warn(`audio push failed ${sid}`, e); await bumpAttempt(sid, q); }
    }
  }
    pushPassSucceeded = true;
  } finally {
    // ---- stray drawings: canvases with strokes are saved queue=false (never in
    // sync_queue), so they'd only reach Firestore via the active-save pushDrawings
    // path — which swallows failures while offline. P2-H: the full-DB sweep is
    // gated by the session strokes-dirty flag (set on ANY strokes write — local
    // draw or pull merge) and only runs when the queue push above succeeded: an
    // offline/failed pass skips the sweep entirely (it would fail the same way),
    // and per-student batch failures inside a successful pass still flush. After
    // a successful sweep the flag clears — the 30-min interval no longer rescans
    // every canvas in the DB twice a day for zero new data. ----
    if (pushPassSucceeded && hasStrokesDirtySession()) {
      await pushAllDrawings(userId);
      clearStrokesDirtySession();
    }
  }
  return pushed;
};

/**
 * Pull pass — watermark-driven change detection. Reads the user-level
 * sync_manifest ONCE, then per student: ONE range query on draws
 * (updatedAt > last pull watermark; fresh device = everything), the overview
 * doc (only when its version is newer), and audio range diffs. Everything for
 * a student is committed to SQLite in ONE atomic transaction (savePullBatch),
 * so the syncing->synced Redux reload always observes a complete student.
 */
const pullChangedChunks = async (sid: string, studRef: any, pageInfo: Record<string, any>): Promise<number> => {
  let pulled = 0;
  const entries = Object.entries(pageInfo || {}) as Array<[string, any]>;
  const localChecks = await Promise.all(entries.map(async ([canvasKey, info]: any) => {
    const cloudV = typeof info === 'number' ? info : (info?.v || 0);
    const local = await getChunk(sid, canvasKey);
    if (!local || local.v < cloudV) return { canvasKey, v: cloudV };
    return null;
  }));
  const needed = localChecks.filter(Boolean) as { canvasKey: string; v: number }[];
  // Firestore 'in' queries support AT MOST 10 document IDs per query; run the
  // batches with bounded concurrency (5) instead of one-after-another — on a
  // slow link that's the difference between minutes and seconds for a big book.
  const slices: { canvasKey: string; v: number }[][] = [];
  for (let i = 0; i < needed.length; i += 10) slices.push(needed.slice(i, i + 10));
  const CONCURRENT_SLICES = 5;
  for (let i = 0; i < slices.length; i += CONCURRENT_SLICES) {
    const group = slices.slice(i, i + CONCURRENT_SLICES);
    await Promise.all(group.map(async (slice) => {
      const snaps = await studRef.collection('draws')
        .where(firestore.FieldPath.documentId(), 'in', slice.map(n => n.canvasKey)).get();
      await Promise.all(
        snaps.docs.map(async (doc: any) => {
          const canvasKey = doc.id;
          const targetV = slice.find(n => n.canvasKey === canvasKey)?.v || 0;
          const local = await getChunk(sid, canvasKey);
          // Guard against a race: the user edited this chunk on THIS device AFTER
          // the version check above — re-read it and skip the pull rather than
          // clobbering their fresh local edit with the stale cloud snapshot.
          if (local && local.v >= targetV) return;
          // cloud has NO strokes (stripped on push) — preserve local drawings
          await saveChunkNoQueue(sid, canvasKey, { ...doc.data(), strokes: local?.data?.strokes || [] }, targetV);
        })
      );
      pulled += snaps.docs.length;
    }));
  }
  return pulled;
};

/**
 * Pull pass — watermark-driven change detection. Reads the user-level
 * sync_manifest ONCE, then per student: ONE range query on draws
 * (updatedAt > last pull watermark; fresh device = everything), the overview
 * doc (only when its version is newer), and audio range diffs. Everything for
 * a student is committed to SQLite in ONE atomic transaction (savePullBatch),
 * so the syncing->synced Redux reload always observes a complete student.
 */
const pullStudent = async (
  userId: string,
  s: any,
  cloudInfo: any,
  studentsArr: { id: string }[],
): Promise<{ pulled: number; manifestChanged: boolean }> => {
  const sid = s.id;
  studentsArr.push({ id: sid, ...s.data() });
  const studRef = firestore().collection('users').doc(userId).collection('students').doc(sid);
  const cloudOV = cloudInfo?.v;
  const localM = await getManifest(sid);
  const localOV = localM.data.v || 0;
  const mustPullOverview = cloudInfo == null || cloudOV === undefined || cloudOV > localOV || (!localM.serverTs && (cloudOV || 0) >= localOV);

  // ---- ONE range query per student: every draws doc newer than the last pull
  // watermark (server timestamp; 0 on a fresh device = everything). This replaces
  // the old per-10-doc `in` loops — a fresh full-Quran pull went from ~60
  // sequential round trips to 1. Docs WITHOUT updatedAt (legacy) never match the
  // range filter and are recovered by the manifest-diff fallback below. ----
  const lastPullAt = await getLastPullAt(sid);
  const rangeSnap = await studRef.collection('draws')
    .where('updatedAt', '>', new Date(lastPullAt)).get();
  const chunks: { canvasKey: string; data: any; v: number }[] = [];
  const fetchedKeys = new Set<string>();
  let watermark = lastPullAt;
  await Promise.all(rangeSnap.docs.map(async (doc: any) => {
    const canvasKey = doc.id;
    const cloud = doc.data() as any;
    fetchedKeys.add(canvasKey);
    const t = cloud.updatedAt?.toMillis ? cloud.updatedAt.toMillis() : 0;
    if (t > watermark) watermark = t;
    // Clobber guard: never overwrite a fresher local edit made mid-pull.
    const local = await getChunk(sid, canvasKey);
    if (local && local.v >= (cloud.v || 0)) return;
    // cloud has NO strokes (stripped on push) — preserve local drawings
    chunks.push({ canvasKey, data: { ...cloud, strokes: local?.data?.strokes || [] }, v: cloud.v || 0 });
  }));
  // -1s margin: two docs committed in the same server instant must both be re-fetchable
  watermark = Math.max(lastPullAt, watermark - 1000);

  // ---- cloud manifest (bookmarks / pages / lastRead) — only when newer.
  // lastRead now syncs: keep whichever device wrote it last (LWW by updatedAt)
  // BEFORE savePullBatch REPLACES the whole manifest, so a pulled mark is
  // never wiped by a same-device cloud merge nor vice versa. ----
  let cloudMeta: any = null;
  if (mustPullOverview) {
    const mSnap = await studRef.collection('meta').doc('overview').get();
    if (mSnap.exists) cloudMeta = mSnap.data() as any;
  }
  let manifestChanged = false;
  if (cloudMeta) {
    cloudMeta = { ...cloudMeta };
    // Reading mark now syncs: keep whichever device wrote it last (LWW by updatedAt).
    const lr = newerLastRead(localM.data.lastRead, cloudMeta.lastRead);
    if (lr) cloudMeta.lastRead = lr; else delete cloudMeta.lastRead;
    // ---- Tombstones: strip deleted bookmarks from the pulled map BEFORE
    // savePullBatch replaces the whole local manifest, and fold the cloud
    // tombstone set into the local one (newest wins) — the wholesale replace
    // would otherwise forget this device's not-yet-pushed deletions.
    const tsOf = (v: any): number => (typeof v === 'string' ? (Date.parse(v) || 0) : (Number(v) || 0));
    const cbDel: Record<string, any> = (cloudMeta.deletedBookmarks as Record<string, any>) || {};
    if (cloudMeta.bookmarks) {
      const bm: Record<string, any> = {};
      for (const [k, v] of Object.entries(cloudMeta.bookmarks as Record<string, any>)) {
        const tts = cbDel[k] !== undefined ? tsOf(cbDel[k]) : 0;
        const bts = v?.createdAt ? new Date(v.createdAt).getTime() : 0;
        if (tts && tts >= bts) continue;   // deleted at or after creation: stays deleted
        bm[k] = v;
      }
      cloudMeta.bookmarks = bm;
    }
    const mergedDel: Record<string, any> = { ...((localM.data.deletedBookmarks as Record<string, any>) || {}) };
    for (const [k, v] of Object.entries(cbDel)) {
      if (mergedDel[k] === undefined || tsOf(v) >= tsOf(mergedDel[k])) mergedDel[k] = v;
    }
    cloudMeta.deletedBookmarks = mergedDel;
    manifestChanged = true;
  }

  // ---- legacy fallback: manifest pages whose doc has no updatedAt never matched
  // the range query — diff them through the (now concurrent) in-query path. ----
  const pagesInfo: Record<string, any> = cloudMeta ? (cloudMeta.pages || {}) : (cloudInfo?.pages || {});
  const missing = Object.keys(pagesInfo || {}).filter((k: string) => !fetchedKeys.has(k));
  let pulled = 0;
  if (missing.length) {
    const sub: Record<string, any> = {};
    for (const k of missing) sub[k] = pagesInfo[k];
    pulled += await pullChangedChunks(sid, studRef, sub);
  }

  // ---- audio ranges: same diff as before, but deferred into the batch write ----
  const audioWrites: { rangeKey: string; entries: any; v: number }[] = [];
  if (cloudInfo) {
    // audio: diff via the manifest — read a range doc only when it is newer
    for (const [range, info] of Object.entries(cloudInfo.audio || {}) as Array<[string, any]>) {
      const localA = await getAudioNotesRange(sid, range);
      if ((info.v || 0) > (localA.v || 0)) {
        const snap = await studRef.collection('audioNotes').doc(range).get();
        if (snap.exists) {
          const cloud = snap.data() as any;
          audioWrites.push({ rangeKey: range, entries: cloud.entries || {}, v: cloud.v || 0 });
          pulled += Object.keys(cloud.entries || {}).length;
        }
      }
    }
  } else {
    // no manifest entry yet (pre-upgrade cloud / first-ever pull): full scan, self-healing
    const audSnap = await studRef.collection('audioNotes').get();
    for (const d of audSnap.docs) {
      const cloud = d.data() as any;
      const local = await getAudioNotesRange(sid, d.id);
      if ((cloud.v || 0) > (local.v || 0) || !Object.keys(local.entries || {}).length) {
        audioWrites.push({ rangeKey: d.id, entries: cloud.entries || {}, v: cloud.v || 0 });
        pulled += Object.keys(cloud.entries || {}).length;
      }
    }
  }

  // ---- ONE atomic SQLite commit per student: chunks + manifest + audio + watermark.
  // Nothing above touches the DB until here, so a Redux reload can never observe a
  // half-pulled student — bookmarks, reading marks, notes and highlights all land
  // together the moment the syncing->synced reload fires. ----
  await savePullBatch(
    sid,
    chunks,
    cloudMeta ? { data: cloudMeta, serverTs: watermark > 0 ? watermark : Date.now() } : null,
    audioWrites,
    watermark > 0 || chunks.length > 0 || audioWrites.length > 0 ? (watermark > 0 ? watermark : Date.now()) : undefined,
  );
  if (chunks.length) pulled += chunks.length;
  return { pulled, manifestChanged };
};

const pullRemote = async (userId: string): Promise<{ pulled: number; manifestChanged: boolean }> => {
  const studentsSnap = await firestore().collection('users').doc(userId).collection('students').get();
  const maniSnap = await manifestRef(userId).get();
  const maniStudents: Record<string, any> = maniSnap.exists ? ((maniSnap.data() as any)?.students || {}) : {};
  let pulled = 0;
  let manifestChanged = false;
  const studentsArr: any[] = [];
  // Bounded pool of 3 concurrent slots: every await INSIDE pullStudent stays
  // sequential (ONE atomic savePullBatch per student — a student is never
  // half-pulled), but students' Firestore reads run in parallel. Only the SQLite
  // commit path serializes on the single connection; the PRAGMA busy_timeout=3000
  // in initDatabase covers racing transactions with "database is locked".
  const CONCURRENT_STUDENTS = 3;
  for (let i = 0; i < studentsSnap.docs.length; i += CONCURRENT_STUDENTS) {
    const group = studentsSnap.docs.slice(i, i + CONCURRENT_STUDENTS);
    const results = await Promise.all(group.map((s: any) =>
      pullStudent(userId, s, maniStudents[s.id], studentsArr)
        .catch((e: any) => { console.warn('pullStudent failed', s.id, e); return { pulled: 0, manifestChanged: false }; })
    ));
    for (const r of results) {
      pulled += r.pulled;
      manifestChanged = manifestChanged || r.manifestChanged;
    }
  }
  if (studentsArr.length) await cacheStudentList(studentsArr);
  return { pulled, manifestChanged };
};

// ---------------- lazy drawings: 10-page (or surah) chunks, only when asked ----------------
export interface DrawingGeometry { canvasW: number; canvasH: number; padX: number; }

// Last geometry used by the active-save pushDrawings path. pushAllDrawings runs
// OUTSIDE any screen (App.tsx 30-min/background syncs, Dashboard manual sync) and
// needs a geometry to compact strokes — the most recent active-save one is the
// closest match to the canvas the strokes were drawn on (see pushAllDrawings).
let lastDrawingGeo: DrawingGeometry | null = null;

/**
 * Compacts + content-box-normalizes the page's strokes and writes them into the ONE
 * cloud doc per 10-page range, MERGED per-page (dot-paths) so sibling pages in the
 * same range doc are never touched. Points become fractions of the text content box
 * (inside the horizontal padding), so a stroke under a word lands under that same
 * word on any device. norm:1 marks normalized paths for pullDrawings. An emptied
 * page is written as an explicit empty array so pullDrawings cannot resurrect
 * erased strokes from stale cloud data.
 */
export const pushDrawings = async (studentId: string, groupKey: string, pageKeys: string[], geo: DrawingGeometry) => {
  try {
    lastDrawingGeo = geo;
    const chunks = await Promise.all(pageKeys.map(k => getChunk(studentId, k).then(local => ({ k, local }))));
    // Write EVERY requested page key as its own dot-path field — including empty
    // arrays when a page's strokes were all erased locally. A bare whole-map .set()
    // here used to REPLACE the entire strokesByPage map with only the passed pages,
    // silently WIPING every sibling page in this range doc from the cloud.
    const patch: Record<string, any> = {};
    let hasLocal = false;
    let hasAny = false;
    for (const { k, local } of chunks) {
      if (local) hasLocal = true;
      const raw = local?.data?.strokes;
      const arr = raw && raw.length
        ? raw.map((p: any) => ({ ...p, norm: 1, points: compactStroke(p.points || [], geo.canvasW, geo.canvasH, geo.padX) }))
        : [];
      if (arr.length) hasAny = true;
      patch[`strokesByPage.${k}`] = arr;
    }
    if (!hasLocal) return;   // nothing ever saved for these pages — no doc to create
    const studRef = firestore().collection('users').doc(getUserId()).collection('students').doc(studentId);
    await studRef.collection('drawings').doc(groupKey).set(
      { ...patch, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true },   // merge at per-page dot-paths: sibling pages not in pageKeys stay untouched
    );
  } catch (e) { console.warn('pushDrawings', e); }
};

/**
 * Push-EVERYTHING pass for drawings — runs at the END of every pushAllDirty, so it
 * rides the exact same path App.tsx's 30-minute interval and background pushes use.
 * WHY: local strokes are saved with queue=false (they never enter sync_queue), so the
 *   only previous push was the active-save pushDrawings(), which swallows failures —
 *   a drawing made while offline stayed local forever. This scans ALL canvases with
 *   strokes and writes them to Firestore, COMPACTING each appended stroke exactly
 *   like pushDrawings does ({ ...p, norm: 1, points: compactStroke(...) }): the norm
 *   flag is forced in the same expression as the compacted points, so a stroke can
 *   never be scaled twice; cloud-owned strokes are copied through untouched. Geometry
 *   comes from the last active-save pushDrawings call, or the window size as fallback
 *   (pullDrawings denormalizes for the receiving device, so strokes still land at the
 *   correct word).
 *   - page_N canvases   -> students/{sid}/drawings/{r_<lo>_<lo+9>}  (10-page range, rangeKeyForPage)
 *   - surah_N canvases  -> students/{sid}/drawings/{surah_<n>}     (groupKey = the canvasKey itself)
 * Replace-on-write: one doc per range group, only when the group has strokes. Never
 * throws — per-student try/catch so one bad student can't abort the sync. Size guard:
 * a serialized group over ~800 KB is skipped with a warn (NO re-thin: writePages
 * points are already content-box fractions, so an aggressive pixel-space thinning
 * pass would collapse them to dots — skip, don't corrupt). Local data stays intact
 * and the cloud doc is never corrupted by a half-write. NOTE: such a group stays
 * skipped on every sweep until it is drawn over / shrinks below the guard (do NOT
 * split a group into multiple docs — pullDrawings reads exactly one doc per group).
 */
export const pushAllDrawings = async (userId: string): Promise<void> => {
  try {
    // Geometry for compaction: this pass runs OUTSIDE any screen, so reuse the most
    // recent active-save (pushDrawings) geometry; fall back to the window size if no
    // active save ever ran this session.
    const geo: DrawingGeometry = lastDrawingGeo ?? {
      canvasW: Dimensions.get('window').width,
      canvasH: Dimensions.get('window').height,
      padX: hPadFor(Dimensions.get('window').width),
    };
    const byStudent = await getAllCanvasesWithStrokesByStudent();
    for (const [sid, canvases] of Object.entries(byStudent)) {
      if (!canvases.length) continue;   // students with zero strokes are never listed anyway
      try {
        const groups: Record<string, Record<string, any[]>> = {};
        for (const { canvasKey, strokes } of canvases) {
          let groupKey = canvasKey;   // surah_N canvases use themselves as the group key
          const pageNum = canvasKey.startsWith('page_') ? parseInt(canvasKey.slice(5), 10) : 0;
          if (pageNum > 0) groupKey = rangeKeyForPage(pageNum);
          // Raw local strokes (absolute points) are kept as-is here; compaction +
          // the forced norm:1 tag happen at write time below — the norm key is set
          // in the SAME expression as the compacted points, so pullDrawings can
          // never denormalize a raw stroke twice.
          (groups[groupKey] = groups[groupKey] || {})[canvasKey] = strokes;
        }
        if (!Object.keys(groups).length) continue;
        const studRef = firestore().collection('users').doc(userId).collection('students').doc(sid);
        const drawingsRef = studRef.collection('drawings');
        await Promise.all(Object.entries(groups).map(async ([groupKey, strokesByPage]) => {
          // ANNOTATION-level merge: never clobber cloud strokes and never drop new
          // local ones. Start from the cloud pages, then append every local stroke
          // whose id is absent there (legacy id-less strokes only when that page is
          // empty in the cloud). No early hasNorm/content-length skip — new local
          // strokes always get written, and normalize-padded cloud docs keep their
          // normalized strokes untouched.
          const compactLocal = (p: any) => ({ ...p, norm: 1, points: compactStroke(p.points || [], geo.canvasW, geo.canvasH, geo.padX) });
          let writePages: Record<string, any[]> | null = null;
          try {
            const snap = await drawingsRef.doc(groupKey).get();
            if (snap.exists) {
              const cloudPages: Record<string, any[]> = (snap.data() as any)?.strokesByPage || {};
              const cloudIds = (arr: any[]) => new Set((arr || []).map((p: any) => p?.id).filter(Boolean));
              const missingAnywhere = Object.entries(strokesByPage).some(([k, strokes]) => {
                const ids = cloudIds(cloudPages[k]);
                return (strokes as any[]).some((p: any) => (p?.id ? !ids.has(p.id) : !(cloudPages[k] || []).length));
              });
              if (!missingAnywhere) return;   // cloud already has everything local has
              writePages = { ...cloudPages };   // cloud-owned strokes pass through UNTOUCHED (already norm:1 or legacy raw)
              for (const [k, strokes] of Object.entries(strokesByPage)) {
                const ids = cloudIds(writePages[k]);
                const add = (strokes as any[]).filter((p: any) => (p?.id ? !ids.has(p.id) : !(writePages[k] || []).length));
                if (add.length) {
                  const comp = add.map(compactLocal);
                  writePages[k] = [...(writePages[k] || []), ...comp];
                }
              }
            }
          } catch { /* cloud read failed — write anyway */ }
          if (!writePages) {
            // No cloud doc yet: every local stroke is appended, all compacted.
            writePages = {};
            for (const [k, strokes] of Object.entries(strokesByPage)) {
              const comp = (strokes as any[]).map(compactLocal);
              writePages[k] = comp;
            }
          }
          // ---- size guard: UTF-16 worst-case estimate (coordinates are ASCII, so
          // this overestimates — conservative) against Firestore's 1 MB doc limit.
          // The points in writePages are already content-box FRACTIONS (compacted
          // above); any further thinning would need pixel-space tolerances that
          // cannot be applied to fractions (they would drop every interior point
          // and collapse strokes to dots). So: write or skip — never re-thin.
          const estBytes = JSON.stringify(writePages).length * 2;
          if (estBytes > 800_000) {
            // Fail-safe: skip the group entirely. Local strokes stay intact in
            // SQLite, the cloud doc is never corrupted by a half-write (or by a
            // dots-collapsed re-thin), and the group stays eligible on later
            // sweeps once it shrinks below the guard.
            console.warn('pushAllDrawings: group exceeds size guard, skipped', sid, groupKey, estBytes);
            return;
          }
          await drawingsRef.doc(groupKey).set({
            strokesByPage: writePages,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          });
        }));
      } catch (e) { console.warn(`pushAllDrawings failed for student ${sid}`, e); }
    }
  } catch (e) { console.warn('pushAllDrawings', e); }
};

/**
 * Lazy pull for one range group: STROKE-LEVEL merge — never skips a page that
 * already has local strokes. Stroke ids (added by DrawingCanvas) dedupe cleanly:
 * a cloud stroke WITH an id is kept only when that id is missing locally; a
 * legacy stroke WITHOUT an id is kept only when the local page is empty (cannot
 * dedupe). Denormalizes back to the current screen's content box; writes are
 * queue-free so a pull never re-dirties the push queue.
 */
export const pullDrawings = async (studentId: string, groupKey: string, pageKeys: string[], geo: DrawingGeometry) => {
  try {
    const locals = await Promise.all(pageKeys.map(k => getChunk(studentId, k)));
    const studRef = firestore().collection('users').doc(getUserId()).collection('students').doc(studentId);
    const snap = await studRef.collection('drawings').doc(groupKey).get();
    if (!snap.exists) return;
    const strokesByPage: Record<string, any[]> = (snap.data() as any)?.strokesByPage || {};
    for (const k of pageKeys) {
      const cloudStrokes = strokesByPage[k];
      if (!cloudStrokes || !cloudStrokes.length) continue;
      const local = locals.find((_, i) => pageKeys[i] === k);
      const localStrokes = local?.data?.strokes || [];
      const localIds = new Set(localStrokes.map((p: any) => p?.id).filter(Boolean));
      const missing = cloudStrokes
        .filter((p: any) => (p?.id ? !localIds.has(p.id) : localStrokes.length === 0))
        .map((p: any) => (p.norm ? { ...p, norm: undefined, points: denormalizeStroke(p.points || [], geo.canvasW, geo.canvasH, geo.padX) } : p));
      if (!missing.length) continue;
      await saveChunkNoQueue(studentId, k, { ...(local?.data || {}), strokes: [...localStrokes, ...missing] }, (local?.v || 0) + 1);
    }
  } catch (e) { console.warn('pullDrawings', e); }
};

/** Lazy audio registry: fetches the whole 10-page group in one read when the range is missing or older locally. */
export const pullAudioRange = async (studentId: string, rangeKey: string) => {
  try {
    const local = await getAudioNotesRange(studentId, rangeKey);
    const studRef = firestore().collection('users').doc(getUserId()).collection('students').doc(studentId);
    const snap = await studRef.collection('audioNotes').doc(rangeKey).get();
    if (!snap.exists) return;
    const cloud = snap.data() as any;
    if ((cloud.v || 0) <= (local.v || 0) && Object.keys(local.entries || {}).length) return;
    await saveAudioNotesRange(studentId, rangeKey, cloud.entries || {}, cloud.v || 0, false);
  } catch (e) { console.warn('pullAudioRange', e); }
};
