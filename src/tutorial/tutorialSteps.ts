/**
 * FILE: src/tutorial/tutorialSteps.ts
 * ROLE: The tutorial SCRIPT — one array entry per step. Delete an entry and that step
 *       disappears cleanly (steps chain by ORDER, nothing references ids). v3: grouped into
 *       4 chapters (progress bar), reading-mark + draw-tools + audio + sync steps added,
 *       closing card uses the exact cross-device wording.
 * DEPENDS ON: nothing (pure data).
 * USED BY: TutorialController.tsx (drives), TutorialOverlay.tsx (renders).
 * TYPES:
 *   kind        info | spotlight | compare | action
 *   screen      which stack screen the step plays on (controller navigates there)
 *   anchorId    registered via <TutorialAnchor id> — spotlight target; omit = centered card
 *   waitEvent   action steps advance when this tutorial event fires (emitTutorialEvent)
 *   passThrough action steps: the interactive region (anchor or allowZone) is live; the rest
 *               of the screen is dark + dead
 *   allowZone   {fx,fy,fw,fh} fractions — interactive region when there is no single anchor
 *   hand        show the pointing hand on this step (NEVER on pure-info steps)
 *   handPos     {fx,fy} window fractions for the hand when there is no anchor
 *   chapter     chapter label shown in the progress header
 *   onEnter     controller side-effect when the step becomes active ('enter-draw')
 *   exitDraw    controller tells the bridge to leave drawing mode when the step activates
 *   skipLabel   extra "skip this" button on action steps (acts as Next)
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
  chapter?: string;
  onEnter?: 'enter-draw';
  exitDraw?: boolean;
}

export const TUTORIAL_CHAPTERS = ['Setup', 'Read & Navigate', 'Annotate', 'Review & Sync'];

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ---------------- Dashboard — chapter: Setup ----------------
  {
    id: 'welcome', screen: 'Dashboard', kind: 'info', chapter: 'Setup',
    title: 'Welcome to Teach Quran 👋',
    body: 'This is your Dashboard — each card is one STUDENT. Everything a student does (highlights, notes, drawings, voice notes) is saved to their own card and synced to your account.',
  },
  {
    id: 'create-student', screen: 'Dashboard', kind: 'action', chapter: 'Setup',
    title: 'Add a student',
    body: 'Tap the + button, type the student\'s name, press Save. No students yet? Just make a practice one — it is removed automatically when the walkthrough ends. If you cancel, this step stays until a student exists.',
    anchorId: 'dashboard-fab', waitEvent: 'student_created', passThrough: true, hand: true,
  },
  {
    id: 'card-anatomy', screen: 'Dashboard', kind: 'spotlight', chapter: 'Setup',
    title: 'The student card',
    body: 'The name is your student. The "Reading:" line shows their DAILY RECITATION position at a glance — more on that soon. Long-press a card to Edit or Delete.',
    anchorId: 'student-card', hand: true,
  },
  {
    id: 'sync-explainer', screen: 'Dashboard', kind: 'spotlight', chapter: 'Setup',
    title: 'Sync, explained',
    body: '"Synced" means everything is safely on your account. "Sync (n)" means n edits are waiting to go up — they save on device first, then sync automatically when the app opens, comes back to the foreground, or every 30 minutes. Tap "Sync (n)" any time to sync right now.',
    anchorId: 'sync-pill', hand: true,
  },
  {
    id: 'open-student', screen: 'Dashboard', kind: 'action', chapter: 'Setup',
    title: 'Open the student',
    body: 'Tap the student\'s card to open their hub.',
    anchorId: 'student-card', waitEvent: 'student_opened', passThrough: true, hand: true,
  },

  // ---------------- StudentHub — chapter: Read & Navigate ----------------
  {
    id: 'resume-vs-daily', screen: 'StudentHub', kind: 'compare', chapter: 'Read & Navigate',
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
    id: 'open-reader', screen: 'StudentHub', kind: 'action', chapter: 'Read & Navigate',
    title: 'Open the mushaf',
    body: 'Tap RESUME to open the Quran at the student\'s last page.',
    anchorId: 'hub-resume', waitEvent: 'quran_opened', passThrough: true, hand: true,
  },

  // ---------------- QuranView — Read & Navigate ----------------
  {
    id: 'page-basics', screen: 'QuranView', kind: 'info', chapter: 'Read & Navigate',
    title: 'Moving around',
    body: 'Swipe — or tap the page edges — to turn pages. "Hide Header" (bottom-left of the page) gives you a full-screen mushaf; the same button brings it back.',
  },
  {
    id: 'highlight', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'Mark a mistake',
    body: 'Press any word — it gets highlighted in RED. That\'s how you track a mistake. Try it now on any word.',
    waitEvent: 'highlight_made', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, anchorId: 'reading-area',
  },
  {
    id: 'verse-menu', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'The verse menu',
    body: 'Tap the small number circle at the END of any verse (long-pressing the words does the same) to open its menu.',
    waitEvent: 'menu_opened', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, anchorId: 'reading-area',
  },
  {
    id: 'verse-menu-close', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'Five tools, one tap',
    body: '▶ Play the verse · 🔖 Bookmark saves it to revisit (as many as you like) · 📝 Note · 🎙 Record recitation · ⧉ Copy the text. Try any tool you like — then close the menu (tap outside it) to continue.',
    waitEvent: 'menu_closed', passThrough: true, anchorId: 'reading-area',
  },
  {
    id: 'notes-info', screen: 'QuranView', kind: 'info', chapter: 'Annotate',
    title: 'Notes travel with the student',
    body: 'A note you write on a verse also appears in the NOTES screen — so you can review every note for this student in one list later.',
  },
  {
    id: 'draw', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'Draw on the page',
    body: 'Drawing mode is now ON with the pen ready — underline a word or circle it. Your drawing is saved with the page.',
    waitEvent: 'stroke_saved', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.42 }, onEnter: 'enter-draw', anchorId: 'reading-area',
  },
  {
    id: 'draw-tools', screen: 'QuranView', kind: 'spotlight', chapter: 'Annotate',
    title: 'The drawing toolbar',
    body: 'LASER points without saving (great for live lessons) · ERASE removes strokes · UNDER/LINE draws straight lines · UNDO/REDO/CLEAR sit on the right · the palette and dot change color and pen size. Drag the grip to move it; tap EXIT when done.',
    anchorId: 'draw-toolbar', hand: true,
  },
  {
    id: 'draw-exit', screen: 'QuranView', kind: 'info', chapter: 'Annotate',
    title: 'Saved!',
    body: 'That drawing is stored with the page and syncs across devices. Leaving drawing mode…',
    exitDraw: true,
  },
  {
    id: 'voice-note', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'Record a recitation',
    body: 'Open the verse menu again (number circle) and press 🎙 Record — capture a few seconds of recitation, then Save. Or skip this step.',
    waitEvent: 'voice_saved', passThrough: true, hand: true, handPos: { fx: 0.5, fy: 0.3 }, skipLabel: 'Skip recording', anchorId: 'reading-area',
  },
  {
    id: 'bookmark-vs-mark', screen: 'QuranView', kind: 'compare', chapter: 'Annotate',
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
    id: 'reading-mark', screen: 'QuranView', kind: 'action', chapter: 'Annotate',
    title: 'Set the Daily Recitation mark',
    body: 'The MOST important habit: the pointing hand shows the ribbon BOOKMARK at the top of this page — tap it, then Confirm. That pins "we read UP TO HERE" for this student. If an older mark exists on another page it is removed and the mark UPDATES here automatically (only ONE mark per student). Tapping the ribbon again removes the mark.',
    anchorId: 'reading-ribbon', waitEvent: 'reading_mark_set', passThrough: true, hand: true, skipLabel: 'Skip this',
  },
  {
    id: 'share', screen: 'QuranView', kind: 'action', chapter: 'Review & Sync',
    title: 'Share a page',
    body: 'Tap SHARE in the header. In the menu you choose whether to include drawings and mistakes — bookmarks are always included. Then press Share to send the image (you can cancel the send).',
    anchorId: 'hdr-share', waitEvent: 'share_menu_opened', passThrough: true, hand: true,
  },
  {
    id: 'share-send', screen: 'QuranView', kind: 'action', chapter: 'Review & Sync',
    title: 'Send it (or cancel)',
    body: 'Press the big Share button — the normal Android share sheet opens. Cancel it if you like; the tutorial continues either way.',
    waitEvent: 'share_opened', passThrough: true, allowZone: { fx: 0.06, fy: 0.2, fw: 0.88, fh: 0.6 },
  },
  {
    id: 'mistakes', screen: 'QuranView', kind: 'spotlight', chapter: 'Review & Sync',
    title: 'Every mistake, collected',
    body: 'MISTAKES gathers all the red-highlighted words for this student in one list — perfect for revision before the next lesson.',
    anchorId: 'hdr-mistakes', hand: true,
  },
  {
    id: 'settings-night', screen: 'QuranView', kind: 'spotlight', chapter: 'Review & Sync',
    title: 'Settings & Night mode',
    body: 'SETTINGS holds Night mode for comfortable night-time reading, translation, script style and the split-view switch for tablets.',
    anchorId: 'hdr-settings', hand: true,
  },
  {
    id: 'index-nav', screen: 'QuranView', kind: 'spotlight', chapter: 'Review & Sync',
    title: 'Jump anywhere',
    body: 'Tap the surah name up top: jump to any JUZ or SURAH, or type a GO TO PAGE number — no swiping through hundreds of pages. "Hide Header" (bottom-left of the page) keeps the mushaf distraction-free.',
    anchorId: 'hdr-list', hand: true,
  },
  {
    id: 'audio', screen: 'QuranView', kind: 'spotlight', chapter: 'Review & Sync',
    title: 'Audio & loop practice',
    body: 'The player bar plays the whole surah — press ▶ to listen, ◀ ▶ to step verses, LOOP START/END to repeat a range for hifdh practice, and CHANGE to pick a different reciter.',
    anchorId: 'audio-bar', hand: true,
  },
  {
    id: 'final', screen: 'Dashboard', kind: 'info', chapter: 'Review & Sync',
    title: 'One last thing',
    body: 'Everything you save for a student — bookmarks, notes, highlights, drawings and the reading position — shows up automatically on any other device where you sign in with the same login. Teach on a tablet at the madrasah, review on your phone at home. You\'re free to use the app — replay this walkthrough anytime from Settings → Replay Tutorial.',
  },
];
