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
import { playSurahFromVerse, pauseSurah, pauseSurahWithResume, resumeSurah, isResumable, SURAH_VERSE_COUNTS, isSurahPlaying } from '../utils/audioPlayback';
import { GUTTER, SPLIT_MIN_WIDTH, pairIndexForPage, anchorFromIndex, pagePairsFor } from '../utils/mushafLayout';
const SCREEN_WIDTH = Dimensions.get('window').width;
const IS_TABLET = SCREEN_WIDTH >= 600;
const MENU_BTN_W = Math.min(62, Math.floor((SCREEN_WIDTH - 28) / 6));
const MENU_BUBBLE_W = 6 * MENU_BTN_W + 12;
const MENU_BUBBLE_H = 90;
const MENU_BUBBLE_BG = 'rgba(18,18,20,0.85)';
const MENU_ICON_C = '#CFCFCF';
const MENU_LABEL_C = '#b0b0b0';
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

export default function QuranViewScreen({ navigation, route }: any) {
  const dispatch = useDispatch();
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

  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse, surahNames, textStyle } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  const { nightMode, bgBrightness } = useSelector((s: any) => s.settings);
  const { isPlaying, currentQari } = useSelector((s: any) => s.audio);
  const bgColor = nightMode ? '#121212' : '#FFFFFF';
  const indopakFonts = ['saleem', 'indopak', 'alqalam', 'lateef', 'harmattan'];
  const isIndopak = indopakFonts.includes(textStyle);
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

  // ---- load mushaf page data (v7-style page mode) ----
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

  // ---- load verses for a page (for SQLite text mapping) ----
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

  const prefetchAround = (pageMode: 'single' | 'split', page: number) => {
    if (pageMode === 'single') { ensurePageLoaded(page + 1); ensurePageLoaded(page - 1); ensurePageLoaded(page + 2); ensurePageLoaded(page - 2); return; }
    const data = pagePairsFor(pageNumbers.length);
    const lo = Math.max(0, pairIndexForPage(page) - 2);
    const hi = Math.min(data.length - 1, pairIndexForPage(page) + 2);
    for (let i = lo; i <= hi; i++) { for (const pn of data[i]) { if (pn) { ensurePageLoaded(pn); ensurePageVersesLoaded(pn); } } }
  };

  const prefetchPartner = (pg: number) => {
    if (!splitOn || pg === 1) return;
    const partner = Math.min(Math.max(pg + (pg % 2 === 0 ? 1 : -1), 1), pageNumbers.length);
    if (partner) { ensurePageLoaded(partner); ensurePageVersesLoaded(partner); }
  };

  const handleToggleSpread = useCallback(() => dispatch(setMushafSplit(!splitOn)), [splitOn]);

  const handleFixFont = useCallback(async () => {
    const RANGE = 3;
    const first = Math.max(1, currentPageNum - RANGE);
    const last = Math.min(pageNumbers.length, currentPageNum + RANGE);
    await clearPageLayoutCacheRange(first, last);
    setFixNonce((v) => v + 1);
  }, [currentPageNum, pageNumbers.length]);

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

  // ---- deep link from Bookmarks/Mistakes/Notes ----
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

  const loadSurah = async (surahId: number, resetPage: boolean = true) => {
    const currentPage = resetPage ? 1 : pageRef.current;
    const { verses: newVerses, total } = await getVersesBySurahPaginated(surahId, currentPage, 20);
    if (surahId !== surahIdRef.current) return;
    const accLen = resetPage ? newVerses.length : versesRef.current.length + newVerses.length;
    if (resetPage) { dispatch(setSurah({ surahId, verses: newVerses })); setPage(2); setHasMore(accLen < total); }
    else { dispatch(setSurah({ surahId, verses: [...versesRef.current, ...newVerses] })); setPage(currentPage + 1); setHasMore(accLen < total); }
  };

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

  useEffect(() => { setIsDrawing(false); dispatch(setToolbarExpanded(false)); }, [currentSurahId, currentPageNum]);

  useEffect(() => {
    setPageCache({});
    setPageVersesCache({});
    pageCacheOrderRef.current = [];
    pageVersesOrderRef.current = [];
    if (isIndopak) importIndopakPages();
  }, [textStyle]);

  useEffect(() => {
    if (currentStudent) getStudentData(currentStudent.id).then(d => {
      const data = d || { bookmarks: {}, highlights: {}, drawings: {}, notes: {}, lastRead: null };
      dispatch(setStudentData(data)); if (!d) saveStudentData(currentStudent.id, data);
    });
  }, [currentStudent]);

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

  useEffect(() => {
    const target = splitOn ? pairIndexForPage(currentPageNum) : currentPageNum - 1;
    const t = setTimeout(() => flatListRef.current?.scrollToOffset({ offset: target * winW, animated: false }), 120);
    return () => clearTimeout(t);
  }, [splitOn, winW]);

  const pendingSaveRef = useRef<any>(null);
  const saveTimerRef = useRef<any>(null);

  const flushPendingSave = () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const dataToSave = pendingSaveRef.current;
    pendingSaveRef.current = null;
    if (dataToSave && currentStudent?.id) {
      saveStudentData(currentStudent.id, dataToSave).then(() => addToSyncQueue(currentStudent.id, dataToSave)).then(() => dispatch(addPendingChange())).catch(() => {});
    }
  };

  const updateData = (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(dataToSave));
    pendingSaveRef.current = dataToSave;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingSave, 400);
  };

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

  const onWordPress = useCallback((verseNum: number) => (index: number) => handleWordFlow(verseNum, index), [handleWordFlow]);
  const toggleHeader = useCallback(() => setIsHeaderVisible((prev: boolean) => !prev), []);
  const onBookmarkToggle = useCallback((verseNum: number, surahId?: number) => () => handleBookmarkFlow(verseNum, surahId), [handleBookmarkFlow]);
  const handleVerseLongPress = useCallback((verseNum: number, pageY?: number) => { ReactNativeHapticFeedback.trigger('impactMedium'); setMenuVerse(verseNum); setMenuY(pageY ?? null); }, []);

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
  const openNoteModal = () => { setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || ''); setShowNoteModal(true); };
  const saveNote = () => {
    if (!studentData || menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    updateData({ ...studentData, notes: { ...(studentData.notes || {}), [vKey]: noteText } });
    setShowNoteModal(false); setMenuVerse(null); setMenuY(null);
  };
  const handleVoiceNoteSaved = useCallback((path: string, _ms: number) => {
    if (!studentData || !recordingVerseKey) return;
    const existing = studentData?.notes?.[recordingVerseKey] || '';
    updateData({ ...studentData, notes: { ...(studentData?.notes || {}), [recordingVerseKey]: existing + (existing ? '\n' : '') + `audio:${path}` } });
    setRecordingVerseKey(null);
  }, [studentData, recordingVerseKey]);

  const handleSharePage = async () => {
    const wasHeaderVisible = isHeaderVisible;
    try { setIsHeaderVisible(false); setIsCapturing(true); await new Promise(r => setTimeout(r, 500)); const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.95 }); await Share.open({ url: Platform.OS === 'android' ? `file://${uri}` : uri, type: 'image/jpeg', title: 'Quran Page' }); }
    catch (e: any) { console.warn('Share failed:', e?.message || e); } finally { setIsCapturing(false); setIsHeaderVisible(wasHeaderVisible); }
  };

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

  const halfOrigin = splitOn ? Math.round(winW / 2 + GUTTER / 2) : 0;
  const splitMidX = Math.round(winW / 2);
  const translatePaths = (paths: any[], dx: number): any[] => paths.map((p: any) => ({ ...p, points: (p.points || []).map((pt: string) => { const [x, y] = pt.split(',').map(Number); return `${Math.round(x + dx)},${Math.round(y)}`; }) }));
  const midXOf = (p: any): number => { const pts = (p.points || []).map((pt: string) => Number(pt.split(',')[0])); return pts.length ? pts.reduce((a, b) => a + b, 0) / pts.length : 0; };
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

  const startPlayFromVerse = async (verse: number | { surahId: number; verseNumber: number }) => {
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
      await playSurahFromVerse(audioPlayer.current, qariId, surahId, clamped, callbacks);
      dispatch(setPlaying(true));
    } catch { dispatch(setPlaying(false)); }
  };

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
        await playSurahFromVerse(audioPlayer.current, qariId, surahId, startVerse, callbacks);
        dispatch(setPlaying(true));
      } catch { dispatch(setPlaying(false)); }
    }
  };

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
            <Pressable style={[styles.edgeTapLeft, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />
            <Pressable style={[styles.edgeTapRight, { width: IS_TABLET ? 50 : 24 }]} onPress={() => { if (!isDrawing) setIsHeaderVisible((prev: boolean) => !prev); }} />

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

            {isCapturing && capturePaths?.length > 0 && (<StaticDrawingOverlay paths={capturePaths} />)}
          </View>
        </PanGestureHandler></GestureHandlerRootView>
        {readingMode === 'page' && !isCapturing && pageLastVerse && (
          <TouchableOpacity style={styles.pageBookmark}
            onPress={() => handleBookmarkFlow(pageLastVerse.verseNumber, pageLastVerse.surahId)} activeOpacity={0.5} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <BookmarkIcon c="#FFD700" size={24} filled={pageLastBookmarked} />
          </TouchableOpacity>
        )}
      </View>

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

      <ToolbarBoundary>
        <AnnotationToolbar visible={!isCapturing} drawingGestureActive={drawingGestureActive} onUndo={() => canvasRef.current?.undo()} onRedo={() => canvasRef.current?.redo()}
          onClear={() => canvasRef.current?.clear()} onExit={() => { if (isDrawing) { setIsDrawing(false); setIsHeaderVisible(headerVisibleBeforeDrawRef.current); } else { dispatch(setToolbarExpanded(false)); } }}
          canUndo={canvasUndoState.canUndo} canRedo={canvasUndoState.canRedo}
          onActivateDraw={() => { if (!isDrawing) { headerVisibleBeforeDrawRef.current = isHeaderVisible; setIsHeaderVisible(false); setIsDrawing(true); }}} />
      </ToolbarBoundary>

      {isCapturing && <View style={styles.capturingOverlay}><ActivityIndicator size="large" color="#00d4aa" /></View>}
      {isHeaderVisible && <AudioPlayerBar nightMode={nightMode} surahId={currentSurahId} onOpenQari={() => setShowQariModal(true)} onTogglePlay={togglePlayAudio} isPlaying={isPlaying} />}

      <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} onSelectPage={handleSelectPage} />
      <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />



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
              <TouchableOpacity style={styles.bubbleBtn} onPress={async () => { if (menuVerse) { if (isPlaying) { dispatch(setPlaying(false)); try { audioPlayer.current.pausePlayer(); } catch {} } setRecordingVerseKey(`${currentSurahId}_${menuVerse}`); } setMenuVerse(null); setMenuY(null); }}><IconMic c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Record</Text></TouchableOpacity>
              <TouchableOpacity style={styles.bubbleBtn} onPress={() => handleCopyVerse(menuVerse!)}><IconCopy c={MENU_ICON_C} /><Text style={styles.bubbleLabel}>Copy</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

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

      {recordingVerseKey && (
        <View style={StyleSheet.absoluteFill}>
          <VoiceNoteRecorder onSaved={handleVoiceNoteSaved} onCancel={() => setRecordingVerseKey(null)} />
        </View>
      )}
    </View>
  );
}

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
