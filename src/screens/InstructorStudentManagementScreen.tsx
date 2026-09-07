// src/screens/InstructorStudentManagementScreen.tsx
//
// Shows the roster for a single class — reads classes/{classId}/students.
// Reached either from ClassDetailScreen's "Manage Students" button, from
// the drawer directly (no classId — shows a class picker first), or
// automatically after a successful upload in UploadStudentsScreen.
//
// Expects route.params: { classId?: string, className?: string }. When
// classId is absent, this screen instead lists the instructor's own
// classes and lets them tap one, which sets classId via setParams and
// switches this same screen into roster view.
//
// Styled to match the admin StudentManagementScreen: header card with
// action button(s), search card with Expand/Collapse all + Grouped/Flat
// toggle, and grouped or flat student lists.
//
// Since every student here belongs to the same single class (unlike the
// admin screen, which groups by course/section across the whole
// department), "Grouped" instead breaks students out under the class's
// own schedule slots (e.g. "Mon • Lecture • Room 302"), with the full
// roster repeated under each slot heading.

import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { StudentRecord, ScheduleSlot, ClassRecord } from '../types/class';

const GREEN = '#1E7A3E';
const RED = '#C0392B';

interface GroupedSlot {
  key: string; // "Mon-Lecture-0"
  slot: ScheduleSlot;
  students: StudentRecord[];
}

export default function InstructorStudentManagementScreen({ route, navigation }: any) {
  const { classId, className } = (route.params ?? {}) as {
    classId?: string;
    className?: string;
  };
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [pickerClasses, setPickerClasses] = useState<ClassRecord[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!classId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const [classSnap, studentsSnap] = await Promise.all([
        getDoc(doc(db, 'classes', classId)),
        getDocs(query(collection(db, 'classes', classId, 'students'), orderBy('fullName'))),
      ]);

      if (classSnap.exists()) {
        const data = classSnap.data() as { schedule?: ScheduleSlot[] };
        setSchedule(data.schedule ?? []);
      }

      const rows: StudentRecord[] = studentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StudentRecord, 'id'>),
      }));
      setStudents(rows);
    } catch (err) {
      console.error('Failed to load class/students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classId]);

  const loadPickerClasses = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setPickerClasses([]);
      setPickerLoading(false);
      return;
    }
    setPickerLoading(true);
    try {
      const q = query(collection(db, 'classes'), where('instructorId', '==', user.uid));
      const snap = await getDocs(q);
      const rows: ClassRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClassRecord, 'id'>),
      }));
      setPickerClasses(rows);
    } catch (err) {
      console.error('Failed to load classes for picker:', err);
    } finally {
      setPickerLoading(false);
    }
  }, []);

  // Refetch on focus so removing a student, or coming back from another
  // upload, always shows the latest roster. When no class is selected yet,
  // load the instructor's classes for the picker instead.
  useFocusEffect(
    useCallback(() => {
      if (!classId) {
        loadPickerClasses();
        return;
      }
      setLoading(true);
      loadData();
    }, [classId, loadData, loadPickerClasses])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.studentNumber.toLowerCase().includes(term)
    );
  }, [students, search]);

  // Every slot section shows the same filtered roster underneath it, since
  // students aren't individually tied to a specific meeting time.
  const groupedSlots: GroupedSlot[] = useMemo(
    () =>
      schedule.map((slot, i) => ({
        key: `${slot.day}-${slot.type}-${i}`,
        slot,
        students: filtered,
      })),
    [schedule, filtered]
  );

  const expandAll = () => setExpandedKeys(new Set(groupedSlots.map((g) => g.key)));
  const collapseAll = () => setExpandedKeys(new Set());
  const toggleGroup = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleRemove = (student: StudentRecord) => {
    Alert.alert('Remove student', `Remove ${student.fullName} from this class?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'classes', classId!, 'students', student.id));
            await updateDoc(doc(db, 'classes', classId!), { studentCount: increment(-1) });
            setStudents((prev) => prev.filter((s) => s.id !== student.id));
          } catch (err: any) {
            Alert.alert('Could not remove student', err?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  if (!classId) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.header]}>
          <Text style={styles.title}>Student Management</Text>
          <Text style={styles.subtitle}>Select a class to manage its students</Text>
        </View>

        {pickerLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={GREEN} />
          </View>
        ) : (
          <FlatList
            data={pickerClasses}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerRow}
                onPress={() =>
                  navigation.setParams({ classId: item.id, className: item.className })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{item.className}</Text>
                  <Text style={styles.studentId}>
                    {item.course} {item.year}
                    {item.section} • {item.studentCount ?? 0} student
                    {item.studentCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Text style={styles.pickerChevron}>›</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                You don't have any classes yet. Create one from My Classes first.
              </Text>
            }
          />
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={GREEN} />
      </View>
    );
  }

  const renderStudentRow = (item: StudentRecord) => (
    <View key={item.id} style={styles.studentRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.studentName}>{item.fullName}</Text>
        <Text style={styles.studentId}>
          {item.studentNumber || '—'}
          {item.email ? ` · ${item.email}` : ''}
        </Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item)}>
        <Text style={styles.deleteBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.card, styles.header]}>
        <Text style={styles.title}>{className ?? 'Student Management'}</Text>
        <Text style={styles.subtitle}>
          {students.length} student{students.length === 1 ? '' : 's'} enrolled
        </Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() =>
              navigation.navigate('MyClasses', {
                screen: 'UploadStudents',
                params: { classId, className },
              })
            }
          >
            <Text style={styles.outlineBtnText}>Upload Excel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or ID..."
          value={search}
          onChangeText={setSearch}
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
      </View>

      {viewMode === 'grouped' ? (
        <FlatList
          data={groupedSlots}
          keyExtractor={(g) => g.key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const expanded = expandedKeys.has(item.key);
            return (
              <View style={styles.groupCard}>
                <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroup(item.key)}>
                  <Text style={styles.groupChevron}>{expanded ? '⌄' : '›'}</Text>
                  <Text style={styles.groupTitle}>
                    {item.slot.day} • {item.slot.type}
                    {item.slot.room ? ` • Room ${item.slot.room}` : ''}
                    {item.slot.startTime ? ` • ${item.slot.startTime}-${item.slot.endTime}` : ''}
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>
                      {item.students.length} student{item.students.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expanded && item.students.map((s) => renderStudentRow(s))}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {schedule.length === 0
                ? 'This class has no schedule slots yet.'
                : 'No students found.'}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={styles.flatRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{item.fullName}</Text>
                <Text style={styles.studentId}>{item.studentNumber || '—'}</Text>
                {!!item.email && <Text style={styles.flatMeta}>{item.email}</Text>}
              </View>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item)}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {students.length === 0
                ? 'No students yet. Upload a student list to get started.'
                : 'No matches.'}
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6F8',
    paddingHorizontal: 30,
  },
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
  header: { marginTop: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4 },
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  groupChevron: { fontSize: 16, color: '#888', marginRight: 8, width: 14 },
  groupTitle: { flex: 1, fontWeight: '700', color: '#222', fontSize: 13 },
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
  deleteBtn: {
    borderWidth: 1,
    borderColor: RED,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  deleteBtnText: { color: RED, fontWeight: '700', fontSize: 12 },
  pickerRow: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  pickerChevron: { fontSize: 20, color: '#ccc', marginLeft: 8 },
});