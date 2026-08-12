/**
 * FILE: src/store/drawingSlice.ts
 * ROLE: Annotation toolbar UI state (open/closed, tool, color, pen size).
 * DEPENDS ON: none (Redux Toolkit createSlice only).
 * USED BY: src/components/drawing/AnnotationToolbar.tsx, src/components/drawing/DrawingCanvas.tsx,
 *          src/screens/DashboardScreen.tsx, src/screens/QuranViewScreen.tsx.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Tool = 'pen' | 'eraser' | 'underline' | 'laser';

interface DrawingState {
  toolbarExpanded: boolean;
  activeTool: Tool;
  activeColor: string;
  penSize: number;
}

const initialState: DrawingState = {
  toolbarExpanded: false, // docked/collapsed vs full bar (grip-only when false)
  activeTool: 'pen',      // 'pen'|'eraser'|'underline'|'laser'
  activeColor: '#FF0000', // stroke color (eraser overrides with '#F8F9FA')
  penSize: 4,             // stroke width (eraser uses penSize*3)
};

export const drawingSlice = createSlice({
  name: 'drawing',
  initialState,
  reducers: {
    /**
     * WHAT: Opens/closes the annotation bar (sets toolbarExpanded to the payload).
     * CALLED BY: AnnotationToolbar.tsx:191/:195/:201/:322 (grip tap expand, collapse, EXIT button);
     *            DashboardScreen.tsx:66 (force-close when opening a student);
     *            QuranViewScreen.tsx:445/:988 (force-close on surah/page change and exit).
     * AFFECTS: AnnotationToolbar.tsx renders full bar vs grip-only (`open`); DrawingCanvas reads toolbar state.
     */
    setToolbarExpanded: (state, action: PayloadAction<boolean>) => {
      state.toolbarExpanded = action.payload;
    },
    /**
     * WHAT: Inverts toolbarExpanded.
     * CALLED BY: NOBODY — exported but zero dispatchers in src/. DEAD ACTION (anatomy note: cut in
     *            rebuild; QuranViewScreen uses setToolbarExpanded(false) instead).
     * AFFECTS: nothing — the bar is opened/closed via setToolbarExpanded only.
     */
    toggleToolbarExpanded: (state) => {
      state.toolbarExpanded = !state.toolbarExpanded;
    },
    /**
     * WHAT: Sets the active drawing tool ('pen'|'eraser'|'underline'|'laser').
     * CALLED BY: AnnotationToolbar.tsx:252 (tool button, also onActivateDraw()).
     * AFFECTS: DrawingCanvas.tsx gesture behavior (laser/eraser/underline branches) + stroke generation.
     */
    setTool: (state, action: PayloadAction<Tool>) => {
      state.activeTool = action.payload;
    },
    /**
     * WHAT: Sets the stroke color.
     * CALLED BY: AnnotationToolbar.tsx:315 (palette swatch).
     * AFFECTS: DrawingCanvas stroke color; toolbar swatch indicator.
     */
    setColor: (state, action: PayloadAction<string>) => {
      state.activeColor = action.payload;
    },
    /**
     * WHAT: Sets the stroke width.
     * CALLED BY: AnnotationToolbar.tsx:309 (S/M/L/XL size row).
     * AFFECTS: DrawingCanvas strokeWidth; toolbar ZigZag size indicator.
     */
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