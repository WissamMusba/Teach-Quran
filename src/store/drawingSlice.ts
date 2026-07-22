import { createSlice } from '@reduxjs/toolkit';
export const drawingSlice = createSlice({
  name: 'drawing', initialState: { isDrawingMode: false, activeTool: 'pen' as 'pen' | 'eraser' | 'underline' | 'highlighter' | 'text', activeColor: '#FF0000', penSize: 4 },
  reducers: {
    toggleDrawingMode: (state) => { state.isDrawingMode = !state.isDrawingMode; },
    setTool: (state, action) => { state.activeTool = action.payload; },
    setColor: (state, action) => { state.activeColor = action.payload; },
    setPenSize: (state, action) => { state.penSize = action.payload; }
  }
});
export const { toggleDrawingMode, setTool, setColor, setPenSize } = drawingSlice.actions;
export default drawingSlice.reducer;