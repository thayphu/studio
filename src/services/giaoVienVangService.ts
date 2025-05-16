
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
                      : (existingData.createdAt || new Date().toISOString()), // Fallback if createdAtTimestamp is missing
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
      createdAtTimestamp: firestoreServerTimestamp() 
    };

    const docRef = await addDoc(collection(db, GIAO_VIEN_VANG_COLLECTION), recordToStore);
    console.log(`[giaoVienVangService] Successfully created GiaoVienVangRecord with ID: ${docRef.id} for class ${className} on ${formattedOriginalDate}`);
    
    // For immediate return, we create a client-side timestamp. Firestore will have the server one.
    const createdRecord: GiaoVienVangRecord = {
      id: docRef.id,
      classId: recordToStore.classId,
      className: recordToStore.className,
      originalDate: recordToStore.originalDate,
      status: recordToStore.status,
      createdAt: new Date().toISOString(), 
    };
    return createdRecord;

  } catch (error) {
    console.error("[giaoVienVangService] Error creating GiaoVienVangRecord in Firestore:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[giaoVienVangService] Firestore Precondition Failed for createGiaoVienVangRecord (query part): Missing index. Query: classId == ${classId}, originalDate == ${formattedOriginalDate}, status == "chờ xếp lịch". Check server logs for index creation link.`);
    }
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
      // console.log(`[giaoVienVangService] Fetched document: ${doc.id}, data:`, data); // Can be verbose
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate,
        status: data.status as MakeupClassStatus,
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
        console.error("[giaoVienVangService] Firestore Precondition Failed for getPendingMakeupClasses: This often means a required Firestore index is missing. The query requires an index on 'status' (ASC) and 'createdAtTimestamp' (DESC). Check server logs for a direct link to create the index.");
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
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[giaoVienVangService] Firestore Precondition Failed for deleteGiaoVienVangRecordByClassAndDate (query part): Missing index. Query: classId == ${classId}, originalDate == ${formattedOriginalDate}. Check server logs for index creation link.`);
    }
    throw error;
  }
};

/**
 * Fetches a summary of teacher absent days.
 * @returns A promise that resolves to an object with the total count of unique absent days and the records.
 */
export const getTeacherAbsentDaysSummary = async (): Promise<{ totalAbsentDays: number; records: GiaoVienVangRecord[] }> => {
  console.log("[giaoVienVangService] Attempting to fetch teacher absent days summary from Firestore.");
  // Fetch all records; could be optimized if collection grows very large by specific queries
  // For now, fetching all and processing client-side is acceptable for moderate data.
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    orderBy("originalDate", "desc") // Order to potentially make unique day counting easier or for display
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: GiaoVienVangRecord[] = [];
    const uniqueAbsentDays = new Set<string>();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate, // YYYYMMDD string
        status: data.status as MakeupClassStatus,
        createdAt: data.createdAtTimestamp instanceof Timestamp 
                      ? data.createdAtTimestamp.toDate().toISOString() 
                      : (data.createdAt || new Date().toISOString()),
        makeupDate: data.makeupDate,
        makeupTime: data.makeupTime,
        notes: data.notes,
      };
      records.push(record);
      uniqueAbsentDays.add(record.originalDate); // Add YYYYMMDD string to Set
    });
    
    const totalAbsentDays = uniqueAbsentDays.size;
    console.log(`[giaoVienVangService] Successfully fetched teacher absent summary. Total unique absent days: ${totalAbsentDays}, Total records: ${records.length}`);
    return { totalAbsentDays, records };
  } catch (error) {
    console.error("[giaoVienVangService] Error fetching teacher absent days summary from Firestore:", error);
     if ((error as any)?.code === 'failed-precondition') {
        console.error("[giaoVienVangService] Firestore Precondition Failed for getTeacherAbsentDaysSummary: Missing index for originalDate descending. Check server logs for index creation link.");
    }
    throw error;
  }
};


    