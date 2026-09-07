import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Student, fetchStudents } from '../services/studentService';
import { getDepartmentIdByCode } from '../services/departmentService';
import {
  AttendanceEvent,
  fetchEvents,
  isEventOver,
} from '../services/eventService';
import {
  AttendanceRecord,
  checkInStudent,
  checkOutStudent,
  subscribeToEventAttendance,
} from '../services/attendanceService';
import SuccessModal from '../components/SuccessModal';

const GREEN = '#1E7A3E';
const BLUE = '#3355CC';
const QR_PREFIX = 'NWSSU-STU|';

type InputMode = 'qr' | 'manual';
type LogStatus = 'Present' | 'Completed' | 'Absent';

export default function AttendanceScreen() {
  const [departmentCode, setDepartmentCode] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);

  const [inputMode, setInputMode] = useState<InputMode>('manual');
  const [searchId, setSearchId] = useState('');
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [notFoundId, setNotFoundId] = useState<string | null>(null);

  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- success feedback ----
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanLock, setScanLock] = useState(false); // prevents double-fires on the same frame

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  // Whether the currently selected event's attendance window has closed.
  // Recomputed on each render so it stays accurate as time passes without
  // needing the user to reselect the event.
  const eventOver = selectedEvent ? isEventOver(selectedEvent) : false;

  // Normalizes a raw ID for lookup: trims, collapses internal whitespace, uppercases.
  const normalizeId = (raw: string) => raw.trim().replace(/\s+/g, '').toUpperCase();

  // ---- initial load: department, students, events ----
  const load = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in.');

      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      const code = (adminSnap.data()?.departmentCode as string) || '';
      setDepartmentCode(code);

      if (code) {
        const deptId = await getDepartmentIdByCode(code);
        const [studentList, eventList] = await Promise.all([
          fetchStudents(deptId),
          fetchEvents(code),
        ]);
        setStudents(studentList);
        setEvents(eventList);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // ---- real-time logs for the selected event ----
  useEffect(() => {
    if (!selectedEventId) {
      setLogs([]);
      return;
    }
    const unsubscribe = subscribeToEventAttendance(selectedEventId, setLogs);
    return unsubscribe;
  }, [selectedEventId]);

  // Clear preview whenever the event changes, so a stale student card can't
  // be timed in/out against the wrong event.
  useEffect(() => {
    setPreviewStudent(null);
    setNotFoundId(null);
  }, [selectedEventId]);

  // ---- lookup only: shows a preview card, does NOT record attendance ----
  const lookupStudentId = useCallback(
    (rawId: string) => {
      const studentId = normalizeId(rawId);
      if (!studentId) return;

      const student = students.find(
        (s) => normalizeId(s.student_id) === studentId
      );

      if (!student) {
        setPreviewStudent(null);
        setNotFoundId(rawId.trim());
        return;
      }
      setNotFoundId(null);
      setPreviewStudent(student);
    },
    [students]
  );

  const handleManualSubmit = () => {
    if (processing || !searchId.trim()) return;
    lookupStudentId(searchId);
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    if (scanLock || processing) return;
    const raw = result.data || '';
    if (!raw.startsWith(QR_PREFIX)) {
      return; // not one of our codes, ignore silently (avoids spamming alerts on random QR codes)
    }
    const studentId = raw.slice(QR_PREFIX.length);
    setScanLock(true);
    lookupStudentId(studentId);
    // brief cooldown so the same badge doesn't fire twice in a row
    setTimeout(() => setScanLock(false), 1500);
  };

  // ---- action: only fires when staff explicitly taps Time In / Time Out
  // for the currently previewed student ----
  const handleAction = useCallback(
    async (action: 'timeIn' | 'timeOut') => {
      if (!selectedEvent) {
        Alert.alert('No event selected', 'Please select an event first.');
        return;
      }
      if (!previewStudent) return;

      if (action === 'timeOut' && isEventOver(selectedEvent)) {
        Alert.alert(
          'Event has ended',
          'Time Out is closed because this event is already over.'
        );
        return;
      }

      setProcessing(true);
      try {
        if (action === 'timeIn') {
          await checkInStudent({
            eventId: selectedEvent.id,
            studentId: previewStudent.student_id,
            studentName: previewStudent.name,
            course: previewStudent.course,
            yearLevel: previewStudent.year_level,
            section: previewStudent.section,
            method: inputMode,
          });
        } else {
          await checkOutStudent(selectedEvent.id, previewStudent.student_id);
        }
        // Clear preview + search field after a successful action so the UI
        // resets for the next student.
        setPreviewStudent(null);
        setSearchId('');
        setSuccessMessage(
          action === 'timeIn' ? 'Time In recorded successfully' : 'Time Out recorded successfully'
        );
        setSuccessVisible(true);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to record attendance');
      } finally {
        setProcessing(false);
      }
    },
    [selectedEvent, previewStudent, inputMode]
  );

  const clearPreview = () => {
    setPreviewStudent(null);
    setNotFoundId(null);
    setSearchId('');
  };

  // ---- derive a display status for each log row ----
  const getStatus = (item: AttendanceRecord): LogStatus => {
    if (item.timeIn && item.timeOut) return 'Completed';
    if (item.timeIn) return 'Present';
    return 'Absent';
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
      <View style={styles.header}>
        <Text style={styles.title}>Attendance</Text>

        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[styles.toggleBtn, inputMode === 'qr' && styles.toggleBtnActive]}
            onPress={() => {
              setInputMode('qr');
              clearPreview();
            }}
          >
            <Text style={inputMode === 'qr' ? styles.toggleTextActive : styles.toggleText}>QR Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, inputMode === 'manual' && styles.toggleBtnActive]}
            onPress={() => {
              setInputMode('manual');
              clearPreview();
            }}
          >
            <Text style={inputMode === 'manual' ? styles.toggleTextActive : styles.toggleText}>Manual</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Select Event</Text>
      {events.length === 0 ? (
        <Text style={styles.noEvents}>No events available. Create one first.</Text>
      ) : (
        <>
          <TouchableOpacity
            style={styles.eventSelectBox}
            onPress={() => setEventPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text
              style={selectedEvent ? styles.eventSelectText : styles.eventSelectPlaceholder}
              numberOfLines={1}
            >
              {selectedEvent ? selectedEvent.title : 'Choose an event'}
            </Text>
            <Text style={styles.eventSelectChevron}>{eventPickerOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          <Modal
            visible={eventPickerOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setEventPickerOpen(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setEventPickerOpen(false)}>
              <Pressable style={styles.modalSheet} onPress={() => {}}>
                <FlatList
                  data={events}
                  keyExtractor={(e) => e.id}
                  renderItem={({ item }) => {
                    const active = item.id === selectedEventId;
                    return (
                      <TouchableOpacity
                        style={[styles.eventOption, active && styles.eventOptionActive]}
                        onPress={() => {
                          setSelectedEventId(item.id);
                          setEventPickerOpen(false);
                        }}
                      >
                        <Text style={active ? styles.eventOptionTextActive : styles.eventOptionText}>
                          {item.title}
                        </Text>
                        {active && <Text style={styles.eventOptionCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  }}
                />
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}

      {inputMode === 'manual' ? (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Search Student ID"
            value={searchId}
            onChangeText={(text) => {
              setSearchId(text);
              // Typing a new ID invalidates any previously found/not-found state.
              if (previewStudent || notFoundId) {
                setPreviewStudent(null);
                setNotFoundId(null);
              }
            }}
            onSubmitEditing={handleManualSubmit}
            editable={!processing}
          />
          <TouchableOpacity style={styles.manualBtn} onPress={handleManualSubmit} disabled={processing}>
            {processing ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualBtnText}>Search</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          {!permission ? (
            <ActivityIndicator color={GREEN} />
          ) : !permission.granted ? (
            <TouchableOpacity style={styles.solidBtn} onPress={requestPermission}>
              <Text style={styles.solidBtnText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <Text style={styles.scanHint}>Point camera at student QR code</Text>
        </View>
      )}

      {notFoundId && (
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundText}>No student found with ID "{notFoundId}".</Text>
        </View>
      )}

      {previewStudent && (
        <View style={styles.previewCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{previewStudent.name.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>{previewStudent.name}</Text>
            <Text style={styles.previewMeta}>
              {previewStudent.student_id} • {previewStudent.course}
            </Text>
            <Text style={styles.previewMeta}>{departmentCode}</Text>
          </View>
        </View>
      )}

      {previewStudent && (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnIn]}
              onPress={() => handleAction('timeIn')}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={GREEN} />
              ) : (
                <Text style={styles.actionTextIn}>Time In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnOut,
                eventOver && styles.actionBtnDisabled,
              ]}
              onPress={() => handleAction('timeOut')}
              disabled={processing || eventOver}
            >
              {processing ? (
                <ActivityIndicator color={BLUE} />
              ) : (
                <Text style={eventOver ? styles.actionTextDisabled : styles.actionTextOut}>
                  Time Out
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {eventOver && (
            <Text style={styles.eventOverNote}>
              This event has ended, so Time Out is closed.
            </Text>
          )}
        </>
      )}

      <View style={styles.logsHeaderRow}>
        <Text style={styles.label}>Real-time Logs</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, styles.colEvent]}>EVENT</Text>
          <Text style={[styles.tableHeaderCell, styles.colStudentId]}>STUDENT ID</Text>
          <Text style={[styles.tableHeaderCell, styles.colName]}>NAME</Text>
          <Text style={[styles.tableHeaderCell, styles.colTime]}>TIME IN</Text>
          <Text style={[styles.tableHeaderCell, styles.colTime]}>TIME OUT</Text>
          <Text style={[styles.tableHeaderCell, styles.colStatus]}>STATUS</Text>
        </View>

        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No attendance recorded yet.</Text>
          }
          renderItem={({ item }) => {
            const status = getStatus(item);
            return (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.colEvent]} numberOfLines={1}>
                  {selectedEvent?.title ?? '—'}
                </Text>
                <Text style={[styles.tableCell, styles.colStudentId, styles.mono]} numberOfLines={1}>
                  {item.studentId}
                </Text>
                <Text style={[styles.tableCell, styles.colName, styles.bold]} numberOfLines={1}>
                  {item.studentName}
                </Text>
                <Text style={[styles.tableCell, styles.colTime]}>
                  {item.timeIn ? new Date(item.timeIn.toMillis()).toLocaleTimeString() : '—'}
                </Text>
                <Text style={[styles.tableCell, styles.colTime]}>
                  {item.timeOut ? new Date(item.timeOut.toMillis()).toLocaleTimeString() : '—'}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.colStatus,
                    styles.bold,
                    status === 'Present' && styles.statusPresent,
                    status === 'Completed' && styles.statusCompleted,
                    status === 'Absent' && styles.statusAbsent,
                  ]}
                >
                  {status}
                </Text>
              </View>
            );
          }}
        />
      </View>

      <SuccessModal
        visible={successVisible}
        title="Recorded!"
        message={successMessage}
        accentColor={GREEN}
        onClose={() => setSuccessVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop:25},
  title: { fontSize: 22, fontWeight: '900', color: '#111' },
  toggleGroup: { flexDirection: 'row', backgroundColor: '#eee', borderRadius: 8, padding: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: GREEN },
  toggleText: { color: '#555', fontWeight: '600', fontSize: 12 },
  toggleTextActive: { color: '#fff', fontWeight: '600', fontSize: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 6 },
  noEvents: { color: '#999', marginBottom: 10 },
  eventSelectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  eventSelectText: { fontSize: 14, color: '#111', flex: 1, marginRight: 8 },
  eventSelectPlaceholder: { fontSize: 14, color: '#999', flex: 1, marginRight: 8 },
  eventSelectChevron: { fontSize: 12, color: '#666' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 320,
    paddingVertical: 6,
  },
  eventOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eventOptionActive: { backgroundColor: '#F1F4F2' },
  eventOptionText: { fontSize: 14, color: '#333' },
  eventOptionTextActive: { fontSize: 14, color: GREEN, fontWeight: '700' },
  eventOptionCheck: { color: GREEN, fontWeight: '700' },
  manualRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  manualInput: { flex: 1, borderWidth: 1, borderColor: GREEN, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#fff', fontSize: 15, minHeight: 43},
  manualBtn: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  manualBtnText: { color: '#fff', fontWeight: '700' },
  cameraWrap: { alignItems: 'center', marginBottom: 10 },
  camera: { width: 260, height: 260, borderRadius: 12, overflow: 'hidden' },
  scanHint: { color: '#666', marginTop: 8, fontSize: 12 },
  solidBtn: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  solidBtnText: { color: '#fff', fontWeight: '700' },
  notFoundBox: { backgroundColor: '#FDECEC', borderRadius: 8, padding: 12, marginBottom: 10 },
  notFoundText: { color: '#B3261E', fontSize: 13 },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F4F2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D9EAD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: GREEN },
  previewName: { fontSize: 16, fontWeight: '700', color: '#111' },
  previewMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  actionBtnIn: { backgroundColor: '#E4F5E9' },
  actionBtnOut: { backgroundColor: '#E7ECFA' },
  actionBtnDisabled: { backgroundColor: '#EEE' },
  actionTextIn: { color: GREEN, fontWeight: '700' },
  actionTextOut: { color: BLUE, fontWeight: '700' },
  actionTextDisabled: { color: '#999', fontWeight: '700' },
  eventOverNote: { color: '#B3261E', fontSize: 12, marginTop: -6, marginBottom: 14 },
  logsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4F5E9',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  liveText: { fontSize: 11, fontWeight: '700', color: GREEN },
  table: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F7F8FA',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  tableCell: { fontSize: 12, color: '#333', paddingRight: 4 },
  mono: { fontFamily: 'monospace', color: '#555' },
  bold: { fontWeight: '700', color: '#222' },
  colEvent: { flex: 1 },
  colStudentId: { flex: 1 },
  colName: { flex: 1.5 },
  colTime: { flex: 1 },
  colStatus: { flex: 0.9, textAlign: 'right' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20, paddingVertical: 16 },
  statusPresent: { color: GREEN },
  statusCompleted: { color: BLUE },
  statusAbsent: { color: '#999' },
});