import React, { useRef, useState, useEffect } from 'react';
import {
  Animated, View, Text, TouchableOpacity, StyleSheet, PanResponder,
  useWindowDimensions, Alert, Platform, StatusBar,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import {
  setToolbarExpanded, setTool, setColor, setPenSize,
} from '../../store/drawingSlice';

const ROUND = 52, GAP = 8, COL = 46, MARGIN = 12;
const DOCK_PEEK = 20, DOCK_THRESHOLD = 46, TAP = 7;
const ACCENT = '#00D4AA', ICONC = '#E8E8E8', DIS = '#5A5A5A';
const PALETTE = ['#FFFFFF', '#FF3B30', '#FFD60A', '#0A84FF', '#000000', '#8B5A2B', '#30D158', '#FF9F0A'];
const PEN_SIZES = [2, 4, 6, 8];
const PAL_H = 140;
const ST = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Pencil = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>);
const Chevron = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M6 9l6 6 6-6" /></Svg>);
const Laser = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M4 20l9-9" /><Path d="M16 4l1.6 1.6L16 7.2 14.4 5.6z" /><Path d="M16 1.5v2M19.5 5h-2" /></Svg>);
const Under = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M7 4v6a5 5 0 0 0 10 0V4" /><Path d="M5 20h14" /></Svg>);
const Eraser = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M20 20H7L3 16a1.5 1.5 0 0 1 0-2.12l10-10a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12L14 16.5" /><Path d="M10 6l8 8" /></Svg>);
const UndoI = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M9 7L4 12l5 5" /><Path d="M4 12h11a5 5 0 0 1 0 10h-3" /></Svg>);
const RedoI = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M15 7l5 5-5 5" /><Path d="M20 12H9a5 5 0 0 0 0 10h3" /></Svg>);
const Trash = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" /></Svg>);
const CloseI = ({ c }: { c: string }) => (<Svg width={20} height={20} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M18 6L6 18M6 6l12 12" /></Svg>);
const Zig = ({ w, active }: { w: number; active: boolean }) => (
  <Svg width={34} height={14} viewBox="0 0 34 14"><Path d="M2 10L8 4l6 6 6-6 6 6 4-4" fill="none" stroke={active ? ACCENT : '#8A8A8A'} strokeWidth={Math.max(1, w * 0.55)} strokeLinecap="round" strokeLinejoin="round" /></Svg>
);

interface Props {
  visible: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onActivateDraw?: () => void;
}

const AnnotationToolbar: React.FC<Props> = ({ visible, onUndo, onRedo, onClear, onExit, canUndo, canRedo, onActivateDraw }) => {
  const dispatch = useDispatch();
  const { width, height } = useWindowDimensions();
  const sbHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
  const TOP = sbHeight, BOT = Math.max(Platform.OS === 'android' ? 16 : 34, 16);
  const open = useSelector((s: any) => s.drawing.toolbarExpanded);
  const { activeTool, activeColor, penSize } = useSelector((s: any) => s.drawing);

  const [pal, setPal] = useState(false);
  const [docked, setDocked] = useState(false);
  const [cwidth, setCWidth] = useState(ROUND);

  const pan = useRef(new Animated.ValueXY()).current;
  const press = useRef(new Animated.Value(1)).current;
  const pos = useRef({ x: 0, y: 0 });
  const preDock = useRef({ x: 0, y: 0 });
  const init = useRef(false);

  const openR = useRef(open), dockedR = useRef(docked), cwR = useRef(cwidth);
  const wR = useRef(width), hR = useRef(height);
  const topR = useRef(TOP), botR = useRef(BOT);
  useEffect(() => { openR.current = open; }, [open]);
  useEffect(() => { dockedR.current = docked; }, [docked]);
  useEffect(() => { cwR.current = cwidth; }, [cwidth]);
  useEffect(() => { wR.current = width; hR.current = height; }, [width, height]);

  const clampX = (x: number, w: number) => Math.max(MARGIN, Math.min(x, wR.current - w - MARGIN));
  const clampY = (y: number) => Math.max(topR.current, Math.min(y, hR.current - ROUND - botR.current));
  const clampP = (p: { x: number; y: number }, w: number) => ({ x: clampX(p.x, w), y: clampY(p.y) });

  const animateTo = (t: { x: number; y: number }, dock: boolean) => {
    const cur = { x: pos.current.x, y: pos.current.y };
    pan.setOffset(t);
    pan.setValue({ x: cur.x - t.x, y: cur.y - t.y });
    Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: 170, useNativeDriver: true }).start();
    pos.current = t;
    setDocked(dock);
  };

  useEffect(() => {
    if (init.current) return;
    const p = { x: width - ROUND - MARGIN, y: height - BOT - 100 };
    pos.current = p; preDock.current = p;
    pan.setOffset(p); pan.setValue({ x: 0, y: 0 });
    init.current = true;
  }, [width, height]);

  useEffect(() => {
    if (!init.current) return;
    if (dockedR.current) setDocked(false);
    const c = clampP(pos.current, cwR.current);
    pos.current = c; preDock.current = c;
    pan.setOffset(c); pan.setValue({ x: 0, y: 0 });
  }, [cwidth, width, height]);

  useEffect(() => { if (!open) setPal(false); }, [open]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      pan.setOffset(pos.current); pan.setValue({ x: 0, y: 0 });
      Animated.spring(press, { toValue: 0.9, useNativeDriver: true, friction: 8 }).start();
    },
    onPanResponderMove: (_, g) => {
      pan.x.setValue(g.dx);
      pan.y.setValue(g.dy);
    },
    onPanResponderRelease: (_: any, g: any) => {
      Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      const abs = { x: pos.current.x + g.dx, y: pos.current.y + g.dy };
      pos.current = abs;
      if (Math.hypot(g.dx, g.dy) < TAP) {
        if (dockedR.current) {
          const t = clampP(preDock.current, ROUND);
          pos.current = { x: pos.current.x, y: pos.current.y }; animateTo(t, false);
        } else {
          dispatch(setToolbarExpanded(!openR.current));
          pan.setOffset(pos.current); pan.setValue({ x: 0, y: 0 });
        }
        return;
      }
      if (!openR.current) {
        const cx = abs.x + ROUND / 2, cy = abs.y + ROUND / 2;
        const W = wR.current, H = hR.current, tp = topR.current, bt = botR.current;
        const dL = cx, dR = W - cx, dT = cy - tp, dB = (H - bt) - cy;
        const m = Math.min(dL, dR, dT, dB);
        if (m < DOCK_THRESHOLD) {
          let t;
          if (m === dL) t = { x: -(ROUND - DOCK_PEEK), y: clampY(abs.y) };
          else if (m === dR) t = { x: W - DOCK_PEEK, y: clampY(abs.y) };
          else if (m === dT) t = { x: clampX(abs.x, ROUND), y: -(ROUND - DOCK_PEEK) };
          else t = { x: clampX(abs.x, ROUND), y: H - bt - DOCK_PEEK };
          preDock.current = clampP(abs, ROUND);
          animateTo(t, true);
          return;
        }
      }
      const t = clampP(abs, cwR.current);
      animateTo(t, false);
    },
    onPanResponderTerminate: () => Animated.spring(press, { toValue: 1, useNativeDriver: true }).start(),
  })).current;

  if (!visible) return null;

  const placeAbove = pos.current.y > height - 220;

  const ToolBtn = ({ k, label, Icon }: { k: any; label: string; Icon: any }) => {
    const a = activeTool === k;
    return (<TouchableOpacity style={s.col} onPress={() => { dispatch(setTool(k)); onActivateDraw?.(); }} activeOpacity={0.5}>
      <Icon c={a ? ACCENT : ICONC} /><Text style={[s.lab, a && { color: ACCENT }]}>{label}</Text>
    </TouchableOpacity>);
  };
  const ActBtn = ({ label, Icon, onPress, disabled }: any) => (
    <TouchableOpacity style={s.col} onPress={onPress} disabled={disabled} activeOpacity={0.5}>
      <Icon c={disabled ? DIS : ICONC} /><Text style={[s.lab, disabled && { color: DIS }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View onLayout={(e) => setCWidth(e.nativeEvent.layout.width)}
      style={[s.wrap, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}>

      <View {...panResponder.panHandlers} style={[s.grip, { transform: [{ scale: press }] }]}>
        {open ? <Chevron c={ICONC} /> : <Pencil c={ICONC} />}
      </View>

      {open && (
        <View style={s.bar}>
          <ToolBtn k="laser" label="LASER" Icon={Laser} />
          <ToolBtn k="pen" label="PEN" Icon={Pencil} />
          <ToolBtn k="eraser" label="ERASE" Icon={Eraser} />
          <ToolBtn k="underline" label="LINE" Icon={Under} />
          <ActBtn label="UNDO" Icon={UndoI} disabled={!canUndo} onPress={onUndo} />
          <ActBtn label="REDO" Icon={RedoI} disabled={!canRedo} onPress={onRedo} />
          <ActBtn label="CLEAR" Icon={Trash} onPress={() =>
            Alert.alert('Clear drawings', 'Delete all drawings on this page?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ])} />
          <TouchableOpacity style={s.col} onPress={() => setPal((p) => !p)} activeOpacity={0.5}>
            <View style={[s.dot, { backgroundColor: activeColor, borderColor: pal ? ACCENT : 'rgba(255,255,255,0.5)' }]} />
            <Text style={[s.lab, pal && { color: ACCENT }]}>COLOR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.col} onPress={onExit} activeOpacity={0.5}>
            <CloseI c={ICONC} /><Text style={s.lab}>EXIT</Text>
          </TouchableOpacity>

          {pal && (
            <View style={[s.pal, { top: placeAbove ? -(PAL_H + 8) : ROUND + 8 }]}>
              <View style={s.row}>{PEN_SIZES.map((w) => (
                <TouchableOpacity key={w} style={s.wcol} onPress={() => dispatch(setPenSize(w))} activeOpacity={0.6}>
                  <Zig w={w} active={penSize === w} />
                </TouchableOpacity>))}
              </View>
              <View style={s.grid}>{PALETTE.map((c) => (
                <TouchableOpacity key={c} onPress={() => dispatch(setColor(c))} activeOpacity={0.7}
                  style={[s.sw, { backgroundColor: c, borderColor: activeColor === c ? '#fff' : 'rgba(255,255,255,0.15)' }]} />
              ))}</View>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const s = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  grip: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: '#151517', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  bar: { marginLeft: GAP, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18,18,20,0.80)', borderRadius: 14, paddingHorizontal: 6, paddingVertical: 6, elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  col: { width: COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  lab: { fontSize: 9, color: '#9A9A9A', marginTop: 2, fontWeight: '600' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  pal: { position: 'absolute', left: 0, width: 196, backgroundColor: 'rgba(20,20,22,0.92)', borderRadius: 14, padding: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  wcol: { alignItems: 'center', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sw: { width: 40, height: 34, borderRadius: 9, borderWidth: 2, marginBottom: 8 },
});

export default AnnotationToolbar;
