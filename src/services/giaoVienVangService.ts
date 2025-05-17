
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, orderBy, serverTimestamp as firestoreServerTimestamp, writeBatch, doc, updateDoc } from "firebase/firestore";
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
    where("originalDate", "==", formattedOriginalDate)
    // Consider adding: where("status", "in", ['chờ xếp lịch', 'đã xếp lịch'])
    // This might require another index if not already covered.
  );

  try {
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      const activeRecord = existingSnapshot.docs.find(doc => ['chờ xếp lịch', 'đã xếp lịch'].includes(doc.data().status));
      if (activeRecord) {
        console.warn(`[giaoVienVangService] An active GiaoVienVangRecord (status: ${activeRecord.data().status}) already exists for class ${className} on ${formattedOriginalDate}. Not creating a new one.`);
        const existingData = activeRecord.data();
        return {
          id: activeRecord.id,
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
    
     const createdRecordData: GiaoVienVangRecord = {
      id: docRef.id,
      ...recordToStore,
      createdAt: new Date().toISOString(), // Approximate, actual is server time. Will be overwritten by query.
    };
    return createdRecordData;

  } catch (error) {
    console.error("[giaoVienVangService] Error creating GiaoVienVangRecord in Firestore:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[giaoVienVangService] Firestore Precondition Failed for createGiaoVienVangRecord (query part): Missing index. Query: classId == ${classId}, originalDate == ${formattedOriginalDate}. Check server logs for index creation link.`);
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
      const record: GiaoVienVangRecord = {
        id: doc.id,
        classId: data.classId,
        className: data.className,
        originalDate: data.originalDate,
        status: data.status as MakeupClassStatus,
        createdAt: data.createdAtTimestamp instanceof Timestamp
                      ? data.createdAtTimestamp.toDate().toISOString()
                      : (data.createdAt || new Date().toISOString()), // Fallback, should ideally always be Timestamp
        makeupDate: data.makeupDate,
        makeupTime: data.makeupTime,
        notes: data.notes,
      };
      records.push(record);
      console.log(`[giaoVienVangService] Fetched pending makeup record: ID=${record.id}, Class=${record.className}, Status=${record.status}, CreatedAt=${record.createdAt}`);
    });

    if (records.length === 0) {
        console.log("[giaoVienVangService] No pending makeup classes found matching status 'chờ xếp lịch'. Check Firestore 'giaoVienVangRecords' collection for documents with status 'chờ xếp lịch' AND a 'createdAtTimestamp' field of type Firestore Timestamp.");
    } else {
        console.log(`[giaoVienVangService] Successfully fetched ${records.length} pending makeup classes.`);
    }
    return records;
  } catch (error) {
    console.error("[giaoVienVangService] Error fetching pending makeup classes from Firestore:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error("[giaoVienVangService] Firestore Precondition Failed for getPendingMakeupClasses: This often means a required Firestore index is missing. Query needs index on 'status' (ASC) and 'createdAtTimestamp' (DESC). Check server logs for a direct link to create the index.");
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


export const scheduleMakeupClass = async (
  recordId: string,
  makeupDate: Date,
  makeupTime: string,
  notes?: string
): Promise<void> => {
  const formattedMakeupDate = format(makeupDate, 'yyyyMMdd');
  console.log(`[giaoVienVangService] Scheduling makeup for recordId: ${recordId}, date: ${formattedMakeupDate}, time: ${makeupTime}`);

  const recordRef = doc(db, GIAO_VIEN_VANG_COLLECTION, recordId);
  const updateData: Partial<GiaoVienVangRecord> & { status: MakeupClassStatus } = {
    makeupDate: formattedMakeupDate,
    makeupTime: makeupTime,
    status: 'đã xếp lịch',
    notes: notes || "", 
  };

  try {
    await updateDoc(recordRef, updateData);
    console.log(`[giaoVienVangService] Successfully scheduled makeup for recordId: ${recordId}`);
  } catch (error) {
    console.error(`[giaoVienVangService] Error scheduling makeup for recordId ${recordId}:`, error);
    throw error;
  }
};

export const getScheduledMakeupSessionsForDate = async (date: Date): Promise<GiaoVienVangRecord[]> => {
  const formattedDate = format(date, 'yyyyMMdd');
  console.log(`[giaoVienVangService] Fetching scheduled makeup sessions for date ${formattedDate}`);

  // PERFORMANCE WARNING: This query requires a composite index on 'status' and 'makeupDate'.
  // If not present, Firestore will throw an error with a link to create it.
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    where("status", "==", "đã xếp lịch"),
    where("makeupDate", "==", formattedDate)
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: GiaoVienVangRecord[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      records.push({
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
      });
    });
    console.log(`[giaoVienVangService] Found ${records.length} scheduled makeup sessions for ${formattedDate}.`);
    return records;
  } catch (error) {
    console.error(`[giaoVienVangService] Error fetching scheduled makeup sessions for ${formattedDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[giaoVienVangService] Firestore Precondition Failed for getScheduledMakeupSessionsForDate: Missing index for status == 'đã xếp lịch' AND makeupDate == '${formattedDate}'. Check server logs for index creation link.`);
    }
    throw error;
  }
};


export const getTeacherAbsentDaysSummary = async (): Promise<{ totalAbsentDays: number; records: GiaoVienVangRecord[] }> => {
  console.log("[giaoVienVangService] Attempting to fetch teacher absent days summary from Firestore.");

  // PERFORMANCE WARNING: This query fetches ALL documents in the GIAO_VIEN_VANG_COLLECTION.
  // For large datasets, this can be very slow and costly.
  // Consider using server-side aggregation (e.g., Cloud Functions with counters) for better performance
  // or more specific queries if only a subset of records is needed for the summary.
  // An index on "originalDate" (desc) is recommended if this query is run frequently.
  const q = query(
    collection(db, GIAO_VIEN_VANG_COLLECTION),
    orderBy("originalDate", "desc")
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
      // Only count unique original dates for "totalAbsentDays" if all statuses are relevant for this count.
      // If only specific statuses (e.g., 'chờ xếp lịch', 'đã xếp lịch', 'đã hoàn thành') count as an "absent day", filter here.
      uniqueAbsentDays.add(record.originalDate);
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

    
