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
import { firestore, getUserId } from './firebase'
import { getCachedStudentList, cacheStudentList } from '../database/localDB'
/**
 * WHAT: Creates a cloud student doc plus its empty data blob document.
 * FLOW: 1) getUserId() guard -> 'No user' if null.
 *       2) firestore users/{uid}/students .add({name, createdAt:
 *          serverTimestamp()}) — server-generated sid.
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
 *        create. Seed blob shape must match what sync.ts uploads and
 *        QuranViewScreen expects (bookmarks/highlights/drawings/notes/history).
 *        Wrapped in try/catch — an offline create returns { success:false,
 *        error } instead of rejecting, so DashboardScreen's bare await (no
 *        try/catch there) no longer produces an unhandled rejection and can
 *        surface the error via its AlertModal.
 */
export const createStudent = async (name: string) => {
  const userId = getUserId()
  if (!userId) return { success: false, error: 'No user' }
  try {
    const ref = await firestore().collection('users').doc(userId).collection('students').add({ name, createdAt: firestore.FieldValue.serverTimestamp() })
    await ref.collection('data').doc('studentData').set({ bookmarks: {}, highlights: {}, drawings: {}, notes: {}, history: { actions: [], currentIndex: -1 } })
    return { success: true, studentId: ref.id }
  } catch (e: any) { return { success: false, error: e?.message || 'Network error. Check your connection.' } }
}
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
 *        simple single-field index (no composite index needed). A cached
 *        EMPTY list is a legit cache hit too: getCachedStudentList returns
 *        null only when no cache row exists, [] when the account was
 *        confirmed empty — so `cached !== null` serves both from cache
 *        (previously `length > 0` re-read the cloud on every launch for
 *        empty accounts) and refreshInBackground keeps them fresh.
 */
export const getStudents = async () => {
  const userId = getUserId()
  if (!userId) return { success: false, error: 'No user' }
  try {
    const cached = await getCachedStudentList()
    if (cached !== null) {
      refreshInBackground(userId)
      return { success: true, students: cached }
    }
    const snap = await firestore().collection('users').doc(userId).collection('students').orderBy('createdAt', 'desc').get()
    const students = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }))
    await cacheStudentList(students)
    return { success: true, students }
  } catch (e: any) {
    const cached = await getCachedStudentList()
    if (cached !== null) return { success: true, students: cached }
    return { success: false, error: e?.message }
  }
}

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
    const snap = await firestore().collection('users').doc(uid).collection('students').orderBy('createdAt', 'desc').get()
    await cacheStudentList(snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })))
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
 * NOTES: Wrapped in try/catch — an offline rename returns { success:false,
 *        error } instead of rejecting unhandled at the call site
 *        (DashboardScreen awaits without catch); its `if (res.success)`
 *        branch shows the error via AlertModal. Firestore rules must allow
 *        update on users/{uid}/students/{sid}.
 */
export const updateStudent = async (id: string, name: string) => {
  const userId = getUserId()
  if (!userId) return { success: false, error: 'No user' }
  try {
    await firestore().collection('users').doc(userId).collection('students').doc(id).update({ name })
    return { success: true }
  } catch (e: any) { return { success: false, error: e?.message || 'Network error. Check your connection.' } }
}

/**
 * WHAT: Deletes a cloud student document and its nested subcollection docs so
 *       nothing orphaned remains billable.
 * FLOW: 1) getUserId() guard.
 *       2) Delete subcollections under users/{uid}/students/{sid} —
 *          data/studentData (seeded by createStudent), draws/*, drawings/*,
 *          audioNotes/*, meta/overview (written by sync.ts) — Firestore
 *          delete is non-recursive, so each subcollection is enumerated.
 *       3) users/{uid}/students/{id} .delete() last.
 *       4) Return { success:true }.
 * CALLS: getUserId -> auth guard; deleteSubcollectionDocs (self, below);
 *        firestore().doc().delete() -> cloud delete
 * CALLED BY: DashboardScreen.tsx (long-press -> Delete action) -> then
 *            purgeLocalStudent(item.id) (localDB.ts, wipes
 *            student_data_cache + sync_queue rows) and dispatch(removeStudent)
 *            (studentSlice.ts).
 * AFFECTS: Cloud: users/{uid}/students/{sid} AND all nested docs under it
 *          (previously the .../data/studentData blob and sync-written docs
 *          were orphaned and left billable).
 *          Redux: student.list + currentStudent via removeStudent.
 *          Local: student_data_cache/sync_queue purged by caller.
 * NOTES: Wrapped in try/catch — offline delete returns { success:false,
 *        error } instead of rejecting unhandled. GOTCHA: DashboardScreen's
 *        Delete handler ignores the result and still purges locally +
 *        dispatches removeStudent, so an offline delete disappears from the
 *        UI and is re-added by the next cloud refresh — the caller should
 *        gate the local purge on res.success. Sync queue rows for that
 *        student are removed locally by the caller, but nothing revokes
 *        already-uploaded cloud data. No tombstones — a deleted student could
 *        be resurrected by an older queued sync on another device ([v1] push-
 *        only has no conflict handling).
 */
export const deleteStudent = async (id: string) => {
  const userId = getUserId()
  if (!userId) return { success: false, error: 'No user' }
  try {
    const studentRef = firestore().collection('users').doc(userId).collection('students').doc(id)
    await deleteSubcollectionDocs(studentRef.collection('data'))
    await deleteSubcollectionDocs(studentRef.collection('draws'))
    await deleteSubcollectionDocs(studentRef.collection('drawings'))
    await deleteSubcollectionDocs(studentRef.collection('audioNotes'))
    await deleteSubcollectionDocs(studentRef.collection('meta'))
    await studentRef.delete()
    return { success: true }
  } catch (e: any) { return { success: false, error: e?.message || 'Network error. Check your connection.' } }
}

/**
 * WHAT: Firestore doc deletes are non-recursive — enumerate a subcollection
 *       and delete every doc so nested data is never orphaned.
 * FLOW: 1) colRef.get() lists all docs (empty subcollection -> no-op).
 *       2) Each doc .delete() in parallel.
 * CALLS: colRef.get(); doc.ref.delete()
 * CALLED BY: deleteStudent (this file, once per subcollection)
 * AFFECTS: Cloud nested docs under users/{uid}/students/{sid}.
 * NOTES: Module-private. Any read/delete failure propagates to
 *        deleteStudent's catch and aborts before the student doc is deleted,
 *        so an offline (or rules-denied) delete removes nothing — the caller
 *        can retry. Rule caveat: enumerating subcollections requires list
 *        permission on them (console-managed rules, unverifiable here).
 */
async function deleteSubcollectionDocs(colRef: any) {
  const snap = await colRef.get()
  await Promise.all(snap.docs.map((d: any) => d.ref.delete()))
}
