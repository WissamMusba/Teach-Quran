import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

interface Props {
  visible: boolean; surahName: string; surahId: number; juz: number; page: number; pagesLeftInJuz: number; nightMode: boolean;
  onBack: () => void; onOpenList: () => void; onBookmarks: () => void; onMistakes: () => void;
  onShare: () => void; onNotes: () => void; onDraw: () => void; onSettings: () => void;
}

const AnimatedHeader: React.FC<Props> = (p) => {
  const [measured, setMeasured] = useState(0);
  const anim = useRef(new Animated.Value(p.visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: p.visible ? 1 : 0, duration: 240, useNativeDriver: false }).start();
  }, [p.visible]);

  const heightStyle = useMemo(
    () => (measured > 0 ? anim.interpolate({ inputRange: [0, 1], outputRange: [0, measured] }) : undefined),
    [measured, anim],
  );
  const translateY = useMemo(
    () => (measured > 0 ? anim.interpolate({ inputRange: [0, 1], outputRange: [-measured, 0] }) : 0),
    [measured, anim],
  );

  const bg = p.nightMode ? '#1a1a2e' : '#f5f5f5';
  const titleColor = p.nightMode ? '#fff' : '#1a1a1a';
  const subColor = p.nightMode ? '#8a8a8a' : '#777';

  const Icon = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
      <Text style={[styles.icon, { color: titleColor }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.wrap, { backgroundColor: bg, height: heightStyle, opacity: anim, overflow: 'hidden' }]}>
      <Animated.View
        style={{ transform: [{ translateY }] }}
        onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0 && h !== measured) setMeasured(h); }}
      >
        <View style={styles.row}>
          <TouchableOpacity onPress={p.onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={p.onOpenList} style={styles.titleBlock} activeOpacity={0.7}>
            <Text style={[styles.surahName, { color: titleColor }]} numberOfLines={1}>{p.surahName}</Text>
            <Text style={[styles.surahSub, { color: subColor }]}>Surah {p.surahId} ☰</Text>
          </TouchableOpacity>
          <View style={styles.icons}>
            <Icon label="🔖" onPress={p.onBookmarks} />
            <Icon label="✏️" onPress={p.onMistakes} />
            <Icon label="📤" onPress={p.onShare} />
            <Icon label="📝" onPress={p.onNotes} />
            <Icon label="🖍️" onPress={p.onDraw} />
            <Icon label="⚙️" onPress={p.onSettings} />
          </View>
        </View>
        <Text style={[styles.infoLine, { color: subColor }]}>
          Juz {p.juz}{p.page > 0 ? ` · Page ${p.page} · ${p.pagesLeftInJuz} left in Juz` : ''}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: '#2a2a2a', zIndex: 100 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 2 },
  back: { color: '#00d4aa', fontSize: 24, marginRight: 8 },
  titleBlock: { flex: 1, marginRight: 8 },
  surahName: { fontSize: 16, fontWeight: 'bold' },
  surahSub: { fontSize: 11, marginTop: 1 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 15 },
  infoLine: { fontSize: 11, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2 },
});

export default React.memo(AnimatedHeader);
