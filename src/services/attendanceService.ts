import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export type AttendanceStatus = 'present' | 'late' | 'absent';
export type AttendanceMethod = 'qr' | 'manual';

export interface AttendanceRecord {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  course: string;
  yearLevel: string;
  section: string;
  timeIn: Timestamp | null;
  timeOut: Timestamp | null;
  status: AttendanceStatus;
  method: AttendanceMethod;
  recordedAt?: Timestamp;
}

const ATTENDANCE_COLLECTION = 'attendance';

export async function checkInStudent(params: {
  eventId: string;
  studentId: string;
  studentName: string;
  course: string;
  yearLevel: string;
  section: string;
  method: AttendanceMethod;
  status?: AttendanceStatus;
}): Promise<string> {
  const existing = await findAttendanceRecord(params.eventId, params.studentId);
  if (existing) {
    throw new Error(`${params.studentName} is already checked in for this event.`);
  }

  const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), {
    eventId: params.eventId,
    studentId: params.studentId,
    studentName: params.studentName,
    course: params.course,
    yearLevel: params.yearLevel,
    section: params.section,
    timeIn: serverTimestamp(),
    timeOut: null,
    status: params.status ?? 'present',
    method: params.method,
    recordedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function checkOutStudent(eventId: string, studentId: string): Promise<void> {
  const record = await findAttendanceRecord(eventId, studentId);
  if (!record) {
    throw new Error('No check-in record found for this student at this event.');
  }
  await updateDoc(doc(db, ATTENDANCE_COLLECTION, record.id), {
    timeOut: serverTimestamp(),
  });
}

async function findAttendanceRecord(
  eventId: string,
  studentId: string
): Promise<AttendanceRecord | null> {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('eventId', '==', eventId),
    where('studentId', '==', studentId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) };
}

/** Subscribe to real-time attendance logs for a given event. Returns an unsubscribe function. */
export function subscribeToEventAttendance(
  eventId: string,
  onChange: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('eventId', '==', eventId),
    orderBy('recordedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) })));
  });
}

// ---- Cross-event queries (for dashboards/reports) ----
export async function fetchAttendanceForEvents(
  eventIds: string[],
  max?: number
): Promise<AttendanceRecord[]> {
  if (eventIds.length === 0) return [];

  // Firestore 'in' queries support at most 30 values; chunk defensively.
  const CHUNK = 30;
  let all: AttendanceRecord[] = [];
  for (let i = 0; i < eventIds.length; i += CHUNK) {
    const chunk = eventIds.slice(i, i + CHUNK);
    const q = query(collection(db, ATTENDANCE_COLLECTION), where('eventId', 'in', chunk));
    const snap = await getDocs(q);
    all = all.concat(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }))
    );
  }

  all.sort((a, b) => (b.recordedAt?.toMillis() ?? 0) - (a.recordedAt?.toMillis() ?? 0));
  return max ? all.slice(0, max) : all;
}