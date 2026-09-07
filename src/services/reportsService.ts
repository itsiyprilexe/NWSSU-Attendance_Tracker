import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AttendanceEvent, fetchEvents } from './eventService';
import { Student, fetchStudents } from './studentService';
import * as XLSX from 'xlsx';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// ---------------------------------------------------------------------------
// ASSUMPTIONS ABOUT YOUR FIRESTORE SCHEMA — adjust these if they don't match.
//
// 1. Attendance records live in a top-level 'attendance' collection, each doc
//    has: eventId, studentId, studentName, course, yearLevel, section,
//    departmentCode, timeIn?: Timestamp, timeOut?: Timestamp.
//    (This mirrors what subscribeToEventAttendance() already reads per-event
//    in attendanceService.ts.) If your records live in a subcollection like
//    events/{eventId}/attendance instead, swap fetchAttendanceForEvents below
//    to loop per-event with a subcollection query rather than a top-level
//    'in' query.
//
// 2. Firestore's `where(field, 'in', [...])` supports at most 10 values per
//    call, so fetchAttendanceForEvents batches eventIds into chunks of 10.
//
// 3. "Absent" isn't stored anywhere — it's the absence of a record. To
//    compute absences/at-risk students we synthesize a virtual row for every
//    (student, event) pair in the filtered range that has no matching
//    attendance doc with a timeIn.
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  course: string;
  yearLevel: string;
  section: string;
  timeIn?: Timestamp;
  timeOut?: Timestamp;
}

export type LogStatus = 'Present' | 'Completed' | 'Absent';

export interface ReportFilters {
  dateFrom: string; // 'YYYY-MM-DD'
  dateTo: string; // 'YYYY-MM-DD'
  eventId: string | 'all';
  status: LogStatus | 'all';
}

export interface ReportDataset {
  students: Student[];
  events: AttendanceEvent[];
  records: AttendanceRecord[]; // real attendance docs only (no synthesized absences)
  totalAbsences: number;
  totalParticipation: number;
}

const ATTENDANCE_COLLECTION = 'attendance';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchAttendanceForEvents(eventIds: string[]): Promise<AttendanceRecord[]> {
  if (eventIds.length === 0) return [];
  const batches = chunk(eventIds, 10);
  const results: AttendanceRecord[] = [];
  for (const batch of batches) {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('eventId', 'in', batch)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) => results.push({ id: d.id, ...(d.data() as Omit<AttendanceRecord, 'id'>) }));
  }
  return results;
}

export function getStatus(record: Pick<AttendanceRecord, 'timeIn' | 'timeOut'>): LogStatus {
  if (record.timeIn && record.timeOut) return 'Completed';
  if (record.timeIn) return 'Present';
  return 'Absent';
}

// Pulls everything needed for the Reports screen: events within the date
// range (optionally narrowed to one event), the department's full student
// roster, matching attendance records, and the two summary numbers.
export async function fetchReportData(
  departmentCode: string,
  filters: ReportFilters
): Promise<ReportDataset> {
  const { getDepartmentIdByCode } = await import('./departmentService');
  const [allEvents, resolvedDeptId] = await Promise.all([
    fetchEvents(departmentCode),
    getDepartmentIdByCode(departmentCode),
  ]);

  const students = await fetchStudents(resolvedDeptId);

  const eventsInRange = allEvents.filter((e) => {
    const inDateRange = e.eventDate >= filters.dateFrom && e.eventDate <= filters.dateTo;
    const matchesEvent = filters.eventId === 'all' || e.id === filters.eventId;
    return inDateRange && matchesEvent;
  });

  const records = await fetchAttendanceForEvents(eventsInRange.map((e) => e.id));

  const filteredRecords =
    filters.status === 'all' ? records : records.filter((r) => getStatus(r) === filters.status);

  // Participation = number of real check-ins (timeIn present) in range.
  const totalParticipation = records.filter((r) => r.timeIn).length;

  // Absences = every (student, event) pair in range with no timeIn record.
  // total possible attendances = students x events in range.
  const totalPossible = students.length * eventsInRange.length;
  const totalAbsences = Math.max(totalPossible - totalParticipation, 0);

  return {
    students,
    events: eventsInRange,
    records: filteredRecords,
    totalAbsences,
    totalParticipation,
  };
}

// ---------------------------------------------------------------------------
// Report row builders — one per card in "Available Reports".
// Each returns { columns, rows } ready to hand to the PDF/Excel exporters.
// ---------------------------------------------------------------------------

export type ReportId = 'event-participation' | 'absence-at-risk';

export interface ReportTable {
  columns: string[];
  rows: (string | number)[][];
}

// Department Overview's numbers power the Event Participation report (one
// row per event: totals + participation rate).
function buildDepartmentOverview(data: ReportDataset): ReportTable {
  return {
    columns: ['Event', 'Date', 'Total Students', 'Present', 'Absent', 'Participation Rate'],
    rows: data.events.map((evt) => {
      const eventRecords = data.records.filter((r) => r.eventId === evt.id && r.timeIn);
      const present = eventRecords.length;
      const total = data.students.length;
      const absent = Math.max(total - present, 0);
      const rate = total > 0 ? `${((present / total) * 100).toFixed(1)}%` : '—';
      return [evt.title, evt.eventDate, total, present, absent, rate];
    }),
  };
}

// 3. Event Participation — same shape as Department Overview but framed
// per-event rather than department-wide (kept separate so the two cards can
// diverge later, e.g. once multi-department reporting is added).
function buildEventParticipation(data: ReportDataset): ReportTable {
  return buildDepartmentOverview(data);
}

// 4. Absence & At-Risk — one row per student, across all filtered events.
// "At Risk" = missed more than half of the events in range.
function buildAbsenceAtRisk(data: ReportDataset): ReportTable {
  const totalEvents = data.events.length;
  return {
    columns: ['Student ID', 'Name', 'Course', 'Events', 'Times Absent', 'Absence Rate', 'Flag'],
    rows: data.students.map((s) => {
      const attended = data.records.filter((r) => r.studentId === s.student_id && r.timeIn).length;
      const absences = Math.max(totalEvents - attended, 0);
      const rate = totalEvents > 0 ? absences / totalEvents : 0;
      return [
        s.student_id,
        s.name,
        s.course,
        totalEvents,
        absences,
        `${(rate * 100).toFixed(1)}%`,
        rate > 0.5 ? 'At Risk' : '',
      ];
    }),
  };
}

export function buildReportTable(reportId: ReportId, data: ReportDataset): ReportTable {
  switch (reportId) {
    case 'event-participation':
      return buildEventParticipation(data);
    case 'absence-at-risk':
      return buildAbsenceAtRisk(data);
  }
}

export const REPORT_DEFINITIONS: {
  id: ReportId;
  title: string;
  description: string;
}[] = [
  {
    id: 'event-participation',
    title: 'Event Participation',
    description: 'Detailed attendance breakdown by specific university events.',
  },
  {
    id: 'absence-at-risk',
    title: 'Absence & At-Risk Report',
    description: 'Students with repeated absences or attendance concerns.',
  },
];

// ---------------------------------------------------------------------------
// Export helpers — native (Expo) implementations.
//
// jsPDF / jspdf-autotable / XLSX.writeFile all assume a browser DOM (Blob,
// <a download>, URL.createObjectURL) and will fail on-device. Instead:
//   - PDF: render an HTML table and hand it to expo-print, which uses the
//     native PDF renderer and returns a file uri.
//   - Excel: build the workbook with `xlsx` (safe — no filesystem access at
//     this step), serialize it to a base64 string in memory, then write that
//     to disk ourselves with expo-file-system.
// Both then open the native share sheet via expo-sharing so the user can
// save to Files, send it, upload to Drive, etc. Returned value is the
// filename, used for the "Recently Generated Reports" list.
// ---------------------------------------------------------------------------

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtmlTable(title: string, table: ReportTable, filters: ReportFilters): string {
  const headerCells = table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const bodyRows = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Helvetica, Arial, sans-serif; padding: 16px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.range { font-size: 11px; color: #555; margin-top: 0; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
          th { background-color: #1E7A3E; color: #fff; }
          tr:nth-child(even) { background-color: #f7f7f7; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p class="range">${escapeHtml(filters.dateFrom)} to ${escapeHtml(filters.dateTo)}</p>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

export async function exportReportToPDF(
  title: string,
  table: ReportTable,
  filters: ReportFilters
): Promise<string> {
  const html = buildHtmlTable(title, table, filters);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const filename = `${title.replace(/\s+/g, '_')}_${filters.dateFrom}_to_${filters.dateTo}.pdf`;
  const destUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
    });
  }

  return filename;
}

export async function exportReportToExcel(
  title: string,
  table: ReportTable,
  filters: ReportFilters
): Promise<string> {
  const worksheet = XLSX.utils.aoa_to_sheet([table.columns, ...table.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31)); // sheet names cap at 31 chars

  // Build in-memory only — do NOT call XLSX.writeFile, it assumes a browser.
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const filename = `${title.replace(/\s+/g, '_')}_${filters.dateFrom}_to_${filters.dateTo}.xlsx`;
  const destUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: title,
    });
  }

  return filename;
}

// Best-effort display name for "Generated By" in the recent-reports table.
export async function getCurrentAdminLabel(): Promise<string> {
  const user = auth.currentUser;
  return user?.displayName || user?.email || 'Unknown';
}