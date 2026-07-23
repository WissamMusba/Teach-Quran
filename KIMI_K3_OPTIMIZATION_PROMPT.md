# Kimi K3 Optimization Prompt — QuranMasterApp → quran.com Style

---

## ROLE & CONTEXT

You are an expert React Native developer specializing in Quran app development. I'm building a Quran teaching app called "QuranMasterApp" using React Native 0.72.0 + TypeScript + Redux Toolkit + SQLite + Firebase.

**GOAL:** Transform this app to look and feel like quran.com — the gold standard for Quran apps worldwide. Optimize ALL code for maximum performance, minimum bundle size, and instant loading times. Remove every line of unnecessary code.

---

## CURRENT APP ARCHITECTURE

- **Framework:** React Native 0.72.0 (TypeScript)
- **State:** Redux Toolkit + redux-persist
- **Database:** react-native-sqlite-storage (local SQLite)
- **Backend:** Firebase (Auth + Firestore)
- **Navigation:** @react-navigation/native-stack v6
- **Features:** Student management, Quran reading (3 modes), drawing/annotation, bookmarks, notes, highlights, voice notes, sync

## TARGET ARCHITECTURE (After Optimization)

### New Dependencies to ADD
```json
{
  "react-native-reanimated": "^3.0.0",
  "react-native-linear-gradient": "^2.8.0",
  "@react-native-community/slider": "^4.4.0"
}
```

### Dependencies to REMOVE
```json
{
  "react-native-audio-recorder-player": "3.6.14",
  "react-native-view-shot": "3.8.0",
  "react-native-share": "^12.3.1",
  "react-native-haptic-feedback": "^3.0.0",
  "uuid": "^9.0.0"
}
```

### File Structure (Optimized)
```
src/
├── api/
│   ├── firebase.ts
│   ├── auth.ts
│   ├── student.ts
│   └── sync.ts
├── components/
│   ├── quran/
│   │   ├── QuranHeader.tsx      (NEW)
│   │   ├── SurahList.tsx        (REDESIGN)
│   │   ├── VerseDisplay.tsx     (OPTIMIZE)
│   │   ├── FlowingText.tsx      (OPTIMIZE)
│   │   ├── MushafPageView.tsx   (OPTIMIZE)
│   │   ├── AyahMode.tsx         (NEW - extract from QuranView)
│   │   ├── ContinuousMode.tsx   (NEW - extract from QuranView)
│   │   ├── PageMode.tsx         (NEW - extract from QuranView)
│   │   └── StudyMode.tsx        (NEW)
│   ├── audio/
│   │   ├── AudioPlayerBar.tsx   (NEW)
│   │   ├── QariSelector.tsx     (NEW)
│   │   └── AudioControls.tsx    (NEW)
│   ├── drawing/
│   │   ├── DrawingCanvas.tsx
│   │   └── StaticDrawingOverlay.tsx
│   ├── settings/
│   │   ├── NightModeSection.tsx (NEW)
│   │   ├── ReadingPrefsSection.tsx (NEW)
│   │   ├── TextSection.tsx      (NEW)
│   │   ├── DownloadSection.tsx  (NEW)
│   │   └── AdvancedSection.tsx  (NEW)
│   └── common/
│       ├── SyncStatus.tsx
│       ├── SkeletonLoader.tsx   (NEW)
│       └── ResponsiveProvider.tsx (NEW)
├── database/
│   ├── localDB.ts
│   └── quranData.ts
├── hooks/
│   ├── useAudio.ts             (NEW)
│   ├── useResponsive.ts        (NEW)
│   └── useQuranSettings.ts     (NEW)
├── screens/
│   ├── SplashScreen.tsx
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── QuranViewScreen.tsx     (SLIM DOWN)
│   ├── BookmarksScreen.tsx
│   ├── MistakesScreen.tsx
│   ├── SettingsScreen.tsx      (REDESIGN)
│   └── NotesScreen.tsx
├── store/
│   ├── index.ts
│   ├── authSlice.ts
│   ├── studentSlice.ts
│   ├── quranSlice.ts           (SIMPLIFY)
│   ├── audioSlice.ts           (NEW)
│   ├── syncSlice.ts
│   └── settingsSlice.ts        (NEW)
└── utils/
    ├── constants.ts
    ├── responsive.ts           (NEW)
    └── icons.ts                (NEW - SVG icons)
```

---

## DESIGN REQUIREMENTS — Match quran.com Exactly

### 1. COLOR SCHEME (Dark Mode — quran.com style)
```
Background Primary: #121212 (deep black)
Background Secondary: #1a1a2e (slightly lighter for cards)
Background Tertiary: #16213e (for headers/navbars)
Surface: #1e1e1e (cards, modals)
Border: #2a2a2a (subtle dividers)
Text Primary: #ffffff
Text Secondary: #b0b0b0
Text Tertiary: #666666
Accent Primary: #00d4aa (quran.com's teal/green)
Accent Secondary: #1db954 (success states)
Bookmark/Gold: #ffd700
Error: #ff4757
```

### 2. TYPOGRAPHY — RESPONSIVE (Adjusts to Screen Size)

**CRITICAL: Page Swipe Mode must use RESPONSIVE font sizing, NOT fixed sizes**

```typescript
// File: src/utils/responsive.ts
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Baseline: iPhone 11 (375px width)
const BASE_WIDTH = 375;

// Scale font based on screen width
export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

// Get responsive font size for mushaf page mode
export const getMushafFontSize = (): number => {
  if (SCREEN_WIDTH < 360) return 18;      // Small phones
  if (SCREEN_WIDTH < 400) return 22;      // Medium phones
  if (SCREEN_WIDTH < 500) return 26;      // Large phones
  if (SCREEN_WIDTH < 700) return 30;      // Small tablets
  return 34;                               // Large tablets
};

// Get responsive line height
export const getMushafLineHeight = (): number => {
  return getMushafFontSize() * 2.2;
};

// Check if device is tablet
export const isTablet = (): boolean => {
  return SCREEN_WIDTH >= 768;
};
```

**Apply to MushafPageView.tsx:**
```typescript
// File: src/components/quran/MushafPageView.tsx
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';

// In the component:
const mushafFontSize = getMushafFontSize();
const mushafLineHeight = getMushafLineHeight();

// Use in styles:
<Text style={[styles.text, { fontSize: mushafFontSize, lineHeight: mushafLineHeight }]}>
  {word.word}
</Text>

// STYLES:
text: {
  color: '#fff',
  fontSize: 22,  // Default, overridden by responsive value
  lineHeight: 48,
  textAlign: 'center',
  flexShrink: 1,
},
```

**Font Sizes by Device:**
```
Small Phone (<360px):   fontSize 18, lineHeight 40
Medium Phone (360-400): fontSize 22, lineHeight 48
Large Phone (400-500):  fontSize 26, lineHeight 57
Small Tablet (500-700): fontSize 30, lineHeight 66
Large Tablet (700+):    fontSize 34, lineHeight 75
```

**Other Typography (also responsive):**
```typescript
// Translation text
export const getTranslationFontSize = (): number => scaleFont(16);

// Verse badge
export const getVerseBadgeSize = (): number => scaleFont(28);

// Header text
export const getHeaderFontSize = (): number => scaleFont(18);
```

**Apply to VerseDisplay.tsx (Ayah Mode):**
```typescript
// File: src/components/quran/VerseDisplay.tsx
import { scaleFont } from '../../utils/responsive';

// Arabic text - responsive
<Text style={[styles.arabicText, { fontSize: scaleFont(FONT_SIZES[fontSize]) }]}>
  {word}{' '}
</Text>

// Translation - responsive
<Text style={[styles.translation, { fontSize: scaleFont(16) }]}>
  {verse.textTranslation}
</Text>
```

### 3. UI COMPONENT PATTERNS

**Surah List (like quran.com):**
- Each row: Left (surah number in circle) | Center (English name + Arabic name) | Right (ayah count badge)
- Section headers by Juz with gold (#ffd700) text
- Smooth press animation (scale 0.98)
- No emojis — use proper SVG icons

**Verse Display — CRITICAL FIXES:**
```
PROBLEM 1: "Weird thing" at bottom = "Page 13 (Verses 84-88)" page info text
SOLUTION: Remove page info from bottom of reading view completely
          OR move it to header only (small, subtle text)

PROBLEM 2: Verse numbers are too small and hard to see
SOLUTION: Make verse numbers LARGER and more visible:
  - Circle badge: 32x32px (not 28x28)
  - Background: #333 (darker contrast)
  - Text: #fff (white, not #aaa)
  - FontSize: 14px (not 12)
  - Add slight shadow for depth
  - Position: After verse text, with 8px gap
```

**Verse Number Badge (FIXED):**
```tsx
<View style={styles.verseBadge}>
  <Text style={styles.verseBadgeText}>{verse.verseNumber}</Text>
</View>

const styles = StyleSheet.create({
  verseBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  verseBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // If bookmarked:
  bookmarkedBadge: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  bookmarkedBadgeText: {
    color: '#000000',
  },
});
```

**Verse Separator Lines — REMOVE:**
```
PROBLEM: Gray lines between verses look messy
SOLUTION: Remove borderBottom entirely, use spacing instead

// REMOVE these from VerseDisplay:
borderBottomWidth: 1,
borderBottomColor: '#1e1e1e',

// ADD instead:
marginBottom: 24,  // Space between verses
paddingBottom: 8,
```

**Navigation Header:**
- Back arrow (←) on left
- Surah name centered (tappable to open SurahList)
- Juz indicator below surah name (small, subtle)
- Right side: Settings gear icon, Share icon (SVG only)
- NO page info in header (clean look)

**Bottom Bar (when reading):**
- Fixed bottom bar with: Bookmark | Notes | Draw | Settings
- Icons only (SVG), no text labels
- Subtle backdrop blur effect
- NO page/verse info at bottom

---

## PERFORMANCE OPTIMIZATIONS — CRITICAL

### 1. SPLASH SCREEN / INITIAL LOAD — SMART PRELOADING
```typescript
// CURRENT PROBLEM: Downloads 604 mushaf pages + all verses on first launch (takes forever)
// SOLUTION: Smart preloading — fast first launch, instant surah opens

// STRATEGY:
// Step 1: On first launch, show splash with progress bar
// Step 2: Download surah metadata (114 items) — instant, ~10KB
// Step 3: Download verses for first 5-10 surahs (most common: Al-Fatihah, Al-Baqarah, etc.)
// Step 4: Download remaining surahs IN BACKGROUND while user browses
// Step 5: Cache everything in SQLite — persists between sessions

// RESULT:
// - First launch: ~5-10 seconds (downloads core data)
// - Subsequent launches: < 1 second (data cached in SQLite)
// - Opening any surah: INSTANT (preloaded)
```

### 2. QURAN DATA LOADING — NO WAITING
```typescript
// RULE: User should NEVER wait for surah data to load

// APPROACH:
// 1. On app start: Load surah list + first 10 surahs into SQLite
// 2. In background: Load all remaining surahs (priority queue)
// 3. On surah open: 
//    - If cached in SQLite → INSTANT (no loading)
//    - If not cached → Show skeleton loader for 200-500ms max
// 4. On page mode: Preload current page + 2 adjacent pages

// PRELOAD PRIORITY (download order):
// 1. Al-Fatihah (1) — always first
// 2. Al-Baqarah (2) — most accessed
// 3. Surahs 1-10 — common
// 4. Surahs 11-30 — juz' completion
// 5. Remaining 31-114 — background
```

### 3. SKELETON LOADER (If Cache Miss)
```typescript
// If user opens a surah that isn't cached yet:
// Show skeleton loader (gray placeholder) for ~200-500ms
// NEVER show spinner or "Loading..." text

// Skeleton component:
const VerseSkeleton = () => (
  <View style={styles.skeleton}>
    <View style={styles.skeletonLine} />
    <View style={[styles.skeletonLine, { width: '80%' }]} />
    <View style={[styles.skeletonLine, { width: '60%' }]} />
  </View>
);
```

### 3. STATE MANAGEMENT OPTIMIZATION
```typescript
// REMOVE: Unnecessary re-renders
// 1. Use React.memo() on ALL components
// 2. Use useCallback() for ALL handlers
// 3. Use useMemo() for computed values
// 4. Split large components into smaller ones
// 5. Remove redux-persist for quran data (use SQLite only)
// 6. Minimize Redux state — move transient state to useState
```

### 4. SQLITE OPTIMIZATION
```typescript
// 1. Add indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId);
CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page);
CREATE INDEX IF NOT EXISTS idx_mushaf_page ON mushaf_pages(pageNumber);

// 2. Use transactions for bulk inserts
// 3. Close database connections properly
// 4. Use WAL mode for better concurrent access
PRAGMA journal_mode=WAL;
```

### 5. BUNDLE SIZE REDUCTION
```typescript
// REMOVE:
- react-native-audio-recorder-player (if not core feature)
- react-native-view-shot (if share is simple)
- react-native-share (use native share)
- react-native-haptic-feedback (optional)
- uuid (use Math.random or Date.now)
- All emoji usage (replace with SVG icons)

// OPTIMIZE:
- Use react-native-reanimated for animations (not Animated API)
- Use react-native-gesture-handler properly
- Lazy load screens with React.lazy + Suspense
```

---

## CODE CLEANUP — Remove All Unnecessary Code

### 1. REDUX SLICES — Simplify
```typescript
// quranSlice: Remove unnecessary fields
// Keep only: currentSurahId, verses, showTranslation, fontSize, readingMode, textStyle
// Remove: surahNames (load from SQLite directly), flashingVerse (use local state)

// studentSlice: Simplify
// Keep only: currentStudent, studentData
// Remove: list (load from Firebase directly, don't cache in Redux)

// historySlice: REMOVE ENTIRELY
// Drawing undo/redo should be local state in DrawingCanvas

// syncSlice: Simplify
// Keep only: status, pendingChanges
// Move logic to custom hook
```

### 2. COMPONENTS — Split & Optimize
```typescript
// QuranViewScreen.tsx is 400+ lines — SPLIT into:
// - QuranHeader.tsx (navigation bar)
// - AyahMode.tsx (ayah list view)
// - ContinuousMode.tsx (flowing text view)
// - PageMode.tsx (mushaf page view)
// - VerseContextMenu.tsx (long press menu)
// - NoteModal.tsx
// - DrawingOverlay.tsx

// Each component should be < 150 lines
// Each component should have React.memo()
```

### 3. API LAYER — Optimize
```typescript
// firebase.ts: Keep minimal
// auth.ts: Add token refresh, error handling
// student.ts: Add pagination, caching
// sync.ts: Implement proper queue with retry logic

// REMOVE: Redundant error handling
// ADD: Proper TypeScript types for all API responses
```

---

## quran.com-SPECIFIC FEATURES TO ADD

### 1. AUDIO PLAYER BAR (Bottom of Reading View)
```
Fixed bottom bar during reading:
- Left: Play/Pause button (▶/⏸)
- Center: Current Qari name (e.g., "Mishary Al-Afasy")
- Right: Expand arrow (⌃) to open Qari selector
- Background: Semi-transparent with blur effect
- Height: 50-60px
- Shows only when audio is available
```

### 2. QARI SELECTION MODAL
```
Full-screen modal with:
- Header: "Select a Qari" with close (×) button
- Sections with teal (#00d4aa) headers:
  - "Qaris with Downloads" (previously downloaded)
  - "Gapless" (full surah recordings)
- Each row: Qari name + checkmark (✓) if selected
- List of qaris to include:
  - Dr. Ayman Suwaid (gapped)
  - Mishary Al-Afasy (California)
  - Mishary with Ibrahim Walk (English)
  - Mishary Al-Afasy
  - Muhammad Ayyoub
  - Muhammad Ayyoub (gapped)
  - Abd Al-Basit
  - Abd Al-Basit Mujawwad
  - AbdulHadi Kanakeri
  - AbdulMuhsin al Qasim
- Smooth scroll, dark background
```

### 3. READING VIEW HEADER (quran.com style)
```
Page Mode Header:
- Left: Back arrow (←)
- Center-Left: Surah name (e.g., "Surah Al-Mursalat")
- Center: "Page 585, Juz' 29" (smaller text below)
- Right icons:
  - Bookmark icon (🔖) - toggle
  - Globe icon (🌐) - translation selector
  - Three dots (⋮) - more options menu
- Background: Dark (#1a1a2e)
- Height: 60-70px
```

### 4. SETTINGS PAGE (Full quran.com style)
```
Section 1: Night Mode
- Toggle: "Night mode" with description "Use dark background and light fonts"
- Slider: "Text brightness" (0-255) with live preview
- Slider: "Background brightness" (0-255) with color swatch preview

Section 2: Reading Preferences
- Toggle: "Show page info" - "Overlay page number, surah name, and juz' number while reading"
- Toggle: "Display marker popups" - "Display popup on reaching juz', hizb, etc."

Section 3: Text Settings
- Slider: "Translation text size" (8-24) with live preview

Section 4: Download Options
- Toggle: "Streaming" - "Stream audio instead of downloading"
- Setting: "Download amount" - "Preferred download amount for non-gapless audio"
- Setting: "Audio Manager" - "Manage and download Quranic audio"

Section 5: Advanced Options
- Setting: "Advanced Options" - "Import/export bookmarks, set Quran data directory, etc."
```

### 5. SURAH LIST PAGE
```
- Search bar at top (filters by name/number)
- Tabs: Surah | Juz | Page | Hizb
- Each surah card shows:
  - Surah number in decorative circle
  - English name (large)
  - Arabic name (smaller, right-aligned)
  - "X Ayahs" badge
  - Revelation type badge (Meccan/Medinan)
- Smooth scroll with section headers
```

### 6. READING VIEW MODES
```
Mode Switcher (3 modes):
- Ayah: Verse-by-verse list with proper spacing
- Continuous: Flowing Arabic text like a book
- Page: Mushaf page view (swipeable)

Common features:
- Font size slider (not buttons)
- Translation toggle (smooth animation)
- Click ayah number for Study Mode
- Proper Arabic typography (Indopak/Uthmani)
```

### 7. STUDY MODE (NEW)
```
- Click any ayah number to open
- Shows: Arabic text, translation, word-by-word
- Tafsir section (expandable)
- Related verses
- Notes section
- Bookmark/Copy/Share actions
```

### 8. BOOKMARKS PAGE
```
- Group by Surah
- Show verse preview
- Sort by date added
- Swipe to delete
- Tap to navigate
```

---

## SPECIFIC FILE OPTIMIZATIONS

### MushafPageView.tsx — FIX VERSE NUMBERS + RESPONSIVE FONT
```typescript
// File: src/components/quran/MushafPageView.tsx
// PROBLEM 1: Verse numbers barely visible
// PROBLEM 2: Fixed font size doesn't adjust to screen

// ADD AT TOP:
import { getMushafFontSize, getMushafLineHeight } from '../../utils/responsive';

// INSIDE COMPONENT, before return:
const mushafFontSize = getMushafFontSize();
const mushafLineHeight = getMushafLineHeight();

// PROBLEM 1 FIX: Replace verse number display
// FIND:
{isVerseBoundary && (
  <Text style={styles.ayahGap}>
    {isBookmarked && '🔖'}
    {hasNote && '📝'}
  </Text>
)}

// REPLACE WITH:
{isVerseBoundary && (
  <View style={styles.verseBadgeContainer}>
    <View style={styles.verseBadge}>
      <Text style={styles.verseBadgeText}>{verseNum}</Text>
    </View>
    {isBookmarked && <Text style={styles.bookmarkIcon}>🔖</Text>}
  </View>
)}

// PROBLEM 2 FIX: Use responsive font size
// FIND the Text component for word:
<Text style={styles.text}>{word.word} </Text>

// REPLACE WITH:
<Text style={[styles.text, { 
  fontSize: mushafFontSize, 
  lineHeight: mushafLineHeight 
}]}>
  {word.word}{' '}
</Text>

// ADD THESE STYLES:
verseBadgeContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginHorizontal: 6,
},
verseBadge: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: '#333',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#444',
},
verseBadgeText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
bookmarkIcon: {
  fontSize: 12,
  marginLeft: 4,
},

// UPDATE styles.text:
text: {
  color: '#fff',
  fontSize: 22,  // Default fallback
  lineHeight: 48,  // Default fallback
  textAlign: 'center',
  flexShrink: 1,
},

// REMOVE these styles:
ayahGap: {
  // DELETE ENTIRELY
},
```

### FlowingText.tsx — FIX VERSE NUMBERS
```typescript
// File: src/components/quran/FlowingText.tsx
// PROBLEM: Verse number is just plain text, hard to see
// SOLUTION: Make it a circle badge

// FIND this code:
<Text onPress={() => onVerseLongPress(verse.verseNumber)} style={styles.verseBadge}>
  {` ${verse.verseNumber} `}
</Text>

// REPLACE WITH:
<View style={styles.verseBadgeContainer}>
  <View style={styles.verseBadge}>
    <Text style={styles.verseBadgeText}>{verse.verseNumber}</Text>
  </View>
</View>

// ADD THESE STYLES:
verseBadgeContainer: {
  alignSelf: 'center',
  marginHorizontal: 4,
},
verseBadge: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: '#333',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#444',
},
verseBadgeText: {
  color: '#fff',
  fontSize: 12,
  fontWeight: 'bold',
},
```

### QuranViewScreen.tsx — REMOVE PAGE INFO AT BOTTOM
```typescript
// File: src/screens/QuranViewScreen.tsx
// PROBLEM: "Page 13 (Verses 84-88)" showing at bottom
// SOLUTION: Remove this entirely

// FIND this code at the bottom of the renderItem:
<View style={styles.pageFooter}>
  <Text style={styles.pageText}>Page {item} {verseRange}</Text>
</View>

// DELETE ENTIRELY (the whole View block)

// ALSO DELETE these styles:
pageFooter: {
  // DELETE
},
pageText: {
  // DELETE
},
```

### App.tsx
```typescript
// BEFORE: Complex nested providers
// AFTER: Clean, minimal setup
// - Remove unnecessary wrappers
// - Lazy load screens
// - Optimize navigation config
```

### SplashScreen.tsx
```typescript
// BEFORE: Downloads everything, shows error
// AFTER: 
// - Beautiful gradient background
// - App logo centered
// - Subtle loading animation
// - Progress bar (not ActivityIndicator)
// - No error display — handle silently
// - Auto-navigate after 1.5s
```

### QuranViewScreen.tsx
```typescript
// BEFORE: 400+ lines, handles everything
// AFTER: 50 lines, just renders mode component
// - Extract all logic to custom hooks
// - Use React.lazy for mode components
// - Remove inline styles
```

### VerseDisplay.tsx — CRITICAL FIXES
```typescript
// BEFORE PROBLEMS:
// 1. Verse numbers too small (28x28, fontSize 12, color #aaa)
// 2. Gray border lines between verses look messy
// 3. "Page X (Verses X-X)" text showing at bottom

// AFTER FIXES:

// 1. VERSE NUMBER BADGE — Make visible and clear
const VerseBadge = memo(({ verseNum, isBookmarked }: { verseNum: number; isBookmarked: boolean }) => (
  <View style={[
    styles.badge,
    isBookmarked && styles.badgeBookmarked
  ]}>
    <Text style={[
      styles.badgeText,
      isBookmarked && styles.badgeTextBookmarked
    ]}>
      {verseNum}
    </Text>
  </View>
));

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  badgeBookmarked: {
    backgroundColor: '#ffd700',
    borderColor: '#ffd700',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  badgeTextBookmarked: {
    color: '#000000',
  },
});

// 2. REMOVE BORDER LINES — Use spacing instead
// REMOVE:
// borderBottomWidth: 1,
// borderBottomColor: '#1e1e1e',

// ADD:
container: {
  marginBottom: 28,  // Clear separation between verses
  paddingTop: 8,
  paddingBottom: 8,
  // NO borderBottom
},

// 3. REMOVE PAGE INFO FROM BOTTOM
// The "Page 13 (Verses 84-88)" text should NOT appear
// Remove from QuranViewScreen.tsx:
// DELETE: <View style={styles.pageFooter}>
// DELETE:   <Text style={styles.pageText}>Page {item} {verseRange}</Text>
// DELETE: </View>

// 4. ARABIC TEXT — Make it larger and clearer
arabicText: {
  color: '#ffffff',
  fontSize: 28,        // Bigger (was 24-26)
  lineHeight: 56,      // More space (was 45)
  textAlign: 'right',
  fontWeight: '400',
},
```

### SurahList.tsx
```typescript
// BEFORE: Basic list
// AFTER: quran.com style
// - Add search functionality
// - Add tab navigation (Surah/Juz/Page)
// - Add proper card design
// - Add pull-to-refresh
```

---

## RESPONSIVE DESIGN — Must Work on ALL Devices

### CRITICAL: Page Swipe Mode Font Size
```
The mushaf page view MUST auto-adjust font size based on screen width.
DO NOT use fixed fontSize values — use the responsive utility functions.

Device Breakpoints:
- Small Phone (<360px):   fontSize 18, lineHeight 40
- Medium Phone (360-400): fontSize 22, lineHeight 48
- Large Phone (400-500):  fontSize 26, lineHeight 57
- Small Tablet (500-700): fontSize 30, lineHeight 66
- Large Tablet (700+):    fontSize 34, lineHeight 75
```

### Phone Sizes (Primary Target)
```
Small Phone (5"):    mushafFontSize 18, padding 8-10
Medium Phone (6.1"): mushafFontSize 22, padding 10-12
Large Phone (6.7"+): mushafFontSize 26, padding 12-15
```

### Tablet Support
```
Tablet (7-10"): 
- mushafFontSize 30-34
- Two-column layout for settings
- Wider margins for reading (max-width: 700px centered)
- Larger touch targets (48px minimum)
```

### Implementation
```typescript
// File: src/utils/responsive.ts
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_WIDTH = 375; // iPhone 11

export const scaleFont = (size: number): number => {
  const scale = SCREEN_WIDTH / BASE_WIDTH;
  return PixelRatio.roundToNearestPixel(size * scale);
};

export const getMushafFontSize = (): number => {
  if (SCREEN_WIDTH < 360) return 18;
  if (SCREEN_WIDTH < 400) return 22;
  if (SCREEN_WIDTH < 500) return 26;
  if (SCREEN_WIDTH < 700) return 30;
  return 34;
};

export const getMushafLineHeight = (): number => {
  return getMushafFontSize() * 2.2;
};

export const isTablet = (): boolean => {
  return SCREEN_WIDTH >= 768;
};
```

### Key Responsive Rules
```
1. Arabic text: NEVER truncate — always wrap
2. Touch targets: Minimum 44x44px on all devices
3. Header height: 56px phone, 64px tablet
4. Bottom bar: 56px phone, 64px tablet
5. Side margins: 12px phone, 40px tablet (reading view)
6. Mushaf font: Auto-scale based on screen width
7. Translation font: Use scaleFont() utility
```

---

## AUDIO FEATURES — New Requirements

### Audio Player State
```typescript
interface AudioState {
  isPlaying: boolean;
  currentQari: string; // e.g., "Mishary Al-Afasy"
  currentSurah: number;
  currentAyah: number;
  duration: number;
  position: number;
  isDownloading: boolean;
  downloadProgress: number;
}
```

### Audio API
```typescript
// Use react-native-audio-recorder-player for playback
// Features needed:
// 1. Play/Pause toggle
// 2. Seek to position
// 3. Play specific ayah
// 4. Gapless playback (continuous ayahs)
// 5. Background playback
// 6. Lock screen controls
```

### Qari Data Structure
```typescript
interface Qari {
  id: string;
  name: string;
  style: 'gapped' | 'gapless';
  baseUrl: string; // CDN URL for audio files
  isDownloaded: boolean;
}

const QARIS: Qari[] = [
  { id: 'mishary', name: 'Mishary Al-Afasy', style: 'gapped', baseUrl: '...', isDownloaded: false },
  { id: 'mishary_california', name: 'Mishary Al-Afasy (California)', style: 'gapped', baseUrl: '...', isDownloaded: false },
  { id: 'abdulbasit', name: 'Abd Al-Basit', style: 'gapless', baseUrl: '...', isDownloaded: false },
  // ... more qaris
];
```

---

## PERFORMANCE BENCHMARKS TO ACHIEVE

```
FIRST LAUNCH (cold):
1. Splash to interactive: < 10 seconds (downloading data)
2. Surah list visible: < 1 second after splash

SUBSEQUENT LAUNCHES (cached):
3. Cold start to interactive: < 1 second
4. Surah list load: < 200ms
5. Surah open (ANY surah): INSTANT (< 100ms) — from SQLite cache
6. Page swipe: < 50ms
7. Bookmark toggle: < 50ms
8. Search results: < 100ms

AUDIO:
9. Audio start playing: < 500ms
10. Qari modal open: < 200ms

LIMITS:
11. Memory usage: < 150MB
12. Bundle size: < 5MB (excluding assets)
13. SQLite database: < 50MB total
```

**KEY RULE: Opening a surah must NEVER show a loading spinner. If data isn't cached, show skeleton loader for max 500ms.**

---

## IMPLEMENTATION PRIORITY

### Phase 1 — Performance (Do First)
1. Optimize splash screen (lazy loading)
2. Add SQLite indexes
3. Remove unnecessary Redux state
4. Split QuranViewScreen
5. Add React.memo() to all components
6. Add responsive design utilities

### Phase 2 — UI/UX (Match quran.com)
1. Update color scheme (dark theme)
2. Redesign SurahList (quran.com cards)
3. Redesign verse display (clean Arabic)
4. Add proper SVG icons (remove all emojis)
5. Update settings page (full quran.com style)
6. Redesign header (surah name + juz info)

### Phase 3 — Audio Features (New)
1. Add audio player bar (bottom of reading view)
2. Add qari selection modal
3. Implement audio playback (gapped + gapless)
4. Add download manager for audio
5. Add lock screen controls

### Phase 4 — Features (Nice to Have)
1. Add search to SurahList
2. Add Study Mode
3. Add pull-to-refresh
4. Add skeleton loading states
5. Add haptic feedback
6. Add night mode brightness sliders
7. Add translation text size slider

---

## OUTPUT FORMAT

When providing optimized code:
1. Show the COMPLETE file (not partial)
2. Include TypeScript types
3. Add brief comments only for complex logic
4. Show before/after for major changes
5. Include performance notes
6. Test each change mentally for edge cases

---

## CONSTRAINTS

- Keep React Native 0.72.0 compatibility
- Keep Firebase backend (don't switch)
- Keep SQLite local database
- Keep Redux Toolkit (but optimize usage)
- No new major dependencies
- Must work on Android (primary target)
- Support devices with 3GB+ RAM

---

## SPECIFIC UI PATTERNS FROM SCREENSHOTS

### Reading View Header (Screenshot 2 & 3)
```tsx
<View style={styles.header}>
  <TouchableOpacity onPress={goBack}>
    <Icon name="arrow-left" size={24} color="#fff" />
  </TouchableOpacity>
  
  <View style={styles.headerCenter}>
    <Text style={styles.surahName}>Surah Al-Mursalat</Text>
    <Text style={styles.pageInfo}>Page 585, Juz' 29</Text>
  </View>
  
  <View style={styles.headerRight}>
    <TouchableOpacity onPress={toggleBookmark}>
      <Icon name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity onPress={openTranslations}>
      <Icon name="globe" size={22} color="#fff" />
    </TouchableOpacity>
    <TouchableOpacity onPress={openMenu}>
      <Icon name="dots-vertical" size={22} color="#fff" />
    </TouchableOpacity>
  </View>
</View>
```

### Audio Player Bar (Screenshot 3)
```tsx
<View style={styles.audioBar}>
  <TouchableOpacity onPress={togglePlay}>
    <Icon name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
  </TouchableOpacity>
  
  <TouchableOpacity style={styles.qariInfo} onPress={openQariSelector}>
    <Text style={styles.qariName}>Mishary Al-Afasy</Text>
    <Icon name="chevron-up" size={18} color="#aaa" />
  </TouchableOpacity>
  
  <Slider
    style={styles.progress}
    value={position / duration}
    minimumTrackTintColor="#00d4aa"
    thumbTintColor="#00d4aa"
  />
</View>
```

### Settings Page (Screenshot 5 & 6)
```tsx
<ScrollView style={styles.settings}>
  {/* Night Mode Section */}
  <View style={styles.section}>
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Night mode</Text>
        <Text style={styles.settingDesc}>Use dark background and light fonts</Text>
      </View>
      <Switch value={nightMode} onValueChange={setNightMode} />
    </View>
    
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>Text brightness</Text>
      <Slider
        value={textBrightness}
        onValueChange={setTextBrightness}
        minimumValue={0}
        maximumValue={255}
        minimumTrackTintColor="#00d4aa"
        thumbTintColor="#00d4aa"
      />
      <Text style={styles.sliderValue}>{textBrightness}</Text>
    </View>
    
    <View style={styles.sliderRow}>
      <Text style={styles.sliderLabel}>Background brightness</Text>
      <Slider
        value={bgBrightness}
        onValueChange={setBgBrightness}
        minimumValue={0}
        maximumValue={255}
        minimumTrackTintColor="#00d4aa"
        thumbTintColor="#00d4aa"
      />
      <View style={[styles.colorPreview, { backgroundColor: `rgb(${bgBrightness},${bgBrightness},${bgBrightness})` }]} />
    </View>
  </View>
  
  {/* Reading Preferences */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Reading Preferences</Text>
    
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Show page info</Text>
        <Text style={styles.settingDesc}>Overlay page number, surah name, and juz' number while reading</Text>
      </View>
      <Switch value={showPageInfo} onValueChange={setShowPageInfo} />
    </View>
    
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Display marker popups</Text>
        <Text style={styles.settingDesc}>Display popup on reaching juz', hizb, etc.</Text>
      </View>
      <Switch value={showMarkers} onValueChange={setShowMarkers} />
    </View>
  </View>
  
  {/* Download Options */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Download Options</Text>
    
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Streaming</Text>
        <Text style={styles.settingDesc}>Stream audio instead of downloading</Text>
      </View>
      <Switch value={streaming} onValueChange={setStreaming} />
    </View>
    
    <TouchableOpacity style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Download amount</Text>
        <Text style={styles.settingDesc}>Preferred download amount for non-gapless audio</Text>
      </View>
      <Icon name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
    
    <TouchableOpacity style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>Audio Manager</Text>
        <Text style={styles.settingDesc}>Manage and download Quranic audio</Text>
      </View>
      <Icon name="chevron-right" size={20} color="#666" />
    </TouchableOpacity>
  </View>
</ScrollView>
```

### Qari Selector Modal (Screenshot 4)
```tsx
<Modal visible={showQariSelector} animationType="slide">
  <View style={styles.modalContainer}>
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={close}>
        <Icon name="close" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.modalTitle}>Select a Qari</Text>
    </View>
    
    <SectionList
      sections={[
        { title: 'Qaris with Downloads', data: downloadedQaris },
        { title: 'Gapless', data: gaplessQaris }
      ]}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.qariRow} onPress={() => selectQari(item)}>
          <Text style={styles.qariName}>{item.name}</Text>
          {selectedQari?.id === item.id && (
            <Icon name="check" size={22} color="#00d4aa" />
          )}
        </TouchableOpacity>
      )}
    />
  </View>
</Modal>
```

### Settings Styles (Match Screenshots Exactly)
```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 16,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d4aa',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#888',
    width: 120,
  },
  sliderValue: {
    fontSize: 14,
    color: '#00d4aa',
    width: 40,
    textAlign: 'right',
  },
  colorPreview: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginLeft: 12,
  },
});
```

---

## FINAL NOTE

Every line of code must earn its place. If it doesn't directly contribute to the user experience, remove it. The app should feel instant, smooth, and premium — exactly like quran.com.

**Design Principles from Screenshots:**
1. **Clean dark theme** — Deep black (#121212) background
2. **Teal accents** — #00d4aa for highlights and section headers
3. **Proper typography** — Large, readable Arabic text
4. **Minimal UI** — No clutter, focus on content
5. **Consistent spacing** — 16px padding throughout
6. **Subtle borders** — #2a2a2a for dividers
7. **Icon-based actions** — No text labels, just icons

**Performance Principles:**
1. SPEED (instant everything)
2. BEAUTY (clean, elegant design)
3. SIMPLICITY (minimal, focused code)
4. RELIABILITY (no crashes, proper error handling)
5. RESPONSIVE (works on all screen sizes)

