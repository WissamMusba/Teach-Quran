/**
 * FILE: src/components/audio/VoiceNoteRecorder.tsx
 * ROLE: Premium footer-bar voice note recorder with pulsing mic halo, live animated soundwave visualizer,
 *       and sleek glassmorphic controls with full dynamic theme palette support.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform, Animated, Easing } from 'react-native';
import { useSelector } from 'react-redux';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import Svg, { Path, Rect } from 'react-native-svg';
import { getThemeColors } from '../../utils/theme';

let AudioEncoderAndroidType: any, OutputFormatAndroidType: any, AudioSourceAndroidType: any;
try {
  const mod = require('react-native-audio-recorder-player');
  AudioEncoderAndroidType = mod.AudioEncoderAndroidType;
  OutputFormatAndroidType = mod.OutputFormatAndroidType;
  AudioSourceAndroidType = mod.AudioSourceAndroidType;
} catch {}

const recorder = new AudioRecorderPlayer();

const buildAudioSets = (): any => {
  const sets: any = { AudioSamplingRateAndroid: 16000, AudioEncodingBitRateAndroid: 24000, AudioChannelsAndroid: 1 };
  try {
    if (AudioSourceAndroidType && AudioSourceAndroidType.MIC !== undefined) sets.AudioSourceAndroid = AudioSourceAndroidType.MIC;
    if (OutputFormatAndroidType && OutputFormatAndroidType.MPEG_4 !== undefined) sets.OutputFormatAndroid = OutputFormatAndroidType.MPEG_4;
    if (AudioEncoderAndroidType) {
      if (AudioEncoderAndroidType.HE_AAC !== undefined) sets.AudioEncoderAndroid = AudioEncoderAndroidType.HE_AAC;
      else if (AudioEncoderAndroidType.AAC !== undefined) sets.AudioEncoderAndroid = AudioEncoderAndroidType.AAC;
    }
  } catch {}
  return sets;
};

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Phase = 'idle' | 'recording' | 'paused' | 'done';

const IconMic = ({ c = '#FFFFFF' }: { c?: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={c} fillOpacity={0.2} />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Path d="M12 19v4M8 23h8" />
  </Svg>
);

const IconPause = ({ c = '#FFFFFF' }: { c?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill={c}>
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);

const IconPlay = ({ c = '#FFFFFF' }: { c?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill={c}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

const IconStop = ({ c = '#FFFFFF' }: { c?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill={c}>
    <Rect x="5" y="5" width="14" height="14" rx="2" />
  </Svg>
);

const VoiceNoteRecorder = ({
  onSaved,
  onCancel,
  onDelete,
  maxMs = 60000,
}: {
  onSaved: (path: string, ms: number) => void;
  onCancel: () => void;
  onDelete?: () => void;
  maxMs?: number;
}) => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [time, setTime] = useState('00:00');
  const durRef = useRef(0);
  const pathRef = useRef<string | null>(null);
  const stoppingRef = useRef(false);
  const liveRef = useRef(false);

  const nightMode = useSelector((s: any) => s.settings?.nightMode);
  const colorTheme = useSelector((s: any) => s.settings?.colorTheme || 'classic');
  const themeColors = useMemo(() => getThemeColors(colorTheme, nightMode), [colorTheme, nightMode]);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const waveAnims = useRef([
    new Animated.Value(6),
    new Animated.Value(12),
    new Animated.Value(18),
    new Animated.Value(24),
    new Animated.Value(16),
    new Animated.Value(20),
    new Animated.Value(10),
    new Animated.Value(14),
  ]).current;

  // Pulse & Waveform loop while recording
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    let waveLoops: Animated.CompositeAnimation[] = [];

    if (phase === 'recording') {
      animLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.25, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.8, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.25, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
        ])
      );
      animLoop.start();

      // Soundwave bar jitter
      waveLoops = waveAnims.map((val, idx) => {
        const h1 = 6 + ((idx * 5) % 18);
        const h2 = 14 + ((idx * 7) % 14);
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(val, { toValue: h2, duration: 180 + idx * 30, easing: Easing.linear, useNativeDriver: false }),
            Animated.timing(val, { toValue: h1, duration: 180 + idx * 30, easing: Easing.linear, useNativeDriver: false }),
          ])
        );
        loop.start();
        return loop;
      });
    } else {
      pulseAnim.setValue(1);
      glowOpacity.setValue(0.4);
      waveAnims.forEach((val) => val.setValue(6));
    }

    return () => {
      animLoop?.stop();
      waveLoops.forEach((l) => l.stop());
    };
  }, [phase, pulseAnim, glowOpacity, waveAnims]);

  const requestPerm = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone Permission',
        message: 'Teach Quran needs microphone access to record recitation voice notes.',
        buttonNeutral: 'Ask Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      });
      return g === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const start = async () => {
    const ok = await requestPerm();
    if (!ok) {
      Alert.alert('Permission required', 'Microphone access is needed to record voice notes.');
      return;
    }
    const dir = `${RNFS.DocumentDirectoryPath}/voicenotes`;
    try {
      await RNFS.mkdir(dir);
    } catch {}
    const p = `${dir}/note_${Date.now()}.mp4`;
    pathRef.current = p;
    durRef.current = 0;
    setTime('00:00');
    stoppingRef.current = false;
    liveRef.current = true;
    try {
      await recorder.startRecorder(p, buildAudioSets());
      recorder.addRecordBackListener((e) => {
        if (!liveRef.current) return;
        const cur = e.currentPosition;
        durRef.current = cur;
        setTime(fmt(cur));
        if (cur >= maxMs && !stoppingRef.current) {
          stoppingRef.current = true;
          stop(true);
        }
      });
      setPhase('recording');
    } catch {
      Alert.alert('Recording failed', 'Could not initialize the audio recorder.');
      setPhase('idle');
      liveRef.current = false;
    }
  };

  const pause = async () => {
    try {
      await recorder.pauseRecorder();
      setPhase('paused');
    } catch {}
  };

  const resume = async () => {
    try {
      await recorder.resumeRecorder();
      setPhase('recording');
    } catch {}
  };

  const stop = async (auto = false) => {
    liveRef.current = false;
    try {
      await recorder.stopRecorder();
      recorder.removeRecordBackListener();
    } catch {}
    const p = pathRef.current;
    const d = durRef.current;
    if (p && d > 500) {
      setPhase('done');
      onSaved(p, d);
    } else {
      if (p) {
        try {
          await RNFS.unlink(p);
        } catch {}
      }
      setPhase('idle');
      if (!auto) Alert.alert('Too short', 'Hold or record for at least 1 second to save a note.');
    }
  };

  const cancel = async () => {
    liveRef.current = false;
    try {
      await recorder.stopRecorder();
      recorder.removeRecordBackListener();
    } catch {}
    const p = pathRef.current;
    if (p) {
      try {
        await RNFS.unlink(p);
      } catch {}
    }
    setPhase('idle');
    onCancel();
  };

  const deleteNote = async () => {
    const p = pathRef.current;
    if (p) {
      try {
        await RNFS.unlink(p);
      } catch {}
    }
    setPhase('idle');
    onDelete?.();
    onCancel();
  };

  const pct = Math.min(100, Math.round((durRef.current / maxMs) * 100));
  const atMax = durRef.current >= maxMs;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.cardBg, borderTopColor: themeColors.border }]}>
      {/* Header Info */}
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {phase === 'recording' && <View style={styles.recordingDot} />}
          <Text style={[styles.caption, { color: themeColors.subText }]}>
            {phase === 'idle' && 'Tap mic to record voice note'}
            {phase === 'recording' && 'Recording recitation…'}
            {phase === 'paused' && 'Paused'}
            {phase === 'done' && 'Voice note saved'}
          </Text>
        </View>
        <Text style={[styles.timer, { color: themeColors.text }]}>{time}</Text>
      </View>

      {/* Main Visualizer & Action Bar */}
      <View style={styles.visualizerRow}>
        {/* Pulsing Mic Halo */}
        <View style={styles.micHaloWrap}>
          {phase === 'recording' && (
            <Animated.View
              style={[
                styles.glowingHalo,
                {
                  backgroundColor: `${themeColors.accent}55`,
                  transform: [{ scale: pulseAnim }],
                  opacity: glowOpacity,
                },
              ]}
            />
          )}
          <View style={[styles.micIconCircle, { backgroundColor: nightMode ? '#1A1E2C' : '#EFEBE0', borderColor: themeColors.border }, phase === 'recording' && [styles.micIconRecording, { backgroundColor: themeColors.primary, borderColor: themeColors.accent }]]}>
            <IconMic c={phase === 'recording' ? '#FFFFFF' : themeColors.accent} />
          </View>
        </View>

        {/* Dynamic Animated Waveform */}
        <View style={styles.waveformContainer}>
          {waveAnims.map((animH, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: animH,
                  backgroundColor: phase === 'recording' ? themeColors.accent : themeColors.border,
                  opacity: phase === 'recording' ? 0.9 : 0.4,
                },
              ]}
            />
          ))}
        </View>

        {/* Control Buttons */}
        <View style={styles.actionButtons}>
          {phase === 'idle' && (
            <TouchableOpacity style={[styles.ctrlBtn, styles.btnRecord, { backgroundColor: themeColors.primary }]} onPress={start} activeOpacity={0.85}>
              <IconMic c="#FFFFFF" />
            </TouchableOpacity>
          )}

          {phase === 'recording' && (
            <>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnPause, { backgroundColor: nightMode ? '#2C344A' : '#DED8CB' }]} onPress={pause} activeOpacity={0.85}>
                <IconPause c={themeColors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnStop]} onPress={() => stop(false)} activeOpacity={0.85}>
                <IconStop c="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          {phase === 'paused' && (
            <>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnResume, { backgroundColor: themeColors.primary }]} onPress={resume} activeOpacity={0.85}>
                <IconPlay c="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnStop]} onPress={() => stop(false)} activeOpacity={0.85}>
                <IconStop c="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          {phase === 'done' && (
            <TouchableOpacity style={styles.deleteBtn} onPress={deleteNote} activeOpacity={0.8}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          )}

          {phase !== 'done' && (
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: nightMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} onPress={cancel} activeOpacity={0.7}>
              <Text style={[styles.cancelText, { color: themeColors.text }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: themeColors.accent }, atMax && { backgroundColor: '#FF5252' }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    elevation: 16,
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5252',
    marginRight: 6,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
  },
  timer: {
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  visualizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  micHaloWrap: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowingHalo: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  micIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  micIconRecording: {
    backgroundColor: '#FF5252',
    borderColor: '#FF7676',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    marginHorizontal: 12,
    gap: 4,
  },
  waveformBar: {
    width: 3.5,
    borderRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  btnRecord: {
  },
  btnPause: {
  },
  btnResume: {
  },
  btnStop: {
    backgroundColor: '#FF5252',
  },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  deleteText: {
    color: '#FF7676',
    fontSize: 12.5,
    fontWeight: '700',
  },
  barTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});

export default VoiceNoteRecorder;
