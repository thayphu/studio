
'use server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, Timestamp, serverTimestamp, query, orderBy } from "firebase/firestore";
import type { Quiz, Question } from '@/lib/types';
import { nanoid } from 'nanoid';

const QUIZZES_COLLECTION = 'quizzes';

export const saveQuiz = async (quizData: Omit<Quiz, 'id' | 'createdAt' | 'questions'>, questions: Omit<Question, 'id'>[]): Promise<Quiz> => {
  console.log('[quizService] Attempting to save quiz:', quizData, 'with questions:', questions.length);
  try {
    const questionsWithIds: Question[] = questions.map(q => ({
      ...q,
      id: nanoid(10), // Assign a local unique ID for each question within the quiz
      options: q.options.map(opt => ({...opt, id: opt.id || nanoid(5)})) // Ensure options also have IDs if not provided
    }));

    const newQuizDoc = {
      ...quizData,
      questions: questionsWithIds,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, QUIZZES_COLLECTION), newQuizDoc);
    console.log('[quizService] Quiz saved successfully with ID:', docRef.id);
    
    return {
      id: docRef.id,
      title: quizData.title,
      description: quizData.description,
      questions: questionsWithIds,
      createdAt: new Date().toISOString(), // Placeholder, actual value is server timestamp
    };
  } catch (error) {
    console.error('[quizService] Error saving quiz to Firestore:', error);
    throw new Error('Failed to save quiz.');
  }
};

export const getQuizzes = async (): Promise<Quiz[]> => {
  console.log('[quizService] Fetching all quizzes from Firestore.');
  try {
    const quizzesQuery = query(collection(db, QUIZZES_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(quizzesQuery);
    const quizzes: Quiz[] = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        questions: data.questions as Question[], // Assume questions are stored as an array
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });
    console.log(`[quizService] Fetched ${quizzes.length} quizzes.`);
    return quizzes;
  } catch (error) {
    console.error('[quizService] Error fetching quizzes from Firestore:', error);
    if ((error as any)?.code === 'failed-precondition') {
      console.error(`[quizService] Firestore Precondition Failed for getQuizzes: This usually means a required Firestore index is missing for collection '${QUIZZES_COLLECTION}' ordered by 'createdAt' descending. Check server logs for index creation link.`);
    }
    throw new Error('Failed to fetch quizzes.');
  }
};
