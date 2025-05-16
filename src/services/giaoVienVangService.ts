
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, serverTimestamp as firestoreServerTimestamp, writeBatch, doc } from "firebase/firestore";
import type { GiaoVienVangRecord, MakeupClassStatus } from '@/lib/types';
import { format } from 'date-fns';

const GIAO_VIEN_VANG_COLLECTION = "giaoVienVangRecords";

export const createGiaoVienVangRecord = async (
  classId: string,
  className: string,
  originalDate: Date
): Promise<GiaoVienVangRecord | null> => { 
  const formattedOriginalDate = format(originalDate, 'yyyyMMdd');
  console.log(`[giaoVienVangService] Attempting to create GiaoVienVangRecord for classId: ${classId}, className: ${className}, originalDate: ${formattedOriginalDate}`);

  const existingQuery = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("classId", "==", classId),
    where("originalDate", "==", formattedOriginalDate),
    // where("status", "==", "chờ xếp lịch") // Check for any existing record for this class/date to avoid duplicates, regardless of status initially.
                                         // If a record (e.g. 'đã hoàn thành') exists, we might not want to create a new 'chờ xếp lịch' one.
                                         // For now, allowing re-creation if status is different is fine, but strict prevention might be better.
                                         // Re-evaluating: It's better to prevent if 'chờ xếp lịch' already exists.
    where("status", "==", "chờ xếp lịch")
  );

  try {
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      console.warn(`[giaoVienVangService] A 'chờ xếp lịch' record already exists for class ${className} on ${formattedOriginalDate}. Not creating a new one.`);
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      return {
        id: existingDoc.id,
        classId: existingData.classId,
        className: existingData.className,
        originalDate: existingData.originalDate,
        status: existingData.status as MakeupClassStatus,
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
      createdAtTimestamp: firestoreServerTimestamp() // Use server timestamp
    };

    // Explicitly type `recordToStore` if needed for addDoc, or ensure addDoc infers correctly
    const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), recordToStore);
    console.log(`[giaoVienVangService] Successfully created GiaoVienVangRecord with ID: ${docRef.id} for class ${className} on ${formattedOriginalDate}`);
    
    const createdRecord: GiaoVienVangRecord = {
      id: docRef.id,
      ...recordToStore,
      createdAt: new Date().toISOString(), // This will be slightly off from serverTimestamp, but good for immediate return
                                        // The actual createdAt from serverTimestamp will be in DB.
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
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate,
        status: data.status as MakeupClassStatus,
        createdAt: data.createdAtTimestamp instanceof Timestamp 
                      ? data.createdAtTimestamp.toDate().toISOString() 
                      : (data.createdAt || new Date().toISOString()), // Fallback if createdAtTimestamp is missing for old docs
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

export const deleteGiaoVienVangRecordByClassAndDate = async (classId: string, originalDate: Date): Promise<void> => {
  const formattedOriginalDate = format(originalDate, 'yyyyMMdd');
  console.log(`[giaoVienVangService] Attempting to delete GiaoVienVangRecord for classId: ${classId}, originalDate: ${formattedOriginalDate}`);

  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("classId", "==", classId),
    where("originalDate", "==", formattedOriginalDate)
    // Optionally, you might want to only delete records with status 'chờ xếp lịch'
    // where("status", "==", "chờ xếp lịch") 
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log(`[giaoVienVangService] No GiaoVienVangRecord found for class ${classId} on ${formattedOriginalDate} to delete.`);
      return;
    }

    const batch = writeBatch(db);
    querySnapshot.forEach(docSnapshot => {
      batch.delete(doc(db, GIAO_VIEN_VANG_COLLECTION, docSnapshot.id));
    });
    await batch.commit();
    console.log(`[giaoVienVangService] Successfully deleted ${querySnapshot.size} GiaoVienVangRecord(s) for class ${classId} on ${formattedOriginalDate}.`);

  } catch (error) {
    console.error(`[giaoVienVangService] Error deleting GiaoVienVangRecord for class ${classId} on ${formattedOriginalDate}:`, error);
    throw error;
  }
};

