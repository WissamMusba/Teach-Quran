import { firestore, getUserId } from './firebase';
import {
  getDirtyCanvasesByStudent, getChunk, markSynced, bumpAttempt,
  getManifest, saveManifestLocal, saveChunk,
  getLastPushAt, setLastPushAt,
} from '../database/localDB';

const MIN_PUSH_INTERVAL = 60_000;      // lever 5: hard cap per student
const MAX_BATCH_OPS = 450;             // Firestore batch limit is 500

let inFlight: Promise<any> | null = null;

export const requestSync = async (opts?: { pull?: boolean }): Promise<any> => {
  if (inFlight) return inFlight;                       // single-flight guard
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

const pushAllDirty = async (userId: string): Promise<number> => {
  const groups = await getDirtyCanvasesByStudent();
  let pushed = 0;
  for (const [sid, keys] of Object.entries(groups)) {
    if (!keys.length) continue;
    // lever 5: min-interval guard
    if (Date.now() - (await getLastPushAt(sid)) < MIN_PUSH_INTERVAL) continue;

    let offset = 0;
    while (offset < keys.length) {
      const slice = keys.slice(offset, offset + MAX_BATCH_OPS);
      offset += slice.length;
      const batch = firestore().batch();
      const drawsCol = firestore().collection('users').doc(userId)
        .collection('students').doc(sid).collection('draws');
      const manifestPatch: Record<string, any> = {};

      const canvasKeys = slice.filter((k: string) => k !== '_manifest');
      const includesManifest = slice.includes('_manifest');

      for (const k of canvasKeys) {
        const local = await getChunk(sid, k);
        if (!local) { await markSynced(sid, k); continue; }
        batch.set(drawsCol.doc(k), {
          ...local.data,
          v: firestore.FieldValue.increment(1),                 // LWW counter
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        manifestPatch[`pages.${k}.v`] = firestore.FieldValue.increment(1);
        manifestPatch[`pages.${k}.hasDrawings`] = !!local.data.strokes?.length;
        if (local.data.strokes) manifestPatch[`pages.${k}.strokes`] = local.data.strokes.length;
        pushed++;
      }
      if (includesManifest) {
        const m = await getManifest(sid);
        if (m.data.bookmarks) manifestPatch.bookmarks = m.data.bookmarks;
        if (m.data.lastRead) manifestPatch.lastRead = m.data.lastRead;
        if (m.data.audioNotes) manifestPatch.audioNotes = m.data.audioNotes;
        pushed++;
      }
      if (Object.keys(manifestPatch).length === 0) continue;
      // manifest: ONCE per run (lever 3) - one write covers all dirty canvases
      batch.set(
        firestore().collection('users').doc(userId)
          .collection('students').doc(sid).collection('meta').doc('overview'),
        { ...manifestPatch, v: firestore.FieldValue.increment(1),
          updatedAt: firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      try {
        await batch.commit();
        await setLastPushAt(sid, Date.now());
        for (const k of slice) await markSynced(sid, k);
      } catch (e) {
        console.warn(`push failed ${sid}`, e);
        for (const k of slice) { await bumpAttempt(sid, k); await markSynced(sid, k); } // give up -> manual retry
      }
    }
  }
  return pushed;
};

const pullRemote = async (userId: string): Promise<number> => {
  const studentsSnap = await firestore().collection('users').doc(userId).collection('students').get();
  let pulled = 0;
  for (const s of studentsSnap.docs) {
    const sid = s.id;
    const mRef = firestore().collection('users').doc(userId)
      .collection('students').doc(sid).collection('meta').doc('overview');
    const mSnap = await mRef.get();
    if (!mSnap.exists) continue;
    const cloudMeta = mSnap.data();
    const localM = await getManifest(sid);

    // DIRECTIONAL CHECK: never clobber local-unpushed changes
    if ((cloudMeta.v || 0) > (localM.data.v || 0)) {
      await saveManifestLocal(sid, cloudMeta);
    } else if ((cloudMeta.v || 0) < (localM.data.v || 0)) {
      continue;                                            // local ahead: push first
    } else if (!localM.serverTs) {
      await saveManifestLocal(sid, cloudMeta);             // first ever pull
    } else {
      continue;
    }

    const pages = cloudMeta.pages || {};
    for (const [canvasKey, info] of Object.entries(pages) as Array<[string, any]>) {
      const local = await getChunk(sid, canvasKey);
      if (local && local.v >= (info.v || 0)) continue;     // targeted download only
      const dSnap = await firestore().collection('users').doc(userId)
        .collection('students').doc(sid).collection('draws').doc(canvasKey).get();
      if (dSnap.exists) {
        await saveChunk(sid, canvasKey, dSnap.data(), info.v || 0);
        pulled++;
      }
    }
  }
  return pulled;
};
