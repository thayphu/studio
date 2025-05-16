
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
  console.log(`[giaoVienVangService] Attempting to create GiaoVienVangRecord for classId: ${classId}, className: ${className}, originalDate: ${originalDate.toISOString()}`);
  const formattedOriginalDate = format(originalDate, 'yyyyMMdd');
  const newRecordData: Omit<GiaoVienVangRecord, 'id'> = {
    classId,
    className,
    originalDate: formattedOriginalDate,
    status: 'chờ xếp lịch',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), {
      ...newRecordData,
      createdAtTimestamp: Timestamp.fromDate(new Date(newRecordData.createdAt))
    });
    console.log(`[giaoVienVangService] Successfully created GiaoVienVangRecord with ID: ${docRef.id}`);
    return { ...newRecordData, id: docRef.id };
  } catch (error) {
    console.error("[giaoVienVangService] Error creating GiaoVienVangRecord:", error);
    // Re-throw the error so the mutation can catch it if needed, or handle it as per your app's error strategy
    throw error; 
  }
};

export const getPendingMakeupClasses = async (): Promise<GiaoVienVangRecord[]> => {
  console.log("[giaoVienVangService] Attempting to fetch pending makeup classes.");
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("status", "==", "chờ xếp lịch"),
    orderBy("createdAtTimestamp", "desc")
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: GiaoVienVangRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as GiaoVienVangRecord);
    });
    console.log(`[giaoVienVangService] Fetched ${records.length} pending makeup classes.`);
    return records;
  } catch (error) {
    console.error("[giaoVienVangService] Error fetching pending makeup classes:", error);
    // Suggest checking Firestore indexes if a specific error type is caught
    if ((error as any)?.code === 'failed-precondition') {
        console.error("[giaoVienVangService] Firestore Precondition Failed: This often means a required index is missing. Please check your Firestore indexes for the 'giaoVienVangRecords' collection, ensuring an index exists for 'status' (ASC) and 'createdAtTimestamp' (DESC).");
    }
    throw error;
  }
};

// Future functions:
// export const scheduleMakeupClass = async (recordId: string, makeupDate: Date, makeupTime: string, notes?: string) => { ... }
// export const cancelMakeupClass = async (recordId: string, notes?: string) => { ... }
// export const completeMakeupClass = async (recordId: string) => { ... }
