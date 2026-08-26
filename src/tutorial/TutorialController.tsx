/**
 * FILE: src/tutorial/TutorialController.tsx
 * ROLE: The tutorial engine — mounted ONCE inside NavigationContainer (App.tsx). Owns step
 *       advancement, screen navigation, event waiting, draw-mode side effects, practice-edit
 *       cleanup, and renders TutorialOverlay when active.
 * DEPENDS ON: tutorialSteps, tutorialRuntime, TutorialOverlay, react-redux, navigation.
 * USED BY: App.tsx (AppInner).
 * FLOW: Login/Register dispatch startTutorial() → this controller navigates to the current
 *       step's screen, shows the overlay, waits for Next taps or tutorial events, and on
 *       finish/skip runs the QuranView-registered cleanup (practice highlight/drawing
 *       rollback) then marks settings.tutorialDone so it never auto-plays again.
 * NOTES: If tutorialDone is somehow already set while active (stale dispatch), the effect
 *       below ends it immediately — the walkthrough never replays against the user's will.
 */
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { TUTORIAL_STEPS } from './tutorialSteps';
import {
  setTutorialStep, endTutorial, onTutorialEvent, onTutorialAnchorsChanged,
  getTutorialAnchor, getTutorialBridge,
} from './tutorialRuntime';
import { setTutorialDone } from '../store/settingsSlice';
import TutorialOverlay from './TutorialOverlay';

export default function TutorialController() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { active, stepIndex } = useSelector((s: any) => s.tutorial);
  const tutorialDone = useSelector((s: any) => s.settings?.tutorialDone === true);
  const studentCount = useSelector((s: any) => (s.student?.list || []).length);
  const step = active ? TUTORIAL_STEPS[stepIndex] : null;
  const [anchorRect, setAnchorRect] = useState<any>(null);

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

  // Refresh the spotlight rect when the step changes, when anchors re-measure, and once
  // after a short delay (post-navigation layout settle).
  useEffect(() => {
    if (!active || !step) { setAnchorRect(null); return; }
    const refresh = () => setAnchorRect(step.anchorId ? getTutorialAnchor(step.anchorId) : null);
    refresh();
    const t1 = setTimeout(refresh, 350);
    const t2 = setTimeout(refresh, 900);
    const unsub = onTutorialAnchorsChanged(refresh);
    return () => { unsub(); clearTimeout(t1); clearTimeout(t2); };
  }, [active, stepIndex, step?.anchorId]);

  // Step side effects: enter/exit drawing mode via the QuranView bridge.
  useEffect(() => {
    if (!active || !step) return;
    if (step.onEnter === 'enter-draw') getTutorialBridge().enterDraw?.();
    if (step.exitDraw) getTutorialBridge().exitDraw?.();
  }, [active, stepIndex, step?.onEnter, step?.exitDraw]);

  // Advance on Next (non-action) or on the step's waited event (action). finish() runs the
  // practice-edit rollback + done flag; used by BOTH the last step and Skip.
  const finish = () => {
    try { getTutorialBridge().cleanup?.(); } catch {}
    try { getTutorialBridge().exitDraw?.(); } catch {}
    dispatch(endTutorial());
    dispatch(setTutorialDone(true));
  };
  const advance = () => {
    if (stepIndex + 1 >= TUTORIAL_STEPS.length) finish();
    else dispatch(setTutorialStep(stepIndex + 1));
  };

  useEffect(() => {
    if (!active || !step) return;
    return onTutorialEvent((e: string) => {
      if (step.waitEvent && e === step.waitEvent) advance();
    });
  }, [active, stepIndex, step?.waitEvent]);

  if (!active || !step) return null;
  return (
    <TutorialOverlay
      step={step}
      stepIndex={stepIndex}
      total={TUTORIAL_STEPS.length}
      anchorRect={anchorRect}
      onNext={advance}
      onSkip={finish}
    />
  );
}
