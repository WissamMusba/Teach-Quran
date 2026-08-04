/**
 * FILE: src/components/drawing/DrawingCanvas.tsx
 * ROLE: The drawing engine — an absolutely-positioned, imperative-handle canvas that captures touch strokes as SVG paths, supports pen/eraser/underline/laser tools, undo/redo/clear, and reports every stroke change back via a debounced onSave(paths).
 * DEPENDS ON: Redux drawingSlice (activeTool/activeColor/penSize); Redux historySlice (addAction/undo/redo); react-native-svg (Svg/Path/Circle); PanResponder for touch capture.
 * USED BY: src/screens/QuranViewScreen.tsx:612-618 — canvasRef = useRef<DrawingCanvasHandle>(null) (:102), rendered while isDrawing && !isCapturing, fed composeSpreadPaths() as initialPaths; toolbar onUndo/onRedo/onClear call through the handle (:626-627).
 */
import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { addAction, undo as undoHistory, redo as redoHistory } from '../../store/historySlice';

/**
 * DrawingCanvasHandle — imperative handle contract exposed via forwardRef + useImperativeHandle.
 * Exposes ONLY undo()/redo()/clear(); the parent never touches canvas internals.
 * CALLED BY: QuranViewScreen.tsx:626-627 toolbar props — onUndo={() => canvasRef.current?.undo()} (same pattern for redo/clear).
 * NOTES: calls are optional-chained, so invoking the handle while the canvas is unmounted (visible=false returns null) is safe.
 */
export interface DrawingCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

/**
 * Props contract — visible gates mounting; initialPaths seeds committed strokes; onSave persists the stroke array;
 * onStateChange feeds the toolbar's canUndo/canRedo; onGestureStart/End let the parent track drawingGestureActive.
 */
interface Props {
  visible: boolean;
  initialPaths?: any[];
  onSave: (paths: any[]) => void;
  onStateChange: (canUndo: boolean, canRedo: boolean) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

/**
 * DrawingCanvas — stateful stroke canvas.
 * WHAT: paths (committed strokes) + currentPath (in-progress stroke) + redoStack; every commit is saved via a 1.5s debounced onSave.
 * FLOW: subscribes to drawingSlice (activeTool/activeColor/penSize) mirrored into stateRef; PanResponder grant/move/release capture strokes per tool (see handler comments); commits route through debouncedSave.
 * CALLS: dispatch(addAction/undoHistory/redoHistory) to sync the global historySlice; onStateChange; onGestureStart/End; debouncedSave -> onSave.
 * CALLED BY: QuranViewScreen.tsx:612 (rendered inside `isDrawing && ...` with initialPaths=composeSpreadPaths()).
 * AFFECTS: onSave -> QuranViewScreen updateData -> studentData.drawings -> SQLite (via the screen's data layer).
 * NOTES: live refs (pathsRef/stateRef/currentPathRef + the *Ref fn bridges) hold the freshest closures for event handlers and the imperative handle.
 */
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
  const pendingSaveRef = useRef<any[] | null>(null);
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

  /** debouncedSave — 1.5s trailing debounce on persistence; pendingSaveRef keeps the latest paths so the unmount flush never loses the last commit. */
  const debouncedSave = useCallback((pathsToSave: any[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingSaveRef.current = pathsToSave;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      pendingSaveRef.current = null;
      onSaveRef.current(pathsToSave);
    }, 1500);
  }, []);

  // Unmount flush — fire the pending save synchronously so nothing is lost when the canvas is hidden/unmounted.
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const pending = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (pending !== null) onSaveRef.current(pending);
    }
  }, []);

  useEffect(() => { pathsRef.current = paths; }, [paths]);
  useEffect(() => { stateRef.current = { activeTool, activeColor, penSize }; }, [activeTool, activeColor, penSize]);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  // Initial state report on mount — informs toolbar UNDO/REDO button enablement (canUndo if paths or a clear-snapshot exist).
  useEffect(() => {
    onStateChangeRef.current(paths.length > 0 || clearedSnapshotRef.current !== null, false);
  }, []);

  /**
   * handleUndo — imperative undo (backs DrawingCanvasHandle.undo).
   * FLOW: if the last committed action was a clear, restore clearedSnapshotRef (single-shot undo-clear via afterUndoClearRef); else pop the last path into redoStack, dispatch historySlice undo, save.
   * CALLED BY: useImperativeHandle bridge -> QuranViewScreen toolbar UNDO.
   * AFFECTS: paths, redoStack, historySlice, onStateChange (button enablement), debouncedSave.
   */
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

  /**
   * handleRedo — imperative redo (backs DrawingCanvasHandle.redo).
   * FLOW: if undoing a clear, re-clear (paths=[]); else pop from redoStack back onto paths, dispatch historySlice redo, save.
   * CALLED BY: useImperativeHandle bridge -> QuranViewScreen toolbar REDO.
   */
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

  /**
   * handleClear — imperative clear (backs DrawingCanvasHandle.clear).
   * FLOW: snapshot paths into clearedSnapshotRef (making clear undoable), wipe paths+redoStack, dispatch a 'clear' history action, save [].
   * CALLED BY: useImperativeHandle bridge -> QuranViewScreen toolbar CLEAR.
   */
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

  // Live refs bridge the imperative handle to the freshest closures — useImperativeHandle otherwise captures first-render functions forever.
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

  /**
   * PanResponder — stroke capture engine, one instance over the whole canvas surface.
   * FLOW: grant -> build the stroke object per active tool; move -> append points (or freeze/straighten per tool); release -> commit/filter/hit-test (details below).
   * CALLS: onGestureStart/End (parent sets drawingGestureActive); debouncedSave; dispatch(addAction) for persisted strokes.
   * NOTES: stroke object shape (the persisted format) = { points: "x,y" strings, color, width, opacity: 1, tool: 'pen'|'eraser'|'underline'|'laser', style?: 'wavy'|'double' } — style is NEVER set by the canvas itself; wavy/double exist only in generatePathD/StaticDrawingOverlay (nothing in src creates them).
   */
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // GRANT — create the stroke object. Laser makes a single-point stroke (no move capture, opacity 0.6);
    // eraser paints with hardcoded '#121212' (the dark app bg — does NOT repaint when nightMode/textStyle backgrounds differ) at penSize*3 width; pen/underline use activeColor/penSize.
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
    // MOVE — laser is frozen (return); eraser/pen append each point; underline collapses to [first, current] so it stays a straight line.
    onPanResponderMove: (e) => {
      if (stateRef.current.activeTool === 'laser') return;
      if (currentPathRef.current) {
        const newPoint = `${e.nativeEvent.locationX},${e.nativeEvent.locationY}`;
        if (stateRef.current.activeTool === 'eraser') {
          const updatedPath = { ...currentPathRef.current, points: [...currentPathRef.current.points, newPoint] };
          currentPathRef.current = updatedPath;
          setCurrentPath(updatedPath);
        } else if (stateRef.current.activeTool === 'underline') {
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
    // RELEASE — laser: discard currentPath only (never persisted, by design). Eraser: sweep captured points and drop any
    // committed path whose distanceToPath(...) < 30px; commit+save only if something was removed. Pen/underline: commit when points.length > 1 (clears redoStack + logs a history 'add').
    onPanResponderRelease: (e) => {
      const s = stateRef.current;
      if (s.activeTool === 'laser') {
        setCurrentPath(null);
        currentPathRef.current = null;
        onGestureEndRef.current?.();
        return;
      }
      if (s.activeTool === 'eraser') {
        const sweep = currentPathRef.current?.points || [];
        const newPaths = pathsRef.current.filter((p: any) => {
          for (const pt of sweep) {
            const [x, y] = pt.split(',').map(Number);
            if (distanceToPath(p.points, x, y) < 30) return false;
          }
          return true;
        });
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

  /** distToSegment — min distance from point (px,py) to segment (x1,y1)-(x2,y2); building block of the eraser hit-test. */
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  /**
   * distanceToPath — min distance from a sweep point to a committed path (point-to-point + point-to-segment).
   * CALLED BY: eraser release hit-test — any path closer than 30px to any sweep point is erased.
   */
  const distanceToPath = (points: string[], px: number, py: number) => {
    if (!points || points.length === 0) return Infinity;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i].split(',').map(Number);
      if (i === points.length - 1) {
        best = Math.min(best, Math.hypot(px - x1, py - y1));
        break;
      }
      const [x2, y2] = points[i + 1].split(',').map(Number);
      best = Math.min(best, distToSegment(px, py, x1, y1, x2, y2));
    }
    return best;
  };

  /**
   * generatePathD — converts "x,y" point strings into an SVG path `d` ("M p0 L p1 ..."; style 'wavy' emits a Q-chain instead).
   * NOTES: the wavy branch is a zigzag approximation, not a true wave — the off-by-one lookback (prevP of the current pattern) and off alternating ±5 per index make it a rough sawtooth. Copy-pasted into StaticDrawingOverlay (divergence risk).
   */
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

  // Hidden -> not mounted. The parent only renders this while isDrawing, and toolbar handle calls are optional-chained, so null here is safe.
  if (!visible) return null;

  // RENDER — committed paths as Paths (round caps; style 'double' adds a half-width duplicate translated +3px);
  // laser shows as a red Circle at its single point; eraser strokes are NOT rendered while drawing (excluded below).
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
            (() => { const [cx, cy] = currentPath.points[0].split(',').map(Number); return <Circle cx={cx} cy={cy} r={Math.max(4, currentPath.width)} fill="#FF0000" opacity={0.85} />; })()
          ) : (
            currentPath && currentPath.tool !== 'eraser' && <Path d={generatePathD(currentPath.points, currentPath.style)} stroke={currentPath.color} strokeWidth={currentPath.width} strokeOpacity={currentPath.opacity} fill="none" strokeLinecap="round" />
          )}
        </Svg>
      </View>
    </View>
  );
});

// Overlay container — absolute full-screen; elevation/zIndex 100 (below the toolbar's constant 200).
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    elevation: 100,
    zIndex: 100,
  },
});

export default DrawingCanvas;
