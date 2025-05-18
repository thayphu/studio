
'use server';

import { db } from '@/lib/firebase';
import type { TestScoreRecord } from '@/lib/types';
import { collection, addDoc, query, where, getDocs, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { format } from 'date-fns';

const TEST_SCORES_COLLECTION = "testScores";

/**
 * Saves multiple test score records to Firestore.
 * This function will either create new records or update existing ones
 * based on studentId, classId, testDate, and testName.
 * (For now, it's simplified to always add new records for demonstration)
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
    // In a real scenario, you might want to check if a record for this student, class, date, and test name already exists.
    // If it exists, you might update it. If not, create a new one.
    // For simplicity in this initial implementation, we'll just add new records.
    // This could lead to duplicate entries if not handled carefully later.

    const newRecordRef = doc(collection(db, TEST_SCORES_COLLECTION));
    const recordToSave = {
      ...record,
      // Ensure studentName and className are present, even if empty, to avoid Firestore 'undefined' issues if needed later.
      studentName: record.studentName || "",
      className: record.className || "",
      createdAt: serverTimestamp(), // Firestore server-side timestamp
      updatedAt: serverTimestamp(),
    };
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
 * (Placeholder for future implementation)
 * @param classId The ID of the class.
 * @param date The date for which to fetch scores (YYYY-MM-DD format).
 * @returns A promise that resolves to an array of TestScoreRecord objects.
 */
export const getTestScoresForClassOnDate = async (classId: string, date: string): Promise<TestScoreRecord[]> => {
  console.log(`[testScoreService] Fetching test scores for class ${classId} on date ${date} (Not implemented yet, returning mock data)`);
  // TODO: Implement actual Firestore query
  // Example query:
  // const scoresQuery = query(
  //   collection(db, TEST_SCORES_COLLECTION),
  //   where("classId", "==", classId),
  //   where("testDate", "==", date)
  // );
  // const querySnapshot = await getDocs(scoresQuery);
  // const scores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestScoreRecord));
  // return scores;
  return Promise.resolve([]); // Return empty array for now
};

// Other functions like getTestScoresForStudentInRange etc. can be added later for reporting.

