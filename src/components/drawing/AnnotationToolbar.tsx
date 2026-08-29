/**
 * FILE: src/components/drawing/AnnotationToolbar.tsx
 * ROLE: Floating, draggable, dockable draw-tool UI (LASER/PEN/ERASE/LINE + UNDO/REDO/CLEAR + color palette + pen-size + EXIT) — talks to DrawingCanvas exclusively through parent-supplied callbacks and the drawingSlice.
 * DEPENDS ON: Redux drawingSlice (toolbarExpanded/activeTool/activeColor/penSize); settings.nightMode (theming); react-native-svg for the inline icon set.
 * USED BY: src/screens/QuranViewScreen.tsx:626-628 inside <ToolbarBoundary> (an error boundary that renders null if the toolbar throws — toolbar bugs must not crash the reader).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import TutorialAnchor from '../../tutorial/TutorialAnchor';
import { emitTutorialEvent } from '../../tutorial/tutorialRuntime';

import {
  View, Text, TouchableOpacity, StyleSheet,
  useWindowDimensions, Alert, Platform, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import {
  setToolbarExpanded, setTool, setColor, setPenSize,
} from '../../store/drawingSlice';

// Layout/dock constants — DOCK_PEEK/DOCK_THRESHOLD control half-off-screen docking; ACCENT is the active-tool highlight; PALETTE + PEN_SIZES drive the color palette.
const DOCK_PEEK = 20, DOCK_THRESHOLD = 50;
const SAFETY = 12;
const ACCENT = '#1C3D72';
const ACCENT_NIGHT = '#7BA7DB';
const PALETTE = ['#FFFFFF', '#FF3B30', '#FFD60A', '#0A84FF', '#000000', '#8B5A2B', '#30D158', '#FF9F0A'];
const PEN_SIZES = [2, 4, 6, 8];

const ST = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

// Inline SVG icon set (stroke-based, recolored via the `c` prop) — one per button; ZigZag doubles as the pen-size preview glyph in the palette.
const Pencil = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>);
const HandleIcon = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M4.5 6.5h15v9.2a2.8 2.8 0 0 1-2.8 2.8H7.3a2.8 2.8 0 0 1-2.8-2.8V6.5z" /><Path d="M9 11l3 3 3-3" /></Svg>);
const ChevR = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M9 4.5L16.5 12 9 19.5" /></Svg>);
const ChevL = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>);
const ChevD = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M4.5 9L12 16.5 19.5 9" /></Svg>);
const ChevU = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M4.5 15L12 7.5 19.5 15" /></Svg>);
const LaserI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M4 20l9-9" /><Path d="M16 4l1.6 1.6L16 7.2 14.4 5.6z" /><Path d="M16 1.5v2M19.5 5h-2" /></Svg>);
const UnderI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M7 4v6a5 5 0 0 0 10 0V4" /><Path d="M5 20h14" /></Svg>);
const EraserI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M20 20H7L3 16a1.5 1.5 0 0 1 0-2.12l10-10a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12L14 16.5" /><Path d="M10 6l8 8" /></Svg>);
const UndoI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M9 7L4 12l5 5" /><Path d="M4 12h11a5 5 0 0 1 0 10h-3" /></Svg>);
const RedoI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M15 7l5 5-5 5" /><Path d="M20 12H9a5 5 0 0 0 0 10h3" /></Svg>);
const TrashI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" /></Svg>);
const CloseI = ({ c, sz, sw }: { c: string; sz: number; sw: number }) => (<Svg width={sz} height={sz} viewBox="0 0 24 24" {...ST} stroke={c} strokeWidth={sw}><Path d="M18 6L6 18M6 6l12 12" /></Svg>);
const ZigZag = ({ w, active, zw, zh, accent = ACCENT }: { w: number; active: boolean; zw: number; zh: number; accent?: string }) => (
  <Svg width={zw} height={zh} viewBox="0 0 34 16">
    <Path d="M2 12 C8 2, 12 14, 17 8 C22 2, 26 14, 32 8" fill="none" stroke={active ? ACCENT : '#8A8A8A'} strokeWidth={Math.max(1.5, w * 0.8)} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/**
 * Props — visible gates mounting; drawingGestureActive is passed by the parent but NO LONGER changes elevation (the wrap is a constant zIndex 200, so a stroke can never be trapped under the toolbar); canUndo/canRedo are fed by canvas onStateChange; onActivateDraw lets the parent enter drawing mode on the first tool tap.
 */
interface Props {
  visible: boolean;
  drawingGestureActive: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onActivateDraw?: () => void;
  tutorialActive?: boolean;
}

/**
 * AnnotationToolbar — draggable/dockable toolbar.
 * FLOW: responder negotiation is deepest-first — touches on buttons or the grip are claimed by that child, so the wrap only becomes responder for frame touches. Grip tap toggles open/docked; EXIT collapses + onExit() (parent exits drawing mode). Drag clamps the toolbar on-screen.
 * CALLS: dispatch(setTool/setColor/setPenSize/setToolbarExpanded); onActivateDraw; onUndo/onRedo/onClear -> canvasRef.current?.undo()/redo()/clear() (QuranViewScreen); onExit -> parent drawing mode.
 * AFFECTS: drawingSlice (tool/color/size/expanded), parent's isDrawing/isHeaderVisible, the canvas via the imperative handle.
 * NOTES: position (x/y) is NOT persisted across restarts; `open` is global Redux state, so surah/page changes collapse the toolbar externally (also triggering the selection-reset effect).
 */
const AnnotationToolbar: React.FC<Props> = ({ visible, drawingGestureActive, onUndo, onRedo, onClear, onExit, canUndo, canRedo, onActivateDraw, tutorialActive }) => {
  const dispatch = useDispatch();
  const { width, height } = useWindowDimensions();
  const sbHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
  const BOT = Math.max(Platform.OS === 'android' ? 16 : 34, 16);

  // Layout geometry — all sizes derive from window width (TAB/ROUND/GAP/COL...); BAR_W = 9*TAB + 2*pad; initial Y sits below the top edge; position is not persisted across mounts.
  // COMPACT (v65): TAB/ROUND/icon/label/palette all shrunk ~20-25% so the bar is shorter and the
  // hit areas smaller (more frame surface to grab for dragging). Drag/dock math below derives
  // from these values, so the responder chain, clamps and docking are byte-for-byte unchanged.
  const TAB = Math.min(44, Math.max(22, Math.floor((width - SAFETY) / 13)));
  const ROUND = Math.max(34, Math.round(TAB * 1.25));
  const GAP = Math.max(4, Math.round(TAB * 0.15));
  const COL = TAB;
  const MARGIN = 6;
  const pad = GAP;
  const barPadV = Math.min(pad, 4);
  const colPadV = 4;
  const palPad = Math.max(6, Math.round(TAB * 0.2));
  const swGap = Math.max(2, Math.round(TAB * 0.06));
  const swS = Math.max(24, Math.min(32, Math.round(TAB * 0.95)));
  const PAL_W = Math.min(Math.round(4 * swS + 3 * swGap + 2 * palPad), width - 2 * MARGIN);
  const PAL_H = Math.max(Math.round(TAB * 3.5), 108);
  const BAR_W = 9 * TAB + 2 * pad;
  const SZ1 = 18;
  const SZ2 = 16;
  const SZ3 = 18;
  const LAB_SZ = Math.min(8, Math.max(7, Math.round(TAB * 0.24)));
  const ZIG_W = Math.min(34, Math.round(swS * 1.0));
  const ZIG_H = Math.min(18, Math.round(swS * 0.5));
  const swt = Math.max(1.7, Math.round(TAB * 0.055 * 10) / 10);
  const COL_H = SZ2 + 3 + LAB_SZ + 2 * colPadV;
  const BAR_H = Math.max(ROUND, COL_H + 2 * barPadV);
  const V_EXTRA = Math.max(0, Math.ceil((BAR_H - ROUND) / 2));
  const expandedWidth = BAR_W + GAP + ROUND;
  const initY = height - BOT - V_EXTRA - Math.max(150, ROUND + 120);

  const open = useSelector((s: any) => s.drawing.toolbarExpanded);
  const { activeTool, activeColor, penSize } = useSelector((s: any) => s.drawing);
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const accent = nightMode ? ACCENT_NIGHT : ACCENT;

  // Local state — pal = color palette open; selectedTool drives the ACCENT highlight on the active tool button; docked = 'left'|'right'|'top'|'bottom'|null.
  const [pal, setPal] = useState(false);
  const [selectedTool, setSelectedTool] = useState('');
  const [docked, setDocked] = useState<string | null>(null);

  // Selection reset — every time the toolbar collapses (EXIT, grip tap, page change) the highlight clears, so reopening looks brand new (no "pen selected" ghost even though drawingSlice.activeTool still holds 'pen').
  useEffect(() => { if (!open) setSelectedTool(''); }, [open]);
  const [[x, y], setPos] = useState([MARGIN, initY]);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const posRef = useRef({ x: MARGIN, y: initY });
  const preDockRef = useRef({ x: MARGIN, y: initY });

  // While the tutorial is active, keep the toolbar clear of the bottom-sheet card (it covers
  // ~300dp). The draw-open grip was hiding behind it on phones; open/draw steps need the
  // toolbar VISIBLE above the card. Park at the top of the screen for those steps.
  useEffect(() => {
    if (!tutorialActive) return;
    const topY = sbHeight + 8;
    if (!open) {
      // Collapsed: keep the pencil grip near the top so the "Pick the pen" step's toolbar is above the card.
      const maxY = height - 320 - ROUND;
      const ny = posRef.current.y > maxY || posRef.current.y > height / 2 ? Math.max(sbHeight, maxY) : posRef.current.y;
      // Also bring it up top if it started below center (so PEN ends up above the sheet when opened).
      if (posRef.current.y > height * 0.45) {
        const ty = topY;
        setPos([posRef.current.x, ty]);
        posRef.current = { x: posRef.current.x, y: ty };
      } else if (posRef.current.y > maxY) {
        const ty2 = Math.max(sbHeight, maxY);
        setPos([posRef.current.x, ty2]);
        posRef.current = { x: posRef.current.x, y: ty2 };
      }
      return;
    }
    // Open: nudge the whole bar to the top so the bottom sheet never covers the PEN/ERASE row.
    if (posRef.current.y > topY + 30) {
      setPos([posRef.current.x, topY]);
      posRef.current = { x: posRef.current.x, y: topY };
    }
  }, [tutorialActive, open, height, ROUND, sbHeight]);

  // Clamps — when open the toolbar can never leave the screen (clampXOpen); when collapsed, half-off-screen docking positions are allowed; clampY guards status-bar and bottom edges.
  const clampX = (v: number) => Math.max(-Math.round(ROUND / 2), Math.min(v, width - Math.round(ROUND / 2)));
  const clampXOpen = (v: number) => Math.max(-Math.round(ROUND / 2), Math.min(v, width - expandedWidth - MARGIN));
  const clampY = (v: number) => Math.max(sbHeight - (ROUND - DOCK_PEEK) - V_EXTRA, Math.min(v, height - BOT - V_EXTRA - DOCK_PEEK));

  /**
   * Drag plumbing — a FRESH anchor {finger position + current toolbar pos} is recorded at every grant, then onTouchMove applies dx/dy from it.
   * The v44 "stale finger memory" teleport bug is impossible here: there is NO onMoveShouldSetResponder anywhere in this file, so nothing can steal a gesture mid-drag.
   */
  const onTouchStart = useCallback((e: any) => {
    dragStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, px: x, py: y };
  }, [x, y]);

  const onTouchMove = useCallback((e: any) => {
    const dx = e.nativeEvent.pageX - dragStart.current.x;
    const dy = e.nativeEvent.pageY - dragStart.current.y;
    const newPx = dragStart.current.px + dx;
    const nx = clampX(newPx);
    const ny = clampY(dragStart.current.py + dy);
    setPos([nx, ny]);
    posRef.current = { x: nx, y: ny };
  }, [width, height]);

  // Reclamp into open bounds when expanding from a (possibly half-off-screen) collapsed/docked position.
  const reclampOnExpand = useCallback((px: number, py: number) => {
    return { x: clampXOpen(px), y: clampY(py) };
  }, [width, height, sbHeight, BOT]);

  /**
   * onDragEnd — when collapsed and the grip's center is within DOCK_THRESHOLD (50px) of an edge, snap half-off-screen and setDocked(edge); otherwise setDocked(null).
   * preDockRef stores the pre-snap position so undocking can restore it. (Vertical docking reuses the same half-offset math as left/right.)
   */
  const onDragEnd = useCallback((e: any) => {
    const cx = posRef.current.x + ROUND / 2;
    const cy = posRef.current.y + ROUND / 2;
    const dl = cx;
    const dr = width - cx;
    const dt = cy - sbHeight;
    const db = (height - BOT) - cy;
    const min = Math.min(dl, dr, dt, db);

    if (!open && min < DOCK_THRESHOLD) {
      preDockRef.current = { x: posRef.current.x, y: posRef.current.y };
      const half = Math.round(ROUND / 2);
      let nx = posRef.current.x, ny = posRef.current.y, edge: string | null = null;
      if (min === dl) { nx = -half; edge = 'left'; }
      else if (min === dr) { nx = width - half; edge = 'right'; }
      else if (min === dt) { ny = sbHeight - half; edge = 'top'; }
      else { ny = height - half; edge = 'bottom'; }
      setPos([nx, ny]);
      posRef.current = { x: nx, y: ny };
      setDocked(edge);
    } else {
      setDocked(null);
    }
  }, [open, width, height, sbHeight, BOT]);

  /**
   * onTouchEnd (grip release) — movement <8px counts as a TAP (the only tap that toggles):
   *   docked -> undock + collapse + onExit()   (FIRST press on a docked chevron exits drawing mode — no expand-first)
   *   open   -> collapse + onExit()            (closes the canvas too)
   *   closed -> reclamp into open bounds + expand
   * Movement >=8px is treated as a drag end.
   */
  const onTouchEnd = useCallback((e: any) => {
    const dx = Math.abs(e.nativeEvent.pageX - dragStart.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - dragStart.current.y);

    if (dx < 8 && dy < 8) {
      if (docked) {
        setDocked(null);
        setPal(false);
        dispatch(setToolbarExpanded(false));
        onExit();
      } else if (open) {
        setPal(false);
        dispatch(setToolbarExpanded(false));
        onExit();
      } else {
        const clamped = reclampOnExpand(posRef.current.x, posRef.current.y);
        setPos([clamped.x, clamped.y]);
        posRef.current = clamped;
        dispatch(setToolbarExpanded(true));
        emitTutorialEvent('draw_opened');
      }
      return;
    }
    onDragEnd(e);
  }, [docked, open, onDragEnd, reclampOnExpand, onExit, dispatch]);

  // onWrapEnd (frame release) — <8px movement does NOTHING (tapping the frame neither collapses nor exits); >=8px = drag end.
  const onWrapEnd = useCallback((e: any) => {
    const dx = Math.abs(e.nativeEvent.pageX - dragStart.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - dragStart.current.y);
    if (dx >= 8 || dy >= 8) onDragEnd(e);
  }, [onDragEnd]);

  // Not mounted when hidden — the parent passes visible={!isCapturing}, so the toolbar is absent during share capture.
  if (!visible) return null;

  // Theming + palette placement — barBg/iconC flip with nightMode; palFitsAbove flips the palette above the bar when there's no room below; palLeft keeps it clamped on-screen.
  const barBg = nightMode ? 'rgba(200,200,215,0.60)' : 'rgba(18,18,20,0.85)';
  const iconC = nightMode ? '#2A2A2A' : '#CFCFCF';
  const disC = nightMode ? '#6A6A6A' : '#5A5A5A';
  const labC = nightMode ? '#4A4A4A' : '#9A9A9A';
  const palBg = 'rgba(20,20,22,0.96)';
  const colorWrapX = x + ROUND + GAP + pad + 7 * COL;
  const palLeft = Math.max(MARGIN, Math.min(colorWrapX - (PAL_W - COL) / 2, width - PAL_W - MARGIN)) - colorWrapX;
  const palGap = 22;
  const palFitsAbove = sbHeight - y < -(PAL_H + palPad + palGap);
  const palTop = palFitsAbove ? -(PAL_H + palPad + palGap) : BAR_H + GAP + 10;

  const d = {
    grip: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, borderWidth: 0, alignItems: 'center' as const, justifyContent: 'center' as const, elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    bar: { flexDirection: 'row' as const, alignItems: 'center' as const, borderRadius: Math.round(TAB * 0.3), paddingHorizontal: pad, paddingVertical: barPadV, borderWidth: 0, elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    col: { width: COL, minHeight: 30, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: colPadV },
    lab: { fontSize: LAB_SZ, marginTop: 2, fontWeight: '600' as const },
    dot: { width: Math.min(22, Math.max(18, Math.round(TAB * 0.5))), height: Math.min(22, Math.max(18, Math.round(TAB * 0.5))), borderRadius: Math.min(11, Math.max(9, Math.round(TAB * 0.25))), borderWidth: Math.max(2, Math.round(TAB * 0.06)) },
    pal: { position: 'absolute' as const, left: -(PAL_W - COL) / 2, width: PAL_W, borderRadius: Math.round(TAB * 0.375), padding: palPad, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    arr: { alignSelf: 'center' as const, width: 0, height: 0, borderLeftWidth: Math.max(5, Math.round(TAB * 0.22)), borderRightWidth: Math.max(5, Math.round(TAB * 0.22)), borderTopWidth: Math.max(6, Math.round(TAB * 0.25)), borderBottomWidth: Math.max(6, Math.round(TAB * 0.25)), borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' },
    row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: Math.round(TAB * 0.2) },
    wcol: { alignItems: 'center' as const, paddingVertical: Math.max(3, Math.round(TAB * 0.12)) },
    zw: { fontSize: LAB_SZ, marginTop: 1, fontWeight: '700' as const },
    sw: { width: swS, height: swS, borderRadius: swS / 2, borderWidth: 2, marginBottom: Math.round(TAB * 0.19) },
  };

  /**
   * ToolBtn — LASER/PEN/ERASE/LINE. onPress: setPal(false) + setSelectedTool(k) + dispatch(setTool(k)) + onActivateDraw?.().
   * onActivateDraw fires on EVERY tool tap (no first-tap dedup), and setTool dispatches even if the tool is already active.
   * The UNDERLINE button is the only one with a two-line label ("UNDER"/"LINE"); all others are single-line.
   */
  const ToolBtn = ({ k, label, Icon }: { k: any; label: string; Icon: any }) => {
    const sel = selectedTool === k;
    const lblC = sel ? accent : labC;
    return (<TouchableOpacity style={d.col} onPress={() => { setPal(false); setSelectedTool(k); dispatch(setTool(k)); if (k === 'pen') emitTutorialEvent('pen_selected'); onActivateDraw?.(); }} activeOpacity={0.5}>
      <Icon c={sel ? accent : iconC} sz={SZ1} sw={swt} />
      {k === 'underline' ? (
        <>
          <Text numberOfLines={1} style={[d.lab, { color: lblC }]}>UNDER</Text>
          <Text numberOfLines={1} style={[d.lab, { marginTop: 0, color: lblC }]}>LINE</Text>
        </>
      ) : (
        <Text numberOfLines={1} style={[d.lab, { color: lblC }]}>{label}</Text>
      )}
    </TouchableOpacity>);
  };
  /**
   * ActBtn — UNDO/REDO/CLEAR/EXIT. UNDO/REDO are disabled via canUndo/canRedo (fed by canvas onStateChange); CLEAR confirms via Alert.alert before calling onClear.
   */
  const ActBtn = ({ label, Icon, onPress, disabled }: any) => (
    <TouchableOpacity style={d.col} onPress={onPress} disabled={disabled} activeOpacity={0.5}>
      <Icon c={disabled ? disC : iconC} sz={SZ2} sw={swt} /><Text numberOfLines={1} style={[d.lab, { color: labC }, disabled && { color: disC }]}>{label}</Text>
    </TouchableOpacity>
  );

  // WRAP - the whole toolbar. Responder negotiation is deepest-first: touches on a button or the grip are claimed by that child, so the wrap only ever receives frame touches (padding/gaps/corners). Elevation is ALWAYS 200 (constant) - above the DrawingCanvas (zIndex 100) even while drawing.
  // left/top MUST live on the TutorialAnchor wrapper, not the inner wrap: the anchor View is an
  // in-flow sibling after the flex:1 reading area, so an absolute child positioned against it
  // would measure from that zero-height edge and land off-screen (v99.0 "draw tool vanished").
  return (
    <TutorialAnchor id="draw-toolbar" style={{ position: 'absolute', left: x, top: y, zIndex: 200 }}>
    <View style={[s.wrap, { flexDirection: 'row', elevation: 200 }]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onTouchStart}
      onResponderMove={onTouchMove}
      onResponderRelease={onWrapEnd}>
      {/* GRIP — keeps its own full responder chain: drag it, or tap to toggle (see onTouchEnd); the chevron reflects the docked edge when collapsed. Wrapped in the draw-open-btn anchor so the tutorial can point at it (in-flow wrap — the anchor adds no positioning). */}
      <TutorialAnchor id="draw-open-btn">
      <View style={[d.grip, { backgroundColor: barBg }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}>
        {open ? <HandleIcon c={iconC} sz={SZ1} sw={swt} /> : docked === 'left' ? <ChevR c={iconC} sz={SZ3} sw={swt} /> : docked === 'right' ? <ChevL c={iconC} sz={SZ3} sw={swt} /> : docked === 'top' ? <ChevD c={iconC} sz={SZ3} sw={swt} /> : docked === 'bottom' ? <ChevU c={iconC} sz={SZ3} sw={swt} /> : <Pencil c={iconC} sz={SZ1} sw={swt} />}
      </View>
      </TutorialAnchor>

      {open && (
        <View style={[d.bar, { backgroundColor: barBg, marginLeft: GAP }]}>
          {/* Tool buttons — LASER/PEN/ERASE/LINE: dispatch setTool(k) + onActivateDraw?.() (parent enters drawing mode). PEN is wrapped in the pen-tool anchor so the tutorial can point at it. */}
          <ToolBtn k="laser" label="LASER" Icon={LaserI} />
          <TutorialAnchor id="pen-tool" style={{ width: COL }}><ToolBtn k="pen" label="PEN" Icon={Pencil} /></TutorialAnchor>
          <ToolBtn k="eraser" label="ERASE" Icon={EraserI} />
          <ToolBtn k="underline" label="LINE" Icon={UnderI} />
          {/* Action buttons — UNDO/REDO/CLEAR: call through the parent -> canvasRef.current?.undo()/redo()/clear() */}
          <ActBtn label="UNDO" Icon={UndoI} disabled={!canUndo} onPress={onUndo} />
          <ActBtn label="REDO" Icon={RedoI} disabled={!canRedo} onPress={onRedo} />
          <ActBtn label="CLEAR" Icon={TrashI} onPress={() =>
            Alert.alert('Clear drawings', 'Delete all drawings on this page?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ])} />
          <View style={s.colorWrap}>
            <TouchableOpacity style={d.col} onPress={() => setPal((p) => !p)} activeOpacity={0.5}>
              <View style={[d.dot, { backgroundColor: activeColor, borderColor: pal ? accent : iconC }]} />
              <Text numberOfLines={1} style={[d.lab, { color: labC }, pal && { color: accent }]}>COLOR</Text>
            </TouchableOpacity>
            {/* Color palette — S/M/L/XL pen sizes (dispatch setPenSize) + 8-color grid (dispatch setColor); flips above/below the bar and stays clamped on-screen */}
            {pal && (
              <View style={[d.pal, { backgroundColor: palBg, top: palTop, left: palLeft }]}>
                <View style={d.row}>{PEN_SIZES.map((w, i) => (
                  <TouchableOpacity key={w} style={d.wcol} onPress={() => dispatch(setPenSize(w))} activeOpacity={0.6}>
                    <ZigZag w={w} active={penSize === w} zw={ZIG_W} zh={ZIG_H} accent={accent} />
                    <Text style={[d.zw, { color: labC }, penSize === w && { color: accent }]}>{['S','M','L','XL'][i]}</Text>
                  </TouchableOpacity>))}
                </View>
                <View style={s.grid}>{PALETTE.map((c) => (
                  <TouchableOpacity key={c} onPress={() => dispatch(setColor(c))} activeOpacity={0.7}
                    style={[d.sw, { backgroundColor: c, borderColor: activeColor === c ? '#fff' : 'rgba(255,255,255,0.15)' }]} />
                ))}</View>
              <View style={[d.arr, palFitsAbove ? { borderTopColor: palBg, position: 'absolute', bottom: -Math.max(6, Math.round(TAB * 0.25)) } : { borderBottomColor: palBg, position: 'absolute', top: -Math.max(6, Math.round(TAB * 0.25)) }]} />
              </View>
            )}
          </View>
          {/* EXIT — setPal(false) + dispatch(setToolbarExpanded(false)) + onExit(): NOW closes the drawing canvas (parent onExit: if isDrawing -> exit drawing mode + restore the remembered header; else just collapse). The old "EXIT leaves the canvas live" quirk is gone. */}
          <TouchableOpacity style={d.col} onPress={() => { setPal(false); dispatch(setToolbarExpanded(false)); onExit(); }} activeOpacity={0.5}>
            <CloseI c={iconC} sz={SZ2} sw={swt} /><Text style={[d.lab, { color: labC }]}>EXIT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </TutorialAnchor>
  );
};

// Styles — wrap is the draggable frame row; its absolute left/top + zIndex live on the TutorialAnchor wrapper (see return), so the anchor sizes to the toolbar and positions it against the fullscreen container. colorWrap anchors the absolutely-positioned palette; grid lays out the 8-color swatches.
const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  colorWrap: { position: 'relative' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
});

export default AnnotationToolbar;
