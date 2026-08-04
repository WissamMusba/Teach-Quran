/**
 * FILE: src/screens/QuranViewScreen.tsx
 * ROLE: The single reading/editing hub of the app — renders the Quran in one of
 *      three modes ('page' mushaf | 'ayah' | 'continuous'), hosts every student-data
 *      edit path (highlights, bookmarks, notes, voice notes, drawings, lastRead),
 *      audio playback, share/capture, and the surah list; ALL of it funnels into
 *      one debounced SQLite + sync-queue pipeline.
 * DEPENDS ON: Redux slices quran/student/settings/audio/sync/drawing; localDB.ts
 *      (getStudentData, saveStudentData, addToSyncQueue, clearPageLayoutCacheRange);
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
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert, Platform, AppState, Pressable, useWindowDimensions } from 'react-native';
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
import AnimatedHeader, { BookmarkIcon } from '../components/common/AnimatedHeader';
import MushafPageView from '../components/quran/MushafPageView';
import { getVersesBySurahPaginated, getVersePage, getMushafPageData, getVersesByPage, importIndopakPages } from '../database/quranData';
import { getStudentData, saveStudentData, addToSyncQueue, clearPageLayoutCacheRange } from '../database/localDB';
import { getJuzInfoFromPage, getStartJuzOfSurah } from '../utils/theme';
import { MISTAKE_COLOR } from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import Svg, { Path } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import VoiceNoteRecorder from '../components/audio/VoiceNoteRecorder';
import { playSurahFromVerse, pauseSurah, pauseSurahWithResume, resumeSurah, isResumable, SURAH_VERSE_COUNTS, isSurahPlaying, getCurrentPlaybackVerse } from '../utils/audioPlayback';
import { GUTTER, SPLIT_MIN_WIDTH, pairIndexForPage, anchorFromIndex, pagePairsFor } from '../utils/mushafLayout';
const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_TABLET = SCREEN_WIDTH >= 600;
const MENU_BTN_W = Math.min(62, Math.floor((SCREEN_WIDTH - 28) / 6));
const MENU_BUBBLE_W = 6 * MENU_BTN_W + 12;
const MENU_BUBBLE_H = 90;
const MENU_BUBBLE_BG = 'rgba(18,18,20,0.85)';
const MENU_ICON_C = '#CFCFCF';
const MENU_LABEL_C = '#b0b0b0';
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
const SpreadItem = React.memo(({ pair, winW, pageW, headerVisible, surahNames, pageCache, pageVersesCache, highlights, onWordPress, onBookmarkToggle, onVerseLongPress, bookmarks, flashingVerseKey, notes, readingMarkVerse, onDeadTap, ensurePageLoaded, ensurePageVersesLoaded, fixNonce, onFixFont, onSpread, spread }: any) => {
  const even = pair?.[0];
  const odd = pair?.[1];
  if (even) { ensurePageLoaded(even); ensurePageVersesLoaded(even); }
  if (odd) { ensurePageLoaded(odd); ensurePageVersesLoaded(odd); }
  return (
    <View style={{ width: winW, flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ width: pageW, flex: 1, overflow: 'hidden' }}>
        {odd ? (
          pageCache[odd] ? (
            <MushafPageView pageNum={odd} pageWidth={pageW} headerVisible={headerVisible} surahNames={surahNames} versesForPage={pageVersesCache[odd] || []} pageData={pageCache[odd]} highlights={highlights}
              onWordPress={onWordPress} onBookmarkToggle={onBookmarkToggle} onVerseLongPress={onVerseLongPress} bookmarks={bookmarks}
              flashingVerseKey={flashingVerseKey} notes={notes} readingMarkVerse={readingMarkVerse} onDeadTap={onDeadTap} fixNonce={fixNonce} onFixFont={onFixFont} onSpread={onSpread} spread={spread} />
          ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#00d4aa" /></View>)
        ) : null}
      </View>
      <View style={{ width: pageW, flex: 1, overflow: 'hidden' }}>
        {pageCache[even] ? (
          <MushafPageView pageNum={even} pageWidth={pageW} headerVisible={headerVisible} surahNames={surahNames} versesForPage={pageVersesCache[even] || []} pageData={pageCache[even]} highlights={highlights}
            onWordPress={onWordPress} onBookmarkToggle={onBookmarkToggle} onVerseLongPress={onVerseLongPress} bookmarks={bookmarks}
            flashingVerseKey={flashingVerseKey} notes={notes} readingMarkVerse={readingMarkVerse} onDeadTap={onDeadTap} fixNonce={fixNonce} onFixFont={onFixFont} onSpread={onSpread} spread={spread} />
        ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#00d4aa" /></View>)}
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
  const [showQariModal, setShowQariModal] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [pageCache, setPageCache] = useState<any>({});
  const [headerSurahId, setHeaderSurahId] = useState(1);
  const [headerPage, setHeaderPage] = useState(0);
  const [fixNonce, setFixNonce] = useState(0);
  const [menuVerse, setMenuVerse] = useState<number | null>(null);
  const [menuY, setMenuY] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [recordingVerseKey, setRecordingVerseKey] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [drawingGestureActive, setDrawingGestureActive] = useState(false);
  const [flashingSurah, setFlashingSurah] = useState(0);
  const flatListRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
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

  // ---- Redux subscriptions ----
  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse, surahNames, textStyle } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  const { nightMode, bgBrightness, playBasmala } = useSelector((s: any) => s.settings);
  const { isPlaying, currentQari } = useSelector((s: any) => s.audio);
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
   *   mushaf_pages_indopak via getMushafPageData), with a ~40-page LRU.
   * FLOW: 1) skip if cached or promise in flight 2) if isIndopak, lazily seed
   *   indopak pages via importIndopakPages() 3) getMushafPageData(pageNum,
   *   textStyleRef.current) 4) setPageCache + LRU: append to order ref, evict
   *   pages >12 away from currentPageNumRef while len>40 5) clear promise flag.
   * CALLS: getMushafPageData, importIndopakPages (quranData.ts).
   * CALLED BY: renderItem of the page FlatList (single) / SpreadItem (split),
   *   prefetchAround, prefetchPartner, handleSelectPage, deep-link + surah-change
   *   + lastRead effects.
   * AFFECTS: pageCache (local state).
   * NOTES: Uses the LIVE textStyleRef so a mid-flight font change doesn't cache
   *   the wrong mushaf under the new key — pages loaded under an old style stay
   *   cached until the textStyle reset effect wipes both caches.
   */
  const ensurePageLoaded = useCallback(async (pageNum: number) => {
    if (pageCache[pageNum] || pagePromiseRef.current[pageNum]) return;
    pagePromiseRef.current[pageNum] = true;
    if (isIndopak) importIndopakPages();
    getMushafPageData(pageNum, textStyleRef.current).then(data => {
      setPageCache(prev => {
        const next = { ...prev, [pageNum]: data };
        const order = pageCacheOrderRef.current.filter((k: number) => k !== pageNum && k in prev);
        order.push(pageNum);
        const cp = currentPageNumRef.current;
        while (order.length > 40) {
          const idx = order.findIndex((k: number) => Math.abs(k - cp) > 12);
          if (idx === -1) break;
          delete next[order[idx]];
          order.splice(idx, 1);
        }
        pageCacheOrderRef.current = order;
        return next;
      });
      delete pagePromiseRef.current[pageNum];
    }).catch(() => { delete pagePromiseRef.current[pageNum]; });
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
        while (order.length > 40) {
          const idx = order.findIndex((k: number) => Math.abs(k - cp) > 12);
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
    const data = pagePairsFor(pageNumbers.length);
    const lo = Math.max(0, pairIndexForPage(page) - 2);
    const hi = Math.min(data.length - 1, pairIndexForPage(page) + 2);
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
   * WHAT: "Fix font" — clears the cached page layout range (±3 pages around the
   *   current page) from page_layout_cache and bumps fixNonce to force
   *   MushafPageView to re-layout those pages.
   * CALLS: clearPageLayoutCacheRange (localDB.ts).
   * AFFECTS: page_layout_cache; MushafPageView re-render via fixNonce.
   */
  const handleFixFont = useCallback(async () => {
    const RANGE = 3;
    const first = Math.max(1, currentPageNum - RANGE);
    const last = Math.min(pageNumbers.length, currentPageNum + RANGE);
    await clearPageLayoutCacheRange(first, last);
    setFixNonce((v) => v + 1);
  }, [currentPageNum, pageNumbers.length]);

  /**
   * WHAT: SurahList "page jump" — switches to page mode and scrolls to a page.
   * FLOW: 1) close list, setReadingMode('page') if needed 2) set currentPageNum/
   *   headerPage 3) derive the surah from the first word location of the cached
   *   page and dispatch setSurah if different (pageScrollSurahChangeRef guard
   *   stops the surah-change effect from re-scrolling to verse 1) 4) ensure
   *   loads + prefetchPartner (split) 5) scrollToIndex after 100ms.
   * CALLS: setReadingMode, setSurah, ensurePageLoaded, ensurePageVersesLoaded,
   *   prefetchPartner, flatListRef.scrollToIndex.
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
    setTimeout(() => flatListRef.current?.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false }), 100);
  };

  /**
   * WHAT: Handles navigation from Bookmarks/Mistakes/Notes with
   *   {surahId, scrollToVerse} route params.
   * FLOW (page mode): getVersePage(surahId, verse, textStyle) -> set current
   *   page/header state, ensurePageLoaded, prefetchPartner, scrollToIndex (100ms).
   * FLOW (ayah/continuous): targetPage = ceil(scrollToVerse/20) ->
   *   getVersesBySurahPaginated(surahId, 1, targetPage*20) -> deepLinkLoadedRef
   *   = true (suppresses the surah-change effect's loadSurah) -> setSurah +
   *   setPage(targetPage+1) -> after 500ms scroll to the verse index (FlatList
   *   scrollToIndex viewPosition 0.5 / ScrollView y=idx*45) and flash the verse
   *   for 2s (setFlashingVerse -> null).
   * CALLS: getVersePage, getVersesBySurahPaginated, setSurah, setFlashingVerse,
   *   ensurePageLoaded, prefetchPartner, flatListRef/scrollViewRef scrolls.
   * AFFECTS: currentPageNum/headerPage/headerSurahId; s.quran.verses/flashingVerse.
   * NOTES: Re-runs on every route.params identity change. getVersePage is
   *   textStyle-dependent (page differs between uthmani 604 / indopak 610).
   */
  useEffect(() => {
    const { surahId, scrollToVerse } = route.params || {};
    if (surahId) {
      if (readingMode === 'page') {
        getVersePage(surahId, scrollToVerse, textStyle).then(pg => {
          setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surahId); ensurePageLoaded(pg); prefetchPartner(pg);
          setTimeout(() => flatListRef.current?.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false }), 100);
        });
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
        });
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
   *   -> scroll to it + prefetchPartner; ayah/continuous -> headerPage=0 and
   *   loadSurah unless the deep link already loaded (deepLinkLoadedRef).
   * CALLS: getVersePage, loadSurah, ensurePageLoaded, prefetchPartner.
   * AFFECTS: headerSurahId/headerPage/currentPageNum; s.quran.verses.
   * NOTES: THE pageScrollSurahChangeRef guard is what stops a page-scroll surah
   *   change from yanking the user back to that surah's page 1. Triggered by
   *   setSurah from SurahList, swipe, page-scroll detection, deep link,
   *   Dashboard, lastRead restore.
   */
  useEffect(() => {
    setHeaderSurahId(currentSurahId);
    if (readingMode === 'page') {
      if (pageScrollSurahChangeRef.current) {
        pageScrollSurahChangeRef.current = false;
        return;
      }
      getVersePage(currentSurahId, 1, textStyle).then(pg => {
        setCurrentPageNum(pg); setHeaderPage(pg); ensurePageLoaded(pg); prefetchPartner(pg);
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false }), 100);
      });
    } else {
      setHeaderPage(0);
      if (!deepLinkLoadedRef.current) loadSurah(currentSurahId, true);
    }
    deepLinkLoadedRef.current = false;
  }, [currentSurahId, readingMode, textStyle]);

  // ---- leave drawing mode + collapse toolbar on surah/page change ----
  useEffect(() => { setIsDrawing(false); dispatch(setToolbarExpanded(false)); }, [currentSurahId, currentPageNum]);

  /**
   * WHAT: On textStyle (mushaf font) change — wipe both page caches and their
   *   LRU order refs, then re-seed indopak pages if needed, forcing every page
   *   to re-render under the new mushaf.
   * AFFECTS: pageCache, pageVersesCache (local).
   * NOTES: textStyle union is 'saleem'|'uthmani'|'alqalam'|'lateef' but isIndopak
   *   also matches 'indopak'|'harmattan' (legacy strings only reachable via
   *   `as any` from Settings). Indopak => 610 pages, else 604.
   */
  useEffect(() => {
    setPageCache({});
    setPageVersesCache({});
    pageCacheOrderRef.current = [];
    pageVersesOrderRef.current = [];
    if (isIndopak) importIndopakPages();
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
    if (studentData?.lastRead) {
      const { surah, verse } = studentData.lastRead;
      if (currentSurahId !== surah) dispatch(setSurah({ surahId: surah, verses: [] }));
      if (readingMode === 'page') {
        getVersePage(surah, verse, textStyle).then(pg => { setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surah); ensurePageLoaded(pg); prefetchPartner(pg); setTimeout(() => flatListRef.current?.scrollToIndex({ index: splitOn ? pairIndexForPage(pg) : pg - 1, animated: false }), 500); });
      } else if (readingMode === 'ayah') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); }, 500);
      } else if (readingMode === 'continuous') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true }); }, 500);
      }
    }
  }, [studentData?.lastRead?.surah]);

  /**
   * WHAT: After splitOn/winW changes, re-snaps the page FlatList to the current
   *   page (target = pair index in split mode, else page-1; offset = target*winW).
   * NOTES: Duplicate safety net for handleSelectPage / deep-link scrolls.
   */
  useEffect(() => {
    const target = splitOn ? pairIndexForPage(currentPageNum) : currentPageNum - 1;
    const t = setTimeout(() => flatListRef.current?.scrollToOffset({ offset: target * winW, animated: false }), 120);
    return () => clearTimeout(t);
  }, [splitOn, winW]);

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
    if (dataToSave && currentStudent?.id) {
      saveStudentData(currentStudent.id, dataToSave).then(() => addToSyncQueue(currentStudent.id, dataToSave)).then(() => dispatch(addPendingChange())).catch(() => {});
    }
  };

  /**
   * WHAT: Optimistic Redux write + 400ms-debounced SQLite/sync persistence —
   *   THE single funnel for every student-data mutation.
   * FLOW: 1) stamp updatedAt ISO 2) dispatch(setStudentData(dataToSave)) —
   *   immediate UI update 3) pendingSaveRef.current = dataToSave (only the
   *   LATEST snapshot kept) 4) reset timer -> flushPendingSave in 400ms.
   * CALLS: setStudentData (studentSlice), flushPendingSave.
   * CALLED BY: handleWordFlow, handleBookmarkFlow, saveNote,
   *   handleVoiceNoteSaved, DrawingCanvas onSave, menu "Set Reading Mark".
   * AFFECTS: s.student.studentData (immediate); SQLite + sync queue (debounced).
   * NOTES: STALE-SNAPSHOT LOSS — handlers capture `studentData` at call time;
   *   two edits inside 400ms (e.g. two word taps) dispatch from the same stale
   *   snapshot and the second setStudentData overwrites, silently DROPPING the
   *   first change in Redux AND in pendingSaveRef (latest-only slot). Fast
   *   double-taps on words lose highlights.
   */
  const updateData = (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(dataToSave));
    pendingSaveRef.current = dataToSave;
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
      if (state === 'background' || state === 'inactive') {
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
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cHigh = studentData.highlights || {};
    const vHighs = cHigh[vKey]?.highlights || [];
    const exists = vHighs.find((h: any) => h.wordIndex === wordIndex);
    const newHighs = exists ? vHighs.filter((h: any) => h.wordIndex !== wordIndex) : [...vHighs, { id: uuidv4(), wordIndex, color: MISTAKE_COLOR, createdAt: new Date().toISOString() }];
    updateData({ ...studentData, highlights: { ...cHigh, [vKey]: { highlights: newHighs } } });
    ReactNativeHapticFeedback.trigger('impactLight');
  }, [studentData, currentSurahId]);

  /**
   * WHAT: Toggles `{surah}_{verse}` in the bookmarks map; 'impactMedium' haptic.
   * CALLS: updateData, ReactNativeHapticFeedback.
   * CALLED BY: onBookmarkToggle (VerseDisplay/FlowingText/MushafPageView),
   *   page bookmark button, menu Bookmark.
   * AFFECTS: studentData.bookmarks.<surah_verse> = {surah, verse, createdAt}.
   */
  const handleBookmarkFlow = useCallback((verseNum: number, surahId?: number) => {
    if (!studentData) return;
    const sId = surahId || currentSurahId;
    const vKey = `${sId}_${verseNum}`;
    const cMarks = studentData.bookmarks || {};
    const newMarks = { ...cMarks };
    if (newMarks[vKey]) delete newMarks[vKey]; else newMarks[vKey] = { surah: sId, verse: verseNum, createdAt: new Date().toISOString() };
    updateData({ ...studentData, bookmarks: newMarks });
    ReactNativeHapticFeedback.trigger('impactMedium');
  }, [studentData, currentSurahId]);

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
  // openNoteModal: pre-fills the note modal from studentData for the menu verse
  const openNoteModal = () => { setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || ''); setShowNoteModal(true); };
  /**
   * WHAT: Writes noteText for `{currentSurahId}_{menuVerse}` into the notes map
   *   and closes the modal.
   * CALLS: updateData.
   * CALLED BY: menu Note button via openNoteModal.
   * AFFECTS: studentData.notes.<surah_verse> (string).
   */
  const saveNote = () => {
    if (!studentData || menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    updateData({ ...studentData, notes: { ...(studentData.notes || {}), [vKey]: noteText } });
    setShowNoteModal(false); setMenuVerse(null); setMenuY(null);
  };
  /**
   * WHAT: Appends `audio:<path>` (newline-separated) to the note of
   *   recordingVerseKey, then closes the recorder overlay.
   * CALLS: updateData.
   * CALLED BY: VoiceNoteRecorder onSaved.
   * AFFECTS: studentData.notes.<surah_verse> — voice notes are STORED INSIDE
   *   the notes field (no separate field); existing note text preserved.
   */
  const handleVoiceNoteSaved = useCallback((path: string, _ms: number) => {
    if (!studentData || !recordingVerseKey) return;
    const existing = studentData?.notes?.[recordingVerseKey] || '';
    updateData({ ...studentData, notes: { ...(studentData?.notes || {}), [recordingVerseKey]: existing + (existing ? '\n' : '') + `audio:${path}` } });
    setRecordingVerseKey(null);
  }, [studentData, recordingVerseKey]);

  /**
   * WHAT: Captures the whole reading area (viewShotRef wrapper, collapsable={
   *   false}) as a JPG via captureRef and opens the native share sheet.
   * FLOW: hide header (restored in finally), isCapturing=true, wait 500ms for
   *   re-layout, captureRef(viewShotRef, {format:'jpg', quality:0.95}),
   *   Share.open (file:// prefix on Android), spinner overlay while capturing.
   * CALLS: captureRef (react-native-view-shot), Share.open (react-native-share).
   * AFFECTS: isHeaderVisible/isCapturing during capture; DrawingCanvas is
   *   unmounted while capturing and StaticDrawingOverlay re-draws the paths
   *   so drawings appear in the share.
   */
  const handleSharePage = async () => {
    const wasHeaderVisible = isHeaderVisible;
    try { setIsHeaderVisible(false); setIsCapturing(true); await new Promise(r => setTimeout(r, 500)); const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.95 }); await Share.open({ url: Platform.OS === 'android' ? `file://${uri}` : uri, type: 'image/jpeg', title: 'Quran Page' }); }
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
  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;
  const spreadOddKey = splitOn ? `page_${currentPageNum % 2 === 0 ? currentPageNum - 1 : currentPageNum}` : null;
  const spreadEvenKey = splitOn ? `page_${currentPageNum % 2 === 0 ? currentPageNum : currentPageNum + 1}` : null;
  const composeSpreadPaths = () => splitOn
    ? [...(studentData?.drawings?.[spreadOddKey!]?.paths || []), ...translatePaths(studentData?.drawings?.[spreadEvenKey!]?.paths || [], halfOrigin)]
    : studentData?.drawings?.[drawingKey]?.paths;
  const capturePaths = composeSpreadPaths();
  const readingMarkVerse = studentData?.lastRead?.surah === currentSurahId ? studentData?.lastRead?.verse : null;
  const pageLastVerse = pageVersesCache[currentPageNum]?.[pageVersesCache[currentPageNum].length - 1];
  const pageLastKey = pageLastVerse ? `${pageLastVerse.surahId}_${pageLastVerse.verseNumber}` : null;
  const pageLastBookmarked = pageLastKey ? !!studentData?.bookmarks?.[pageLastKey] : false;

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
          || (await getVersesByPage(currentPageNum, textStyleRef.current).then(([vs]: any[]) => vs?.find((v: any) => v.verseNumber === verseNum)?.surahId).catch(() => undefined))
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
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurahWithResume(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
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
        try { const [vs] = await getVersesByPage(currentPageNum, textStyleRef.current); firstVerse = vs?.[0]; } catch {}
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
   *   of the current surah in ayah/continuous mode.
   * CALLS: playSurahFromVerse / pauseSurah (audioPlayback.ts), getVersesByPage.
   * CALLED BY: AudioPlayerBar onPlayPageStart.
   */
  const playPageStart = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    if (isPlaying) { dispatch(setPlaying(false)); pauseSurah(audioPlayer.current).catch(() => {}); dispatch(setFlashingVerse(null)); }
    let firstVerse = readingMode === 'page' ? pageVersesCache[currentPageNum]?.[0] : null;
    if (!firstVerse && readingMode === 'page') {
      try { const [vs] = await getVersesByPage(currentPageNum, textStyleRef.current); firstVerse = vs?.[0]; } catch {}
    }
    const startVerse = firstVerse?.verseNumber || 1;
    const surahId = firstVerse?.surahId || currentSurahId;
    const callbacks = {
      onVerseChange: (v: number, sId?: number) => { setFlashingSurah(sId || currentSurahId); dispatch(setFlashingVerse(v)); },
      onEnd: () => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); },
      onError: (msg: string) => { dispatch(setPlaying(false)); dispatch(setFlashingVerse(null)); Alert.alert('Playback error', msg); },
    };
    try {
      await playSurahFromVerse(audioPlayer.current, qariId, surahId, startVerse, callbacks, { playBasmala: !!playBasmala });
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
      await playSurahFromVerse(audioPlayer.current, qariId, newSurahOnPage.surahId, 1, callbacks, { playBasmala: !!playBasmala });
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
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AnimatedHeader visible={isHeaderVisible} surahName={headerInfo.surahName} surahId={headerInfo.surahId} juz={headerInfo.juz} page={headerInfo.page} pagesLeftInJuz={headerInfo.pagesLeftInJuz} nightMode={nightMode}
        onBack={() => navigation.navigate('Dashboard')} onOpenList={() => setShowList(true)} onMistakes={() => navigation.navigate('Mistakes')}
        onShare={handleSharePage} onNotes={() => navigation.navigate('Notes')} onBookmarks={() => navigation.navigate('Bookmarks')} onSettings={() => navigation.navigate('Settings')} />
      <View style={{ flex: 1 }} ref={viewShotRef} collapsable={false}>
        <GestureHandlerRootView style={{ flex: 1 }}><PanGestureHandler onHandlerStateChange={onSwipe} activeOffsetY={[-15, 15]} activeOffsetX={[-25, 25]} enabled={!isDrawing && readingMode !== 'page'}>
          <View style={{ flex: 1, position: 'relative' }}>
            {/* ---- edge-tap Pressables: header toggle in PAGE mode (PanGesture handler is disabled there) ---- */}
            <Pressable style={[styles.edgeTapLeft, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />
            <Pressable style={[styles.edgeTapRight, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />

            {/* ================= ayah mode: vertical FlatList of VerseDisplay rows ================= */}
            {readingMode === 'ayah' && (
              <FlatList ref={flatListRef} data={verses} keyExtractor={(item: any) => item.id.toString()}
                contentContainerStyle={{ padding: IS_TABLET ? 40 : 20 }}
                renderItem={({ item }: any) => (
                  <VerseDisplay verse={item} highlights={studentData?.highlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights}
                    isBookmarked={!!studentData?.bookmarks?.[`${currentSurahId}_${item.verseNumber}`]} isReadingMark={readingMarkVerse === item.verseNumber}
                    onWordPress={onWordPress(item.verseNumber)} onBookmarkToggle={onBookmarkToggle(item.verseNumber)} onVerseLongPress={handleVerseLongPress}
                    showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} onDeadTap={toggleHeader} />
                )}
                onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) { setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false)); } }}
                onEndReachedThreshold={0.5} ListFooterComponent={loadingMore ? <ActivityIndicator color="#00d4aa" /> : null}
                initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} scrollEventThrottle={16} />
            )}

            {/* ================= continuous mode: ScrollView + FlowingText ================= */}
            {readingMode === 'continuous' && (
              <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: IS_TABLET ? 40 : 20 }}
                onScroll={({ nativeEvent }: any) => {
                  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                  if (contentOffset.y >= contentSize.height - layoutMeasurement.height - 100) {
                    if (!loadingMore && hasMore && verses.length > 0) {
                      setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false));
                    }
                  }
                }} scrollEventThrottle={100}>
                <FlowingText verses={verses} highlights={studentData?.highlights} onWordPress={handleWordFlow} onVerseLongPress={handleVerseLongPress}
                  onBookmarkToggle={handleBookmarkFlow} showTranslation={showTranslation} fontSize={fontSize}
                  bookmarks={studentData?.bookmarks}
                  notes={studentData?.notes} readingMarkVerse={readingMarkVerse} flashingVerse={flashingVerse} onDeadTap={toggleHeader} />
                {loadingMore && <ActivityIndicator color="#00d4aa" />}
              </ScrollView>
            )}

            {/* ================= page mode: horizontal inverted paging FlatList of mushaf pages ================= */}
            {readingMode === 'page' && (
              <FlatList ref={flatListRef} data={splitOn ? pagePairsFor(pageNumbers.length) : pageNumbers}
                keyExtractor={splitOn ? (item: any) => String(item[0]) : (item: any) => item.toString()}
                horizontal inverted pagingEnabled showsHorizontalScrollIndicator={false}
                removeClippedSubviews decelerationRate="fast" scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: IS_TABLET ? 20 : 10 }}
                getItemLayout={(data, index) => ({ length: winW, offset: winW * index, index })}
                initialNumToRender={5} maxToRenderPerBatch={10} windowSize={7}
                onScrollToIndexFailed={(info) => flatListRef.current?.scrollToOffset({ offset: info.index * winW, animated: false })}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / winW);
                  const p = splitOn ? anchorFromIndex(idx) : idx + 1;
                  if (p !== currentPageNum) {
                    setCurrentPageNum(p); setHeaderPage(p);
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
                    highlights={studentData?.highlights} onWordPress={handleWordFlow} onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress}
                    bookmarks={studentData?.bookmarks} flashingVerseKey={flashingVerse ? `${flashingSurah || currentSurahId}_${flashingVerse}` : null}
                    notes={studentData?.notes} readingMarkVerse={readingMarkVerse} onDeadTap={toggleHeader}
                    ensurePageLoaded={ensurePageLoaded} ensurePageVersesLoaded={ensurePageVersesLoaded} fixNonce={fixNonce} onFixFont={handleFixFont}
                    onSpread={splitCapable ? handleToggleSpread : undefined} spread={splitOn} />
                ) : ({ item }: any) => {
                  ensurePageLoaded(item);
                  ensurePageVersesLoaded(item);
                  const pData = pageCache[item];
                  return (
                    <View style={{ width: winW, flex: 1, overflow: 'hidden' }}>
                      {pData ? (
                        <MushafPageView headerVisible={isHeaderVisible} pageNum={item} surahNames={surahNames} versesForPage={pageVersesCache[item] || []} pageData={pData} highlights={studentData?.highlights} onWordPress={handleWordFlow}
                          onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress} bookmarks={studentData?.bookmarks}
                          flashingVerseKey={flashingVerse ? `${flashingSurah || currentSurahId}_${flashingVerse}` : null} notes={studentData?.notes} readingMarkVerse={readingMarkVerse} onDeadTap={toggleHeader} fixNonce={fixNonce} onFixFont={handleFixFont}
                          onSpread={splitCapable ? handleToggleSpread : undefined} spread={splitOn} />
                      ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#00d4aa" /></View>)}
                    </View>
                  );
                }} />
            )}

            {/* share capture: re-draws saved drawing paths on top of the page while capturing */}
            {isCapturing && capturePaths?.length > 0 && (<StaticDrawingOverlay paths={capturePaths} />)}
          </View>
        </PanGestureHandler></GestureHandlerRootView>
        {/* ---- floating page-bookmark button (top-right; INSIDE the captured region for share) ---- */}
        {readingMode === 'page' && !isCapturing && pageLastVerse && (
          <TouchableOpacity style={styles.pageBookmark}
            onPress={() => handleBookmarkFlow(pageLastVerse.verseNumber, pageLastVerse.surahId)} activeOpacity={0.5} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BookmarkIcon c="#FFD700" size={24} filled={pageLastBookmarked} />
          </TouchableOpacity>
        )}
      </View>

      {/* ================= drawing wiring: canvas + toolbar (error-boundary wrapped) ================= */}
      {isDrawing && (
        <DrawingCanvas ref={canvasRef} visible={isDrawing && !isCapturing}
          initialPaths={composeSpreadPaths()}
          onSave={(paths: any) => {
            if (!studentData) return;
            if (!splitOn) { updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date() } } }); return; }
            const even: any[] = []; const odd: any[] = [];
            for (const p of paths) { if (midXOf(p) >= splitMidX) even.push(p); else odd.push(p); }
            updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [spreadEvenKey!]: { paths: translatePaths(even, -halfOrigin), updatedAt: new Date() }, [spreadOddKey!]: { paths: odd, updatedAt: new Date() } } });
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
      {isCapturing && <View style={styles.capturingOverlay}><ActivityIndicator size="large" color="#00d4aa" /></View>}
      {/* bottom playback bar — visible only while the header is visible */}
      {isHeaderVisible && <AudioPlayerBar nightMode={nightMode} surahId={currentSurahId} onOpenQari={() => setShowQariModal(true)} onResume={togglePlayAudio} onPlayPageStart={playPageStart} onPlayNewSurah={playNewSurah} canPlayNewSurah={!!newSurahOnPage} onPrevVerse={() => stepVerse(-1)} onNextVerse={() => stepVerse(1)} canStep={isPlaying} isPlaying={isPlaying} />}

      {/* surah picker modal (onSelect -> setSurah reload; onSelectPage -> page jump) + qari picker */}
      <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} onSelectPage={handleSelectPage} />
      <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />



      {/* ---- long-press verse menu: floating 6-button bubble (Play/Bookmark/Reading/Note/Record/Copy) ---- */}
      <Modal visible={menuVerse !== null} transparent animationType="fade" onRequestClose={() => { setMenuVerse(null); setMenuY(null); }}>
        <TouchableOpacity style={[styles.menuOverlay, menuY === null && styles.menuOverlayCentered]} activeOpacity={1} onPress={() => { setMenuVerse(null); setMenuY(null); }}>
          <View style={menuY === null ? styles.bubbleCenteredWrap : [styles.bubbleWrap, { top: menuPos?.top ?? 0, left: menuPos?.left ?? 0, width: menuPos?.width ?? 0 }]}>
            {menuPos?.arrowUp && <View style={[styles.bubbleArrow, { top: -6, backgroundColor: MENU_BUBBLE_BG }]} />}
            {menuPos?.arrowDown && <View style={[styles.bubbleArrow, { bottom: -6, backgroundColor: MENU_BUBBLE_BG }]} />}
            <View style={styles.bubble}>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => { setMenuVerse(null); setMenuY(null); startPlayFromVerse(menuVerse!); }}><IconPlay c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Play</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => { setMenuVerse(null); setMenuY(null); handleBookmarkFlow(menuVerse!); }}><IconBookmark c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Bookmark</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => { const v = menuVerse; setMenuVerse(null); setMenuY(null); Alert.alert('Set Reading Mark', `Start reading from verse ${v}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { if (v) updateData({ ...studentData, lastRead: { surah: currentSurahId, verse: v } }); } }]); }}><IconPin c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Reading</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => { openNoteModal(); setMenuVerse(null); setMenuY(null); }}><IconNote c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Note</Text></TouchableOpacity>
              {/* Record: NOTE — pauses via RAW audioPlayer.pausePlayer(), NOT pauseSurah, so the
                  audioPlayback module's playing/playToken state goes stale (ghost isSurahPlaying) */}
              <TouchableOpacity style={styles.bubbleBtn} onPress={async () => { if (menuVerse) { if (isPlaying) { dispatch(setPlaying(false)); try { audioPlayer.current.pausePlayer(); } catch {} } setRecordingVerseKey(`${currentSurahId}_${menuVerse}`); } setMenuVerse(null); setMenuY(null); }}><IconMic c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Record</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => handleCopyVerse(menuVerse!)}><IconCopy c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Copy</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- note modal (menu Note) ---- */}
      <Modal visible={showNoteModal} transparent animationType="fade">
        <View style={styles.noteOverlay}>
          <View style={styles.noteContainer}>
            <TextInput style={styles.noteInput} value={noteText} onChangeText={setNoteText} multiline placeholder="Note..." placeholderTextColor="#666" />
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.noteCancelBtn}><Text style={{color:'#fff'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveNote} style={styles.noteSaveBtn}><Text style={{color:'#000'}}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* full-screen voice-note recorder overlay (menu Record) */}
      {recordingVerseKey && (
        <View style={StyleSheet.absoluteFill}>
          <VoiceNoteRecorder onSaved={handleVoiceNoteSaved} onCancel={() => setRecordingVerseKey(null)} />
        </View>
      )}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1 },
  capturingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
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
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 8, flex: 1, marginLeft: 5 },
  pageBookmark: { position: 'absolute', top: 0, right: 0, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', zIndex: 9999, elevation: 9999 },
  edgeTapLeft: { position: 'absolute', top: 0, left: 0, height: '100%', zIndex: 1 },
  edgeTapRight: { position: 'absolute', top: 64, right: 0, bottom: 0, zIndex: 1 },

});

// ---- inline SVG icons for the long-press menu bubble ----
const ICON_ST = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconPlay = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M7 4.5v15l13-7.5L7 4.5z" /></Svg>
);
const IconBookmark = ({ c }: { c: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" {...ICON_ST} stroke={c}><Path d="M7 3h10v18l-5-3.6L7 21V3z" /></Svg>
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
