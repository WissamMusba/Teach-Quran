/**
 * FILE: src/components/audio/VoiceNoteRecorder.tsx
 * ROLE: Premium footer-bar voice note recorder with pulsing mic halo, live animated soundwave visualizer,
 *       and sleek glassmorphic controls.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, PermissionsAndroid, Platform, Animated, Easing } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import Svg, { Path, Rect } from 'react-native-svg';

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
    let pulseLoop: Animated.CompositeAnimation | null = null;
    let waveLoops: Animated.CompositeAnimation[] = [];

    if (phase === 'recording') {
      pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.25, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(glowOpacity, { toValue: 0.85, duration: 800, useNativeDriver: true }),
            Animated.timing(glowOpacity, { toValue: 0.25, duration: 800, useNativeDriver: true }),
          ]),
        ])
      );
      pulseLoop.start();

      waveAnims.forEach((anim, i) => {
        const h1 = 6 + Math.floor(Math.random() * 20);
        const h2 = 8 + Math.floor(Math.random() * 22);
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: h1, duration: 250 + i * 40, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(anim, { toValue: h2, duration: 280 + i * 35, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
            Animated.timing(anim, { toValue: 4, duration: 220 + i * 30, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
          ])
        );
        waveLoops.push(loop);
        loop.start();
      });
    } else {
      pulseAnim.setValue(1);
      glowOpacity.setValue(0.3);
      waveAnims.forEach((anim) => anim.setValue(4));
    }

    return () => {
      pulseLoop?.stop();
      waveLoops.forEach((l) => l.stop());
    };
  }, [phase, pulseAnim, glowOpacity, waveAnims]);

  useEffect(() => () => {
    recorder.removeRecordBackListener();
    if (liveRef.current) {
      try { recorder.stopRecorder(); } catch {}
    }
  }, []);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => onCancel(), 4000);
    return () => clearTimeout(t);
  }, [phase, onCancel]);

  const bestEffortUnlink = (p: string | null) => { if (p) { try { RNFS.unlink(p); } catch {} } };

  const requestPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone Permission',
        message: 'TeachQuran needs microphone access to record voice notes.',
        buttonPositive: 'Allow',
      });
      return g === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  const stop = async (auto = false) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const res = await recorder.stopRecorder();
      recorder.removeRecordBackListener();
      liveRef.current = false;
      const ms = durRef.current;
      if (res && ms > 500) {
        onSaved(res, ms);
        setPhase('done');
      } else {
        bestEffortUnlink(res || pathRef.current);
        if (!auto) Alert.alert('Too short', 'Recording was too short to save.');
        setPhase('idle');
        setTime('00:00');
        durRef.current = 0;
      }
    } catch (e: any) {
      if (!auto) Alert.alert('Error', e?.message || 'Could not stop recording.');
      liveRef.current = false;
      setPhase('idle');
    } finally {
      stoppingRef.current = false;
    }
  };

  const start = async () => {
    const ok = await requestPermission();
    if (!ok) {
      Alert.alert('Permission needed', 'Microphone permission is required to record voice notes.');
      return;
    }
    durRef.current = 0;
    setTime('00:00');
    try {
      const p = `${RNFS.DocumentDirectoryPath}/vn_${Date.now()}.m4a`;
      pathRef.current = p;
      await recorder.startRecorder(p, buildAudioSets(), false);
      liveRef.current = true;
      recorder.addRecordBackListener((e) => {
        const ms = Math.floor(e.currentPosition);
        durRef.current = ms;
        setTime(fmt(ms));
        if (ms >= maxMs) stop(true);
      });
      setPhase('recording');
    } catch (e: any) {
      Alert.alert('Recording error', e?.message || 'Could not start recording.');
      setPhase('idle');
    }
  };

  const pause = async () => {
    try {
      await recorder.pauseRecorder();
      liveRef.current = false;
      setPhase('paused');
    } catch (e: any) {
      Alert.alert('Pause error', e?.message || 'Could not pause recording.');
    }
  };

  const resume = async () => {
    try {
      await recorder.resumeRecorder();
      liveRef.current = true;
      setPhase('recording');
    } catch (e: any) {
      Alert.alert('Resume error', e?.message || 'Could not resume recording.');
    }
  };

  const cancel = () => {
    if (liveRef.current || phase === 'recording' || phase === 'paused') {
      try {
        recorder.stopRecorder().then((p) => bestEffortUnlink(p || pathRef.current)).catch(() => {});
      } catch {}
      recorder.removeRecordBackListener();
      liveRef.current = false;
    }
    setPhase('idle');
    setTime('00:00');
    durRef.current = 0;
    onCancel();
  };

  const deleteNote = () => {
    bestEffortUnlink(pathRef.current);
    onDelete?.();
    onCancel();
  };

  const atMax = (phase === 'recording' || phase === 'paused') && durRef.current >= maxMs - 200;
  const pct = Math.min(100, (durRef.current / maxMs) * 100);

  const caption = phase === 'idle' ? 'Ready to record voice note (max 01:00)'
    : phase === 'recording' ? 'Recording in progress…'
    : phase === 'paused' ? 'Recording paused'
    : 'Voice note saved successfully';

  return (
    <View style={styles.container}>
      {/* Top Status & Caption Bar */}
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {phase === 'recording' ? (
            <View style={styles.recordingDot} />
          ) : phase === 'paused' ? (
            <View style={[styles.recordingDot, { backgroundColor: '#FFA000' }]} />
          ) : null}
          <Text style={[styles.caption, phase === 'recording' && { color: '#FF5252', fontWeight: '700' }]}>
            {caption}
          </Text>
        </View>
        <Text style={[styles.timer, atMax && { color: '#FF5252' }]}>
          {`${time} / ${fmt(maxMs)}`}
        </Text>
      </View>

      {/* Visualizer & Waveform Bar */}
      <View style={styles.visualizerRow}>
        {/* Glowing Mic Halo */}
        <View style={styles.micHaloWrap}>
          {phase === 'recording' && (
            <Animated.View
              style={[
                styles.glowingHalo,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: glowOpacity,
                },
              ]}
            />
          )}
          <View style={[styles.micIconCircle, phase === 'recording' && styles.micIconRecording]}>
            <IconMic c={phase === 'recording' ? '#FFFFFF' : '#7BA7DB'} />
          </View>
        </View>

        {/* Live Dynamic Waveform Bars */}
        <View style={styles.waveformContainer}>
          {waveAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: anim,
                  backgroundColor: phase === 'recording' ? '#7BA7DB' : phase === 'paused' ? '#FFA000' : '#454C62',
                },
              ]}
            />
          ))}
        </View>

        {/* Action Controls */}
        <View style={styles.actionButtons}>
          {phase === 'idle' && (
            <TouchableOpacity style={[styles.ctrlBtn, styles.btnRecord]} onPress={start} activeOpacity={0.85}>
              <IconMic c="#FFFFFF" />
            </TouchableOpacity>
          )}

          {phase === 'recording' && (
            <>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnPause]} onPress={pause} activeOpacity={0.85}>
                <IconPause c="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnStop]} onPress={() => stop(false)} activeOpacity={0.85}>
                <IconStop c="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}

          {phase === 'paused' && (
            <>
              <TouchableOpacity style={[styles.ctrlBtn, styles.btnResume]} onPress={resume} activeOpacity={0.85}>
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
            <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Track */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }, atMax && { backgroundColor: '#FF5252' }]} />
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
    backgroundColor: '#121520',
    borderTopWidth: 1,
    borderTopColor: '#283048',
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
    color: '#93A4C7',
    fontSize: 12,
    fontWeight: '600',
  },
  timer: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 82, 82, 0.4)',
  },
  micIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2538',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#303B5A',
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
    backgroundColor: '#1C3D72',
  },
  btnPause: {
    backgroundColor: '#2E3854',
  },
  btnResume: {
    backgroundColor: '#1C3D72',
  },
  btnStop: {
    backgroundColor: '#FF5252',
  },
  cancelBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  cancelText: {
    color: '#C7D2E8',
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
    backgroundColor: '#7BA7DB',
    borderRadius: 1.5,
  },
});

export default VoiceNoteRecorder;
