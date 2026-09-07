import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { auth, db } from '../firebase/config';
import { AttendanceEvent, fetchEvents, formatDateDMY } from '../services/eventService';
import {
  ReportFilters,
  ReportDataset,
  ReportId,
  ReportTable,
  LogStatus,
  fetchReportData,
  buildReportTable,
  REPORT_DEFINITIONS,
  exportReportToPDF,
  exportReportToExcel,
  getCurrentAdminLabel,
} from '../services/reportsService';

interface RecentReport {
  id: string;
  reportName: string;
  generatedOn: string;
  dateRange: string;
  format: 'PDF' | 'Excel';
  generatedBy: string;
  filename: string;
}

const GREEN = '#1E7A3E';

function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

const todayIso = () => dateToISO(new Date());

type ActiveDatePicker = 'from' | 'to' | null;

const STATUS_OPTIONS: { label: string; value: LogStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Present', value: 'Present' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Absent', value: 'Absent' },
];

export default function ReportsScreen() {
  const [departmentCode, setDepartmentCode] = useState('');
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [eventId, setEventId] = useState<string>('');
  const [status, setStatus] = useState<LogStatus | 'all' | ''>('');

  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({
    dateFrom: todayIso(),
    dateTo: todayIso(),
    eventId: 'all',
    status: 'all',
  });

  const [dataset, setDataset] = useState<ReportDataset | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewReportId, setPreviewReportId] = useState<ReportId | null>(null);
  const [previewTable, setPreviewTable] = useState<ReportTable | null>(null);

  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<ActiveDatePicker>(null);

  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null); // `${reportId}-${format}`

  // ---- load department + events (reused on mount and on pull-to-refresh) ----
  const loadEvents = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in.');
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      const code = (adminSnap.data()?.departmentCode as string) || '';
      setDepartmentCode(code);
      if (code) {
        const list = await fetchEvents(code);
        setEvents(list);
      }
      return code;
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
      return '';
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ---- fetch report data whenever filters are applied ----
  const loadData = useCallback(
    async (filters: ReportFilters, codeOverride?: string) => {
      const code = codeOverride || departmentCode;
      if (!code) return;
      setLoadingData(true);
      setError(null);
      try {
        const result = await fetchReportData(code, filters);
        setDataset(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load report data');
      } finally {
        setLoadingData(false);
      }
    },
    [departmentCode]
  );

  useEffect(() => {
    if (departmentCode) loadData(appliedFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentCode]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const code = await loadEvents();
      await loadData(appliedFilters, code);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyFilters = () => {
    if (dateFrom > dateTo) {
      setError('"From" date must be on or before "To" date.');
      return;
    }
    setError(null);
    const next: ReportFilters = {
      dateFrom,
      dateTo,
      eventId: eventId || 'all',
      status: status || 'all',
    };
    setAppliedFilters(next);
    loadData(next);
  };

  const onDatePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed' || !selected) return;
    if (activeDatePicker === 'from') setDateFrom(dateToISO(selected));
    if (activeDatePicker === 'to') setDateTo(dateToISO(selected));
  };

  const handleReset = () => {
    const today = todayIso();
    setDateFrom(today);
    setDateTo(today);
    setEventId('');
    setStatus('');
    const next: ReportFilters = { dateFrom: today, dateTo: today, eventId: 'all', status: 'all' };
    setAppliedFilters(next);
    loadData(next);
  };

  const studentCount = dataset?.students.length ?? 0;

  const handlePreview = (reportId: ReportId) => {
    if (!dataset) return;
    const table = buildReportTable(reportId, dataset);
    setPreviewReportId(reportId);
    setPreviewTable(table);
  };

  const addRecentReport = useCallback(
    async (reportTitle: string, format: 'PDF' | 'Excel', filename: string) => {
      const generatedBy = await getCurrentAdminLabel();
      setRecentReports((prev) => [
        {
          id: `${Date.now()}-${format}`,
          reportName: reportTitle,
          generatedOn: new Date().toLocaleString(),
          dateRange: `${appliedFilters.dateFrom} - ${appliedFilters.dateTo}`,
          format,
          generatedBy,
          filename,
        },
        ...prev,
      ]);
    },
    [appliedFilters]
  );

  const handleExport = async (reportId: ReportId, title: string, format: 'PDF' | 'Excel') => {
    if (!dataset) return;
    const key = `${reportId}-${format}`;
    setExportingId(key);
    try {
      const table = buildReportTable(reportId, dataset);
      const filename =
        format === 'PDF'
          ? await exportReportToPDF(title, table, appliedFilters)
          : await exportReportToExcel(title, table, appliedFilters);
      await addRecentReport(title, format, filename);
    } catch (err: any) {
      setError(err.message || `Failed to export ${format}`);
    } finally {
      setExportingId(null);
    }
  };

  const selectedEventLabel = useMemo(() => {
    if (eventId === '') return null;
    if (eventId === 'all') return 'All Events';
    return events.find((e) => e.id === eventId)?.title ?? 'All Events';
  }, [eventId, events]);

  const selectedStatusLabel =
    status === '' ? null : STATUS_OPTIONS.find((s) => s.value === status)?.label ?? 'All Statuses';

  const rangeValid = dateFrom <= dateTo;
  const dateErrorMessage = !rangeValid ? '"From" date must be on or before "To" date.' : null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} tintColor={GREEN} />
      }
    >
      <Text style={styles.title}>Reports &amp; Analytics</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ---- Filters ---- */}
      <View style={styles.card}>
        <Text style={styles.label}>DATE RANGE</Text>
        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.subLabel}>From</Text>
            <TouchableOpacity style={styles.pickerField} onPress={() => setActiveDatePicker('from')}>
              <Text style={styles.pickerValueText}>{formatDateDMY(dateFrom)}</Text>
              <Text style={styles.pickerIcon}>📅</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.flex1, { marginLeft: 8 }]}>
            <Text style={styles.subLabel}>To</Text>
            <TouchableOpacity style={styles.pickerField} onPress={() => setActiveDatePicker('to')}>
              <Text style={styles.pickerValueText}>{formatDateDMY(dateTo)}</Text>
              <Text style={styles.pickerIcon}>📅</Text>
            </TouchableOpacity>
          </View>
        </View>
        {dateErrorMessage && <Text style={styles.dateErrorText}>{dateErrorMessage}</Text>}

        <Modal visible={!!activeDatePicker} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.datePickerBox}>
              <Text style={styles.datePickerTitle}>
                {activeDatePicker === 'from' ? 'Select "From" date' : 'Select "To" date'}
              </Text>
              {activeDatePicker && (
                <DateTimePicker
                  value={isoToDate(activeDatePicker === 'from' ? dateFrom : dateTo)}
                  mode="date"
                  display="spinner"
                  onChange={onDatePickerChange}
                />
              )}
              <TouchableOpacity
                style={styles.doneBtnBox}
                onPress={() => setActiveDatePicker(null)}
              >
                <Text style={styles.doneBtnBoxText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Text style={styles.label}>EVENT</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setEventPickerOpen(true)}
          disabled={loadingEvents}
        >
          <Text style={!selectedEventLabel ? styles.placeholderText : undefined}>
            {loadingEvents ? 'Loading events…' : selectedEventLabel ?? 'Select event'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>ATTENDANCE STATUS</Text>
        <TouchableOpacity style={styles.input} onPress={() => setStatusPickerOpen(true)}>
          <Text style={!selectedStatusLabel ? styles.placeholderText : undefined}>
            {selectedStatusLabel ?? 'Select attendance status'}
          </Text>
        </TouchableOpacity>

        <View style={[styles.row, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[styles.btnPrimary, (loadingData || !rangeValid) && styles.btnDisabled]}
            onPress={handleApplyFilters}
            disabled={loadingData || !rangeValid}
          >
            <Text style={styles.btnPrimaryText}>
              {loadingData ? 'Applying…' : 'Apply Filters'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSecondary, { marginLeft: 8 }]}
            onPress={handleReset}
            disabled={loadingData}
          >
            <Text style={styles.btnSecondaryText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ---- Summary cards ---- */}
      <View style={styles.row}>
        <View style={[styles.card, styles.flex1]}>
          <Text style={styles.summaryLabel}>Total Absences</Text>
          <Text style={styles.summaryValue}>{dataset ? dataset.totalAbsences : '—'}</Text>
          <Text style={styles.summarySub}>Across all events in selected period</Text>
        </View>
        <View style={[styles.card, styles.flex1, { marginLeft: 8 }]}>
          <Text style={styles.summaryLabel}>Total Participation</Text>
          <Text style={styles.summaryValue}>{dataset ? dataset.totalParticipation : '—'}</Text>
          <Text style={styles.summarySub}>Across all events in selected period</Text>
        </View>
      </View>

      {/* ---- Available Reports ---- */}
      <Text style={styles.sectionTitle}>Available Reports</Text>
      {REPORT_DEFINITIONS.map((def) => {
        const pdfKey = `${def.id}-PDF`;
        const excelKey = `${def.id}-Excel`;
        return (
          <View style={styles.card} key={def.id}>
            <Text style={styles.reportTitle}>{def.title}</Text>
            <Text style={styles.reportDesc}>{def.description}</Text>
            <View style={styles.row}>
              <Text style={styles.reportMeta}>{studentCount} students</Text>
              <Text style={[styles.reportMeta, { marginLeft: 12 }]}>
                {appliedFilters.dateFrom} – {appliedFilters.dateTo}
              </Text>
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <TouchableOpacity
                style={[styles.btnOutline, styles.flex1]}
                onPress={() => handlePreview(def.id)}
                disabled={!dataset}
              >
                <Text style={styles.btnOutlineText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOutline, styles.flex1, { marginLeft: 8 }]}
                onPress={() => handleExport(def.id, def.title, 'PDF')}
                disabled={!dataset || exportingId === pdfKey}
              >
                <Text style={styles.btnOutlineText}>
                  {exportingId === pdfKey ? '…' : '⬇ PDF'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnOutline, styles.flex1, { marginLeft: 8 }]}
                onPress={() => handleExport(def.id, def.title, 'Excel')}
                disabled={!dataset || exportingId === excelKey}
              >
                <Text style={styles.btnOutlineText}>
                  {exportingId === excelKey ? '…' : '▤ Excel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {loadingData && <ActivityIndicator style={{ marginVertical: 12 }} />}

      {/* ---- Recently Generated Reports ---- */}
      <Text style={styles.sectionTitle}>Recently Generated Reports</Text>
      <View style={styles.card}>
        {recentReports.length === 0 ? (
          <Text style={styles.emptyText}>
            No reports generated yet. Export a report to see it here.
          </Text>
        ) : (
          recentReports.map((r) => (
            <View key={r.id} style={styles.recentRow}>
              <View style={styles.flex1}>
                <Text style={styles.recentName}>{r.reportName}</Text>
                <Text style={styles.recentMeta}>
                  {r.dateRange} · {r.format} · {r.generatedBy}
                </Text>
                <Text style={styles.recentMeta}>{r.generatedOn}</Text>
              </View>
              <Text style={styles.recentFilename} numberOfLines={1}>
                {r.filename}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ---- Event picker modal ---- */}
      <Modal visible={eventPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setEventPickerOpen(false)}
        >
          <View style={styles.sheet}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setEventId('all');
                setEventPickerOpen(false);
              }}
            >
              <Text>All Events</Text>
            </TouchableOpacity>
            {events.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.optionRow}
                onPress={() => {
                  setEventId(e.id);
                  setEventPickerOpen(false);
                }}
              >
                <Text>{e.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- Status picker modal ---- */}
      <Modal visible={statusPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setStatusPickerOpen(false)}
        >
          <View style={styles.sheet}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={styles.optionRow}
                onPress={() => {
                  setStatus(opt.value);
                  setStatusPickerOpen(false);
                }}
              >
                <Text>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- Preview modal ---- */}
      <Modal visible={!!previewTable} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewSheet}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewHeaderText}>
                {REPORT_DEFINITIONS.find((d) => d.id === previewReportId)?.title}
              </Text>
              <TouchableOpacity onPress={() => setPreviewReportId(null)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal>
              <ScrollView style={{ maxHeight: 400 }}>
                {previewTable && (
                  <View>
                    <View style={styles.tableRow}>
                      {previewTable.columns.map((c) => (
                        <Text key={c} style={[styles.tableCell, styles.tableHeaderCell]}>
                          {c}
                        </Text>
                      ))}
                    </View>
                    {previewTable.rows.length === 0 ? (
                      <Text style={styles.emptyText}>No data for the selected filters.</Text>
                    ) : (
                      previewTable.rows.map((row, i) => (
                        <View style={styles.tableRow} key={i}>
                          {row.map((cell, j) => (
                            <Text key={j} style={styles.tableCell}>
                              {cell}
                            </Text>
                          ))}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f5f6fa' },
  pageContent: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  errorBox: {
    backgroundColor: '#fde8e8',
    borderColor: '#f5b5b5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: { color: '#a12626' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', color: '#666', marginTop: 10, marginBottom: 4 },
  subLabel: { fontSize: 11, color: '#888', marginBottom: 3 },
  input: {
    borderWidth: 1,
    borderColor: '#dcdfe4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  pickerField: {
    borderWidth: 1,
    borderColor: '#dcdfe4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerValueText: { fontSize: 14, color: '#111' },
  pickerIcon: { fontSize: 14 },
  placeholderText: { color: '#999' },
  doneBtnBox: {
    marginTop: 10,
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneBtnBoxText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  datePickerBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '85%',
  },
  datePickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  dateErrorText: {
    color: '#a12626',
    fontSize: 11,
    marginTop: 6,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimary: {
    backgroundColor: GREEN,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  btnSecondary: {
    backgroundColor: '#eef0f4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnSecondaryText: { color: '#333', fontWeight: '600' },
  btnOutline: {
    borderWidth: 1,
    borderColor: GREEN,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnOutlineText: { color: GREEN, fontWeight: '600' },
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  summarySub: { fontSize: 11, color: '#999', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  reportTitle: { fontSize: 15, fontWeight: '700' },
  reportDesc: { fontSize: 13, color: '#666', marginTop: 4 },
  reportMeta: { fontSize: 11, color: '#999', marginTop: 8 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    width: '80%',
    maxHeight: '70%',
  },
  optionRow: { paddingVertical: 12, paddingHorizontal: 10 },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  previewSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewHeaderText: { fontSize: 16, fontWeight: '700' },
  closeBtn: { fontSize: 18, paddingHorizontal: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableCell: { minWidth: 100, padding: 8, fontSize: 12 },
  tableHeaderCell: { fontWeight: '700', backgroundColor: '#f5f6fa' },
  emptyText: { padding: 16, color: '#999', textAlign: 'center' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  recentName: { fontSize: 13, fontWeight: '700' },
  recentMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  recentFilename: {
    fontSize: 11,
    color: GREEN,
    maxWidth: 120,
    marginLeft: 8,
    textAlign: 'right',
  },
});