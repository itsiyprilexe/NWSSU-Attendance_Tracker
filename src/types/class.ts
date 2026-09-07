// src/types/class.ts
//
// New Firestore schema this feature introduces:
//
// classes/{classId}
//   instructorId: string
//   instructorEmail: string
//   departmentCode: string
//   className: string
//   course: string
//   year: string
//   section: string
//   schedule: ScheduleSlot[]
//   studentCount: number       (denormalized, updated on each student upload)
//   createdAt: Timestamp
//
// classes/{classId}/students/{studentDocId}
//   studentNumber: string
//   fullName: string
//   email?: string
//   createdAt: Timestamp
//
// classes/{classId}/attendance/{YYYY-MM-DD}
//   date: string                          (redundant w/ doc id, kept for querying)
//   takenAt: Timestamp
//   records: { [studentDocId]: AttendanceStatus }

export type Weekday =
  | 'Mon'
  | 'Tue'
  | 'Wed'
  | 'Thu'
  | 'Fri'
  | 'Sat'
  | 'Sun';

export const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type SlotType = 'Lecture' | 'Laboratory';

export interface ScheduleSlot {
  day: Weekday;
  type: SlotType;
  room: string;
  startTime: string; // free text, e.g. "9:00 AM"
  endTime: string; // free text, e.g. "10:00 AM"
}

export interface ClassRecord {
  id: string;
  instructorId: string;
  instructorEmail: string;
  departmentCode: string;
  className: string;
  course: string;
  year: string;
  section: string;
  schedule: ScheduleSlot[];
  studentCount: number;
  createdAt: any; // Firestore Timestamp
}

export interface StudentRecord {
  id: string;
  studentNumber: string;
  fullName: string;
  email?: string;
  createdAt: any;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  date: string; // "YYYY-MM-DD"
  takenAt: any;
  records: Record<string, AttendanceStatus>; // studentDocId -> status
}