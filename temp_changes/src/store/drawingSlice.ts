import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Tool = 'pen' | 'eraser' | 'underline' | 'laser';

interface DrawingState {
  toolbarExpanded: boolean;
  activeTool: Tool;
  activeColor: string;
  penSize: number;
}

const initialState: DrawingState = {
  toolbarExpanded: false,
  activeTool: 'pen',
  activeColor: '#FF0000',
  penSize: 4,
};

export const drawingSlice = createSlice({
  name: 'drawing',
  initialState,
  reducers: {
    setToolbarExpanded: (state, action: PayloadAction<boolean>) => {
      state.toolbarExpanded = action.payload;
    },
    toggleToolbarExpanded: (state) => {
      state.toolbarExpanded = !state.toolbarExpanded;
    },
    setTool: (state, action: PayloadAction<Tool>) => {
      state.activeTool = action.payload;
    },
    setColor: (state, action: PayloadAction<string>) => {
      state.activeColor = action.payload;
    },
    setPenSize: (state, action: PayloadAction<number>) => {
      state.penSize = action.payload;
    },
  },
});

export const {
  setToolbarExpanded,
  toggleToolbarExpanded,
  setTool,
  setColor,
  setPenSize,
} = drawingSlice.actions;
export default drawingSlice.reducer;