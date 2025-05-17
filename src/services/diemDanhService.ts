
'use server';
import type { AttendanceStatus, DiemDanhGhiNhan } from '@/lib/types';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, DocumentData, orderBy } from "firebase/firestore";

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

  try {
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
  } catch (error) {
    console.error(`[diemDanhService] Error fetching attendance for ${classId} on ${formattedDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[diemDanhService] Firestore Precondition Failed for getAttendanceForClassOnDate: Missing index. Query: lopId == ${classId}, ngayDiemDanh == ${formattedDate}. Check server logs for index creation link.`);
    }
    throw error;
  }
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

  const existingRecordsQuery = query(
    collection(db, DIEM_DANH_COLLECTION),
    where("lopId", "==", classId),
    where("ngayDiemDanh", "==", formattedDate)
  );

  try {
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
        lastUpdated: serverTimestamp()
      };

      const existingDocId = studentIdToDocIdMap.get(studentId);
      if (existingDocId) {
        const docRef = doc(db, DIEM_DANH_COLLECTION, existingDocId);
        batch.update(docRef, { trangThai: status, lastUpdated: serverTimestamp() });
      } else {
        const newDocRef = doc(collection(db, DIEM_DANH_COLLECTION));
        batch.set(newDocRef, recordData);
      }
    }

    await batch.commit();
    console.log(`[diemDanhService] Firestore Batch committed successfully for ${classId} on ${formattedDate}`);
  } catch (error) {
    console.error("[diemDanhService] Error committing batch for saveAttendance: ", error);
     if ((error as any)?.code === 'failed-precondition') {
        console.error(`[diemDanhService] Firestore Precondition Failed for saveAttendance (query part): Missing index for lopId == ${classId}, ngayDiemDanh == ${formattedDate}. Check server logs for index creation link.`);
    }
    throw new Error("Failed to save attendance data.");
  }
};


/**
 * Fetches a summary of attendance for a specific date across all classes.
 * @param date The date for which to fetch the summary.
 * @returns A promise that resolves to an object with counts of present, absent, and teacherAbsent students.
 */
export const getDailyAttendanceSummary = async (
  date: Date
): Promise<{ present: number; absent: number; teacherAbsentSessionStudentCount: number }> => {
  const formattedDate = format(date, 'yyyyMMdd');
  console.log(`[diemDanhService] Firestore Fetching daily attendance summary for date ${formattedDate}`);

  // PERFORMANCE WARNING: This query fetches ALL attendance records for a specific date.
  // If there are many classes and students, this could be a large read operation.
  // Consider server-side aggregation or more targeted queries if performance issues arise.
  const attendanceQuery = query(
    collection(db, DIEM_DANH_COLLECTION),
    where("ngayDiemDanh", "==", formattedDate)
  );

  let present = 0;
  let absent = 0;
  let teacherAbsentSessionStudentCount = 0;

  try {
    const querySnapshot = await getDocs(attendanceQuery);
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DiemDanhGhiNhan;
      if (data.trangThai === 'Có mặt') {
        present++;
      } else if (data.trangThai === 'Vắng mặt') {
        absent++;
      } else if (data.trangThai === 'GV nghỉ') {
        teacherAbsentSessionStudentCount++;
      }
    });
    console.log(`[diemDanhService] Daily summary for ${formattedDate}: Present: ${present}, Absent: ${absent}, Teacher Absent Students: ${teacherAbsentSessionStudentCount}`);
    return { present, absent, teacherAbsentSessionStudentCount };
  } catch (error) {
    console.error(`[diemDanhService] Error fetching daily attendance summary for ${formattedDate}:`, error);
     if ((error as any)?.code === 'failed-precondition') {
        console.error(`[diemDanhService] Firestore Precondition Failed for getDailyAttendanceSummary: Missing index for ngayDiemDanh == ${formattedDate}. Check server logs for index creation link.`);
    }
    throw error;
  }
};

/**
 * Fetches an overall summary of attendance across all time.
 * @returns A promise that resolves to an object with total counts of present and absent students.
 */
export const getOverallAttendanceSummary = async (): Promise<{ totalPresent: number; totalAbsent: number }> => {
  console.log(`[diemDanhService] Firestore Fetching overall attendance summary`);

  // PERFORMANCE WARNING: This query fetches ALL documents in the DIEM_DANH_COLLECTION.
  // For large datasets, this can be very slow and costly.
  // Consider using server-side aggregation (e.g., Cloud Functions with counters) for better performance.
  const attendanceQuery = query(collection(db, DIEM_DANH_COLLECTION));

  let totalPresent = 0;
  let totalAbsent = 0;

  try {
    const querySnapshot = await getDocs(attendanceQuery);
    querySnapshot.forEach((doc) => {
      const data = doc.data() as DiemDanhGhiNhan;
      if (data.trangThai === 'Có mặt') {
        totalPresent++;
      } else if (data.trangThai === 'Vắng mặt') {
        totalAbsent++;
      }
      // We are not counting 'GV nghỉ' or 'Học bù' for these overall stats
    });
    console.log(`[diemDanhService] Overall summary: Total Present: ${totalPresent}, Total Absent: ${totalAbsent}`);
    return { totalPresent, totalAbsent };
  } catch (error) {
    console.error(`[diemDanhService] Error fetching overall attendance summary:`, error);
    throw error;
  }
};


/**
 * Fetches detailed attendance records for a specific date across all classes.
 * Used for populating modal views in reports.
 * @param date The date for which to fetch detailed attendance.
 * @returns A promise that resolves to an array of DiemDanhGhiNhan objects.
 */
export const getDetailedAttendanceForDate = async (
  date: Date
): Promise<DiemDanhGhiNhan[]> => {
  const formattedDate = format(date, 'yyyyMMdd');
  console.log(`[diemDanhService] Firestore Fetching detailed attendance for date ${formattedDate}`);

  const attendanceQuery = query(
    collection(db, DIEM_DANH_COLLECTION),
    where("ngayDiemDanh", "==", formattedDate),
    orderBy("lopId"), 
    orderBy("hocSinhId")
  );

  const records: DiemDanhGhiNhan[] = [];
  try {
    const querySnapshot = await getDocs(attendanceQuery);
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      records.push({
        id: doc.id,
        hocSinhId: data.hocSinhId,
        lopId: data.lopId,
        ngayDiemDanh: data.ngayDiemDanh,
        trangThai: data.trangThai as AttendanceStatus,
        ghiChu: data.ghiChu,
        // hoTen and tenLop would need to be joined/fetched separately if needed here
      });
    });
    console.log(`[diemDanhService] Fetched ${records.length} detailed attendance records for ${formattedDate}.`);
    return records;
  } catch (error) {
    console.error(`[diemDanhService] Error fetching detailed attendance for ${formattedDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[diemDanhService] Firestore Precondition Failed for getDetailedAttendanceForDate: Missing index for ngayDiemDanh == ${formattedDate} (and possibly lopId, hocSinhId for ordering). Check server logs for index creation link.`);
    }
    throw error;
  }
};

