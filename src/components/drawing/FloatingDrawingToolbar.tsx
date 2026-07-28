import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Path as SvgPath, Line as SvgLine, Circle as SvgCircle } from 'react-native-svg';
import { PenIcon, LaserIcon, UnderlineIcon, UndoIcon, TrashIcon, CollapseIcon, CirclePenIcon } from './DrawingIcons';

const COLORS = ['#FF0000','#FF8C00','#FFD700','#00CC00','#009999','#0066FF','#8B00FF','#FF1493','#000000'];
const WIDTHS = [2, 4, 6, 8];
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const TB_W = 200;
const TB_H = 128;

const ToolBtn = ({ icon, label, active, onPress }: any) => (
  <TouchableOpacity style={styles.toolBtn} onPress={onPress} activeOpacity={0.6}>
    {icon}
    <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
  </TouchableOpacity>
);

const CtrlBtn = ({ children, label, onPress }: any) => (
  <TouchableOpacity style={styles.ctrlBtn} onPress={onPress} activeOpacity={0.6}>
    {children}
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

export default function FloatingDrawingToolbar({ onClose, onSave, initialPaths }: any) {
  const [mode, setMode] = useState<'expanded'|'collapsed'>('expanded');
  const [tool, setTool] = useState<'pen'|'laser'|'underline'>('pen');
  const [paths, setPaths] = useState<any[]>(initialPaths || []);
  const [currentPath, setCurrentPath] = useState<any>(null);
  const [color, setColor] = useState('#FF0000');
  const [width, setWidth] = useState(4);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [laserPos, setLaserPos] = useState<{x:number,y:number}|null>(null);
  const [tbXY, setTbXY] = useState({ x: Math.max(8, (SCREEN_W - TB_W) / 2), y: Math.max(40, SCREEN_H * 0.15) });
  const [showColor, setShowColor] = useState(false);
  const [showWidth, setShowWidth] = useState(false);

  const pathsRef = useRef(paths);
  const cpRef = useRef<any>(null);
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const ulStart = useRef<{x:number,y:number}|null>(null);
  const saveTmr = useRef<any>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { cpRef.current = currentPath; }, [currentPath]);

  const debouncedSave = useCallback((p: any[]) => {
    if (saveTmr.current) clearTimeout(saveTmr.current);
    saveTmr.current = setTimeout(() => onSave(p), 1500);
  }, [onSave]);

  const genD = (pts: string[]) => {
    if (!pts || !pts.length) return '';
    return 'M ' + pts[0] + pts.slice(1).map(p => ' L ' + p).join('');
  };

  const drawPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const t = toolRef.current;
      if (t === 'laser') { setLaserPos({ x, y }); return; }
      if (t === 'underline') {
        ulStart.current = { x, y };
        const np = { points: [`${x},${y}`], color: colorRef.current, width: widthRef.current, opacity: 1, tool: 'underline' };
        cpRef.current = np; setCurrentPath(np);
        return;
      }
      const np = { points: [`${x},${y}`], color: colorRef.current, width: widthRef.current, opacity: 1, tool: 'pen' };
      cpRef.current = np; setCurrentPath(np);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const t = toolRef.current;
      if (t === 'laser') { setLaserPos({ x, y }); return; }
      if (t === 'underline' && ulStart.current) {
        const np = { ...cpRef.current, points: [`${ulStart.current.x},${ulStart.current.y}`, `${x},${ulStart.current.y}`] };
        cpRef.current = np; setCurrentPath(np);
        return;
      }
      if (cpRef.current) {
        const np = { ...cpRef.current, points: [...cpRef.current.points, `${x},${y}`] };
        cpRef.current = np; setCurrentPath(np);
      }
    },
    onPanResponderRelease: () => {
      const t = toolRef.current;
      if (t === 'laser') { setLaserPos(null); return; }
      ulStart.current = null;
      const ps = cpRef.current;
      if (ps && ps.points.length >= (t === 'underline' ? 2 : 1)) {
        const n = [...pathsRef.current, ps];
        setPaths(n); pathsRef.current = n; setRedoStack([]);
        debouncedSave(n);
      }
      cpRef.current = null; setCurrentPath(null);
    },
  })).current;

  const tbPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
    onPanResponderGrant: () => { dragStart.current = { x: tbXY.x, y: tbXY.y }; },
    onPanResponderMove: (_, gs) => {
      setTbXY({
        x: Math.max(0, Math.min(SCREEN_W - TB_W, dragStart.current.x + gs.dx)),
        y: Math.max(0, dragStart.current.y + gs.dy),
      });
    },
  })).current;

  const handleUndo = () => {
    const p = pathsRef.current;
    if (!p.length) return;
    const n = p.slice(0, -1);
    setPaths(n); pathsRef.current = n;
    setRedoStack(prev => [...prev, p[p.length-1]]);
    debouncedSave(n);
  };

  const handleClear = () => { setPaths([]); pathsRef.current = []; setRedoStack([]); debouncedSave([]); };
  const handleCollapse = () => { setMode('collapsed'); setLaserPos(null); setShowColor(false); setShowWidth(false); };

  if (mode === 'collapsed') {
    return (
      <TouchableOpacity style={[styles.collapsedBtn, { left: tbXY.x, top: tbXY.y }]} onPress={() => setMode('expanded')} activeOpacity={0.7}>
        <CirclePenIcon size={44} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={StyleSheet.absoluteFill} {...drawPan.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p: any, i: number) =>
            p.tool === 'underline' && p.points.length >= 2 ? (
              <SvgLine key={i} x1={parseFloat(p.points[0].split(',')[0])} y1={parseFloat(p.points[0].split(',')[1])} x2={parseFloat(p.points[p.points.length-1].split(',')[0])} y2={parseFloat(p.points[0].split(',')[1])} stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} strokeLinecap="round" />
            ) : (
              <SvgPath key={i} d={genD(p.points)} stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" />
            )
          )}
          {currentPath && currentPath.tool === 'underline' && currentPath.points.length >= 2 && (
            <SvgLine x1={parseFloat(currentPath.points[0].split(',')[0])} y1={parseFloat(currentPath.points[0].split(',')[1])} x2={parseFloat(currentPath.points[currentPath.points.length-1].split(',')[0])} y2={parseFloat(currentPath.points[0].split(',')[1])} stroke={currentPath.color} strokeWidth={currentPath.width} strokeOpacity={currentPath.opacity} strokeLinecap="round" />
          )}
          {currentPath && currentPath.tool === 'pen' && (
            <SvgPath d={genD(currentPath.points)} stroke={currentPath.color} strokeWidth={currentPath.width} strokeOpacity={currentPath.opacity} fill="none" strokeLinecap="round" />
          )}
        </Svg>
        {laserPos && (
          <View pointerEvents="none" style={[styles.laserDot, { left: laserPos.x - 14, top: laserPos.y - 14 }]}>
            <Svg width="28" height="28" viewBox="0 0 28 28">
              <SvgCircle cx="14" cy="14" r="10" stroke="rgba(255,50,50,0.2)" strokeWidth="2" fill="rgba(255,50,50,0.06)" />
              <SvgCircle cx="14" cy="14" r="4" fill="rgba(255,50,50,0.5)" />
            </Svg>
          </View>
        )}
      </View>

      <View style={[styles.toolbar, { left: tbXY.x, top: tbXY.y }, showColor && { zIndex: 20 }, showWidth && { zIndex: 20 }]}>
        <View style={styles.dragArea} {...tbPan.panHandlers}>
          <View style={styles.dash} />
        </View>

        <View style={styles.row}>
          <ToolBtn icon={<PenIcon size={20} color={tool==='pen'?'#4A9EFF':'#fff'} />} label="Pen" active={tool==='pen'} onPress={() => setTool('pen')} />
          <ToolBtn icon={<LaserIcon size={20} color={tool==='laser'?'#4A9EFF':'#fff'} />} label="Laser" active={tool==='laser'} onPress={() => setTool('laser')} />
          <ToolBtn icon={<UnderlineIcon size={20} color={tool==='underline'?'#4A9EFF':'#fff'} />} label="Underline" active={tool==='underline'} onPress={() => setTool('underline')} />
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.cBtn} onPress={() => { setShowColor(!showColor); setShowWidth(false); }} activeOpacity={0.6}>
            <View style={[styles.colorDot, { backgroundColor: color }]} />
            <Text style={styles.label}>Color</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cBtn} onPress={() => { setShowWidth(!showWidth); setShowColor(false); }} activeOpacity={0.6}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
              {[2,4,6,8].map(w => <View key={w} style={{ width: w===2?3:w===4?5:w===6?7:9, height: Math.min(w,6), backgroundColor:'#fff', borderRadius: Math.min(w,6)/2 }} />)}
            </View>
            <Text style={styles.label}>Width</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cBtn} onPress={handleUndo} activeOpacity={0.6}>
            <UndoIcon size={18} color="#fff" /><Text style={styles.label}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cBtn} onPress={handleClear} activeOpacity={0.6}>
            <TrashIcon size={18} color="#fff" /><Text style={styles.label}>Clear</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.collapseBtn} onPress={handleCollapse} activeOpacity={0.6}>
          <CollapseIcon size={14} color="#888" />
        </TouchableOpacity>
      </View>

      {showColor && (
        <View style={[styles.popup, { left: tbXY.x + 8, bottom: SCREEN_H - tbXY.y + 4 }]}>
          <View style={styles.arrow} />
          <View style={styles.grid}>
            {COLORS.map((c, i) => (
              <TouchableOpacity key={i} style={[styles.swatch, { backgroundColor: c }, color===c && styles.swatchActive]} onPress={() => { setColor(c); setShowColor(false); }} />
            ))}
          </View>
        </View>
      )}

      {showWidth && (
        <View style={[styles.popup, { left: tbXY.x + 8, bottom: SCREEN_H - tbXY.y + 4 }]}>
          <View style={styles.arrow} />
          {WIDTHS.map((w, i) => (
            <TouchableOpacity key={i} style={[styles.wOpt, width===w && styles.wOptActive]} onPress={() => { setWidth(w); setShowWidth(false); }}>
              <View style={{ width: 36, height: Math.min(w+2,10), backgroundColor: width===w?'#4A9EFF':'#fff', borderRadius: Math.min(w+2,10)/2 }} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.1)', elevation: 10, zIndex: 100 },
  toolbar: { position:'absolute', width: TB_W, backgroundColor:'rgba(30,30,35,0.92)', borderRadius: 16, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 4, alignItems:'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  dragArea: { width: '100%', height: 16, justifyContent:'center', alignItems:'center', marginBottom: 2 },
  dash: { width: 28, height: 3, backgroundColor:'rgba(255,255,255,0.25)', borderRadius: 2 },
  row: { flexDirection:'row', justifyContent:'space-around', width:'100%', marginBottom: 4 },
  toolBtn: { alignItems:'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, minWidth: 52 },
  cBtn: { alignItems:'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8, minWidth: 44 },
  label: { color:'rgba(255,255,255,0.7)', fontSize: 9, marginTop: 2, textAlign:'center', fontWeight:'500' },
  labelActive: { color:'#4A9EFF', fontWeight:'700' },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor:'rgba(255,255,255,0.3)' },
  collapseBtn: { padding: 2, marginTop: 0 },
  collapsedBtn: { position:'absolute', zIndex: 100 },
  laserDot: { position:'absolute', pointerEvents:'none', zIndex: 99 },
  popup: { position:'absolute', backgroundColor:'rgba(30,30,35,0.95)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor:'rgba(255,255,255,0.1)', zIndex: 200 },
  arrow: { position:'absolute', bottom: -6, left: 20, width: 10, height: 10, backgroundColor:'rgba(30,30,35,0.95)', transform: [{rotate:'45deg'}], borderRightWidth:1, borderBottomWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  grid: { flexDirection:'row', flexWrap:'wrap', width: 102, gap: 4 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  swatchActive: { borderWidth: 2, borderColor:'#fff' },
  wOpt: { paddingVertical: 6, paddingHorizontal: 12, alignItems:'center', borderRadius: 6 },
  wOptActive: { backgroundColor:'rgba(74,158,255,0.15)' },
});