
'use server';

import { db } from '@/lib/firebase';
import type { TestScoreRecord, TestFormat, HomeworkStatus } from '@/lib/types';
import { collection, query, where, getDocs, serverTimestamp, writeBatch, doc, Timestamp, setDoc } from "firebase/firestore"; // Added setDoc
import { format } from 'date-fns';

const TEST_SCORES_COLLECTION = "testScores";

/**
 * Saves or updates multiple test score records in Firestore.
 * If a record for a student, class, and date already exists, it's updated.
 * Otherwise, a new record is created.
 * @param records An array of TestScoreRecord objects to save/update.
 */
export const saveTestScores = async (records: TestScoreRecord[]): Promise<void> => {
  if (!records || records.length === 0) {
    console.log("[testScoreService] No records provided to save.");
    return;
  }
  console.log("[testScoreService] Attempting to save/update test scores to Firestore:", records);

  const batch = writeBatch(db);

  for (const record of records) {
    const finalScore = typeof record.score === 'number' && !isNaN(record.score) ? record.score : undefined;
    
    // Prepare the data to be saved, ensuring no undefined values for optional fields that Firestore doesn't like directly
    const recordDataToSave: Omit<TestScoreRecord, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: any, createdAt?: any } = {
      studentId: record.studentId,
      studentName: record.studentName || "",
      classId: record.classId,
      className: record.className || "",
      testDate: record.testDate,
      testFormat: record.testFormat || "",
      score: finalScore, // This is fine as undefined, Firestore will omit it if so.
      masteredLesson: record.masteredLesson,
      vocabularyToReview: record.vocabularyToReview || "",
      generalRemarks: record.generalRemarks || "",
      homeworkStatus: record.homeworkStatus || "", // Empty string is fine
      updatedAt: serverTimestamp(),
    };

    // Query for an existing document for this student, class, and date
    const existingScoreQuery = query(
      collection(db, TEST_SCORES_COLLECTION),
      where("studentId", "==", record.studentId),
      where("classId", "==", record.classId),
      where("testDate", "==", record.testDate)
    );

    try {
      const querySnapshot = await getDocs(existingScoreQuery);
      if (!querySnapshot.empty) {
        // Update existing record(s) - should ideally be only one, but loop to be safe
        querySnapshot.forEach(docSnapshot => {
          console.log(`[testScoreService] Updating existing score record ${docSnapshot.id} for student ${record.studentId}`);
          const docRef = doc(db, TEST_SCORES_COLLECTION, docSnapshot.id);
          batch.set(docRef, recordDataToSave, { merge: true }); // Use set with merge to update fields, will not add createdAt again
        });
      } else {
        // Add new record
        console.log(`[testScoreService] Adding new score record for student ${record.studentId}`);
        const newRecordRef = doc(collection(db, TEST_SCORES_COLLECTION)); // Generate a new doc ref
        // Add createdAt only for new records
        batch.set(newRecordRef, { ...recordDataToSave, createdAt: serverTimestamp() });
      }
    } catch (queryError) {
      console.error(`[testScoreService] Error querying for existing score for student ${record.studentId}:`, queryError);
      // This might indicate missing indexes. Firestore might throw an error with a link.
      // Fallback to creating a new record, though this might lead to duplicates if the query fails due to temporary issues and not missing index.
      // For a more robust solution, handle queryError specifically if it's due to missing index.
      const newRecordRefOnError = doc(collection(db, TEST_SCORES_COLLECTION));
      console.warn(`[testScoreService] Fallback: Adding new score record for student ${record.studentId} due to query error.`);
      batch.set(newRecordRefOnError, { ...recordDataToSave, createdAt: serverTimestamp() });
    }
  }

  try {
    await batch.commit();
    console.log(`[testScoreService] Successfully committed batch of ${records.length} test score records (upsert logic).`);
  } catch (error) {
    console.error("[testScoreService] Error committing batch for test scores (upsert logic):", error);
    throw new Error("Failed to save test scores.");
  }
};

/**
 * Fetches test scores for a given class on a specific date.
 * Converts Firestore Timestamps for createdAt and updatedAt to ISO strings.
 * @param classId The ID of the class.
 * @param date The date for which to fetch scores.
 * @returns A promise that resolves to an array of TestScoreRecord objects.
 */
export const getTestScoresForClassOnDate = async (classId: string, date: Date): Promise<TestScoreRecord[]> => {
  const formattedTestDate = format(date, 'yyyy-MM-dd');
  console.log(`[testScoreService] Fetching test scores for class ${classId} on date ${formattedTestDate}`);
  
  const scoresQuery = query(
    collection(db, TEST_SCORES_COLLECTION),
    where("classId", "==", classId),
    where("testDate", "==", formattedTestDate)
  );

  try {
    const querySnapshot = await getDocs(scoresQuery);
    const scores = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const scoreRecord: TestScoreRecord = { 
        id: docSnap.id, 
        studentId: data.studentId,
        studentName: data.studentName || "",
        classId: data.classId,
        className: data.className || "",
        testDate: data.testDate, 
        testFormat: data.testFormat as TestFormat || "",
        score: data.score, 
        masteredLesson: data.masteredLesson || false,
        vocabularyToReview: data.vocabularyToReview || "",
        generalRemarks: data.generalRemarks || "",
        homeworkStatus: data.homeworkStatus as HomeworkStatus || "",
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
      return scoreRecord;
    });
    console.log(`[testScoreService] Fetched ${scores.length} scores for class ${classId} on ${formattedTestDate}.`);
    return scores;
  } catch (error) {
    console.error(`[testScoreService] Error fetching test scores for class ${classId} on ${formattedTestDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[testScoreService] Firestore Precondition Failed for getTestScoresForClassOnDate: Missing index for classId == ${classId} AND testDate == ${formattedTestDate}. Check server logs for index creation link.`);
    }
    throw error;
  }
};
