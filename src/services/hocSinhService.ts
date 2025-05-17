
'use server';

import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc as getFirestoreDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HocSinh, LopHoc } from "@/lib/types";

const hocSinhCollectionRef = collection(db, "hocSinh");
const lopHocCollectionRef = collection(db, "lopHoc");

export const getStudents = async (): Promise<HocSinh[]> => {
  console.log("[hocSinhService] Attempting to fetch students and associated class names.");
  let classesData: Record<string, Omit<LopHoc, 'id'>> = {};
  try {
    const classesSnapshot = await getDocs(lopHocCollectionRef);
    classesData = classesSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = doc.data() as Omit<LopHoc, 'id'>;
      return acc;
    }, {} as Record<string, Omit<LopHoc, 'id'>>);
    console.log(`[hocSinhService] Fetched ${classesSnapshot.size} classes for denormalization.`);
  } catch (error) {
    console.error("[hocSinhService] Error fetching classes for student denormalization:", error);
  }

  const studentsQuery = query(hocSinhCollectionRef, orderBy("hoTen", "asc"));
  
  try {
    console.log("[hocSinhService] Executing students query...");
    const querySnapshot = await getDocs(studentsQuery);
    console.log(`[hocSinhService] Fetched ${querySnapshot.size} student documents.`);
    
    const students = querySnapshot.docs.map(docSnapshot => {
      const studentData = docSnapshot.data() as Omit<HocSinh, 'id' | 'tenLop'>;
      const lop = studentData.lopId ? classesData[studentData.lopId] : undefined;
      return {
        id: docSnapshot.id,
        ...studentData,
        tenLop: lop ? lop.tenLop : 'N/A',
      } as HocSinh;
    });
    console.log("[hocSinhService] Successfully processed and returned students.");
    return students;
  } catch (error) {
    console.error("[hocSinhService] Error fetching students from Firestore:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.error("[hocSinhService] Firestore Precondition Failed for getStudents: This often means a required Firestore index is missing. The query 'orderBy(\"hoTen\", \"asc\")' on the 'hocSinh' collection likely needs an index on the 'hoTen' field (ascending). Check server logs for a direct link to create the index in Firebase Console.");
    }
    throw error;
  }
};

export const getStudentById = async (studentId: string): Promise<HocSinh | null> => {
  if (!studentId) {
    console.warn("[hocSinhService] getStudentById called with no studentId.");
    return null;
  }
  console.log(`[hocSinhService] Attempting to fetch student by ID: ${studentId}`);
  const studentDocRef = doc(db, "hocSinh", studentId);
  try {
    const studentDocSnap = await getFirestoreDoc(studentDocRef);
    if (studentDocSnap.exists()) {
      const studentData = studentDocSnap.data() as Omit<HocSinh, 'id' | 'tenLop'>;
      let tenLop = 'N/A';
      if (studentData.lopId) {
        try {
          const classDocRef = doc(db, "lopHoc", studentData.lopId);
          const classDoc = await getFirestoreDoc(classDocRef);
          if (classDoc.exists()) {
            tenLop = (classDoc.data() as LopHoc).tenLop;
          } else {
            console.warn(`[hocSinhService] Class with ID ${studentData.lopId} not found for student ${studentId}.`);
          }
        } catch (error) {
          console.error(`[hocSinhService] Error fetching class name for student ${studentId}:`, error);
        }
      }
      const student: HocSinh = {
        id: studentDocSnap.id,
        ...studentData,
        tenLop: tenLop,
      };
      console.log(`[hocSinhService] Found student:`, student);
      return student;
    } else {
      console.log(`[hocSinhService] No student found with ID: ${studentId}`);
      return null;
    }
  } catch (error) {
    console.error(`[hocSinhService] Error fetching student by ID ${studentId}:`, error);
    throw error;
  }
};


export const getStudentsByClassId = async (classId: string): Promise<HocSinh[]> => {
  if (!classId) {
    console.warn("[hocSinhService] getStudentsByClassId called with no classId.");
    return [];
  }
  console.log(`[hocSinhService] Attempting to fetch students for classId: ${classId}`);
  const studentsQuery = query(hocSinhCollectionRef, where("lopId", "==", classId), orderBy("hoTen", "asc"));
  try {
    const querySnapshot = await getDocs(studentsQuery);
    const students = querySnapshot.docs.map(docSnapshot => {
      const studentData = docSnapshot.data() as Omit<HocSinh, 'id' | 'tenLop'>;
      // tenLop is not strictly needed here as it's for the attendance dialog
      // which primarily lists students of a known class.
      // However, if needed for other contexts, class data fetching could be added.
      return {
        id: docSnapshot.id,
        ...studentData,
        // tenLop: will be populated by the component if needed or by studentData if already denormalized
      } as HocSinh;
    });
    console.log(`[hocSinhService] Fetched ${students.length} students for classId: ${classId}`);
    return students;
  } catch (error) {
    console.error(`[hocSinhService] Error fetching students for classId ${classId}:`, error);
     if ((error as any)?.code === 'failed-precondition') {
        console.error(`[hocSinhService] Firestore Precondition Failed for getStudentsByClassId: Missing index for query on 'hocSinh' collection with 'lopId == ${classId}' and 'orderBy(\"hoTen\", \"asc\")'. Check server logs for index creation link.`);
    }
    throw error;
  }
};

export const addStudent = async (newStudentData: Omit<HocSinh, 'id' | 'tenLop' | 'tinhTrangThanhToan'>, studentId: string): Promise<HocSinh> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  console.log(`[hocSinhService] Adding student with ID: ${studentId}`, newStudentData);
  
  let tenLop = 'N/A';
  if (newStudentData.lopId) {
    try {
      const classDocRef = doc(db, "lopHoc", newStudentData.lopId);
      const classDoc = await getFirestoreDoc(classDocRef);
      if (classDoc.exists()) {
        tenLop = (classDoc.data() as LopHoc).tenLop;
      } else {
        console.warn(`[hocSinhService] Class with ID ${newStudentData.lopId} not found for new student.`);
      }
    } catch (error) {
      console.error(`[hocSinhService] Error fetching class name for new student:`, error);
    }
  }

  const studentData: HocSinh = {
    ...newStudentData,
    id: studentId,
    tenLop: tenLop,
    tinhTrangThanhToan: "Chưa thanh toán",
  };
  try {
    await setDoc(studentDocRef, studentData);
    console.log(`[hocSinhService] Successfully added student with ID: ${studentId}`);
    return studentData;
  } catch (error) {
    console.error(`[hocSinhService] Error adding student ID ${studentId} to Firestore:`, error);
    throw error;
  }
};

export const updateStudent = async (studentId: string, updatedData: Partial<Omit<HocSinh, 'id'>>): Promise<void> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  console.log(`[hocSinhService] Updating student with ID: ${studentId}`, updatedData);
  try {
    await updateDoc(studentDocRef, updatedData);
    console.log(`[hocSinhService] Successfully updated student with ID: ${studentId}`);
  } catch (error) {
    console.error(`[hocSinhService] Error updating student ID ${studentId} in Firestore:`, error);
    throw error;
  }
};

export const deleteStudent = async (studentId: string): Promise<void> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  console.log(`[hocSinhService] Deleting student with ID: ${studentId}`);
  try {
    await deleteDoc(studentDocRef);
    console.log(`[hocSinhService] Successfully deleted student with ID: ${studentId}`);
  } catch (error) {
    console.error(`[hocSinhService] Error deleting student ID ${studentId} from Firestore:`, error);
    throw error;
  }
};
