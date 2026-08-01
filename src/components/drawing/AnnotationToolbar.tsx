import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  useWindowDimensions, Alert, Platform, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import {
  setToolbarExpanded, setTool, setColor, setPenSize,
} from '../../store/drawingSlice';

const ROUND = 44, GAP = 5, COL = 32, MARGIN = 10;
const BAR_W = 9 * COL + 12;
const DOCK_PEEK = 20, DOCK_THRESHOLD = 50;
const DRAG_SLOP = 8;
const ACCENT = '#00D4AA';
const PALETTE = ['#FFFFFF', '#FF3B30', '#FFD60A', '#0A84FF', '#000000', '#8B5A2B', '#30D158', '#FF9F0A'];
const PEN_SIZES = [2, 4, 6, 8];
const PAL_H = 112;
const PAL_W = 150;

const ST = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Pencil = ({ c }: { c: string }) => (<Svg width={18} height={18} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>);
const HandleIcon = ({ c }: { c: string }) => (<Svg width={18} height={18} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M4.5 6.5h15v9.2a2.8 2.8 0 0 1-2.8 2.8H7.3a2.8 2.8 0 0 1-2.8-2.8V6.5z" /><Path d="M9 11l3 3 3-3" /></Svg>);
const ChevR = ({ c }: { c: string }) => (<Svg width={16} height={16} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M9 6l6 6-6 6" /></Svg>);
const ChevL = ({ c }: { c: string }) => (<Svg width={16} height={16} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M15 6l-6 6 6 6" /></Svg>);
const ChevD = ({ c }: { c: string }) => (<Svg width={16} height={16} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M6 9l6 6 6-6" /></Svg>);
const ChevU = ({ c }: { c: string }) => (<Svg width={16} height={16} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M6 15l6-6 6 6" /></Svg>);
const LaserI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M4 20l9-9" /><Path d="M16 4l1.6 1.6L16 7.2 14.4 5.6z" /><Path d="M16 1.5v2M19.5 5h-2" /></Svg>);
const UnderI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M7 4v6a5 5 0 0 0 10 0V4" /><Path d="M5 20h14" /></Svg>);
const EraserI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M20 20H7L3 16a1.5 1.5 0 0 1 0-2.12l10-10a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12L14 16.5" /><Path d="M10 6l8 8" /></Svg>);
const UndoI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M9 7L4 12l5 5" /><Path d="M4 12h11a5 5 0 0 1 0 10h-3" /></Svg>);
const RedoI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M15 7l5 5-5 5" /><Path d="M20 12H9a5 5 0 0 0 0 10h3" /></Svg>);
const TrashI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" /></Svg>);
const CloseI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M18 6L6 18M6 6l12 12" /></Svg>);
const ZigZag = ({ w, active }: { w: number; active: boolean }) => (
  <Svg width={34} height={16} viewBox="0 0 34 16">
    <Path d="M2 12 C8 2, 12 14, 17 8 C22 2, 26 14, 32 8" fill="none" stroke={active ? ACCENT : '#8A8A8A'} strokeWidth={Math.max(1.5, w * 0.8)} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

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
}

const AnnotationToolbar: React.FC<Props> = ({ visible, drawingGestureActive, onUndo, onRedo, onClear, onExit, canUndo, canRedo, onActivateDraw }) => {
  const dispatch = useDispatch();
  const { width, height } = useWindowDimensions();
  const sbHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
  const BOT = Math.max(Platform.OS === 'android' ? 16 : 34, 16);
  const open = useSelector((s: any) => s.drawing.toolbarExpanded);
  const { activeTool, activeColor, penSize } = useSelector((s: any) => s.drawing);

  const [pal, setPal] = useState(false);
  const [selectedTool, setSelectedTool] = useState('');
  const [docked, setDocked] = useState<string | null>(null);
  const [[x, y], setPos] = useState([MARGIN, height - BOT - 100]);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const posRef = useRef({ x: MARGIN, y: height - BOT - 100 });
  const preDockRef = useRef({ x: MARGIN, y: height - BOT - 100 });

  const expandedWidth = BAR_W + GAP + ROUND;
  const clampXDrag = (v: number) => Math.max(-(expandedWidth - DOCK_PEEK), Math.min(v, width - DOCK_PEEK));
  const clapXOnOpen = (v: number) => Math.max(MARGIN, Math.min(v, width - expandedWidth - MARGIN));
  const clampXDock = (v: number) => Math.max(-(ROUND - DOCK_PEEK), Math.min(v, width - DOCK_PEEK));
  const clampY = (v: number) => Math.max(sbHeight - (ROUND - DOCK_PEEK), Math.min(v, height - BOT - DOCK_PEEK));

  const onTouchStart = useCallback((e: any) => {
    dragStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, px: x, py: y };
  }, [x, y]);

  const onMoveShouldSetResponder = useCallback((e: any) => {
    const s = dragStart.current;
    if (!s) return false;
    const dx = Math.abs(e.nativeEvent.pageX - s.x);
    const dy = Math.abs(e.nativeEvent.pageY - s.y);
    return dx >= DRAG_SLOP || dy >= DRAG_SLOP;
  }, []);

  const onTouchMove = useCallback((e: any) => {
    const dx = e.nativeEvent.pageX - dragStart.current.x;
    const dy = e.nativeEvent.pageY - dragStart.current.y;
    const newPx = dragStart.current.px + dx;
    const nx = open ? clampXDrag(newPx) : clampXDock(newPx);
    const ny = clampY(dragStart.current.py + dy);
    setPos([nx, ny]);
    posRef.current = { x: nx, y: ny };
  }, [width, height, open]);

  const reclampOnExpand = useCallback((px: number, py: number) => {
    return { x: clapXOnOpen(px), y: clampY(py) };
  }, [width, height, sbHeight, BOT]);

  const onTouchEnd = useCallback((e: any) => {
    const dx = Math.abs(e.nativeEvent.pageX - dragStart.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - dragStart.current.y);

    if (dx < 8 && dy < 8) {
      if (docked) {
        const p = preDockRef.current;
        const clamped = reclampOnExpand(p.x, p.y);
        setPos([clamped.x, clamped.y]);
        posRef.current = clamped;
        setDocked(null);
        dispatch(setToolbarExpanded(true));
      } else if (open) {
        setPal(false);
        dispatch(setToolbarExpanded(false));
        onExit();
      } else {
        const clamped = reclampOnExpand(posRef.current.x, posRef.current.y);
        setPos([clamped.x, clamped.y]);
        posRef.current = clamped;
        dispatch(setToolbarExpanded(true));
      }
      return;
    }

    const cx = posRef.current.x + ROUND / 2;
    const cy = posRef.current.y + ROUND / 2;
    const dl = cx;
    const dr = width - cx;
    const dt = cy - sbHeight;
    const db = (height - BOT) - cy;
    const min = Math.min(dl, dr, dt, db);

    if (!open && min < DOCK_THRESHOLD) {
      preDockRef.current = { x: posRef.current.x, y: posRef.current.y };
      let nx = posRef.current.x, ny = posRef.current.y, edge: string | null = null;
      if (min === dl) { nx = -(ROUND - DOCK_PEEK); edge = 'left'; }
      else if (min === dr) { nx = width - DOCK_PEEK; edge = 'right'; }
      else if (min === dt) { ny = sbHeight - (ROUND - DOCK_PEEK); edge = 'top'; }
      else { ny = height - BOT - DOCK_PEEK; edge = 'bottom'; }
      setPos([nx, ny]);
      posRef.current = { x: nx, y: ny };
      setDocked(edge);
    } else {
      setDocked(null);
    }
  }, [open, docked, width, height, sbHeight, BOT, reclampOnExpand]);

  const nightMode = useSelector((s: any) => s.settings?.nightMode);

  if (!visible) return null;

  const placeAbove = y > height - 220;
  const barBg = nightMode ? 'rgba(200,200,215,0.60)' : 'rgba(18,18,20,0.85)';
  const iconC = nightMode ? '#2A2A2A' : '#CFCFCF';
  const disC = nightMode ? '#6A6A6A' : '#5A5A5A';
  const labC = nightMode ? '#4A4A4A' : '#9A9A9A';
  const palBg = 'rgba(20,20,22,0.96)';
  const colorWrapX = x + ROUND + GAP + 5 + 7 * COL;
  const palLeft = Math.max(MARGIN, Math.min(colorWrapX - (PAL_W - COL) / 2, width - PAL_W - MARGIN)) - colorWrapX;

  const ToolBtn = ({ k, label, Icon }: { k: any; label: string; Icon: any }) => {
    const sel = selectedTool === k;
    return (<TouchableOpacity style={s.col} onPress={() => { setPal(false); setSelectedTool(k); dispatch(setTool(k)); onActivateDraw?.(); }} activeOpacity={0.5}>
      <Icon c={sel ? ACCENT : iconC} /><Text style={[s.lab, { color: labC }, sel && { color: ACCENT }]}>{label}</Text>
    </TouchableOpacity>);
  };
  const ActBtn = ({ label, Icon, onPress, disabled }: any) => (
    <TouchableOpacity style={s.col} onPress={onPress} disabled={disabled} activeOpacity={0.5}>
      <Icon c={disabled ? disC : iconC} /><Text style={[s.lab, { color: labC }, disabled && { color: disC }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[s.wrap, { left: x, top: y, flexDirection: 'row', elevation: drawingGestureActive ? 50 : 200, zIndex: drawingGestureActive ? 50 : 200 }]}>
      <View style={[s.grip, { backgroundColor: barBg }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}>
        {open ? <HandleIcon c={iconC} /> : docked === 'left' ? <ChevR c={iconC} /> : docked === 'right' ? <ChevL c={iconC} /> : docked === 'top' ? <ChevD c={iconC} /> : docked === 'bottom' ? <ChevU c={iconC} /> : <Pencil c={iconC} />}
      </View>

      {open && (
        <View style={[s.bar, { backgroundColor: barBg, marginLeft: GAP }]}
          onStartShouldSetResponder={(e: any) => { dragStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, px: x, py: y }; return false; }}
          onMoveShouldSetResponder={onMoveShouldSetResponder}
          onResponderGrant={onTouchStart}
          onResponderMove={onTouchMove}
          onResponderRelease={onTouchEnd}>
          <ToolBtn k="laser" label="LASER" Icon={LaserI} />
          <ToolBtn k="pen" label="PEN" Icon={Pencil} />
          <ToolBtn k="eraser" label="ERASE" Icon={EraserI} />
          <ToolBtn k="underline" label="LINE" Icon={UnderI} />
          <ActBtn label="UNDO" Icon={UndoI} disabled={!canUndo} onPress={onUndo} />
          <ActBtn label="REDO" Icon={RedoI} disabled={!canRedo} onPress={onRedo} />
          <ActBtn label="CLEAR" Icon={TrashI} onPress={() =>
            Alert.alert('Clear drawings', 'Delete all drawings on this page?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ])} />
          <View style={s.colorWrap}>
            <TouchableOpacity style={s.col} onPress={() => setPal((p) => !p)} activeOpacity={0.5}>
              <View style={[s.dot, { backgroundColor: activeColor, borderColor: pal ? ACCENT : iconC }]} />
              <Text style={[s.lab, { color: labC }, pal && { color: ACCENT }]}>COLOR</Text>
            </TouchableOpacity>
            {pal && (
              <View style={[s.pal, { backgroundColor: palBg, top: placeAbove ? -(PAL_H + 18) : COL + 4, left: palLeft }]}>
                {placeAbove ? null : <View style={[s.arr, { borderBottomColor: palBg }]} />}
                <View style={s.row}>{PEN_SIZES.map((w, i) => (
                  <TouchableOpacity key={w} style={s.wcol} onPress={() => dispatch(setPenSize(w))} activeOpacity={0.6}>
                    <ZigZag w={w} active={penSize === w} />
                    <Text style={[s.zw, { color: labC }, penSize === w && { color: ACCENT }]}>{['S','M','L','XL'][i]}</Text>
                  </TouchableOpacity>))}
                </View>
                <View style={s.grid}>{PALETTE.map((c) => (
                  <TouchableOpacity key={c} onPress={() => dispatch(setColor(c))} activeOpacity={0.7}
                    style={[s.sw, { backgroundColor: c, borderColor: activeColor === c ? '#fff' : 'rgba(255,255,255,0.15)' }]} />
                ))}</View>
              {placeAbove && <View style={[s.arr, { borderTopColor: palBg }]} />}
              </View>
            )}
          </View>
          <TouchableOpacity style={s.col} onPress={() => { dispatch(setToolbarExpanded(false)); onExit(); }} activeOpacity={0.5}>
            <CloseI c={iconC} /><Text style={[s.lab, { color: labC }]}>EXIT</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', elevation: 200, zIndex: 200 },
  grip: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, borderWidth: 0, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  bar: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 5, borderWidth: 0, elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  col: { width: COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 1 },
  lab: { fontSize: 7.5, marginTop: 1, fontWeight: '600' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  colorWrap: { position: 'relative' },
  pal: { position: 'absolute', left: -(PAL_W - COL) / 2, width: PAL_W, borderRadius: 12, padding: 8, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  arr: { alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  wcol: { alignItems: 'center', paddingVertical: 3 },
  zw: { fontSize: 9, marginTop: 1, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sw: { width: 32, height: 26, borderRadius: 7, borderWidth: 2, marginBottom: 6 },
});

export default AnnotationToolbar;
