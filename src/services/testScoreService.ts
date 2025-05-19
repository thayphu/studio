
'use server';
import { db } from '@/lib/firebase';
import { collection, getDocs, Timestamp, DocumentData } from 'firebase/firestore';
import type { PhieuLienLacRecord, TestScoreRecord } from '@/lib/types'; // Import PhieuLienLacRecord

const PHIEU_LIEN_LAC_COLLECTION = 'phieuLienLacRecords';

/**
 * Fetches all test score relevant data from phieuLienLacRecords for ranking.
 * It extracts studentId, classId, and score.
 */
export const getAllTestScores = async (): Promise<TestScoreRecord[]> => {
  console.log(`[testScoreService] Fetching all scores from Firestore collection: ${PHIEU_LIEN_LAC_COLLECTION} for ranking`);
  try {
    const querySnapshot = await getDocs(collection(db, PHIEU_LIEN_LAC_COLLECTION));
    const records: TestScoreRecord[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as PhieuLienLacRecord; // Cast to PhieuLienLacRecord
      
      // Ensure score is a valid number, otherwise treat as 0 for ranking purposes
      const score = (typeof data.score === 'number' && !isNaN(data.score)) ? data.score : 0;

      if (data.studentId) { // Only include records with a studentId
        records.push({
          id: docSnap.id, // Keep the original document ID
          studentId: data.studentId,
          classId: data.classId || '', // Ensure classId is a string, even if undefined in source
          score: score,
          // testDate is not strictly needed for current ranking logic (sum of all scores)
          // but can be kept if TestScoreRecord type requires it.
          testDate: data.date, // Assuming 'date' field in PhieuLienLacRecord is YYYY-MM-DD
          // Other fields from TestScoreRecord like testName, masteredLesson etc.
          // are not present in PhieuLienLacRecord or not relevant for simple score summing.
        });
      }
    });

    console.log(`[testScoreService] Fetched and processed ${records.length} score entries from ${PHIEU_LIEN_LAC_COLLECTION}.`);
    return records;
  } catch (error) {
    console.error(`[testScoreService] CRITICAL_FIREBASE_ERROR when fetching scores from ${PHIEU_LIEN_LAC_COLLECTION}:`, error);
    if ((error as any)?.code === 'permission-denied') {
       console.error(`[testScoreService] PERMISSION_DENIED for getAllTestScores on ${PHIEU_LIEN_LAC_COLLECTION}. Check Firestore Security Rules.`);
    }
    // It's important to re-throw or handle this appropriately
    // The client-side useQuery will see this error.
    throw new Error(`Failed to fetch scores from ${PHIEU_LIEN_LAC_COLLECTION}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).`);
  }
};
