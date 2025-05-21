
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
} from 'firebase/firestore';
import type { PhieuLienLacRecord } from '@/lib/types';
import { format } from 'date-fns';

const PHIEU_LIEN_LAC_COLLECTION = 'phieuLienLacRecords';

export const savePhieuLienLacRecords = async (
  records: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt'>> // periodicSummaryRemark is now part of the base type if provided
): Promise<void> => {
  if (!records || records.length === 0) {
    console.log('[phieuLienLacService] No records to save.');
    return;
  }
  console.log('[phieuLienLacService] Attempting to save/update Phieu Lien Lac records. Count:', records.length);
  console.log('[phieuLienLacService] Sample record data:', records[0] ? {student: records[0].studentId, date: records[0].date, score: records[0].score, testFormat: records[0].testFormat, homework: records[0].homeworkStatus, vocab: records[0].vocabularyToReview, remarks: records[0].remarks, commonVocab: records[0].homeworkAssignmentVocabulary, commonTasks: records[0].homeworkAssignmentTasks } : "No records");

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
      where('date', '==', record.date),
      limit(1)
    );

    try {
      console.log(`[phieuLienLacService] Processing record for student ${record.studentId} on ${record.date}. Querying for existing...`);
      const querySnapshot = await getDocs(q);
      console.log(`[phieuLienLacService] Existing slip querySnapshot size for student ${record.studentId} on ${record.date}: ${querySnapshot.size}`);

      const dataToSave: any = {
        studentId: record.studentId,
        studentName: record.studentName || '',
        classId: record.classId,
        className: record.className || '',
        date: record.date,
        testFormat: record.testFormat || "",
        score: record.score === undefined || record.score === null || String(record.score).trim() === '' ? null : Number(record.score),
        lessonMasteryText: record.lessonMasteryText || '',
        masteredLesson: record.masteredLesson === undefined ? false : record.masteredLesson, // Ensure boolean
        homeworkStatus: record.homeworkStatus || "",
        vocabularyToReview: record.vocabularyToReview || '',
        remarks: record.remarks || '',
        homeworkAssignmentVocabulary: record.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: record.homeworkAssignmentTasks || '',
        updatedAt: serverTimestamp(),
      };
      
      if (record.periodicSummaryRemark !== undefined) {
        dataToSave.periodicSummaryRemark = record.periodicSummaryRemark;
      }


      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        console.log(`[phieuLienLacService] Updating existing Phieu Lien Lac record ${existingDoc.id} for student ${record.studentId} on ${record.date}. Data:`, dataToSave);
        // Preserve existing periodicSummaryRemark if not explicitly being set by this save operation for a daily slip
        const existingData = existingDoc.data();
        if (existingData.periodicSummaryRemark && dataToSave.periodicSummaryRemark === undefined) {
            dataToSave.periodicSummaryRemark = existingData.periodicSummaryRemark;
        }
        batch.update(existingDoc.ref, dataToSave);
      } else {
        const newDocRef = doc(collection(db, PHIEU_LIEN_LAC_COLLECTION));
        dataToSave.createdAt = serverTimestamp();
        console.log(`[phieuLienLacService] Adding new Phieu Lien Lac record for student ${record.studentId} on ${record.date}. Data:`, dataToSave);
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
    throw new Error('Lỗi Firestore: Không thể lưu Phiếu Liên Lạc. Vui lòng KIỂM TRA CONSOLE SERVER (Firebase Studio terminal) để biết lỗi chi tiết (ví dụ: thiếu Index hoặc lỗi Permissions).');
  }
};


export const getPhieuLienLacRecordsForClassOnDate = async (
  classId: string,
  slipDate: Date | null
): Promise<PhieuLienLacRecord[]> => {
  if (!slipDate) {
    console.log('[phieuLienLacService] getPhieuLienLacRecordsForClassOnDate called with null date. Returning empty array.');
    return [];
  }
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
        studentName: data.studentName || '',
        classId: data.classId,
        className: data.className || '',
        date: data.date, 
        testFormat: data.testFormat as PhieuLienLacRecord['testFormat'] || "",
        score: data.score === undefined || data.score === null ? null : Number(data.score),
        lessonMasteryText: data.lessonMasteryText || '',
        masteredLesson: data.masteredLesson === undefined ? false : data.masteredLesson,
        homeworkStatus: data.homeworkStatus as PhieuLienLacRecord['homeworkStatus'] || "",
        vocabularyToReview: data.vocabularyToReview || '',
        remarks: data.remarks || '',
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: data.homeworkAssignmentTasks || '',
        periodicSummaryRemark: data.periodicSummaryRemark || '',
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
    throw new Error('Lỗi Firestore: Không thể tải Phiếu Liên Lạc. Vui lòng KIỂM TRA CONSOLE SERVER (Firebase Studio terminal) để biết lỗi chi tiết (ví dụ: thiếu Index hoặc lỗi Permissions).');
  }
};

export const getAllPhieuLienLacRecordsForClass = async (classId: string): Promise<PhieuLienLacRecord[]> => {
  if (!classId) {
    console.warn('[phieuLienLacService] getAllPhieuLienLacRecordsForClass called with no classId.');
    return [];
  }
  console.log(`[phieuLienLacService] Fetching ALL Phieu Lien Lac records for class ${classId}`);

  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('classId', '==', classId),
    orderBy('date', 'desc') 
  );

  try {
    const querySnapshot = await getDocs(q);
    const records: PhieuLienLacRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        studentId: data.studentId,
        studentName: data.studentName || '',
        classId: data.classId,
        className: data.className || '',
        date: data.date, 
        testFormat: data.testFormat as PhieuLienLacRecord['testFormat'] || "",
        score: data.score === undefined || data.score === null ? null : Number(data.score),
        lessonMasteryText: data.lessonMasteryText || '',
        masteredLesson: data.masteredLesson === undefined ? false : data.masteredLesson,
        homeworkStatus: data.homeworkStatus as PhieuLienLacRecord['homeworkStatus'] || "",
        vocabularyToReview: data.vocabularyToReview || '',
        remarks: data.remarks || '',
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: data.homeworkAssignmentTasks || '',
        periodicSummaryRemark: data.periodicSummaryRemark || '',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} total Phieu Lien Lac records for class ${classId}.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching ALL Phieu Lien Lac records for class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getAllPhieuLienLacRecordsForClass: Missing index for classId == ${classId} AND date descending. Check YOUR SERVER CONSOLE for index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getAllPhieuLienLacRecordsForClass. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Lỗi Firestore: Không thể tải toàn bộ Phiếu Liên Lạc. Vui lòng KIỂM TRA CONSOLE SERVER (Firebase Studio terminal) để biết lỗi chi tiết (ví dụ: thiếu Index hoặc lỗi Permissions).');
  }
};


export const getPhieuLienLacRecordsForStudentInRange = async (
  studentId: string,
  classId: string,
  startDate?: string, 
  endDate?: string    
): Promise<PhieuLienLacRecord[]> => {
  console.log(`[phieuLienLacService] Fetching Phieu Lien Lac records for student ${studentId} in class ${classId}. Range: ${startDate || 'any'} to ${endDate || 'any'}`);

  let qConstraints: any[] = [
    where('studentId', '==', studentId),
    where('classId', '==', classId)
  ];

  if (startDate) {
    qConstraints.push(where('date', '>=', startDate));
  }
  if (endDate) {
    qConstraints.push(where('date', '<=', endDate));
  }
  
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
        studentName: data.studentName || '',
        classId: data.classId,
        className: data.className || '',
        date: data.date, 
        testFormat: data.testFormat as PhieuLienLacRecord['testFormat'] || "",
        score: data.score === undefined || data.score === null ? null : Number(data.score),
        lessonMasteryText: data.lessonMasteryText || '',
        masteredLesson: data.masteredLesson === undefined ? false : data.masteredLesson,
        homeworkStatus: data.homeworkStatus as PhieuLienLacRecord['homeworkStatus'] || "",
        vocabularyToReview: data.vocabularyToReview || '',
        remarks: data.remarks || '',
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: data.homeworkAssignmentTasks || '',
        periodicSummaryRemark: data.periodicSummaryRemark || '',
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    console.log(`[phieuLienLacService] Fetched ${records.length} Phieu Lien Lac records for student ${studentId} in class ${classId} for the given range.`);
    return records;
  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching Phieu Lien Lac records for student ${studentId} in class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      let indexFields = `studentId (ASC), classId (ASC), date (ASC)`;
      if(startDate) indexFields += `, date (>=)`; 
      if(endDate) indexFields += `, date (<=)`; 
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getPhieuLienLacRecordsForStudentInRange: This usually means a required Firestore index is missing. Query might need index on ${indexFields}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for a link to create the index.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getPhieuLienLacRecordsForStudentInRange. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Lỗi Firestore: Không thể tải Phiếu Liên Lạc của học sinh. Vui lòng KIỂM TRA CONSOLE SERVER (Firebase Studio terminal) để biết lỗi chi tiết (ví dụ: thiếu Index hoặc lỗi Permissions).');
  }
};

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

export const getAllSlipsWithPeriodicRemarksForClass = async (classId: string): Promise<PhieuLienLacRecord[]> => {
  if (!classId) {
    console.warn('[phieuLienLacService] getAllSlipsWithPeriodicRemarksForClass called with no classId.');
    return [];
  }
  console.log(`[phieuLienLacService] Fetching slips with periodic remarks for class ${classId}`);

  // Temporary simplified query for debugging index/permission issues.
  // Original query:
  // const q = query(
  //   collection(db, PHIEU_LIEN_LAC_COLLECTION),
  //   where('classId', '==', classId),
  //   where('periodicSummaryRemark', '!=', "") 
  // );
  console.log(`[phieuLienLacService] DEBUG: Using simplified query for getAllSlipsWithPeriodicRemarksForClass (only filtering by classId). Will filter periodicSummaryRemark on client.`);
  const q = query(
    collection(db, PHIEU_LIEN_LAC_COLLECTION),
    where('classId', '==', classId),
    orderBy('date', 'desc') // Added orderBy to make the query more specific, might require an index on classId and date
  );

  try {
    const querySnapshot = await getDocs(q);
    let records: PhieuLienLacRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        studentId: data.studentId,
        studentName: data.studentName || '',
        classId: data.classId,
        className: data.className || '',
        date: data.date, 
        testFormat: data.testFormat as PhieuLienLacRecord['testFormat'] || "",
        score: data.score === undefined || data.score === null ? null : Number(data.score),
        lessonMasteryText: data.lessonMasteryText || '',
        masteredLesson: data.masteredLesson === undefined ? false : data.masteredLesson,
        homeworkStatus: data.homeworkStatus as PhieuLienLacRecord['homeworkStatus'] || "",
        vocabularyToReview: data.vocabularyToReview || '',
        remarks: data.remarks || '',
        homeworkAssignmentVocabulary: data.homeworkAssignmentVocabulary || '',
        homeworkAssignmentTasks: data.homeworkAssignmentTasks || '',
        periodicSummaryRemark: data.periodicSummaryRemark || "", 
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
    });
    
    // Client-side filter (temporary for debugging the query without the periodicSummaryRemark filter)
    records = records.filter(r => r.periodicSummaryRemark && r.periodicSummaryRemark.trim() !== "");
    
    if(records.length > 0){
        console.log(`[phieuLienLacService] DEBUG: Simplified query returned ${querySnapshot.size} records for class ${classId}. Of these, ${records.length} matched client-side filter 'periodicSummaryRemark != ""'.`);
    } else if (querySnapshot.size > 0 && records.length === 0) {
        console.log(`[phieuLienLacService] DEBUG: Simplified query returned ${querySnapshot.size} records for class ${classId}, but 0 matched client-side filter 'periodicSummaryRemark != ""'.`);
    } else {
        console.log(`[phieuLienLacService] DEBUG: Simplified query returned 0 records for class ${classId}.`);
    }
    
    console.log(`[phieuLienLacService] Fetched and client-filtered ${records.length} slips with periodic remarks for class ${classId}.`);
    return records;

  } catch (error) {
    console.error(`[phieuLienLacService] CRITICAL_FIREBASE_ERROR when fetching slips with periodic remarks for class ${classId}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
      // If the simplified query (with orderBy date) fails, this index is needed.
      // If the original query (with periodicSummaryRemark != "") fails, that's a different index.
      console.error(`[phieuLienLacService] Firestore Precondition Failed for getAllSlipsWithPeriodicRemarksForClass: Missing index. Query might need index on classId (ASC) and date (DESC), OR classId (ASC) and periodicSummaryRemark (ASC). Check YOUR SERVER CONSOLE (Firebase Studio terminal) for the exact index creation link.`);
    } else if ((error as any)?.code === 'permission-denied') {
       console.error(`[phieuLienLacService] PERMISSION_DENIED for getAllSlipsWithPeriodicRemarksForClass. Check Firestore Security Rules for collection '${PHIEU_LIEN_LAC_COLLECTION}'.`);
    }
    throw new Error('Lỗi Firestore: Không thể tải lịch sử nhận xét chu kỳ. Vui lòng KIỂM TRA CONSOLE SERVER (Firebase Studio terminal) để biết lỗi chi tiết (ví dụ: thiếu Index hoặc lỗi Permissions).');
  }
};
      
