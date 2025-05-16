
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import type { GiaoVienVangRecord, MakeupClassStatus } from '@/lib/types';
import { format } from 'date-fns';

const GIAO_VIEN_VANG_COLLECTION = "giaoVienVangRecords";

export const createGiaoVienVangRecord = async (
  classId: string,
  className: string,
  originalDate: Date
): Promise<GiaoVienVangRecord> => {
  const formattedOriginalDate = format(originalDate, 'yyyyMMdd');
  const newRecord: Omit<GiaoVienVangRecord, 'id'> = {
    classId,
    className,
    originalDate: formattedOriginalDate,
    status: 'chờ xếp lịch',
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), {
    ...newRecord,
    createdAtTimestamp: Timestamp.fromDate(new Date(newRecord.createdAt)) // For ordering if needed
  });
  return { ...newRecord, id: docRef.id };
};

export const getPendingMakeupClasses = async (): Promise<GiaoVienVangRecord[]> => {
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("status", "==", "chờ xếp lịch"),
    orderBy("createdAtTimestamp", "desc") // Show newest pending records first
  );

  const querySnapshot = await getDocs(q);
  const records: GiaoVienVangRecord[] = [];
  querySnapshot.forEach((doc) => {
    records.push({ id: doc.id, ...doc.data() } as GiaoVienVangRecord);
  });
  return records;
};

// Future functions:
// export const scheduleMakeupClass = async (recordId: string, makeupDate: Date, makeupTime: string, notes?: string) => { ... }
// export const cancelMakeupClass = async (recordId: string, notes?: string) => { ... }
// export const completeMakeupClass = async (recordId: string) => { ... }
