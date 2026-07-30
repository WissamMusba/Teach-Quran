import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { addAction, undo as undoHistory, redo as redoHistory } from '../../store/historySlice';

export interface DrawingCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

interface Props {
  visible: boolean;
  initialPaths?: any[];
  onSave: (paths: any[]) => void;
  onStateChange: (canUndo: boolean, canRedo: boolean) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(({ visible, initialPaths = [], onSave, onStateChange, onGestureStart, onGestureEnd }, ref) => {
  const dispatch = useDispatch();
  const { activeTool, activeColor, penSize } = useSelector((state: any) => state.drawing);
  const [paths, setPaths] = useState<any[]>(initialPaths);
  const [redoStack, setRedoStack] = useState<any[]>([]);
  const [currentPath, setCurrentPath] = useState<any>(null);

  const pathsRef = useRef<any[]>(paths);
  const stateRef = useRef({ activeTool, activeColor, penSize });
  const currentPathRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);
  const clearedSnapshotRef = useRef<any[] | null>(null);
  const afterUndoClearRef = useRef(false);

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onGestureStartRef = useRef(onGestureStart);
  onGestureStartRef.current = onGestureStart;
  const onGestureEndRef = useRef(onGestureEnd);
  onGestureEndRef.current = onGestureEnd;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const debouncedSave = useCallback((pathsToSave: any[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { onSaveRef.current(pathsToSave); }, 1500);
  }, []);

  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { stateRef.current = { activeTool, activeColor, penSize }; }, [activeTool, activeColor, penSize]);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  useEffect(() => {
    onStateChangeRef.current(paths.length > 0 || clearedSnapshotRef.current !== null, false);
  }, []);

  const handleUndo = () => {
    if (clearedSnapshotRef.current !== null && !afterUndoClearRef.current) {
      setPaths(clearedSnapshotRef.current);
      pathsRef.current = clearedSnapshotRef.current;
      afterUndoClearRef.current = true;
      setRedoStack([]);
      onStateChangeRef.current(true, true);
      dispatch(addAction({ type: 'draw', action: 'undo-clear', timestamp: Date.now() }));
      debouncedSave(clearedSnapshotRef.current);
      return;
    }
    if (pathsRef.current.length === 0) return;
    const lastPath = pathsRef.current[pathsRef.current.length - 1];
    const newPaths = pathsRef.current.slice(0, -1);
    setPaths(newPaths);
    pathsRef.current = newPaths;
    setRedoStack(prev => [...prev, lastPath]);
    dispatch(undoHistory());
    onStateChangeRef.current(newPaths.length > 0 || clearedSnapshotRef.current !== null, true);
    debouncedSave(newPaths);
  };

  const handleRedo = () => {
    if (afterUndoClearRef.current && clearedSnapshotRef.current !== null) {
      afterUndoClearRef.current = false;
      setPaths([]);
      pathsRef.current = [];
      onStateChangeRef.current(true, false);
      dispatch(redoHistory());
      debouncedSave([]);
      return;
    }
    if (redoStack.length === 0) return;
    const pathToRedo = redoStack[redoStack.length - 1];
    const newPaths = [...pathsRef.current, pathToRedo];
    setPaths(newPaths);
    pathsRef.current = newPaths;
    setRedoStack(prev => prev.slice(0, -1));
    dispatch(redoHistory());
    onStateChangeRef.current(true, redoStack.length - 1 > 0);
    debouncedSave(newPaths);
  };

  const handleClear = () => {
    if (pathsRef.current.length === 0) return;
    clearedSnapshotRef.current = pathsRef.current;
    afterUndoClearRef.current = false;
    setPaths([]);
    pathsRef.current = [];
    setRedoStack([]);
    onStateChangeRef.current(true, false);
    dispatch(addAction({ type: 'draw', action: 'clear', timestamp: Date.now() }));
    debouncedSave([]);
  };

  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  const handleRedoRef = useRef(handleRedo);
  handleRedoRef.current = handleRedo;
  const handleClearRef = useRef(handleClear);
  handleClearRef.current = handleClear;

  useImperativeHandle(ref, () => ({
    undo: () => handleUndoRef.current(),
    redo: () => handleRedoRef.current(),
    clear: () => handleClearRef.current(),
  }), []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      onGestureStartRef.current?.();
      const s = stateRef.current;
      if (s.activeTool === 'laser') {
        const newPath = {
          points: [`${e.nativeEvent.locationX},${e.nativeEvent.locationY}`],
          color: s.activeColor,
          width: s.penSize,
          opacity: 0.6,
          tool: 'laser',
        };
        setCurrentPath(newPath);
        currentPathRef.current = newPath;
        return;
      }
      const isEraser = s.activeTool === 'eraser';
      const newPath = {
        points: [`${e.nativeEvent.locationX},${e.nativeEvent.locationY}`],
        color: isEraser ? '#121212' : s.activeColor,
        width: isEraser ? s.penSize * 3 : s.penSize,
        opacity: 1,
        tool: s.activeTool,
      };
      setCurrentPath(newPath);
      currentPathRef.current = newPath;
    },
    onPanResponderMove: (e) => {
      if (stateRef.current.activeTool === 'eraser' || stateRef.current.activeTool === 'laser') return;
      if (currentPathRef.current) {
        const newPoint = `${e.nativeEvent.locationX},${e.nativeEvent.locationY}`;
        if (stateRef.current.activeTool === 'underline') {
          const updatedPath = { ...currentPathRef.current, points: [currentPathRef.current.points[0], newPoint] };
          currentPathRef.current = updatedPath;
          setCurrentPath(updatedPath);
        } else {
          const updatedPath = { ...currentPathRef.current, points: [...currentPathRef.current.points, newPoint] };
          currentPathRef.current = updatedPath;
          setCurrentPath(updatedPath);
        }
      }
    },
    onPanResponderRelease: (e) => {
      const s = stateRef.current;
      if (s.activeTool === 'laser') {
        setCurrentPath(null);
        currentPathRef.current = null;
        onGestureEndRef.current?.();
        return;
      }
      if (s.activeTool === 'eraser') {
        const { locationX, locationY } = e.nativeEvent;
        const newPaths = pathsRef.current.filter((p: any) =>
          !p.points.some((pt: string) => {
            const [x, y] = pt.split(',').map(Number);
            return Math.abs(x - locationX) < 30 && Math.abs(y - locationY) < 30;
          })
        );
        if (newPaths.length !== pathsRef.current.length) {
          setPaths(newPaths);
          pathsRef.current = newPaths;
          debouncedSave(newPaths);
        }
      } else {
        const pathToSave = currentPathRef.current;
        if (pathToSave && pathToSave.points.length > 1) {
          const newPaths = [...pathsRef.current, pathToSave];
          setPaths(newPaths);
          pathsRef.current = newPaths;
          setRedoStack([]);
          clearedSnapshotRef.current = null;
          afterUndoClearRef.current = false;
          dispatch(addAction({ type: 'draw', action: 'add', data: pathToSave, timestamp: Date.now() }));
          onStateChangeRef.current(true, false);
          debouncedSave(newPaths);
        }
      }
      onGestureEndRef.current?.();
      setCurrentPath(null);
      currentPathRef.current = null;
    },
  })).current;

  const generatePathD = (points: string[], style?: string) => {
    if (!points || points.length === 0) return '';
    if (style === 'wavy') {
      let d = `M ${points[0]}`;
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        const prevP = points[i - 1];
        const off = i % 2 === 0 ? 5 : -5;
        d += ` Q ${prevP.split(',')[0]},${parseInt(prevP.split(',')[1]) + off} ${p}`;
      }
      return d;
    }
    return `M ${points[0]}` + points.slice(1).map(p => ` L ${p}`).join('');
  };

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((p, i) => (
            <React.Fragment key={i}>
              <Path d={generatePathD(p.points, p.style)} stroke={p.color} strokeWidth={p.width} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" />
              {p.style === 'double' && (
                <Path d={generatePathD(p.points)} stroke={p.color} strokeWidth={p.width / 2} strokeOpacity={p.opacity} fill="none" strokeLinecap="round" transform="translate(0, 3)" />
              )}
            </React.Fragment>
          ))}
          {currentPath && currentPath.tool === 'laser' ? (
            (() => { const [cx, cy] = currentPath.points[0].split(',').map(Number); return <Circle cx={cx} cy={cy} r={14} fill="#FF0000" opacity={0.85} />; })()
          ) : (
            currentPath && <Path d={generatePathD(currentPath.points, currentPath.style)} stroke={currentPath.color} strokeWidth={currentPath.width} strokeOpacity={currentPath.opacity} fill="none" strokeLinecap="round" />
          )}
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    elevation: 100,
    zIndex: 100,
  },
});

export default DrawingCanvas;
