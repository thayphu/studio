
'use server';

import { db } from '@/lib/firebase';
import type { TestScoreRecord } from '@/lib/types';
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
    const newRecordRef = doc(collection(db, TEST_SCORES_COLLECTION));

    // Ensure score is a number or undefined (to be omitted), never null or NaN for Firestore
    const finalScore = typeof record.score === 'number' && !isNaN(record.score) ? record.score : undefined;

    const recordToSave: Omit<TestScoreRecord, 'id' | 'score' | 'createdAt' | 'updatedAt'> & { score?: number; createdAt: any; updatedAt: any } = {
      studentId: record.studentId,
      studentName: record.studentName || "", // Ensure not undefined
      classId: record.classId,
      className: record.className || "", // Ensure not undefined
      testDate: record.testDate,
      masteredLesson: record.masteredLesson,
      vocabularyToReview: record.vocabularyToReview || "", // Ensure not undefined
      generalRemarks: record.generalRemarks || "", // Ensure not undefined
      homeworkStatus: record.homeworkStatus || "", // Ensure not undefined
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    if (finalScore !== undefined) {
      (recordToSave as TestScoreRecord).score = finalScore;
    }
    
    console.log("[testScoreService] Record to save in batch:", recordToSave);
    batch.set(newRecordRef, recordToSave);
  }

  try {
    await batch.commit();
    console.log(`[testScoreService] Successfully saved ${records.length} test score records.`);
  } catch (error) {
    console.error("[testScoreService] Error saving test scores to Firestore:", error);
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
        testDate: data.testDate, // Already 'yyyy-MM-dd'
        score: data.score, // Will be number or undefined
        masteredLesson: data.masteredLesson || false,
        vocabularyToReview: data.vocabularyToReview || "",
        generalRemarks: data.generalRemarks || "",
        homeworkStatus: data.homeworkStatus || "",
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
