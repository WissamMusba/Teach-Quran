import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import { setSurah, toggleTranslation, setFlashingVerse, setLastRead } from '../store/quranSlice';
import { addAction } from '../store/historySlice';
import { addPendingChange } from '../store/syncSlice';
import { setStudentData } from '../store/studentSlice';
import VerseDisplay from '../components/quran/VerseDisplay';
import FlowingText from '../components/quran/FlowingText';
import DrawingCanvas from '../components/drawing/DrawingCanvas';
import SurahList from '../components/quran/SurahList';
import { getVersesBySurahPaginated, getVersePage, getMushafPageData } from '../database/quranData';
import { getStudentData, saveStudentData, addToSyncQueue } from '../database/localDB';
import MushafPageView from '../components/quran/MushafPageView';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { DRAWING_COLORS } from '../utils/constants';

export default function QuranViewScreen({ navigation, route }: any) {
  const dispatch = useDispatch();
  const [isDrawing, setIsDrawing] = useState(false);
  const [showList, setShowList] = useState(false);
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

  const ensurePageLoaded = useCallback((pageNum: number) => {
    setPageCache(prev => {
      if (!prev[pageNum]) {
        getMushafPageData(pageNum).then(data => {
          setPageCache(p => ({ ...p, [pageNum]: data }));
        });
      }
      return prev;
    });
  }, []);
  
  const { currentSurahId, verses, showTranslation, fontSize, readingMode, flashingVerse, lastReadSurah } = useSelector((s: any) => s.quran);
  const { currentStudent, studentData } = useSelector((s: any) => s.student);
  const activeColor = useSelector((s: any) => s.drawing.activeColor);

  // Deep Linking
  useEffect(() => {
    const { surahId, scrollToVerse } = route.params || {};
    if (surahId) {
      if (readingMode === 'page') {
        if (scrollToVerse) {
          getVersePage(surahId, scrollToVerse).then(page => {
            setCurrentPageNum(page);
            ensurePageLoaded(page);
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: page - 1, animated: false });
            }, 100);
          });
        }
      } else {
        const targetPage = Math.ceil(scrollToVerse / 20);
        
        getVersesBySurahPaginated(surahId, 1, targetPage * 20).then(({ verses: v, total }) => {
          deepLinkLoadedRef.current = true; 
          
          dispatch(setSurah({ surahId, verses: v }));
          setPage(targetPage + 1);
          setHasMore(v.length < total);
          
          if (scrollToVerse) {
            setTimeout(() => {
              const idx = v.findIndex((x: any) => x.verseNumber === scrollToVerse);
              if (idx !== -1) {
                if (readingMode === 'ayah' && flatListRef.current) {
                  flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
                } else if (readingMode === 'continuous' && scrollViewRef.current) {
                  scrollViewRef.current.scrollTo({ y: idx * 45, animated: true });
                }
              }
              dispatch(setFlashingVerse(scrollToVerse));
              setTimeout(() => dispatch(setFlashingVerse(null)), 2000);
            }, 500);
          }
        });
      }
    }
  }, [route.params]);

  // Student Data Load
  useEffect(() => {
    if (currentStudent) {
      getStudentData(currentStudent.id).then(d => {
        const data = d || { bookmarks: {}, highlights: {}, drawings: {}, notes: {} };
        dispatch(setStudentData(data));
        if (!d) saveStudentData(currentStudent.id, data);
      });
    }
  }, [currentStudent]);

  // Ayah/Continuous Load
  const surahIdRef = useRef(currentSurahId);
  useEffect(() => { surahIdRef.current = currentSurahId; }, [currentSurahId]);
  const loadSurah = async (surahId: number, resetPage: boolean = true) => {
    const currentPage = resetPage ? 1 : page;
    const { verses: newVerses, total } = await getVersesBySurahPaginated(surahId, currentPage, 20);
    if (surahId !== surahIdRef.current) return; 
    const accLen = resetPage ? newVerses.length : verses.length + newVerses.length;
    if (resetPage) {
      dispatch(setSurah({ surahId, verses: newVerses }));
      setPage(2); setHasMore(accLen < total);
    } else {
      dispatch(setSurah({ surahId, verses: [...verses, ...newVerses] }));
      setPage(currentPage + 1); setHasMore(accLen < total);
    }
  };
  useEffect(() => { 
    if (readingMode === 'page') {
      getVersePage(currentSurahId, 1).then(page => {
        setCurrentPageNum(page);
        ensurePageLoaded(page);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: page - 1, animated: false });
        }, 100);
      });
    } else if (!deepLinkLoadedRef.current) {
      loadSurah(currentSurahId, true);
    }
    deepLinkLoadedRef.current = false; 
  }, [currentSurahId, readingMode]);

  // Track last read position
  useEffect(() => {
    dispatch(setLastRead({ surah: currentSurahId, verse: 1 }));
  }, [currentSurahId]);

  const updateData = async (newData: any) => {
    const dataToSave = { ...newData, updatedAt: new Date().toISOString() };
    const studentIdToSave = currentStudent?.id;
    dispatch(setStudentData(dataToSave));
    if (studentIdToSave) { await saveStudentData(studentIdToSave, dataToSave); await addToSyncQueue(studentIdToSave, dataToSave); dispatch(addPendingChange()); }
  };

  // Handlers for FlowingText (needs verseNum arg)
  const handleWordFlow = (verseNum: number, wordIndex: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cHigh = studentData.highlights || {};
    const vHighs = cHigh[vKey]?.highlights || [];
    const exists = vHighs.find((h: any) => h.wordIndex === wordIndex);
    const newHighs = exists ? vHighs.filter((h: any) => h.wordIndex !== wordIndex) : [...vHighs, { id: uuidv4(), wordIndex, color: activeColor }];
    updateData({ ...studentData, highlights: { ...cHigh, [vKey]: { highlights: newHighs } } });
    dispatch(addAction({ type: 'highlight', action: exists ? 'remove' : 'add', data: { vKey, wordIndex } }));
    try { ReactNativeHapticFeedback.trigger('impactLight'); } catch (_) {}
  };
  const handleBookmarkFlow = (verseNum: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cMarks = studentData.bookmarks || {};
    const isMarked = !!cMarks[vKey];
    const newMarks = { ...cMarks };
    if (isMarked) delete newMarks[vKey]; else newMarks[vKey] = { surah: currentSurahId, verse: verseNum };
    updateData({ ...studentData, bookmarks: newMarks });
    dispatch(addAction({ type: 'bookmark', action: isMarked ? 'remove' : 'add', data: { vKey } }));
    try { ReactNativeHapticFeedback.trigger('impactMedium'); } catch (_) {}
  };

  // Handlers for VerseDisplay (no verseNum arg, uses closure)
  const onWordPress = useCallback((verseNum: number) => (index: number) => handleWordFlow(verseNum, index), [studentData, activeColor, currentSurahId]);
  const onBookmarkToggle = useCallback((verseNum: number) => () => handleBookmarkFlow(verseNum), [studentData, currentSurahId]);

  // Long Press Menu Handlers
  const handleVerseLongPress = (verseNum: number) => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    setMenuVerse(verseNum);
  };

  const handleHighlightVerse = (verseNum: number, color: string) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cHigh = studentData.highlights || {};
    const newHighs = [{ id: uuidv4(), wordIndex: 0, color }];
    updateData({ ...studentData, highlights: { ...cHigh, [vKey]: { highlights: newHighs } } });
    setMenuVerse(null);
  };

  const handleCopyVerse = (verseNum: number) => {
    const verse = verses.find((v: any) => v.verseNumber === verseNum);
    if (verse) {
      Clipboard.setString(`${verse.textArabic}\n\n${verse.textTranslation}`);
      Alert.alert('Copied', 'Verse copied to clipboard!');
    }
    setMenuVerse(null);
  };

  const openNoteModal = () => {
    const vKey = `${currentSurahId}_${menuVerse}`;
    setNoteText(studentData?.notes?.[vKey] || '');
    setShowNoteModal(true);
  };

  const saveNote = () => {
    if (!studentData || menuVerse === null) return;
    const vKey = `${currentSurahId}_${menuVerse}`;
    const cNotes = studentData.notes || {};
    const newNotes = { ...cNotes, [vKey]: noteText };
    updateData({ ...studentData, notes: newNotes });
    setShowNoteModal(false);
    setMenuVerse(null);
  };

  const handleWordTranslation = (verseNum: number) => {
    const verse = verses.find((v: any) => v.verseNumber === verseNum);
    Alert.alert('Verse Translation', verse?.textTranslation || 'Translation not found.');
    setMenuVerse(null);
  };

  const onSwipe = (event: any) => {
    if (isDrawing || readingMode === 'page') return;
    if (event.nativeEvent.state === State.END) {
      if (event.nativeEvent.translationX > 50 && currentSurahId > 1) { dispatch(setSurah({ surahId: currentSurahId - 1, verses: [] })); }
      else if (event.nativeEvent.translationX < -50 && currentSurahId < 114) { dispatch(setSurah({ surahId: currentSurahId + 1, verses: [] })); }
    }
  };

  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;

  const pageDataForFooter = pageCache[currentPageNum];
  const pageVerseNumbers = pageDataForFooter?.lines?.flatMap((l: any) => l.words?.map((w: any) => w.location?.split(':')?.[1])).filter(Boolean) || [];
  const uniqueVerses = [...new Set(pageVerseNumbers)];
  const verseRange = uniqueVerses.length > 0 ? `(Verses ${uniqueVerses[0]}-${uniqueVerses[uniqueVerses.length - 1]})` : '';

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
      if (!loadingMore && hasMore && verses.length > 0) {
        setLoadingMore(true);
        loadSurah(currentSurahId, false).finally(() => setLoadingMore(false));
      }
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <PanGestureHandler onHandlerStateChange={onSwipe} activeOffsetX={[-20, 20]} failOffsetY={[-5, 5]}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Dashboard')}><Text style={styles.btnText}>←</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowList(true)}><Text style={[styles.surahName, readingMode === 'page' && { fontSize: 16 }]}>Surah {currentSurahId} ☰</Text></TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => navigation.navigate('Bookmarks')}><Text style={styles.iconBtn}>📌</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Mistakes')}><Text style={styles.iconBtn}>✏️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setIsDrawing(true)}><Text style={styles.iconBtn}>🖍️</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')}><Text style={styles.iconBtn}>⚙️</Text></TouchableOpacity>
            </View>
          </View>
          
          {readingMode === 'ayah' && (
            <FlatList 
              ref={flatListRef}
              data={verses} 
              keyExtractor={(item: any) => item.id.toString()} 
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }} 
              ListHeaderComponent={null}
              renderItem={({ item }) => (
                <VerseDisplay 
                  verse={item} 
                  highlights={studentData?.highlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights || []} 
                  isBookmarked={!!studentData?.bookmarks?.[`${currentSurahId}_${item.verseNumber}`]} 
                  onWordPress={onWordPress(item.verseNumber)} 
                  onBookmarkToggle={onBookmarkToggle(item.verseNumber)} 
                  onVerseLongPress={handleVerseLongPress}
                  showTranslation={showTranslation} 
                  fontSize={fontSize}
                  flashingVerse={flashingVerse}
                />
              )}
              onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) { setLoadingMore(true); loadSurah(currentSurahId, false).finally(() => setLoadingMore(false)); } }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={loadingMore ? <ActivityIndicator size="large" color="#0066FF" /> : null}
              onScrollToIndexFailed={(info: any) => flatListRef.current.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
            />
          )}

          {readingMode === 'continuous' && (
            <ScrollView 
              ref={scrollViewRef}
              contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              <FlowingText 
                verses={verses}
                highlights={studentData?.highlights}
                onWordPress={handleWordFlow}
                onBookmarkToggle={handleBookmarkFlow}
                showTranslation={showTranslation}
                fontSize={fontSize}
                flashingVerse={flashingVerse}
                onVerseLongPress={handleVerseLongPress}
                bookmarkedVerses={Object.keys(studentData?.bookmarks || {}).filter(k => k.startsWith(`${currentSurahId}_`)).map(k => parseInt(k.split('_')[1]))}
                notes={studentData?.notes}
              />
              {loadingMore && <ActivityIndicator size="large" color="#0066FF" style={{ marginTop: 20 }} />}
            </ScrollView>
          )}

          {readingMode === 'page' && (
            <FlatList
              ref={flatListRef}
              data={Array.from({length: 604}, (_, i) => i + 1)}
              keyExtractor={(item) => item.toString()}
              horizontal
              inverted
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              getItemLayout={(data, index) => ({ length: Dimensions.get('window').width, offset: Dimensions.get('window').width * index, index })}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                }, 100);
              }}
              onMomentumScrollEnd={(e) => {
                const offset = e.nativeEvent.contentOffset.x;
                const page = Math.round(offset / Dimensions.get('window').width) + 1;
                if (page !== currentPageNum) {
                  setCurrentPageNum(page);
                  ensurePageLoaded(page + 1);
                  ensurePageLoaded(page - 1);
                  
                  const pageData = pageCache[page];
                  if (pageData) {
                    const firstWord = pageData.lines?.find((l: any) => l.words?.length > 0)?.words?.[0];
                    if (firstWord?.location) {
                      const surahId = parseInt(firstWord.location.split(':')[0], 10);
                      if (surahId && surahId !== currentSurahId) {
                        dispatch(setSurah({ surahId, verses: [] }));
                      }
                    }
                  }
                }
              }}
              renderItem={({ item }: any) => {
                ensurePageLoaded(item);
                const pageData = pageCache[item];
                return (
                  <View style={{ width: Dimensions.get('window').width, flex: 1 }}>
                    {pageData ? (
                      <MushafPageView 
                        pageData={pageData}
                        highlights={studentData?.highlights}
                        onWordPress={handleWordFlow}
                        onBookmarkToggle={handleBookmarkFlow}
                        onVerseLongPress={handleVerseLongPress}
                        bookmarks={studentData?.bookmarks}
                        flashingVerseKey={flashingVerse ? `${currentSurahId}_${flashingVerse}` : null}
                        notes={studentData?.notes}
                      />
                    ) : (
                      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0066FF" />
                      </View>
                    )}
                    <View style={styles.pageFooter}>
                      <Text style={styles.pageText}>Page {item} {verseRange}</Text>
                    </View>
                  </View>
                );
              }}
            />
          )}
          
          <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} />
          
          {isDrawing && (
            <DrawingCanvas 
              onClose={() => setIsDrawing(false)} 
              initialPaths={studentData?.drawings?.[drawingKey]?.paths || []} 
              onSave={(paths: any) => { 
                if (studentData) {
                  updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date() } } });
                }
              }} 
            />
          )}

          {/* VERSE MINI MENU */}
          <Modal visible={menuVerse !== null} transparent animationType="slide" onRequestClose={() => setMenuVerse(null)}>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVerse(null)}>
              <View style={styles.menuContainer}>
                <TouchableOpacity style={styles.menuItem} onPress={() => { handleBookmarkFlow(menuVerse!); setMenuVerse(null); }}>
                  <Text style={styles.menuText}>🔖 Bookmark</Text>
                </TouchableOpacity>
                
                <Text style={styles.menuLabel}>🖍️ Highlight Verse</Text>
                <View style={styles.menuColorRow}>
                  {DRAWING_COLORS.map(c => (
                    <TouchableOpacity key={c.id} style={[styles.menuColorDot, { backgroundColor: c.hex }]} onPress={() => handleHighlightVerse(menuVerse!, c.hex)} />
                  ))}
                </View>

                <TouchableOpacity style={styles.menuItem} onPress={openNoteModal}>
                  <Text style={styles.menuText}>📝 Add Note</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleCopyVerse(menuVerse!)}>
                  <Text style={styles.menuText}>📋 Copy Verse</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleWordTranslation(menuVerse!)}>
                  <Text style={styles.menuText}>🌐 Word Translation</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* NOTE MODAL */}
          <Modal visible={showNoteModal} transparent animationType="fade" onRequestClose={() => setShowNoteModal(false)}>
            <View style={styles.noteOverlay}>
              <View style={styles.noteContainer}>
                <TextInput style={styles.noteInput} multiline placeholder="Write note here..." placeholderTextColor="#888" value={noteText} onChangeText={setNoteText} />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setShowNoteModal(false)} style={styles.noteCancelBtn}><Text style={{color:'#fff'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={saveNote} style={styles.noteSaveBtn}><Text style={{color:'#fff'}}>Save</Text></TouchableOpacity>
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
  container: { flex: 1, backgroundColor: '#121212' }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#1e1e1e', borderBottomWidth: 1, borderColor: '#333' }, 
  btnText: { color: '#0066FF', fontSize: 18 }, 
  surahName: { color: '#fff', fontSize: 18, fontWeight: 'bold' }, 
  iconBtn: { fontSize: 18, marginLeft: 15 },
  drawFab: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }, 
  fabText: { color: '#fff', fontWeight: 'bold', fontSize: 24 },
  pageFooter: { alignItems: 'center', marginTop: 20 },
  pageText: { color: '#555', fontSize: 14 },
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  menuContainer: { backgroundColor: '#1e1e1e', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  menuItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  menuText: { color: '#fff', fontSize: 16 },
  menuLabel: { color: '#aaa', fontSize: 14, marginTop: 15, marginBottom: 10 },
  menuColorRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  menuColorDot: { width: 30, height: 30, borderRadius: 15 },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  noteContainer: { width: '80%', backgroundColor: '#1e1e1e', borderRadius: 10, padding: 20 },
  noteInput: { color: '#fff', borderWidth: 1, borderColor: '#333', borderRadius: 8, padding: 10, height: 100, textAlignVertical: 'top', marginBottom: 15 },
  noteActions: { flexDirection: 'row', justifyContent: 'space-between' },
  noteCancelBtn: { padding: 10, alignItems: 'center', backgroundColor: '#333', borderRadius: 8, flex: 1, marginRight: 5 },
  noteSaveBtn: { padding: 10, alignItems: 'center', backgroundColor: '#0066FF', borderRadius: 8, flex: 1, marginLeft: 5 }
});