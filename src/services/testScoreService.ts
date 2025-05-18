
'use server';

import { db } from '@/lib/firebase';
import type { TestScoreRecord, TestFormat, HomeworkStatus } from '@/lib/types';
import { collection, query, where, getDocs, serverTimestamp, writeBatch, doc, Timestamp, setDoc, FieldValue } from "firebase/firestore";
import { format } from 'date-fns';

const TEST_SCORES_COLLECTION = "testScores";

export const saveTestScores = async (records: TestScoreRecord[]): Promise<void> => {
  if (!records || records.length === 0) {
    console.log("[testScoreService] No records provided to save.");
    return;
  }
  console.log("[testScoreService] Attempting to save/update test scores to Firestore. Records received:", JSON.parse(JSON.stringify(records)));

  const batch = writeBatch(db);

  for (const record of records) {
    // Prepare the data for Firestore. Ensure optional fields are handled correctly.
    // Firestore does not accept 'undefined'. Use 'null' or omit the field.
    const dataForFirestore: any = {
      studentId: record.studentId,
      classId: record.classId,
      testDate: record.testDate, // Should be 'yyyy-MM-dd' string
      testFormat: record.testFormat || "",
      masteredLesson: record.masteredLesson || false, // Default to false if undefined
      vocabularyToReview: record.vocabularyToReview || "",
      generalRemarks: record.generalRemarks || "",
      homeworkStatus: record.homeworkStatus || "",
      updatedAt: serverTimestamp(),
    };

    // Handle optional fields like studentName and className
    if (record.studentName) dataForFirestore.studentName = record.studentName;
    if (record.className) dataForFirestore.className = record.className;
    
    // Handle the score field: it can be a number or null.
    // If record.score is undefined (should not happen from client logic), it will be omitted.
    // If record.score is null (explicitly cleared), it will be saved as null.
    if (record.score !== undefined) {
        dataForFirestore.score = record.score; // This will be number or null from client
    }


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
        const docSnapshot = querySnapshot.docs[0]; // Assuming only one record per student/class/date
        console.log(`[testScoreService] Updating existing score record ${docSnapshot.id} for student ${record.studentId} with data:`, JSON.parse(JSON.stringify(dataForFirestore)));
        batch.set(doc(db, TEST_SCORES_COLLECTION, docSnapshot.id), dataForFirestore, { merge: true });
      } else {
        console.log(`[testScoreService] Adding new score record for student ${record.studentId} with data:`, JSON.parse(JSON.stringify(dataForFirestore)));
        const newRecordRef = doc(collection(db, TEST_SCORES_COLLECTION));
        batch.set(newRecordRef, { ...dataForFirestore, createdAt: serverTimestamp() });
      }
    } catch (queryError) {
      console.error(`[testScoreService] Error querying/preparing batch for student ${record.studentId}:`, queryError);
      // Rethrow to be caught by the mutation's onError
      throw new Error(`Failed to query or prepare data for student ${record.studentId}: ${(queryError as Error).message}`);
    }
  }

  try {
    await batch.commit();
    console.log(`[testScoreService] Successfully committed batch of ${records.length} test score records.`);
  } catch (error) {
    console.error("[testScoreService] Error committing batch for test scores:", error);
    throw new Error(`Failed to save test scores to Firestore: ${(error as Error).message}`);
  }
};


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
      // Ensure 'score' is number or null, default to null if missing or not a number
      let processedScore: number | null = null;
      if (data.score !== undefined && data.score !== null && !isNaN(Number(data.score))) {
        processedScore = Number(data.score);
      }

      const scoreRecord: TestScoreRecord = { 
        id: docSnap.id, 
        studentId: data.studentId,
        studentName: data.studentName || "",
        classId: data.classId,
        className: data.className || "",
        testDate: data.testDate, 
        testFormat: data.testFormat as TestFormat || "",
        score: processedScore, 
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
