import { firestore, getUserId } from './firebase';
import {
  getDirtyCanvasesByStudent, getChunk, markSynced, bumpAttempt,
  getManifest, saveManifestLocal, saveChunkNoQueue,
  getAudioNotesRange, saveAudioNotesRange, migrateLegacyAudioNotes,
  getLastPushAt, setLastPushAt, cacheStudentList,
} from '../database/localDB';
import { compactStroke, denormalizeStroke } from '../utils/stroke';

const MAX_BATCH_OPS = 450;             // Firestore batch limit is 500

const manifestRef = (userId: string) => firestore().collection('users').doc(userId).collection('meta').doc('sync_manifest');
/** Per-student subtree for the user-level sync_manifest doc (merged with {merge:true} so only this student changes). */
const manifestSubtree = (sid: string, fields: { v?: number; pages?: Record<string, any>; audio?: Record<string, any> }) => ({ students: { [sid]: fields } });

let inFlight: Promise<any> | null = null;
let pendingPull = false;               // a pull request arrived while syncing: re-run after

export const requestSync = async (opts?: { pull?: boolean }): Promise<any> => {
  if (inFlight) {
    if (opts?.pull) pendingPull = true;
    return inFlight.then(() => {
      if (!pendingPull) return undefined;
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
      if (opts?.pull) pulled = await pullRemote(userId);
      return { success: true, pushed, pulled };
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
 *   - '_manifest'                    -> students/{sid}/meta/overview (bookmarks ONLY; lastRead is LOCAL-ONLY and never synced)
 *   - '_audio_r_..'                  -> students/{sid}/audioNotes/{range} (10-page audio-note registry)
 * Every push also merges the student's chunk into the user-level sync_manifest
 * ({users/{uid}/meta/sync_manifest}) inside the SAME batch — zero extra
 * round-trips — so pulls can diff per-student versions with a single manifest read.
 */
const pushAllDirty = async (userId: string): Promise<number> => {
  const groups = await getDirtyCanvasesByStudent();
  let pushed = 0;
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

    // ---- manifest (bookmarks ONLY — lastRead is local-only, never pushed) — own batch so it pushes even with no dirty chunks ----
    if (manifestKeys.length) {
      const m = await getManifest(sid);
      const overviewV = (m.data.v || 0) + 1;
      const patch: Record<string, any> = { v: overviewV, updatedAt: firestore.FieldValue.serverTimestamp() };
      patch.bookmarks = m.data.bookmarks || {};
      try {
        await firestore().batch()
          .set(studRef.collection('meta').doc('overview'), patch, { merge: true })
          .set(manifestRef(userId), manifestSubtree(sid, { v: overviewV, pages: m.data.pages || {} }), { merge: true })
          .commit();
        await setLastPushAt(sid, Date.now());
        for (const k of manifestKeys) await markSynced(sid, k);
        await saveManifestLocal(sid, { ...m.data, v: overviewV }, Date.now(), false);
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
  return pushed;
};

/**
 * Pull pass — manifest-driven change detection. Reads the user-level
 * sync_manifest ONCE; per-student cloud reads (overview + draws + audioNotes)
 * happen ONLY for students whose manifest version is newer than local, so a
 * no-change pull costs students(1) + manifest(1) reads regardless of N students.
 */
const pullChangedChunks = async (sid: string, studRef: any, pageInfo: Record<string, any>): Promise<number> => {
  let pulled = 0;
  const entries = Object.entries(pageInfo || {}) as Array<[string, any]>;
  const localChecks = await Promise.all(entries.map(async ([canvasKey, info]: any) => {
    const local = await getChunk(sid, canvasKey);
    if (!local || local.v < (info.v || 0)) return { canvasKey, v: info.v || 0 };
    return null;
  }));
  const needed = localChecks.filter(Boolean) as { canvasKey: string; v: number }[];
  for (let i = 0; i < needed.length; i += 30) {
    const slice = needed.slice(i, i + 30);
    const snaps = await studRef.collection('draws')
      .where(firestore.FieldPath.documentId(), 'in', slice.map(n => n.canvasKey)).get();
    await Promise.all(
      snaps.docs.map(async (doc: any) => {
        const canvasKey = doc.id;
        const targetV = slice.find(n => n.canvasKey === canvasKey)?.v || 0;
        const local = await getChunk(sid, canvasKey);
        // cloud has NO strokes (stripped on push) — preserve local drawings
        await saveChunkNoQueue(sid, canvasKey, { ...doc.data(), strokes: local?.data?.strokes || [] }, targetV);
      })
    );
    pulled += snaps.docs.length;
  }
  return pulled;
};

const pullRemote = async (userId: string): Promise<number> => {
  const studentsSnap = await firestore().collection('users').doc(userId).collection('students').get();
  const maniSnap = await manifestRef(userId).get();
  const maniStudents: Record<string, any> = maniSnap.exists ? ((maniSnap.data() as any)?.students || {}) : {};
  let pulled = 0;
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

    if (mustPullOverview) {
      const mSnap = await studRef.collection('meta').doc('overview').get();
      if (mSnap.exists) {
        const cloudMeta = mSnap.data() as any;
        if (cloudMeta) {
          // lastRead is LOCAL-ONLY (never pushed) — strip it from the cloud snapshot
          // and keep the LOCAL reading position (saveManifestLocal REPLACES the whole
          // manifest, so without this the local mark would be wiped on every pull).
          const clean = { ...cloudMeta };
          delete clean.lastRead;
          clean.lastRead = localM.data.lastRead;
          await saveManifestLocal(sid, clean, Date.now(), false);
          pulled += await pullChangedChunks(sid, studRef, clean.pages || {});
        }
      }
    } else {
      pulled += await pullChangedChunks(sid, studRef, cloudInfo.pages || {});
    }

    if (cloudInfo) {
      // audio: diff via the manifest — read a range doc only when it is newer
      for (const [range, info] of Object.entries(cloudInfo.audio || {}) as Array<[string, any]>) {
        const localA = await getAudioNotesRange(sid, range);
        if ((info.v || 0) > (localA.v || 0)) {
          const snap = await studRef.collection('audioNotes').doc(range).get();
          if (snap.exists) {
            const cloud = snap.data() as any;
            await saveAudioNotesRange(sid, range, cloud.entries || {}, cloud.v || 0, false);
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
          await saveAudioNotesRange(sid, d.id, cloud.entries || {}, cloud.v || 0, false);
          pulled += Object.keys(cloud.entries || {}).length;
        }
      }
    }
  }
  if (studentsArr.length) await cacheStudentList(studentsArr);
  return pulled;
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
 * Lazy pull for one range group: restores strokes into local chunks ONLY for
 * pages that have no local drawings yet (never clobbers), denormalizing back to
 * the current screen's content box. Legacy raw cloud paths (no norm marker) pass
 * through untouched.
 */
export const pullDrawings = async (studentId: string, groupKey: string, pageKeys: string[], geo: DrawingGeometry) => {
  try {
    // skip the Firestore read entirely when every page in the range already has
    // local strokes (a range doc only exists when at least one page had strokes)
    const locals = await Promise.all(pageKeys.map(k => getChunk(studentId, k)));
    if (locals.every(l => l?.data?.strokes?.length)) return;
    const studRef = firestore().collection('users').doc(getUserId()).collection('students').doc(studentId);
    const snap = await studRef.collection('drawings').doc(groupKey).get();
    if (!snap.exists) return;
    const cloud = snap.data() as any;
    const strokesByPage: Record<string, any[]> = cloud?.strokesByPage || {};
    for (const k of pageKeys) {
      const cloudStrokes = strokesByPage[k];
      if (!cloudStrokes || !cloudStrokes.length) continue;
      const local = locals.find((_, i) => pageKeys[i] === k);
      if (local?.data?.strokes?.length) continue;
      const strokes = cloudStrokes.map((p: any) => (p.norm ? { ...p, points: denormalizeStroke(p.points || [], geo.canvasW, geo.canvasH, geo.padX) } : p));
      await saveChunkNoQueue(studentId, k, { ...(local?.data || {}), strokes }, (local?.v || 0) + 1);
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
