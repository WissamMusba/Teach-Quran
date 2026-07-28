import { createSlice } from '@reduxjs/toolkit';
export const studentSlice = createSlice({
  name: 'student', 
  initialState: { list: [] as any[], currentStudent: null as any, studentData: null as any },
  reducers: {
    setStudents: (state, action) => { state.list = action.payload; },
    addStudent: (state, action) => { state.list.push(action.payload); },
    setCurrentStudent: (state, action) => { state.currentStudent = action.payload; state.studentData = null; },
    setStudentData: (state, action) => { state.studentData = action.payload; },
    removeStudent: (state, action) => { 
      state.list = state.list.filter((s: any) => s.id !== action.payload); 
      if (state.currentStudent?.id === action.payload) {
        state.currentStudent = null;
        state.studentData = null;
      }
    },
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