// src/components/SchedulePreviewGrid.tsx
//
// Renders a set of ScheduleSlots as a visual weekly timetable, matching
// the look of a printed class schedule: time down the left, days across
// the top, each class period drawn as a colored block spanning the rows
// it covers.
//
// Can render a single class being edited (CreateClassScreen) or a
// combined schedule across multiple classes (MyClassesScreen "grid" view)
// by passing a `label`/`color` on each slot.
//
// Only Mon–Fri are shown as columns (matching the reference schedule).
// Slots on Sat/Sun, or slots with unparseable times, are simply omitted
// from the grid — they still exist in the underlying data.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ScheduleSlot, Weekday } from '../types/class';
import { parseTimeToMinutes } from '../utils/time';

const GRID_DAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const GRID_START_MIN = 7 * 60; // 7:00 AM
const GRID_END_MIN = 21 * 60; // 9:00 PM
const ROW_MINUTES = 30;
const ROW_HEIGHT = 20;
const TIME_COL_WIDTH = 76;
const DAY_COL_WIDTH = 68;

const ROW_COUNT = (GRID_END_MIN - GRID_START_MIN) / ROW_MINUTES;

const GREEN = '#1E7A3E';
const ORANGE = '#EE7B22';
const ORANGE_BORDER = '#C75E12';

function formatClock(totalMinutes: number): { text: string; isPM: boolean } {
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const isPM = hours24 >= 12;
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  return { text: `${hours12}:${String(mins).padStart(2, '0')}`, isPM };
}

// e.g. "10:30-11:00am" — a full start-end range on every row, suffix taken
// from the row's start time, matching the reference schedule's labeling.
function formatRowRange(minutesFromStart: number): string {
  const rowStart = GRID_START_MIN + minutesFromStart;
  const rowEnd = rowStart + ROW_MINUTES;
  const start = formatClock(rowStart);
  const end = formatClock(rowEnd);
  return `${start.text}-${end.text}${start.isPM ? 'pm' : 'am'}`;
}

// A slot to draw on the grid. `label` overrides the block title (falls
// back to the `className` prop, which covers the single-class preview
// case in CreateClassScreen). `color` overrides the block's background.
export type GridSlot = ScheduleSlot & {
  label?: string; // class/course name, e.g. "GE Elec 3CS"
  subLabel?: string; // e.g. "BSCS 3A"
  color?: string;
  borderColor?: string;
};

interface Props {
  slots: GridSlot[];
  className?: string;
  bordered?: boolean;
}

export default function SchedulePreviewGrid({ slots, className, bordered = true }: Props) {
  const gridHeight = ROW_COUNT * ROW_HEIGHT;

  return (
    <View style={[styles.wrapper, bordered && styles.wrapperBordered]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row: blank corner + day labels */}
          <View style={styles.headerRow}>
            <View style={[styles.cell, { width: TIME_COL_WIDTH }]} />
            {GRID_DAYS.map((day) => (
              <View key={day} style={[styles.cell, styles.headerCell, { width: DAY_COL_WIDTH }]}>
                <Text style={styles.headerText}>{day.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row' }}>
            {/* Time labels column */}
            <View style={{ width: TIME_COL_WIDTH }}>
              {Array.from({ length: ROW_COUNT }).map((_, i) => (
                <View key={i} style={[styles.timeCell, { height: ROW_HEIGHT }]}>
                  <Text style={styles.timeText}>{formatRowRange(i * ROW_MINUTES)}</Text>
                </View>
              ))}
            </View>

            {/* Grid body */}
            <View style={{ width: DAY_COL_WIDTH * GRID_DAYS.length, height: gridHeight }}>
              {/* Row gridlines */}
              {Array.from({ length: ROW_COUNT }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.gridRow, { top: i * ROW_HEIGHT, height: ROW_HEIGHT }]}
                />
              ))}

              {/* Column gridlines */}
              {GRID_DAYS.map((_, i) => (
                <View
                  key={i}
                  style={[styles.gridCol, { left: i * DAY_COL_WIDTH, width: DAY_COL_WIDTH }]}
                />
              ))}

              {/* Class blocks */}
              {slots.map((slot, i) => {
                const dayIndex = GRID_DAYS.indexOf(slot.day);
                if (dayIndex === -1) return null; // Sat/Sun not shown on this grid

                const start = parseTimeToMinutes(slot.startTime);
                const end = parseTimeToMinutes(slot.endTime);
                if (start === null || end === null || end <= start) return null;
                if (end <= GRID_START_MIN || start >= GRID_END_MIN) return null;

                const clampedStart = Math.max(start, GRID_START_MIN);
                const clampedEnd = Math.min(end, GRID_END_MIN);

                const top = ((clampedStart - GRID_START_MIN) / ROW_MINUTES) * ROW_HEIGHT;
                const height = ((clampedEnd - clampedStart) / ROW_MINUTES) * ROW_HEIGHT;

                const label = slot.label ?? className ?? 'Class';
                const color = slot.color ?? ORANGE;
                const borderColor = slot.borderColor ?? ORANGE_BORDER;

                return (
                  <View
                    key={i}
                    style={[
                      styles.block,
                      {
                        top,
                        height,
                        left: dayIndex * DAY_COL_WIDTH + 2,
                        width: DAY_COL_WIDTH - 4,
                        backgroundColor: color,
                        borderColor,
                      },
                    ]}
                  >
                    <Text style={styles.blockTitle} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={styles.blockSubtitle} numberOfLines={1}>
                      {slot.type === 'Lecture' ? 'Lec' : 'Lab'}
                    </Text>
                    {!!slot.room && (
                      <Text style={styles.blockSubtitle} numberOfLines={1}>
                        {slot.room}
                      </Text>
                    )}
                    {!!slot.subLabel && (
                      <Text style={styles.blockSubtitle} numberOfLines={1}>
                        {slot.subLabel}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
  },
  wrapperBordered: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginTop: 12,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', backgroundColor: '#F5F6F8' },
  cell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  headerCell: { backgroundColor: '#EEF6F0' },
  headerText: { fontSize: 10, fontWeight: '800', color: GREEN },
  timeCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  timeText: { fontSize: 8, color: '#666', fontWeight: '600' },
  gridRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  gridCol: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderColor: '#e5e5e5',
  },
  block: {
    position: 'absolute',
    borderRadius: 3,
    borderWidth: 1.5,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockTitle: { color: '#fff', fontSize: 8, fontWeight: '800', textAlign: 'center' },
  blockSubtitle: { color: '#fff', fontSize: 7, marginTop: 1, textAlign: 'center' },
});