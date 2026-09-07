import React, { useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { Student } from '../services/studentService';

interface Props {
  visible: boolean;
  onClose: () => void;
  student: Student | null;
}

const GREEN = '#1E7A3E';
const QR_PREFIX = 'NWSSU-STU|';

export default function QRCodeModal({ visible, onClose, student }: Props) {
  const viewShotRef = useRef<ViewShot>(null);
  const [saving, setSaving] = useState(false);

  if (!student) return null;

  const handleDownload = async () => {
    try {
      setSaving(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to save the QR code.');
        return;
      }

      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('Could not capture QR code image.');

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'QR code saved to your photo gallery.');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save QR code');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={styles.captureArea}>
              <View style={styles.qrWrap}>
                <QRCode value={`${QR_PREFIX}${student.student_id}`} size={220} />
              </View>
              <Text style={styles.captureName}>{student.name}</Text>
              <Text style={styles.captureId}>{student.student_id}</Text>
            </View>
          </ViewShot>

          <Text style={styles.hint}>Scan this code at Attendance check-in</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.downloadBtnText}>Download</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', width: 300 },
  captureArea: { alignItems: 'center', backgroundColor: '#fff', padding: 16 },
  qrWrap: { padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  captureName: { fontSize: 16, fontWeight: '700', color: '#111', marginTop: 12, textAlign: 'center' },
  captureId: { fontSize: 13, color: '#666', marginTop: 2, textAlign: 'center' },
  hint: { fontSize: 12, color: '#666', marginTop: 14, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  downloadBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  downloadBtnText: { color: '#fff', fontWeight: '700' },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  closeBtnText: { color: '#444', fontWeight: '700' },
});