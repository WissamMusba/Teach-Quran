import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

const AudioPlayerBar = ({ onOpenQari, onTogglePlay, isPlaying, nightMode, surahId }: any) => {
  const { currentQari } = useSelector((s: any) => s.audio);
  const theme = nightMode ? darkTheme : lightTheme;
  return (
    <View style={[styles.container, theme.container]}>
      <TouchableOpacity onPress={onTogglePlay} style={styles.playBtn}>
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari}>
        <Text style={[styles.qariName, theme.qariName]}>{currentQari}</Text>
        <Text style={[styles.surahName, theme.surahName]}>Surah {surahId}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onOpenQari} style={styles.expandBtn}>
        <Text style={[styles.expandIcon, theme.expandIcon]}>⌃</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 60, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingHorizontal: 20 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4aa', justifyContent: 'center', alignItems: 'center' },
  playIcon: { color: '#121212', fontSize: 20, fontWeight: 'bold' },
  qariInfo: { flex: 1, marginLeft: 15 },
  qariName: { fontSize: 16, fontWeight: 'bold' },
  surahName: { fontSize: 12 },
  expandBtn: { padding: 10 },
  expandIcon: { fontSize: 20 }
});

const darkTheme = StyleSheet.create({
  container: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a2a' },
  qariName: { color: '#fff' },
  surahName: { color: '#b0b0b0' },
  expandIcon: { color: '#b0b0b0' }
});

const lightTheme = StyleSheet.create({
  container: { backgroundColor: '#f5f5f5', borderTopColor: 'rgba(0,0,0,0.12)' },
  qariName: { color: '#1a1a1a' },
  surahName: { color: '#777' },
  expandIcon: { color: '#777' }
});

export default memo(AudioPlayerBar);
