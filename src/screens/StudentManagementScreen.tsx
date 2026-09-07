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
  RefreshControl,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Student,
  fetchStudents,
  searchStudents,
  uploadStudentsExcel,
  deleteStudent,
  deleteStudentsBySection,
} from '../services/studentService';
import { getDepartmentIdByCode } from '../services/departmentService';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import AddEditStudentModal from '../components/AddEditStudentModal';
import QRCodeModal from '../components/QRCodeModal';
import UploadSuccessModal from '../components/UploadSuccessModal';
import UploadErrorModal from '../components/UploadErrorModal';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#1E7A3E';
const RED = '#C0392B';
const ALLOWED_COURSES = ['BSCS', 'BSIS', 'BSIT', 'BSMA']; // could also come from department config/API

interface GroupedSection {
  key: string; // "BSCS • 3 - A"
  course: string;
  yearSection: string;
  students: Student[];
}

export default function StudentManagementScreen() {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrStudent, setQrStudent] = useState<Student | null>(null);

  // ---- Upload feedback modals ----
  const [uploadSuccessVisible, setUploadSuccessVisible] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const [uploadErrorVisible, setUploadErrorVisible] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');

  // ---- Load logged-in admin's department, then load students ----
  const loadStudents = useCallback(async (user: User | null) => {
    try {
      let deptId: string | null = null;
      let deptCode = '';

      if (user) {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists()) {
          const data = adminSnap.data() as { departmentCode?: string };
          deptCode = data.departmentCode || '';
          if (deptCode) {
            deptId = await getDepartmentIdByCode(deptCode);
          }
        }
      }

      setDepartmentId(deptId);
      setDepartmentName(deptCode);

      const data = await fetchStudents(deptId);
      setAllStudents(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Wait for Firebase Auth to confirm the current user before loading anything.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      loadStudents(user);
    });
    return unsubscribe;
  }, [loadStudents]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStudents(auth.currentUser);
  };

  // ---- Search (debounced) ----
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchStudents(query, departmentId);
        setSearchResults(results);
      } catch (err: any) {
        Alert.alert('Search error', err.message || 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, departmentId]);

  const displayedStudents = searchResults ?? allStudents;

  // ---- Group students by course + section ----
  const groupedSections = useMemo<GroupedSection[]>(() => {
    const map = new Map<string, GroupedSection>();
    for (const s of displayedStudents) {
      const yearSection = `${s.year_level} - ${s.section}`;
      const key = `${s.course} • ${yearSection}`;
      if (!map.has(key)) {
        map.set(key, { key, course: s.course, yearSection, students: [] });
      }
      map.get(key)!.students.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [displayedStudents]);

  const expandAll = () => setExpandedKeys(new Set(groupedSections.map((g) => g.key)));
  const collapseAll = () => setExpandedKeys(new Set());
  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ---- Add / Edit ----
  const openAddModal = () => {
    if (!departmentId) {
      Alert.alert('No department', 'Could not determine your department. Please log in again.');
      return;
    }
    setEditingStudent(null);
    setModalVisible(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setModalVisible(true);
  };

  // ---- QR ----
  const openQrModal = (student: Student) => {
    setQrStudent(student);
    setQrModalVisible(true);
  };

  // ---- Delete (single) ----
  const handleDelete = (student: Student) => {
    Alert.alert(
      'Delete student',
      `Remove ${student.name} (${student.student_id}) from the list? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStudent(student.id);
              loadStudents(auth.currentUser);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete student');
            }
          },
        },
      ]
    );
  };

  // ---- Delete Section ----
  const handleDeleteSection = (group: GroupedSection) => {
    if (!departmentId) return;

    Alert.alert(
      'Delete section',
      `Remove all ${group.students.length} student(s) in ${group.key}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const [yearLevel, section] = group.yearSection.split(' - ');
              const count = await deleteStudentsBySection(
                departmentId,
                group.course,
                yearLevel,
                section
              );
              Alert.alert('Deleted', `Removed ${count} student(s) from ${group.key}.`);
              loadStudents(auth.currentUser);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete section');
            }
          },
        },
      ]
    );
  };

  // ---- Upload Excel ----
  const handleUploadExcel = async () => {
    if (!departmentId) {
      Alert.alert('No department', 'Could not determine your department. Please log in again.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return; // user cancelled picker, ignore

      const asset = result.assets[0];

      setUploading(true);
      const uploadResult = await uploadStudentsExcel(asset.uri, asset.name || 'students.xlsx', departmentId);

      if (uploadResult.success) {
        setUploadedCount(uploadResult.imported ?? 0);
        setUploadSuccessVisible(true);
      } else {
        setUploadErrorMessage(uploadResult.error || 'Some rows were rejected.');
        setUploadErrorVisible(true);
      }
      loadStudents(auth.currentUser);
    } catch (err: any) {
      setUploadErrorMessage(err.message || 'Something went wrong');
      setUploadErrorVisible(true);
    } finally {
      setUploading(false);
    }
  };

  // ---- Render ----
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const renderStudentActions = (s: Student) => (
    <View style={styles.actionRow}>
      <TouchableOpacity style={styles.qrBtn} onPress={() => openQrModal(s)}>
        <Ionicons name="qr-code-outline" size={18} color={GREEN} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(s)}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.card, styles.header]}>
        <Text style={styles.title}>Student Management</Text>
        <Text style={styles.subtitle}>
          Managing students{departmentName ? ` for ${departmentName}` : ''} • Allowed courses:{' '}
          {ALLOWED_COURSES.join(', ')}
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.outlineBtn} onPress={handleUploadExcel} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={GREEN} />
            ) : (
              <Text style={styles.outlineBtnText}>Upload Excel</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.solidBtn} onPress={openAddModal}>
            <Text style={styles.solidBtnText}>+ Add Student</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          value={query}
          onChangeText={setQuery}
        />

        <View style={styles.toolbar}>
          <TouchableOpacity onPress={expandAll}>
            <Text style={styles.toolbarLink}>Expand all</Text>
          </TouchableOpacity>
          <Text style={styles.toolbarDivider}>|</Text>
          <TouchableOpacity onPress={collapseAll}>
            <Text style={styles.toolbarLink}>Collapse all</Text>
          </TouchableOpacity>

          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'grouped' && styles.toggleBtnActive]}
              onPress={() => setViewMode('grouped')}
            >
              <Text style={viewMode === 'grouped' ? styles.toggleTextActive : styles.toggleText}>
                Grouped
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'flat' && styles.toggleBtnActive]}
              onPress={() => setViewMode('flat')}
            >
              <Text style={viewMode === 'flat' ? styles.toggleTextActive : styles.toggleText}>
                Flat
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {searching && <ActivityIndicator style={{ marginTop: 8 }} color={GREEN} />}
      </View>

      {viewMode === 'grouped' ? (
        <FlatList
          data={groupedSections}
          keyExtractor={(g) => g.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const expanded = expandedKeys.has(item.key);
            return (
              <View style={styles.groupCard}>
                <View style={styles.groupHeaderRow}>
                  <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(item.key)}>
                    <Text style={styles.groupChevron}>{expanded ? '⌄' : '›'}</Text>
                    <Text style={styles.groupTitle}>
                      {item.course} • {item.yearSection}
                    </Text>
                    <View style={styles.countPill}>
                      <Text style={styles.countPillText}>
                        {item.students.length} student{item.students.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.groupDeleteBtn}
                    onPress={() => handleDeleteSection(item)}
                  >
                    <Ionicons name="trash-outline" size={16} color={RED} />
                  </TouchableOpacity>
                </View>

                {expanded &&
                  item.students.map((s) => (
                    <View key={s.id} style={styles.studentRow}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditModal(s)}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        <Text style={styles.studentId}>{s.student_id}</Text>
                      </TouchableOpacity>
                      {renderStudentActions(s)}
                    </View>
                  ))}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No students found.</Text>
          }
        />
      ) : (
        <FlatList
          data={displayedStudents}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.flatRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditModal(item)}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentId}>{item.student_id}</Text>
                <Text style={styles.flatMeta}>
                  {item.course} • {item.year_level}-{item.section}
                </Text>
              </TouchableOpacity>
              {renderStudentActions(item)}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No students found.</Text>}
        />
      )}

      {departmentId && (
        <AddEditStudentModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onSaved={() => loadStudents(auth.currentUser)}
          departmentId={departmentId}
          allowedCourses={ALLOWED_COURSES}
          editingStudent={editingStudent}
        />
      )}

      <QRCodeModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        student={qrStudent}
      />

      <UploadSuccessModal
        visible={uploadSuccessVisible}
        count={uploadedCount}
        onClose={() => setUploadSuccessVisible(false)}
      />

      <UploadErrorModal
        visible={uploadErrorVisible}
        message={uploadErrorMessage}
        onClose={() => setUploadErrorVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  title: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 10 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 5 },
  headerButtons: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  outlineBtnText: { color: '#333', fontWeight: '600' },
  solidBtn: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  solidBtnText: { color: '#fff', fontWeight: '700' },
  searchInput: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#e2e2e2',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarLink: { color: GREEN, fontWeight: '600', fontSize: 13 },
  toolbarDivider: { marginHorizontal: 8, color: '#ccc' },
  toggleGroup: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: GREEN },
  toggleText: { color: '#555', fontWeight: '600', fontSize: 12 },
  toggleTextActive: { color: '#fff', fontWeight: '600', fontSize: 12 },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  groupHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    flex: 1,
  },
  groupDeleteBtn: { paddingHorizontal: 14, paddingVertical: 14 },
  groupChevron: { fontSize: 16, color: '#888', marginRight: 8, width: 14 },
  groupTitle: { flex: 1, fontWeight: '700', color: '#222' },
  countPill: {
    backgroundColor: '#E4F5E9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  flatRow: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  studentName: { fontWeight: '600', color: '#222' },
  studentId: { color: '#888', fontSize: 12, marginTop: 2 },
  flatMeta: { color: '#555', fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 40 },
  actionRow: { flexDirection: 'row', gap: 8 },
  qrBtn: {
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBtnText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  deleteBtn: {
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  deleteBtnText: { color: RED, fontWeight: '700', fontSize: 12 },
});