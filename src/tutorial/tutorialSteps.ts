/**
 * FILE: src/tutorial/tutorialSteps.ts
 * ROLE: The tutorial SCRIPT — one array entry per step. Delete an entry and that step
 *       disappears cleanly from the walkthrough (steps chain by ORDER, nothing references
 *       ids), per the modular-removal requirement in TUTORIAL_PLAN.md.
 * DEPENDS ON: nothing (pure data).
 * USED BY: TutorialController.tsx (drives), TutorialOverlay.tsx (renders).
 * TYPES:
 *   kind        info | spotlight | compare | action
 *   screen      which stack screen the step plays on (controller navigates there)
 *   anchorId    registered via <TutorialAnchor id> — spotlight/hand target; omit = centered card
 *   waitEvent   action steps advance when this tutorial event fires (emitTutorialEvent)
 *   passThrough action steps: overlay does NOT block touches (the user must reach real UI)
 *   handPos     {fx,fy} fractions of the window for the pointing hand when there is no anchor
 *   onEnter     controller side-effect when the step becomes active ('enter-draw')
 *   exitDraw    controller tells the bridge to leave drawing mode when the step activates
 *   skipLabel   extra "skip this" button on action steps (acts as Next)
 *   allowZone   {fx,fy,fw,fh} fractions — the ONLY region that stays interactive on
 *               passThrough steps without an anchor; everything else stays dark + dead.
 */
export type TutorialScreen = 'Dashboard' | 'StudentHub' | 'QuranView';

export interface TutorialStep {
  id: string;
  screen: TutorialScreen;
  kind: 'info' | 'spotlight' | 'compare' | 'action';
  title: string;
  body: string;
  anchorId?: string;
  waitEvent?: string;
  passThrough?: boolean;
  hand?: boolean;
  handPos?: { fx: number; fy: number };
  compare?: { lTitle: string; lBody: string; rTitle: string; rBody: string };
  skipLabel?: string;
  allowZone?: { fx: number; fy: number; fw: number; fh: number };
  onEnter?: 'enter-draw';
  exitDraw?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ---------------- Dashboard ----------------
  {
    id: 'welcome', screen: 'Dashboard', kind: 'info',
    title: 'Welcome to Teach Quran 👋',
    body: 'This is your Dashboard — each card is one STUDENT. Everything a student does (highlights, notes, drawings, voice notes) is saved to their own card and synced to your account.',
  },
  {
    id: 'create-student', screen: 'Dashboard', kind: 'action',
    title: 'Create your first student',
    body: 'Tap the + button and add a student by name — this is who you will teach. No students yet? Just make a practice one — it is removed automatically when the walkthrough ends.',
    anchorId: 'dashboard-fab', waitEvent: 'student_created', passThrough: true, hand: true,
  },
  {
    id: 'card-anatomy', screen: 'Dashboard', kind: 'spotlight',
    title: 'The student card',
    body: 'The name is your student. The "Reading:" line shows their DAILY RECITATION position at a glance — more on that in a moment. Long-press a card to Edit or Delete.',
    anchorId: 'student-card', hand: true,
  },
  {
    id: 'open-student', screen: 'Dashboard', kind: 'action',
    title: 'Open the student',
    body: 'Tap the student\'s card to open their hub.',
    anchorId: 'student-card', waitEvent: 'student_opened', passThrough: true, hand: true,
  },

  // ---------------- StudentHub ----------------
  {
    id: 'resume-vs-daily', screen: 'StudentHub', kind: 'compare',
    title: 'Resume vs Daily Recitation',
    body: 'Two different "where we are" pointers — the most important distinction in the app:',
    compare: {
      lTitle: '▶ RESUME',
      lBody: 'The last page that was OPEN — say page 147. Tap it to jump straight back to where you left off VIEWING, even after closing the app.',
      rTitle: '📍 DAILY RECITATION',
      rBody: 'The 📍 reading mark YOU set from the ribbon at the top of a page — where the student is UP TO. Setting a new mark REPLACES the old one: one mark per student.',
    },
  },
  {
    id: 'open-reader', screen: 'StudentHub', kind: 'action',
    title: 'Open the mushaf',
    body: 'Tap RESUME to open the Quran at the student\'s last page.',
    anchorId: 'hub-resume', waitEvent: 'quran_opened', passThrough: true, hand: true,
  },

  // ---------------- QuranView ----------------
  {
    id: 'page-basics', screen: 'QuranView', kind: 'info',
    title: 'Moving around',
    body: 'Swipe — or tap the page edges — to turn pages. The header buttons up top open every tool. "Hide Header" gives you a full-screen mushaf.',
  },
  {
    id: 'highlight', screen: 'QuranView', kind: 'action',
    title: 'Mark a mistake',
    body: 'Press any word to highlight it with a red underline — that\'s how you track a mistake. Try it now on any word.',
    waitEvent: 'highlight_made', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, allowZone: { fx: 0.03, fy: 0.14, fw: 0.94, fh: 0.66 },
  },
  {
    id: 'verse-menu', screen: 'QuranView', kind: 'action',
    title: 'The verse menu',
    body: 'Tap the small number circle at the END of any verse (long-pressing the words does the same). The menu lets you: ▶ Play the verse · 🔖 Bookmark it · 📝 Add a note · 🎙 Record recitation · ⧉ Copy the text.',
    waitEvent: 'menu_opened', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, allowZone: { fx: 0.03, fy: 0.14, fw: 0.94, fh: 0.66 },
  },
  {
    id: 'verse-menu-close', screen: 'QuranView', kind: 'action',
    title: 'Five tools, one tap',
    body: 'That menu is your everyday toolkit. ▶ Play recitation · 🔖 Bookmark saves a verse to revisit (as many as you like) · 📝 Note · 🎙 Record · ⧉ Copy. Close the menu by tapping outside it to continue.',
    waitEvent: 'menu_closed', passThrough: true, allowZone: { fx: 0.03, fy: 0.1, fw: 0.94, fh: 0.8 },
  },
  {
    id: 'notes-info', screen: 'QuranView', kind: 'info',
    title: 'Notes travel with the student',
    body: 'A note you write on a verse also appears in the NOTES screen — so you can review every note for this student in one list later.',
  },
  {
    id: 'draw', screen: 'QuranView', kind: 'action',
    title: 'Draw on the page',
    body: 'Drawing mode is now ON with the pen ready — underline a word or circle it. Your drawing is saved with the page. (Laser pointer, eraser, colors and sizes are on the same toolbar.)',
    waitEvent: 'stroke_saved', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.42 }, onEnter: 'enter-draw', allowZone: { fx: 0.03, fy: 0.12, fw: 0.94, fh: 0.72 },
  },
  {
    id: 'draw-exit', screen: 'QuranView', kind: 'info',
    title: 'Saved!',
    body: 'That drawing is stored with the page and syncs across devices. Leaving drawing mode…',
    exitDraw: true,
  },
  {
    id: 'voice-note', screen: 'QuranView', kind: 'action',
    title: 'Record a recitation',
    body: 'Open the verse menu again (number circle) and press 🎙 Record — capture a few seconds of recitation, then Save. Or skip this step.',
    waitEvent: 'voice_saved', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, skipLabel: 'Skip recording', allowZone: { fx: 0.03, fy: 0.1, fw: 0.94, fh: 0.82 },
  },
  {
    id: 'bookmark-vs-mark', screen: 'QuranView', kind: 'compare',
    title: '📖 Bookmark vs 📍 Reading mark',
    body: 'They look similar — they do different jobs:',
    compare: {
      lTitle: '📖 BOOKMARK',
      lBody: 'From the verse menu. Saves a verse to REVISIT later — use as many as you like, on any verses. Delete them anytime from the menu or Bookmarks screen.',
      rTitle: '📍 READING MARK',
      rBody: 'The ribbon at the TOP of the page. Marks where the student is UP TO — their Daily Recitation position. The new mark always REPLACES the old one.',
    },
  },
  {
    id: 'share', screen: 'QuranView', kind: 'action',
    title: 'Share a page',
    body: 'Tap SHARE in the header. In the menu you choose whether to include drawings and mistakes — bookmarks are always included. Then press Share to send the image (you can cancel the send).',
    anchorId: 'hdr-share', waitEvent: 'share_menu_opened', passThrough: true, hand: true,
  },
  {
    id: 'share-send', screen: 'QuranView', kind: 'action',
    title: 'Send it (or cancel)',
    body: 'Press the big Share button — the normal Android share sheet opens. Cancel it if you like; the tutorial continues either way.',
    waitEvent: 'share_opened', passThrough: true, allowZone: { fx: 0.06, fy: 0.2, fw: 0.88, fh: 0.6 },
  },
  {
    id: 'mistakes', screen: 'QuranView', kind: 'spotlight',
    title: 'Every mistake, collected',
    body: 'MISTAKES gathers all the red-highlighted words for this student in one list — perfect for revision before the next lesson.',
    anchorId: 'hdr-mistakes', hand: true,
  },
  {
    id: 'notes-night', screen: 'QuranView', kind: 'spotlight',
    title: 'Notes & Night mode',
    body: 'NOTES lists every note for this student. In SETTINGS you\'ll also find Night mode for comfortable night-time reading.',
    anchorId: 'hdr-notes', hand: true,
  },
  {
    id: 'index', screen: 'QuranView', kind: 'spotlight',
    title: 'Jump anywhere',
    body: 'Tap the surah name up top to open the Juz / Surah index — jump to any juz or surah instantly instead of swiping through pages.',
    anchorId: 'hdr-list', hand: true,
  },
  {
    id: 'done', screen: 'QuranView', kind: 'info',
    title: 'You\'re all set! 🎉',
    body: 'You\'re free to use the app — everything you practice is saved to your student. You can replay this walkthrough anytime from Settings → Replay Tutorial.',
  },
];
