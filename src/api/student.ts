/**
 * FILE: src/api/student.ts
 * ROLE: Student CRUD against Firestore with a per-user SQLite list cache and a
 *       fire-and-forget background refresh; no sync-queue involvement for list
 *       operations (those live in localDB for student DATA).
 * DEPENDS ON: src/api/firebase.ts (firestore, getUserId auth guard),
 *             src/database/localDB.ts (student_list_cache: getCachedStudentList,
 *             cacheStudentList)
 * USED BY: src/screens/DashboardScreen.tsx (all four CRUD fns)
 */
import { firestore, getUserId } from './firebase';
import { getCachedStudentList, cacheStudentList } from '../database/localDB';
/**
 * WHAT: Creates a cloud student doc plus its empty data blob document.
 * FLOW: 1) getUserId() guard -> 'No user' if null.
 *       2) firestore users/{uid}/students .add({name, createdAt:
 *          serverTimestamp}) — server-generated sid.
 *       3) Seed users/{uid}/students/{sid}/data/studentData with the empty
 *          blob {bookmarks:{}, highlights:{}, drawings:{}, notes:{},
 *          history:{actions:[], currentIndex:-1}}.
 *       4) Return { success:true, studentId: ref.id }.
 * CALLS: getUserId -> auth guard (firebase.ts)
 *        firestore().collection('students').add -> cloud doc + auto id
 *        ref.collection('data').doc('studentData').set -> seed empty blob
 * CALLED BY: DashboardScreen.tsx (handleCreate, Save button in Add modal) ->
 *            on success dispatches addStudent({id: studentId, name})
 *            (studentSlice.ts) so the list updates without refetch.
 * AFFECTS: Cloud: users/{uid}/students/{sid} + .../data/studentData (empty).
 *          Redux: student.list via caller's addStudent.
 *          Local: NOT cached, NOT queued — no offline create. The student
 *          only exists in Redux until the next getStudents refresh replaces
 *          it.
 * NOTES: Requires a live network AND Firestore rules permitting students
 *        create. No try/catch — offline create rejects and, because
 *        DashboardScreen awaits without catch, produces an unhandled
 *        rejection. Seed blob shape must match what sync.ts uploads and
 *        QuranViewScreen expects (bookmarks/highlights/drawings/notes/history).
 */
export const createStudent = async (name: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  const ref = await firestore().collection('users').doc(userId).collection('students').add({ name, createdAt: firestore.FieldValue.serverTimestamp() });
  await ref.collection('data').doc('studentData').set({ bookmarks: {}, highlights: {}, drawings: {}, notes: {}, history: { actions: [], currentIndex: -1 } });
  try {
    const list = (await getCachedStudentList()) || [];
    if (!list.some((s: any) => s?.id === ref.id)) {
      await cacheStudentList([...list, { id: ref.id, name, createdAt: new Date().toISOString() }]);
    }
  } catch {}
  return { success: true, studentId: ref.id };
};
/**
 * WHAT: Returns the student list for the current user — instantly from SQLite
 *       cache when available (with background refresh), else from Firestore.
 * FLOW: 1) getUserId() guard.
 *       2) getCachedStudentList() (localDB.ts, keyed by uid).
 *       3) Cache hit -> fire refreshInBackground(uid) (NOT awaited), return
 *          cached immediately.
 *       4) Cache miss -> firestore students collection orderBy('createdAt',
 *          'desc').get(); map docs to {id, ...data}; cacheStudentList();
 *          return.
 *       5) Catch: re-read cache; return it if present, else
 *          { success:false, error }.
 * CALLS: getUserId -> auth guard (firebase.ts)
 *        getCachedStudentList -> SQLite student_list_cache (localDB.ts)
 *        refreshInBackground -> background cache refresh (self, below)
 *        firestore().collection('students').orderBy(...).get() -> cloud list
 *        cacheStudentList -> SQLite student_list_cache upsert (localDB.ts)
 * CALLED BY: DashboardScreen.tsx (mount effect) -> dispatch(setStudents)
 *            (studentSlice.ts) on success.
 * AFFECTS: Redux: student.list via caller's setStudents.
 *          Local: student_list_cache (both branches write on fresh fetch).
 *          UI: Dashboard FlatList; offline first launch with no cache shows
 *          error (AlertModal via showAlert is NOT called here — the effect
 *          silently drops failures).
 * NOTES: refreshInBackground is NOT awaited — it updates SQLite but NOT
 *        Redux, so the in-memory list can be stale until remount. The
 *        next launch is fresher, not this one. orderBy('createdAt') is a
 *        simple single-field index (no composite index needed). Empty cloud
 *        list results in an empty cache — a legitimately-empty account is
 *        cached as [] and the catch-branch cache check (`length > 0`) then
 *        treats [] as "no cache", forcing a cloud read every launch (minor).
 */
export const getStudents = async () => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  try {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) { refreshInBackground(userId); return { success: true, students: cached }; }
    const snap = await firestore().collection('users').doc(userId).collection('students').orderBy('createdAt', 'desc').get();
    const students = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
    await cacheStudentList(students);
    return { success: true, students };
  } catch (e: any) {
    const cached = await getCachedStudentList();
    if (cached && cached.length > 0) return { success: true, students: cached };
    return { success: false, error: e?.message };
  }
};

/**
 * WHAT: Silent best-effort refetch of the student list into the SQLite cache.
 * FLOW: 1) orderBy('createdAt','desc') get for uid.
 *       2) cacheStudentList(mapped docs).
 *       3) Any error swallowed.
 * CALLS: firestore()...get() -> cloud list; cacheStudentList -> cache write
 * CALLED BY: getStudents (fire-and-forget, not awaited)
 * AFFECTS: student_list_cache only.
 * NOTES: Unawaited — run inside getStudents while the UI already rendered the
 *        cached list; makes the NEXT launch fresher, not this one.
 */
async function refreshInBackground(uid: string) {
  try {
    const snap = await firestore().collection('users').doc(uid).collection('students').orderBy('createdAt', 'desc').get();
    await cacheStudentList(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })));
  } catch {}
}
/**
 * WHAT: Renames a cloud student document.
 * FLOW: 1) getUserId() guard.
 *       2) users/{uid}/students/{id} .update({name}).
 *       3) Return { success:true }.
 * CALLS: getUserId -> auth guard; firestore().doc().update -> cloud rename
 * CALLED BY: DashboardScreen.tsx (handleEdit, Save in Edit modal) -> on
 *            success dispatches updateStudentSlice({id, name}) (studentSlice)
 *            keeping Redux in sync.
 * AFFECTS: Cloud: users/{uid}/students/{sid}.name. Redux: student.list entry
 *          + currentStudent (via caller dispatch). SQLite cache: untouched —
 *          the renamed name comes from Redux until next getStudents refresh.
 * NOTES: No try/catch — offline rename rejects unhandled at the call site
 *        (DashboardScreen awaits without catch). Firestore rules must allow
 *        update on users/{uid}/students/{sid}.
 */
export const updateStudent = async (id: string, name: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  await firestore().collection('users').doc(userId).collection('students').doc(id).update({ name });
  try {
    const list = (await getCachedStudentList()) || [];
    const next = list.map((s: any) => (s?.id === id ? { ...s, name } : s));
    await cacheStudentList(next);
  } catch {}
  return { success: true };
};

/**
 * WHAT: Deletes a cloud student document (data blob doc is left orphaned).
 * FLOW: 1) getUserId() guard.
 *       2) users/{uid}/students/{id} .delete().
 *       3) Return { success:true }.
 * CALLS: getUserId -> auth guard; firestore().doc().delete() -> cloud delete
 * CALLED BY: DashboardScreen.tsx (long-press -> Delete action) -> then
 *            purgeLocalStudent(item.id) (localDB.ts, wipes
 *            student_data_cache + sync_queue rows) and dispatch(removeStudent)
 *            (studentSlice.ts).
 * AFFECTS: Cloud: users/{uid}/students/{sid} deleted — BUT the nested
 *          .../data/studentData doc is NOT deleted (Firestore delete is
 *          non-recursive): orphaned blob remains billable/stale.
 *          Redux: student.list + currentStudent via removeStudent.
 *          Local: student_data_cache/sync_queue purged by caller.
 * NOTES: No try/catch; offline delete rejects unhandled. Sync queue rows for
 *        that student are removed locally by the caller, but nothing revokes
 *        already-uploaded cloud data. No tombstones — a deleted student could
 *        be resurrected by an older queued sync on another device ([v1] push-
 *        only has no conflict handling).
 */
export const deleteStudent = async (id: string) => {
  const userId = getUserId();
  if (!userId) return { success: false, error: 'No user' };
  await firestore().collection('users').doc(userId).collection('students').doc(id).delete();
  return { success: true };
};

/**
 * WHAT: Ensures the reserved "My Quran" student exists — the pinned personal Quran.
 * FLOW: 1) getUserId() guard. 2) getStudents() (cache-first, falls back to Firestore
 *          cloud read). 3) If any doc has isMyQuran===true or name==="My Quran",
 *          return its id. 4) Else createStudent("My Quran"), then Firestore update
 *          isMyQuran:true on that doc, then patch the SQLite student_list_cache so
 *          the next Dashboard paint sees it without waiting for background refresh.
 * CALLS: getUserId, getStudents (self), createStudent, cacheStudentList.
 * CALLED BY: src/api/auth.ts registerUser (new accounts), DashboardScreen
 *            useFocusEffect migration (existing accounts).
 * NOTES: Offline create is intentionally deferred — returns null (caller retries
 *        on next Dashboard focus when online). Never queued.
 */
export const ensureMyQuranStudent = async (): Promise<string | null> => {
  const userId = getUserId();
  if (!userId) return null;
  try {
    const res = await getStudents();
    const list: any[] = res?.success && Array.isArray(res.students) ? res.students : [];
    const existing = list.find((s: any) => s?.isMyQuran === true || s?.name === 'My Quran');
    if (existing?.id) return String(existing.id);
    const created = await createStudent('My Quran');
    if (!created?.success || !created?.studentId) return null;
    try {
      await firestore().collection('users').doc(userId).collection('students').doc(created.studentId).update({ isMyQuran: true });
    } catch {}
    try {
      const cached = (await getCachedStudentList()) || [];
      const idx = cached.findIndex((s: any) => s?.id === created.studentId);
      if (idx !== -1) {
        const patched = [...cached];
        patched[idx] = { ...patched[idx], name: 'My Quran', isMyQuran: true };
        await cacheStudentList(patched);
      } else {
        await cacheStudentList([...cached, { id: created.studentId, name: 'My Quran', isMyQuran: true, createdAt: new Date().toISOString() }]);
      }
    } catch {}
    return String(created.studentId);
  } catch {
    return null;
  }
};