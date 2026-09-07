import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RED = '#C0392B';
const LIGHT_RED = '#E8A79C';
const LIGHTER_RED = '#FBE4E0';

interface UploadErrorModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  title?: string;
}

export default function UploadErrorModal({
  visible,
  message,
  onClose,
  title = 'Upload Failed',
}: UploadErrorModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconFrame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <Ionicons name="close" size={56} color={RED} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>

          <TouchableOpacity style={styles.okBtn} onPress={onClose}>
            <Text style={styles.okBtnText}>OK</Text>
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
    borderColor: LIGHTER_RED,
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
    borderTopColor: LIGHT_RED,
    borderRightColor: 'transparent',
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 18,
    borderLeftWidth: 18,
    borderBottomColor: LIGHT_RED,
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
    backgroundColor: RED,
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