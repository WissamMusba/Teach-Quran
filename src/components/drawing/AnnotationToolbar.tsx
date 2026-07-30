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
const ACCENT = '#00D4AA', ICONC = '#CFCFCF', DIS = '#5A5A5A';
const PALETTE = ['#FFFFFF', '#FF3B30', '#FFD60A', '#0A84FF', '#000000', '#8B5A2B', '#30D158', '#FF9F0A'];
const PEN_SIZES = [2, 4, 6, 8];
const PAL_H = 120;

const ST = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Pencil = ({ c }: { c: string }) => (<Svg width={18} height={18} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M14 4l3 3-9 9-3 1 1-3 8-8z" /></Svg>);
const Chevron = ({ c }: { c: string }) => (<Svg width={18} height={18} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M6 9l6 6 6-6" /></Svg>);
const LaserI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M4 20l9-9" /><Path d="M16 4l1.6 1.6L16 7.2 14.4 5.6z" /><Path d="M16 1.5v2M19.5 5h-2" /></Svg>);
const UnderI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M7 4v6a5 5 0 0 0 10 0V4" /><Path d="M5 20h14" /></Svg>);
const EraserI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M20 20H7L3 16a1.5 1.5 0 0 1 0-2.12l10-10a1.5 1.5 0 0 1 2.12 0l5 5a1.5 1.5 0 0 1 0 2.12L14 16.5" /><Path d="M10 6l8 8" /></Svg>);
const UndoI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M9 7L4 12l5 5" /><Path d="M4 12h11a5 5 0 0 1 0 10h-3" /></Svg>);
const RedoI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M15 7l5 5-5 5" /><Path d="M20 12H9a5 5 0 0 0 0 10h3" /></Svg>);
const TrashI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v6M14 11v6" /></Svg>);
const CloseI = ({ c }: { c: string }) => (<Svg width={14} height={14} viewBox="0 0 24 24" {...ST} stroke={c}><Path d="M18 6L6 18M6 6l12 12" /></Svg>);

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
  const BOT = Math.max(Platform.OS === 'android' ? 16 : 34, 16);
  const open = useSelector((s: any) => s.drawing.toolbarExpanded);
  const { activeTool, activeColor, penSize } = useSelector((s: any) => s.drawing);

  const [pal, setPal] = useState(false);
  const [[x, y], setPos] = useState([MARGIN, height - BOT - 100]);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const clampX = (v: number) => Math.max(MARGIN, Math.min(v, width - ROUND - MARGIN - (open ? GAP + BAR_W : 0)));
  const clampY = (v: number) => Math.max(sbHeight, Math.min(v, height - ROUND - BOT));

  const onTouchStart = useCallback((e: any) => {
    dragStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, px: x, py: y };
  }, [x, y]);

  const onTouchMove = useCallback((e: any) => {
    const dx = e.nativeEvent.pageX - dragStart.current.x;
    const dy = e.nativeEvent.pageY - dragStart.current.y;
    setPos([clampX(dragStart.current.px + dx), clampY(dragStart.current.py + dy)]);
  }, [width, height, open]);

  const onTouchEnd = useCallback((e: any) => {
    const dx = Math.abs(e.nativeEvent.pageX - dragStart.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - dragStart.current.y);
    if (dx < 8 && dy < 8) {
      const wasClosed = !open;
      dispatch(setToolbarExpanded(!open));
      if (wasClosed) onActivateDraw?.();
    }
  }, [open, onActivateDraw]);

  if (!visible) return null;

  const placeAbove = y > height - 220;

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
    <View style={[s.wrap, { left: x, top: y }]}>
      <View style={s.grip}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}>
        {open ? <Chevron c={ICONC} /> : <Pencil c={ICONC} />}
      </View>

      {open && (
        <View style={s.bar}>
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
                  <View style={{ height: w * 2 + 4, width: 18, borderRadius: w, backgroundColor: penSize === w ? ACCENT : '#8A8A8A' }} />
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
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  grip: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: '#151517', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  bar: { marginLeft: GAP, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18,18,20,0.96)', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 5, elevation: 6, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  col: { width: COL, alignItems: 'center', justifyContent: 'center', paddingVertical: 1 },
  lab: { fontSize: 7.5, color: '#9A9A9A', marginTop: 1, fontWeight: '600' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  pal: { position: 'absolute', left: 0, width: 180, backgroundColor: 'rgba(20,20,22,0.96)', borderRadius: 12, padding: 10, elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  wcol: { alignItems: 'center', paddingVertical: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sw: { width: 36, height: 30, borderRadius: 8, borderWidth: 2, marginBottom: 6 },
});

export default AnnotationToolbar;
