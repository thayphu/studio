
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

    const q = query(
      collection(db, PHIEU_LIEN_LAC_COLLECTION),
      where('studentId', '==', record.studentId),
      where('classId', '==', record.classId),
      where('date', '==', record.date), // date is YYYY-MM-DD string
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      const dataToSave: Partial<PhieuLienLacRecord> & { studentId: string; classId: string; date: string; updatedAt: any; createdAt?: any } = {
        ...record,
        studentName: record.studentName || '',
        className: record.className || '',
        testFormat: record.testFormat || undefined, // Ensure empty string becomes undefined
        score: record.score === undefined || record.score === null ? null : Number(record.score),
        lessonMasteryText: record.lessonMasteryText || '',
        homeworkStatus: record.homeworkStatus || undefined, // Ensure empty string becomes undefined
        vocabularyToReview: record.vocabularyToReview || '',
        remarks: record.remarks || '',
        updatedAt: serverTimestamp(),
      };
      
      // Remove fields that are empty strings if they are optional, to keep Firestore docs clean
      if (dataToSave.testFormat === "") dataToSave.testFormat = undefined;
      if (dataToSave.homeworkStatus === "") dataToSave.homeworkStatus = undefined;


      console.log(`[phieuLienLacService] Student ${record.studentId}, date ${record.date}, dataToSave before Firestore:`, dataToSave);


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
      console.error(`[phieuLienLacService] Error processing record for student ${record.studentId} on ${record.date}:`, error);
      if ((error as any)?.code === 'failed-precondition' && (error as any)?.message.includes('index')) {
        console.error(`[phieuLienLacService] Firestore Precondition Failed (likely missing index) for query: studentId == ${record.studentId}, classId == ${record.classId}, date == ${record.date}. Check server logs for index creation link.`);
      }
       // Do not re-throw here to allow other records in the batch to be processed if possible.
       // The main mutation's onError will handle the overall failure.
    }
  }

  try {
    await batch.commit();
    console.log('[phieuLienLacService] Batch save/update of Phieu Lien Lac records successful.');
  } catch (error) {
    console.error('[phieuLienLacService] Error committing batch for Phieu Lien Lac records:', error);
    throw new Error('Failed to commit Phieu Lien Lac records to Firestore.');
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
): Promise<PhieuLienLacRecord[]> => {
  console.log(`[phieuLienLacService] Fetching ALL Phieu Lien Lac records for student ${studentId} in class ${classId}`);

  // This query requires a composite index on: studentId (asc), classId (asc), date (asc/desc)
  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('studentId', '==', studentId),
    where('classId', '==', classId),
    orderBy('date', 'asc') // Get records in chronological order
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
        date: data.date, // Should be YYYY-MM-DD string
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
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForStudentInRange: Missing index for studentId == ${studentId}, classId == ${classId}, orderBy date. Check server logs for index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] Permission Denied for getPhieuLienLacRecordsForStudentInRange. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to fetch Phieu Lien Lac records for student.');
  }
};
