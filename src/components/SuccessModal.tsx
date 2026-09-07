import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  accentColor?: string; // frame + checkmark color
  buttonColor?: string; // OK button color (defaults to accentColor)
  buttonText?: string;
}

// Lightens a hex color by mixing it with white, used to derive the two
// lighter shades needed for the frame border + corner accents from a
// single accent color, so callers only need to pass one color.
function lighten(hex: string, amount: number) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * amount));
  const g = Math.min(
    255,
    Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * amount)
  );
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * amount));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function SuccessModal({
  visible,
  title,
  message,
  onClose,
  accentColor = '#1E7A3E',
  buttonColor,
  buttonText = 'OK',
}: SuccessModalProps) {
  const frameColor = lighten(accentColor, 0.75);
  const cornerColor = lighten(accentColor, 0.45);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconFrame, { borderColor: frameColor }]}>
            <View
              style={[
                styles.corner,
                styles.cornerTopLeft,
                { borderTopColor: cornerColor },
              ]}
            />
            <View
              style={[
                styles.corner,
                styles.cornerBottomRight,
                { borderBottomColor: cornerColor },
              ]}
            />
            <Ionicons name="checkmark" size={56} color={accentColor} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <TouchableOpacity
            style={[styles.okBtn, { backgroundColor: buttonColor || accentColor }]}
            onPress={onClose}
          >
            <Text style={styles.okBtnText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconFrame: {
    width: 96,
    height: 96,
    borderWidth: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 18,
    borderRightWidth: 18,
    borderRightColor: 'transparent',
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 18,
    borderLeftWidth: 18,
    borderLeftColor: 'transparent',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  okBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 48,
  },
  okBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});