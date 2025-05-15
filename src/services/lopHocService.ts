
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, query as firestoreQuery, where, getDocs as firestoreGetDocs, collection as firestoreCollection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LopHoc } from "@/lib/types";

const lopHocCollectionRef = collection(db, "lopHoc");

export const getClasses = async (): Promise<LopHoc[]> => {
  const querySnapshot = await getDocs(lopHocCollectionRef);
  const classes = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as LopHoc));
  return classes.sort((a, b) => a.tenLop.localeCompare(b.tenLop, 'vi'));
};

export const addClass = async (newClassData: Omit<LopHoc, 'id' | 'soHocSinhHienTai' | 'trangThai'>, classId: string): Promise<LopHoc> => {
  const classDocRef = doc(db, "lopHoc", classId);
  const classData: LopHoc = {
    ...newClassData,
    id: classId,
    soHocSinhHienTai: 0,
    trangThai: 'Đang hoạt động',
  };
  await setDoc(classDocRef, classData);
  return classData;
};

export const updateClass = async (classId: string, updatedData: Partial<Omit<LopHoc, 'id'>>): Promise<void> => {
  const classDocRef = doc(db, "lopHoc", classId);
  await updateDoc(classDocRef, updatedData);
};

export const deleteClass = async (classId: string): Promise<void> => {
  const classDocRef = doc(db, "lopHoc", classId);
  await deleteDoc(classDocRef);
};

// New function to update student count for a specific class
export const recalculateAndUpdateClassStudentCount = async (classId: string): Promise<void> => {
  if (!classId) return; 
  const classDocRef = doc(db, "lopHoc", classId);
  const studentsInClassQuery = firestoreQuery(firestoreCollection(db, "hocSinh"), where("lopId", "==", classId));
  const studentsSnapshot = await firestoreGetDocs(studentsInClassQuery);
  const count = studentsSnapshot.size;
  await updateDoc(classDocRef, { soHocSinhHienTai: count });
};
