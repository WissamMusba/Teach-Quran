/**
 * FILE: src/screens/LoopSettingsScreen.tsx
 * ROLE: Loop configuration for audio playback with full theme palette support.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Modal, FlatList, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setLoop } from '../store/audioSlice';
import { SURAH_VERSE_COUNTS } from '../utils/audioPlayback';
import { getVersesByPage } from '../database/quranData';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';
import { getThemeColors } from '../utils/theme';

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const OptionPicker = ({ visible, title, options, selected, onSelect, onClose, labelFor }: any) => {
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles(nightMode, themeColors).pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles(nightMode, themeColors).pickerSheet, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
          <Text style={[styles(nightMode, themeColors).pickerTitle, { color: themeColors.text }]}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item: any) => String(item)}
            initialNumToRender={10}
            maxToRenderPerBatch={20}
            renderItem={({ item }: any) => {
              const active = item === selected;
              return (
                <TouchableOpacity style={[styles(nightMode, themeColors).pickerRow, { borderTopColor: themeColors.border }]} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
                  <Text style={[styles(nightMode, themeColors).pickerRowText, { color: active ? themeColors.accent : themeColors.text, fontWeight: active ? '700' : '400' }]}>{labelFor ? labelFor(item) : String(item)}</Text>
                  {active && <Text style={{ color: themeColors.accent, fontSize: 16, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const NumberEditor = ({ visible, title, draft, onChangeText, onSave, onClose }: any) => {
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles(nightMode, themeColors).pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles(nightMode, themeColors).pickerSheet, { backgroundColor: themeColors.cardBg, borderColor: themeColors.border, paddingBottom: 18 }]}>
          <Text style={[styles(nightMode, themeColors).pickerTitle, { color: themeColors.text }]}>{title}</Text>
          <TextInput
            style={[styles(nightMode, themeColors).numInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: nightMode ? '#121520' : '#F0EBE0' }]}
            value={draft} onChangeText={onChangeText} keyboardType="number-pad" autoFocus selectTextOnFocus maxLength={3}
            placeholder="Type a number" placeholderTextColor={themeColors.subText} />
          <View style={styles(nightMode, themeColors).numBtns}>
            <TouchableOpacity style={[styles(nightMode, themeColors).numBtn, { backgroundColor: nightMode ? '#2A2E40' : '#E2DCD0' }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles(nightMode, themeColors).numBtnText, { color: themeColors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles(nightMode, themeColors).numBtn, { backgroundColor: themeColors.primary }]} onPress={onSave} activeOpacity={0.7}>
              <Text style={[styles(nightMode, themeColors).numBtnText, { color: '#FFFFFF' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function LoopSettingsScreen({ route }: any) {
  const dispatch = useDispatch();
  const loop = useSelector((s: any) => s.audio?.loop) || {};
  const surahId = useSelector((s: any) => s.quran.currentSurahId);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const [picker, setPicker] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ mode: string; draft: string } | null>(null);

  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  const verseCount = SURAH_VERSE_COUNTS[(Number(loop.surahId) || surahId) - 1] || 1;
  const loopSurahId = Number(loop.surahId) || surahId;
  const surahName = surahNames?.[loopSurahId] || `Surah ${loopSurahId}`;
  const verseOptions = Array.from({ length: verseCount }, (_, i) => i + 1);
  const surahOptions = Array.from({ length: 114 }, (_, i) => i + 1);

  useEffect(() => {
    if (loop.customized === true) return;
    let cancelled = false;
    const page = Number(route?.params?.page) || 0;
    if (page >= 1 && page <= 610) {
      getVersesByPage(page, textStyle).then(list => {
        if (cancelled || !Array.isArray(list) || !list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        const start = first?.surahId === surahId ? Math.max(1, Math.min(first.verseNumber, verseCount)) : 1;
        const end = last?.surahId === surahId ? Math.max(start, Math.min(last.verseNumber, verseCount)) : verseCount;
        if (start !== (loop.startVerse || 1) || end !== (loop.endVerse || verseCount)) {
          dispatch(setLoop({ startVerse: start, endVerse: end, loopCount: 1, ayahRepeat: 1 }));
        }
      });
    }
    return () => { cancelled = true; };
  }, []);

  const patch = (p: any) => dispatch(setLoop(p));
  const toggleEnabled = () => patch({ enabled: !loop?.enabled, customized: true });

  const start = Math.min(Math.max(1, loop.startVerse || 1), verseCount);
  const end = Math.min(Math.max(start, loop.endVerse || verseCount), verseCount);
  const count = Math.max(1, loop.loopCount || 1);
  const repeat = Math.max(1, loop.ayahRepeat || 1);

  const pickStart = (v: number) => {
    const nextStart = Math.max(1, Math.min(v, verseCount));
    const nextEnd = Math.max(nextStart, end);
    patch({ startVerse: nextStart, endVerse: nextEnd, customized: true });
  };
  const pickEnd = (v: number) => {
    const nextEnd = Math.max(1, Math.min(v, verseCount));
    const nextStart = Math.min(start, nextEnd);
    patch({ startVerse: nextStart, endVerse: nextEnd, customized: true });
  };
  const pickSurah = (s: number) => {
    const nextCount = SURAH_VERSE_COUNTS[s - 1] || 1;
    patch({ surahId: s, startVerse: 1, endVerse: nextCount, customized: true });
  };

  const commitEdit = () => {
    if (!edit) return;
    const n = parseInt(edit.draft, 10);
    if (!isNaN(n) && n > 0) {
      if (edit.mode === 'start') pickStart(n);
      else if (edit.mode === 'end') pickEnd(n);
      else if (edit.mode === 'count') patch({ loopCount: Math.min(100, n), customized: true });
      else if (edit.mode === 'repeat') patch({ ayahRepeat: Math.min(100, n), customized: true });
    }
    setEdit(null);
  };

  const bg = themeColors.bg;
  const cardBg = themeColors.cardBg;
  const cardBorder = themeColors.border;
  const labelColor = themeColors.text;
  const subColor = themeColors.subText;
  const valueColor = themeColors.accent;

  return (
    <View style={[styles(nightMode, themeColors).wrapper, { backgroundColor: bg }]}>
      <ScreenHeader title="Loop Settings" subtitle="Repeat range of verses" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles(nightMode, themeColors).content}>
        <View style={[styles(nightMode, themeColors).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles(nightMode, themeColors).row}>
            <View style={styles(nightMode, themeColors).rowMain}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>Enable Loop</Text>
              <Text style={[styles(nightMode, themeColors).rowSub, { color: subColor }]}>Repeat a range for hifdh practice</Text>
            </View>
            <Switch
              value={!!loop?.enabled}
              onValueChange={() => { toggleEnabled(); }}
              trackColor={{ false: nightMode ? '#333' : '#ddd', true: themeColors.accent }}
            />
          </View>

          <View style={[styles(nightMode, themeColors).divider, { backgroundColor: cardBorder }]} />

          <View style={styles(nightMode, themeColors).row}>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('surah')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>Surah ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('surah')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowValue, { color: valueColor }]}>{surahName}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles(nightMode, themeColors).divider, { backgroundColor: cardBorder }]} />

          <View style={styles(nightMode, themeColors).row}>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('start')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>Start from ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setEdit({ mode: 'start', draft: String(start) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowValue, { color: valueColor }]}>Verse {start} ✎</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles(nightMode, themeColors).divider, { backgroundColor: cardBorder }]} />

          <View style={styles(nightMode, themeColors).row}>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('end')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>End Verse ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setEdit({ mode: 'end', draft: String(end) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowValue, { color: valueColor }]}>Verse {end} ✎</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles(nightMode, themeColors).divider, { backgroundColor: cardBorder }]} />

          <View style={styles(nightMode, themeColors).row}>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('count')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>Loop count ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setEdit({ mode: 'count', draft: String(count) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowValue, { color: valueColor }]}>{count} {count === 1 ? 'time' : 'times'} ✎</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles(nightMode, themeColors).divider, { backgroundColor: cardBorder }]} />

          <View style={styles(nightMode, themeColors).row}>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setPicker('repeat')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowLabel, { color: labelColor }]}>Ayah repeat ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode, themeColors).rowMain} onPress={() => setEdit({ mode: 'repeat', draft: String(repeat) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode, themeColors).rowValue, { color: valueColor }]}>{repeat} {repeat === 1 ? 'time' : 'times'} ✎</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles(nightMode, themeColors).summary, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles(nightMode, themeColors).summaryText, { color: subColor }]}>
            {loop?.enabled
              ? `LOOP START plays ${surahName} verses ${start}–${end}${count > 1 ? `, ${count} times total` : ''}${repeat > 1 ? ` (each ayah ×${repeat})` : ''}, then continues.`
              : 'Loop is off — the LOOP START button is greyed out.'}
          </Text>
        </View>
      </ScrollView>

      <OptionPicker
        visible={picker === 'surah'} title="Which surah to loop" options={surahOptions} selected={loopSurahId}
        onSelect={pickSurah} onClose={() => setPicker(null)} labelFor={(s: number) => surahNames?.[s] || `Surah ${s}`} />
      <OptionPicker
        visible={picker === 'start'} title={`Start from — ${surahName}`} options={verseOptions} selected={start}
        onSelect={pickStart} onClose={() => setPicker(null)} labelFor={(v: number) => `Verse ${v}`} />
      <OptionPicker
        visible={picker === 'end'} title={`End Verse — ${surahName}`} options={verseOptions} selected={end}
        onSelect={pickEnd} onClose={() => setPicker(null)} labelFor={(v: number) => `Verse ${v}`} />
      <OptionPicker
        visible={picker === 'count'} title="How many times the part should loop" options={COUNT_OPTIONS} selected={count}
        onSelect={(v: number) => patch({ loopCount: v, customized: true })} onClose={() => setPicker(null)} labelFor={(v: number) => `${v} ${v === 1 ? 'time' : 'times'}`} />
      <OptionPicker
        visible={picker === 'repeat'} title="How many times each ayah replays" options={COUNT_OPTIONS} selected={repeat}
        onSelect={(v: number) => patch({ ayahRepeat: v, customized: true })} onClose={() => setPicker(null)} labelFor={(v: number) => `${v} ${v === 1 ? 'time' : 'times'}`} />

      <NumberEditor
        visible={!!edit}
        title={edit?.mode === 'start' ? `Start from — ${surahName}` : edit?.mode === 'end' ? `End Verse — ${surahName}` : edit?.mode === 'count' ? 'How many times the part should loop' : 'How many times each ayah replays'}
        draft={edit?.draft || ''}
        onChangeText={(t: string) => setEdit({ mode: edit!.mode, draft: t.replace(/[^0-9]/g, '') })}
        onSave={commitEdit} onClose={() => setEdit(null)} />
      <CollapsibleBannerAd />
    </View>
  );
}

const styles = (nightMode: boolean, theme: any) => StyleSheet.create({
  wrapper: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  rowMain: { flex: 1, justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowValue: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  numInput: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, fontSize: 18, fontWeight: '700', textAlign: 'center', marginHorizontal: 16 },
  numBtns: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 10 },
  numBtn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  numBtnText: { fontSize: 15, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth },
  summary: { marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 14 },
  summaryText: { fontSize: 13, lineHeight: 19 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  pickerSheet: { borderRadius: 16, borderWidth: 1, maxHeight: '70%', paddingTop: 14 },
  pickerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth },
  pickerRowText: { fontSize: 15 },
});
