import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

export interface Student {
  id: string; // Firestore doc id
  student_id: string;
  name: string;
  department_id: string; // Firestore department doc id
  department_name?: string;
  course: string;
  year_level: string;
  section: string;
  email: string;
}

const STUDENTS_COLLECTION = 'students';

// ---- LIST ----
export async function fetchStudents(departmentId?: string | null): Promise<Student[]> {
  const col = collection(db, STUDENTS_COLLECTION);
  const q = departmentId ? query(col, where('department_id', '==', departmentId)) : col;

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }));
}

// ---- SEARCH ----
// Firestore doesn't support free-text substring search natively, so we fetch
// the department's students (already a small, bounded set) and filter client-side.
export async function searchStudents(
  searchQuery: string,
  departmentId?: string | null
): Promise<Student[]> {
  const trimmed = searchQuery.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const all = await fetchStudents(departmentId);
  return all.filter(
    (s) =>
      s.name.toLowerCase().includes(trimmed) ||
      s.student_id.toLowerCase().includes(trimmed)
  );
}

// ---- ADD ----
export interface StudentInput {
  student_id: string;
  name: string;
  course: string;
  year_level?: string;
  section?: string;
  email?: string;
  department_id: string;
}

export async function addStudent(input: StudentInput): Promise<string> {
  const existing = await getDocs(
    query(collection(db, STUDENTS_COLLECTION), where('department_id', '==', input.department_id))
  );
  const idLower = input.student_id.trim().toLowerCase();
  const duplicate = existing.docs.some(
    (d) => String(d.data().student_id ?? '').trim().toLowerCase() === idLower
  );
  if (duplicate) {
    throw new Error(`A student with ID "${input.student_id}" already exists in this department.`);
  }

  await addDoc(collection(db, STUDENTS_COLLECTION), input);
  return 'Student added successfully';
}

// ---- UPDATE ----
export interface StudentUpdateInput extends StudentInput {
  id: string;
}

export async function updateStudent(input: StudentUpdateInput): Promise<string> {
  const { id, ...rest } = input;
  await updateDoc(doc(db, STUDENTS_COLLECTION, id), rest);
  return 'Student updated successfully';
}

// ---- DELETE ALL ----
export async function deleteAllStudents(departmentId: string): Promise<number> {
  const snap = await getDocs(
    query(collection(db, STUDENTS_COLLECTION), where('department_id', '==', departmentId))
  );

  const CHUNK = 450; // Firestore batch write limit is 500
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  return docs.length;
}

// ---- DELETE BY SECTION ----
// Deletes all students matching a specific course + year level + section
// within a department (used by the grouped view's per-section trash icon).
export async function deleteStudentsBySection(
  departmentId: string,
  course: string,
  yearLevel: string,
  section: string
): Promise<number> {
  const snap = await getDocs(
    query(
      collection(db, STUDENTS_COLLECTION),
      where('department_id', '==', departmentId),
      where('course', '==', course),
      where('year_level', '==', yearLevel),
      where('section', '==', section)
    )
  );

  const CHUNK = 450; // Firestore batch write limit is 500
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  return docs.length;
}

// ---- UPLOAD EXCEL ----
export interface UploadResult {
  success: boolean;
  message?: string;
  error?: string;
  imported: number;
  rejected: Array<Record<string, unknown>>;
}

// Expected Excel columns (case-insensitive, spaces ok):
// Student Id | Student Name | Course | Year | Section | (Email optional)
export async function uploadStudentsExcel(
  fileUri: string,
  _fileName: string,
  departmentId: string
): Promise<UploadResult> {
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const workbook = XLSX.read(base64, { type: 'base64' });

    // Read every sheet in the workbook, not just the first one.
    let allRows: Record<string, any>[] = [];
    for (const sheetName of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
      allRows = allRows.concat(rows);
    }

    // Normalize a row's keys to lowercase, no spaces, so "Student Id",
    // "student_id", "STUDENT ID" etc. all resolve the same way.
    const normalize = (row: Record<string, any>) => {
      const out: Record<string, any> = {};
      for (const key of Object.keys(row)) {
        const cleanKey = key.trim().toLowerCase().replace(/[\s_]+/g, '');
        out[cleanKey] = row[key];
      }
      return out;
    };

    // --- Pre-fetch existing student IDs already in this department ---
    // Used to reject rows whose Student ID already exists in Firestore.
    const existingSnap = await getDocs(
      query(collection(db, STUDENTS_COLLECTION), where('department_id', '==', departmentId))
    );
    const existingIds = new Set(
      existingSnap.docs.map((d) => String(d.data().student_id ?? '').trim().toLowerCase())
    );

    // Tracks IDs seen within THIS upload (catches duplicates inside the
    // same file, or across multiple sheets in the same workbook).
    const seenInThisUpload = new Set<string>();

    const rejected: Array<Record<string, unknown>> = [];
    const valid: StudentInput[] = [];

    for (const rawRow of allRows) {
      const row = normalize(rawRow);

      const student_id = String(row['studentid'] ?? '').trim();
      const name = String(row['studentname'] ?? row['name'] ?? '').trim();
      const course = String(row['course'] ?? '').trim();

      if (!student_id || !name || !course) {
        rejected.push({ ...rawRow, reason: 'Missing required field(s)' });
        continue;
      }

      const idKey = student_id.toLowerCase();

      if (existingIds.has(idKey)) {
        rejected.push({
          ...rawRow,
          reason: `Duplicate Student ID: "${student_id}" already exists in this department`,
        });
        continue;
      }

      if (seenInThisUpload.has(idKey)) {
        rejected.push({
          ...rawRow,
          reason: `Duplicate Student ID: "${student_id}" appears more than once in this upload`,
        });
        continue;
      }

      seenInThisUpload.add(idKey);

      valid.push({
        student_id,
        name,
        course,
        year_level: String(row['year'] ?? row['yearlevel'] ?? '').trim(),
        section: String(row['section'] ?? '').trim(),
        email: String(row['email'] ?? '').trim(),
        department_id: departmentId,
      });
    }

    // Firestore batches cap at 500 writes; chunk defensively.
    const CHUNK = 450;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const student of valid.slice(i, i + CHUNK)) {
        const ref = doc(collection(db, STUDENTS_COLLECTION));
        batch.set(ref, student);
      }
      await batch.commit();
    }

    return {
      success: true,
      message: `Imported ${valid.length} student(s), ${rejected.length} rejected.`,
      imported: valid.length,
      rejected,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Upload failed',
      imported: 0,
      rejected: [],
    };
  }
}