
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, Timestamp, DocumentData } from 'firebase/firestore';
import type { TestScoreRecord } from '@/lib/types';

const TEST_SCORES_COLLECTION = 'testScores';

/**
 * Fetches all test score records from Firestore.
 */
export const getAllTestScores = async (): Promise<TestScoreRecord[]> => {
  console.log(`[testScoreService] Fetching all test scores from Firestore collection: ${TEST_SCORES_COLLECTION}`);
  try {
    const querySnapshot = await getDocs(collection(db, TEST_SCORES_COLLECTION));
    const records: TestScoreRecord[] = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as DocumentData;
      return {
        id: docSnap.id,
        studentId: data.studentId,
        classId: data.classId,
        testDate: data.testDate, // Assuming testDate is stored as YYYY-MM-DD string
        score: data.score === undefined || data.score === null ? null : Number(data.score),
        // other fields from TestScoreRecord if they exist in Firestore
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : undefined,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : undefined,
      } as TestScoreRecord;
    });
    console.log(`[testScoreService] Fetched ${records.length} total test score records.`);
    return records;
  } catch (error) {
    console.error(`[testScoreService] CRITICAL_FIREBASE_ERROR when fetching all test scores:`, error);
    if ((error as any)?.code === 'permission-denied') {
       console.error(`[testScoreService] PERMISSION_DENIED for getAllTestScores. Check Firestore Security Rules for collection '${TEST_SCORES_COLLECTION}'.`);
    }
    // It's important to re-throw or handle this appropriately
    // The client-side useQuery will see this error.
    throw new Error('Failed to fetch all test scores. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).');
  }
};

// Keep other functions from the old testScoreService.ts if they are still relevant or might be reused.
// For now, only getAllTestScores is strictly needed for the basic ranking page.
// If saveTestScores and getTestScoresForClassOnDate are needed for data entry for ranking,
// they would need to be restored/re-implemented here.
// Since the "Kiểm Tra" tab was removed, I'm assuming we only need to read existing scores for ranking.
