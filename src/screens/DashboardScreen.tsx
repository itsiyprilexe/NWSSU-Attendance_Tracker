import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Modal, TouchableOpacity, RefreshControl } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { Student, fetchStudents } from '../services/studentService';
import { getDepartmentIdByCode } from '../services/departmentService';
import { AttendanceEvent, fetchEvents } from '../services/eventService';
import { AttendanceRecord, fetchAttendanceForEvents } from '../services/attendanceService';

const GREEN = '#1E7A3E';

function todayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [departmentCode, setDepartmentCode] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async (user: User | null) => {
    try {
      if (!user) return;

      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      const code = (adminSnap.data()?.departmentCode as string) || '';
      setDepartmentCode(code);
      if (!code) return;

      const deptId = await getDepartmentIdByCode(code);
      const [studentList, eventList] = await Promise.all([
        fetchStudents(deptId),
        fetchEvents(code),
      ]);
      setStudents(studentList);
      setEvents(eventList);

      const eventIds = eventList.map((e) => e.id);
      const attendance = await fetchAttendanceForEvents(eventIds);
      setAllAttendance(attendance);
      setRecentAttendance(attendance.slice(0, 8));
    } catch (err) {
      console.warn('Dashboard load error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => load(user));
    return unsubscribe;
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(auth.currentUser);
  };

  const todaysCheckIns = useMemo(() => {
    const today = todayString();
    return allAttendance.filter((r) => {
      const d = r.recordedAt?.toDate();
      return d && d.toISOString().slice(0, 10) === today;
    }).length;
  }, [allAttendance]);

  const sectionBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      const key = `${s.course} ${s.year_level}-${s.section}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [students]);

  // ---- Calendar marked dates ----
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const e of events) {
      marks[e.eventDate] = {
        marked: true,
        dotColor: GREEN,
      };
    }
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: GREEN,
      };
    }
    return marks;
  }, [events, selectedDate]);

  const eventsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => e.eventDate === selectedDate);
  }, [events, selectedDate]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
      }
    >
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>
        {departmentCode ? `Overview for ${departmentCode}` : 'Overview'}
      </Text>

      {/* ---- Stat cards ---- */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{students.length}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{events.length}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todaysCheckIns}</Text>
          <Text style={styles.statLabel}>Today's Check-ins</Text>
        </View>
      </View>

      {/* ---- Calendar ---- */}
      <Text style={styles.sectionLabel}>Events Calendar</Text>
      <View style={styles.calendarCard}>
        <Calendar
          markedDates={markedDates}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          theme={{
            todayTextColor: GREEN,
            arrowColor: GREEN,
            dotColor: GREEN,
            selectedDayBackgroundColor: GREEN,
          }}
        />
      </View>

      {/* ---- Students by section ---- */}
      <Text style={styles.sectionLabel}>Students by Section</Text>
      {sectionBreakdown.length === 0 ? (
        <Text style={styles.emptyText}>No students yet.</Text>
      ) : (
        <View style={styles.sectionList}>
          {sectionBreakdown.map((s) => (
            <View key={s.key} style={styles.sectionRow}>
              <Text style={styles.sectionRowLabel}>{s.key}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{s.count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ---- Recent activity ---- */}
      <Text style={styles.sectionLabel}>Recent Attendance Activity</Text>
      {recentAttendance.length === 0 ? (
        <Text style={styles.emptyText}>No attendance recorded yet.</Text>
      ) : (
        <View style={styles.activityList}>
          {recentAttendance.map((r) => {
            const event = events.find((e) => e.id === r.eventId);
            return (
              <View key={r.id} style={styles.activityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityName}>{r.studentName}</Text>
                  <Text style={styles.activityMeta}>
                    {event?.title || 'Event'} • {r.course} {r.yearLevel}-{r.section}
                  </Text>
                </View>
                <Text style={styles.activityTime}>
                  {r.recordedAt ? r.recordedAt.toDate().toLocaleTimeString() : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ---- Modal: events on selected date ---- */}
      <Modal
        visible={!!selectedDate}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedDate(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedDate}</Text>

            {eventsOnSelectedDate.length === 0 ? (
              <Text style={styles.emptyText}>No events on this date.</Text>
            ) : (
              eventsOnSelectedDate.map((e) => (
                <View key={e.id} style={styles.modalEventRow}>
                  <Text style={styles.modalEventTitle}>{e.title}</Text>
                  {e.startTime && (
                    <Text style={styles.modalEventMeta}>
                      {e.startTime}
                      {e.endTime ? ` - ${e.endTime}` : ''}
                    </Text>
                  )}
                  {e.description ? (
                    <Text style={styles.modalEventDesc}>{e.description}</Text>
                  ) : null}
                </View>
              ))
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedDate(null)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: GREEN },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8, marginTop: 4 },

  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
    overflow: 'hidden',
  },

  sectionList: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 20, overflow: 'hidden' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  sectionRowLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
  countPill: { backgroundColor: '#E4F5E9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  countPillText: { color: GREEN, fontWeight: '700', fontSize: 12 },

  activityList: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  activityName: { fontSize: 13, fontWeight: '700', color: '#222' },
  activityMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  activityTime: { fontSize: 11, color: '#555' },

  emptyText: { color: '#999', fontSize: 13, marginBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: 300, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 12 },
  modalEventRow: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingVertical: 10 },
  modalEventTitle: { fontSize: 14, fontWeight: '700', color: '#222' },
  modalEventMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  modalEventDesc: { fontSize: 12, color: '#888', marginTop: 4 },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: { color: '#fff', fontWeight: '700' },
});