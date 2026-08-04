/**
 * FILE: src/store/historySlice.ts
 * ROLE: Linear undo/redo journal for drawing strokes.
 * DEPENDS ON: none (Redux Toolkit createSlice only).
 * USED BY: src/components/drawing/DrawingCanvas.tsx (addAction, undo as undoHistory, redo as
 *          redoHistory). NO component ever useSelector's state.history — SEE NOTES.
 * NOTES (anatomy): ENTIRE SLICE IS DEAD STATE — written 3x per stroke, never read. Canvas undo/redo
 *          actually run on LOCAL `paths`/`redoStack` useState in DrawingCanvas; toolbar enabled-state
 *          comes from onStateChange -> local state (QuranViewScreen). Recommend deleting in rebuild.
 */
import { createSlice } from '@reduxjs/toolkit';
export const historySlice = createSlice({
  name: 'history', initialState: { actions: [] as any[], /* journal entries { type:'draw', action:'add'|'clear'|'undo-clear', data?, timestamp } */ currentIndex: -1 /* redo cursor (index of last applied action) */ },
  reducers: {
    /**
     * WHAT: Truncates redo tail, appends entry, advances currentIndex.
     * CALLED BY: DrawingCanvas.tsx (all): handleUndo() after undoing a clear ('undo-clear'),
     *            handleClear() ('clear'), onPanResponderRelease after committing a stroke
     *            ('add', data = path).
     * AFFECTS: Nothing visual — no reader of state.history. Undo/redo run on LOCAL paths/redoStack
     *          useState (DEAD slice, see header note).
     */
    addAction: (state, action) => { state.actions = state.actions.slice(0, state.currentIndex + 1); state.actions.push(action.payload); state.currentIndex = state.actions.length - 1; },
    /**
     * WHAT: currentIndex-- (if >= 0).
     * CALLED BY: DrawingCanvas.tsx (handleUndo, after local path pop).
     * AFFECTS: none in UI — historySlice is write-only (vestigial).
     */
    undo: (state) => { if (state.currentIndex >= 0) state.currentIndex--; },
    /**
     * WHAT: currentIndex++ (if < actions.length - 1).
     * CALLED BY: DrawingCanvas.tsx (undo-clear redo branch, handleRedo).
     * AFFECTS: none in UI — see addAction note.
     */
    redo: (state) => { if (state.currentIndex < state.actions.length - 1) state.currentIndex++; }
  }
});
export const { addAction, undo, redo } = historySlice.actions;
export default historySlice.reducer;