import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, UIManager } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, clamp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, scaleFont, SHADOWS } from '../../utils/theme';
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true);
interface Props {
  visible: boolean; surahId: number; juz: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onBookmarks: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onDraw: () => void; onSettings: () => void;
}
const AnimatedHeader: React.FC<Props> = (p) => {
  const [h, setH] = useState(0);
  const prog = useSharedValue(p.visible ? 1 : 0);
  useEffect(() => { prog.value = withSpring(p.visible ? 1 : 0, { damping: 18, stiffness: 120, mass: 0.8 }); }, [p.visible]);
  const outer = useAnimatedStyle(() => { const t = clamp(prog.value, 0, 1); return { height: h ? h * t : (p.visible ? undefined : 0), opacity: t, overflow: 'hidden' as const }; });
  const inner = useAnimatedStyle(() => { const t = clamp(prog.value, 0, 1); return { transform: [{ translateY: (1 - t) * -h }] }; });
  const bg = p.nightMode ? COLORS.bgCard : '#f8f8f8';
  const txt = p.nightMode ? COLORS.textPrimary : COLORS.textDark;
  const icon = p.nightMode ? COLORS.textSecondary : COLORS.textDarkSecondary;
  const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={st.iconBtn} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
      <Text style={[st.iconText, { color: icon }]}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <Animated.View style={[st.wrap, outer, { backgroundColor: bg }, SHADOWS.md]}>
      <Animated.View style={inner} onLayout={(e) => { const m = e.nativeEvent.layout.height; if (m !== h) setH(m); }}>
        <SafeAreaView edges={['top']} style={st.safe}>
          <View style={st.row1}>
            <TouchableOpacity onPress={p.onBack} style={st.backBtn} activeOpacity={0.6}><Text style={[st.backText, { color: COLORS.primary }]}>←</Text></TouchableOpacity>
            <TouchableOpacity onPress={p.onOpenList} style={st.titleArea} activeOpacity={0.7}>
              <Text style={[st.surahName, { color: txt }]} numberOfLines={1}>Surah {p.surahId}</Text>
              <Text style={[st.juzText, { color: icon }]}>☰ Juz {p.juz}</Text>
            </TouchableOpacity>
            <Btn label="⚙️" onPress={p.onSettings} />
          </View>
          <View style={st.row2}>
            <Btn label="🔖" onPress={p.onBookmarks} /><Btn label="✏️" onPress={p.onMistakes} />
            <Btn label="📤" onPress={p.onShare} /><Btn label="📝" onPress={p.onNotes} /><Btn label="🖍️" onPress={p.onDraw} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </Animated.View>
  );
};
const st = StyleSheet.create({
  wrap: { zIndex: 100, borderBottomWidth: 1, borderBottomColor: COLORS.borderDark },
  safe: { paddingBottom: SPACING.sm },
  row1: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  backBtn: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: 'rgba(0,212,170,0.1)', justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: scaleFont(22), fontWeight: '700' },
  titleArea: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.sm },
  surahName: { fontSize: scaleFont(17), fontWeight: '700' },
  juzText: { fontSize: scaleFont(11), marginTop: 1 },
  row2: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs },
  iconBtn: { padding: SPACING.sm, borderRadius: RADIUS.sm, minWidth: 40, alignItems: 'center' },
  iconText: { textAlign: 'center', fontSize: scaleFont(16) },
});
export default React.memo(AnimatedHeader);
