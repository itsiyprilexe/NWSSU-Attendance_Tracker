// src/screens/UploadStudentsScreen.tsx
//
// Requires these packages:
//   npx expo install expo-document-picker expo-file-system
//   npm install xlsx
//
// Expected Excel format (.xlsx, header row required, case-insensitive,
// read from the FIRST sheet in the workbook):
//   studentNumber | fullName          | email
//   2023-001      | Juan Dela Cruz    | juan@example.com
//   2023-002      | Maria Santos      |
//
// Column name matching is flexible: "studentNumber"/"studentId"/"id" all
// work for the ID column, "fullName"/"name" both work for the name column.
// "email" is optional.
//
// On a successful upload this now takes the instructor straight into
// InstructorStudentManagementScreen for this class, rather than just
// going back to Class Detail.

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { collection, doc, increment, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

const GREEN = '#1E7A3E';

interface ParsedStudent {
  studentNumber: string;
  fullName: string;
  email?: string;
}

function findColumn(row: Record<string, any>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const match = keys.find((k) => k.trim().toLowerCase() === candidate);
    if (match && row[match] !== undefined && row[match] !== null) {
      return String(row[match]).trim();
    }
  }
  return '';
}

export default function UploadStudentsScreen({ route, navigation }: any) {
  const { classId, className } = route.params as { classId: string; className?: string };
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const file = result.assets[0];
      setFileName(file.name);
      setParsing(true);

      // Excel files are binary, so read as base64 rather than UTF8 text.
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const workbook = XLSX.read(base64, { type: 'base64' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        Alert.alert('Empty file', "This workbook doesn't have any sheets.");
        setParsing(false);
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const students: ParsedStudent[] = rows
        .map((row) => ({
          studentNumber: findColumn(row, ['studentnumber', 'studentid', 'id']),
          fullName: findColumn(row, ['fullname', 'name']),
          email: findColumn(row, ['email']) || undefined,
        }))
        .filter((s) => s.fullName); // drop blank rows

      if (students.length === 0) {
        Alert.alert(
          'No students found',
          "Couldn't find any rows with a name column. Check that your Excel file has a header row with a 'fullName' or 'name' column, and that data is on the first sheet."
        );
        setParsedStudents([]);
        setParsing(false);
        return;
      }

      setParsedStudents(students);
    } catch (err: any) {
      Alert.alert('Could not read file', err?.message ?? 'Please try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (parsedStudents.length === 0) return;

    setUploading(true);
    try {
      const studentsRef = collection(db, 'classes', classId, 'students');

      // Firestore batches cap at 500 writes — chunk just in case of a
      // very large roster.
      const chunkSize = 450;
      for (let i = 0; i < parsedStudents.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = parsedStudents.slice(i, i + chunkSize);
        chunk.forEach((student) => {
          const newDocRef = doc(studentsRef);
          batch.set(newDocRef, {
            studentNumber: student.studentNumber,
            fullName: student.fullName,
            email: student.email ?? null,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      // Keep the denormalized studentCount on the class doc in sync so
      // MyClassesScreen doesn't need to fetch the subcollection just to
      // show a count.
      await updateDoc(doc(db, 'classes', classId), {
        studentCount: increment(parsedStudents.length),
      });

      Alert.alert('Upload complete', `${parsedStudents.length} students added.`, [
        {
          text: 'OK',
          onPress: () =>
            navigation.replace('InstructorStudentManagement', { classId, className }),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.pickButton} onPress={handlePickFile} disabled={parsing || uploading}>
        <Text style={styles.pickButtonText}>
          {fileName ? `Selected: ${fileName}` : 'Choose Excel File (.xlsx)'}
        </Text>
      </Pressable>

      {parsing && <ActivityIndicator style={{ marginTop: 16 }} color={GREEN} />}

      {parsedStudents.length > 0 && (
        <>
          <Text style={styles.previewLabel}>
            Preview — {parsedStudents.length} student{parsedStudents.length === 1 ? '' : 's'} found
          </Text>
          <FlatList
            data={parsedStudents}
            keyExtractor={(_, i) => String(i)}
            style={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowName}>{item.fullName}</Text>
                <Text style={styles.rowMeta}>
                  {item.studentNumber || '—'} {item.email ? `· ${item.email}` : ''}
                </Text>
              </View>
            )}
          />

          <Pressable
            style={[styles.confirmButton, uploading && { opacity: 0.7 }]}
            onPress={handleConfirmUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmButtonText}>
                Confirm Upload ({parsedStudents.length})
              </Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8', padding: 16 },
  pickButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickButtonText: { color: GREEN, fontWeight: '700' },
  previewLabel: { fontSize: 14, fontWeight: '700', color: '#111', marginTop: 20, marginBottom: 8 },
  list: { flex: 1 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  rowName: { fontWeight: '700', color: '#111' },
  rowMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  confirmButton: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});