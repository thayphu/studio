
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, serverTimestamp as firestoreServerTimestamp } from "firebase/firestore"; // Added serverTimestamp
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
  
  // Data to be stored, excluding the auto-generated id
  const recordToStore = {
    classId,
    className,
    originalDate: formattedOriginalDate,
    status: 'chờ xếp lịch' as MakeupClassStatus,
    createdAt: new Date().toISOString(), // ISO string for general use
    createdAtTimestamp: firestoreServerTimestamp() // Firestore server timestamp for reliable ordering
  };

  try {
    const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), recordToStore);
    console.log(`[giaoVienVangService] Successfully created GiaoVienVangRecord with ID: ${docRef.id} for class ${className} on ${formattedOriginalDate}`);
    
    // Construct the GiaoVienVangRecord object to return, matching the type
    // For createdAtTimestamp, we can't know the exact server value yet without another read,
    // so we'll return the client's timestamp as string for 'createdAt' as per type.
    // The actual server timestamp is in Firestore.
    const createdRecord: GiaoVienVangRecord = {
      id: docRef.id,
      classId: recordToStore.classId,
      className: recordToStore.className,
      originalDate: recordToStore.originalDate,
      status: recordToStore.status,
      createdAt: recordToStore.createdAt, // Matches type, client-side ISO string
      // Note: GiaoVienVangRecord type doesn't have createdAtTimestamp, it's for Firestore query
    };
    return createdRecord;
  } catch (error) {
    console.error("[giaoVienVangService] Error creating GiaoVienVangRecord in Firestore:", error);
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
      // Ensure the data conforms to GiaoVienVangRecord, especially 'createdAt'
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate,
        status: data.status,
        // If createdAtTimestamp exists and is a Timestamp, convert its toDate().toISOString() to 'createdAt'
        // If data.createdAt (string) exists, use it. Fallback to a new date string.
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
        console.log("[giaoVienVangService] No pending makeup classes found matching status 'chờ xếp lịch'. Check Firestore 'giaoVienVangRecords' collection for documents with status 'chờ xếp lịch' AND a 'createdAtTimestamp' field.");
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

// Future functions:
// export const scheduleMakeupClass = async (recordId: string, makeupDate: Date, makeupTime: string, notes?: string) => { ... }
// export const cancelMakeupClass = async (recordId: string, notes?: string) => { ... }
// export const completeMakeupClass = async (recordId: string) => { ... }

