import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { downloadAndCacheQuran, getSurahs } from '../database/quranData';
import auth from '@react-native-firebase/auth';
import { useDispatch } from 'react-redux';
import { setSurahNames } from '../store/quranSlice';
import { COLORS, SPACING, scaleFont, RADIUS } from '../utils/theme';
export default function SplashScreen({ navigation }: any) {
  const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(false); const [errorMessage, setErrorMessage] = useState(''); const dispatch = useDispatch();
  const pulse = useSharedValue(1);
  useEffect(() => { pulse.value = withRepeat(withSequence(withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })), -1, false); }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const load = useCallback(async () => { setIsLoading(true); setError(false); try { await downloadAndCacheQuran(); const surahs = await getSurahs(); const map: Record<number, string> = {}; surahs.forEach((s: any) => { map[s.id] = s.englishName; }); dispatch(setSurahNames(map)); const unsub = auth().onAuthStateChanged(user => { navigation.replace(user ? 'Dashboard' : 'Login'); unsub(); }); } catch (e: any) { setError(true); setErrorMessage(e.message || JSON.stringify(e)); setIsLoading(false); } }, [navigation, dispatch]);
  useEffect(() => { load(); }, [load]);
  return (
    <SafeAreaView style={styles.container}><Animated.View entering={FadeIn.duration(600)} style={styles.center}>
      <Animated.Text style={[styles.logo, pulseStyle]}>📖</Animated.Text><Text style={styles.title}>Teach Quran</Text>
      {isLoading ? (<Animated.View entering={FadeInDown.delay(300)} style={styles.loadingArea}><View style={styles.spinner} /><Text style={styles.subtitle}>Downloading Quran Data…</Text></Animated.View>)
        : error ? (<Animated.View entering={FadeInDown.delay(200)} style={styles.errorArea}><Text style={styles.errorText}>Download failed!</Text><ScrollView style={styles.errorBox}><Text style={styles.errorDetail}>{errorMessage}</Text></ScrollView><TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}><Text style={styles.retryText}>Retry Download</Text></TouchableOpacity></Animated.View>) : null}
    </Animated.View></SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  logo: { fontSize: 72, marginBottom: SPACING.xl }, title: { fontSize: scaleFont(34), fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xxl },
  loadingArea: { alignItems: 'center' }, spinner: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: COLORS.borderDark, borderTopColor: COLORS.primary, marginBottom: SPACING.xl },
  subtitle: { fontSize: scaleFont(16), color: COLORS.textSecondary }, errorArea: { alignItems: 'center', width: '100%' },
  errorText: { fontSize: scaleFont(18), color: COLORS.red, fontWeight: '700', marginBottom: SPACING.md },
  errorBox: { maxHeight: 150, width: '100%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xl },
  errorDetail: { fontSize: scaleFont(12), color: COLORS.textSecondary },
  retryBtn: { backgroundColor: COLORS.accent, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl, borderRadius: RADIUS.md },
  retryText: { color: '#fff', fontSize: scaleFont(16), fontWeight: '700' },
});
