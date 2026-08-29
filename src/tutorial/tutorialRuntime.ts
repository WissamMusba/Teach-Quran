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
import { Dimensions } from 'react-native';

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
  // Guard against garbage measurements: the page FlatList keeps up to 3 pages mounted, so
  // OFFSCREEN neighbor pages re-measure the same anchor ids with rects outside the window
  // (or detached views report NaN). Accepting those makes the spotlight clamp to the
  // top-left corner. Only partially-offscreen rects pass — the overlay clamps those.
  const { x, y, w, h } = rect;
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
  const win = Dimensions.get('window');
  if (x + w <= 0 || y + h <= 0 || x >= win.width || y >= win.height) return;
  anchors.set(id, rect);
  try { anchorListener?.(); } catch {}
};
export const getTutorialAnchor = (id?: string): TutorialAnchorRect | null =>
  (id ? anchors.get(id) : null) || null;
export const onTutorialAnchorsChanged = (fn: () => void): (() => void) => {
  anchorListener = fn;
  return () => { if (anchorListener === fn) anchorListener = null; };
};

// ---------------- active re-measure ----------------
// While the tutorial runs, every anchor re-measures on a shared 400ms tick. onLayout does
// NOT re-fire when the page FlatList translates a page into view, so without this a
// swiped-in page's anchor keeps its stale (rejected or outdated) rect. Offscreen results
// are dropped by the setTutorialAnchor guard above, so the visible page always wins.
let measuring = false;
let tickIv: any = null;
const tickers = new Set<() => void>();
export const setTutorialMeasuringActive = (on: boolean) => {
  measuring = on;
  if (on && !tickIv) tickIv = setInterval(() => { tickers.forEach((f) => { try { f(); } catch {} }); }, 400);
  if (!on && tickIv) { clearInterval(tickIv); tickIv = null; }
};
export const onTutorialMeasureTick = (fn: () => void): (() => void) => {
  tickers.add(fn);
  return () => { tickers.delete(fn); };
};

// ---------------- tutorial text context (dynamic tokens like {resumePage}) ----------------
const contextMap = new Map<string, string>();
let contextListener: (() => void) | null = null;
export const setTutorialContext = (key: string, value: string) => {
  if (contextMap.get(key) === value) return;
  contextMap.set(key, value);
  try { contextListener?.(); } catch {}
};
export const getTutorialContext = (key: string): string | null => contextMap.get(key) ?? null;
export const onTutorialContextChanged = (fn: () => void): (() => void) => {
  contextListener = fn;
  return () => { if (contextListener === fn) contextListener = null; };
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
