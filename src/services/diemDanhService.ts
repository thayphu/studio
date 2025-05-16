
'use server';
import type { AttendanceStatus } from '@/lib/types';
import { format } from 'date-fns';

// Placeholder/mock data for attendance
// Structure: { classId: { dateYYYYMMDD: { studentId: status } } }
const MOCKED_ATTENDANCE_DB: Record<string, Record<string, Record<string, AttendanceStatus>>> = {
  // Example:
  // "lop_A41_test_id": { // Replace with actual class ID
  //   "20250516": { // Replace with a testable date
  //     "hs_hoai_thuong_id_test": "Có mặt", // Replace with actual student ID
  //   }
  // }
};

/**
 * Fetches attendance records for a given class on a specific date.
 * @param classId The ID of the class.
 * @param date The date for which to fetch attendance.
 * @returns A promise that resolves to a record mapping student IDs to their attendance status.
 */
export const getAttendanceForClassOnDate = async (
  classId: string,
  date: Date
): Promise<Record<string, AttendanceStatus>> => {
  const formattedDate = format(date, 'yyyyMMdd');
  console.log(`[diemDanhService] MOCK Fetching attendance for class ${classId} on date ${formattedDate}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const classAttendance = MOCKED_ATTENDANCE_DB[classId];
  if (classAttendance) {
    return classAttendance[formattedDate] || {};
  }
  return {};
};

/**
 * Saves attendance data for a given class on a specific date.
 * @param classId The ID of the class.
 * @param date The date for which to save attendance.
 * @param attendanceData A record mapping student IDs to their new attendance status.
 */
export const saveAttendance = async (
  classId: string,
  date: Date,
  attendanceData: Record<string, AttendanceStatus>
): Promise<void> => {
  const formattedDate = format(date, 'yyyyMMdd');
  console.log(`[diemDanhService] MOCK Saving attendance for class ${classId} on date ${formattedDate}:`, attendanceData);
  
  if (!MOCKED_ATTENDANCE_DB[classId]) {
    MOCKED_ATTENDANCE_DB[classId] = {};
  }
  if (!MOCKED_ATTENDANCE_DB[classId][formattedDate]) {
    MOCKED_ATTENDANCE_DB[classId][formattedDate] = {};
  }
  
  // Update mock DB
  for (const studentId in attendanceData) {
    MOCKED_ATTENDANCE_DB[classId][formattedDate][studentId] = attendanceData[studentId];
  }
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log("[diemDanhService] MOCK DB updated:", MOCKED_ATTENDANCE_DB);
  // In a real implementation, this would write to Firestore.
};
