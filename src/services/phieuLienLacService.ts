
'use server';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  writeBatch,
  doc,
  orderBy,
  limit,
  DocumentData,
} from 'firebase/firestore';
import type { PhieuLienLacRecord } from '@/lib/types';
import { format } from 'date-fns';

const PHIEU_LIEN_LAC_COLLECTION = 'phieuLienLacRecords';

/**
 * Saves or updates PhieuLienLacRecords to Firestore.
 * It performs an "upsert" operation: updates if a record exists for the student/class/date, otherwise inserts a new one.
 */
export const savePhieuLienLacRecords = async (
  records: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  if (!records || records.length === 0) {
    console.log('[phieuLienLacService] No records to save.');
    return;
  }
  console.log('[phieuLienLacService] Attempting to save/update Phieu Lien Lac records:', records.map(r => ({student: r.studentId, date: r.date, score: r.score})));

  const batch = writeBatch(db);

  for (const record of records) {
    if (!record.studentId || !record.classId || !record.date) {
      console.warn('[phieuLienLacService] Skipping record due to missing studentId, classId, or date:', record);
      continue;
    }

    // Query for an existing record
    // This query will require a composite index on studentId, classId, and date.
    // Firestore will provide a link in the server console if the index is missing.
    const q = query(
      collection(db, PHIEU_LIEN_LAC_COLLECTION),
      where('studentId', '==', record.studentId),
      where('classId', '==', record.classId),
      where('date', '==', record.date), 
      limit(1)
    );

    try {
      console.log(`[phieuLienLacService] Processing record for student ${record.studentId} on ${record.date}. Querying for existing...`);
      const querySnapshot = await getDocs(q);
      console.log(`[phieuLienLacService] Existing slip querySnapshot size for student ${record.studentId} on ${record.date}: ${querySnapshot.size}`);

      const dataToSave: Partial<PhieuLienLacRecord> & { studentId: string; classId: string; date: string; updatedAt: any; createdAt?: any } = {
        ...record,
        studentName: record.studentName || '',
        className: record.className || '',
        testFormat: record.testFormat || undefined,
        score: record.score === undefined || record.score === null ? null : Number(record.score),
        lessonMasteryText: record.lessonMasteryText || '',
        homeworkStatus: record.homeworkStatus || undefined,
        vocabularyToReview: record.vocabularyToReview || '',
        remarks: record.remarks || '',
        updatedAt: serverTimestamp(),
      };
      
      if (dataToSave.testFormat === "") dataToSave.testFormat = undefined;
      if (dataToSave.homeworkStatus === "") dataToSave.homeworkStatus = undefined;


      console.log(`[phieuLienLacService] Data to save for student ${record.studentId} on ${record.date}:`, JSON.parse(JSON.stringify(dataToSave))); // Log serializable data


      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        console.log(`[phieuLienLacService] Updating existing Phieu Lien Lac record ${existingDoc.id} for student ${record.studentId} on ${record.date}`);
        batch.update(existingDoc.ref, dataToSave);
      } else {
        const newDocRef = doc(collection(db, PHIEU_LIEN_LAC_COLLECTION));
        dataToSave.createdAt = serverTimestamp();
        console.log(`[phieuLienLacService] Adding new Phieu Lien Lac record for student ${record.studentId} on ${record.date}`);
        batch.set(newDocRef, dataToSave);
      }
    } catch (error) {
      console.error(`[phieuLienLacService] Error processing (querying or preparing) record for student ${record.studentId} on ${record.date}:`, error);
      if ((error as any)?.code === 'failed-precondition' && (error as any)?.message.includes('index')) {
        console.error(`[phieuLienLacService] Firestore Precondition Failed (likely missing index) for query: studentId == ${record.studentId}, classId == ${record.classId}, date == ${record.date}. Check server logs for index creation link.`);
      } else if ((error as any)?.code === 'permission-denied') {
         console.error(`[phieuLienLacService] PERMISSION DENIED while processing record for student ${record.studentId}. Check Firestore rules for '${PHIEU_LIEN_LAC_COLLECTION}'.`);
      }
    }
  }

  try {
    await batch.commit();
    console.log('[phieuLienLacService] Batch save/update of Phieu Lien Lac records successful.');
  } catch (error) {
    console.error('[phieuLienLacService] Error committing batch for Phieu Lien Lac records:', error);
    // Log the specific error from batch.commit()
    if ((error as any)?.code === 'permission-denied') {
        console.error(`[phieuLienLacService] PERMISSION DENIED during batch commit. Check Firestore rules for '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to commit Phieu Lien Lac records to Firestore. Check server console for details.');
  }
};


/**
 * Fetches PhieuLienLacRecords for a given class and date from Firestore.
 */
export const getPhieuLienLacRecordsForClassOnDate = async (
  classId: string,
  slipDate: Date
): Promise<PhieuLienLacRecord[]> => {
  const formattedDate = format(slipDate, 'yyyy-MM-dd');
  console.log(`[phieuLienLacService] Fetching Phieu Lien Lac records for class ${classId} on date ${formattedDate}`);

  // This query will require a composite index on classId and date.
  // Firestore will provide a link in the server console if the index is missing.
  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('classId', '==', classId),
    where('date', '==', formattedDate)
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: PhieuLienLacRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        studentId: data.studentId,
        studentName: data.studentName,
        classId: data.classId,
        className: data.className,
        date: data.date,
        testFormat: data.testFormat as PhieuLienLacRecord['testFormat'],
        score: data.score === null ? null : (data.score as number | undefined),
        lessonMasteryText: data.lessonMasteryText,
        homeworkStatus: data.homeworkStatus as PhieuLienLacRecord['homeworkStatus'],
        vocabularyToReview: data.vocabularyToReview,
        remarks: data.remarks,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} Phieu Lien Lac records for class ${classId} on ${formattedDate}.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] Error fetching Phieu Lien Lac records for class ${classId} on ${formattedDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForClassOnDate: Missing index for classId == ${classId} AND date == ${formattedDate}. Check server logs for index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] Permission Denied for getPhieuLienLacRecordsForClassOnDate. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to fetch Phieu Lien Lac records.');
  }
};

/**
 * Fetches all PhieuLienLacRecords for a specific student in a specific class, ordered by date.
 */
export const getPhieuLienLacRecordsForStudentInRange = async (
  studentId: string,
  classId: string
  // startDate?: Date, // Future enhancement
  // endDate?: Date    // Future enhancement
): Promise<PhieuLienLacRecord[]> => {
  console.log(`[phieuLienLacService] Fetching ALL Phieu Lien Lac records for student ${studentId} in class ${classId}`);

  // This query requires a composite index on: studentId (asc), classId (asc), date (asc/desc)
  // Firestore will provide a link in the server console if the index is missing.
  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('studentId', '==', studentId),
    where('classId', '==', classId),
    orderBy('date', 'asc') 
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: PhieuLienLacRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        studentId: data.studentId,
        studentName: data.studentName,
        classId: data.classId,
        className: data.className,
        date: data.date, 
        testFormat: data.testFormat,
        score: data.score === null ? null : (data.score as number | undefined),
        lessonMasteryText: data.lessonMasteryText,
        homeworkStatus: data.homeworkStatus,
        vocabularyToReview: data.vocabularyToReview,
        remarks: data.remarks,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} Phieu Lien Lac records for student ${studentId} in class ${classId}.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] Error fetching Phieu Lien Lac records for student ${studentId} in class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForStudentInRange: Missing index for studentId == ${studentId}, classId == ${classId}, orderBy date. Check YOUR SERVER CONSOLE for a link to create the index.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] Permission Denied for getPhieuLienLacRecordsForStudentInRange. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'. Details in YOUR SERVER CONSOLE.`);
    }
    // It's important to re-throw or handle this appropriately
    // The client-side useQuery will see this error.
    throw new Error('Failed to fetch Phieu Lien Lac records for student. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).');
  }
};

