/**
 * FILE: src/components/common/AlertModal.tsx
 * ROLE: Reusable centered alert dialog (dark/light aware) with up to N buttons and a default OK; self-contained.
 * DEPENDS ON: nothing (no Redux; `nightMode` defaults to true).
 * USED BY: DashboardScreen.tsx:12,115 (student actions); LoginScreen.tsx:6,40 (auth errors); RegisterScreen.tsx:4,34 (registration errors).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';

// Alert button descriptor: 'cancel' -> dark, 'destructive' -> red, 'default' (plain) -> blue when last.
interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose?: () => void;
  buttons?: AlertButton[];
  nightMode?: boolean;
}

/**
 * AlertModal({ visible, title, message, onClose, buttons, nightMode = true }) — fade Modal with title/message and a button row.
 * WHAT: Centered dialog; the last non-cancel/non-destructive button gets the primary blue style; every button press also calls onClose.
 * FLOW: 1) If `buttons` omitted and `onClose` given, a single 'OK' button is built; 2) buttons render with
 *       destructive -> red / cancel -> dark / last plain -> primary #1C3D72; 3) onPress runs btn.onPress?.() then onClose?.() — always closes.
 * PROPS: visible, title, message, onClose, buttons (optional AlertButton[]), nightMode (defaults true).
 * CALLS: none (children only).
 * CALLED BY: DashboardScreen.tsx:115 (buttons built by showAlert); LoginScreen.tsx:40; RegisterScreen.tsx:34.
 * AFFECTS: Rendering only.
 * NOTES: Android back button (onRequestClose) also closes. Only used on Dashboard/Login/Register —
 *        QuranViewScreen uses the native Alert.alert instead (e.g. QuranViewScreen.tsx:394,466).
 */
const AlertModal = ({ visible, title, message, onClose, buttons, nightMode = true }: AlertModalProps) => {
  const isDark = nightMode;
  const bg = isDark ? '#1e1e24' : '#FAF7EE';
  const text = isDark ? '#FFFFFF' : '#1C1C1E';
  const muted = isDark ? '#9A9EB0' : '#6E6E73';
  const border = isDark ? '#2C3040' : '#E2DDD0';

  const defaultButtons: AlertButton[] = onClose ? [{ text: 'OK', onPress: onClose }] : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles(nightMode).overlay} onPress={() => onClose?.()}>
        <Pressable onPress={() => {}}>
          <View style={[styles(nightMode).box, { backgroundColor: bg, borderColor: border }]}>
          <Text style={[styles(nightMode).title, { color: text }]}>{title}</Text>
          <Text style={[styles(nightMode).message, { color: muted }]}>{message}</Text>
          <View style={styles(nightMode).row}>
            {(buttons || defaultButtons).map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isLast = i === (buttons || defaultButtons).length - 1;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles(nightMode).btn,
                    isDestructive && styles(nightMode).destructiveBtn,
                    isCancel && [styles(nightMode).cancelBtn, { backgroundColor: isDark ? '#2C3040' : '#E5E0D5' }],
                    isLast && !isCancel && !isDestructive && styles(nightMode).primaryBtn,
                    !isLast && { marginRight: 8 },
                  ]}
                  onPress={() => { btn.onPress?.(); onClose?.(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles(nightMode).btnText,
                    isDestructive && styles(nightMode).destructiveText,
                    isCancel && [styles(nightMode).cancelText, { color: text }],
                    isLast && !isCancel && !isDestructive && styles(nightMode).primaryText,
                  ]}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = (nightMode: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  box: { width: '82%', borderRadius: 16, padding: 22, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', minWidth: 76 },
  primaryBtn: { backgroundColor: (nightMode ? '#7BA7DB' : '#1C3D72') },
  cancelBtn: { backgroundColor: '#333' },
  destructiveBtn: { backgroundColor: '#FF3B30' },
  btnText: { fontSize: 14.5, fontWeight: '600' },
  primaryText: { color: '#FFFFFF' },
  cancelText: { color: '#FFFFFF' },
  destructiveText: { color: '#FFFFFF' },
});

export default AlertModal;
