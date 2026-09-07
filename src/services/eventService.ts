import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface AttendanceEvent {
  id: string;
  title: string;
  eventDate: string; // 'YYYY-MM-DD'
  morningTimeIn?: string;  // 'HH:mm' 24h, empty/undefined = not set
  morningTimeOut?: string;
  afternoonTimeIn?: string;
  afternoonTimeOut?: string;
  departmentCode: string;
  createdBy: string;
  createdAt?: Timestamp;
}

export type EventInput = Omit<AttendanceEvent, 'id' | 'createdAt'>;

const EVENTS_COLLECTION = 'events';

export async function createEvent(input: EventInput): Promise<string> {
  // Firestore's addDoc() rejects `undefined` field values outright (it must
  // be either omitted or explicitly `null`). Optional session times that
  // were left blank come in as `undefined`, so strip those keys entirely
  // before writing rather than sending them.
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
    ...cleaned,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
}

export async function fetchEvents(departmentCode: string): Promise<AttendanceEvent[]> {
  const q = query(
    collection(db, EVENTS_COLLECTION),
    where('departmentCode', '==', departmentCode),
    orderBy('eventDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceEvent, 'id'>) }));
}

// Formats a 'HH:mm' 24h string to '9:00 AM' style for display.
export function formatTime12h(time?: string): string {
  if (!time) return '--';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

// Formats 'YYYY-MM-DD' to 'DD/MM/YYYY' for display.
export function formatDateDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

// Builds a local Date from an event's 'YYYY-MM-DD' date + an 'HH:mm' time
// string. Returns null if either piece is missing/malformed.
function combineDateTime(eventDate: string, time?: string): Date | null {
  if (!time) return null;
  const [y, m, d] = eventDate.split('-').map((n) => parseInt(n, 10));
  const [hh, mm] = time.split(':').map((n) => parseInt(n, 10));
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// Returns the moment an event's attendance window closes, i.e. the latest
// defined session end time (afternoon takes priority over morning, since it
// runs later in the day). Falls back to end-of-day on eventDate if no
// session times were configured at all, so events without set times still
// close naturally at midnight rather than staying open forever.
export function getEventEndDateTime(event: AttendanceEvent): Date {
  const afternoonEnd = combineDateTime(event.eventDate, event.afternoonTimeOut);
  if (afternoonEnd) return afternoonEnd;

  const morningEnd = combineDateTime(event.eventDate, event.morningTimeOut);
  if (morningEnd) return morningEnd;

  const [y, m, d] = event.eventDate.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

// Whether the event's attendance window has already closed relative to now.
export function isEventOver(event: AttendanceEvent, now: Date = new Date()): boolean {
  return now.getTime() > getEventEndDateTime(event).getTime();
}