import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';

const AudioPlayerBar = ({ onOpenQari, onTogglePlay, isPlaying }: any) => {
  const { currentQari, currentSurah } = useSelector((s: any) => s.audio);
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onTogglePlay} style={styles.playBtn}>
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.qariInfo} onPress={onOpenQari}>
        <Text style={styles.qariName}>{currentQari}</Text>
        <Text style={styles.surahName}>Surah {currentSurah}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onOpenQari} style={styles.expandBtn}>
        <Text style={styles.expandIcon}>⌃</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { height: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingHorizontal: 20 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4aa', justifyContent: 'center', alignItems: 'center' },
  playIcon: { color: '#121212', fontSize: 20, fontWeight: 'bold' },
  qariInfo: { flex: 1, marginLeft: 15 },
  qariName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  surahName: { color: '#b0b0b0', fontSize: 12 },
  expandBtn: { padding: 10 },
  expandIcon: { color: '#b0b0b0', fontSize: 20 }
});
export default memo(AudioPlayerBar);
