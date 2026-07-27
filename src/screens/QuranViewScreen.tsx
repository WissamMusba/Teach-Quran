import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert, Pressable, Platform } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import { setSurah, toggleTranslation, setFlashingVerse } from '../store/quranSlice';
import { addPendingChange } from '../store/syncSlice';
import { setStudentData } from '../store/studentSlice';
import { setPlaying } from '../store/audioSlice';
import VerseDisplay from '../components/quran/VerseDisplay';
import FlowingText from '../components/quran/FlowingText';
import DrawingCanvas from '../components/drawing/DrawingCanvas';
import StaticDrawingOverlay from '../components/drawing/StaticDrawingOverlay';
import SurahList from '../components/quran/SurahList';
import AudioPlayerBar from '../components/audio/AudioPlayerBar';
import QariSelector from '../components/audio/QariSelector';
import AnimatedHeader from '../components/common/AnimatedHeader';
import MushafPageView from '../components/quran/MushafPageView';
import { getVersesBySurahPaginated, getVersePage, getMushafPageData, getVersesByPage } from '../database/quranData';
import { getStudentData, saveStudentData, addToSyncQueue } from '../database/localDB';
import { getJuzInfoFromPage, getStartJuzOfSurah } from '../utils/theme';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
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
  const [menuVerse, setMenuVerse] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const flatListRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const deepLinkLoadedRef = useRef(false);
  const pagePromiseRef = useRef({});
  const [pageVersesCache, setPageVersesCache] = useState<any>({});
  const pageVersesPromiseRef = useRef({});
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer());
  const audioPlayer = useRef(new AudioRecorderPlayer());
  const headerVisibleBeforeDrawRef = useRef(true);
  const viewShotRef = useRef<any>(null);

  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse, surahNames, textStyle } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  const { nightMode, bgBrightness } = useSelector((s: any) => s.settings);
  const { isPlaying, currentQari } = useSelector((s: any) => s.audio);
  const activeColor = useSelector((s: any) => s.drawing.activeColor);
  const bgColor = nightMode ? '#121212' : '#FFFFFF';

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
  const ensurePageLoaded = useCallback((pageNum: number) => {
    if (pageCache[pageNum] || pagePromiseRef.current[pageNum]) return;
    pagePromiseRef.current[pageNum] = true;
    getMushafPageData(pageNum).then(data => {
      setPageCache(prev => ({ ...prev, [pageNum]: data }));
      delete pagePromiseRef.current[pageNum];
    });
  }, [pageCache]);

  // ---- load verses for a page (for SQLite text mapping) ----
  const ensurePageVersesLoaded = useCallback((pageNum: number) => {
    if (pageVersesCache[pageNum] || pageVersesPromiseRef.current[pageNum]) return;
    pageVersesPromiseRef.current[pageNum] = true;
    getVersesByPage(pageNum).then(verses => {
      setPageVersesCache(prev => ({ ...prev, [pageNum]: verses }));
      delete pageVersesPromiseRef.current[pageNum];
    });
  }, [pageVersesCache]);

  // ---- deep link from Bookmarks/Mistakes/Notes ----
  useEffect(() => {
    const { surahId, scrollToVerse } = route.params || {};
    if (surahId) {
      if (readingMode === 'page') {
        getVersePage(surahId, scrollToVerse).then(pg => {
          setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surahId); ensurePageLoaded(pg);
          setTimeout(() => flatListRef.current?.scrollToIndex({ index: pg - 1, animated: false }), 100);
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
  useEffect(() => { surahIdRef.current = currentSurahId; }, [currentSurahId]);
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { pageRef.current = page; }, [page]);

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
      getVersePage(currentSurahId, 1).then(pg => {
        setCurrentPageNum(pg); setHeaderPage(pg); ensurePageLoaded(pg);
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: pg - 1, animated: false }), 100);
      });
    } else {
      setHeaderPage(0);
      if (!deepLinkLoadedRef.current) loadSurah(currentSurahId, true);
    }
    deepLinkLoadedRef.current = false;
  }, [currentSurahId, readingMode]);

  useEffect(() => { if (isDrawing) setIsDrawing(false); }, [currentSurahId, currentPageNum]);

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
        getVersePage(surah, verse).then(pg => { setCurrentPageNum(pg); setHeaderPage(pg); setHeaderSurahId(surah); ensurePageLoaded(pg); setTimeout(() => flatListRef.current?.scrollToIndex({ index: pg - 1, animated: false }), 500); });
      } else if (readingMode === 'ayah') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); }, 500);
      } else if (readingMode === 'continuous') {
        setTimeout(() => { const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse); if (idx !== -1 && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true }); }, 500);
      }
    }
  }, [studentData?.lastRead?.surah]);

  const updateData = async (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(dataToSave));
    if (currentStudent?.id) { await saveStudentData(currentStudent.id, dataToSave); await addToSyncQueue(currentStudent.id, dataToSave); dispatch(addPendingChange()); }
  };

  const handleWordFlow = useCallback((verseNum: number, wordIndex: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cHigh = studentData.highlights || {};
    const vHighs = cHigh[vKey]?.highlights || [];
    const exists = vHighs.find((h: any) => h.wordIndex === wordIndex);
    const newHighs = exists ? vHighs.filter((h: any) => h.wordIndex !== wordIndex) : [...vHighs, { id: uuidv4(), wordIndex, color: activeColor, createdAt: new Date().toISOString() }];
    updateData({ ...studentData, highlights: { ...cHigh, [vKey]: { highlights: newHighs } } });
    ReactNativeHapticFeedback.trigger('impactLight');
  }, [studentData, activeColor, currentSurahId]);

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
  const onBookmarkToggle = useCallback((verseNum: number, surahId?: number) => () => handleBookmarkFlow(verseNum, surahId), [handleBookmarkFlow]);
  const handleVerseLongPress = useCallback((verseNum: number) => { ReactNativeHapticFeedback.trigger('impactMedium'); setMenuVerse(verseNum); }, []);

  const handleCopyVerse = (verseNum: number) => {
    let verse: any;
    if (readingMode === 'page') {
      const pgVerses = pageVersesCache[currentPageNum] || [];
      verse = pgVerses.find((v: any) => v.verseNumber === verseNum);
    } else {
      verse = verses.find((v: any) => v.verseNumber === verseNum);
    }
    if (verse) { Clipboard.setString(`${verse.textArabic}\n\n${verse.textTranslation}`); Alert.alert('Copied', 'Verse copied to clipboard!'); }
    setMenuVerse(null);
  };
  const openNoteModal = () => { setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || ''); setShowNoteModal(true); };
  const saveNote = () => {
    if (!studentData || menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    updateData({ ...studentData, notes: { ...(studentData.notes || {}), [vKey]: noteText } });
    setShowNoteModal(false); setMenuVerse(null);
  };
  const handleAddVoiceNote = async () => {
    if (menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    if (!isRecording) { await audioRecorderPlayer.current.startRecorder(`audio_${Date.now()}.m4a`); setIsRecording(true); setMenuVerse(null); }
    else {
      const path = await audioRecorderPlayer.current.stopRecorder();
      setIsRecording(false);
      const existing = studentData?.notes?.[vKey] || '';
      updateData({ ...studentData, notes: { ...(studentData?.notes || {}), [vKey]: existing + (existing ? '\n' : '') + `audio:${path}` } });
    }
  };

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

  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;
  const readingMarkVerse = studentData?.lastRead?.surah === currentSurahId ? studentData?.lastRead?.verse : null;

  const togglePlayAudio = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${qariId}/${currentSurahId}.mp3`;
    if (isPlaying) { await audioPlayer.current.pausePlayer(); dispatch(setPlaying(false)); }
    else { await audioPlayer.current.startPlayer(url); dispatch(setPlaying(true)); }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AnimatedHeader visible={isHeaderVisible} surahName={headerInfo.surahName} surahId={headerInfo.surahId} juz={headerInfo.juz} page={headerInfo.page} pagesLeftInJuz={headerInfo.pagesLeftInJuz} nightMode={nightMode}
        onBack={() => navigation.navigate('Dashboard')} onOpenList={() => setShowList(true)} onBookmarks={() => navigation.navigate('Bookmarks')} onMistakes={() => navigation.navigate('Mistakes')}
        onShare={handleSharePage} onNotes={() => navigation.navigate('Notes')} onDraw={() => { headerVisibleBeforeDrawRef.current = isHeaderVisible; setIsHeaderVisible(false); setIsDrawing(true); }} onSettings={() => navigation.navigate('Settings')} />

      <View style={{ flex: 1 }} ref={viewShotRef} collapsable={false}>
        <GestureHandlerRootView style={{ flex: 1 }}><PanGestureHandler onHandlerStateChange={onSwipe} activeOffsetY={[-15, 15]} activeOffsetX={[-25, 25]} enabled={!isDrawing}>
          <View style={{ flex: 1, position: 'relative' }}>
            <Pressable style={styles.edgeTapLeft} onPress={() => setIsHeaderVisible((prev: boolean) => !prev)} />
            <Pressable style={styles.edgeTapRight} onPress={() => setIsHeaderVisible((prev: boolean) => !prev)} />

            {readingMode === 'ayah' && (
              <FlatList ref={flatListRef} data={verses} keyExtractor={(item: any) => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }: any) => (
                  <VerseDisplay verse={item} highlights={studentData?.highlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights}
                    isBookmarked={!!studentData?.bookmarks?.[`${currentSurahId}_${item.verseNumber}`]} isReadingMark={readingMarkVerse === item.verseNumber}
                    onWordPress={onWordPress(item.verseNumber)} onBookmarkToggle={onBookmarkToggle(item.verseNumber)} onVerseLongPress={handleVerseLongPress}
                    showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} />
                )}
                onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) { setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false)); } }}
                onEndReachedThreshold={0.5} ListFooterComponent={loadingMore ? <ActivityIndicator color="#00d4aa" /> : null}
                initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} scrollEventThrottle={16} />
            )}

            {readingMode === 'continuous' && (
              <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20 }}
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
                  notes={studentData?.notes} readingMarkVerse={readingMarkVerse} flashingVerse={flashingVerse} />
                {loadingMore && <ActivityIndicator color="#00d4aa" />}
              </ScrollView>
            )}

            {readingMode === 'page' && (
              <FlatList ref={flatListRef} data={Array.from({ length: 604 }, (_, i) => i + 1)} keyExtractor={(item) => item.toString()}
                horizontal inverted pagingEnabled showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: isHeaderVisible ? 10 : 0 }}
                getItemLayout={(data, index) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * index, index })}
                initialNumToRender={3} maxToRenderPerBatch={5} windowSize={5}
                onMomentumScrollEnd={(e) => {
                  const p = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width) + 1;
                  if (p !== currentPageNum) {
                    setCurrentPageNum(p); setHeaderPage(p); ensurePageLoaded(p + 1); ensurePageLoaded(p - 1);
                    const pData = pageCache[p];
                    if (pData) {
                      const firstWord = pData.lines?.find((l: any) => l.words?.length > 0)?.words?.[0];
                      if (firstWord?.location) {
                        const sId = parseInt(firstWord.location.split(':')[0], 10);
                        if (sId && sId !== currentSurahId) dispatch(setSurah({ surahId: sId, verses: [] }));
                      }
                    }
                  }
                }}
                renderItem={({ item }: any) => {
                  ensurePageLoaded(item);
                  ensurePageVersesLoaded(item);
                  const pData = pageCache[item];
                  return (
                    <View style={{ width: Dimensions.get('window').width, flex: 1 }}>
                      {pData ? (
                        <MushafPageView versesForPage={pageVersesCache[item] || []} pageData={pData} highlights={studentData?.highlights} onWordPress={handleWordFlow}
                          onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress} bookmarks={studentData?.bookmarks}
                          flashingVerseKey={flashingVerse ? `${currentSurahId}_${flashingVerse}` : null} notes={studentData?.notes} readingMarkVerse={readingMarkVerse} />
                      ) : (<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#00d4aa" /></View>)}
                    </View>
                  );
                }} />
            )}

            {isCapturing && studentData?.drawings?.[drawingKey]?.paths?.length > 0 && (<StaticDrawingOverlay paths={studentData.drawings[drawingKey].paths} />)}
          </View>
        </PanGestureHandler></GestureHandlerRootView>
      </View>

      {isDrawing && (
        <DrawingCanvas onClose={() => { setIsDrawing(false); setIsHeaderVisible(headerVisibleBeforeDrawRef.current); }} initialPaths={studentData?.drawings?.[drawingKey]?.paths || []}
          onSave={(paths: any) => { if (studentData) updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date() } } }); }} />
      )}

      {isCapturing && <View style={styles.capturingOverlay}><ActivityIndicator size="large" color="#00d4aa" /></View>}
      {isHeaderVisible && <AudioPlayerBar onOpenQari={() => setShowQariModal(true)} onTogglePlay={togglePlayAudio} isPlaying={isPlaying} />}

      <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} />
      <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />



      <Modal visible={menuVerse !== null} transparent animationType="fade" onRequestClose={() => setMenuVerse(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVerse(null)}>
          <View style={styles.compactMenuContainer}>
            <TouchableOpacity style={styles.compactBtn} onPress={() => { handleBookmarkFlow(menuVerse!); setMenuVerse(null); }}><Text style={styles.compactIcon}>🔖</Text></TouchableOpacity>
            <TouchableOpacity style={styles.compactBtn} onPress={() => { const v = menuVerse; setMenuVerse(null); Alert.alert('Set Reading Mark', `Start reading from verse ${v}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => { if (v) updateData({ ...studentData, lastRead: { surah: currentSurahId, verse: v } }); } }]); }}><Text style={styles.compactIcon}>📍</Text></TouchableOpacity>
            <TouchableOpacity style={styles.compactBtn} onPress={openNoteModal}><Text style={styles.compactIcon}>📝</Text></TouchableOpacity>
            <TouchableOpacity style={styles.compactBtn} onPress={handleAddVoiceNote}><Text style={styles.compactIcon}>{isRecording ? '⏹️' : '🎤'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.compactBtn} onPress={() => handleCopyVerse(menuVerse!)}><Text style={styles.compactIcon}>📋</Text></TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentArea: { flex: 1 },
  capturingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingBottom: 40 },
  compactMenuContainer: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderRadius: 35, padding: 5, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  compactBtn: { width: 55, height: 55, justifyContent: 'center', alignItems: 'center' },
  compactIcon: { fontSize: 22 },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', backgroundColor: '#1e1e1e', borderRadius: 10, padding: 20 },
  noteInput: { color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 8, flex: 1, marginLeft: 5 },
  edgeTapLeft: { position: 'absolute', top: 0, left: 0, width: 10, height: '100%', zIndex: 1 },
  edgeTapRight: { position: 'absolute', top: 0, right: 0, width: 10, height: '100%', zIndex: 1 },
});
