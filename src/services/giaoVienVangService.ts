
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, serverTimestamp as firestoreServerTimestamp } from "firebase/firestore";
import type { GiaoVienVangRecord, MakeupClassStatus } from '@/lib/types';
import { format } from 'date-fns';

const GIAO_VIEN_VANG_COLLECTION = "giaoVienVangRecords";

export const createGiaoVienVangRecord = async (
  classId: string,
  className: string,
  originalDate: Date
): Promise<GiaoVienVangRecord | null> => { // Return null if duplicate prevented or error
  const formattedOriginalDate = format(originalDate, 'yyyyMMdd');
  console.log(`[giaoVienVangService] Attempting to create GiaoVienVangRecord for classId: ${classId}, className: ${className}, originalDate: ${formattedOriginalDate}`);

  // Check for existing pending makeup record for the same class and date
  const existingQuery = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("classId", "==", classId),
    where("originalDate", "==", formattedOriginalDate),
    where("status", "==", "chờ xếp lịch")
  );

  try {
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      console.warn(`[giaoVienVangService] A 'chờ xếp lịch' record already exists for class ${className} on ${formattedOriginalDate}. Not creating a new one.`);
      // Optionally, return the first existing record found
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      return {
        id: existingDoc.id,
        classId: existingData.classId,
        className: existingData.className,
        originalDate: existingData.originalDate,
        status: existingData.status,
        createdAt: existingData.createdAtTimestamp instanceof Timestamp 
                      ? existingData.createdAtTimestamp.toDate().toISOString() 
                      : (existingData.createdAt || new Date().toISOString()),
        makeupDate: existingData.makeupDate,
        makeupTime: existingData.makeupTime,
        notes: existingData.notes,
      };
    }

    const recordToStore = {
      classId,
      className,
      originalDate: formattedOriginalDate,
      status: 'chờ xếp lịch' as MakeupClassStatus,
      createdAt: new Date().toISOString(), // Keep for compatibility if needed, but prefer timestamp
      createdAtTimestamp: firestoreServerTimestamp()
    };

    const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), recordToStore);
    console.log(`[giaoVienVangService] Successfully created GiaoVienVangRecord with ID: ${docRef.id} for class ${className} on ${formattedOriginalDate}`);
    
    const createdRecord: GiaoVienVangRecord = {
      id: docRef.id,
      classId: recordToStore.classId,
      className: recordToStore.className,
      originalDate: recordToStore.originalDate,
      status: recordToStore.status,
      createdAt: recordToStore.createdAt, 
    };
    return createdRecord;

  } catch (error) {
    console.error("[giaoVienVangService] Error in createGiaoVienVangRecord:", error);
    // This error will propagate to the mutation's onError handler
    // Consider if this function should throw or return null/error object
    // For now, rethrowing seems appropriate for mutation's onError to catch.
    throw error; 
  }
};

export const getPendingMakeupClasses = async (): Promise<GiaoVienVangRecord[]> => {
  console.log("[giaoVienVangService] Attempting to fetch pending makeup classes from Firestore.");
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("status", "==", "chờ xếp lịch"),
    orderBy("createdAtTimestamp", "desc") 
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: GiaoVienVangRecord[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[giaoVienVangService] Fetched document: ${doc.id}, data:`, data);
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate,
        status: data.status,
        createdAt: data.createdAtTimestamp instanceof Timestamp 
                      ? data.createdAtTimestamp.toDate().toISOString() 
                      : (data.createdAt || new Date().toISOString()),
        makeupDate: data.makeupDate,
        makeupTime: data.makeupTime,
        notes: data.notes,
      };
      records.push(record);
    });
    
    console.log(`[giaoVienVangService] Successfully fetched ${records.length} pending makeup classes.`);
    if (records.length === 0) {
        console.log("[giaoVienVangService] No pending makeup classes found matching status 'chờ xếp lịch'. Check Firestore 'giaoVienVangRecords' collection for documents with status 'chờ xếp lịch' AND a 'createdAtTimestamp' field of type Firestore Timestamp.");
    }
    return records;
  } catch (error) {
    console.error("[giaoVienVangService] Error fetching pending makeup classes from Firestore:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error("[giaoVienVangService] Firestore Precondition Failed: This often means a required Firestore index is missing. Please check your Firestore indexes for the 'giaoVienVangRecords' collection. The query requires an index on 'status' (ASC) and 'createdAtTimestamp' (DESC). Check server logs for a direct link to create the index.");
    }
    throw error;
  }
};
