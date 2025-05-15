
'use server';

import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc as getFirestoreDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { HocSinh, LopHoc } from "@/lib/types";

const hocSinhCollectionRef = collection(db, "hocSinh");
const lopHocCollectionRef = collection(db, "lopHoc");

export const getStudents = async (): Promise<HocSinh[]> => {
  const classesSnapshot = await getDocs(lopHocCollectionRef);
  const classesData = classesSnapshot.docs.reduce((acc, doc) => {
    acc[doc.id] = doc.data() as Omit<LopHoc, 'id'>;
    return acc;
  }, {} as Record<string, Omit<LopHoc, 'id'>>);

  const studentsQuery = query(hocSinhCollectionRef, orderBy("hoTen", "asc"));
  const querySnapshot = await getDocs(studentsQuery);
  
  const students = querySnapshot.docs.map(docSnapshot => {
    const studentData = docSnapshot.data() as Omit<HocSinh, 'id' | 'tenLop'>;
    const lop = studentData.lopId ? classesData[studentData.lopId] : undefined;
    return {
      id: docSnapshot.id,
      ...studentData,
      tenLop: lop ? lop.tenLop : 'N/A',
    } as HocSinh;
  });
  return students;
};

export const addStudent = async (newStudentData: Omit<HocSinh, 'id' | 'tenLop' | 'tinhTrangThanhToan'>, studentId: string): Promise<HocSinh> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  
  let tenLop = 'N/A';
  if (newStudentData.lopId) {
    const classDocRef = doc(db, "lopHoc", newStudentData.lopId);
    const classDoc = await getFirestoreDoc(classDocRef);
    if (classDoc.exists()) {
      tenLop = (classDoc.data() as LopHoc).tenLop;
    }
  }

  const studentData: HocSinh = {
    ...newStudentData,
    id: studentId, // studentId is already passed from the form
    tenLop: tenLop,
    tinhTrangThanhToan: "Chưa thanh toán", // Default status
  };
  await setDoc(studentDocRef, studentData);
  return studentData; // Return the full student object including the generated/passed id and denormalized fields
};

export const updateStudent = async (studentId: string, updatedData: Partial<Omit<HocSinh, 'id'>>): Promise<void> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  await updateDoc(studentDocRef, updatedData);
};

export const deleteStudent = async (studentId: string): Promise<void> => {
  const studentDocRef = doc(db, "hocSinh", studentId);
  await deleteDoc(studentDocRef);
};
