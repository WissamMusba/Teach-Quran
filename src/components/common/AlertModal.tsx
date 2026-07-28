import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

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

const AlertModal = ({ visible, title, message, onClose, buttons, nightMode = true }: AlertModalProps) => {
  const isDark = nightMode;
  const bg = isDark ? '#1e1e1e' : '#fff';
  const text = isDark ? '#fff' : '#121212';
  const muted = isDark ? '#888' : '#666';
  const border = isDark ? '#2a2a2a' : '#ddd';

  const defaultButtons: AlertButton[] = onClose ? [{ text: 'OK', onPress: onClose }] : [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: bg, borderColor: border }]}>
          <Text style={[styles.title, { color: text }]}>{title}</Text>
          <Text style={[styles.message, { color: muted }]}>{message}</Text>
          <View style={styles.row}>
            {(buttons || defaultButtons).map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isLast = i === (buttons || defaultButtons).length - 1;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    isDestructive && styles.destructiveBtn,
                    isCancel && styles.cancelBtn,
                    isLast && !isCancel && !isDestructive && styles.primaryBtn,
                    !isLast && { marginRight: 8 },
                  ]}
                  onPress={() => { btn.onPress?.(); onClose?.(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.btnText,
                    isDestructive && styles.destructiveText,
                    isCancel && styles.cancelText,
                    isLast && !isCancel && !isDestructive && styles.primaryText,
                  ]}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  box: { width: '82%', borderRadius: 16, padding: 24, borderWidth: 1, elevation: 10 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', minWidth: 80 },
  primaryBtn: { backgroundColor: '#00d4aa' },
  cancelBtn: { backgroundColor: '#333' },
  destructiveBtn: { backgroundColor: '#ff4444' },
  btnText: { fontSize: 15, fontWeight: '600' },
  primaryText: { color: '#121212' },
  cancelText: { color: '#fff' },
  destructiveText: { color: '#fff' },
});

export default AlertModal;
