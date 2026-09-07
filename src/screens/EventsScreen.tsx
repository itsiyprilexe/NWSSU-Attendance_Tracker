import React, { useCallback, useEffect, useState } from 'react';
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
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { auth, db } from '../firebase/config';
import {
  AttendanceEvent,
  createEvent,
  deleteEvent,
  fetchEvents,
  formatTime12h,
  formatDateDMY,
} from '../services/eventService';
import SuccessModal from '../components/SuccessModal';

const GREEN = '#1E7A3E';
const PURPLE = '#7B68EE';
const RED = '#D64545';

// ---- helpers to convert between Date objects and stored string formats ----
function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToHHmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

type ActivePicker = 'date' | 'morningIn' | 'morningOut' | 'afternoonIn' | 'afternoonOut' | null;

export default function EventsScreen() {
  const [departmentCode, setDepartmentCode] = useState<string>('');
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- success feedback ----
  const [successVisible, setSuccessVisible] = useState(false);

  // form state
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [morningIn, setMorningIn] = useState<Date | null>(null);
  const [morningOut, setMorningOut] = useState<Date | null>(null);
  const [afternoonIn, setAfternoonIn] = useState<Date | null>(null);
  const [afternoonOut, setAfternoonOut] = useState<Date | null>(null);

  const [activePicker, setActivePicker] = useState<ActivePicker>(null);

  const load = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in.');

      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      const code = (adminSnap.data()?.departmentCode as string) || '';
      setDepartmentCode(code);

      if (code) {
        const data = await fetchEvents(code);
        setEvents(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load events');
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

  const resetForm = () => {
    setTitle('');
    setEventDate(null);
    setMorningIn(null);
    setMorningOut(null);
    setAfternoonIn(null);
    setAfternoonOut(null);
    setActivePicker(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !eventDate) {
      Alert.alert('Missing info', 'Event name and date are required.');
      return;
    }
    setSaving(true);
    try {
      const user = auth.currentUser;
      await createEvent({
        title: title.trim(),
        eventDate: dateToISO(eventDate),
        morningTimeIn: morningIn ? timeToHHmm(morningIn) : undefined,
        morningTimeOut: morningOut ? timeToHHmm(morningOut) : undefined,
        afternoonTimeIn: afternoonIn ? timeToHHmm(afternoonIn) : undefined,
        afternoonTimeOut: afternoonOut ? timeToHHmm(afternoonOut) : undefined,
        departmentCode,
        createdBy: user?.uid || '',
      });
      setModalVisible(false);
      resetForm();
      load();
      setSuccessVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (event: AttendanceEvent) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
              load();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    const which = activePicker;
    // Android fires 'dismissed' on cancel; iOS keeps the picker open inline.
    if (Platform.OS === 'android') setActivePicker(null);
    if (event.type === 'dismissed' || !selected) return;

    switch (which) {
      case 'date':
        setEventDate(selected);
        break;
      case 'morningIn':
        setMorningIn(selected);
        break;
      case 'morningOut':
        setMorningOut(selected);
        break;
      case 'afternoonIn':
        setAfternoonIn(selected);
        break;
      case 'afternoonOut':
        setAfternoonOut(selected);
        break;
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
      <View style={[styles.card, styles.header]}>
        <Text style={styles.title}>Event Management</Text>
        <Text style={styles.subtitle}>
          {departmentCode ? `Managing events for ${departmentCode}` : 'Manage your attendance events'}
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.solidBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.solidBtnText}>+ Create Event</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No events found. Create one to get started!</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardIconWrap}>
                <Text style={styles.cardIcon}>📅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDate}>{item.eventDate}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={10}>
                <Text style={styles.trashIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sessionsRow}>
              <Text style={styles.sessionLabel}>AM: </Text>
              <Text style={styles.sessionValue}>
                {item.morningTimeIn || item.morningTimeOut
                  ? `${formatTime12h(item.morningTimeIn)} - ${formatTime12h(item.morningTimeOut)}`
                  : '--'}
              </Text>
            </View>
            <View style={styles.sessionsRow}>
              <Text style={styles.sessionLabel}>PM: </Text>
              <Text style={styles.sessionValue}>
                {item.afternoonTimeIn || item.afternoonTimeOut
                  ? `${formatTime12h(item.afternoonTimeIn)} - ${formatTime12h(item.afternoonTimeOut)}`
                  : '--'}
              </Text>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.modalTitle}>Create New Event</Text>

          <Text style={styles.label}>
            Event Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Intramurals 2026"
            placeholderTextColor="#999"
          />

          <Text style={[styles.label, { marginTop: 18 }]}>
            Date <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('date')}>
            <Text style={eventDate ? styles.pickerValueText : styles.pickerPlaceholder}>
              {eventDate ? formatDateDMY(dateToISO(eventDate)) : 'dd/mm/yyyy'}
            </Text>
            <Text style={styles.pickerIcon}>📅</Text>
          </TouchableOpacity>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionHeading}>Morning Session (Optional)</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time In (Start)</Text>
              <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('morningIn')}>
                <Text style={morningIn ? styles.pickerValueText : styles.pickerPlaceholder}>
                  {morningIn ? formatTime12h(timeToHHmm(morningIn)) : '--:-- --'}
                </Text>
                <Text style={styles.pickerIcon}>🕐</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time Out (End)</Text>
              <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('morningOut')}>
                <Text style={morningOut ? styles.pickerValueText : styles.pickerPlaceholder}>
                  {morningOut ? formatTime12h(timeToHHmm(morningOut)) : '--:-- --'}
                </Text>
                <Text style={styles.pickerIcon}>🕐</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionHeading}>Afternoon Session (Optional)</Text>
          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time In (Start)</Text>
              <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('afternoonIn')}>
                <Text style={afternoonIn ? styles.pickerValueText : styles.pickerPlaceholder}>
                  {afternoonIn ? formatTime12h(timeToHHmm(afternoonIn)) : '--:-- --'}
                </Text>
                <Text style={styles.pickerIcon}>🕐</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Time Out (End)</Text>
              <TouchableOpacity style={styles.pickerField} onPress={() => setActivePicker('afternoonOut')}>
                <Text style={afternoonOut ? styles.pickerValueText : styles.pickerPlaceholder}>
                  {afternoonOut ? formatTime12h(timeToHHmm(afternoonOut)) : '--:-- --'}
                </Text>
                <Text style={styles.pickerIcon}>🕐</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activePicker === 'date' && (
            <DateTimePicker
              value={eventDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}
          {activePicker === 'morningIn' && (
            <DateTimePicker
              value={morningIn || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}
          {activePicker === 'morningOut' && (
            <DateTimePicker
              value={morningOut || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}
          {activePicker === 'afternoonIn' && (
            <DateTimePicker
              value={afternoonIn || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}
          {activePicker === 'afternoonOut' && (
            <DateTimePicker
              value={afternoonOut || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}

          {Platform.OS === 'ios' && activePicker && (
            <TouchableOpacity style={styles.doneBtn} onPress={() => setActivePicker(null)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
            <TouchableOpacity
              style={[styles.solidBtn, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.solidBtnText}>Create Event</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      <SuccessModal
        visible={successVisible}
        title="Success!"
        message="Event created successfully."
        accentColor={PURPLE}
        onClose={() => setSuccessVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ---- Card style, matching Student Management exactly ----
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { marginTop: 25 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
  headerButtons: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  solidBtn: { backgroundColor: GREEN, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  solidBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { backgroundColor: '#6B7280', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: '#fff', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },

  eventCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: '#F0F1F3',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  cardIcon: { fontSize: 16 },
  cardTitle: { fontWeight: '700', fontSize: 16, color: '#222' },
  cardDate: { color: '#666', fontSize: 12, marginTop: 2 },
  trashIcon: { fontSize: 18 },
  sessionsRow: { flexDirection: 'row', marginTop: 4, paddingLeft: 42 },
  sessionLabel: { fontWeight: '700', fontSize: 13, color: '#222' },
  sessionValue: { fontSize: 13, color: GREEN, fontWeight: '600' },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20, marginTop: 50, color: '#333' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  required: { color: RED },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111',
  },
  pickerField: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pickerValueText: { fontSize: 15, color: '#111' },
  pickerPlaceholder: { fontSize: 15, color: '#999' },
  pickerIcon: { fontSize: 15 },
  sectionDivider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 12 },
  timeRow: { flexDirection: 'row', gap: 12 },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16 },
  doneBtnText: { color: GREEN, fontWeight: '700', fontSize: 15 },
});