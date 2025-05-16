
'use server';
import type { AttendanceStatus } from '@/lib/types';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, DocumentData } from "firebase/firestore";

const DIEM_DANH_COLLECTION = "diemDanhRecords";

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
  console.log(`[diemDanhService] Firestore Fetching attendance for class ${classId} on date ${formattedDate}`);

  const attendanceQuery = query(
    collection(db, DIEM_DANH_COLLECTION),
    where("lopId", "==", classId),
    where("ngayDiemDanh", "==", formattedDate)
  );

  const querySnapshot = await getDocs(attendanceQuery);
  const attendanceRecords: Record<string, AttendanceStatus> = {};

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.hocSinhId && data.trangThai) {
      attendanceRecords[data.hocSinhId] = data.trangThai as AttendanceStatus;
    }
  });

  console.log(`[diemDanhService] Fetched records for ${classId} on ${formattedDate}:`, attendanceRecords);
  return attendanceRecords;
};

/**
 * Saves attendance data for a given class on a specific date to Firestore.
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
  console.log(`[diemDanhService] Firestore Saving attendance for class ${classId} on date ${formattedDate}:`, attendanceData);

  const batch = writeBatch(db);

  // To efficiently find existing documents to update, we first query them.
  const existingRecordsQuery = query(
    collection(db, DIEM_DANH_COLLECTION),
    where("lopId", "==", classId),
    where("ngayDiemDanh", "==", formattedDate)
  );
  const existingDocsSnapshot = await getDocs(existingRecordsQuery);
  const studentIdToDocIdMap: Map<string, string> = new Map();
  existingDocsSnapshot.forEach(docSnapshot => {
    const data = docSnapshot.data();
    if (data.hocSinhId) {
      studentIdToDocIdMap.set(data.hocSinhId, docSnapshot.id);
    }
  });

  for (const studentId in attendanceData) {
    const status = attendanceData[studentId];
    const recordData = {
      lopId: classId,
      hocSinhId: studentId,
      ngayDiemDanh: formattedDate,
      trangThai: status,
      lastUpdated: serverTimestamp() // Optional: to track when it was last updated
    };

    const existingDocId = studentIdToDocIdMap.get(studentId);
    if (existingDocId) {
      // Update existing record
      const docRef = doc(db, DIEM_DANH_COLLECTION, existingDocId);
      batch.update(docRef, { trangThai: status, lastUpdated: serverTimestamp() });
    } else {
      // Add new record
      const newDocRef = doc(collection(db, DIEM_DANH_COLLECTION)); // Auto-generate ID
      batch.set(newDocRef, recordData);
    }
  }

  try {
    await batch.commit();
    console.log(`[diemDanhService] Firestore Batch committed successfully for ${classId} on ${formattedDate}`);
  } catch (error) {
    console.error("[diemDanhService] Error committing batch: ", error);
    throw new Error("Failed to save attendance data.");
  }
};
