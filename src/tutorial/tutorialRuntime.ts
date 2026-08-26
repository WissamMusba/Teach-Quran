/**
 * FILE: src/tutorial/tutorialRuntime.ts
 * ROLE: Tutorial plumbing — the redux slice (active/stepIndex), the event bus screens emit
 *       into, the anchor registry (measured spotlight targets), and the screen bridge
 *       (QuranView registers draw-mode enter/exit + practice-edit cleanup here).
 * DEPENDS ON: @reduxjs/toolkit.
 * USED BY: store/index.ts (reducer), TutorialController.tsx (drives everything),
 *          TutorialOverlay.tsx (TutorialAnchor), screens (emitTutorialEvent one-liners).
 * NOTES: Screens call emitTutorialEvent() UNCONDITIONALLY — it is a no-op unless the
 *       controller is subscribed (i.e., tutorial active). No store import here, so there is
 *       no circular dependency with store/index.ts.
 */
import { createSlice } from '@reduxjs/toolkit';

// ---------------- slice ----------------
export interface TutorialState { active: boolean; stepIndex: number; }
const initialState: TutorialState = { active: false, stepIndex: 0 };

export const tutorialSlice = createSlice({
  name: 'tutorial',
  initialState,
  reducers: {
    startTutorial: (state) => { state.active = true; state.stepIndex = 0; },
    setTutorialStep: (state, action) => { state.stepIndex = action.payload; },
    endTutorial: (state) => { state.active = false; state.stepIndex = 0; },
  },
});
export const { startTutorial, setTutorialStep, endTutorial } = tutorialSlice.actions;
export default tutorialSlice.reducer;

// ---------------- event bus ----------------
let eventHandler: ((e: string, payload?: any) => void) | null = null;
export const onTutorialEvent = (fn: (e: string, payload?: any) => void): (() => void) => {
  eventHandler = fn;
  return () => { if (eventHandler === fn) eventHandler = null; };
};
export const emitTutorialEvent = (e: string, payload?: any) => { try { eventHandler?.(e, payload); } catch {} };

// ---------------- anchor registry ----------------
export interface TutorialAnchorRect { x: number; y: number; w: number; h: number; }
const anchors = new Map<string, TutorialAnchorRect>();
let anchorListener: (() => void) | null = null;
export const setTutorialAnchor = (id: string, rect: TutorialAnchorRect) => {
  anchors.set(id, rect);
  try { anchorListener?.(); } catch {}
};
export const getTutorialAnchor = (id?: string): TutorialAnchorRect | null =>
  (id ? anchors.get(id) : null) || null;
export const onTutorialAnchorsChanged = (fn: () => void): (() => void) => {
  anchorListener = fn;
  return () => { if (anchorListener === fn) anchorListener = null; };
};

// ---------------- screen bridge (QuranView capabilities) ----------------
export interface TutorialBridge {
  enterDraw?: () => void;
  exitDraw?: () => void;
  cleanup?: () => void;
}
let bridge: TutorialBridge = {};
export const registerTutorialBridge = (b: TutorialBridge) => { bridge = { ...bridge, ...b }; };
export const getTutorialBridge = (): TutorialBridge => bridge;
