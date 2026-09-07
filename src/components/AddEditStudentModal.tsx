import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Student, addStudent, updateStudent } from '../services/studentService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void; // call after successful save so parent can refresh the list
  departmentId: string;   // was: number
  allowedCourses: string[]; // e.g. ['BSCS', 'BSIS', 'BSIT', 'BSMA']
  editingStudent?: Student | null; // pass a student to edit, or omit/null to add
}

export default function AddEditStudentModal({
  visible,
  onClose,
  onSaved,
  departmentId,
  allowedCourses,
  editingStudent,
}: Props) {
  const isEditing = !!editingStudent;

  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState(allowedCourses[0] || '');
  const [yearLevel, setYearLevel] = useState('');
  const [section, setSection] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingStudent) {
      setStudentId(editingStudent.student_id);
      setName(editingStudent.name);
      setCourse(editingStudent.course);
      setYearLevel(editingStudent.year_level);
      setSection(editingStudent.section);
      setEmail(editingStudent.email);
    } else {
      setStudentId('');
      setName('');
      setCourse(allowedCourses[0] || '');
      setYearLevel('');
      setSection('');
      setEmail('');
    }
  }, [editingStudent, visible]);

  const handleSave = async () => {
    if (!studentId.trim() || !name.trim()) {
      Alert.alert('Missing info', 'Student ID and Name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        student_id: studentId.trim(),
        name: name.trim(),
        course,
        year_level: yearLevel.trim() || 'N/A',
        section: section.trim() || 'N/A',
        email: email.trim() || 'no-email@university.edu',
        department_id: departmentId,
      };

      const message =
        isEditing && editingStudent
          ? await updateStudent({ ...payload, id: editingStudent.id })
          : await addStudent(payload);

      Alert.alert('Success', message);
      onSaved();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong');
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
          <Text style={styles.title}>{isEditing ? 'Edit Student' : 'Add Student'}</Text>

          <ScrollView>
            <Text style={styles.label}>Student ID *</Text>
            <TextInput
              style={styles.input}
              value={studentId}
              onChangeText={setStudentId}
              placeholder="e.g. 2023-00123"
              editable={!isEditing} // usually you don't want to change the ID once created
            />

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Juan Dela Cruz"
            />

            <Text style={styles.label}>Course</Text>
            <View style={styles.courseRow}>
              {allowedCourses.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.coursePill, course === c && styles.coursePillActive]}
                  onPress={() => setCourse(c)}
                >
                  <Text style={course === c ? styles.coursePillTextActive : styles.coursePillText}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Year Level</Text>
            <TextInput
              style={styles.input}
              value={yearLevel}
              onChangeText={setYearLevel}
              placeholder="e.g. 3"
            />

            <Text style={styles.label}>Section</Text>
            <TextInput
              style={styles.input}
              value={section}
              onChangeText={setSection}
              placeholder="e.g. A"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="student@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{isEditing ? 'Update' : 'Add'} Student</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const GREEN = '#1E7A3E';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  courseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coursePill: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  coursePillActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  coursePillText: {
    color: '#444',
    fontWeight: '600',
  },
  coursePillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelText: {
    color: '#444',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: GREEN,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});