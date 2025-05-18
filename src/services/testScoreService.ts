
'use server';

import { db } from '@/lib/firebase';
import type { TestScoreRecord, TestFormat, HomeworkStatus } from '@/lib/types';
import { collection, addDoc, query, where, getDocs, serverTimestamp, writeBatch, doc, Timestamp } from "firebase/firestore";
import { format } from 'date-fns';

const TEST_SCORES_COLLECTION = "testScores";

/**
 * Saves multiple test score records to Firestore.
 * Ensures 'score' is a number or omitted, and not undefined.
 * @param records An array of TestScoreRecord objects to save.
 */
export const saveTestScores = async (records: TestScoreRecord[]): Promise<void> => {
  if (!records || records.length === 0) {
    console.log("[testScoreService] No records provided to save.");
    return;
  }
  console.log("[testScoreService] Attempting to save test scores to Firestore:", records);

  const batch = writeBatch(db);

  for (const record of records) {
    // Find existing record for this student, class, and date to update, or create new if not found.
    // This simple example always creates new records. For update-or-create, you'd query first.
    // For simplicity now, let's assume each save operation creates a new record or you handle updates by deleting old ones.
    // A more robust solution would be to query for an existing record for studentId, classId, and testDate,
    // then update if found, or add if not.

    // For now, let's assume we are creating new records or that the client handles identifying existing records to update
    // by passing an ID. If no ID, create. If ID, update.
    // The current structure of KiemTraPage will typically overwrite/resave all scores for a given date for a class.
    // So, a simpler approach might be to delete all existing scores for that class/date and then add new ones.
    // However, the current structure creates new records each time without deleting.

    const finalScore = typeof record.score === 'number' && !isNaN(record.score) ? record.score : undefined;

    const recordToSave: Omit<TestScoreRecord, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = {
      studentId: record.studentId,
      studentName: record.studentName || "",
      classId: record.classId,
      className: record.className || "",
      testDate: record.testDate,
      testFormat: record.testFormat || "",
      score: finalScore, // Will be number or undefined
      masteredLesson: record.masteredLesson,
      vocabularyToReview: record.vocabularyToReview || "",
      generalRemarks: record.generalRemarks || "",
      homeworkStatus: record.homeworkStatus || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // If an ID is provided (e.g., editing an existing record), use update. Otherwise, add new.
    // Currently, the page logic doesn't pass an ID for existing records for an update-in-place scenario.
    // It refetches and potentially overwrites or creates new ones if not handled carefully.
    // For now, we'll stick to addDoc as the page currently re-saves all entries for a given class/date.
    const newRecordRef = doc(collection(db, TEST_SCORES_COLLECTION));
    console.log("[testScoreService] Record to save in batch (addDoc):", recordToSave);
    batch.set(newRecordRef, recordToSave);
  }

  try {
    await batch.commit();
    console.log(`[testScoreService] Successfully committed batch of ${records.length} test score records.`);
  } catch (error) {
    console.error("[testScoreService] Error committing batch for test scores:", error);
    throw new Error("Failed to save test scores.");
  }
};

/**
 * Fetches test scores for a given class on a specific date.
 * Converts Firestore Timestamps for createdAt and updatedAt to ISO strings.
 * @param classId The ID of the class.
 *@param date The date for which to fetch scores.
 * @returns A promise that resolves to an array of TestScoreRecord objects.
 */
export const getTestScoresForClassOnDate = async (classId: string, date: Date): Promise<TestScoreRecord[]> => {
  const formattedTestDate = format(date, 'yyyy-MM-dd');
  console.log(`[testScoreService] Fetching test scores for class ${classId} on date ${formattedTestDate}`);
  
  const scoresQuery = query(
    collection(db, TEST_SCORES_COLLECTION),
    where("classId", "==", classId),
    where("testDate", "==", formattedTestDate)
    // Consider adding orderBy if needed, e.g., orderBy("studentName", "asc")
    // This would require a composite index on classId, testDate, studentName.
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
        testDate: data.testDate, // Already 'yyyy-MM-dd'
        testFormat: data.testFormat as TestFormat || "",
        score: data.score, // Will be number or undefined
        masteredLesson: data.masteredLesson || false,
        vocabularyToReview: data.vocabularyToReview || "",
        generalRemarks: data.generalRemarks || "",
        homeworkStatus: data.homeworkStatus as HomeworkStatus || "",
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      };
      // Remove explicitly if undefined after conversion, for cleaner objects if not needed on client
      if (scoreRecord.createdAt === undefined) delete scoreRecord.createdAt;
      if (scoreRecord.updatedAt === undefined) delete scoreRecord.updatedAt;
      return scoreRecord;
    });
    console.log(`[testScoreService] Fetched ${scores.length} scores for class ${classId} on ${formattedTestDate}. Records:`, scores);
    return scores;
  } catch (error) {
    console.error(`[testScoreService] Error fetching test scores for class ${classId} on ${formattedTestDate}:`, error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error(`[testScoreService] Firestore Precondition Failed for getTestScoresForClassOnDate: Missing index for classId == ${classId} AND testDate == ${formattedTestDate}. Check server logs for index creation link.`);
    }
    throw error;
  }
};
