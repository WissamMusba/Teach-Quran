import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { undo, redo, addAction } from '../../store/historySlice';
import { setColor, setTool, setPenSize } from '../../store/drawingSlice';
import { DRAWING_COLORS } from '../../utils/constants';

export default function DrawingCanvas({ onClose, onSave, initialPaths }: any) {
  const dispatch = useDispatch();
  const [paths, setPaths] = useState<any[]>(initialPaths || []);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState<any>(null);
  const [showToolbar, setShowToolbar] = useState(true);

  const { activeTool, activeColor, penSize } = useSelector((state: any) => state.drawing);
  const [localOpacity, setLocalOpacity] = useState(1);
  const [underlineStyle, setUnderlineStyle] = useState<'straight' | 'wavy' | 'double'>('straight');

  const pathsRef = useRef<any[]>(paths);
  const stateRef = useRef({ activeTool, activeColor, penSize, localOpacity, underlineStyle });
  const currentPathRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);

  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { 
    stateRef.current = { activeTool, activeColor, penSize, localOpacity, underlineStyle };
    currentPathRef.current = currentPath;
  }, [activeTool, activeColor, penSize, localOpacity, underlineStyle, currentPath]);

  const debouncedSave = useCallback((pathsToSave: any[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { onSave(pathsToSave); }, 1500);
  }, [onSave]);

  const handleTouch = (x: number, y: number) => {
    const s = stateRef.current;
    const isEraser = s.activeTool === 'eraser';
    const newPath = {
      points: [`${x},${y}`],
      color: isEraser ? '#121212' : s.activeColor,
      width: isEraser ? s.penSize * 3 : s.penSize,
      opacity: isEraser ? 1 : s.localOpacity,
      tool: s.activeTool,
      style: s.underlineStyle
    };
    setCurrentPath(newPath);
    currentPathRef.current = newPath;
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 1,
    onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 1,
    onPanResponderGrant: (e) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove: (e) => {
      if (stateRef.current.activeTool === 'eraser') return;
      if (currentPathRef.current) {
        const newPoint = `${e.nativeEvent.locationX},${e.nativeEvent.locationY}`;
        const updatedPath = { ...currentPathRef.current, points: [...currentPathRef.current.points, newPoint] };
        currentPathRef.current = updatedPath;
        setCurrentPath(updatedPath);
      }
    },
    onPanResponderRelease: (e) => {
      if (stateRef.current.activeTool === 'eraser') {
        const { locationX, locationY } = e.nativeEvent;
        const newPaths = pathsRef.current.filter((p:any) => !p.points.some((pt:string) => { const [x,y] = pt.split(',').map(Number); return Math.abs(x-locationX)<30 && Math.abs(y-locationY)<30; }));
        if (newPaths.length !== pathsRef.current.length) { setPaths(newPaths); pathsRef.current = newPaths; debouncedSave(newPaths); }
      } else {
        const pathToSave = currentPathRef.current;
        if (pathToSave && pathToSave.points.length > 1) {
          const newPaths = [...pathsRef.current, pathToSave];
          setPaths(newPaths); pathsRef.current = newPaths;
          setRedoStack([]); 
          dispatch(addAction({ type: 'draw', action: 'add', data: pathToSave, timestamp: Date.now() }));
          debouncedSave(newPaths);
        }
      }
      setCurrentPath(null);
      currentPathRef.current = null;
    }
  })).current;

  const handleUndo = () => {
    if (pathsRef.current.length === 0) return;
    const lastPath = pathsRef.current[pathsRef.current.length - 1];
    const newPaths = pathsRef.current.slice(0, -1);
    setPaths(newPaths); pathsRef.current = newPaths; 
    setRedoStack(prev => [...prev, lastPath]); dispatch(undo()); debouncedSave(newPaths);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const pathToRedo = redoStack[redoStack.length - 1];
    const newPaths = [...pathsRef.current, pathToRedo];
    setPaths(newPaths); pathsRef.current = newPaths; 
    setRedoStack(prev => prev.slice(0, -1)); dispatch(redo()); debouncedSave(newPaths);
  };

  const handleClear = () => {
    setPaths([]); pathsRef.current = []; setRedoStack([]);
    debouncedSave([]);
  };

  const generatePathD = (points: string[], style?: string) => {
    if (!points || points.length === 0) return '';
    if (style === 'wavy') {
      let d = `M ${points[0]}`;
      for (let i = 1; i < points.length; i++) {
        const p = points[i]; const prevP = points[i-1];
        const off = i % 2 === 0 ? 5 : -5; 
        d += ` Q ${prevP.split(',')[0]},${parseInt(prevP.split(',')[1]) + off} ${p}`;
      }
      return d;
    }
    return `M ${points[0]}` + points.slice(1).map(p => ` L ${p}`).join('');
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.canvasContainer} {...panResponder.panHandlers}>
        <Svg style={styles.svg}>
          {paths.map((p, i) => (
            <React.Fragment key={i}>
              <Path d={generatePathD(p.points, p.style)} stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" />
              {p.style === 'double' && <Path d={generatePathD(p.points)} stroke={p.color} strokeWidth={p.width / 2} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" transform="translate(0, 3)" />}
            </React.Fragment>
          ))}
          {currentPath && <Path d={generatePathD(currentPath.points, currentPath.style)} stroke={currentPath.color} strokeWidth={currentPath.width} strokeOpacity={currentPath.opacity} fill="none" strokeLinecap="round" />}
        </Svg>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setShowToolbar(!showToolbar)}>
          <Text style={styles.btnText}>{showToolbar ? '▼' : '▲'}</Text>
        </TouchableOpacity>
      </View>
      
      {showToolbar && (
        <View style={styles.toolbar}>
          <View style={styles.row}>
            {DRAWING_COLORS.map(c => <TouchableOpacity key={c.id} style={[styles.colorBtn, { backgroundColor: c.hex, borderWidth: activeColor === c.hex ? 3 : 1, borderColor: '#fff' }]} onPress={() => dispatch(setColor(c.hex))} />)}
            <TouchableOpacity onPress={handleUndo}><Text style={styles.btnText}>↩️</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleRedo}><Text style={styles.btnText}>↪️</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleClear}><Text style={styles.btnText}>🗑️</Text></TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={styles.btnText}>✅</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            {['pen', 'eraser', 'underline'].map(t => <TouchableOpacity key={t} style={[styles.toolBtn, activeTool === t && styles.activeTool]} onPress={() => dispatch(setTool(t))}><Text style={styles.btnText}>{t}</Text></TouchableOpacity>)}
            <TouchableOpacity onPress={() => dispatch(setPenSize(Math.max(2, penSize - 2)))}><Text style={styles.btnText}>➖</Text></TouchableOpacity>
            <Text style={styles.btnText}>{penSize}px</Text>
            <TouchableOpacity onPress={() => dispatch(setPenSize(Math.min(20, penSize + 2)))}><Text style={styles.btnText}>➕</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  canvasContainer: { flex: 1 },
  svg: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
  toolbar: { backgroundColor: '#1e1e1e', padding: 10, borderTopWidth: 1, borderColor: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 10 },
  colorBtn: { width: 30, height: 30, borderRadius: 15 },
  toolBtn: { padding: 8, backgroundColor: '#333', borderRadius: 8 },
  activeTool: { backgroundColor: '#0066FF' },
  btnText: { color: '#fff', fontSize: 14 },
  toggleBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 5 }
});
