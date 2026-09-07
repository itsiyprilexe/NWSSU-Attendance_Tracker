import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Student, fetchStudents } from '../services/studentService';
import { createClass, ClassInput } from '../services/classService';

const GREEN = '#1E7A3E';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALLOWED_COURSES = ['BSCS', 'BSIS', 'BSIT', 'BSMA'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  instructorId: string;
  departmentId: string;
  departmentCode: string;
}

export default function CreateClassModal({
  visible,
  onClose,
  onSaved,
  instructorId,
  departmentId,
  departmentCode,
}: Props) {
  const [className, setClassName] = useState('');
  const [course, setCourse] = useState(ALLOWED_COURSES[0]);
  const [yearLevel, setYearLevel] = useState('');
  const [section, setSection] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load department roster once when modal opens
  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoadingStudents(true);
      try {
        const students = await fetchStudents(departmentId);
        setAllStudents(students);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load students');
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [visible, departmentId]);

  // Reset form each time modal opens
  useEffect(() => {
    if (visible) {
      setClassName('');
      setCourse(ALLOWED_COURSES[0]);
      setYearLevel('');
      setSection('');
      setSelectedDays([]);
      setStartTime('');
      setEndTime('');
      setSelectedIds(new Set());
    }
  }, [visible]);

  const matchingStudents = useMemo(() => {
    if (!yearLevel.trim() || !section.trim()) return [];
    return allStudents.filter(
      (s) =>
        s.course === course &&
        s.year_level.trim() === yearLevel.trim() &&
        s.section.trim().toLowerCase() === section.trim().toLowerCase()
    );
  }, [allStudents, course, yearLevel, section]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllMatching = () => {
    setSelectedIds(new Set(matchingStudents.map((s) => s.id)));
  };

  const handleSave = async () => {
    if (!className.trim() || !yearLevel.trim() || !section.trim()) {
      Alert.alert('Missing info', 'Please fill in class name, year level, and section.');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Missing schedule', 'Please select at least one class day.');
      return;
    }
    if (!startTime.trim() || !endTime.trim()) {
      Alert.alert('Missing schedule', 'Please enter start and end time.');
      return;
    }

    setSaving(true);
    try {
      const input: ClassInput = {
        instructorId,
        departmentId,
        departmentCode,
        className: className.trim(),
        course,
        yearLevel: yearLevel.trim(),
        section: section.trim(),
        schedule: { days: selectedDays, startTime: startTime.trim(), endTime: endTime.trim() },
        studentIds: Array.from(selectedIds),
      };
      await createClass(input);
      Alert.alert('Class created', `${className} has been created.`);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create class');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Create Class</Text>

          <ScrollView>
            <Text style={styles.label}>Class Name *</Text>
            <TextInput
              style={styles.input}
              value={className}
              onChangeText={setClassName}
              placeholder="e.g. CS101 - Intro to Programming"
            />

            <Text style={styles.label}>Course</Text>
            <View style={styles.pillRow}>
              {ALLOWED_COURSES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, course === c && styles.pillActive]}
                  onPress={() => setCourse(c)}
                >
                  <Text style={course === c ? styles.pillTextActive : styles.pillText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Year Level *</Text>
                <TextInput style={styles.input} value={yearLevel} onChangeText={setYearLevel} placeholder="e.g. 3" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Section *</Text>
                <TextInput style={styles.input} value={section} onChangeText={setSection} placeholder="e.g. A" />
              </View>
            </View>

            <Text style={styles.label}>Class Days *</Text>
            <View style={styles.pillRow}>
              {DAYS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, selectedDays.includes(d) && styles.pillActive]}
                  onPress={() => toggleDay(d)}
                >
                  <Text style={selectedDays.includes(d) ? styles.pillTextActive : styles.pillText}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>Start Time *</Text>
                <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} placeholder="09:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End Time *</Text>
                <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} placeholder="10:00" />
              </View>
            </View>

            <View style={styles.rosterHeader}>
              <Text style={styles.label}>
                Enrolled Students {yearLevel && section ? `(${matchingStudents.length} found)` : ''}
              </Text>
              {matchingStudents.length > 0 && (
                <TouchableOpacity onPress={selectAllMatching}>
                  <Text style={styles.selectAllLink}>Select all</Text>
                </TouchableOpacity>
              )}
            </View>

            {loadingStudents ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 10 }} />
            ) : !yearLevel.trim() || !section.trim() ? (
              <Text style={styles.hint}>Enter year level and section to see matching students.</Text>
            ) : matchingStudents.length === 0 ? (
              <Text style={styles.hint}>No students found for {course} {yearLevel}-{section}.</Text>
            ) : (
              <View style={styles.rosterList}>
                {matchingStudents.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.rosterRow}
                    onPress={() => toggleStudent(s.id)}
                  >
                    <View style={[styles.checkbox, selectedIds.has(s.id) && styles.checkboxChecked]}>
                      {selectedIds.has(s.id) && <Text style={styles.checkboxMark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rosterName}>{s.name}</Text>
                      <Text style={styles.rosterId}>{s.student_id}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Create Class</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '90%' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#111' },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  row: { flexDirection: 'row' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  pillActive: { backgroundColor: GREEN, borderColor: GREEN },
  pillText: { color: '#444', fontWeight: '600' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  selectAllLink: { color: GREEN, fontWeight: '600', fontSize: 12 },
  hint: { color: '#999', fontSize: 13, marginTop: 6 },
  rosterList: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, marginTop: 8, overflow: 'hidden' },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: GREEN, borderColor: GREEN },
  checkboxMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rosterName: { fontWeight: '600', color: '#222' },
  rosterId: { color: '#888', fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  cancelText: { color: '#444', fontWeight: '600' },
  saveBtn: { backgroundColor: GREEN, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, minWidth: 140, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});