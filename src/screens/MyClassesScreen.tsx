// src/screens/MyClassesScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { ClassRecord } from '../types/class';
import SchedulePreviewGrid, { GridSlot } from '../components/SchedulePreviewGrid';

const GREEN = '#1E7A3E';

export default function MyClassesScreen({ navigation }: any) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClasses = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setClasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'classes'), where('instructorId', '==', user.uid));
      const snap = await getDocs(q);
      const rows: ClassRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClassRecord, 'id'>),
      }));
      setClasses(rows);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch every time this screen regains focus (e.g. after creating a
  // class or coming back from uploading students), not just on mount.
  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  // Flatten every class's schedule slots into one list the grid can draw,
  // tagging each slot with that class's name plus a "COURSE YEARSection"
  // sub-label (e.g. "BSCS 3A"), matching the reference schedule layout.
  const gridSlots: GridSlot[] = useMemo(
    () =>
      classes.flatMap((cls) =>
        (cls.schedule ?? []).map((slot) => ({
          ...slot,
          label: cls.className,
          subLabel: `${cls.course} ${cls.year}${cls.section}`.trim(),
        }))
      ),
    [classes]
  );

  const instructorName =
    auth.currentUser?.displayName || auth.currentUser?.email || 'My Schedule';

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
        <Text style={styles.headerTitle}>My Classes</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {classes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No classes yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the + button to create your first class.
            </Text>
          </View>
        ) : (
          <View style={styles.gridCard}>
            <View style={styles.gridTitleBar}>
              <Text style={styles.gridTitleText}>{instructorName}</Text>
            </View>
            <SchedulePreviewGrid slots={gridSlots} bordered={false} />
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateClass')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  gridCard: {
    borderWidth: 2,
    borderColor: '#EE7B22',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridTitleBar: {
    backgroundColor: GREEN,
    paddingVertical: 10,
    alignItems: 'center',
  },
  gridTitleText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  emptySubtitle: { fontSize: 13, color: '#888', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});