// src/screens/TakeAttendanceScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AttendanceStatus, StudentRecord } from '../types/class';

const GREEN = '#1E7A3E';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; color: string }[] = [
  { value: 'present', label: 'Present', color: '#1E7A3E' },
  { value: 'late', label: 'Late', color: '#C98A00' },
  { value: 'excused', label: 'Excused', color: '#3366CC' },
  { value: 'absent', label: 'Absent', color: '#CC3333' },
];

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function TakeAttendanceScreen({ route }: any) {
  const { classId } = route.params as { classId: string };
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const date = todayString();

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'classes', classId, 'students'));
      const rows: StudentRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StudentRecord, 'id'>),
      }));
      rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setStudents(rows);
      // Default everyone to "present" — instructor flips exceptions.
      const defaults: Record<string, AttendanceStatus> = {};
      rows.forEach((s) => (defaults[s.id] = 'present'));
      setStatuses(defaults);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      loadStudents();
    }, [loadStudents])
  );

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'classes', classId, 'attendance', date), {
        date,
        takenAt: serverTimestamp(),
        records: statuses,
      });
      Alert.alert('Attendance saved', `Saved for ${date}.`);
    } catch (err: any) {
      Alert.alert('Could not save attendance', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.dateBar}>
        <Text style={styles.dateText}>{date}</Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No students in this class yet</Text>
            <Text style={styles.emptySubtitle}>Upload a student list first.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.studentRow}>
            <Text style={styles.studentName}>{item.fullName}</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = statuses[item.id] === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setStatus(item.id, opt.value)}
                    style={[
                      styles.statusChip,
                      { borderColor: opt.color },
                      active && { backgroundColor: opt.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: active ? '#fff' : opt.color },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />

      {students.length > 0 && (
        <Pressable
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Attendance</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  dateBar: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dateText: { fontWeight: '700', color: '#111' },
  studentRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  studentName: { fontWeight: '700', color: '#111', marginBottom: 8 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: { fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  emptySubtitle: { fontSize: 13, color: '#888', marginTop: 6 },
  saveButton: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});