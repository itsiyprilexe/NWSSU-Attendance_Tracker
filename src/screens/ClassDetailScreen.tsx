// src/screens/ClassDetailScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ClassRecord } from '../types/class';
import SchedulePreviewGrid from '../components/SchedulePreviewGrid';

const GREEN = '#1E7A3E';

export default function ClassDetailScreen({ route, navigation }: any) {
  const { classId } = route.params as { classId: string };
  const [cls, setCls] = useState<ClassRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const loadClass = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'classes', classId));
      if (snap.exists()) {
        setCls({ id: snap.id, ...(snap.data() as Omit<ClassRecord, 'id'>) });
      }
    } catch (err) {
      console.error('Failed to load class:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      loadClass();
    }, [loadClass])
  );

  if (loading || !cls) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.className}>{cls.className}</Text>
      <Text style={styles.meta}>
        {cls.course} · {cls.year} · Section {cls.section}
      </Text>

      <Text style={styles.sectionLabel}>Schedule</Text>
      <SchedulePreviewGrid slots={cls.schedule} className={cls.className} />

      {cls.schedule.length === 0 ? (
        <Text style={styles.emptyText}>No schedule set</Text>
      ) : (
        cls.schedule.map((slot, i) => (
          <View key={i} style={styles.scheduleRow}>
            <View>
              <Text style={styles.scheduleDay}>{slot.day} · {slot.type === 'Lecture' ? 'LEC' : 'LAB'}</Text>
              {!!slot.room && <Text style={styles.scheduleRoom}>Room {slot.room}</Text>}
            </View>
            <Text style={styles.scheduleTime}>
              {slot.startTime} – {slot.endTime}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.sectionLabel}>Students</Text>
      <Text style={styles.studentCount}>
        {cls.studentCount ?? 0} student{cls.studentCount === 1 ? '' : 's'} enrolled
      </Text>

      <Pressable
        style={styles.actionButton}
        onPress={() =>
          navigation.navigate('UploadStudents', { classId: cls.id, className: cls.className })
        }
      >
        <Text style={styles.actionButtonText}>Upload Student List (CSV)</Text>
      </Pressable>

      <Pressable
        style={[styles.actionButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: GREEN }]}
        onPress={() =>
          navigation.navigate('InstructorStudentManagement', {
            classId: cls.id,
            className: cls.className,
          })
        }
      >
        <Text style={[styles.actionButtonText, { color: GREEN }]}>Manage Students</Text>
      </Pressable>

      <Pressable
        style={[styles.actionButton, { backgroundColor: '#fff', borderWidth: 1, borderColor: GREEN }]}
        onPress={() => navigation.navigate('TakeAttendance', { classId: cls.id })}
      >
        <Text style={[styles.actionButtonText, { color: GREEN }]}>Take Attendance</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  className: { fontSize: 20, fontWeight: '800', color: '#111' },
  meta: { fontSize: 14, color: '#555', marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 24, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#888' },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  scheduleDay: { fontWeight: '700', color: '#111' },
  scheduleRoom: { fontSize: 12, color: '#888', marginTop: 2 },
  scheduleTime: { color: '#555' },
  studentCount: { fontSize: 13, color: '#555' },
  actionButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});