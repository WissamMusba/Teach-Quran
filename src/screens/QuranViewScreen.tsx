import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, TextInput, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useDispatch, useSelector } from 'react-redux';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { setSurah, setFlashingVerse } from '../store/quranSlice';
import { setCurrentSurah as setAudioCurrentSurah } from '../store/audioSlice';
import { useQuranData } from '../hooks/useQuranData';
import VerseDisplay from '../components/quran/VerseDisplay';
import FlowingText from '../components/quran/FlowingText';
import DrawingCanvas from '../components/drawing/DrawingCanvas';
import StaticDrawingOverlay from '../components/drawing/StaticDrawingOverlay';
import SurahList from '../components/quran/SurahList';
import AudioPlayerBar from '../components/audio/AudioPlayerBar';
import QariSelector from '../components/audio/QariSelector';
import AnimatedHeader from '../components/common/AnimatedHeader';
import VoiceNoteRecorder from '../components/audio/VoiceNoteRecorder';
import VoiceNotePlayer from '../components/audio/VoiceNotePlayer';
import { getVersePage } from '../database/quranData';
import { v4 as uuidv4 } from 'uuid';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Clipboard from '@react-native-clipboard/clipboard';
import { captureRef } from 'react-native-view-shot';
import Share from 'react-native-share';
import { COLORS, SPACING, RADIUS, BOTTOM_BAR_HEIGHT, scaleFont, SHADOWS, JUZ_MAP } from '../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function QuranViewScreen({ navigation, route }: any) {
  const dispatch = useDispatch();
  const [isDrawing, setIsDrawing] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showQariModal, setShowQariModal] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [menuVerse, setMenuVerse] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const deepLinkLoadedRef = useRef(false);
  const viewShotRef = useRef<any>(null);
  const audioPlayerRef = useRef<any>(null);

  const currentSurahId = useSelector((s: any) => s.quran.currentSurahId);
  const showTranslation = useSelector((s: any) => s.quran.showTranslation);
  const fontSize = useSelector((s: any) => s.quran.fontSize);
  const readingMode = useSelector((s: any) => s.quran.readingMode);
  const flashingVerse = useSelector((s: any) => s.quran.flashingVerse);
  const nightMode = useSelector((s: any) => s.settings.nightMode);
  const bgBrightness = useSelector((s: any) => s.settings.bgBrightness);
  const isPlaying = useSelector((s: any) => s.audio.isPlaying);
  const currentQari = useSelector((s: any) => s.audio.currentQari);
  const activeColor = useSelector((s: any) => s.drawing.activeColor);
  const { pageVersesCache, verses, studentData, hasMore, loadingMore, ensurePageLoaded, loadSurah, loadMore, updateData, loadStudentData, flashVerse } = useQuranData(currentSurahId);

  const bgColor = nightMode ? `rgb(${bgBrightness},${bgBrightness},${bgBrightness})` : '#FFFFFF';
  const bookmarkedKeys = useMemo(() => Object.keys(studentData?.bookmarks || {}), [studentData?.bookmarks]);
  const readingMarkVerse = studentData?.lastRead?.surah === currentSurahId ? studentData?.lastRead?.verse : null;
  const drawingKey = readingMode === 'page' ? `page_${currentPageNum}` : `surah_${currentSurahId}`;

  useEffect(() => { dispatch(setAudioCurrentSurah(currentSurahId)); }, [currentSurahId]);

  const getCurrentJuz = () => { for (let i = JUZ_MAP.length - 1; i >= 0; i--) if (currentSurahId > JUZ_MAP[i].s || (currentSurahId === JUZ_MAP[i].s && 1 >= JUZ_MAP[i].v)) return JUZ_MAP[i].j; return 1; };

  useEffect(() => {
    const { surahId, scrollToVerse } = route.params || {};
    if (!surahId) return;
    if (readingMode === 'page') {
      getVersePage(surahId, scrollToVerse).then(p => { setCurrentPageNum(p); ensurePageLoaded(p); setTimeout(() => flatListRef.current?.scrollToIndex({ index: p - 1, animated: false }), 150); });
    } else {
      const targetPage = Math.ceil((scrollToVerse || 1) / 20);
      loadSurah(surahId, true).then(() => {
        deepLinkLoadedRef.current = true;
        if (scrollToVerse) setTimeout(() => { const idx = verses.findIndex((x: any) => x.verseNumber === scrollToVerse); if (idx !== -1) { if (readingMode === 'ayah') flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); else scrollViewRef.current?.scrollTo({ y: idx * 50, animated: true }); } flashVerse(scrollToVerse); }, 500);
      });
    }
  }, [route.params]);

  useEffect(() => {
    if (readingMode === 'page') { getVersePage(currentSurahId, 1).then(p => { setCurrentPageNum(p); ensurePageLoaded(p); setTimeout(() => flatListRef.current?.scrollToIndex({ index: p - 1, animated: false }), 150); }); }
    else if (!deepLinkLoadedRef.current) loadSurah(currentSurahId, true);
    deepLinkLoadedRef.current = false;
  }, [currentSurahId, readingMode]);

  useEffect(() => { loadStudentData(); }, [loadStudentData]);

  const handleWordFlow = useCallback((verseNum: number, wordIndex: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const vHighs = studentData.highlights?.[vKey]?.highlights || [];
    const exists = vHighs.find((h: any) => h.wordIndex === wordIndex);
    const newHighs = exists ? vHighs.filter((h: any) => h.wordIndex !== wordIndex) : [...vHighs, { id: uuidv4(), wordIndex, color: activeColor, createdAt: new Date().toISOString() }];
    updateData({ ...studentData, highlights: { ...(studentData.highlights || {}), [vKey]: { highlights: newHighs } } });
    ReactNativeHapticFeedback.trigger('impactLight');
  }, [studentData, activeColor, currentSurahId, updateData]);

  const handleBookmarkFlow = useCallback((verseNum: number) => {
    if (!studentData) return;
    const vKey = `${currentSurahId}_${verseNum}`;
    const cMarks = studentData.bookmarks || {};
    const newMarks = { ...cMarks };
    if (newMarks[vKey]) delete newMarks[vKey]; else newMarks[vKey] = { surah: currentSurahId, verse: verseNum, createdAt: new Date().toISOString() };
    updateData({ ...studentData, bookmarks: newMarks });
    ReactNativeHapticFeedback.trigger('impactMedium');
  }, [studentData, currentSurahId, updateData]);

  const onWordPress = useCallback((verseNum: number) => (index: number) => handleWordFlow(verseNum, index), [handleWordFlow]);
  const onBookmarkToggle = useCallback((verseNum: number) => () => handleBookmarkFlow(verseNum), [handleBookmarkFlow]);
  const handleVerseLongPress = useCallback((verseNum: number) => { ReactNativeHapticFeedback.trigger('impactMedium'); setMenuVerse(verseNum); }, []);

  const handleCopyVerse = (verseNum: number) => { const v = verses.find((x: any) => x.verseNumber === verseNum); if (v) { Clipboard.setString(`${v.textArabic}\n\n${v.textTranslation || ''}`); Alert.alert('Copied', 'Verse copied to clipboard!'); } setMenuVerse(null); };
  const openNoteModal = () => { setNoteText(studentData?.notes?.[`${currentSurahId}_${menuVerse}`] || ''); setShowNoteModal(true); };
  const saveNote = () => { if (!studentData || menuVerse === null) return; const vKey = `${currentSurahId}_${menuVerse}`; updateData({ ...studentData, notes: { ...(studentData.notes || {}), [vKey]: noteText } }); setShowNoteModal(false); setMenuVerse(null); };
  const handleVoiceNoteSaved = (path: string, ms: number) => { if (!studentData || menuVerse === null) return; const vKey = `${currentSurahId}_${menuVerse}`; const audioKey = `audio:${vKey}:${Date.now()}`; updateData({ ...studentData, notes: { ...(studentData.notes || {}), [audioKey]: `voice|${path}|${ms}` } }); setShowVoiceRecorder(false); setMenuVerse(null); ReactNativeHapticFeedback.trigger('notificationSuccess'); };

  const handleSharePage = async () => { const was = isHeaderVisible; try { setIsHeaderVisible(false); setIsCapturing(true); await new Promise(r => setTimeout(r, 350)); const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.9 }); await Share.open({ url: uri, type: 'image/jpeg', title: 'Quran Page' }); } catch {} finally { setIsCapturing(false); setIsHeaderVisible(was); } };

  const onSwipe = (event: any) => { if (isDrawing || readingMode === 'page') return; if (event.nativeEvent.state === State.END) { if (event.nativeEvent.translationX > 60 && currentSurahId > 1) dispatch(setSurah({ surahId: currentSurahId - 1, verses: [] })); else if (event.nativeEvent.translationX < -60 && currentSurahId < 114) dispatch(setSurah({ surahId: currentSurahId + 1, verses: [] })); } };

  const togglePlayAudio = async () => {
    const ARP = (await import('react-native-audio-recorder-player')).default;
    if (!audioPlayerRef.current) audioPlayerRef.current = new ARP();
    const qariId = currentQari.includes('Afasy') ? 'ar.alafasy' : currentQari.includes('Basit') ? 'ar.abdulbasitmurattal' : currentQari.includes('Ayyoub') ? 'ar.muhammadayyoub' : 'ar.aymanswoaid';
    const url = `https://cdn.islamic.network/quran/audio-surah/128/${qariId}/${currentSurahId}.mp3`;
    if (isPlaying) { await audioPlayerRef.current.pausePlayer(); } else { await audioPlayerRef.current.startPlayer(url); }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AnimatedHeader visible={isHeaderVisible} surahId={currentSurahId} juz={getCurrentJuz()} nightMode={nightMode}
        onBack={() => navigation.navigate('Dashboard')} onOpenList={() => setShowList(true)}
        onBookmarks={() => navigation.navigate('Bookmarks')} onMistakes={() => navigation.navigate('Mistakes')}
        onShare={handleSharePage} onNotes={() => navigation.navigate('Notes')} onDraw={() => setIsDrawing(true)} onSettings={() => navigation.navigate('Settings')} />

      <Pressable style={styles.edgeTapTop} onPress={() => setIsHeaderVisible(p => !p)} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureHandlerRootView style={styles.flex}>
          <PanGestureHandler onHandlerStateChange={onSwipe}>
            <View style={styles.flex} ref={viewShotRef}>

              {readingMode === 'ayah' && (
                <FlatList ref={flatListRef} data={verses} keyExtractor={(item: any) => (item.id ?? item.verseNumber).toString()}
                  contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg }}
                  renderItem={({ item }: any) => (
                    <VerseDisplay verse={item} highlights={studentData?.highlights?.[`${currentSurahId}_${item.verseNumber}`]?.highlights}
                      isBookmarked={!!studentData?.bookmarks?.[`${currentSurahId}_${item.verseNumber}`]} isReadingMark={readingMarkVerse === item.verseNumber}
                      onWordPress={onWordPress(item.verseNumber)} onBookmarkToggle={onBookmarkToggle(item.verseNumber)} onVerseLongPress={handleVerseLongPress}
                      showTranslation={showTranslation} fontSize={fontSize} flashingVerse={flashingVerse} />
                  )}
                  onEndReached={() => { if (!loadingMore && hasMore && verses.length > 0) loadMore(); }} onEndReachedThreshold={0.5}
                  ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.xl }} /> : null}
                  initialNumToRender={10} maxToRenderPerBatch={10} windowSize={10} scrollEventThrottle={16} showsVerticalScrollIndicator={false} />
              )}

              {readingMode === 'continuous' && (
                <ScrollView ref={scrollViewRef} contentContainerStyle={{ paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg }} showsVerticalScrollIndicator={false}>
                  <FlowingText verses={verses} highlights={studentData?.highlights} onWordPress={handleWordFlow} onVerseLongPress={handleVerseLongPress}
                    onBookmarkToggle={handleBookmarkFlow} showTranslation={showTranslation} fontSize={fontSize} bookmarkedKeys={bookmarkedKeys}
                    notes={studentData?.notes} readingMarkVerse={readingMarkVerse} flashingVerse={flashingVerse} />
                  {loadingMore && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.xl }} />}
                </ScrollView>
              )}

              {readingMode === 'page' && (
                <FlatList ref={flatListRef} data={Array.from({ length: 604 }, (_, i) => i + 1)} keyExtractor={(item) => item.toString()}
                  horizontal inverted pagingEnabled showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                  initialNumToRender={2} maxToRenderPerBatch={3} windowSize={3}
                  onMomentumScrollEnd={(e) => { const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W) + 1; if (p !== currentPageNum) { setCurrentPageNum(p); ensurePageLoaded(p + 1); ensurePageLoaded(p - 1); const first = (pageVersesCache[p] || [])[0]; if (first && first.surahId !== currentSurahId) dispatch(setSurah({ surahId: first.surahId, verses: [] })); } }}
                  renderItem={({ item }: any) => { ensurePageLoaded(item); const pv = pageVersesCache[item] || []; return (
                    <View style={{ width: SCREEN_W, flex: 1 }}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl }}>
                        {pv.length ? (
                          <FlowingText verses={pv} highlights={studentData?.highlights} onWordPress={handleWordFlow} onVerseLongPress={handleVerseLongPress}
                            onBookmarkToggle={handleBookmarkFlow} showTranslation={showTranslation} fontSize={fontSize} bookmarkedKeys={bookmarkedKeys}
                            notes={studentData?.notes} readingMarkVerse={readingMarkVerse} flashingVerse={flashingVerse} />
                        ) : (<ActivityIndicator color={COLORS.primary} />)}
                      </ScrollView>
                    </View>
                  ); }} />
              )}

              {!isDrawing && studentData?.drawings?.[drawingKey]?.paths?.length > 0 && (<StaticDrawingOverlay paths={studentData.drawings[drawingKey].paths} />)}
            </View>
          </PanGestureHandler>
        </GestureHandlerRootView>
      </KeyboardAvoidingView>

      {isCapturing && (<View style={styles.capturingOverlay}><ActivityIndicator size="large" color={COLORS.primary} /></View>)}

      {isHeaderVisible && (<Animated.View entering={SlideInDown.duration(250)} exiting={SlideOutDown.duration(180)}><AudioPlayerBar onOpenQari={() => setShowQariModal(true)} onTogglePlay={togglePlayAudio} isPlaying={isPlaying} /></Animated.View>)}

      <SurahList visible={showList} onClose={() => setShowList(false)} onSelect={(id: number) => { dispatch(setSurah({ surahId: id, verses: [] })); setShowList(false); }} />
      <QariSelector visible={showQariModal} onClose={() => setShowQariModal(false)} />

      {isDrawing && (<DrawingCanvas onClose={() => setIsDrawing(false)} initialPaths={studentData?.drawings?.[drawingKey]?.paths || []} onSave={(paths: any) => { if (studentData) updateData({ ...studentData, drawings: { ...(studentData.drawings || {}), [drawingKey]: { paths, updatedAt: new Date().toISOString() } } }); }} />)}

      {menuVerse !== null && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.menuOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVerse(null)} />
          <Animated.View entering={SlideInDown.springify().damping(18)} style={[styles.menuSheet, SHADOWS.lg]}>
            <View style={styles.menuHandle} /><Text style={styles.menuTitle}>Verse {menuVerse}</Text>
            <View style={styles.menuGrid}>
              {[
                { icon: '🔖', label: 'Bookmark', action: () => { handleBookmarkFlow(menuVerse!); setMenuVerse(null); } },
                { icon: '📍', label: 'Mark Read', action: () => { updateData({ ...studentData, lastRead: { surah: currentSurahId, verse: menuVerse } }); setMenuVerse(null); Alert.alert('Reading Mark Set'); } },
                { icon: '📝', label: 'Note', action: openNoteModal },
                { icon: '🎤', label: 'Voice Note', action: () => { setShowVoiceRecorder(true); } },
                { icon: '📋', label: 'Copy', action: () => handleCopyVerse(menuVerse!) },
              ].map((it, i) => (<TouchableOpacity key={i} style={styles.menuItem} onPress={it.action} activeOpacity={0.7}><Text style={styles.menuItemIcon}>{it.icon}</Text><Text style={styles.menuItemLabel}>{it.label}</Text></TouchableOpacity>))}
            </View>
          </Animated.View>
        </Animated.View>
      )}

      <Modal visible={showNoteModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.noteOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowNoteModal(false)} />
          <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.noteContainer, SHADOWS.lg]}>
            <Text style={styles.noteTitle}>📝 Note — Verse {menuVerse}</Text>
            <TextInput style={styles.noteInput} value={noteText} onChangeText={setNoteText} multiline placeholder="Write your note..." placeholderTextColor={COLORS.textMuted} autoFocus />
            <View style={styles.noteActions}>
              <TouchableOpacity style={styles.noteCancelBtn} onPress={() => setShowNoteModal(false)}><Text style={styles.noteCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.noteSaveBtn} onPress={saveNote}><Text style={styles.noteSaveText}>Save</Text></TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showVoiceRecorder} transparent animationType="fade">
        <View style={styles.noteOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowVoiceRecorder(false)} />
          <Animated.View entering={SlideInDown.springify().damping(20)}><VoiceNoteRecorder onSaved={handleVoiceNoteSaved} onCancel={() => { setShowVoiceRecorder(false); setMenuVerse(null); }} /></Animated.View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 }, flex: { flex: 1 },
  edgeTapTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 24, zIndex: 50 },
  capturingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  menuOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: COLORS.overlay, zIndex: 200 },
  menuSheet: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.textMuted, alignSelf: 'center', marginBottom: SPACING.lg },
  menuTitle: { color: COLORS.textPrimary, fontSize: scaleFont(17), fontWeight: '700', textAlign: 'center', marginBottom: SPACING.xl },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.md },
  menuItem: { width: 70, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.06)' },
  menuItemIcon: { fontSize: scaleFont(24), marginBottom: SPACING.xs },
  menuItemLabel: { color: COLORS.textSecondary, fontSize: scaleFont(11), textAlign: 'center' },
  noteOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.overlay, padding: SPACING.xxl },
  noteContainer: { width: '100%', maxWidth: 400, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.xl },
  noteTitle: { color: COLORS.textPrimary, fontSize: scaleFont(16), fontWeight: '700', marginBottom: SPACING.lg },
  noteInput: { color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.borderDark, borderRadius: RADIUS.md, padding: SPACING.md, height: 120, textAlignVertical: 'top', marginBottom: SPACING.lg, fontSize: scaleFont(15), backgroundColor: COLORS.bgInput },
  noteActions: { flexDirection: 'row', gap: SPACING.md },
  noteCancelBtn: { flex: 1, padding: SPACING.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md },
  noteCancelText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: scaleFont(15) },
  noteSaveBtn: { flex: 1, padding: SPACING.md, alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.md },
  noteSaveText: { color: COLORS.bgDark, fontWeight: '700', fontSize: scaleFont(15) },
});
