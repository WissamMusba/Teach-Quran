/**
 * FILE: src/store/studentSlice.ts
 * ROLE: Student list + the active student's full annotation payload in memory.
 * DEPENDS ON: none (data flows via src/api/student.ts, src/database/localDB.ts).
 * USED BY: src/screens/DashboardScreen.tsx:5 (setStudents, addStudent,
 *          removeStudent, updateStudent as updateStudentSlice, setCurrentStudent);
 *          src/screens/QuranViewScreen.tsx:8 (setStudentData);
 *          readers: DashboardScreen.tsx:26 (list), QuranViewScreen.tsx:109
 *          (currentStudent, studentData), BookmarksScreen.tsx:33,
 *          NotesScreen.tsx:11, MistakesScreen.tsx:8 (studentData)
 * NOTE: NOT persisted (whitelist excludes 'student') — annotation data survives
 *       via SQLite (src/database/localDB.ts) + Firestore sync, reloaded into
 *       memory at runtime.
 */
import { createSlice } from '@reduxjs/toolkit';
export const studentSlice = createSlice({
  // initialState:
  //   - list: [] (any[])           -> all students [{id, name}] from Firestore
  //   - currentStudent: null (any) -> {id, name} of tapped student
  //   - studentData: null (any)    -> live annotation payload, shape:
  //       {
  //         bookmarks:  { `${surahId}_${verse}`: { surah, verse, createdAt } }
  //         highlights: { `${surahId}_${verse}`: { highlights: [{ id, wordIndex, color, createdAt }] } }
  //         drawings:   { `page_N` | `surah_N`: { paths: [{points,color,width,opacity,tool}], updatedAt } }
  //         notes:      { `${surahId}_${verse}`: string (may contain `audio:<path>` lines) }
  //         lastRead:   { surah, verse } | null
  //         updatedAt:  ISO string
  //       }
  //   setCurrentStudent RESETS studentData to null (QuranView reloads from localDB).
  name: 'student', 
  initialState: { list: [] as any[], currentStudent: null as any, studentData: null as any },
  reducers: {
    /**
     * WHAT: Replaces list with fetched students.
     * CALLED BY: DashboardScreen.tsx:30 (mount effect: getStudents().then).
     * AFFECTS: Dashboard FlatList (DashboardScreen.tsx:85).
     */
    setStudents: (state, action) => { state.list = action.payload; },
    /**
     * WHAT: Appends one student to list.
     * CALLED BY: DashboardScreen.tsx:38 (handleCreate after createStudent() success).
     * AFFECTS: Student list row appears immediately.
     */
    addStudent: (state, action) => { state.list.push(action.payload); },
    /**
     * WHAT: Sets currentStudent and RESETS studentData to null (QuranViewScreen
     *       effect then loads it from localDB).
     * CALLED BY: DashboardScreen.tsx:66 (student card tap; also resets surah to 1,
     *            closes drawing toolbar, navigates to QuranView).
     * AFFECTS: QuranViewScreen.tsx:109 (currentStudent drives save path :293-297
     *          load effect, :327 flushPendingSave guard).
     */
    setCurrentStudent: (state, action) => { state.currentStudent = action.payload; state.studentData = null; },
    /**
     * WHAT: Replaces the full annotation payload.
     * CALLED BY: QuranViewScreen.tsx:295 (initial localDB load, or seeds defaults);
     *            QuranViewScreen.tsx:333 (updateData() — optimistic write, then
     *            debounced 400ms flush to SQLite+sync queue :322-337).
     * AFFECTS: BookmarksScreen.tsx:33, NotesScreen.tsx:11, MistakesScreen.tsx:8
     *          (screens re-read on focus); QuranViewScreen render — highlights
     *          (:520/:540/:586), bookmarks (:521/:587), notes, drawings (:608-617),
     *          readingMark (:446), lastRead restore effect (:299-311).
     */
    setStudentData: (state, action) => { state.studentData = action.payload; },
    /**
     * WHAT: Filters list, and nulls currentStudent+studentData if it was the one.
     * CALLED BY: DashboardScreen.tsx:53 (long-press Delete; also deleteStudent API +
     *            purgeLocalStudent).
     * AFFECTS: List row disappears; if active, QuranView entry state cleared.
     */
    removeStudent: (state, action) => { 
      state.list = state.list.filter((s: any) => s.id !== action.payload); 
      if (state.currentStudent?.id === action.payload) {
        state.currentStudent = null;
        state.studentData = null;
      }
    },
    /**
     * WHAT: Renames in-place in list (and currentStudent if matching).
     * CALLED BY: DashboardScreen.tsx:61 (handleEdit after updateStudent() API success).
     * AFFECTS: Renamed row in Dashboard list.
     */
    updateStudent: (state, action) => {
      const { id, name } = action.payload;
      const idx = state.list.findIndex((s: any) => s.id === id);
      if (idx !== -1) state.list[idx] = { ...state.list[idx], name };
      if (state.currentStudent?.id === id) state.currentStudent = { ...state.currentStudent, name };
    }
  }
});
export const { setStudents, addStudent, setCurrentStudent, setStudentData, removeStudent, updateStudent } = studentSlice.actions;
export default studentSlice.reducer;