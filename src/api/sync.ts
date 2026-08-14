import { firestore, getUserId } from './firebase';
import {
  getDirtyCanvasesByStudent, getAllCanvasesWithStrokesByStudent, rangeKeyForPage,
  getChunk, markSynced, bumpAttempt,
  getManifest, saveManifestLocal, saveChunkNoQueue,
  getAudioNotesRange, saveAudioNotesRange, migrateLegacyAudioNotes,
  getLastPushAt, setLastPushAt, cacheStudentList,
  getLastPullAt, savePullBatch,
} from '../database/localDB';
import { compactStroke, denormalizeStroke } from '../utils/stroke';

const MAX_BATCH_OPS = 450;             // Firestore batch limit is 500

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
 * Push pass — deterministic LWW versions (NO FieldValue.increment): every doc
 * carries an explicit v, and after a commit the LOCAL manifest mirror is bumped
 * to the pushed value, so the next pull sees cloud.v === local.v and skips.
 * Queue row types:
 *   - chunk keys (page_N / surah_N)  -> students/{sid}/draws/{k}  (highlights+notes ONLY; strokes stripped)
 *   - '_manifest'                    -> students/{sid}/meta/overview (bookmarks + lastRead;
 *                                      lastRead now syncs LWW, newest updatedAt wins)
 *   - '_audio_r_..'                  -> students/{sid}/audioNotes/{range} (10-page audio-note registry)
 * Every push also merges the student's chunk into the user-level sync_manifest
 * ({users/{uid}/meta/sync_manifest}) inside the SAME batch — zero extra
 * round-trips — so pulls can diff per-student versions with a single manifest read.
 */
const pushAllDirty = async (userId: string): Promise<number> => {
  let pushed = 0;
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
    let offset = 0;
    while (offset < canvasKeys.length) {
      const slice = canvasKeys.slice(offset, offset + MAX_BATCH_OPS);
      offset += slice.length;
      const batch = firestore().batch();
      const newPages: Record<string, any> = {};
      const pageVs: Record<string, number> = {};
      const chunks = await Promise.all(slice.map(k => getChunk(sid, k).then(local => ({ k, local }))));
      for (const { k, local } of chunks) {
        if (!local) { console.warn('pushAllDirty: missing local chunk, dropping', sid, k); await markSynced(sid, k); continue; }
        const { strokes, ...annotations } = local.data;
        batch.set(studRef.collection('draws').doc(k), {
          ...annotations,
          v: local.v,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        newPages[k] = { v: local.v };
        pageVs[k] = local.v;
        pushed++;
      }
      if (Object.keys(newPages).length === 0) { for (const k of slice) await markSynced(sid, k); continue; }
      const m = await getManifest(sid);
      const overviewV = (m.data.v || 0) + 1;
      const patch: Record<string, any> = { v: overviewV, updatedAt: firestore.FieldValue.serverTimestamp() };
      for (const [k, meta] of Object.entries(newPages)) patch[`pages.${k}.v`] = meta.v;
      if (m.data.lastRead) patch.lastRead = m.data.lastRead;   // reading mark now syncs (LWW on pull)
      batch.set(studRef.collection('meta').doc('overview'), patch, { merge: true });
      batch.set(manifestRef(userId), manifestSubtree(sid, { v: overviewV, pages: pageVs }), { merge: true });
      try {
        await batch.commit();
        await setLastPushAt(sid, Date.now());
        for (const k of slice) await markSynced(sid, k);
        await saveManifestLocal(sid, { ...m.data, pages: { ...(m.data.pages || {}), ...newPages }, v: overviewV }, Date.now(), false);
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
      try {
        const overviewV = await firestore().runTransaction(async (tx: any) => {
          const snap: any = await tx.get(overviewRef);
          const cloud: any = snap.exists ? (snap.data() || {}) : {};
          const cloudV: number = cloud.v || 0;
          const cloudBookmarks: Record<string, any> = cloud.bookmarks || {};
          const localBookmarks: Record<string, any> = m.data.bookmarks || {};
          for (const [k, lv] of Object.entries(localBookmarks) as Array<[string, any]>) {
            const cv = cloudBookmarks[k];
            const lts = lv?.createdAt ? new Date(lv.createdAt).getTime() : 0;
            const cts = cv?.createdAt ? new Date(cv.createdAt).getTime() : 0;
            merged[k] = lts >= cts ? lv : cv;
          }
          for (const [k, cv] of Object.entries(cloudBookmarks) as Array<[string, any]>) {
            if (!(k in merged)) merged[k] = cv;
          }
          const v = Math.max(m.data.v || 0, cloudV) + 1;
          const lr = newerLastRead(m.data.lastRead, cloud.lastRead);
          const patch: Record<string, any> = { v, updatedAt: firestore.FieldValue.serverTimestamp(), bookmarks: merged };
          if (lr) patch.lastRead = lr;
          tx.set(overviewRef, patch, { merge: true });
          tx.set(manifestRef(userId), manifestSubtree(sid, { v, pages: m.data.pages || {} }), { merge: true });
          return v;
        });
        await setLastPushAt(sid, Date.now());
        for (const k of manifestKeys) await markSynced(sid, k);
        // Persist the MERGED bookmark map locally too, so this device keeps the
        // cloud bookmarks it merged with (not just its own).
        await saveManifestLocal(sid, { ...m.data, bookmarks: merged, v: overviewV }, Date.now(), false);
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
  } finally {
    // ---- stray drawings: canvases with strokes are saved queue=false (never in
    // sync_queue), so they'd only reach Firestore via the active-save pushDrawings
    // path — which swallows failures while offline. Flush ALL of them here on every
    // full sync (the same path App.tsx's 30-min interval and background push use).
    // Runs in `finally`: the sweep happens even when a queue push above threw. ----
    await pushAllDrawings(userId);
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

const pullRemote = async (userId: string): Promise<{ pulled: number; manifestChanged: boolean }> => {
  const studentsSnap = await firestore().collection('users').doc(userId).collection('students').get();
  const maniSnap = await manifestRef(userId).get();
  const maniStudents: Record<string, any> = maniSnap.exists ? ((maniSnap.data() as any)?.students || {}) : {};
  let pulled = 0;
  let manifestChanged = false;
  const studentsArr: any[] = [];
  for (const s of studentsSnap.docs) {
    const sid = s.id;
    studentsArr.push({ id: sid, ...s.data() });
    const studRef = firestore().collection('users').doc(userId).collection('students').doc(sid);
    const cloudInfo = maniStudents[sid];
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
    if (cloudMeta) {
      cloudMeta = { ...cloudMeta };
      // Reading mark now syncs: keep whichever device wrote it last (LWW by updatedAt).
      const lr = newerLastRead(localM.data.lastRead, cloudMeta.lastRead);
      if (lr) cloudMeta.lastRead = lr; else delete cloudMeta.lastRead;
      manifestChanged = true;
    }

    // ---- legacy fallback: manifest pages whose doc has no updatedAt never matched
    // the range query — diff them through the (now concurrent) in-query path. ----
    const pagesInfo: Record<string, any> = cloudMeta ? (cloudMeta.pages || {}) : (cloudInfo?.pages || {});
    const missing = Object.keys(pagesInfo || {}).filter((k: string) => !fetchedKeys.has(k));
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
  }
  if (studentsArr.length) await cacheStudentList(studentsArr);
  return { pulled, manifestChanged };
};

// ---------------- lazy drawings: 10-page (or surah) chunks, only when asked ----------------
export interface DrawingGeometry { canvasW: number; canvasH: number; padX: number; }

/**
 * Compacts + content-box-normalizes the page's strokes and writes ONE cloud doc
 * per 10-page range. Points become fractions of the text content box (inside the
 * horizontal padding), so a stroke under a word lands under that same word on any
 * device. norm:1 marks normalized paths for pullDrawings.
 */
export const pushDrawings = async (studentId: string, groupKey: string, pageKeys: string[], geo: DrawingGeometry) => {
  try {
    const chunks = await Promise.all(pageKeys.map(k => getChunk(studentId, k).then(local => ({ k, local }))));
    const strokesByPage: Record<string, any[]> = {};
    let hasAny = false;
    for (const { k, local } of chunks) {
      const raw = local?.data?.strokes;
      if (raw && raw.length) {
        strokesByPage[k] = raw.map((p: any) => ({ ...p, norm: 1, points: compactStroke(p.points || [], geo.canvasW, geo.canvasH, geo.padX) }));
        hasAny = true;
      }
    }
    if (!hasAny) return;
    const studRef = firestore().collection('users').doc(getUserId()).collection('students').doc(studentId);
    await studRef.collection('drawings').doc(groupKey).set({
      strokesByPage,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) { console.warn('pushDrawings', e); }
};

/**
 * Push-EVERYTHING pass for drawings — runs at the END of every pushAllDirty, so it
 * rides the exact same path App.tsx's 30-minute interval and background pushes use.
 * WHY: local strokes are saved with queue=false (they never enter sync_queue), so the
 *   only previous push was the active-save pushDrawings(), which swallows failures —
 *   a drawing made while offline stayed local forever. This scans ALL canvases with
 *   strokes and writes them to Firestore RAW (no compaction/normalization — pullDrawings
 *   passes non-`norm` strokes through untouched, so cross-device recovery still works):
 *   - page_N canvases   -> students/{sid}/drawings/{r_<lo>_<lo+9>}  (10-page range, rangeKeyForPage)
 *   - surah_N canvases  -> students/{sid}/drawings/{surah_<n>}     (groupKey = the canvasKey itself)
 * Replace-on-write: one doc per range group, only when the group has strokes. Never
 * throws — per-student try/catch so one bad student can't abort the sync.
 */
export const pushAllDrawings = async (userId: string): Promise<void> => {
  try {
    const byStudent = await getAllCanvasesWithStrokesByStudent();
    for (const [sid, canvases] of Object.entries(byStudent)) {
      if (!canvases.length) continue;   // students with zero strokes are never listed anyway
      try {
        const groups: Record<string, Record<string, any[]>> = {};
        for (const { canvasKey, strokes } of canvases) {
          let groupKey = canvasKey;   // surah_N canvases use themselves as the group key
          const pageNum = canvasKey.startsWith('page_') ? parseInt(canvasKey.slice(5), 10) : 0;
          if (pageNum > 0) groupKey = rangeKeyForPage(pageNum);
          // Strip any `norm` marker: local strokes are always raw absolute
          // points, so a norm:1 tag here would make pullDrawings denormalize
          // them a second time and blow strokes off-canvas.
          const clean = strokes.map((p: any) => { const { norm, ...rest } = p; return rest; });
          (groups[groupKey] = groups[groupKey] || {})[canvasKey] = clean;
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
              writePages = { ...cloudPages };
              for (const [k, strokes] of Object.entries(strokesByPage)) {
                const ids = cloudIds(writePages[k]);
                const add = (strokes as any[]).filter((p: any) => (p?.id ? !ids.has(p.id) : !(writePages[k] || []).length));
                if (add.length) writePages[k] = [...(writePages[k] || []), ...add];
              }
            }
          } catch { /* cloud read failed — write anyway */ }
          await drawingsRef.doc(groupKey).set({
            strokesByPage: writePages || strokesByPage,
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
