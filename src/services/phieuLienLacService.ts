
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
  updateDoc,
  // startAt, // Not currently used but could be for pagination
  // endAt // Not currently used but could be for pagination
} from 'firebase/firestore';
import type { PhieuLienLacRecord, StudentSlipInput } from '@/lib/types';
import { format, parseISO } from 'date-fns';

const PHIEU_LIEN_LAC_COLLECTION = 'phieuLienLacRecords';

/**
 * Saves or updates PhieuLienLacRecords to Firestore.
 * It performs an "upsert" operation: updates if a record exists for the student/class/date, otherwise inserts a new one.
 */
export const savePhieuLienLacRecords = async (
  records: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>>
): Promise<void> => {
  if (!records || records.length === 0) {
    console.log('[phieuLienLacService] No records to save.');
    return;
  }
  console.log('[phieuLienLacService] Attempting to save/update Phieu Lien Lac records. Count:', records.length);
  // console.log('[phieuLienLacService] Sample record data:', records[0] ? {student: records[0].studentId, date: records[0].date, score: records[0].score, testFormat: records[0].testFormat, homework: records[0].homeworkStatus, vocab: records[0].vocabularyToReview, remarks: records[0].remarks, commonVocab: records[0].homeworkAssignmentVocabulary, commonTasks: records[0].homeworkAssignmentTasks } : "No records");


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
      where('date', '==', record.date), // Ensure date is in YYYY-MM-DD format
      limit(1)
    );

    try {
      // console.log(`[phieuLienLacService] Processing record for student ${record.studentId} on ${record.date}. Querying for existing...`);
      const querySnapshot = await getDocs(q);
      // console.log(`[phieuLienLacService] Existing slip querySnapshot size for student ${record.studentId} on ${record.date}: ${querySnapshot.size}`);

      const dataToSave: any = { // Use 'any' temporarily for flexible field assignment
        studentId: record.studentId,
        studentName: record.studentName || '',
        classId: record.classId,
        className: record.className || '',
        date: record.date, // Should be YYYY-MM-DD format
        testFormat: record.testFormat || "", // Store empty string if undefined
        score: record.score === undefined || record.score === null ? null : Number(record.score),
        lessonMasteryText: record.lessonMasteryText || '',
        homeworkStatus: record.homeworkStatus || "", // Store empty string if undefined
        vocabularyToReview: record.vocabularyToReview || '',
        remarks: record.remarks || '',
        homeworkAssignmentVocabulary: record.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: record.homeworkAssignmentTasks || '',
        updatedAt: serverTimestamp(),
      };
      
      // Ensure undefined optional fields are not sent or are converted to null/empty string
      if (dataToSave.testFormat === undefined) dataToSave.testFormat = "";
      if (dataToSave.homeworkStatus === undefined) dataToSave.homeworkStatus = "";
      if (dataToSave.score === undefined) dataToSave.score = null; // Firestore handles null for numbers

      // console.log(`[phieuLienLacService] Data to save for student ${record.studentId} on ${record.date}:`, JSON.parse(JSON.stringify(dataToSave)));


      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        // console.log(`[phieuLienLacService] Updating existing Phieu Lien Lac record ${existingDoc.id} for student ${record.studentId} on ${record.date}`);
        const existingData = existingDoc.data();
        // Preserve periodicSummaryRemark if it exists and not explicitly being cleared
        if (existingData.periodicSummaryRemark && dataToSave.periodicSummaryRemark === undefined) {
            dataToSave.periodicSummaryRemark = existingData.periodicSummaryRemark;
        }
        batch.update(existingDoc.ref, dataToSave);
      } else {
        const newDocRef = doc(collection(db, PHIEU_LIEN_LAC_COLLECTION));
        dataToSave.createdAt = serverTimestamp();
        // console.log(`[phieuLienLacService] Adding new Phieu Lien Lac record for student ${record.studentId} on ${record.date}`);
        batch.set(newDocRef, dataToSave);
      }
    } catch (error) {
      console.error(`[phieuLienLacService] Error processing record for student ${record.studentId} on ${record.date}:`, error);
      if ((error as any)?.code === 'failed-precondition' && (error as any)?.message.includes('index')) {
        console.error(`[phieuLienLacService] Firestore Precondition Failed (likely missing index) for query: studentId == ${record.studentId}, classId == ${record.classId}, date == ${record.date}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for index creation link.`);
      } else if ((error as any)?.code === 'permission-denied') {
         console.error(`[phieuLienLacService] PERMISSION_DENIED while processing record for student ${record.studentId}. Check Firestore Security Rules for '${PHIEU_LIEN_LAC_COLLECTION}'.`);
      }
    }
  }

  try {
    await batch.commit();
    console.log('[phieuLienLacService] Batch save/update of Phieu Lien Lac records successful.');
  } catch (error) {
    console.error('[phieuLienLacService] Error committing batch for Phieu Lien Lac records:', error);
    if ((error as any)?.code === 'permission-denied') {
        console.error(`[phieuLienLacService] PERMISSION_DENIED during batch commit. Check Firestore Security Rules for '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to commit Phieu Lien Lac records to Firestore. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).');
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
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary,
        homeworkAssignmentTasks: data.homeworkAssignmentTasks,
        periodicSummaryRemark: data.periodicSummaryRemark,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} Phieu Lien Lac records for class ${classId} on ${formattedDate}.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching Phieu Lien Lac records for class ${classId} on ${formattedDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForClassOnDate: Missing index for classId == ${classId} AND date == ${formattedDate}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getPhieuLienLacRecordsForClassOnDate. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to fetch Phieu Lien Lac records.');
  }
};

/**
 * Fetches all PhieuLienLacRecords for a specific student in a specific class, optionally within a date range.
 */
export const getPhieuLienLacRecordsForStudentInRange = async (
  studentId: string,
  classId: string,
  startDate?: string, // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
): Promise<PhieuLienLacRecord[]> => {
  console.log(`[phieuLienLacService] Fetching Phieu Lien Lac records for student ${studentId} in class ${classId}. Range: ${startDate || 'any'} to ${endDate || 'any'}`);

  let qConstraints: any[] = [ // Use 'any[]' to allow conditional pushing of where/orderBy
    where('studentId', '==', studentId),
    where('classId', '==', classId)
  ];

  if (startDate) {
    qConstraints.push(where('date', '>=', startDate));
  }
  if (endDate) {
    qConstraints.push(where('date', '<=', endDate));
  }
  
  // Add orderBy('date', 'asc') only if no other orderBy is present or if it's compatible
  // For simplicity, assuming 'date' is the primary sort. If other sorts are needed, this needs adjustment.
  qConstraints.push(orderBy('date', 'asc'));


  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    ...qConstraints
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
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary,
        homeworkAssignmentTasks: data.homeworkAssignmentTasks,
        periodicSummaryRemark: data.periodicSummaryRemark,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} Phieu Lien Lac records for student ${studentId} in class ${classId} for the given range.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching Phieu Lien Lac records for student ${studentId} in class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      let indexFields = "studentId (ASC), classId (ASC), date (ASC)";
      // More specific index suggestions can be complex to generate without knowing exact query patterns.
      // The Firebase error message in the server console is the most reliable source for the exact index needed.
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForStudentInRange: This usually means a required Firestore index is missing. Query might need index on ${indexFields}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for a link to create the index.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getPhieuLienLacRecordsForStudentInRange. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    // It's important to re-throw or handle this appropriately
    // The client-side useQuery will see this error.
    throw new Error('Failed to fetch Phieu Lien Lac records for student. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).');
  }
};

/**
 * Updates the periodicSummaryRemark for a specific PhieuLienLacRecord.
 */
export const updatePeriodicSummaryForSlip = async (slipId: string, summaryRemark: string): Promise<void> => {
  if (!slipId) {
    console.error("[phieuLienLacService] updatePeriodicSummaryForSlip: slipId is required.");
    throw new Error("Slip ID is required to update summary remark.");
  }
  console.log(`[phieuLienLacService] Updating periodicSummaryRemark for slipId ${slipId}. New remark length: ${summaryRemark.length}`);
  const slipDocRef = doc(db, PHIEU_LIEN_LAC_COLLECTION, slipId);
  try {
    await updateDoc(slipDocRef, {
      periodicSummaryRemark: summaryRemark,
      updatedAt: serverTimestamp()
    });
    console.log(`[phieuLienLacService] Successfully updated periodicSummaryRemark for slipId ${slipId}.`);
  } catch (error) {
    console.error(`[phieuLienLacService] Error updating periodicSummaryRemark for slipId ${slipId}:`, error);
    if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for updatePeriodicSummaryForSlip on slipId ${slipId}. Check Firestore Security Rules.`);
    }
    throw new Error("Failed to update periodic summary remark.");
  }
};

/**
 * Fetches all PhieuLienLacRecords for a specific class that have a non-empty periodicSummaryRemark.
 */
export const getAllSlipsWithPeriodicRemarksForClass = async (classId: string): Promise<PhieuLienLacRecord[]> => {
  if (!classId) {
    console.warn('[phieuLienLacService] getAllSlipsWithPeriodicRemarksForClass called with no classId.');
    return [];
  }
  console.log(`[phieuLienLacService] Fetching slips with periodic remarks for class ${classId}`);

  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('classId', '==', classId),
    where('periodicSummaryRemark', '!=', "") 
    // No orderBy here, but Firestore might still require an index for the two where clauses.
    // If you need ordering (e.g., by date), add orderBy('date', 'desc') and a corresponding composite index.
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
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary,
        homeworkAssignmentTasks: data.homeworkAssignmentTasks,
        periodicSummaryRemark: data.periodicSummaryRemark,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} slips with periodic remarks for class ${classId}.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching slips with periodic remarks for class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getAllSlipsWithPeriodicRemarksForClass: Missing index for classId == ${classId} AND periodicSummaryRemark != "". Check YOUR SERVER CONSOLE (Firebase Studio terminal) for index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getAllSlipsWithPeriodicRemarksForClass. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Failed to fetch slips with periodic remarks. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).');
  }
};
