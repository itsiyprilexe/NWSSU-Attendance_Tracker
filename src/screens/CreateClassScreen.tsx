// src/screens/CreateClassScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { WEEKDAYS, Weekday, ScheduleSlot, SlotType } from '../types/class';

const SLOT_TYPES: SlotType[] = ['Lecture', 'Laboratory'];

const GREEN = '#1E7A3E';

export default function CreateClassScreen({ navigation }: any) {
  const [className, setClassName] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [section, setSection] = useState('');
  const [slots, setSlots] = useState<ScheduleSlot[]>([
    { day: 'Mon', type: 'Lecture', room: '', startTime: '', endTime: '' },
  ]);
  const [saving, setSaving] = useState(false);

  const updateSlot = (index: number, patch: Partial<ScheduleSlot>) => {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { day: 'Mon', type: 'Lecture', room: '', startTime: '', endTime: '' }]);
  };

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!className.trim() || !course.trim() || !year.trim() || !section.trim()) {
      Alert.alert('Missing info', 'Please fill in class name, course, year, and section.');
      return;
    }
    const incompleteSlot = slots.find((s) => !s.startTime.trim() || !s.endTime.trim());
    if (incompleteSlot) {
      Alert.alert('Missing schedule', 'Please fill in a start and end time for every schedule slot, or remove the empty one.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      // Pull departmentCode from the instructor's own profile so classes
      // are automatically scoped, same as everywhere else in the app.
      const instructorSnap = await getDoc(doc(db, 'instructors', user.uid));
      const departmentCode = instructorSnap.exists()
        ? (instructorSnap.data().departmentCode as string) ?? ''
        : '';

      await addDoc(collection(db, 'classes'), {
        instructorId: user.uid,
        instructorEmail: user.email ?? '',
        departmentCode,
        className: className.trim(),
        course: course.trim(),
        year: year.trim(),
        section: section.trim(),
        schedule: slots,
        studentCount: 0,
        createdAt: serverTimestamp(),
      });

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Could not create class', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Class Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Data Structures and Algorithms"
        value={className}
        onChangeText={setClassName}
      />

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Course</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. BSIT"
            value={course}
            onChangeText={setCourse}
          />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 3rd Year"
            value={year}
            onChangeText={setYear}
          />
        </View>
      </View>

      <Text style={styles.label}>Section</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. A"
        value={section}
        onChangeText={setSection}
      />

      <Text style={[styles.label, { marginTop: 8 }]}>Schedule</Text>
      <Text style={styles.hint}>
        Add one row per meeting time. Different days can have different times.
      </Text>

      {slots.map((slot, index) => (
        <View key={index} style={styles.slotCard}>
          <View style={styles.dayRow}>
            {WEEKDAYS.map((day) => (
              <Pressable
                key={day}
                onPress={() => updateSlot(index, { day })}
                style={[
                  styles.dayChip,
                  slot.day === day && styles.dayChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    slot.day === day && styles.dayChipTextActive,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.typeRow}>
            {SLOT_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => updateSlot(index, { type: t })}
                style={[
                  styles.typeChip,
                  slot.type === t && styles.typeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    slot.type === t && styles.typeChipTextActive,
                  ]}
                >
                  {t === 'Lecture' ? 'LEC' : 'LAB'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.labelSmall}>Room</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 302"
            value={slot.room}
            onChangeText={(text) => updateSlot(index, { room: text })}
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.labelSmall}>Start</Text>
              <TextInput
                style={styles.input}
                placeholder="9:00 AM"
                value={slot.startTime}
                onChangeText={(text) => updateSlot(index, { startTime: text })}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.labelSmall}>End</Text>
              <TextInput
                style={styles.input}
                placeholder="10:00 AM"
                value={slot.endTime}
                onChangeText={(text) => updateSlot(index, { endTime: text })}
              />
            </View>
          </View>

          {slots.length > 1 && (
            <Pressable onPress={() => removeSlot(index)} style={styles.removeSlotBtn}>
              <Text style={styles.removeSlotText}>Remove this slot</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Pressable onPress={addSlot} style={styles.addSlotBtn}>
        <Text style={styles.addSlotText}>+ Add another schedule slot</Text>
      </Pressable>

      <Pressable
        style={[styles.submitButton, saving && { opacity: 0.7 }]}
        onPress={handleCreate}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Create Class</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  label: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 6, marginTop: 12 },
  labelSmall: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4 },
  hint: { fontSize: 12, color: '#888', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  slotCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginTop: 10,
  },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  dayChipActive: { backgroundColor: GREEN },
  dayChipText: { fontSize: 12, fontWeight: '600', color: '#555' },
  dayChipTextActive: { color: '#fff' },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  typeChipActive: { backgroundColor: '#333' },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#555' },
  typeChipTextActive: { color: '#fff' },
  removeSlotBtn: { marginTop: 8, alignSelf: 'flex-start' },
  removeSlotText: { color: '#e33', fontSize: 12, fontWeight: '600' },
  addSlotBtn: { marginTop: 10, alignSelf: 'flex-start' },
  addSlotText: { color: GREEN, fontWeight: '700', fontSize: 13 },
  submitButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});