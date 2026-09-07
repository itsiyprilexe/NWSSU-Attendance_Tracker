import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#1E7A3E';
const LIGHT_GREEN = '#8FCB9B';
const LIGHTER_GREEN = '#D9F0DE';

interface UploadSuccessModalProps {
  visible: boolean;
  count: number;
  onClose: () => void;
  title?: string;
}

export default function UploadSuccessModal({
  visible,
  count,
  onClose,
  title = 'Uploaded!',
}: UploadSuccessModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconFrame}>
            {/* decorative corner accents */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
            <Ionicons name="checkmark" size={56} color={GREEN} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Successfully imported {count} student{count !== 1 ? 's' : ''}.
          </Text>

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
    borderColor: LIGHTER_GREEN,
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
    borderTopColor: LIGHT_GREEN,
    borderRightColor: 'transparent',
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 18,
    borderLeftWidth: 18,
    borderBottomColor: LIGHT_GREEN,
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
    backgroundColor: GREEN,
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