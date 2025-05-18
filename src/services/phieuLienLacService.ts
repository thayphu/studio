
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
import type { PhieuLienLacRecord, StudentSlipInput } from '@/lib/types';
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
  console.log('[phieuLienLacService] Attempting to save/update Phieu Lien Lac records:', records);

  const batch = writeBatch(db);

  for (const record of records) {
    if (!record.studentId || !record.classId || !record.date) {
      console.warn('[phieuLienLacService] Skipping record due to missing studentId, classId, or date:', record);
      continue;
    }

    // Query for existing record for this student, class, and date
    const q = query(
      collection(db, PHIEU_LIEN_LAC_COLLECTION),
      where('studentId', '==', record.studentId),
      where('classId', '==', record.classId),
      where('date', '==', record.date),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      const dataToSave = {
        ...record,
        studentName: record.studentName || '',
        className: record.className || '',
        testFormat: record.testFormat || '',
        score: record.score === undefined || record.score === null ? null : Number(record.score),
        lessonMasteryText: record.lessonMasteryText || '',
        homeworkStatus: record.homeworkStatus || '',
        vocabularyToReview: record.vocabularyToReview || '',
        remarks: record.remarks || '',
        updatedAt: serverTimestamp(),
      };

      if (!querySnapshot.empty) {
        // Update existing record
        const existingDoc = querySnapshot.docs[0];
        batch.update(existingDoc.ref, dataToSave);
        console.log(`[phieuLienLacService] Updating existing Phieu Lien Lac record for student ${record.studentId} on ${record.date}`);
      } else {
        // Add new record
        const newDocRef = doc(collection(db, PHIEU_LIEN_LAC_COLLECTION));
        batch.set(newDocRef, { ...dataToSave, createdAt: serverTimestamp() });
        console.log(`[phieuLienLacService] Adding new Phieu Lien Lac record for student ${record.studentId} on ${record.date}`);
      }
    } catch (error) {
      console.error(`[phieuLienLacService] Error processing record for student ${record.studentId} on ${record.date}:`, error);
      // Potentially re-throw or handle more gracefully depending on requirements
      // For now, we log and continue the batch for other records.
      if ((error as any)?.code === 'failed-precondition' && (error as any)?.message.includes('index')) {
        console.error(`[phieuLienLacService] Firestore Precondition Failed (likely missing index) for query: studentId == ${record.studentId}, classId == ${record.classId}, date == ${record.date}. Check server logs for index creation link.`);
      }
    }
  }

  try {
    await batch.commit();
    console.log('[phieuLienLacService] Batch save/update of Phieu Lien Lac records successful.');
  } catch (error) {
    console.error('[phieuLienLacService] Error committing batch for Phieu Lien Lac records:', error);
    throw new Error('Failed to save Phieu Lien Lac records.');
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
    // Consider orderBy studentName if needed, but requires an additional index field or composite index
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: PhieuLienLacRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData; // Firestore data
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
    }
    throw new Error('Failed to fetch Phieu Lien Lac records.');
  }
};
