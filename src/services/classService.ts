import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface ClassSchedule {
  days: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  startTime: string; // '09:00'
  endTime: string; // '10:00'
}

export interface ClassData {
  id: string;
  instructorId: string;
  departmentId: string;
  departmentCode: string;
  className: string; // e.g. 'CS101 - Intro to Programming'
  course: string;
  yearLevel: string;
  section: string;
  schedule: ClassSchedule;
  studentIds: string[]; // enrolled students' Firestore doc ids
  createdAt?: Timestamp;
}

export type ClassInput = Omit<ClassData, 'id' | 'createdAt'>;

const CLASSES_COLLECTION = 'classes';

export async function createClass(input: ClassInput): Promise<string> {
  const docRef = await addDoc(collection(db, CLASSES_COLLECTION), {
    ...input,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function fetchClassesForInstructor(instructorId: string): Promise<ClassData[]> {
  const q = query(collection(db, CLASSES_COLLECTION), where('instructorId', '==', instructorId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassData, 'id'>) }));
}

export async function updateClassRoster(classId: string, studentIds: string[]): Promise<void> {
  await updateDoc(doc(db, CLASSES_COLLECTION, classId), { studentIds });
}

export async function deleteClass(classId: string): Promise<void> {
  await deleteDoc(doc(db, CLASSES_COLLECTION, classId));
}