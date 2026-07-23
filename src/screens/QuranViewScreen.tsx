import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State, TapGestureHandler } from 'react-native-gesture-handler';
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
import { getVersesBySurahPaginated, getVersePage, getMushafPageData } from '../database/quranData';
import { getStudentData, saveStudentData, addToSyncQueue } from '../database/localDB';
import MushafPageView from '../components/quran/MushafPageView';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const JUZ_MAP = [{j:1,s:1,v:1},{j:2,s:2,v:142},{j:3,s:2,v:253},{j:4,s:3,v:93},{j:5,s:4,v:24},{j:6,s:4,v:148},{j:7,s:5,v:82},{j:8,s:6,v:111},{j:9,s:7,v:88},{j:10,s:8,v:41},{j:11,s:9,v:93},{j:12,s:11,v:6},{j:13,s:12,v:53},{j:14,s:15,v:1},{j:15,s:17,v:1},{j:16,s:18,v:75},{j:17,s:21,v:1},{j:18,s:23,v:1},{j:19,s:25,v:21},{j:20,s:27,v:56},{j:21,s:29,v:46},{j:22,s:33,v:31},{j:23,s:36,v:28},{j:24,s:39,v:32},{j:25,s:41,v:47},{j:26,s:46,v:1},{j:27,s:51,v:31},{j:28,s:58,v:1},{j:29,s:67,v:1},{j:30,s:78,v:1}];

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
  const [menuVerse, setMenuVerse] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const flatListRef = useRef<any>(null);
  const scrollViewRef = useRef<any>(null);
  const deepLinkLoadedRef = useRef(false);
  const pagePromiseRef = useRef({});
  const [isRecording, setIsRecording] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const audioRecorderPlayer = useRef(new AudioRecorderPlayer());
  const audioPlayer = useRef(new AudioRecorderPlayer());
  const viewShotRef = useRef<any>(null);

  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  const { showPageInfo, nightMode, bgBrightness } = useSelector((s: any) => s.settings);
  const { isPlaying, currentQari } = useSelector((s: any) => s.audio);
  const activeColor = useSelector((s: any) => s.drawing.activeColor);

  const bgColor = nightMode ? '#121212' : '#FFFFFF';

  const getCurrentJuz = () => {
    const currentVerse = 1;
    for (let i = JUZ_MAP.length - 1; i >= 0; i--) {
      if (currentSurahId > JUZ_MAP[i].s || (currentSurahId === JUZ_MAP[i].s && currentVerse >= JUZ_MAP[i].v)) return JUZ_MAP[i].j;
    } return 1;
  };

  const ensurePageLoaded = useCallback((pageNum: number) => {
    if (pageCache[pageNum] || pagePromiseRef.current[pageNum]) return;
    pagePromiseRef.current[pageNum] = true;
    getMushafPageData(pageNum).then(data => {
      setPageCache(prev => ({ ...prev, [pageNum]: data }));
      delete pagePromiseRef.current[pageNum];
    });
  }, [pageCache]);
  
  useEffect(() => {
    const { surahId, scrollToVerse } = route.params || {};
    if (surahId) {
      if (readingMode === 'page') {
        getVersePage(surahId, scrollToVerse).then(page => {
          setCurrentPageNum(page); ensurePageLoaded(page);
          setTimeout(() => flatListRef.current?.scrollToIndex({ index: page - 1, animated: false }), 100);
        });
      } else {
        const targetPage = Math.ceil(scrollToVerse / 20);
        getVersesBySurahPaginated(surahId, 1, targetPage * 20).then(({ verses: v, total }) => {
          deepLinkLoadedRef.current = true; 
          dispatch(setSurah({ surahId, verses: v }));
          setPage(targetPage + 1); setHasMore(v.length < total);
          if (scrollToVerse) {
            setTimeout(() => {
              const idx = v.findIndex((x: any) => x.verseNumber === scrollToVerse);
              if (idx !== -1) {
                if (readingMode === 'ayah' && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                else if (readingMode === 'continuous' && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true });
              }
              dispatch(setFlashingVerse(scrollToVerse));
              setTimeout(() => dispatch(setFlashingVerse(null)), 2000);
            }, 500);
          }
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
    if (resetPage) {
      dispatch(setSurah({ surahId, verses: newVerses }));
      setPage(2); setHasMore(accLen < total);
    } else {
      dispatch(setSurah({ surahId, verses: [...versesRef.current, ...newVerses] }));
      setPage(currentPage + 1); setHasMore(accLen < total);
    }
  };

  useEffect(() => { 
    if (readingMode === 'page') {
      getVersePage(currentSurahId, 1).then(page => {
        setCurrentPageNum(page); ensurePageLoaded(page);
        setTimeout(() => flatListRef.current?.scrollToIndex({ index: page - 1, animated: false }), 100);
      });
    } else if (!deepLinkLoadedRef.current) {
      loadSurah(currentSurahId, true);
    }
    deepLinkLoadedRef.current = false; 
  }, [currentSurahId, readingMode]);

  useEffect(() => {
    if (currentStudent) {
      getStudentData(currentStudent.id).then(d => {
        const data = d || { bookmarks: {}, highlights: {}, drawings: {}, notes: {}, lastRead: null };
        dispatch(setStudentData(data));
        if (!d) saveStudentData(currentStudent.id, data);
      });
    }
  }, [currentStudent]);

  useEffect(() => {
    if (studentData?.lastRead) {
      const { surah, verse } = studentData.lastRead;
      if (currentSurahId !== surah) {
        dispatch(setSurah({ surahId: surah, verses: [] }));
      }
      if (readingMode === 'page') {
        getVersePage(surah, verse).then(p => {
          setCurrentPageNum(p);
          ensurePageLoaded(p);
          setTimeout(() => flatListRef.current?.scrollToIndex({ index: p - 1, animated: false }), 500);
        });
      } else if (readingMode === 'ayah') {
        setTimeout(() => {
          const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse);
          if (idx !== -1 && flatListRef.current) flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        }, 500);
      } else if (readingMode === 'continuous') {
        setTimeout(() => {
          const idx = versesRef.current.findIndex((x: any) => x.verseNumber === verse);
          if (idx !== -1 && scrollViewRef.current) scrollViewRef.current.scrollTo({ y: idx * 45, animated: true });
        }, 500);
      }
    }
  }, [studentData?.lastRead?.surah]);

  const updateData = async (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(dataToSave));
    if (currentStudent?.id) { 
      await saveStudentData(currentStudent.id, dataToSave); 
      await addToSyncQueue(currentStudent.id, dataToSave); 
      dispatch(addPendingChange()); 
    }
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

  const handleBookmarkFlow = useCallback((verseNum: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cMarks = studentData.bookmarks || {};
    const isMarked = !!cMarks[vKey];
    const newMarks = { ...cMarks };
    if (isMarked) delete newMarks[vKey]; else newMarks[vKey] = { surah: currentSurahId, verse: verseNum, createdAt: new Date().toISOString() };
    updateData({ ...studentData, bookmarks: newMarks });
    ReactNativeHapticFeedback.trigger('impactMedium');
  }, [studentData, currentSurahId]);

  const onWordPress = useCallback((verseNum: number) => (index: number) => handleWordFlow(verseNum, index), [handleWordFlow]);
  const onBookmarkToggle = useCallback((verseNum: number) => () => handleBookmarkFlow(verseNum), [handleBookmarkFlow]);

  const handleVerseLongPress = useCallback((verseNum: number) => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    setMenuVerse(verseNum);
  }, []);

  const handleCopyVerse = (verseNum: number) => {
    const verse = verses.find((v: any) => v.verseNumber === verseNum);
    if (verse) {
      Clipboard.setString(`${verse.textArabic}\n\n${verse.textTranslation}`);
      Alert.alert('Copied', 'Verse copied to clipboard!');
    }
    setMenuVerse(null);
  };

  const openNoteModal = () => {
    setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || '');
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (!studentData || menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    const newNotes = { ...(studentData.notes || {}), [vKey]: noteText };
    updateData({ ...studentData, notes: newNotes });
    setShowNoteModal(false); setMenuVerse(null);
  };

  const handleAddVoiceNote = async () => {
    if (menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    if (!isRecording) {
      await audioRecorderPlayer.current.startRecorder(`audio_${Date.now()}.m4a`);
      setIsRecording(true); setMenuVerse(null);
    } else {
      const path = await audioRecorderPlayer.current.stopRecorder();
      setIsRecording(false);
      const existing = studentData?.notes?.[vKey] || '';
      const newNotes = { ...(studentData?.notes || {}), [vKey]: existing + (existing ? '\n' : '') + `audio:${path}` };
      updateData({ ...studentData, notes: newNotes });
    }
  };

  const handleSharePage = async () => {
    const wasHeaderVisible = isHeaderVisible;
    try {
      setIsHeaderVisible(false);
      setIsCapturing(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.9 });
      await Share.open({ url: uri, type: 'image/jpeg', title: 'Quran Page' });
    } catch (e) {} finally {
      setIsCapturing(false);
      setIsHeaderVisible(wasHeaderVisible);
    }
  };

  const onSwipe = (event: any) => {
    if (isDrawing || readingMode === 'page') return;
    if (event.nativeEvent.state === State.END) {
      if (event.nativeEvent.translationX > 50 && currentSurahId > 1) dispatch(setSurah({ surahId: currentSurahId - 1, verses: [] }));
      else if (event.nativeEvent.translationX < -50 && currentSurahId < 114) dispatch(setSurah({ surahId: currentSurahId + 1, verses: [] }));
    }
  };

  const onCenterTap = useCallback(() => {
    setIsHeaderVisible(prev => !prev);
  }, []);

  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;

  const togglePlayAudio = async () => {
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : 'ar.abdulbasit';
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${qariId}/${currentSurahId}.mp3`;
    if (isPlaying) {
      await audioPlayer.current.pausePlayer();
      dispatch(setPlaying(false));
    } else {
      await audioPlayer.current.startPlayer(url);
      dispatch(setPlaying(true));
    }
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: bgColor }]}>
      <PanGestureHandler onHandlerStateChange={onSwipe} activeOffsetX={[-20, 20]} failOffsetY={[-5, 5]}>
        <View style={styles.container}>
          
          {isHeaderVisible && (
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setShowList(true)}><Text style={styles.surahName}>Surah {currentSurahId} ☰</Text></TouchableOpacity>
                <Text style={styles.juzText}>Juz {getCurrentJuz()}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => navigation.navigate('Bookmarks')}><Text style={styles.iconBtn}>🔖</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Mistakes')}><Text style={styles.iconBtn}>✏️</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleSharePage}><Text style={styles.iconBtn}>📤</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Notes')}><Text style={styles.iconBtn}>📝</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsDrawing(true)}><Text style={styles.iconBtn}>🖍️</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}><Text style={styles.iconBtn}>⚙️</Text></TouchableOpacity>
              </View>
            </View>
          )}
          
          <TapGestureHandler onActivated={onCenterTap} numberOfTaps={1} maxDurationMs={250} maxDeltaX={5} maxDeltaY={5}>
            <View style={{flex: 1}} ref={viewShotRef} collapsable={false}>
              
              {readingMode === 'ayah' && (
                <FlatList 
                  ref={flatListRef} data={verses} keyExtractor={(item: any) => item.id.toString()} 
                  contentContainerStyle={{ padding: 20, paddingBottom: isHeaderVisible ? 120 : 40 }} 
                  renderItem={({ item }) => (
                    <VerseDisplay verse={item} highlights={studentData?.highlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights || []} 
                      isBookmarked={!!studentData?.bookmarks?.[`${currentSurahId}_${item.verseNumber}`]} 
                      onWordPress={onWordPress(item.verseNumber)} onBookmarkToggle={onBookmarkToggle(item.verseNumber)} 
                      onVerseLongPress={handleVerseLongPress} showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} />
                  )}
                  onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) { setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false)); } }}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={loadingMore ? <ActivityIndicator size="large" color="#00d4aa" /> : null}
                  initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10}
                  scrollEventThrottle={16}
                />
              )}

              {readingMode === 'continuous' && (
                <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20, paddingBottom: isHeaderVisible ? 120 : 40 }} scrollEventThrottle={16}>
                  <FlowingText verses={verses} highlights={studentData?.highlights} onWordPress={handleWordFlow} 
                    onBookmarkToggle={handleBookmarkFlow} showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} 
                    onVerseLongPress={handleVerseLongPress} bookmarkedVerses={Object.keys(studentData?.bookmarks || {}).filter(k => k.startsWith(`${currentSurahId}_`)).map(k => parseInt(k.split('_')[1]))} 
                    notes={studentData?.notes} />
                  {loadingMore && <ActivityIndicator size="large" color="#00d4aa" style={{ marginTop: 20 }} />}
                </ScrollView>
              )}

              {readingMode === 'page' && (
                <FlatList
                  ref={flatListRef} data={Array.from({length: 604}, (_, i) => i + 1)} keyExtractor={(item) => item.toString()}
                  horizontal inverted pagingEnabled showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: isHeaderVisible ? 60 : 0 }}
                  getItemLayout={(data, index) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * index, index })}
                  initialNumToRender={3} maxToRenderPerBatch={5} windowSize={5}
                  onMomentumScrollEnd={(e) => {
                    const p = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width) + 1;
                    if (p !== currentPageNum) {
                      setCurrentPageNum(p); ensurePageLoaded(p + 1); ensurePageLoaded(p - 1);
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
                    const pData = pageCache[item];
                    return (
                      <View style={{ width: Dimensions.get('window').width, flex: 1 }}>
                        {pData ? <MushafPageView pageData={pData} highlights={studentData?.highlights} onWordPress={handleWordFlow} 
                          onBookmarkToggle={handleBookmarkFlow} onVerseLongPress={handleVerseLongPress} bookmarks={studentData?.bookmarks} 
                          flashingVerseKey={flashingVerse ? `${currentSurahId}_${flashingVerse}` : null} notes={studentData?.notes} /> 
                        : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#00d4aa" /></View>}
                        {showPageInfo && isHeaderVisible && (() => {
                          const pData = pageCache[item];
                          const vs = pData?.lines?.flatMap((l: any) => l.words?.map((w: any) => w.location?.split(':')?.[1])).filter(Boolean) || [];
                          const u = [...new Set(vs)];
                          const range = u.length > 0 ? `(Verses ${u[0]}-${u[u.length - 1]})` : '';
                          return (
                            <View style={styles.pageFooter}><Text style={styles.pageText}>Page {item} {range}</Text></View>
                          );
                        })()}
                      </View>
                    );
                  }}
                />
              )}
              {isCapturing && <StaticDrawingOverlay paths={studentData?.drawings?.[readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`]?.paths || []} />}
            </View>
          </TapGestureHandler>
          
          {isHeaderVisible && <AudioPlayerBar onOpenQari={() => setShowQariModal(true)} onTogglePlay={togglePlayAudio} isPlaying={isPlaying} />}
          
          <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} />
          <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />

          {isDrawing && (
            <DrawingCanvas onClose={() => setIsDrawing(false)} initialPaths={studentData?.drawings?.[drawingKey]?.paths || []} 
              onSave={(paths: any) => { if (studentData) updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date() } } }); }} />
          )}

          <Modal visible={menuVerse !== null} transparent animationType="fade" onRequestClose={() => setMenuVerse(null)}>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVerse(null)}>
              <View style={styles.compactMenuContainer}>
                <TouchableOpacity style={styles.compactBtn} onPress={() => { handleBookmarkFlow(menuVerse!); setMenuVerse(null); }}>
                  <Text style={styles.compactIcon}>🔖</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactBtn} onPress={() => { updateData({ ...studentData, lastRead: { surah: currentSurahId, verse: menuVerse } }); setMenuVerse(null); Alert.alert('Reading Mark Set'); }}>
                  <Text style={styles.compactIcon}>📍</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactBtn} onPress={openNoteModal}>
                  <Text style={styles.compactIcon}>📝</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactBtn} onPress={handleAddVoiceNote}>
                  <Text style={styles.compactIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.compactBtn} onPress={() => handleCopyVerse(menuVerse!)}>
                  <Text style={styles.compactIcon}>📋</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          <Modal visible={showNoteModal} transparent animationType="slide" onRequestClose={() => setShowNoteModal(false)}>
            <View style={styles.noteOverlay}>
              <View style={styles.noteContainer}>
                <TextInput style={styles.noteInput} multiline placeholder="Write note here..." placeholderTextColor="#888" value={noteText} onChangeText={setNoteText} />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.noteCancelBtn}><Text style={{color:'#fff'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={saveNote} style={styles.noteSaveBtn}><Text style={{color:'#121212', fontWeight:'bold'}}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ 
  container: { flex: 1 }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderColor: '#2a2a2a' }, 
  backBtn: { color: '#00d4aa', fontSize: 24 }, 
  surahName: { color: '#fff', fontSize: 18, fontWeight: 'bold' }, 
  juzText: { color: '#b0b0b0', fontSize: 11 },
  iconBtn: { fontSize: 16, marginLeft: 12 },
  pageFooter: { alignItems: 'center', marginTop: 20 },
  pageText: { color: '#555', fontSize: 14 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingBottom: 40 },
  compactMenuContainer: { flexDirection: 'row', backgroundColor: '#1e1e1e', borderRadius: 35, padding: 5, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  compactBtn: { width: 55, height: 55, justifyContent: 'center', alignItems: 'center' },
  compactIcon: { fontSize: 22 },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', backgroundColor: '#1e1e1e', borderRadius: 10, padding: 20 },
  noteInput: { color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: '#00d4aa', borderRadius: 8, flex: 1, marginLeft: 5 }
});
