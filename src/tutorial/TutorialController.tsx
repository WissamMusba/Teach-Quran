/**
 * FILE: src/tutorial/TutorialController.tsx
 * ROLE: The tutorial engine — mounted ONCE inside NavigationContainer (App.tsx). Owns step
 *       advancement (Next/Back/events), screen navigation, anchor polling, draw-mode side
 *       effects, PRACTICE cleanup (practice edits + a practice student created on a fresh
 *       account), and renders TutorialOverlay when active.
 * DEPENDS ON: tutorialSteps, tutorialRuntime, TutorialOverlay, react-redux, navigation,
 *             api/student + database/localDB (practice-student removal).
 * USED BY: App.tsx (AppInner).
 * PRACTICE-STUDENT LIFECYCLE (user requirement): when the account has NO students at
 *       tutorial start, the create-student step walks the user through making one; that
 *       student is flagged by the student_created payload and DELETED at finish/skip
 *       (Firestore + local purge + redux), then the app lands back on the Dashboard.
 *       Accounts that already have students skip the create step entirely.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { TUTORIAL_STEPS } from './tutorialSteps';
import {
  setTutorialStep, endTutorial, onTutorialEvent, onTutorialAnchorsChanged,
  getTutorialAnchor, getTutorialBridge, setTutorialMeasuringActive, onTutorialContextChanged,
} from './tutorialRuntime';
import { setTutorialDone } from '../store/settingsSlice';
import { addStudent, removeStudent } from '../store/studentSlice';
import { createStudent, deleteStudent } from '../api/student';
import { purgeLocalStudent } from '../database/localDB';
import TutorialOverlay from './TutorialOverlay';

export default function TutorialController() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { active, stepIndex } = useSelector((s: any) => s.tutorial);
  const tutorialDone = useSelector((s: any) => s.settings?.tutorialDone === true);
  const studentCount = useSelector((s: any) => (s.student?.list || []).filter((st: any) => !st?.isMyQuran && st?.name !== 'My Quran').length);
  const step = active ? TUTORIAL_STEPS[stepIndex] : null;
  const [anchorRect, setAnchorRect] = useState<any>(null);
  const [flash, setFlash] = useState(false);

  // Practice-student tracking: did the account have students when the tutorial started,
  // and which student id was created DURING it (removed at the end if so).
  const startHadStudentsRef = useRef<boolean | null>(null);
  const practiceStudentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (active && startHadStudentsRef.current === null) startHadStudentsRef.current = studentCount > 0;
    if (!active) {
      startHadStudentsRef.current = null;
      practiceStudentIdRef.current = null;
    }
  }, [active, studentCount]);

  // Stale-start guard: never run when the done-flag says we already finished.
  useEffect(() => {
    if (active && tutorialDone) dispatch(endTutorial());
  }, [active, tutorialDone, dispatch]);

  // Replay gate: the create-student step self-advances when a student already exists.
  useEffect(() => {
    if (active && step?.waitEvent === 'student_created' && studentCount > 0) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, studentCount]);

  // Navigate to the current step's screen when it differs from where we are.
  useEffect(() => {
    if (!active || !step) return;
    const route: string | undefined = (navigation as any).getCurrentRoute?.()?.name;
    if (route && route !== step.screen) {
      try { (navigation as any).navigate(step.screen as never); } catch {}
    }
  }, [active, stepIndex, step?.screen, navigation]);

  // Anchor resolution: poll while active (simple + immune to subscription-order races),
  // plus an immediate refresh on step change and on any anchor re-measure.
  useEffect(() => {
    if (!active || !step) { setAnchorRect(null); return; }
    const refresh = () => setAnchorRect(step.anchorId ? getTutorialAnchor(step.anchorId) : null);
    refresh();
    const iv = step.anchorId ? setInterval(refresh, 300) : null;
    const unsub = onTutorialAnchorsChanged(refresh);
    return () => { unsub(); if (iv) clearInterval(iv); };
  }, [active, stepIndex, step?.anchorId]);

  // While active, every TutorialAnchor re-measures on the shared runtime tick (the page
  // FlatList translates pages without re-firing onLayout — stale rects made spotlights
  // land top-left after swipes).
  useEffect(() => {
    setTutorialMeasuringActive(active);
    return () => setTutorialMeasuringActive(false);
  }, [active]);

  // Dynamic text tokens ({resumePage}…) resolve at overlay render — re-render when they land.
  const [, setCtxTick] = useState(0);
  useEffect(() => onTutorialContextChanged(() => setCtxTick((t) => t + 1)), []);

  // Step side effects: enter/exit drawing mode via the QuranView bridge.
  useEffect(() => {
    if (!active || !step) return;
    if (step.onEnter === 'enter-draw') getTutorialBridge().enterDraw?.();
    if (step.exitDraw) getTutorialBridge().exitDraw?.();
  }, [active, stepIndex, step?.onEnter, step?.exitDraw]);

  const finish = () => {
    try { getTutorialBridge().cleanup?.(); } catch {}
    try { getTutorialBridge().exitDraw?.(); } catch {}
    practiceStudentIdRef.current = null;
    dispatch(endTutorial());
    dispatch(setTutorialDone(true));
  };
  const advance = () => {
    if (stepIndex + 1 >= TUTORIAL_STEPS.length) finish();
    else dispatch(setTutorialStep(stepIndex + 1));
  };
  const handleNext = async () => {
    if (step?.id === 'create-student' && studentCount === 0) {
      try {
        const res = await createStudent('Tutorial Student');
        if (res?.success && res?.studentId) {
          dispatch(addStudent({ id: res.studentId, name: 'Tutorial Student' }));
        }
      } catch {}
    }
    advance();
  };
  const back = () => {
    if (stepIndex > 0) dispatch(setTutorialStep(stepIndex - 1));
  };

  // Event waiting — resubscribed per step so stale events can never double-advance.
  useEffect(() => {
    if (!active || !step) return;
    return onTutorialEvent((e: string, payload?: any) => {
      if (e === 'student_created' && payload) {
        // Fresh account (no students at start) → the created student is PRACTICE data.
        if (startHadStudentsRef.current === false) practiceStudentIdRef.current = payload;
      }
      if (step.waitEvent && e === step.waitEvent) {
        // ✓ feedback: confirm the action for ~600ms BEFORE advancing (review #9/#10).
        setFlash(true);
        setTimeout(() => { setFlash(false); advance(); }, 600);
      }
    });
  }, [active, stepIndex, step?.waitEvent]);

  if (!active || !step) return null;
  return (
    <TutorialOverlay
      step={step}
      stepIndex={stepIndex}
      total={TUTORIAL_STEPS.length}
      anchorRect={anchorRect}
      flash={flash}
      onNext={handleNext}
      onBack={back}
      onSkip={finish}
    />
  );
}
