/**
 * FILE: src/screens/LoopSettingsScreen.tsx
 * ROLE: Loop configuration for audio playback: an enable switch plus four dropdowns
 *       (Start from / End Verse / Loop count / Ayah repeat). Every change dispatches
 *       setLoop immediately (no Save button). When enabled, the AudioPlayerBar LOOP
 *       START button plays startVerse..endVerse loopCount times (each ayah replayed
 *       ayahRepeat times) and then flows on past the range. Until the user customizes
 *       (any dropdown pick), the range auto-follows the page the reader was on when
 *       this screen opened — first to last verse, one loop pass.
 * DEPENDS ON: Redux audioSlice.loop + setLoop (persisted), quranSlice.currentSurahId +
 *             surahNames, settingsSlice.nightMode; utils/audioPlayback SURAH_VERSE_COUNTS;
 *             components/common/ScreenHeader (self-back).
 * USED BY: App.tsx Stack.Screen "LoopSettings" (headerShown:false) — opened from the
 *          AudioPlayerBar LOOP SETTINGS button (QuranViewScreen onOpenLoopSettings).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, ScrollView, Modal, FlatList, TextInput } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setLoop } from '../store/audioSlice';
import { SURAH_VERSE_COUNTS } from '../utils/audioPlayback';
import { getVersesByPage } from '../database/quranData';
import ScreenHeader from '../components/common/ScreenHeader';
import CollapsibleBannerAd from '../components/ads/CollapsibleBannerAd';

const COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * OptionPicker — compact bottom-sheet dropdown (a modal list, like a loop player's
 * picker). Props: visible/title/options/selected/onSelect/onClose/theme + optional
 * labelFor(item) to render custom option text.
 */
const OptionPicker = ({ visible, title, options, selected, onSelect, onClose, labelFor }: any) => {
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const sheetBg = nightMode ? '#1a1a2e' : '#ffffff';
  const border = nightMode ? '#2a2a4a' : '#e2e5f0';
  const text = nightMode ? '#fff' : '#1a1a1a';
  const sub = nightMode ? '#8a8a8a' : '#6b6b76';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles(nightMode).pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles(nightMode).pickerSheet, { backgroundColor: sheetBg, borderColor: border }]}>
          <Text style={[styles(nightMode).pickerTitle, { color: text }]}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item: any) => String(item)}
            initialNumToRender={30}
            maxToRenderPerBatch={30}
            renderItem={({ item }: any) => {
              const active = item === selected;
              return (
                <TouchableOpacity style={[styles(nightMode).pickerRow, { borderColor: border }]} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
                  <Text style={[styles(nightMode).pickerRowText, { color: active ? nightMode ? '#7BA7DB' : '#1C3D72' : text }]}>{labelFor ? labelFor(item) : String(item)}</Text>
                  {active && <Text style={{ color: nightMode ? '#7BA7DB' : '#1C3D72', fontSize: 16, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/**
 * NumberEditor — inline direct-entry sheet: type the verse/count number instead of
 * scrolling the dropdown. Props: visible/title/draft/onChangeText/onSave/onClose.
 * Save commits via commitEdit (clamped + customized); the label rows still open the
 * dropdown picker.
 */
const NumberEditor = ({ visible, title, draft, onChangeText, onSave, onClose }: any) => {
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const sheetBg = nightMode ? '#1a1a2e' : '#ffffff';
  const border = nightMode ? '#2a2a4a' : '#e2e5f0';
  const text = nightMode ? '#fff' : '#1a1a1a';
  const sub = nightMode ? '#8a8a8a' : '#6b6b76';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles(nightMode).pickerBackdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles(nightMode).pickerSheet, { backgroundColor: sheetBg, borderColor: border, paddingBottom: 18 }]}>
          <Text style={[styles(nightMode).pickerTitle, { color: text }]}>{title}</Text>
          <TextInput
            style={[styles(nightMode).numInput, { color: text, borderColor: border, backgroundColor: nightMode ? '#12122a' : '#f4f6fb' }]}
            value={draft} onChangeText={onChangeText} keyboardType="number-pad" autoFocus selectTextOnFocus maxLength={3}
            placeholder="Type a number" placeholderTextColor={sub} />
          <View style={styles(nightMode).numBtns}>
            <TouchableOpacity style={[styles(nightMode).numBtn, { backgroundColor: nightMode ? '#2a2a4a' : '#e2e5f0' }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles(nightMode).numBtnText, { color: sub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles(nightMode).numBtn, { backgroundColor: nightMode ? '#7BA7DB' : '#1C3D72' }]} onPress={onSave} activeOpacity={0.7}>
              <Text style={[styles(nightMode).numBtnText, { color: '#121212' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

/**
 * LoopSettingsScreen — enable switch + four setting rows, live dispatch on every pick.
 * FLOW: 1) read audio.loop + quran.currentSurahId/surahNames; verseCount from
 *          SURAH_VERSE_COUNTS. 2) The row LABEL opens the dropdown OptionPicker; the
 *          row VALUE opens the NumberEditor for direct typing. Selecting clamps
 *          the range (start > end auto-raises end; end < start auto-raises start) and
 *          dispatches setLoop(patch). 3) Summary line shows the resolved behavior.
 */
export default function LoopSettingsScreen({ route }: any) {
  const dispatch = useDispatch();
  const loop = useSelector((s: any) => s.audio?.loop) || {};
  const surahId = useSelector((s: any) => s.quran.currentSurahId);
  const surahNames = useSelector((s: any) => s.quran.surahNames);
  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const textStyle = useSelector((s: any) => s.quran.textStyle);
  const [picker, setPicker] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ mode: string; draft: string } | null>(null);

  const verseCount = SURAH_VERSE_COUNTS[surahId - 1] || 1;
  const surahName = surahNames?.[surahId] || `Surah ${surahId}`;
  const verseOptions = Array.from({ length: verseCount }, (_, i) => i + 1);

  // Auto-default: until the user builds a CUSTOM loop (any start/end/count/repeat pick
  // flips `customized`), the range follows the page the reader is on at the moment this
  // screen opens — first verse to last verse of that page, ONE loop pass. After a
  // custom pick it stays frozen and never follows page changes again.
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
      }).catch(() => {});
    } else if ((loop.startVerse || 1) !== 1 || (loop.endVerse || verseCount) !== verseCount) {
      dispatch(setLoop({ startVerse: 1, endVerse: verseCount, loopCount: 1, ayahRepeat: 1 }));
    }
    return () => { cancelled = true; };
  }, [route?.params?.page, surahId, verseCount, textStyle]);

  const bg = nightMode ? '#121212' : '#f4f6fb';
  const cardBg = nightMode ? '#1a1a2e' : '#ffffff';
  const cardBorder = nightMode ? '#2a2a4a' : '#e2e5f0';
  const labelColor = nightMode ? '#fff' : '#1a1a1a';
  const subColor = nightMode ? '#8a8a8a' : '#6b6b76';
  const valueColor = nightMode ? (nightMode ? '#7BA7DB' : '#1C3D72') : '#00735f';
  const switchFalse = nightMode ? '#333' : '#d0d0d6';

  const patch = (p: any) => { dispatch(setLoop({ ...loop, ...p })); };

  const pickStart = (v: number) => {
    const next: any = { startVerse: v, customized: true };
    if (v > (loop.endVerse || verseCount)) next.endVerse = v;
    patch(next);
  };
  const pickEnd = (v: number) => {
    const next: any = { endVerse: v, customized: true };
    if (v < (loop.startVerse || 1)) next.startVerse = v;
    patch(next);
  };

  const start = Math.min(loop.startVerse || 1, verseCount);
  const end = Math.max(start, Math.min(loop.endVerse || verseCount, verseCount));
  const count = Math.max(1, loop.loopCount || 1);
  const repeat = Math.max(1, loop.ayahRepeat || 1);

  const commitEdit = () => {
    if (!edit) return;
    const n = parseInt(edit.draft, 10);
    if (!isNaN(n) && n >= 1) {
      if (edit.mode === 'start') pickStart(Math.min(n, verseCount));
      else if (edit.mode === 'end') pickEnd(Math.min(n, verseCount));
      else if (edit.mode === 'count') patch({ loopCount: Math.min(n, 99), customized: true });
      else if (edit.mode === 'repeat') patch({ ayahRepeat: Math.min(n, 99), customized: true });
    }
    setEdit(null);
  };

  return (
    <View style={[styles(nightMode).wrapper, { backgroundColor: bg }]}>
      <ScreenHeader title="Loop Settings" subtitle={surahName} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles(nightMode).content}>
        <View style={[styles(nightMode).section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles(nightMode).row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles(nightMode).rowLabel, { color: labelColor }]}>Enable loop</Text>
              <Text style={[styles(nightMode).rowSub, { color: subColor }]}>LOOP START plays the range below</Text>
            </View>
            <Switch value={!!loop?.enabled} onValueChange={(v) => { patch({ enabled: v }); }} trackColor={{ false: switchFalse, true: nightMode ? '#7BA7DB' : '#1C3D72' }} />
          </View>
          <View style={[styles(nightMode).divider, { backgroundColor: cardBorder }]} />
          <View style={styles(nightMode).row}>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setPicker('start')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowLabel, { color: labelColor }]}>Start from ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setEdit({ mode: 'start', draft: String(start) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowValue, { color: valueColor }]}>Verse {start} ✎</Text>
            </TouchableOpacity>
          </View>
          <View style={styles(nightMode).row}>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setPicker('end')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowLabel, { color: labelColor }]}>End Verse ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setEdit({ mode: 'end', draft: String(end) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowValue, { color: valueColor }]}>Verse {end} ✎</Text>
            </TouchableOpacity>
          </View>
          <View style={styles(nightMode).row}>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setPicker('count')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowLabel, { color: labelColor }]}>Loop count ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setEdit({ mode: 'count', draft: String(count) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowValue, { color: valueColor }]}>{count} {count === 1 ? 'time' : 'times'} ✎</Text>
            </TouchableOpacity>
          </View>
          <View style={styles(nightMode).row}>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setPicker('repeat')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowLabel, { color: labelColor }]}>Ayah repeat ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(nightMode).rowMain} onPress={() => setEdit({ mode: 'repeat', draft: String(repeat) })} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles(nightMode).rowValue, { color: valueColor }]}>{repeat} {repeat === 1 ? 'time' : 'times'} ✎</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles(nightMode).summary, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles(nightMode).summaryText, { color: subColor }]}>
            {loop?.enabled
              ? `LOOP START plays verses ${start}–${end}${count > 1 ? `, ${count} times total` : ''}${repeat > 1 ? ` (each ayah ×${repeat})` : ''}, then continues.`
              : 'Loop is off — the LOOP START button is greyed out.'}
          </Text>
        </View>
      </ScrollView>

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

const styles = (nightMode: boolean) => StyleSheet.create({
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
  divider: { height: 1 },
  summary: { marginTop: 14, borderRadius: 12, borderWidth: 1, padding: 14 },
  summaryText: { fontSize: 13, lineHeight: 19 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  pickerSheet: { borderRadius: 16, borderWidth: 1, maxHeight: '70%', paddingTop: 14 },
  pickerTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1 },
  pickerRowText: { fontSize: 15 },
});
