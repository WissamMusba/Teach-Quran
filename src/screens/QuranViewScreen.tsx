/**
 * FILE: src/screens/QuranViewScreen.tsx
 * ROLE: The single reading/editing hub of the app — renders the Quran in one of
 *      three modes ('page' mushaf | 'ayah' | 'continuous'), hosts every student-data
 *      edit path (highlights, bookmarks, notes, voice notes, drawings, lastRead),
 *      audio playback, share/capture, and the surah list; ALL of it funnels into
 *      one debounced SQLite + sync-queue pipeline.
 * DEPENDS ON: Redux slices quran/student/settings/audio/sync/drawing; localDB.ts
 *      (getStudentData, saveStudentData, addToSyncQueue);
 *      quranData.ts (getVersesBySurahPaginated, getVersePage, getMushafPageData,
 *      getVersesByPage, importIndopakPages); components VerseDisplay, FlowingText,
 *      MushafPageView, DrawingCanvas, AnnotationToolbar, StaticDrawingOverlay,
 *      SurahList, AudioPlayerBar, QariSelector, AnimatedHeader, VoiceNoteRecorder;
 *      utils audioPlayback (playSurahFromVerse/pauseSurah/pauseSurahWithResume/
 *      resumeSurah/isResumable/SURAH_VERSE_COUNTS/isSurahPlaying), mushafLayout,
 *      theme, constants; react-native-view-shot + react-native-share.
 * USED BY: App.tsx (Stack.Screen "QuranView", headerShown:false); DashboardScreen.tsx
 *      (navigate no-params); BookmarksScreen / MistakesScreen / NotesScreen
 *      (navigate {surahId, scrollToVerse} deep links).
 */
import React, { useState, useEffect, useCallback, useRef, useMemo, Component } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert, Platform, AppState, Pressable, useWindowDimensions, Switch, InteractionManager } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import { setSurah, toggleTranslation, setFlashingVerse, setReadingMode } from '../store/quranSlice';
import { setToolbarExpanded } from '../store/drawingSlice';
import { addPendingChange } from '../store/syncSlice';
import { setStudentData } from '../store/studentSlice';
import { setPlaying } from '../store/audioSlice';
import { setMushafSplit } from '../store/settingsSlice';
import VerseDisplay from '../components/quran/VerseDisplay';
import FlowingText from '../components/quran/FlowingText';
import DrawingCanvas, { DrawingCanvasHandle } from '../components/drawing/DrawingCanvas';
import AnnotationToolbar from '../components/drawing/AnnotationToolbar';
import StaticDrawingOverlay from '../components/drawing/StaticDrawingOverlay';
import SurahList from '../components/quran/SurahList';
import AudioPlayerBar from '../components/audio/AudioPlayerBar';
import QariSelector from '../components/audio/QariSelector';
import AnimatedHeader from '../components/common/AnimatedHeader';
import MushafPageView, { warmPageLayoutFor } from '../components/quran/MushafPageView';
import { getVersesBySurahPaginated, getVersePage, getMushafPageData, ensureMushafPageData, getVersesByPage } from '../database/quranData';
import { getStudentData, saveStudentData, saveCanvasEdit, canvasKeyForPage, canvasKeyForSurah, getManifest, saveManifestLocal, getChunk, saveChunk, rangeKeyForPage, saveLastPageSeenLocal } from '../database/localDB';
import { uploadAudioNote, registerAudioNote } from '../api/audioNotes';
import storage from '@react-native-firebase/storage';
import { pushDrawings, pullDrawings, pullAudioRange } from '../api/sync';
import { hPadFor } from '../utils/stroke';
import { getJuzInfoFromPage, getStartJuzOfSurah, JUZ_MAP } from '../utils/theme';
import { getFreshnessSnapshot, studentDataIsCurrent, markStudentDataLoaded } from '../hooks/useStudentDataRefresh';
import { MISTAKE_COLOR } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import Svg, { Path } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import VoiceNoteRecorder from '../components/audio/VoiceNoteRecorder';
import { playSurahFromVerse, pauseSurah, pauseSurahWithResume, cancelLoop, resumeSurah, isResumable, SURAH_VERSE_COUNTS, isSurahPlaying, getCurrentPlaybackVerse } from '../utils/audioPlayback';
import { GUTTER, SPLIT_MIN_WIDTH, pairIndexForPage, anchorFromIndex, pagePairsFor } from '../utils/mushafLayout';
const SCREEN_WIDTH = Dimensions.get('window').width;
// Feature 1: session-wide "already pulled on toolbar-expand" set (${sid}/${range|key}).
// Skips the SQLite probe + Firestore read on repeat toolbar expands; cleared on app foreground
// so a second expand after returning re-checks (another device may have pushed meanwhile).
const expandedDrawPullAttempted = new Set<string>();
const IS_TABLET = SCREEN_WIDTH >= 600;
const MENU_BTN_W = Math.min(62, Math.floor((SCREEN_WIDTH - 28) / 6));
const MENU_BUBBLE_W = 6 * MENU_BTN_W + 12;
const MENU_BUBBLE_H = 90;
const MENU_BUBBLE_BG = 'rgba(18,18,20,0.85)';
const MENU_ICON_C = '#CFCFCF';
const MENU_LABEL_C = '#b0b0b0';
/**
 * WHAT: Derives a page's LAST VERSE (surahId, verseNumber) SYNCHRONOUSLY from the mushaf page
 *       JSON (`lines[].words[].location` = "surah:verse:word") — the same data the page already
 *       renders from, so the reading-mark bookmark button can appear in the SAME commit as the
 *       page (single + spread), including pre-rendered pages while swiping. No async verse-cache
 *       lookup, no debounce. Returns null when pageData is missing (caller falls back).
 * CALLS: none. AFFECTS: none (pure).
 */
const pageLastVerseFromPageData = (pd: any) => {
  const lines = pd?.lines;
  if (!lines?.length) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const words = lines[i]?.words;
    if (words?.length) {
      const loc = String(words[words.length - 1]?.location || '').split(':');
      const surahId = parseInt(loc[0], 10);
      const verseNumber = parseInt(loc[1], 10);
      if (surahId > 0 && verseNumber > 0) return { surahId, verseNumber };
    }
  }
  return null;
};
/**
 * WHAT: Memoized split-mode row — renders the two pages of a spread side by side,
 *   each as its own MushafPageView with an independent loading spinner.
 * FLOW: 1) render calls ensurePageLoaded + ensurePageVersesLoaded for both page
 *   numbers (side-effect-in-render, guarded by promise refs) 2) each half renders
 *   MushafPageView once its pageCache JSON arrives.
 * CALLS: ensurePageLoaded / ensurePageVersesLoaded (parent), MushafPageView.
 * CALLED BY: page-mode FlatList renderItem (splitOn=true).
 * AFFECTS: pageCache / pageVersesCache (via the side-effect-in-render loads).
 * NOTES: GOTCHA — side-effect-in-render is impure; safe only because the loader
 *   callbacks are guarded by pagePromiseRef/pageVersesPromiseRef.
 */
const SpreadItem = React.memo(({ pair, winW, pageW, headerVisible, surahNames, pageCache, pageVersesCache, highlights, onWordPress, onBookmarkToggle, onVerseLongPress, onBadgePress, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, ensurePageLoaded, ensurePageVersesLoaded, onSpread, spread, readingMode, isCapturing, pageLastVerseFor, readingMarkActiveFor, onReadingMarkToggle, onMeasured }: any) => {
  const even = pair?.[0];
  const odd = pair?.[1];
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  if (even) { ensurePageLoaded(even); ensurePageVersesLoaded(even); }
  if (odd) { ensurePageLoaded(odd); ensurePageVersesLoaded(odd); }
  // Reading-mark ribbon is per-page: derived synchronously from each half's own pageData, so the
  // button renders in the same commit as its page (including pre-rendered pages while swiping).
  const oddLast = pageLastVerseFor?.(odd);
  const evenLast = pageLastVerseFor?.(even);
  const oddMarkActive = readingMarkActiveFor?.(oddLast);
  const evenMarkActive = readingMarkActiveFor?.(evenLast);
  // Spread margins: consistent with the single-page wrapper — horizontal 10 (tablet) / 6 (phone),
  // top 24 / bottom band 28px (bottom pills offset -26 — fully below the frame band, ~2px above
  // the audio bar/screen edge) — no dead space.
  const spreadMargin = { marginTop: 24, marginBottom: 28 };
  return (
    <View style={{ width: winW, flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ width: pageW, flex: 1, overflow: 'hidden' }}>
        <View style={[{ flex: 1, marginHorizontal: winW >= 600 ? 10 : 6 }, spreadMargin]}>
          {odd ? (
            pageCache[odd] ? (
              <MushafPageView pageNum={odd} pageWidth={pageW} headerVisible={headerVisible} surahNames={surahNames} versesForPage={pageVersesCache[odd] || []} pageData={pageCache[odd]} highlights={highlights}
                onWordPress={onWordPress} onBookmarkToggle={onBookmarkToggle} onVerseLongPress={onVerseLongPress} onBadgePress={onBadgePress} bookmarks={bookmarks}
                flashingVerseKey={flashingVerseKey} notes={notes} readingMarkVerse={readingMarkVerse} onDeadTap={onDeadTap} onSpread={onSpread} spread={spread}
                showReadingMarkBtn={readingMode === 'page' && !isCapturing && !!oddLast} readingMarkActive={oddMarkActive} onReadingMarkToggle={() => onReadingMarkToggle(oddLast)}
                onMeasured={onMeasured} />
            ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={(nightMode ? '#7BA7DB' : '#1C3D72')} /></View>)
          ) : null}
        </View>
      </View>
      <View style={{ width: pageW, flex: 1, overflow: 'hidden' }}>
        <View style={[{ flex: 1, marginHorizontal: winW >= 600 ? 10 : 6 }, spreadMargin]}>
          {pageCache[even] ? (
            <MushafPageView pageNum={even} pageWidth={pageW} headerVisible={headerVisible} surahNames={surahNames} versesForPage={pageVersesCache[even] || []} pageData={pageCache[even]} highlights={highlights}
              onWordPress={onWordPress} onBookmarkToggle={onBookmarkToggle} onVerseLongPress={onVerseLongPress} onBadgePress={onBadgePress} bookmarks={bookmarks}
              flashingVerseKey={flashingVerseKey} notes={notes} readingMarkVerse={readingMarkVerse} onDeadTap={onDeadTap} onSpread={onSpread} spread={spread}
              showReadingMarkBtn={readingMode === 'page' && !isCapturing && !!evenLast} readingMarkActive={evenMarkActive} onReadingMarkToggle={() => onReadingMarkToggle(evenLast)}
              onMeasured={onMeasured} />
          ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={(nightMode ? '#7BA7DB' : '#1C3D72')} /></View>)}
        </View>
      </View>
    </View>
  );
});

/**
 * P1-D — single-page cell: the memoized counterpart of SpreadItem (which renders
 *   MushafPageView twice for split mode). Page loads run from a MOUNT effect, never
 *   the render body — the previous inline renderItem fired ensurePageLoaded /
 *   ensurePageVersesLoaded on every parent re-render (every cache fill and audio
 *   tick re-rendered the visible cells and re-issued guarded-but-redundant loads).
 *   All callbacks arrive already stable (useCallback in the parent), so idle
 *   re-renders of the screen skip the cell's render tree entirely; item-specific
 *   closures live INSIDE the cell so their identity never leaks into the memo
 *   comparison. MushafPageView is itself memoized (export default memo) — a cache
 *   fill of a NEIGHBOUR page re-renders this wrapper only, not the mushaf tree.
 * CALLS: ensurePageLoaded / ensurePageVersesLoaded (mount effect), MushafPageView.
 * CALLED BY: page-mode FlatList renderItem (splitOn=false).
 */
const PageCell = React.memo(({ item, winW, headerVisible, surahNames, pageCache, pageVersesCache, highlights, onWordPress, onBookmarkToggle, onVerseLongPress, onBadgePress, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, onSpread, spread, readingMode, isCapturing, pageLastVerseFor, readingMarkActiveFor, onReadingMarkToggle, onMeasured, ensurePageLoaded, ensurePageVersesLoaded, nightMode }: any) => {
  useEffect(() => {
    // Guarded loads: a cache-fill re-render re-runs this effect but not the loads.
    if (!pageCache[item]) ensurePageLoaded(item);
    if (!pageVersesCache[item]) ensurePageVersesLoaded(item);
  }, [item, pageCache, pageVersesCache, ensurePageLoaded, ensurePageVersesLoaded]);
  const pData = pageCache[item];
  const last = pageLastVerseFor?.(item);
  return (
    <View style={{ width: winW, flex: 1, overflow: 'hidden' }}>
      {/* bottom band 28px, bottom pills offset -26 (fully below the frame band, ~2px above the audio bar/screen edge), no dead space */}
      <View style={{ flex: 1, marginHorizontal: winW >= 600 ? 10 : 6, marginTop: 24, marginBottom: 28 }}>
      {pData ? (
        <MushafPageView headerVisible={headerVisible} pageNum={item} surahNames={surahNames} versesForPage={pageVersesCache[item] || []} pageData={pData} highlights={highlights} onWordPress={onWordPress}
          onBookmarkToggle={onBookmarkToggle} onVerseLongPress={onVerseLongPress} onBadgePress={onBadgePress} bookmarks={bookmarks}
          flashingVerseKey={flashingVerseKey} notes={notes} readingMarkVerse={readingMarkVerse} onDeadTap={onDeadTap}
          onSpread={onSpread} spread={spread}
          showReadingMarkBtn={readingMode === 'page' && !isCapturing && !!last} readingMarkActive={readingMarkActiveFor(last)} onReadingMarkToggle={() => onReadingMarkToggle(last)}
          onMeasured={onMeasured} />
      ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={(nightMode ? '#7BA7DB' : '#1C3D72')} /></View>)}
      </View>
    </View>
  );
});

/**
 * WHAT: The Quran reading/editing hub screen. Renders one of three reading modes,
 *   hosts the full student-data edit pipeline, audio playback, share capture and
 *   the surah picker.
 * FLOW: mode from s.quran.readingMode; data via LRU page caches (page mode) or
 *   loadSurah 20-verse paging (ayah/continuous); edits -> updateData ->
 *   400ms debounce -> flushPendingSave -> SQLite + sync queue.
 * CALLS: quranData / localDB / audioPlayback utils; VerseDisplay / FlowingText /
 *   MushafPageView / DrawingCanvas / AnnotationToolbar / SurahList /
 *   AudioPlayerBar / QariSelector / AnimatedHeader / VoiceNoteRecorder.
 * CALLED BY: App.tsx navigation; DashboardScreen / BookmarksScreen /
 *   MistakesScreen / NotesScreen.
 * AFFECTS: s.quran (currentSurahId/verses/flashingVerse/readingMode),
 *   s.student.studentData, s.audio.isPlaying, s.sync.pendingChanges,
 *   s.settings.mushafSplit; student_data_cache + sync_queue rows.
 * NOTES: Header state restored for drawing via headerVisibleBeforeDrawRef;
 *   deep-link handling in a route.params effect below.
 */
export default function QuranViewScreen({ navigation, route }: any) {
  const dispatch = useDispatch();
  // ---- local state: drawing canvas, modals, header, pagination, page caches ----
  const [isDrawing, setIsDrawing] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searchMode, setSearchMode] = useState<'surah' | 'page' | 'juz'>('surah');
  const [showQariModal, setShowQariModal] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [pageCache, setPageCache] = useState<any>({});
  const [headerSurahId, setHeaderSurahId] = useState(1);
  const [headerPage, setHeaderPage] = useState(0);
  const [menuVerse, setMenuVerse] = useState<number | null>(null);
  const [noteVerseKey, setNoteVerseKey] = useState<number | null>(null);
  const [menuY, setMenuY] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [recordingVerseKey, setRecordingVerseKey] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  // Share menu: which annotation layers the captured image includes (default all ON).
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareDrawings, setShareDrawings] = useState(true);
  const [shareMistakes, setShareMistakes] = useState(true);
  const [shareBookmarks, setShareBookmarks] = useState(true);
  const [drawingGestureActive, setDrawingGestureActive] = useState(false);
  const [flashingSurah, setFlashingSurah] = useState(0);
  // Measured rendered height of the in-flow AudioPlayerBar (0 while absent) — the header-toggle
  // pill anchors to the margin band above the bar, so it must never land on the bar's controls.
  const [playerBarH, setPlayerBarH] = useState(0);
  const flatListRef = useRef<any>(null);
  // P0-A — the page-mode FlatList gets its own ref so landOnPage can scroll the MOMENT it is
  // invoked without ambiguity about which list is mounted (the ayah list shares flatListRef).
  const pageFlatListRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  
  const [canvasData, setCanvasData] = useState<any>({ highlights: {}, notes: {}, drawings: {} });
  const deepLinkLoadedRef = useRef(false);
  const pagePromiseRef = useRef({});
  const [pageVersesCache, setPageVersesCache] = useState<any>({});
  const pageVersesPromiseRef = useRef({});
  const audioPlayer = useRef(new AudioRecorderPlayer());
  const headerVisibleBeforeDrawRef = useRef(true);
  const pageScrollSurahChangeRef = useRef(false);
  const viewShotRef = useRef<any>(null);
  const canvasRef = useRef<DrawingCanvasHandle>(null);
  const [canvasUndoState, setCanvasUndoState] = useState({ canUndo: false, canRedo: false });
  const pageCacheOrderRef = useRef<number[]>([]);
  const pageVersesOrderRef = useRef<number[]>([]);
  const currentPageNumRef = useRef(currentPageNum);
  // Timestamp of the last PROGRAMMATIC FlatList scroll (scrollToIndex/scrollToOffset)
  // — onMomentumScrollEnd ignores momentum for 400ms after one, so the stale settle
  // from a landing jump can't report an old index and yank the reader back.
  const programmaticScrollRef = useRef(0);

  // Live mirror of drawingGestureActive (re-written every render) so the
  // fire-and-forget cloud-restore helper can check the CURRENT gesture state
  // when its async pull lands — a stale closure value would merge over an
  // in-flight stroke.
  const drawingGestureActiveRef = useRef(false);
  drawingGestureActiveRef.current = drawingGestureActive;
  // One-shot stamp for the canvas-open restore: `${studentId}/${rangeKey}` so
  // each canvas open pulls cloud drawings at most once.
  const canvasRestoreRef = useRef<string | null>(null);
  // Feature 1: toolbar-expand pre-fetch — 200ms debounce timer (cancel on collapse/unmount).
  const toolbarExpanded = useSelector((s: any) => s.drawing.toolbarExpanded);
  const expandPullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Redux subscriptions ----
  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse, surahNames, textStyle } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  // Live student-id ref (re-written every render) so first-render closures — notably the
  // []-deps AppState listener and its captured flushPendingSave — never flush under the
  // wrong student after a student switch.
  const currentStudentIdRef = useRef(currentStudent?.id);
  currentStudentIdRef.current = currentStudent?.id;
  const { nightMode, bgBrightness, playBasmala } = useSelector((s: any) => s.settings);
  const { isPlaying, currentQari, loop: loopSettings } = useSelector((s: any) => s.audio);
  const safeLoop = loopSettings || {};
  const syncStatus = useSelector((s: any) => s.sync.status);
  const prevSyncStatusRef = useRef(syncStatus);
  // P2-H — runAfterInteractions handle for the post-sync refresh below (cancelled in the
  // effect's cleanup so a re-run/mode-switch never fires the previous refresh's work).
  let syncRefreshHandle: { cancel: () => void } | null = null;
  const bgColor = nightMode ? '#121212' : '#FFFFFF';
  const indopakFonts = ['saleem', 'indopak', 'alqalam', 'lateef', 'harmattan'];
  const isIndopak = indopakFonts.includes(textStyle);
  // ---- derived: page count (610 indopak vs 604), split-mode geometry ----
  const pageNumbers = useMemo(() => Array.from({ length: isIndopak ? 610 : 604 }, (_, i) => i + 1), [isIndopak]);
  const { width: winW, height: winH } = useWindowDimensions();
  const splitOn = !!(useSelector((s: any) => s.settings)?.mushafSplit && winW >= SPLIT_MIN_WIDTH);
  const splitCapable = winW >= SPLIT_MIN_WIDTH;
  const pageW = Math.round((winW - GUTTER) / 2);

  // ---- header info (surah name/number/juz/page/pages-left) ----
  const headerInfo = useMemo(() => {
    const sid = headerSurahId || currentSurahId;
    const name = surahNames?.[sid] || `Surah ${sid}`;
    if (readingMode === 'page' && headerPage > 0) {
      const info = getJuzInfoFromPage(headerPage);
      return { surahName: name, surahId: sid, juz: info.juz, page: headerPage, pagesLeftInJuz: info.pagesLeft };
    }
    return { surahName: name, surahId: sid, juz: getStartJuzOfSurah(sid), page: 0, pagesLeftInJuz: 0 };
  }, [headerSurahId, headerPage, currentSurahId, surahNames, readingMode]);

  /**
   * WHAT: Loads a mushaf page JSON into pageCache once (from mushaf_pages or
   *   mushaf_pages_indopak via getMushafPageData), with a ~64-page LRU. Resolves
   *   with the page data (or null when unloadable) so landing paths can await
   *   the SAME load they trigger and warm the layout before scrolling.
   * FLOW: 1) cached -> resolve immediately (Promise.resolve) 2) in-flight ->
   *   await the SAME stored promise (pagePromiseRef holds the promise, not true)
   *   3) else kick the load, store its promise; isIndopak lazily seeds via
   *   importIndopakPages() first 4) getMushapPageData(pageNum,
   *   textStyleRef.current) 5) empty-lines miss -> ensureMushafPageData fetch
   *   (resolve with it when found, null on failure) 6) setPageCache + LRU:
   *   append to order ref, evict pages >24 away from currentPageNumRef while
   *   len>64 7) delete the promise entry on settle (resolve or reject).
   * CALLS: getMushafPageData, ensureMushafPageData, importIndopakPages (quranData.ts).
   * CALLED BY: renderItem of the page FlatList (single) / SpreadItem (split) —
   *   fire-and-forget, the returned promise is ignored — prefetchAround,
   *   prefetchPartner, handleSelectPage, deep-link + surah-change + lastRead
   *   effects, landOnPage (awaited; single-flight via the stored promise).
   * AFFECTS: pageCache (local state).
   * NOTES: Uses the LIVE textStyleRef so a mid-flight font change doesn't cache
   *   the wrong mushaf under the new key — pages loaded under an old style stay
   *   cached until the textStyle reset effect wipes both caches.
   */
  const ensurePageLoaded = useCallback(async (pageNum: number): Promise<any> => {
    if (pageCache[pageNum]) return Promise.resolve(pageCache[pageNum]);
    if (pagePromiseRef.current[pageNum]) return pagePromiseRef.current[pageNum];
    const promise = (async () => {
      const data = await getMushafPageData(pageNum, textStyleRef.current);
      // Fresh installs fill mushaf pages sequentially from page 1, so a far page
      // (deep-link to Waaqia) can be a { lines: [] } miss — fetch it on demand
      // instead of rendering an empty page (or a permanent hole from a failed
      // background chunk). indopak pages are bulk-seeded by importIndopakPages.
      if (!data?.lines || data.lines.length === 0) {
        const missing = await ensureMushafPageData(pageNum, textStyleRef.current).catch(() => null);
        if (missing) {
          setPageCache(prev => {
            const next = { ...prev, [pageNum]: missing };
            const order = pageCacheOrderRef.current.filter((k: number) => k !== pageNum && k in prev);
            order.push(pageNum);
            pageCacheOrderRef.current = order;
            return next;
          });
        }
        return missing;
      }
      setPageCache(prev => {
        const next = { ...prev, [pageNum]: data };
        const order = pageCacheOrderRef.current.filter((k: number) => k !== pageNum && k in prev);
        order.push(pageNum);
        const cp = currentPageNumRef.current;
        while (order.length > 64) {
          const idx = order.findIndex((k: number) => Math.abs(k - cp) > 24);
          if (idx === -1) break;
          delete next[order[idx]];
          order.splice(idx, 1);
        }
        pageCacheOrderRef.current = order;
        return next;
      });
      return data;
    })().finally(() => { delete pagePromiseRef.current[pageNum]; });
    pagePromiseRef.current[pageNum] = promise;
    return promise;
  }, [pageCache, isIndopak]);

  /**
   * WHAT: Loads the verses belonging to a page into pageVersesCache — used to
   *   map word->verse and to find the surah of a page verse (startPlayFromVerse,
   *   handleCopyVerse, page bookmark button).
   * FLOW: same guard/promise/LRU pattern as ensurePageLoaded; SQL via
   *   getVersesByPage(pageNum, textStyleRef.current) which selects the Arabic
   *   column matching the style.
   * CALLS: getVersesByPage (quranData.ts).
   * CALLED BY: renderItem / SpreadItem, prefetchAround, prefetchPartner,
   *   handleSelectPage, deep-link + surah-change + lastRead effects.
   * AFFECTS: pageVersesCache (local state); verses table (read).
   * NOTES: Its own order ref + 40-cap LRU — separate from pageCache.
   */
  const ensurePageVersesLoaded = useCallback((pageNum: number) => {
    if (pageVersesCache[pageNum] || pageVersesPromiseRef.current[pageNum]) return;
    pageVersesPromiseRef.current[pageNum] = true;
    getVersesByPage(pageNum, textStyleRef.current).then(verses => {
      setPageVersesCache(prev => {
        const next = { ...prev, [pageNum]: verses };
        const order = pageVersesOrderRef.current.filter((k: number) => k !== pageNum && k in prev);
        order.push(pageNum);
        const cp = currentPageNumRef.current;
        while (order.length > 64) {
          const idx = order.findIndex((k: number) => Math.abs(k - cp) > 24);
          if (idx === -1) break;
          delete next[order[idx]];
          order.splice(idx, 1);
        }
        pageVersesOrderRef.current = order;
        return next;
      });
      delete pageVersesPromiseRef.current[pageNum];
    }).catch(() => { delete pageVersesPromiseRef.current[pageNum]; });
  }, [pageVersesCache]);

  /**
   * WHAT: PRIORITIZED sliding-window warm-ahead for FAST swiping — the window
   *   is 10 back / 12 ahead, drained by ONE 3-per-80ms queue so no settle ever
   *   queues a synchronous wall of background DB work behind the frame: TIER 0
   *   loads data+verses for [c-1, c+1] (only) in this synchronous effect run;
   *   TIER 1 (drain queue, 3 pages per 80ms tick) covers [c-5, c-2] first, then
   *   [c+2, c+7], then [c-10, c-6], then [c+8, c+12]. LAYOUT WARM rides the same
   *   queue (memoized getMushafPageData -> warmPageLayoutFor, DB-only) and skips
   *   pages the hidden worker already measured (warmedPagesRef key scheme).
   * CALLS: ensurePageLoaded/ensurePageVersesLoaded, getMushafPageData /
   *   getVersesByPage (memoized — far pages never trigger ensureMushafPageData),
   *   warmPageLayoutFor. All loads single-flight via the promise guards inside
   *   the ensure* functions; warmLayoutByPage + layoutWarmByPageRef dedupe per
   *   page (the ref across settles, so 2-5-2 patterns never re-query warmed rows).
   * AFFECTS: pageCache/pageVersesCache (state, window only); quranData memos +
   *   layoutCacheMem (window).
   * NOTES: Every timer created here is cleared on re-run/unmount.
   */
  const layoutTimerRef = useRef<any>(0);
  const layoutQueueRef = useRef<number[]>([]);
  // P0-B / touch-pause — while the user is touching the screen the warm drain queue yields: the
  // JS thread must stay free for the press/navigation event, otherwise toolbar buttons queue
  // behind the 3-per-80ms drain ticks for ~1-2s after a page turn. Set/cleared by onTouchStart/
  // onTouchEnd/onTouchCancel on the root container below.
  const drainPausedRef = useRef(false);
  // v79 — the pause outlives the finger: releasing via a ~500ms cooldown timer keeps the warm
  // drain + hidden worker quiet right after a tap, so the tap's follow-up JS (navigation mount,
  // screen render, highlight re-render) never competes with background warm work.
  const userBusyReleaseTimerRef = useRef<any>(null);
  // P0-B — cross-settle dedupe for the layout-warm pass: a fast settle re-fire
  // (2-5-2 swipe patterns) must never re-query layout rows it already warmed.
  const layoutWarmByPageRef = useRef<Set<string>>(new Set());
  // Swipe-settle debounce (FIX 8): onMomentumScrollEnd updates currentPageNum immediately so
  // rendering keeps up with the flick, but the HEAVY per-page effects (prefetch window, canvas
  // drawing refresh, lastRead flush) only act once the page survives 120ms without another
  // momentum settle — a fast fling past N pages runs them ONCE for the final page, not N times.
  const [settledPage, setSettledPage] = useState(1);
  const settleTimerRef = useRef<any>(null);
  // v76.2 — last LIVE scroll offset of the page FlatList (updated by its onScroll handler,
  // scrollEventThrottle=16). Used to self-validate onMomentumScrollEnd: the inverted list can
  // rarely fire momentum-end with a stale/zero offset after a fast fling, which used to make
  // the reader "randomly go to Al-Fatiha" (stale ~0 offset → page 1 → setSurah(Al-Fatiha)).
  const lastScrollOffsetRef = useRef<number | null>(null);

  // ---- v76 background hidden pre-measure worker ----
  // ONE hidden MushafPageView (off-screen, hideFrame — never touches the shared frame cache)
  // measures un-warmed pages nearest-first from the current page, so every page's layout row is
  // in SQLite BEFORE the user swipes to it (instant cache-hit render on arrival, exactly the v62
  // feel once warm). Strictly ONE page at a time with a 150ms breather, paused while scrolling /
  // drawing / capturing / app backgrounded / screen blurred — the v74 flood (~25 concurrent
  // hidden pages) is gone, so buttons and navigation stay instant.
  // warmedPagesRef keys: `${textStyle}|${headerVisible}|${keyW}|${pageNum}` — a page counts as
  // warmed per the DB layout key's variable parts (font style, header visibility, width), so a
  // font / header / split-width change re-measures cleanly instead of being treated warm.
  const [hiddenWarmPage, setHiddenWarmPage] = useState<number | null>(null);
  const hiddenBusyRef = useRef(false);
  const warmedPagesRef = useRef<Set<string>>(new Set());
  const hiddenScrollingRef = useRef(false);
  const hiddenPauseTimerRef = useRef<any>(null);
  const hiddenSafetyTimerRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const hiddenFocus = useIsFocused();
  const hiddenTickRef = useRef<() => void>(() => {});
  const hiddenTick = useCallback(() => {
    if (hiddenBusyRef.current || hiddenPauseTimerRef.current) return;
    if (drainPausedRef.current) return; // v79 — yield during taps + the post-tap cooldown
    if (!hiddenFocus || appStateRef.current !== 'active') return;
    if (isDrawing || isCapturing || drawingGestureActive || hiddenScrollingRef.current) return;
    // P0-C — the worker is invisible work: it must never share a frame with an open modal,
    // an interaction still settling, or the reader's own swipe path.
    if (showList || menuVerse !== null || showNoteModal || showShareMenu) return;
    if (Date.now() < hiddenGraceUntilRef.current) return;
    if (readingMode !== 'page' || settledPage !== currentPageNum) return;
    // Nearest-first, ahead-biased, over a ±25 PAGE RADIUS of the current page (P0-C — mirrors
    // the pageCache/pageVersesCache LRU eviction radius): the near window (±12/±10) comes
    // first — those pages already have their JSON via the prefetch window, so the hidden slot
    // renders the moment it mounts — then the worker crawls the rest of the radius (still ONE
    // at a time, 150ms breather) so every page the reader can actually reach is a layout hit.
    const c = currentPageNum;
    const SWEEP_RADIUS = 25;
    const keyW = Math.round(splitOn ? pageW : winW);
    // Warmed-key mirrors the DB layout key's variable parts (textStyle, width) — the layout row
    // is header-independent (MushafPageView normalizes it), so a header toggle must NOT
    // invalidate the warm radius and re-measure already-measured pages (was the toggle-jank).
    const warmKey = (p: number) => `${textStyle}|${keyW}|${p}`;
    let next: number | undefined;
    for (let d = 1; d <= SWEEP_RADIUS && next === undefined; d++) {
      const ahead = c + d;
      if (ahead <= pageNumbers.length && !warmedPagesRef.current.has(warmKey(ahead))) next = ahead;
      if (next === undefined) {
        const behind = c - d;
        if (behind >= 1 && !warmedPagesRef.current.has(warmKey(behind))) next = behind;
      }
    }
    if (next === undefined) return; // every page in the ±25 radius is measured — worker idles
    // Far pages beyond the prefetch window have no JSON yet: pull the data now (bundle-backed,
    // a few ms — it can't contend with the visible page). When it lands, pageCache changes and
    // the re-evaluate effect re-runs this tick to mount the hidden slot.
    if (!pageCache[next]?.lines?.length) {
      ensurePageLoaded(next);
      return;
    }
    hiddenBusyRef.current = true;
    setHiddenWarmPage(next);
    if (hiddenSafetyTimerRef.current) clearTimeout(hiddenSafetyTimerRef.current);
    hiddenSafetyTimerRef.current = setTimeout(() => {
      // Stall guard: if the hidden page never reports measured (page changed / data lost),
      // release the slot and move on instead of deadlocking the worker.
      if (hiddenBusyRef.current) {
        hiddenBusyRef.current = false;
        setHiddenWarmPage(null);
        warmedPagesRef.current.add(`${textStyle}|${keyW}|${next}`);
        hiddenPauseTimerRef.current = setTimeout(() => {
          hiddenPauseTimerRef.current = null;
          hiddenTickRef.current();
        }, 200);
      }
    }, 8000);
  }, [hiddenFocus, isDrawing, isCapturing, drawingGestureActive, readingMode, settledPage, currentPageNum, pageNumbers.length, splitOn, pageW, winW, textStyle, isHeaderVisible, pageCache, ensurePageLoaded, showList, menuVerse, showNoteModal, showShareMenu]);
  hiddenTickRef.current = hiddenTick;

  // P0-C — 1.5s interaction grace: after every settle / modal open / surface change the worker
  // stands down so the reader's own frame work (scroll snap, layout warm tiers, canvas refresh)
  // always wins the JS thread; the worker only crawls during genuine idle.
  const hiddenGraceUntilRef = useRef<number>(0);
  useEffect(() => {
    hiddenGraceUntilRef.current = Date.now() + 1500;
  }, [settledPage, currentPageNum, showList, menuVerse, showNoteModal, showShareMenu]);

  const handleHiddenMeasured = useCallback((pg: number) => {
    const keyW = Math.round(splitOn ? pageW : winW);
    warmedPagesRef.current.add(`${textStyle}|${keyW}|${pg}`);
    if (hiddenSafetyTimerRef.current) { clearTimeout(hiddenSafetyTimerRef.current); hiddenSafetyTimerRef.current = null; }
    if (pg === hiddenWarmPage) {
      hiddenBusyRef.current = false;
      setHiddenWarmPage(null);
    }
    // Breather between hidden pages — keeps the JS thread free for taps/buttons.
    hiddenPauseTimerRef.current = setTimeout(() => {
      hiddenPauseTimerRef.current = null;
      hiddenTickRef.current();
    }, 150);
  }, [hiddenWarmPage, splitOn, pageW, textStyle, isHeaderVisible]);

  // Visible-page counterpart: pages measured on-screen (single or spread) also count as warmed,
  // so the hidden worker never re-measures what the user has already seen.
  const handleVisibleMeasured = useCallback((pg: number) => {
    const keyW = Math.round(splitOn ? pageW : winW);
    warmedPagesRef.current.add(`${textStyle}|${keyW}|${pg}`);
  }, [splitOn, pageW, textStyle, isHeaderVisible]);

  // Re-evaluate the worker whenever the reading state settles or a page's data arrives.
  useEffect(() => {
    const t = setTimeout(() => hiddenTickRef.current(), 250);
    return () => clearTimeout(t);
  }, [currentPageNum, settledPage, pageCache, hiddenWarmPage, isDrawing, isCapturing, drawingGestureActive, hiddenFocus, readingMode, isHeaderVisible]);

  // Live app-state ref (separate from the []-deps flush listener below) — the worker must pause
  // while the app is backgrounded so it never burns CPU behind the lock screen, and must resume
  // the moment the app returns to the foreground (otherwise it could stall after backgrounding).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: any) => {
      appStateRef.current = s;
      if (s === 'active') hiddenTickRef.current();
    });
    return () => sub.remove();
  }, []);

  // Cleanup on unmount: cancel pending timers.
  useEffect(() => () => {
    if (hiddenPauseTimerRef.current) clearTimeout(hiddenPauseTimerRef.current);
    if (hiddenSafetyTimerRef.current) clearTimeout(hiddenSafetyTimerRef.current);
    if (userBusyReleaseTimerRef.current) clearTimeout(userBusyReleaseTimerRef.current);
  }, []);
  useEffect(() => {
    if (readingMode !== 'page' || currentPageNum < 1 || !pageNumbers.length) return;
    // v79 — when the reader is NOT focused (user is on Mistakes/Notes/Bookmarks/Settings/etc. the
    // reader stays mounted underneath the pushed screen) the warm drain must stop ENTIRELY: its
    // state updates re-render the whole reader behind the pushed screen and starve it of frames.
    if (!hiddenFocus) return;
    // FIX 8 — ignore intermediate momentum pages: only warm the window for the page that
    // survives 120ms after the last swipe settle.
    if (settledPage !== currentPageNum) return;
    const clampP = (p: number) => Math.max(1, Math.min(p, pageNumbers.length));
    const loadPage = (p: number) => {
      ensurePageLoaded(p);
      ensurePageVersesLoaded(p);
    };
    const keyW = Math.round(splitOn ? pageW : winW);
    // Same key scheme as the hidden worker's warmedPagesRef (textStyle|header|width|page),
    // so pages it already measured are skipped here — their layout row is already in SQLite.
    const warmKey = (p: number) => `${textStyle}|${keyW}|${p}`;
    const warmLayoutByPage = new Set<number>();
    const warmLayout = (p: number) => {
      if (warmLayoutByPage.has(p) || layoutWarmByPageRef.current.has(warmKey(p)) || warmedPagesRef.current.has(warmKey(p))) return;
      warmLayoutByPage.add(p);
      layoutWarmByPageRef.current.add(warmKey(p));
      getMushafPageData(p, textStyleRef.current).then(pd => {
        if (pd?.lines?.length) warmPageLayoutFor(p, pd, textStyleRef.current, Math.round(pageW));
      }).catch(() => {});
    };
    // P0-B — ONE 3-per-80ms drain queue for every off-screen page. A settle used to queue
    // 27 synchronous loads + 21 layout queries in three bursts on the JS thread; now only
    // the visible page + its immediate neighbours (TIER 0) run this tick, everything else
    // drips 3 pages per tick — 10 ahead / 5 behind are cached within ~1.5s, no wall.
    const layoutStep = () => {
      clearTimeout(layoutTimerRef.current);
      // Touch-pause: a finger is down (or inside the post-tap cooldown) — skip this tick and
      // re-arm; the tap's own JS event (press-in, navigation) runs instead of queuing behind
      // drain work.
      if (drainPausedRef.current) {
        if (layoutQueueRef.current.length) layoutTimerRef.current = setTimeout(layoutStep, 120);
        return;
      }
      const batch = layoutQueueRef.current.splice(0, 2);
      for (const p of batch) { loadPage(p); warmLayout(p); }
      if (layoutQueueRef.current.length) layoutTimerRef.current = setTimeout(layoutStep, 120);
    };
    // TIER 1 — nearest-first drain: 5-behind arm, 7-ahead arm, far-behind, far-ahead.
    const queue: number[] = [];
    // TIER 0 — the visible page + its immediate neighbours, this tick only. While a touch is
    // down they are deferred into the drain queue (their position in the queue is kept by
    // unshifting so they still go first once the finger lifts).
    const tier0Pages = [clampP(currentPageNum - 1), clampP(currentPageNum), clampP(currentPageNum + 1)];
    if (drainPausedRef.current) {
      for (let i = tier0Pages.length - 1; i >= 0; i--) queue.unshift(tier0Pages[i]);
    } else {
      loadPage(clampP(currentPageNum));
      for (const q of tier0Pages) { loadPage(q); warmLayout(q); }
    }
    for (let p = currentPageNum - 5; p <= currentPageNum - 2; p++) queue.push(clampP(p));
    for (let p = currentPageNum + 2; p <= currentPageNum + 7; p++) queue.push(clampP(p));
    for (let p = currentPageNum - 10; p <= currentPageNum - 6; p++) queue.push(clampP(p));
    for (let p = currentPageNum + 8; p <= currentPageNum + 12; p++) queue.push(clampP(p));
    layoutQueueRef.current = queue;
    if (layoutQueueRef.current.length) layoutTimerRef.current = setTimeout(layoutStep, 120);
    return () => {
      clearTimeout(layoutTimerRef.current);
      layoutQueueRef.current = [];
    };
  }, [currentPageNum, readingMode, pageNumbers.length, pageW, settledPage, splitOn, winW, isHeaderVisible, textStyle, hiddenFocus]);

  /**
   * WHAT: Landing-path scroll — scrolls the page FlatList to the target page
   *   IMMEDIATELY (getItemLayout makes scrollToIndex synchronous; pair index in
   *   split mode), then loads the page data behind the render: the FIX 4 skeleton
   *   shows for the moment until data lands, never a wait. Stamps
   *   programmaticScrollRef so the momentum settle from this jump is ignored by
   *   onMomentumScrollEnd.
   * FLOW: stamp -> settle -> prefetch neighbours -> scrollToIndex (P0-A: no
   *   Promise.race gate; the page list may be unmounted on a mode-switch arrival,
   *   so re-scroll once it is live) -> ensurePageLoaded -> if the reader is still
   *   on pg, warmPageLayoutFor for an instant layout-cache hit on render.
   * CALLS: ensurePageLoaded, warmPageLayoutFor, pageFlatListRef.scrollToIndex.
   * CALLED BY: handleSelectPage, deep-link effect, surah-change effect.
   * AFFECTS: FlatList scroll offset; layoutCacheMem (via warmPageLayoutFor);
   *   programmaticScrollRef stamp.
   * NOTES: Must live AFTER ensurePageLoaded (its deps array references the const).
   *   The currentPageNumRef stale-guard keeps a fast swipe/surah change mid-flight
   *   from yanking the reader back to pg.
   */
  const landOnPage = useCallback(async (pg: number) => {
    if (pg < 1 || pg > pageNumbers.length) return;
    programmaticScrollRef.current = Date.now();
    // FIX 8 — a programmatic landing settles immediately (no 120ms swipe debounce).
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    setSettledPage(pg);
    // FIX 6c — prefetch the neighbours so the pages either side of the target are ready the
    // moment the user swipes after landing.
    if (pg > 1) ensurePageLoaded(pg - 1);
    if (pg < pageNumbers.length) ensurePageLoaded(pg + 1);
    if (splitOn) prefetchPartner(pg);
    // P0-A — scroll FIRST, wait NEVER: getItemLayout makes scrollToIndex synchronous, so the
    // target slides into view on this frame while its data loads behind the FIX 4 skeleton.
    // Only the PAGE list scrolls here; in ayah/continuous modes it is unmounted, so a
    // mode-switch arrival re-scrolls below once the list is live.
    let scrolled = false;
    if (pageFlatListRef.current) {
      pageFlatListRef.current.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false });
      scrolled = true;
    }
    const data = await ensurePageLoaded(pg);
    // Mode-switch landing (deep link / SurahList from ayah|continuous): the page list mounts
    // after the readingMode dispatch — scroll the moment it's live, same target.
    if (!scrolled && pageFlatListRef.current) {
      pageFlatListRef.current.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false });
    }
    // P0-A — stale-guard: if the reader moved on (fast swipe / surah change) while the page
    // data was loading, warm nothing here — the settle-warm effect covers their actual page.
    if (currentPageNumRef.current !== pg || !data || !data.lines?.length || Math.round(pageW) <= 0) return;
    try { warmPageLayoutFor(pg, data, textStyleRef.current, Math.round(pageW)); } catch {}
  }, [pageNumbers.length, splitOn, pageW, ensurePageLoaded]);

  /**
   * WHAT: Prefetches pages ±1, ±2 around the current page (single mode) or the
   *   pair ±2 around the current pair (split mode, via pairIndexForPage/pagePairsFor).
   * CALLS: ensurePageLoaded + ensurePageVersesLoaded.
   * CALLED BY: onMomentumScrollEnd, handleSelectPage, deep-link effect,
   *   surah-change effect, lastRead restore.
   * NOTES: 'single' mode skips page-verse prefetch — verses are only fetched by
   *   MushafPageView render (single) or SpreadItem (split).
   */
  const prefetchAround = (pageMode: 'single' | 'split', page: number) => {
    if (pageMode === 'single') { ensurePageLoaded(page + 1); ensurePageLoaded(page - 1); ensurePageLoaded(page + 2); ensurePageLoaded(page - 2); return; }
    // FIX 5 — spread mode loads only the visible pair + ONE neighbour pair; never preloads or
    // verifies off-screen halves (the FlatList window renders those anyway when needed).
    const data = pagePairsFor(pageNumbers.length);
    const lo = Math.max(0, pairIndexForPage(page) - 1);
    const hi = Math.min(data.length - 1, pairIndexForPage(page) + 1);
    for (let i = lo; i <= hi; i++) { for (const pn of data[i]) { if (pn) { ensurePageLoaded(pn); ensurePageVersesLoaded(pn); } } }
  };

  /**
   * WHAT: Prefetches the facing page of a spread in split mode (pg±1 to make a
   *   pair). No-op in single mode or for page 1.
   * CALLS: ensurePageLoaded + ensurePageVersesLoaded.
   */
  const prefetchPartner = (pg: number) => {
    if (!splitOn || pg === 1) return;
    const partner = Math.min(Math.max(pg + (pg % 2 === 0 ? 1 : -1), 1), pageNumbers.length);
    if (partner) { ensurePageLoaded(partner); ensurePageVersesLoaded(partner); }
  };

  // ---- spread toggle (split mode on/off) ----
  const handleToggleSpread = useCallback(() => dispatch(setMushafSplit(!splitOn)), [splitOn]);

  /**
   * WHAT: SurahList "page jump" — switches to page mode and scrolls to a page.
   * FLOW: 1) close list, setReadingMode('page') if needed 2) set currentPageNum/
   *   headerPage 3) derive the surah from the first word location of the cached
   *   page and dispatch setSurah if different (pageScrollSurahChangeRef guard
   *   stops the surah-change effect from re-scrolling to verse 1) 4) ensure
   *   loads + prefetchPartner (split) 5) landOnPage — scrolls immediately
   *   (scroll-first; the page data loads behind it) then warms the layout.
   * CALLS: setReadingMode, setSurah, ensurePageLoaded, ensurePageVersesLoaded,
   *   prefetchPartner, landOnPage.
   * CALLED BY: SurahList onSelectPage.
   * AFFECTS: readingMode, currentPageNum/headerPage, s.quran.currentSurahId.
   */
  const handleSelectPage = (pg: number) => {
    setShowList(false);
    if (readingMode !== 'page') dispatch(setReadingMode('page'));
    setCurrentPageNum(pg); setHeaderPage(pg);
    const pData = pageCache[pg];
    if (pData) {
      const firstWord = pData.lines?.find((l: any) => l.words?.length > 0)?.words?.[0];
      if (firstWord?.location) {
        const sId = parseInt(firstWord.location.split(':')[0], 10);
        if (sId && sId !== currentSurahId) { pageScrollSurahChangeRef.current = true; dispatch(setSurah({ surahId: sId, verses: [] })); }
      }
    }
    ensurePageLoaded(pg); ensurePageVersesLoaded(pg);
    if (splitOn) prefetchPartner(pg);
    landOnPage(pg);
  };

  /**
   * WHAT: Jumps to the start of a juz (SurahList 'juz' mode jump row).
   * FLOW: JUZ_MAP[juz-1] -> {s, v} of the juz's first ayah; resolve that ayah to
   *   its mushaf page (script-aware via textStyleRef) and reuse handleSelectPage;
   *   fall back to loading the surah if the page lookup fails.
   * CALLS: getVersePage, handleSelectPage, dispatch(setSurah).
   * CALLED BY: SurahList onSelectJuz.
   * AFFECTS: readingMode, currentPageNum/headerPage, s.quran.currentSurahId.
   */
  const handleSelectJuz = (juz: number) => {
    setShowList(false);
    const e = JUZ_MAP[juz - 1];
    if (!e) return;
    getVersePage(e.s, e.v, textStyleRef.current).then((pg) => {
      if (pg > 0) handleSelectPage(pg);
      else dispatch(setSurah({ surahId: e.s, verses: [] }));
    }).catch(() => dispatch(setSurah({ surahId: e.s, verses: [] })));
  };

  /**
* WHAT: Handles navigation from Bookmarks/Mistakes/Notes/StudentHub with
   *   {surahId, scrollToVerse} or {page} route params.
   * FLOW (page param, e.g. GO TO PAGE # / SurahIndex page rows): land in page
   *   mode at that exact page; header surah resolved from the page's first verse.
   * FLOW (surahId, page mode): getVersePage(surahId, verse, textStyle) -> set current
   *   page/header state, ensurePageLoaded, prefetchPartner, landOnPage (waits for
   *   page data, then scrolls + warms layout — scroll-first, no wait).
   * FLOW (surahId, ayah/continuous): targetPage = ceil(scrollToVerse/20) ->
   *   getVersesBySurahPaginated(surahId, 1, targetPage*20) -> deepLinkLoadedRef
   *   = true (suppresses the surah-change effect's loadSurah) -> setSurah +
   *   setPage(targetPage+1) -> after 500ms scroll to the verse index (FlatList
   *   scrollToIndex viewPosition 0.5 / ScrollView y=idx*45) and flash the verse
   *   for 2s (setFlashingVerse -> null).
   * CALLS: getVersePage, getVersesByPage, getVersesBySurahPaginated, setSurah,
   *   setReadingMode, setFlashingVerse, ensurePageLoaded, prefetchPartner,
   *   flatListRef/scrollViewRef scrolls.
   * AFFECTS: currentPageNum/headerPage/headerSurahId; s.quran.verses/flashingVerse.
   * NOTES: Re-runs on every route.params identity change. getVersePage is
   *   textStyle-dependent (page differs between uthmani 604 / indopak 610).
   *   paramsHandledRef suppresses the mount-time restore effects (lastRead
   *   restore + surah-change) WHILE this deep link's landing is still in
   *   flight — cleared on completion, NOT on a fixed 600ms timer, so a slow
   *   device can never let them override the requested page/verse mid-landing
   *   (the old timer expired mid-flight and RESUME/surah jumps lost the race
   *   to the persisted reading position).
   */
  const paramsHandledRef = useRef(false);
  useEffect(() => {
    const { surahId, scrollToVerse, page } = route.params || {};
    const p = page !== undefined ? Number(page) : 0;
    if (p >= 1 && p <= 610) {
      paramsHandledRef.current = true;
      if (readingMode !== 'page') dispatch(setReadingMode('page'));
      setCurrentPageNum(p); setHeaderPage(p); ensurePageLoaded(p); prefetchPartner(p);
      getVersesByPage(p, textStyle).then(vs => { const f = vs?.[0]; if (f?.surahId) setHeaderSurahId(f.surahId); }).catch(() => {});
      landOnPage(p).finally(() => { paramsHandledRef.current = false; });
    } else if (surahId) {
      paramsHandledRef.current = true;
      if (readingMode === 'page') {
        getVersePage(surahId, scrollToVerse, textStyle).then(pg => {
          setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surahId); ensurePageLoaded(pg); prefetchPartner(pg);
          return landOnPage(pg);
        }).catch(() => {}).finally(() => { paramsHandledRef.current = false; });
      } else {
        const targetPage = Math.ceil((scrollToVerse || 1) / 20);
        getVersesBySurahPaginated(surahId, 1, targetPage * 20).then(({ verses: v, total }) => {
          deepLinkLoadedRef.current = true;
          dispatch(setSurah({ surahId, verses: v }));
          setPage(targetPage + 1); setHasMore(v.length < total); setHeaderSurahId(surahId); setHeaderPage(0);
          if (scrollToVerse) setTimeout(() => {
            const idx = v.findIndex((x: any) => x.verseNumber === scrollToVerse);
            if (idx !== -1) {
              if (readingMode === 'ayah' && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
              else if (readingMode === 'continuous' && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true });
            }
            dispatch(setFlashingVerse(scrollToVerse)); setTimeout(() => dispatch(setFlashingVerse(null)), 2000);
          }, 500);
        }).catch(() => {}).finally(() => { paramsHandledRef.current = false; });
      }
    }
  }, [route.params]);

  const surahIdRef = useRef(currentSurahId);
  const versesRef = useRef(verses);
  const pageRef = useRef(page);
  const textStyleRef = useRef(textStyle);
  useEffect(() => { surahIdRef.current = currentSurahId; }, [currentSurahId]);
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { textStyleRef.current = textStyle; }, [textStyle]);
  useEffect(() => { currentPageNumRef.current = currentPageNum; }, [currentPageNum]);

  /**
   * LOCAL-ONLY per-student memory of the LAST PAGE VIEWED (StudentHub RESUME).
   * Runs on every page settle — including the first (mount), so anything
   * viewed counts: RESUME/DAILY/bookmark/GO-TO-PAGE opens all update it. The
   * saved verse is the last verse of the visible page; the hub resolves it
   * back to a page via getVersePage (script-aware). NEVER synced — kept out
   * of every manifest/cloud path on purpose.
   * CALLS: saveLastPageSeenLocal (src/database/localDB.ts).
   */
  useEffect(() => {
    if (readingMode !== 'page' || !currentStudent?.id) return;
    // FIX 8 — only the settled page counts as "last page viewed": intermediate pages of a fast
    // fling must never overwrite the real landing page.
    if (settledPage !== currentPageNum) return;
    const pg = pageVersesCache[currentPageNum];
    const last = pg && pg.length ? pg[pg.length - 1] : null;
    if (!last || !Number(last.surahId) || !Number(last.verseNumber)) return;
    saveLastPageSeenLocal(currentStudent.id, { surah: Number(last.surahId), verse: Number(last.verseNumber), at: new Date().toISOString() });
  }, [currentPageNum, readingMode, currentStudent?.id, pageVersesCache?.[currentPageNum], settledPage]);

  /**
   * WHAT: 20-verse page loader for ayah/continuous modes; appends or replaces
   *   s.quran.verses depending on resetPage.
   * FLOW: 1) page = resetPage ? 1 : pageRef.current 2)
   *   getVersesBySurahPaginated(surahId, page, 20) 3) STALE-GUARD: drop the
   *   result if surahId !== surahIdRef.current (fast surah switching) 4) reset:
   *   setSurah{verses:new} + setPage(2); append: merge with versesRef.current
   *   + setPage(page+1) 5) setHasMore(accLen < total).
   * CALLS: getVersesBySurahPaginated, dispatch(setSurah).
   * CALLED BY: ayah onEndReached, continuous onScroll, surah-change effect
   *   (guarded by deepLinkLoadedRef).
   * AFFECTS: s.quran.verses, s.quran.currentSurahId, page/hasMore state.
   * NOTES: The surahIdRef race guard is essential — several loads can be in
   *   flight when the user switches surahs fast; only the latest lands.
   */
  const loadSurah = async (surahId: number, resetPage: boolean = true) => {
    const currentPage = resetPage ? 1 : pageRef.current;
    const { verses: newVerses, total } = await getVersesBySurahPaginated(surahId, currentPage, 20);
    if (surahId !== surahIdRef.current) return;
    const accLen = resetPage ? newVerses.length : versesRef.current.length + newVerses.length;
    if (resetPage) { dispatch(setSurah({ surahId, verses: newVerses })); setPage(2); setHasMore(accLen < total); }
    else { dispatch(setSurah({ surahId, verses: [...versesRef.current, ...newVerses] })); setPage(currentPage + 1); setHasMore(accLen < total); }
  };

  /**
   * WHAT: Keeps the header surah in sync and navigates to the new surah's page
   *   whenever currentSurahId / readingMode / textStyle change.
   * FLOW: setHeaderSurahId; page mode -> unless pageScrollSurahChangeRef is set
   *   (surah came from a page scroll), resolve getVersePage(currentSurahId, 1)
   *   -> stale-guard against a surah switch mid-flight -> set the page state +
   *   prefetchPartner + landOnPage (scroll-first, page data loads behind it);
   *   ayah/continuous -> headerPage=0 and loadSurah unless the deep link already
   *   loaded (deepLinkLoadedRef).
   * CALLS: getVersePage, loadSurah, ensurePageLoaded, prefetchPartner, landOnPage.
   * AFFECTS: headerSurahId/headerPage/currentPageNum; s.quran.verses.
   * NOTES: THE pageScrollSurahChangeRef guard is what stops a page-scroll surah
   *   change from yanking the user back to that surah's page 1. Triggered by
   *   setSurah from SurahList, swipe, page-scroll detection, deep link,
   *   Dashboard, lastRead restore.
   */
  useEffect(() => {
    if (paramsHandledRef.current) return; // a route-params deep link (hub/Bookmarks/etc.) owns the landing position
    setHeaderSurahId(currentSurahId);
    if (readingMode === 'page') {
      if (pageScrollSurahChangeRef.current) {
        pageScrollSurahChangeRef.current = false;
        return;
      }
      getVersePage(currentSurahId, 1, textStyle).then(pg => {
        if (surahIdRef.current !== currentSurahId) return;
        setCurrentPageNum(pg); setHeaderPage(pg); prefetchPartner(pg);
        landOnPage(pg);
      });
    } else {
      setHeaderPage(0);
      if (!deepLinkLoadedRef.current) loadSurah(currentSurahId, true);
    }
    deepLinkLoadedRef.current = false;
  }, [currentSurahId, readingMode, textStyle]);

  // ---- leave drawing mode + collapse toolbar on surah/page change ----
  useEffect(() => { setIsDrawing(false); dispatch(setToolbarExpanded(false)); }, [currentSurahId, currentPageNum]);

  // ---- load canvas chunks into local state ----
  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;
  const spreadOddKey = splitOn ? `page_${currentPageNum % 2 === 0 ? currentPageNum - 1 : currentPageNum}` : null;
  const spreadEvenKey = splitOn ? `page_${currentPageNum % 2 === 0 ? currentPageNum : currentPageNum + 1}` : null;

  /**
   * WHAT: Re-runs the SAME lazy cloud restore as the page-load effect for the
   *   currently visible range — pullDrawings only (pullAudioRange stays owned
   *   by the load effect; duplicating it could double-register the audio
   *   registry) — then re-merges the pulled chunks into canvasData. Fires only
   *   from triggers that happen while the screen is already open: a global sync
   *   finishing, or the drawing canvas opening. Without these, drawings a sync
   *   or another device just delivered stay invisible until the page-load
   *   effect re-fires (page/surah/student change).
   * FLOW: builds geoKeys/geo IDENTICALLY to the page-load effect (splitOn
   *   spread keys vs the single drawingKey); in page mode groups geoKeys by
   *   rangeKeyForPage(pg) and pulls once per range; otherwise pulls the single
   *   drawingKey directly. When the pull lands, re-merges via
   *   setCanvasData(await mergeChunks(geoKeys)) exactly like the effect's
   *   `refresh`, unless a drawing gesture is in flight (live
   *   drawingGestureActiveRef) — pullDrawings itself never clobbers local
   *   edits, so the pull is always safe even mid-stroke.
   * CALLS: pullDrawings, getChunk, rangeKeyForPage, setCanvasData.
   * AFFECTS: canvasData (local state).
   * NOTES: FIRE-AND-FORGET — callers must never await this; a cold Firestore
   *   pull must never block the sync watcher or the canvas-open transition.
   */
  const refreshCloudDrawings = useCallback(async () => {
    if (!currentStudent) return;
    const sid = currentStudent.id;
    const mergeChunks = async (keys: (string | null)[]) => {
      let newH: any = {}, newN: any = {}, newD: any = {};
      for (const k of keys) {
        if (!k) continue;
        const c = await getChunk(sid, k);
        if (c?.data) {
          if (c.data.highlights) newH = { ...newH, ...c.data.highlights };
          if (c.data.notes) newN = { ...newN, ...c.data.notes };
          if (c.data.strokes) newD[k] = { paths: c.data.strokes };
        }
      }
      return { highlights: newH, notes: newN, drawings: newD };
    };
    const geoKeys = splitOn ? [spreadOddKey, spreadEvenKey].filter(Boolean) : [drawingKey];
    const geo = { canvasW: splitOn ? pageW : winW, canvasH: winH, padX: hPadFor(splitOn ? pageW : winW) };
    const refresh = async () => {
      if (!drawingGestureActiveRef.current) setCanvasData(await mergeChunks(geoKeys));
    };
    if (readingMode === 'page') {
      const byRange: Record<string, string[]> = {};
      for (const k of geoKeys) {
        const pg = Number(k.split('_')[1]);
        const rk = rangeKeyForPage(pg);
        (byRange[rk] = byRange[rk] || []).push(k);
      }
      for (const [rk, rKeys] of Object.entries(byRange)) {
        pullDrawings(sid, rk, rKeys, geo).then(refresh).catch(refresh);
      }
    } else {
      pullDrawings(sid, drawingKey, geoKeys, geo).then(refresh).catch(refresh);
    }
  }, [currentStudent, readingMode, splitOn, spreadOddKey, spreadEvenKey, drawingKey, winW, winH, pageW]);

  useEffect(() => {
    if (!currentStudent) return;
    // FIX 8 — ignore intermediate momentum pages: only refresh the canvas for the page that
    // survives 120ms after the last swipe settle.
    if (settledPage !== currentPageNum) return;
    const sid = currentStudent.id;
    let cancelled = false;
    const mergeChunks = async (keys: (string | null)[]) => {
      let newH: any = {}, newN: any = {}, newD: any = {};
      for (const k of keys) {
        if (!k) continue;
        const c = await getChunk(sid, k);
        if (c?.data) {
          if (c.data.highlights) newH = { ...newH, ...c.data.highlights };
          if (c.data.notes) newN = { ...newN, ...c.data.notes };
          if (c.data.strokes) newD[k] = { paths: c.data.strokes };
        }
      }
      return { highlights: newH, notes: newN, drawings: newD };
    };
    const load = async () => {
      const keys = splitOn ? [spreadOddKey, spreadEvenKey] : [drawingKey];
      if (!cancelled) setCanvasData(await mergeChunks(keys));
      // Lazy cloud restore (drawings + audio registry for this page's range)
      // runs in the BACKGROUND — never awaited, so the page and its SQLite
      // highlights/notes render immediately. Drawings/audio re-merge when the
      // restore lands. (Previously two SEQUENTIAL awaited Firestore reads
      // blocked the canvas merge for seconds on a cold connection — the "5s
      // page load" on a fresh device.)
      if (!cancelled && currentStudent) {
        const geoKeys = splitOn ? [spreadOddKey, spreadEvenKey].filter(Boolean) : [drawingKey];
        const geo = { canvasW: splitOn ? pageW : winW, canvasH: winH, padX: hPadFor(splitOn ? pageW : winW) };
        const refresh = async () => {
          if (!cancelled) setCanvasData(await mergeChunks(geoKeys));
        };
        if (readingMode === 'page') {
          const byRange: Record<string, string[]> = {};
          for (const k of geoKeys) {
            const pg = Number(k.split('_')[1]);
            const rk = rangeKeyForPage(pg);
            (byRange[rk] = byRange[rk] || []).push(k);
          }
          for (const [rk, rKeys] of Object.entries(byRange)) {
            Promise.all([pullAudioRange(sid, rk), pullDrawings(sid, rk, rKeys, geo)])
              .then(refresh).catch(refresh);
          }
        } else {
          pullDrawings(sid, drawingKey, geoKeys, geo).then(refresh).catch(refresh);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentPageNum, currentSurahId, splitOn, currentStudent, readingMode, settledPage]);

  /**
   * WHAT: Re-hydrates the UI after a sync run finishes (app open, foreground,
   *   manual sync). Sync writes to SQLite only — without this watcher,
   *   bookmarks/lastRead (studentData) and page highlights/notes (canvasData)
   *   stay stale on screen until a student/page change. Mirrors DashboardScreen's
   *   syncing->synced watcher.
   * FLOW: on prev==='syncing' && status!=='syncing': skip when a local edit is
   *   mid-write (pendingSaveRef/saveTimerRef); else re-read studentData from
   *   SQLite -> dispatch setStudentData, and re-merge the visible page chunks
   *   into canvasData. Active drawing skips the canvas re-merge so in-flight
   *   strokes are never clobbered.
   * CALLS: getStudentData, getChunk (localDB.ts); dispatch(setStudentData).
   * AFFECTS: s.student.studentData; canvasData (local state).
   */
  useEffect(() => {
    const prev = prevSyncStatusRef.current;
    prevSyncStatusRef.current = syncStatus;
    if (prev !== 'syncing' || syncStatus === 'syncing') return;
    if (pendingSaveRef.current || saveTimerRef.current) return;
    if (!currentStudent) return;
    // P2-H — the post-pull refresh must never contend with the frame that just settled:
    // deferred behind InteractionManager so taps/scrolls/spinners all win the JS thread.
    const sid = currentStudent.id;
    syncRefreshHandle = InteractionManager.runAfterInteractions(() => {
      (async () => {
        // P2-I — freshness gate BEFORE the heavy read: when SQLite is provably unchanged
        // since the last successful hydration of this student, skip getStudentData entirely
        // (the canvas re-merge below still runs — strokes live in chunks, not in studentData).
        const snapshot = await getFreshnessSnapshot(sid);
        if (snapshot !== null && !studentDataIsCurrent(sid, snapshot)) {
          const d = await getStudentData(sid);
          if (d) { markStudentDataLoaded(sid, snapshot); dispatch(setStudentData(d)); }
        }
        if (isDrawing) return;
        // A sync run may have just delivered cloud drawings for the current range —
        // re-pull + re-merge fire-and-forget (never awaited, so this watcher's
        // studentData/bookmarks re-hydration above is never blocked).
        refreshCloudDrawings().catch(() => {});
        const mergeChunks = async (keys: (string | null)[]) => {
          let newH: any = {}, newN: any = {}, newD: any = {};
          for (const k of keys) {
            if (!k) continue;
            const c = await getChunk(sid, k);
            if (c?.data) {
              if (c.data.highlights) newH = { ...newH, ...c.data.highlights };
              if (c.data.notes) newN = { ...newN, ...c.data.notes };
              if (c.data.strokes) newD[k] = { paths: c.data.strokes };
            }
          }
          return { highlights: newH, notes: newN, drawings: newD };
        };
        const keys = splitOn ? [spreadOddKey, spreadEvenKey] : [drawingKey];
        mergeChunks(keys).then(data => setCanvasData(data));
      })().catch(() => {});
    });
    return () => { if (syncRefreshHandle) syncRefreshHandle.cancel(); };
  }, [syncStatus, currentStudent, isDrawing, splitOn, spreadOddKey, spreadEvenKey, drawingKey, dispatch, refreshCloudDrawings]);

  /**
   * WHAT: On the drawing canvas opening (isDrawing false->true) — re-runs the
   *   lazy cloud restore for the current range ONCE per open, so drawings that
   *   synced in while the user was reading appear the moment they reach for the
   *   toolbar (the page-load effect only ran at page mount).
   * FLOW: on the isDrawing transition to true, stamp canvasRestoreRef with
   *   `${currentStudent.id}/${rangeKeyForPage(currentPageNum) | drawingKey}`;
   *   if the stamp already matches, skip (one pull per open); else fire
   *   refreshCloudDrawings fire-and-forget. Moving to another page/surah changes
   *   the stamp, so the next open there naturally re-runs.
   * CALLS: refreshCloudDrawings, rangeKeyForPage.
   * AFFECTS: canvasData (local state, via the helper's re-merge).
   */
  useEffect(() => {
    if (!isDrawing || !currentStudent) return;
    const stamp = `${currentStudent.id}/${readingMode === 'page' ? rangeKeyForPage(currentPageNum) : drawingKey}`;
    if (canvasRestoreRef.current === stamp) return;
    canvasRestoreRef.current = stamp;
    refreshCloudDrawings().catch(() => {});
  }, [isDrawing, currentStudent, readingMode, currentPageNum, drawingKey, refreshCloudDrawings]);

  /**
   * WHAT: Feature 1 — silent drawings pre-fetch when the annotation bar EXPANDS
   *   (not on pen press). Drawings stay invisible until the pen is pressed, but
   *   by then the strokes are already local: pulling into SQLite here means the
   *   canvas opens INSTANTLY instead of doing a Firestore round-trip on press.
   *   Debounced ~200ms so a quick expand/collapse/expand never stacks pulls;
   *   while expanded, a page change re-pulls the new page's 10-page range.
   *   One pull per (student, range) PER FOREGROUND SESSION — the attempted Set
   *   is cleared on app-foreground so a later expand can pick up pushes from
   *   another device.
   * FLOW: toolbarExpanded false->true (or page change while expanded) -> cancel
   *   any prior timer -> 200ms later, if the (sid, range) wasn't already
   *   attempted this session, pull that range's drawings (pullDrawings — the
   *   same lazy restore the page/canvas paths use, grouped by rangeKeyForPage
   *   / surah key, splitOn-aware geometry, never clobbers local strokes), then
   *   rebuild studentData from localDB chunks — the SAME path pages use on
   *   first load — so DrawingCanvas.initialPaths / StaticDrawingOverlay render
   *   the strokes the instant the pen is pressed.
   * CALLS: pullDrawings, getStudentData, dispatch(setStudentData), rangeKeyForPage.
   */
  useEffect(() => {
    if (!toolbarExpanded || !currentStudent) {
      if (expandPullTimer.current) { clearTimeout(expandPullTimer.current); expandPullTimer.current = null; }
      return;
    }
    if (expandPullTimer.current) clearTimeout(expandPullTimer.current);
    expandPullTimer.current = setTimeout(() => {
      expandPullTimer.current = null;
      const stampKey = `${currentStudent.id}/${readingMode === 'page' ? rangeKeyForPage(currentPageNum) : drawingKey}`;
      if (expandedDrawPullAttempted.has(stampKey)) return;
      const geo = { canvasW: splitOn ? pageW : winW, canvasH: winH, padX: hPadFor(splitOn ? pageW : winW) };
      const groupKey = drawingKey.startsWith('page_') ? rangeKeyForPage(currentPageNum) : drawingKey;
      const pageKeys = splitOn ? [spreadOddKey!, spreadEvenKey!].filter(Boolean) : [drawingKey];
      pullDrawings(currentStudent.id, groupKey, pageKeys, geo)
        .then(async () => {
          expandedDrawPullAttempted.add(stampKey);
          // P2-I — the pull may have merged strokes (chunk v bumped -> snapshot differs);
          // an empty pull leaves SQLite unchanged and skips the heavy re-read entirely.
          const snapshot = await getFreshnessSnapshot(currentStudent.id);
          if (snapshot !== null && !studentDataIsCurrent(currentStudent.id, snapshot)) {
            const fresh = await getStudentData(currentStudent.id);
            if (fresh) { markStudentDataLoaded(currentStudent.id, snapshot); dispatch(setStudentData(fresh)); }
          }
        })
        .catch(() => {});
    }, 200);
  }, [toolbarExpanded, currentStudent, readingMode, currentPageNum, drawingKey, splitOn, spreadOddKey, spreadEvenKey, pageW, winW, winH, dispatch]);

  useEffect(() => () => {
    if (expandPullTimer.current) { clearTimeout(expandPullTimer.current); expandPullTimer.current = null; }
  }, []);

  /**
   * WHAT: On textStyle (mushaf font) change — wipe both page caches and their
   *   LRU order refs, then re-seed indopak pages if needed, forcing every page
   *   to re-render under the new mushaf.
   * AFFECTS: pageCache, pageVersesCache (local).
   * NOTES: textStyle union is 'saleem'|'uthmani'|'alqalam'|'lateef' but isIndopak
   *   also matches 'indopak'|'harmattan' (legacy strings only reachable via
   *   `as any` from Settings). Indopak => 610 pages, else 604.
   * FONT-SWITCH PERFORMANCE (Uthmani<->Indopak): all five indopak styles
   *   (saleem/alqalam/lateef/harmattan/indopak) share ONE bundled mushaf — the
   *   page JSON and verse rows are byte-identical across them; only the font
   *   family + per-font geometry changes, and that is re-derived by
   *   MushafPageView from redux textStyle on every render. So a same-family
   *   switch (alqalam<->saleem<->lateef) KEEPS both caches alive: wiping them
   *   here used to re-run getMushafPageData + getVersesByPage for every visible
   *   page (plus the indopak bundle-index cold build) for zero data change. A
   *   cross-family switch (Uthmani<->Indopak) MUST still flush: the two mushafs
   *   are different JSON with different page counts (604 vs 610). On the
   *   second and later cross-family switches the flush itself is cheap again —
   *   module-level mushafPageMemo + the indopak bundle index are still warm
   *   (they live outside React state), so re-hydration is near-instant.
   */
  const prevTextStyleRef = useRef(textStyle);
  useEffect(() => {
    const prevWasIndopak = indopakFonts.includes(prevTextStyleRef.current);
    prevTextStyleRef.current = textStyle;
    // Same indopak family: keep caches warm — identical page JSON + verse rows,
    // font change handled per-render by MushafPageView.
    if (prevWasIndopak && isIndopak) return;
    setPageCache({});
    setPageVersesCache({});
    pageCacheOrderRef.current = [];
    pageVersesOrderRef.current = [];
    // v76 — the layout cache keys changed (different mushaf); everything must re-measure.
    warmedPagesRef.current.clear();
    if (hiddenBusyRef.current) { hiddenBusyRef.current = false; setHiddenWarmPage(null); }
  }, [textStyle]);

  /**
   * WHAT: Hydrates studentData from SQLite when the student changes.
   * FLOW: getStudentData(id) -> data || empty skeleton {bookmarks:{},
   *   highlights:{}, drawings:{}, notes:{}, lastRead:null} -> setStudentData;
   *   if nothing was stored, persist the skeleton immediately.
   * CALLS: getStudentData, saveStudentData (localDB.ts).
   * AFFECTS: s.student.studentData; student_data_cache (skeleton write).
   * NOTES: Keyed to currentStudent.id (Firebase student); runs on every student
   *   change (Dashboard card tap).
   */
  useEffect(() => {
    if (currentStudent) getStudentData(currentStudent.id).then(d => {
      const data = d || { bookmarks: {}, highlights: {}, drawings: {}, notes: {}, lastRead: null };
      dispatch(setStudentData(data)); if (!d) saveStudentData(currentStudent.id, data);
    });
  }, [currentStudent]);

  /**
   * WHAT: On mount / surah restore — jumps to the saved reading position.
   * FLOW: per mode: page -> getVersePage(surah, verse) + scroll after 500ms;
   *   ayah -> find verse index in versesRef + scrollToIndex viewPosition 0.5;
   *   continuous -> scrollTo y=idx*45. Also dispatch setSurah if needed.
   * CALLS: getVersePage, setSurah, flatListRef/scrollViewRef scrolls.
   * AFFECTS: currentPageNum/headerPage/headerSurahId; s.quran.currentSurahId.
   * NOTES: BUG/RACE — the dependency is ONLY lastRead.surah: moving lastRead.
   *   verse within the same surah never re-runs this (and on mount versesRef is
   *   usually empty so the ayah/continuous branches no-op). readingMarkVerse is
   *   the lastRead verse of the current surah shown to the user ("Set Reading
   *   Mark" menu item + page bookmark interplay).
   */
  useEffect(() => {
    // A route-params deep link (StudentHub RESUME / DAILY RECITATION / GO TO PAGE,
    // Bookmarks / Mistakes / Notes / Surah / Juz index) OWNS the landing position for
    // this mount. The persisted lastRead restore must never override it — it used to,
    // racing the old 600ms paramsHandledRef timer on slow devices: RESUME landed on the
    // reading mark (e.g. Fatiha) instead of the requested page, and a surah jump showed
    // the mark's page for seconds before the deep link finally landed. Route params are
    // stable for the life of a pushed screen, so this check is sticky for the mount.
    const hasDeepLinkParams = !!(route?.params && (route.params.surahId !== undefined || route.params.page !== undefined));
    if (hasDeepLinkParams || paramsHandledRef.current) return;
    if (studentData?.lastRead) {
      const surah = Number(studentData.lastRead.surah);
      const verse = Number(studentData.lastRead.verse);
      if (!(surah > 0 && verse > 0)) return;
      if (currentSurahId !== surah) dispatch(setSurah({ surahId: surah, verses: [] }));
      if (readingMode === 'page') {
        getVersePage(surah, verse, textStyle).then(pg => { if (surahIdRef.current !== currentSurahId) return; setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surah); ensurePageLoaded(pg); prefetchPartner(pg); landOnPage(pg); });
      } else if (readingMode === 'ayah') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); }, 500);
      } else if (readingMode === 'continuous') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true }); }, 500);
      }
    }
  }, [studentData?.lastRead?.surah, route?.params]);

  /**
   * WHAT: After splitOn/winW changes, re-snaps the page FlatList to the current
   *   page (target = pair index in split mode, else page-1; offset = target*winW).
   * NOTES: NEVER runs on its mount frame — the initial scroll position belongs to the
   *   deep-link / lastRead-restore / surah-change landing paths (all of which scroll via
   *   landOnPage). A mount-time snap used to race those landings: on a fast warm-cache
   *   device the deep link landed at e.g. page 298 within a few ms, then this effect's
   *   +120ms timer scrolled the FlatList back to page 1 — which is exactly why RESUME and
   *   DAILY RECITATION "went to Al-Fatiha" even though the header/hub showed page 298.
   */
  const snapMountedRef = useRef(false);
  useEffect(() => {
    if (!snapMountedRef.current) { snapMountedRef.current = true; return; }
    if (paramsHandledRef.current) return; // a deep link is still landing — it owns the scroll
    const target = splitOn ? pairIndexForPage(currentPageNum) : currentPageNum - 1;
    const t = setTimeout(() => { programmaticScrollRef.current = Date.now(); pageFlatListRef.current?.scrollToOffset({ offset: target * winW, animated: false }); }, 120);
    return () => clearTimeout(t);
  }, [splitOn, winW]);

  // FIX 8 — clear the swipe-settle debounce timer on unmount (never inside per-page effect
  // cleanups: those re-run on every page change and would cancel the final page's settle).
  useEffect(() => () => {
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
  }, []);

  // ================= EDIT PIPELINE — the feature heart =================
  // Every student-data mutation funnels through updateData:
  //   edit -> updateData -> Redux setStudentData (instant, optimistic) +
  //   pendingSaveRef (latest-only slot) -> 400ms debounce -> flushPendingSave
  //   -> saveStudentData + addToSyncQueue -> addPendingChange (sync badge).
  // Additional flush triggers: AppState background/inactive + unmount.
  const pendingSaveRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);

  /**
   * WHAT: Flushes the latest pending snapshot to SQLite and marks sync dirty.
   * FLOW: 1) clear the pending timer, grab + null pendingSaveRef 2) if data &&
   *   currentStudent: saveStudentData(id, data) -> addToSyncQueue(id, data) ->
   *   dispatch(addPendingChange()); .catch swallowed.
   * CALLS: saveStudentData + addToSyncQueue (localDB.ts — BOTH call the same
   *   persistStudentData, INSERT OR REPLACE of student_data_cache AND sync_queue);
   *   addPendingChange (syncSlice).
   * AFFECTS: student_data_cache (data JSON), sync_queue (synced=0 row),
   *   s.sync.pendingChanges += 1.
   * NOTES: (a) DOUBLE-WRITE: saveStudentData().then(addToSyncQueue) writes the
   *   same rows twice back-to-back — addToSyncQueue is a redundant duplicate.
   *   (b) sync_queue holds ONE row per student (UNIQUE index + dedupe in
   *   localDB.ts) — every edit resets synced=0 and overwrites data, so the
   *   badge counts EDITS not queued payloads.
   */
  const flushPendingSave = () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const dataToSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    const sid = currentStudentIdRef.current;
    if (dataToSave && sid) {
      saveStudentData(sid, dataToSave).then((queued: boolean) => { if (queued) dispatch(addPendingChange()); }).catch(() => {});
    }
  };

  /**
   * WHAT: Optimistic Redux write + (mostly) 400ms-debounced SQLite/sync persistence —
   *   THE single funnel for every student-data mutation.
   * FLOW: 1) stamp updatedAt ISO 2) dispatch(setStudentData(dataToSave)) —
   *   immediate UI update 3) pendingSaveRef.current = dataToSave (only the
   *   LATEST snapshot kept) 4) reset timer -> flushPendingSave in 400ms.
   * MANIFEST EDITS (lastRead / bookmarks) skip the debounce and flush RIGHT
   *   AWAY: they're tiny manifest writes, and any delayed write lets a racing
   *   reload (StudentHub focus / syncing->synced watcher) read STALE SQLite and
   *   overwrite the optimistic Redux value — which is exactly why the hub's
   *   DAILY RECITATION would show "No reading mark yet" even though the mark
   *   was just set. Everything else (highlights/notes/drawings) keeps batching.
   * CALLS: setStudentData (studentSlice), flushPendingSave.
   * CALLED BY: handleWordFlow, handleBookmarkFlow, saveNote,
   *   handleVoiceNoteSaved, DrawingCanvas onSave, menu "Set Reading Mark".
   * AFFECTS: s.student.studentData (immediate); SQLite + sync queue (debounced
   *   except lastRead/bookmarks).
   * NOTES: STALE-SNAPSHOT LOSS — handlers capture `studentData` at call time;
   *   two edits inside 400ms (e.g. two word taps) dispatch from the same stale
   *   snapshot and the second setStudentData overwrites, silently DROPPING the
   *   first change in Redux AND in pendingSaveRef (latest-only slot). Fast
   *   double-taps on words lose highlights.
   */
  const updateData = (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(dataToSave));
    const prev = pendingSaveRef.current;
    const prevManifest = prev || studentData || {};
    const manifestTouched =
      JSON.stringify(dataToSave.lastRead) !== JSON.stringify(prevManifest.lastRead) ||
      JSON.stringify(dataToSave.bookmarks) !== JSON.stringify(prevManifest.bookmarks);
    pendingSaveRef.current = dataToSave;
    if (manifestTouched) { flushPendingSave(); return; }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingSave, 400);
  };

  /**
   * WHAT: App-lifetime safety net — flushes the pending save (and pauses
   *   surah playback) when the app goes to background/inactive or unmounts,
   *   so student data survives an app kill.
   * CALLS: flushPendingSave, pauseSurah, setPlaying.
   */
  useEffect(() => {
    const handleAppState = (state: string) => {
      if (state === 'active') {
        // Foreground: allow toolbar-expand pulls to re-check (another device may have pushed).
        expandedDrawPullAttempted.clear();
        return;
      }
      if (state === 'background' || state === 'inactive') {
        // force the drawing canvas to commit its pending debounce BEFORE the flush
        // so an in-flight stroke edit isn't lost to the app-state save
        try { canvasRef.current?.flush?.(); } catch {}
        flushPendingSave();
        if (isSurahPlaying(surahIdRef.current)) { pauseSurah(audioPlayer.current); dispatch(setPlaying(false)); }
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => {
      sub.remove();
      flushPendingSave();
      if (isSurahPlaying(surahIdRef.current)) { pauseSurah(audioPlayer.current); dispatch(setPlaying(false)); }
    };
  }, []);

  /**
   * WHAT: Auto-turn the page during playback if the newly playing verse is on a different page.
   * CALLS: getVersePage, handleSelectPage.
   */
  useEffect(() => {
    if (isPlaying && readingMode === 'page' && flashingVerse) {
      const activeSId = flashingSurah || currentSurahId;
      getVersePage(activeSId, flashingVerse, textStyle).then(pg => {
        if (pg && pg !== currentPageNumRef.current) {
          handleSelectPage(pg);
        }
      });
    }
  }, [flashingVerse, isPlaying, readingMode, flashingSurah, currentSurahId, textStyle]);

  /**
   * WHAT: Toggles a MISTAKE_COLOR word-highlight for `{surah}_{verse}`.
   * FLOW: exists? filter it out : append {id: uuidv4(), wordIndex, color:
   *   MISTAKE_COLOR, createdAt}; then updateData({...studentData, highlights});
   *   'impactLight' haptic.
   * CALLS: updateData, ReactNativeHapticFeedback.
   * CALLED BY: onWordPress -> VerseDisplay / FlowingText / MushafPageView /
   *   SpreadItem word taps.
   * AFFECTS: studentData.highlights.<surah_verse>.highlights[].
   */
  const handleWordFlow = useCallback((verseNum: number, wordIndex: number) => {
    if (!currentStudent) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cHigh = canvasData.highlights || {};
    const vHighs = cHigh[vKey]?.highlights || [];
    const exists = vHighs.find((h: any) => h.wordIndex === wordIndex);
    const newHighs = exists ? vHighs.filter((h: any) => h.wordIndex !== wordIndex) : [...vHighs, { id: uuidv4(), wordIndex, color: MISTAKE_COLOR, createdAt: new Date().toISOString() }];
    setCanvasData((prev: any) => ({ ...prev, highlights: { ...prev.highlights, [vKey]: { highlights: newHighs } } }));
    dispatch(setStudentData({ ...(studentData || {}), highlights: { ...(studentData?.highlights || {}), [vKey]: { highlights: newHighs } } }));
    ReactNativeHapticFeedback.trigger('impactLight');
    getVersePage(currentSurahId, verseNum, textStyleRef.current).catch(() => 0).then((page) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(currentSurahId);
      saveCanvasEdit(currentStudent.id, key, 'highlights', { [vKey]: { highlights: newHighs } });
      dispatch(addPendingChange());
    });
  }, [canvasData, currentStudent, currentSurahId, studentData, dispatch]);

  /**
   * WHAT: Toggles `{surah}_{verse}` in the bookmarks map; 'impactMedium' haptic.
   * CALLS: updateData, ReactNativeHapticFeedback.
   * CALLED BY: VerseDisplay / FlowingText onBookmarkToggle, page bookmark
   *   button, menu Bookmark (MushafPageView badge taps NO LONGER bookmarks —
   *   they open the verse menu via onBadgePress; onBookmarkToggle remains only
   *   as MushafPageView's legacy fallback).
   * AFFECTS: studentData.bookmarks.<surah_verse> = {surah, verse, createdAt}.
   */
  const handleBookmarkFlow = useCallback((verseNum: number, surahId?: number) => {
    if (!currentStudent) return;
    const sId = surahId || currentSurahId;
    const vKey = `${sId}_${verseNum}`;
    const cMarks = studentData?.bookmarks || {};
    const newMarks = { ...cMarks };
    if (newMarks[vKey]) delete newMarks[vKey]; else newMarks[vKey] = { surah: sId, verse: verseNum, createdAt: new Date().toISOString() };
    updateData({ ...studentData, bookmarks: newMarks });
    ReactNativeHapticFeedback.trigger('impactMedium');
    getManifest(currentStudent.id).then(m => {
      m.data.bookmarks = newMarks; m.data.v++;
      saveManifestLocal(currentStudent.id, m.data);
    });
  }, [studentData, currentStudent, currentSurahId]);

  // ---- tap callbacks: curried handlers passed down to every renderer ----
  const onWordPress = useCallback((verseNum: number) => (index: number) => handleWordFlow(verseNum, index), [handleWordFlow]);
  // toggleHeader: any dead tap on the mushaf text/line background ALWAYS toggles (no pageY filter)
  const toggleHeader = useCallback(() => setIsHeaderVisible((prev: boolean) => !prev), []);
  const onBookmarkToggle = useCallback((verseNum: number, surahId?: number) => () => handleBookmarkFlow(verseNum, surahId), [handleBookmarkFlow]);
  /**
   * WHAT: Long-press a verse -> haptic + menuVerse/menuY -> floating 6-button
   *   bubble (Play/Bookmark/Reading/Note/Record/Copy).
   * CALLED BY: VerseDisplay / FlowingText / MushafPageView onVerseLongPress
   *   (and SpreadItem's two MushafPageViews).
   * ALSO (badge taps): MushafPageView verse BADGES call this SAME handler via
   *   onBadgePress — a single badge tap opens the menu for that verse instead of
   *   auto-bookmarking. pageY comes from the badge press event; when absent
   *   (pageY ?? null) the menu falls back to its centered-overlay mode.
   */
  const handleVerseLongPress = useCallback((verseNum: number, pageY?: number) => { ReactNativeHapticFeedback.trigger('impactMedium'); setMenuVerse(verseNum); setMenuY(pageY ?? null); }, []);

  /**
   * WHAT: Copies Arabic + translation of a verse to the clipboard.
   * FLOW: page mode — verse looked up in pageVersesCache[currentPageNum];
   *   ayah/continuous — looked up in s.quran.verses. Clipboard.setString +
   *   'Copied' alert; closes the menu.
   * CALLS: Clipboard, Alert.
   */
  const handleCopyVerse = (verseNum: number) => {
    let verse: any;
    if (readingMode === 'page') {
      const pgVerses = pageVersesCache[currentPageNum] || [];
      verse = pgVerses.find((v: any) => v.verseNumber === verseNum);
    } else {
      verse = verses.find((v: any) => v.verseNumber === verseNum);
    }
    if (verse) { Clipboard.setString(`${verse.textArabic}\n\n${verse.textTranslation}`); Alert.alert('Copied', 'Verse copied to clipboard!'); }
    setMenuVerse(null); setMenuY(null);
  };
// openNoteModal: pre-fills the note modal from studentData for the menu verse.
  // Captures menuVerse into noteVerseKey BEFORE the caller nulls menuVerse, so
  // saveNote still knows which verse to write even after menuVerse is cleared.
  const openNoteModal = () => {
    if (menuVerse === null) return;
    setNoteVerseKey(menuVerse);
    setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || '');
    setShowNoteModal(true);
  };
  /**
   * WHAT: Writes noteText for `{currentSurahId}_{noteVerseKey}` into the notes map
   *   and closes the modal.
   * CALLS: updateData.
   * CALLED BY: menu Note button via openNoteModal.
   * AFFECTS: studentData.notes.<surah_verse> (string).
   */
  const saveNote = () => {
    if (!currentStudent || noteVerseKey === null) return;
    const vKey = `${currentSurahId}_${noteVerseKey}`;
    setCanvasData((prev: any) => ({ ...prev, notes: { ...(prev.notes || {}), [vKey]: noteText } }));
    dispatch(setStudentData({ ...(studentData || {}), notes: { ...(studentData?.notes || {}), [vKey]: noteText } }));
    setShowNoteModal(false); setNoteVerseKey(null); setMenuVerse(null); setMenuY(null);
    getVersePage(currentSurahId, noteVerseKey, textStyleRef.current).catch(() => 0).then((page) => {
      const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(currentSurahId);
      saveCanvasEdit(currentStudent.id, key, 'notes', { [vKey]: noteText });
    });
  };
  /**
   * WHAT: Appends `audio:<path>` (newline-separated) to the note of
   *   recordingVerseKey. The recorder footer stays in its "done" state
   *   (auto-hides after 4s -> onCancel -> recordingVerseKey cleared).
   * CALLS: updateData.
   * CALLED BY: VoiceNoteRecorder onSaved.
   * AFFECTS: studentData.notes.<surah_verse> — voice notes are STORED INSIDE
   *   the notes field (no separate field); existing note text preserved.
   * NOTE (LOCAL-ONLY, Spark plan): the recorded m4a stays on THIS device and
   *   the note stores its absolute local path (`audio:/data/.../x.m4a`), so
   *   playback works but the audio does NOT sync to other devices. When the
   *   Firebase Blaze plan is enabled, restore the ORIGINAL upload flow below
   *   (replace this whole function body with the commented block) so voice
   *   notes upload to Storage and sync cross-device again.
   */
  const handleVoiceNoteSaved = useCallback(async (path: string, ms: number) => {
    if (!currentStudent || !recordingVerseKey) return;
    const existing = canvasData.notes?.[recordingVerseKey] || '';
    const newText = existing + (existing ? '\n' : '') + `audio:${path}`;
    setCanvasData((prev: any) => ({ ...prev, notes: { ...(prev.notes || {}), [recordingVerseKey]: newText } }));
    dispatch(setStudentData({ ...(studentData || {}), notes: { ...(studentData?.notes || {}), [recordingVerseKey]: newText } }));
    const [s, v] = recordingVerseKey.split('_').map(Number);
    const page = await getVersePage(s, v, textStyleRef.current).catch(() => 0);
    const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(s);
    saveCanvasEdit(currentStudent.id, key, 'notes', { [recordingVerseKey]: newText });
    dispatch(addPendingChange());
    // ================================================================
    // BLAZE PLAN RESTORE — when Firebase Storage is enabled, uncomment
    // the block below and delete the local-only flow above. It uploads
    // to `audio_notes/<fileId>.m4a`, registers the per-range audio row
    // (registerAudioNote), and lets voice notes sync across devices.
    // ================================================================
    // let fileId: string | null = null;
    // try {
    //   if (!currentStudent || !recordingVerseKey) return;
    //   const existing = canvasData.notes?.[recordingVerseKey] || '';
    //   fileId = await uploadAudioNote(path);
    //   const [s, v] = recordingVerseKey.split('_').map(Number);
    //   const page = await getVersePage(s, v, textStyleRef.current).catch(() => 0);
    //   await registerAudioNote(currentStudent.id, recordingVerseKey, fileId, ms, page || undefined);
    //   // audio-range queue row (`_audio_<rangeKey>`) — count it in the sync badge
    //   dispatch(addPendingChange());
    //   const newText = existing + (existing ? '\n' : '') + `audio:${fileId}`;
    //   setCanvasData((prev: any) => ({ ...prev, notes: { ...(prev.notes || {}), [recordingVerseKey]: newText } }));
    //   setRecordingVerseKey(null);
    //   const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(s);
    //   saveCanvasEdit(currentStudent.id, key, 'notes', { [recordingVerseKey]: newText });
    //   // chunk row queued by saveCanvasEdit — count it in the sync badge
    //   dispatch(addPendingChange());
    // } catch (e) {
    //   console.warn('handleVoiceNoteSaved', e);
    //   // best-effort cleanup of an orphaned upload before reporting the failure
    //   if (fileId) { try { await storage().ref(`audio_notes/${fileId}.m4a`).delete(); } catch {} }
    //   setRecordingVerseKey(null);
    //   Alert.alert('Note', 'Failed to save voice note.');
    // }
  }, [canvasData, currentStudent, recordingVerseKey, studentData, dispatch]);

  /**
   * WHAT: Removes the `audio:<path>` line(s) from the note of verseKey (Delete button in the
   *   recorder footer's done state), keeping any normal text the user wrote. The verse note key
   *   is dropped entirely when nothing remains. The m4a file itself is unlinked by the recorder.
   * CALLS: updateData (via setCanvasData/setStudentData), saveCanvasEdit, dispatch(addPendingChange).
   * CALLED BY: VoiceNoteRecorder onDelete (footer Delete button).
   * AFFECTS: studentData.notes.<surah_verse> — removes the audio note line + sync-queues the change.
   */
  const handleVoiceNoteDelete = useCallback(async (vKey: string) => {
    if (!currentStudent) return;
    const existing = canvasData.notes?.[vKey] || '';
    const cleaned = existing.split('\n').filter((l: string) => !l.startsWith('audio:')).join('\n');
    const notes = { ...(canvasData.notes || {}) };
    if (cleaned) notes[vKey] = cleaned; else delete notes[vKey];
    setCanvasData((prev: any) => ({ ...prev, notes }));
    dispatch(setStudentData({ ...(studentData || {}), notes }));
    const [s, v] = vKey.split('_').map(Number);
    const page = await getVersePage(s, v, textStyleRef.current).catch(() => 0);
    const key = page > 0 ? canvasKeyForPage(page) : canvasKeyForSurah(s);
    saveCanvasEdit(currentStudent.id, key, 'notes', { [vKey]: cleaned });
    dispatch(addPendingChange());
  }, [canvasData, currentStudent, studentData, dispatch]);

  /**
   * WHAT: Opens the share menu (toggles: Drawings / Mistakes / Bookmarks + Share).
   * FLOW: no capture happens here — just showShareMenu=true; runShare does the work.
   * CALLED BY: AnimatedHeader onShare (toolbar Share button).
   */
  const handleSharePage = async () => { setShowShareMenu(true); };

  /**
   * WHAT: Captures the reading area (viewShotRef wrapper, collapsable={false}) as a
   *   JPG via captureRef and opens the native share sheet — only the annotation
   *   layers whose menu toggle is ON are rendered in the image.
   * FLOW: close menu, hide header (restored in finally), isCapturing=true, wait
   *   150ms for re-layout, captureRef(viewShotRef, {format:'jpg', quality:0.95}),
   *   Share.open (file:// prefix on Android), spinner overlay while capturing.
   * CALLS: captureRef (react-native-view-shot), Share.open (react-native-share).
   * AFFECTS: isHeaderVisible/isCapturing during capture; DrawingCanvas is
   *   unmounted while capturing and StaticDrawingOverlay re-draws the paths
   *   (only when shareDrawings is ON); highlights/bookmarks props are emptied
   *   when their toggle is OFF so they stay out of the image.
   */
  const runShare = async () => {
    setShowShareMenu(false);
    const wasHeaderVisible = isHeaderVisible;
    try { setIsHeaderVisible(false); setIsCapturing(true); await new Promise<void>(r => setTimeout(() => r(), 150)); const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.95 }); await Share.open({ url: Platform.OS === 'android' ? `file://${uri}` : uri, type: 'image/jpeg', title: 'Quran Page' }); }
    catch (e: any) { console.warn('Share failed:', e?.message || e); } finally { setIsCapturing(false); setIsHeaderVisible(wasHeaderVisible); }
  };

  /**
   * WHAT: PanGestureHandler vertical/horizontal swipes — header toggle + surah
   *   switching. Handler is DISABLED while drawing and in page mode.
   * FLOW: only on State.END; skip if isDrawing. Vertical (|ty|>40 or |vy|>300):
   *   top half — swipe down shows / up hides; bottom half inverted. Horizontal
   *   (|tx|>50, ayah/continuous only): prev/next surah via setSurah.
   * CALLS: setSurah (surah switch), setIsHeaderVisible.
   * CALLED BY: PanGestureHandler onHandlerStateChange with activeOffsetY=[-15,15]
   *   / activeOffsetX=[-25,25].
   * AFFECTS: isHeaderVisible; s.quran.currentSurahId (surah switch).
   * NOTES: GOTCHA — horizontal surah-swipes are dead in page mode by design
   *   (handler disabled); header toggling there is covered by the edge-strip
   *   Pressables instead.
   */
  const onSwipe = (event: any) => {
    if (isDrawing) return;
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY, velocityY, y } = event.nativeEvent;
      const isTopHalf = y < Dimensions.get('window').height / 2;
      if (Math.abs(translationY) > 40 || Math.abs(velocityY) > 300) {
        if (isTopHalf) {
          setIsHeaderVisible(translationY > 0); // swipe down shows, swipe up hides
        } else {
          setIsHeaderVisible(translationY < 0); // swipe up shows, swipe down hides
        }
      } else if (readingMode !== 'page') {
        if (translationX > 50 && currentSurahId > 1) dispatch(setSurah({ surahId: currentSurahId - 1, verses: [] }));
        else if (translationX < -50 && currentSurahId < 114) dispatch(setSurah({ surahId: currentSurahId + 1, verses: [] }));
      }
    }
  };

  // ---- drawing math: split-mode path composition for canvas + share overlay ----
  const halfOrigin = splitOn ? Math.round(winW / 2 + GUTTER / 2) : 0;
  const splitMidX = Math.round(winW / 2);
  const translatePaths = (paths: any[], dx: number): any[] => paths.map((p: any) => ({ ...p, points: (p.points || []).map((pt: string) => { const [x, y] = pt.split(',').map(Number); return `${Math.round(x + dx)},${Math.round(y)}`; }) }));
  const midXOf = (p: any): number => { const pts = (p.points || []).map((pt: string) => Number(pt.split(',')[0])); return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0; };
  // drawings keyed by page (page mode) or surah (ayah/continuous — the SAME surah key is shared by both modes)
  const composeSpreadPaths = () => splitOn
    ? [...(studentData?.drawings?.[spreadOddKey || '']?.paths || []), ...translatePaths(studentData?.drawings?.[spreadEvenKey || '']?.paths || [], halfOrigin)]
    : studentData?.drawings?.[drawingKey]?.paths;
  const capturePaths = composeSpreadPaths();
  // Share toggles apply ONLY while capturing — normal reading keeps everything.
  const captureHighlights = isCapturing && !shareMistakes ? {} : canvasData.highlights;
  const captureBookmarks = isCapturing && !shareBookmarks ? {} : studentData?.bookmarks;
  const readingMarkVerse = (() => {
    const lr = studentData?.lastRead;
    const s = Number(lr?.surah);
    return lr && s > 0 && s === Number(currentSurahId) ? Number(lr.verse) : null;
  })();
  // Reading-mark ribbon is driven PER PAGE: pageLastVerseFor derives the last verse
  // synchronously from the page's own mushaf JSON (pageCache) — fallback to the async
  // pageVersesCache row only when pageData is missing — so the button appears in the same
  // commit as the page, single + spread, including pre-rendered pages while swiping.
  const pageLastVerseFor = useCallback((p: number) => {
    const fromData = pageLastVerseFromPageData(pageCache[p]);
    if (fromData) return fromData;
    const vs = pageVersesCache[p] || [];
    return vs.length ? vs[vs.length - 1] : null;
  }, [pageCache, pageVersesCache]);
  /**
   * WHAT: Whether the given page-last verse carries the READ BOOKMARK (studentData.lastRead) —
   *   per-page active state for the reading-mark ribbon. Same match logic StudentHub's DAILY
   *   RECITATION row uses.
   * CALLS: none (pure read of studentData).
   * CALLED BY: SpreadItem + single-page MushafPageView (readingMarkActive prop).
   */
  const readingMarkActiveFor = useCallback((lv: any) => {
    const lr = studentData?.lastRead;
    return !!lv && !!lr && Number(lr.surah) === Number(lv.surahId) && Number(lr.verse) === Number(lv.verseNumber);
  }, [studentData?.lastRead]);

  /**
   * WHAT: Toggles the READ BOOKMARK (studentData.lastRead) anchored at the given page's LAST
   *   verse — the same reading mark StudentHub's DAILY RECITATION row reads. One tap pins it at
   *   the end of that page; a second tap on the same verse clears it back to null.
   * CALLS: updateData (optimistic Redux + debounced SQLite/sync funnel).
   * CALLED BY: the floating top-page bookmark ribbon (page mode only).
   * AFFECTS: studentData.lastRead.{surah, verse, updatedAt}.
   */
  const handleReadingMarkToggle = useCallback((lv: any) => {
    if (!lv) return;
    const lr = studentData?.lastRead;
    const isMarked = lr && Number(lr.surah) === Number(lv.surahId) && Number(lr.verse) === Number(lv.verseNumber);
    updateData({
      ...studentData,
      lastRead: isMarked ? null : { surah: Number(lv.surahId), verse: Number(lv.verseNumber), updatedAt: new Date().toISOString() },
    });
    ReactNativeHapticFeedback.trigger('impactLight');
  }, [studentData, updateData]);

  /**
   * WHAT: Plays from a given verse (menu "Play"). qariId = currentQari includes
   *   'Afasy' ? 'ar.alafasy' : 'ar.abdulbasit' — the ONLY two wired qaris.
   * FLOW: if already playing: setPlaying(false) + pauseSurah + clear flash.
   *   Verse->surah resolution in page mode: pageVersesCache lookup, falling
   *   back to a fresh getVersesByPage fetch, then currentSurahId. Clamp with
   *   SURAH_VERSE_COUNTS. callbacks: onVerseChange -> flashingSurah/flashingVerse;
   *   onEnd/onError -> playing=false + flash cleared + Alert on error. Then
   *   playSurahFromVerse(audioPlayer.current, ...) -> setPlaying(true).
   * CALLS: playSurahFromVerse / pauseSurah (audioPlayback.ts), getVersesByPage,
   *   setPlaying, setFlashingVerse/setFlashingSurah.
   * CALLED BY: menu Play button.
   * AFFECTS: s.audio.isPlaying; flash state during playback; streams from
   *   quran.com timeline with per-ayah fallback.
   */
  const startPlayFromVerse = async (verse: number | { surahId: number; verseNumber: number }, opts?: { playBasmala?: boolean }) => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurah(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
    const verseNum = typeof verse === 'number' ? verse : verse.verseNumber;
    const surahId = typeof verse === 'number'
      ? (readingMode === 'page'
        ? (pageVersesCache[currentPageNum]?.find((v: any) => v.verseNumber === verseNum)?.surahId
          || (await getVersesByPage(currentPageNum, textStyleRef.current).then((list: any[]) => list?.find((v: any) => v.verseNumber === verseNum)?.surahId).catch(() => undefined))
          || currentSurahId)
        : currentSurahId)
      : verse.surahId;
    const clamped = Math.max(1, Math.min(verseNum, SURAH_VERSE_COUNTS[surahId - 1] || 1));
    const callbacks = {
      onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
      onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
      onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
    };
    try {
      await playSurahFromVerse(audioPlayer.current, qariId, surahId, clamped, callbacks, { playBasmala: opts?.playBasmala ?? !!playBasmala });
      dispatch(setPlaying(true));
    } catch { dispatch(setPlaying(false)); }
  };

  /**
   * WHAT: Toggles play/pause of the current surah from the AudioPlayerBar.
   * FLOW: playing -> setPlaying(false) + pauseSurahWithResume + clear flash.
   *   Not playing: if isResumable() try resumeSurah; else start from the first
   *   verse of the current page (page mode, pageVersesCache or fresh
   *   getVersesByPage fetch) or verse 1. Same callbacks as startPlayFromVerse.
   * CALLS: resumeSurah / isResumable / pauseSurahWithResume / playSurahFromVerse
   *   (audioPlayback.ts), getVersesByPage, setPlaying.
   * CALLED BY: AudioPlayerBar onTogglePlay.
   * AFFECTS: s.audio.isPlaying; flash state during playback.
   * NOTES: pauseSurahWithResume (not pauseSurah) so the bar's play can resume
   *   the same position — resume path is a NEWER addition vs the anatomy doc.
   */
  const togglePlayAudio = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurahWithResume(audioPlayer.current).catch(() => {}); }
    else {
      const callbacks = {
        onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
        onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
        onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
      };
      if (isResumable()) {
        const ok = await resumeSurah(audioPlayer.current, qariId, callbacks);
        if (ok) { dispatch(setPlaying(true)); return; }
      }
      let firstVerse = readingMode === 'page' ? pageVersesCache[currentPageNum]?.[0] : null;
      if (!firstVerse && readingMode === 'page') {
        try { const list = await getVersesByPage(currentPageNum, textStyleRef.current); firstVerse = Array.isArray(list) ? list[0] : undefined; } catch {}
      }
      const startVerse = firstVerse?.verseNumber || 1;
      const surahId = firstVerse?.surahId || currentSurahId;
      try {
        await playSurahFromVerse(audioPlayer.current, qariId, surahId, startVerse, callbacks, { playBasmala: !!playBasmala });
        dispatch(setPlaying(true));
      } catch { dispatch(setPlaying(false)); }
    }
  };

  /**
   * WHAT: New-surah-on-page detection for the footer NEW SURAH button: the
   *   first verse of a page that is verse 1 of its surah (i.e. the surah
   *   starts on this page). In split view both halves of the visible spread
   *   are scanned (left odd page first, then the even page) and the FIRST new
   *   surah in reading order wins — a page with 2 surahs (end of one + start
   *   of the next) yields the one that actually starts there. Flowing/ayah
   *   modes have no pages -> null -> button greyed out.
   * CALLS: none.
   * CALLED BY: footer render (canPlayNewSurah) + playNewSurah.
   */
  const newSurahOnPage = readingMode === 'page'
    ? (() => {
        const pagesToScan = [currentPageNum];
        if (splitOn) {
          const left = currentPageNum % 2 === 0 ? currentPageNum - 1 : currentPageNum;
          const right = currentPageNum % 2 === 0 ? currentPageNum : currentPageNum + 1;
          pagesToScan[0] = left;
          if (right >= 1 && right <= pageNumbers.length) pagesToScan.push(right);
        }
        for (const pg of pagesToScan) {
          const found = (pageVersesCache[pg] || []).find((v: any) => v.verseNumber === 1);
          if (found) return found;
        }
        return null;
      })()
    : null;

  /**
   * WHAT: Footer PLAY button — starts playback from the page's first verse
   *   (page mode; falls back to a fresh getVersesByPage fetch) or from verse 1
   *   of the current surah in ayah/continuous mode. When LOOP is enabled in
   *   Loop Settings, PAGE START becomes the LOOP START: playback begins at
   *   loop.startVerse and cycles startVerse..endVerse loopCount times (each
   *   ayah replayed ayahRepeat times), then flows on past the range.
   * CALLS: playSurahFromVerse / pauseSurah (audioPlayback.ts), getVersesByPage.
   * CALLED BY: AudioPlayerBar onPlayPageStart.
   */
  const playPageStart = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) {
      // LOOP END while playing: STOP (not restart). pauseSurahWithResume keeps the
      // resume session at the exact mid-verse position and cancelLoop clears the
      // active range, so the next RESUME continues from the current verse and flows
      // linearly past the range (7 -> 8 -> 9 -> 10 ...) instead of cycling back.
      cancelLoop();
      dispatch(setPlaying(false));
      await pauseSurahWithResume(audioPlayer.current).catch(() => {});
      dispatch(setFlashingVerse(null));
      return;
    }
    let firstVerse = readingMode === 'page' ? pageVersesCache[currentPageNum]?.[0] : null;
    if (!firstVerse && readingMode === 'page') {
      try { const list = await getVersesByPage(currentPageNum, textStyleRef.current); firstVerse = Array.isArray(list) ? list[0] : undefined; } catch {}
    }
    const callbacks = {
      onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
      onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
      onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
    };
    const loopOn = !!loopSettings?.enabled;
    // Loop targets its OWN surah when one is picked in Loop Settings (0 = the surah
    // currently open); every range value below is clamped against that surah's length.
    const loopSurahId = loopOn && Number(safeLoop.surahId) ? Number(safeLoop.surahId) : currentSurahId;
    const lastVerse = SURAH_VERSE_COUNTS[loopSurahId - 1] || 1;
    const startVerse = loopOn ? Math.max(1, Math.min(safeLoop.startVerse || 1, lastVerse)) : (firstVerse?.verseNumber || 1);
    const surahId = loopOn ? loopSurahId : (firstVerse?.surahId || currentSurahId);
    const loopOpts = loopOn ? { loop: { startVerse: startVerse, endVerse: Math.max(startVerse, Math.min(safeLoop.endVerse || lastVerse, lastVerse)), loopCount: Math.max(1, safeLoop.loopCount || 1), ayahRepeat: Math.max(1, safeLoop.ayahRepeat || 1) } } : {};
    try {
      await playSurahFromVerse(audioPlayer.current, qariId, surahId, startVerse, callbacks, { playBasmala: !!playBasmala, ...loopOpts });
      dispatch(setPlaying(true));
    } catch { dispatch(setPlaying(false)); }
  };

  /**
   * WHAT: Center-bar PLAY button (fresh, nothing to resume) — starts playback from
   *   verse 1 of the CURRENT surah, regardless of which ayah/page you're on. This
   *   is the surah-start behavior, unlike PAGE START which begins at the current
   *   page's first verse (which can be mid-surah).
   * CALLS: playSurahFromVerse / pauseSurah (audioPlayback.ts).
   * CALLED BY: AudioPlayerBar onPlaySurahStart (when the label reads PLAY).
   */
  const playSurahStart = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurah(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
    const callbacks = {
      onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
      onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
      onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
    };
    try {
      await playSurahFromVerse(audioPlayer.current, qariId, currentSurahId, 1, callbacks, { playBasmala: !!playBasmala });
      dispatch(setPlaying(true));
    } catch { dispatch(setPlaying(false)); }
  };

  /**
   * WHAT: Footer NEW SURAH button — starts playback from verse 1 of the surah
   *   that begins on the current page; no-op when none does.
   * CALLS: playSurahFromVerse / pauseSurah (audioPlayback.ts).
   * CALLED BY: AudioPlayerBar onPlayNewSurah.
   */
  const playNewSurah = async () => {
    if (!newSurahOnPage) return;
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurah(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
    const callbacks = {
      onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
      onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
      onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
    };
    try {
      await playSurahFromVerse(audioPlayer.current, qariId, newSurahOnPage.surahId, 1, callbacks, { playBasmala: true });
      dispatch(setPlaying(true));
    } catch { dispatch(setPlaying(false)); }
  };

  /**
   * WHAT: Footer ◀/▶ buttons — restart playback at the adjacent verse (no
   *   basmala prelude even when landing on verse 1). At verse 1 going back is
   *   a no-op; at the surah's last verse going forward stops playback.
   * CALLS: getCurrentPlaybackVerse / playSurahFromVerse via startPlayFromVerse.
   * CALLED BY: AudioPlayerBar onPrevVerse/onNextVerse.
   */
  const stepVerse = useCallback((dir: number) => {
    if (!isPlaying) return;
    const cur = getCurrentPlaybackVerse() || 1;
    const max = SURAH_VERSE_COUNTS[currentSurahId - 1] || 1;
    const next = Math.max(1, Math.min(cur + dir, max));
    if (next === cur) {
      if (dir > 0 && cur === max) { dispatch(setPlaying(false)); pauseSurah(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
      return;
    }
    startPlayFromVerse(next, { playBasmala: false });
  }, [isPlaying, currentSurahId]);

  /**
   * WHAT: Floating 6-button menu bubble placement — above/below the press point
   *   (menuY), horizontally centered, clamped to the screen; centered overlay
   *   when menuY is null.
   * FLOW: upperHalf = menuY < windowH/2; top = menuY+12 (below) or
   *   menuY-12-MENU_BUBBLE_H (above); clamp top to [60, windowH-20-MENU_BUBBLE_H].
   * AFFECTS: menu modal bubble position.
   */
  const menuPos = useMemo(() => {
    if (menuY === null) return null;
    const { width: windowW, height: windowH } = Dimensions.get('window');
    const upperHalf = menuY < windowH / 2;
    let top = upperHalf ? menuY + 12 : menuY - 12 - MENU_BUBBLE_H;
    if (top < 60) top = 60;
    if (top + MENU_BUBBLE_H > windowH - 20) top = windowH - 20 - MENU_BUBBLE_H;
    return { top, left: (windowW - MENU_BUBBLE_W) / 2, width: MENU_BUBBLE_W, arrowUp: upperHalf, arrowDown: !upperHalf };
  }, [menuY]);

  return (
    <View style={[styles(nightMode).container, { backgroundColor: bgColor }]}
      onTouchStart={() => {
        if (userBusyReleaseTimerRef.current) { clearTimeout(userBusyReleaseTimerRef.current); userBusyReleaseTimerRef.current = null; }
        drainPausedRef.current = true;
      }}
      onTouchEnd={() => {
        if (userBusyReleaseTimerRef.current) clearTimeout(userBusyReleaseTimerRef.current);
        userBusyReleaseTimerRef.current = setTimeout(() => { drainPausedRef.current = false; userBusyReleaseTimerRef.current = null; }, 500);
      }}
      onTouchCancel={() => {
        if (userBusyReleaseTimerRef.current) clearTimeout(userBusyReleaseTimerRef.current);
        userBusyReleaseTimerRef.current = setTimeout(() => { drainPausedRef.current = false; userBusyReleaseTimerRef.current = null; }, 500);
      }}>
      <AnimatedHeader visible={isHeaderVisible} surahName={headerInfo.surahName} surahId={headerInfo.surahId} juz={headerInfo.juz} page={headerInfo.page} pagesLeftInJuz={headerInfo.pagesLeftInJuz} nightMode={nightMode} showInfo={true}
        onBack={() => navigation.goBack()} onOpenList={() => { setSearchMode('surah'); setShowList(true); }} onMistakes={() => navigation.navigate('Mistakes')}
        onShare={handleSharePage} onNotes={() => navigation.navigate('Notes')} onBookmarks={() => navigation.navigate('Bookmarks')} onSettings={() => navigation.navigate('Settings')}
        onOpenJuz={() => { setSearchMode('juz'); setShowList(true); }} onOpenPage={() => { setSearchMode('page'); setShowList(true); }} />
      <View style={{ flex: 1, backgroundColor: bgColor }} ref={viewShotRef} collapsable={false}>
        <GestureHandlerRootView style={{ flex: 1 }}><PanGestureHandler onHandlerStateChange={onSwipe} activeOffsetY={[-15, 15]} activeOffsetX={[-25, 25]} enabled={!isDrawing && readingMode !== 'page'}>
          <View style={{ flex: 1, position: 'relative' }}>
            {/* ---- edge-tap Pressables: header toggle in PAGE mode (PanGesture handler is disabled there) ---- */}
            <Pressable style={[styles(nightMode).edgeTapLeft, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />
            <Pressable style={[styles(nightMode).edgeTapRight, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />

            {/* ================= ayah mode: vertical FlatList of VerseDisplay rows ================= */}
            {readingMode === 'ayah' && (
              <FlatList ref={flatListRef} data={verses} keyExtractor={(item: any) => item.id.toString()}
                contentContainerStyle={{ padding: IS_TABLET ? 40 : 20 }}
                renderItem={({ item }: any) => (
                  <VerseDisplay verse={item} highlights={captureHighlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights}
                    isBookmarked={!!captureBookmarks?.[`${currentSurahId}_${item.verseNumber}`]} isReadingMark={readingMarkVerse === item.verseNumber}
                    onWordPress={onWordPress(item.verseNumber)} onBookmarkToggle={onBookmarkToggle(item.verseNumber)} onVerseLongPress={handleVerseLongPress}
                    showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} onDeadTap={toggleHeader} />
                )}
                onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) { setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false)); } }}
                onEndReachedThreshold={0.5} ListFooterComponent={loadingMore ? <ActivityIndicator color={(nightMode ? '#7BA7DB' : '#1C3D72')} /> : null}
                initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} scrollEventThrottle={16} />
            )}

            {/* ================= continuous mode: ScrollView + FlowingText ================= */}
            {readingMode === 'continuous' && (
              <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingHorizontal: IS_TABLET ? 24 : 12, paddingVertical: 20 }}
                onScroll={({ nativeEvent }: any) => {
                  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                  if (contentOffset.y >= contentSize.height - layoutMeasurement.height - 100) {
                    if (!loadingMore && hasMore && verses.length > 0) {
                      setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false));
                    }
                  }
                }} scrollEventThrottle={100}>
                <FlowingText verses={verses} highlights={captureHighlights} onWordPress={handleWordFlow} onVerseLongPress={handleVerseLongPress}
                  onBookmarkToggle={handleBookmarkFlow} showTranslation={showTranslation} fontSize={fontSize}
                  bookmarks={captureBookmarks}
                  notes={canvasData.notes} readingMarkVerse={readingMarkVerse} flashingVerse={flashingVerse} onDeadTap={toggleHeader} />
                {loadingMore && <ActivityIndicator color={(nightMode ? '#7BA7DB' : '#1C3D72')} />}
              </ScrollView>
            )}

            {/* ================= page mode: horizontal inverted paging FlatList of mushaf pages ================= */}
            {readingMode === 'page' && (
              <FlatList ref={pageFlatListRef} data={splitOn ? pagePairsFor(pageNumbers.length) : pageNumbers}
                keyExtractor={splitOn ? (item: any) => String(item[0]) : (item: any) => item.toString()}
                horizontal inverted showsHorizontalScrollIndicator={false}
                snapToInterval={winW} snapToAlignment="center" decelerationRate="fast" disableIntervalMomentum={true}
                removeClippedSubviews={true} scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: IS_TABLET ? 20 : 10 }}
                getItemLayout={(data, index) => ({ length: winW, offset: winW * index, index })}
                // v62-style lean virtualization: only the visible page + its immediate neighbours
                // are ever mounted, so button presses and navigation never queue behind a wall of
                // background-rendered mushaf pages.
                initialNumToRender={3} maxToRenderPerBatch={3} windowSize={3}
                updateCellsBatchingPeriod={40}
                onScroll={({ nativeEvent }: any) => { lastScrollOffsetRef.current = nativeEvent.contentOffset.x; }}
                onScrollToIndexFailed={(info) => { programmaticScrollRef.current = Date.now(); pageFlatListRef.current?.scrollToOffset({ offset: info.index * winW, animated: false }); }}
                onScrollBeginDrag={() => { hiddenScrollingRef.current = true; }}
                onMomentumScrollEnd={(e) => {
                  // v76 — the swipe is over; the hidden pre-measure worker may resume (the
                  // settledPage debounce below still pauses it for the 120ms settle window).
                  hiddenScrollingRef.current = false;
                  if (Date.now() - programmaticScrollRef.current < 400) return;
                  // v76.2 — self-validating page derivation. The inverted FlatList can (rarely)
                  // fire momentum-end with a STALE offset right after a fast fling (cells
                  // re-attach / the reported offset lags the real position). Trusting it made
                  // the reader "randomly go to Al-Fatiha": a stale ~0 offset → page 1 →
                  // setCurrentPageNum(1) + setSurah(Al-Fatiha), and the settle then saved page 1
                  // as lastPageSeen (poisoning RESUME too). Guard: if the event's offset
                  // disagrees with the last live onScroll position by more than one page, trust
                  // the live position instead.
                  const reported = e.nativeEvent.contentOffset.x;
                  const live = lastScrollOffsetRef.current;
                  const off = (live !== null && Math.abs(reported - live) > winW) ? live : reported;
                  const idx = Math.round(off / winW);
                  const p = splitOn ? anchorFromIndex(idx) : idx + 1;
                  if (p !== currentPageNum) {
                    setCurrentPageNum(p); setHeaderPage(p);
                    // FIX 8 — debounce the heavy per-page effects to the page that survives
                    // 120ms after the last momentum settle.
                    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
                    settleTimerRef.current = setTimeout(() => setSettledPage(p), 120);
                    prefetchAround(splitOn ? 'split' : 'single', p);
                    const pData = pageCache[p];
                    if (pData) {
                      const firstWord = pData.lines?.find((l: any) => l.words?.length > 0)?.words?.[0];
                      if (firstWord?.location) {
                        const sId = parseInt(firstWord.location.split(':')[0], 10);
                        if (sId && sId !== currentSurahId) { pageScrollSurahChangeRef.current = true; dispatch(setSurah({ surahId: sId, verses: [] })); }
                      }
                    }
                  }
                }}
                renderItem={splitOn ? ({ item }: any) => (
                  <SpreadItem pair={item} winW={winW} pageW={pageW} headerVisible={isHeaderVisible} surahNames={surahNames} pageCache={pageCache} pageVersesCache={pageVersesCache}
                    highlights={captureHighlights} onWordPress={handleWordFlow} onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress} onBadgePress={handleVerseLongPress}
                    bookmarks={captureBookmarks} flashingVerseKey={flashingVerse ? `${flashingSurah || currentSurahId}_${flashingVerse}` : null}
                    notes={canvasData.notes} readingMarkVerse={readingMarkVerse} onDeadTap={toggleHeader}
                    ensurePageLoaded={ensurePageLoaded} ensurePageVersesLoaded={ensurePageVersesLoaded}
                    onSpread={splitCapable ? handleToggleSpread : undefined} spread={splitOn}
                    readingMode={readingMode} isCapturing={isCapturing} pageLastVerseFor={pageLastVerseFor}
                    readingMarkActiveFor={readingMarkActiveFor} onReadingMarkToggle={handleReadingMarkToggle} onMeasured={handleVisibleMeasured} />
                ) : ({ item }: any) => (
                  <PageCell item={item} winW={winW} headerVisible={isHeaderVisible} surahNames={surahNames} pageCache={pageCache} pageVersesCache={pageVersesCache}
                    highlights={captureHighlights} onWordPress={handleWordFlow} onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress} onBadgePress={handleVerseLongPress}
                    bookmarks={captureBookmarks} flashingVerseKey={flashingVerse ? `${flashingSurah || currentSurahId}_${flashingVerse}` : null}
                    notes={canvasData.notes} readingMarkVerse={readingMarkVerse} onDeadTap={toggleHeader}
                    ensurePageLoaded={ensurePageLoaded} ensurePageVersesLoaded={ensurePageVersesLoaded}
                    onSpread={splitCapable ? handleToggleSpread : undefined} spread={splitOn}
                    readingMode={readingMode} isCapturing={isCapturing} pageLastVerseFor={pageLastVerseFor}
                    readingMarkActiveFor={readingMarkActiveFor} onReadingMarkToggle={handleReadingMarkToggle} onMeasured={handleVisibleMeasured}
                    nightMode={nightMode} />
                )} />
            )}

            {/* v76 — background hidden pre-measure slot: ONE off-screen page measuring at a time
                 (hideFrame — never touches the shared frame cache; same margins as the visible
                 page box so the measured geometry is identical). Its layout row lands in
                 layoutCacheMem only (persistLayout={false} — P0-C: background writes never queue
                 behind the reader's own connection), so arrival renders instantly as an
                 in-memory cache hit. */}
            {readingMode === 'page' && hiddenWarmPage && pageCache[hiddenWarmPage] && (
              <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0, bottom: 0, width: splitOn ? pageW : winW, overflow: 'hidden', opacity: 0.999 }}>
                <View style={{ flex: 1, marginHorizontal: winW >= 600 ? 10 : 6, marginTop: 24, marginBottom: 28 }}>
                  <MushafPageView hideFrame persistLayout={false} pageNum={hiddenWarmPage} pageWidth={splitOn ? pageW : winW} headerVisible={isHeaderVisible} surahNames={surahNames}
                    versesForPage={pageVersesCache[hiddenWarmPage] || []} pageData={pageCache[hiddenWarmPage]} highlights={captureHighlights}
                    onWordPress={() => {}} onBookmarkToggle={() => {}} onVerseLongPress={() => {}} onBadgePress={() => {}}
                    bookmarks={captureBookmarks} notes={canvasData.notes} onMeasured={handleHiddenMeasured} />
                </View>
              </View>
            )}

            {/* share capture: re-draws saved drawing paths on top of the page while capturing (only when Drawings toggle is ON) */}
            {isCapturing && shareDrawings && capturePaths?.length > 0 && (<StaticDrawingOverlay paths={capturePaths} />)}
          </View>
        </PanGestureHandler></GestureHandlerRootView>
      </View>

      {/* ================= drawing wiring: canvas + toolbar (error-boundary wrapped) ================= */}
      {isDrawing && (
        <DrawingCanvas ref={canvasRef} visible={isDrawing && !isCapturing}
          initialPaths={composeSpreadPaths()}
          onSave={(paths: any) => {
            if (!studentData) return;
            const geo = { canvasW: splitOn ? pageW : winW, canvasH: winH, padX: hPadFor(splitOn ? pageW : winW) };
            if (!splitOn) {
              updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date() } } });
              pushDrawings(currentStudent.id, drawingKey.startsWith('page_') ? rangeKeyForPage(currentPageNum) : drawingKey, [drawingKey], geo);
              return;
            }
            const even: any[] = []; const odd: any[] = [];
            for (const p of paths) { if (midXOf(p) >= splitMidX) even.push(p); else odd.push(p); }
            updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [spreadEvenKey!]: { paths: translatePaths(even, -halfOrigin), updatedAt: new Date() }, [spreadOddKey!]: { paths: odd, updatedAt: new Date() } } });
            pushDrawings(currentStudent.id, rangeKeyForPage(currentPageNum), [spreadOddKey!, spreadEvenKey!], geo);
          }}
          onStateChange={(u: boolean, r: boolean) => setCanvasUndoState({ canUndo: u, canRedo: r })}
          onGestureStart={() => setDrawingGestureActive(true)} onGestureEnd={() => setDrawingGestureActive(false)} />
      )}

      {/* ---- AnnotationToolbar: undo/redo/clear/exit + activate-draw; onActivateDraw remembers the
           header state (headerVisibleBeforeDrawRef), hides the header, then setIsDrawing(true) ---- */}
      <ToolbarBoundary>
        <AnnotationToolbar visible={!isCapturing} drawingGestureActive={drawingGestureActive} onUndo={() => canvasRef.current?.undo()} onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()} onExit={() => { if (isDrawing) { setIsDrawing(false); setIsHeaderVisible(headerVisibleBeforeDrawRef.current); } else { dispatch(setToolbarExpanded(false)); } }}
          canUndo={canvasUndoState.canUndo} canRedo={canvasUndoState.canRedo}
          onActivateDraw={() => { if (!isDrawing) { headerVisibleBeforeDrawRef.current = isHeaderVisible; setIsHeaderVisible(false); setIsDrawing(true); }}} />
      </ToolbarBoundary>

      {/* share spinner overlay */}
      {isCapturing && <View style={styles(nightMode).capturingOverlay}><ActivityIndicator size="large" color={(nightMode ? '#7BA7DB' : '#1C3D72')} /></View>}
      {/* bottom playback bar — visible only while the header is visible and no note is being recorded
          (hides together with the header, incl. via the edge/dead taps). Layout-only wrapper measured
          via onLayout (playerBarH) so the header-toggle pill can anchor above the bar, never on it. */}
      {!recordingVerseKey && isHeaderVisible && (
        <View onLayout={(e: any) => { const h = e.nativeEvent.layout.height; if (h > 0 && h !== playerBarH) setPlayerBarH(h); }}>
          <AudioPlayerBar nightMode={nightMode} surahId={currentSurahId} onOpenQari={() => setShowQariModal(true)} onOpenLoopSettings={() => navigation.navigate('LoopSettings' as any, { page: currentPageNum } as any)} onResume={togglePlayAudio} onPlayPageStart={playPageStart} onPlayNewSurah={playNewSurah} canPlayNewSurah={!!newSurahOnPage} onPrevVerse={() => stepVerse(-1)} onNextVerse={() => stepVerse(1)} canStep={isPlaying} isPlaying={isPlaying} canResume={isResumable()} loopEnabled={!!loopSettings?.enabled} />
        </View>
      )}

      {/* ---- Show/Hide Header oval button — ALWAYS on-screen (both header states); aligned to the
             SAME visual row as the bottom pills (Page N / N pages left): those pills hang at
             bottom:-26 inside the page wrapper (wrapper marginBottom 28), so their bottom edge sits
             ~2px above the screen bottom (header hidden) or ~2px above the audio bar's top edge
             (header visible — the page's bottom edge then sits directly above the in-flow bar).
             The toggle is screen-level, so bottom = playerBarH + 2 reproduces that exact row in
             both states; the pill NEVER lands on the bar's controls (play/prev/next live inside the
             bar, below its top edge) nor on the frame's bottom band (the 28px margin band is below
             the frame entirely). One-frame edge case: when the header becomes visible playerBarH
             may still be 0 → bottom:2, on the row, above where the bar is mounting. ---- */}
      {/* v78 — PAGE MODE + header SHOWING: the button stretches to fill the 28px margin band —
             top touching the frame's bottom edge, bottom touching the footer pill row — by pinning
             the wrap's height to 26 (= 28 band − 2px footer clearance) and letting the button fill
             it. Other modes/header-hidden keep the compact pill size. */}
      {!isDrawing && !isCapturing && !recordingVerseKey && (
        <View style={[styles(nightMode).headerToggleWrap,
          readingMode === 'page' && isHeaderVisible ? { bottom: playerBarH + 2, height: 26 } : { bottom: (isHeaderVisible ? playerBarH : 0) + 2 }]}
          pointerEvents="box-none">
          <TouchableOpacity style={[styles(nightMode).headerToggleBtn, readingMode === 'page' && isHeaderVisible && { flex: 1 }]} onPress={toggleHeader} activeOpacity={0.75} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles(nightMode).headerToggleText}>{isHeaderVisible ? 'Hide Header' : 'Show Header'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* surah picker modal (onSelect -> setSurah reload; onSelectPage -> page jump) + qari picker */}
      <SurahList visible={showList} mode={searchMode} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} onSelectPage={handleSelectPage} onSelectJuz={handleSelectJuz} />
      <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />



      {/* ---- long-press verse menu: floating 6-button bubble (Play/Bookmark/Reading/Note/Record/Copy) ---- */}
      <Modal visible={menuVerse !== null} transparent animationType="fade" onRequestClose={() => { setMenuVerse(null); setMenuY(null); }}>
        <TouchableOpacity style={[styles(nightMode).menuOverlay, menuY === null && styles(nightMode).menuOverlayCentered]} activeOpacity={1} onPress={() => { setMenuVerse(null); setMenuY(null); }}>
          <View style={menuY === null ? styles(nightMode).bubbleCenteredWrap : [styles(nightMode).bubbleWrap, { top: menuPos?.top ?? 0, left: menuPos?.left ?? 0, width: menuPos?.width ?? 0 }]}>
            {menuPos?.arrowUp && <View style={[styles(nightMode).bubbleArrow, { top: -6, backgroundColor: MENU_BUBBLE_BG }]} />}
            {menuPos?.arrowDown && <View style={[styles(nightMode).bubbleArrow, { bottom: -6, backgroundColor: MENU_BUBBLE_BG }]} />}
            <View style={styles(nightMode).bubble}>
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={() => { setMenuVerse(null); setMenuY(null); startPlayFromVerse(menuVerse!); }}><IconPlay c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Play</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={() => { setMenuVerse(null); setMenuY(null); handleBookmarkFlow(menuVerse!); }}><IconBookmark c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Bookmark</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={() => { const v = menuVerse; setMenuVerse(null); setMenuY(null); Alert.alert('Set Reading Mark', `Start reading from verse ${v}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { if (v) updateData({ ...studentData, lastRead: { surah: currentSurahId, verse: v, updatedAt: new Date().toISOString() } }); } }]); }}><IconPin c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Reading</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={() => { openNoteModal(); setMenuVerse(null); setMenuY(null); }}><IconNote c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Note</Text></TouchableOpacity>
              {/* Record: NOTE — pauses via RAW audioPlayer.pausePlayer(), NOT pauseSurah, so the
                  audioPlayback module's playing/playToken state goes stale (ghost isSurahPlaying) */}
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={async () => { if (menuVerse) { if (isPlaying) { dispatch(setPlaying(false)); try { audioPlayer.current.pausePlayer(); } catch {} } setRecordingVerseKey(`${currentSurahId}_${menuVerse}`); } setMenuVerse(null); setMenuY(null); }}><IconMic c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Record</Text></TouchableOpacity>
              <TouchableOpacity style={styles(nightMode).bubbleBtn} onPress={() => handleCopyVerse(menuVerse!)}><IconCopy c={MENU_ICON_C} /><Text style={styles(nightMode).bubbleLabel}>Copy</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- note modal (menu Note) ---- */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={styles(nightMode).noteOverlay}>
          <View style={styles(nightMode).noteContainer}>
            <TextInput style={styles(nightMode).noteInput} value={noteText} onChangeText={setNoteText} multiline placeholder="Note..." placeholderTextColor="#666" />
            <View style={styles(nightMode).noteActions}>
              <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles(nightMode).noteCancelBtn}><Text style={{color:'#fff'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveNote} style={styles(nightMode).noteSaveBtn}><Text style={{color:'#000'}}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* voice-note recorder footer (menu Record) — replaces the player bar while recording */}
{recordingVerseKey && (
  <VoiceNoteRecorder onSaved={handleVoiceNoteSaved} onCancel={() => setRecordingVerseKey(null)} onDelete={() => handleVoiceNoteDelete(recordingVerseKey)} />
)}

      {/* share menu: include toggles + big Share button; capture runs via runShare */}
      <Modal visible={showShareMenu} transparent animationType="fade" onRequestClose={() => setShowShareMenu(false)}>
        <Pressable style={styles(nightMode).shareMenuBackdrop} onPress={() => setShowShareMenu(false)}>
          <Pressable style={styles(nightMode).shareMenuCard} onPress={() => {}}>
            <Text style={styles(nightMode).shareMenuTitle}>Share page</Text>
            <View style={styles(nightMode).shareMenuRow}>
              <Text style={styles(nightMode).shareMenuLabel}>Include drawings</Text>
              <Switch value={shareDrawings} onValueChange={setShareDrawings} trackColor={{ false: '#333', true: (nightMode ? '#7BA7DB' : '#1C3D72') }} />
            </View>
            <View style={styles(nightMode).shareMenuRow}>
              <Text style={styles(nightMode).shareMenuLabel}>Include mistakes</Text>
              <Switch value={shareMistakes} onValueChange={setShareMistakes} trackColor={{ false: '#333', true: (nightMode ? '#7BA7DB' : '#1C3D72') }} />
            </View>
            <View style={styles(nightMode).shareMenuRow}>
              <Text style={styles(nightMode).shareMenuLabel}>Include bookmarks</Text>
              <Switch value={shareBookmarks} onValueChange={setShareBookmarks} trackColor={{ false: '#333', true: (nightMode ? '#7BA7DB' : '#1C3D72') }} />
            </View>
            <TouchableOpacity style={styles(nightMode).shareMenuButton} onPress={runShare} activeOpacity={0.75}>
              <Text style={styles(nightMode).shareMenuButtonText}>Share</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * WHAT: Error boundary around AnnotationToolbar — renders null on a crash so a
 *   toolbar failure can't take down the whole reading screen.
 * NOTES: Logs the caught error via componentDidCatch.
 */
class ToolbarBoundary extends Component<any, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: any) { console.warn('[ToolbarBoundary] caught:', e?.message || e); }
  render() { return this.state.hasError ? null : this.props.children; }
}

const styles = (nightMode: boolean) => StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1 },
  capturingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  shareMenuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  shareMenuCard: { width: 300, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 20, backgroundColor: '#16181d', borderWidth: 1, borderColor: '#2a2d35' },
  shareMenuTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  shareMenuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  shareMenuLabel: { color: '#fff', fontSize: 15 },
  shareMenuButton: { marginTop: 6, borderRadius: 14, backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), paddingVertical: 14, alignItems: 'center', shadowColor: (nightMode ? '#7BA7DB' : '#1C3D72'), shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  shareMenuButtonText: { color: '#00110c', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  menuOverlay: { flex: 1, alignItems: 'center', backgroundColor: 'transparent' },
  menuOverlayCentered: { justifyContent: 'center' },
  bubbleCenteredWrap: { alignItems: 'center' },
  bubbleWrap: { position: 'absolute', alignItems: 'center' },
  bubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: MENU_BUBBLE_BG, borderRadius: 16, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  bubbleBtn: { width: MENU_BTN_W, height: 66, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bubbleLabel: { fontSize: 9, color: MENU_LABEL_C, marginTop: 4, fontWeight: '600' },
  bubbleArrow: { position: 'absolute', width: 12, height: 12, borderRadius: 2, transform: [{ rotate: '45deg' }] },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', backgroundColor: '#1e1e1e', borderRadius: 10, padding: 20 },
  noteInput: { color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72'), borderRadius: 8, flex: 1, marginLeft: 5 },
  headerToggleWrap: { position: 'absolute', left: 6, alignItems: 'flex-start', zIndex: 9998, elevation: 9998 },
  headerToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: nightMode ? 'rgba(18,18,20,0.78)' : 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: nightMode ? 'rgba(255,255,255,0.18)' : 'rgba(28,61,114,0.30)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  headerToggleText: { color: (nightMode ? '#7BA7DB' : '#1C3D72'), fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  edgeTapLeft: { position: 'absolute', top: 0, left: 0, height: '100%', zIndex: 1 },
  edgeTapRight: { position: 'absolute', top: 64, right: 0, bottom: 0, zIndex: 1 },

});

// ---- inline SVG icons for the long-press menu bubble ----
const ICON_ST = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconPlay = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M7 4.5v15l13-7.5L7 4.5z" /></Svg>
);
const IconBookmark = ({ c, s = 18, filled = false }: { c: string; s?: number; filled?: boolean }) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" {...ICON_ST} stroke={c} fill={filled ? c : 'none'}><Path d="M7 3h10v18l-5-3.6L7 21V3z" /></Svg>
);
const IconPin = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M12 2.5l1.6 5.9 5.9 1.6-5.9 1.6L12 17.5l-1.6-5.9-5.9-1.6 5.9-1.6L12 2.5z" /></Svg>
);
const IconNote = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M6 3h12v18l-4-2-4 2-4-2-2 2V3z" /><Path d="M9 8h6M9 12h6" /></Svg>
);
const IconMic = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M12 3a4 4 0 0 1 4 4v5a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z" /><Path d="M5 12a7 7 0 0 0 14 0M12 19v2" /></Svg>
);
const IconCopy = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M9 9h11v11H9z" /><Path d="M5 15H3V3h12v2" /></Svg>
);
