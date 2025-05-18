
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
// import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate } from '@/services/phieuLienLacService'; // Still commented
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { format, parseISO, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatCurrencyVND } from '@/lib/utils';
// import html2canvas from 'html2canvas'; // Still commented for now

// Helper function to determine mastery text and status
const calculateLessonMasteryDetails = (testFormat?: TestFormatPLC, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (testFormat === "KT bài cũ") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Thuộc bài, còn sai sót 1 vài từ", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài, còn sai sót nhiều", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") {
    // For these test types, lesson mastery isn't directly applicable or assessed in the same way as "KT bài cũ"
    // So, we can return a neutral or non-applicable status.
    return { text: "Không có KT bài", isTrulyMastered: false }; // Assuming false as it's not the primary assessment for "thuộc bài"
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};


const isSlipInputEmpty = (entry: StudentSlipInput | undefined): boolean => {
  if (!entry) return true;
  const scoreIsEmpty = entry.score === undefined || entry.score === null || String(entry.score).trim() === '';
  return (
    (entry.testFormat === undefined || entry.testFormat === null || entry.testFormat === "") &&
    scoreIsEmpty &&
    (entry.homeworkStatus === undefined || entry.homeworkStatus === null || entry.homeworkStatus === "") &&
    (entry.vocabularyToReview === undefined || String(entry.vocabularyToReview).trim() === '') &&
    (entry.remarks === undefined || String(entry.remarks).trim() === '')
  );
};


export default function PhieuLienLacPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [studentSlipInputs, setStudentSlipInputs] = useState<Record<string, StudentSlipInput>>({});
  
  const [initialLoadedStudentSlipIds, setInitialLoadedStudentSlipIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'nhap-diem' | 'lich-su'>('nhap-diem');

  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [currentSlipData, setCurrentSlipData] = useState<PhieuLienLacRecord | null>(null);
  const slipDialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsClient(true); }, []);

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: studentsInSelectedClass = [], isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudentsInClass } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClassForPLL', selectedClassId],
    queryFn: () => getStudentsByClassId(selectedClassId),
    enabled: !!selectedClassId && isClient,
  });

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    return format(selectedDate, 'yyyy-MM-dd');
  }, [selectedDate]);

  // const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, isError: isErrorExistingSlips, refetch: refetchExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
  //   queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
  //   queryFn: () => getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate),
  //   enabled: !!selectedClassId && !!selectedDate && isClient,
  // });
  const existingSlipsData: PhieuLienLacRecord[] = []; // Temp placeholder
  const isLoadingExistingSlips = false; // Temp placeholder
  const isErrorExistingSlips = false; // Temp placeholder


  // Main useEffect for syncing existingSlipsData to local state - TEMPORARILY COMMENTED OUT BODY FOR DEBUGGING
  // useEffect(() => {
  //   console.log('[PLLPage] Main useEffect triggered. Dependencies:', { isLoadingStudents, isLoadingExistingSlips, isClient, studentsInSelectedClassLen: studentsInSelectedClass.length, existingSlipsDataLen: existingSlipsData.length });
  //   // if (!isClient || isLoadingStudents || isLoadingExistingSlips) {
  //   //   console.log('[PLLPage] Main useEffect: Pre-condition fail. Returning.');
  //   //   return;
  //   // }
  //   // console.log('[PLLPage] Main useEffect: Processing data.');
  //   // const newSlipInputs: Record<string, StudentSlipInput> = {};
  //   // const newInitialLoadedIds = new Set<string>();

  //   // studentsInSelectedClass.forEach(student => {
  //   //   const existingSlip = existingSlipsData.find(s => s.studentId === student.id);
  //   //   if (existingSlip) {
  //   //     const masteryDetails = calculateLessonMasteryDetails(existingSlip.testFormat, existingSlip.score);
  //   //     newSlipInputs[student.id] = {
  //   //       testFormat: existingSlip.testFormat,
  //   //       score: existingSlip.score === null || existingSlip.score === undefined ? '' : String(existingSlip.score),
  //   //       lessonMasteryText: masteryDetails.text,
  //   //       homeworkStatus: existingSlip.homeworkStatus,
  //   //       vocabularyToReview: existingSlip.vocabularyToReview || '',
  //   //       remarks: existingSlip.remarks || '',
  //   //     };
  //   //     if (!isSlipInputEmpty(newSlipInputs[student.id])) {
  //   //       newInitialLoadedIds.add(student.id);
  //   //     }
  //   //   } else {
  //   //     const masteryDetails = calculateLessonMasteryDetails(undefined, undefined);
  //   //     newSlipInputs[student.id] = {
  //   //       testFormat: undefined,
  //   //       score: '',
  //   //       lessonMasteryText: masteryDetails.text,
  //   //       homeworkStatus: undefined,
  //   //       vocabularyToReview: '',
  //   //       remarks: '',
  //   //     };
  //   //   }
  //   // });
    
  //   // console.log('[PLLPage] Main useEffect: newSlipInputs populated:', newSlipInputs);
  //   // console.log('[PLLPage] Main useEffect: newInitialLoadedIds populated:', newInitialLoadedIds);

  //   // // Preserve editing student's current input if they were part of the loaded data
  //   // // This logic might need refinement if editing student data is also coming from existingSlipsData
  //   // if (editingStudentId && newSlipInputs[editingStudentId] && studentSlipInputs[editingStudentId]) {
  //   //   // If the editing student's data was loaded, and we also have local changes for them,
  //   //   // decide which one to prioritize or merge. For now, let's assume local changes take precedence if editing.
  //   //   // However, the primary goal of this effect is to load from DB, so typically DB data would be shown.
  //   //   // This specific part might be better handled by ensuring `editingStudentId` is reset when data loads.
  //   //   console.log(`[PLLPage] Main useEffect: Preserving current input for editing student ${editingStudentId}`);
  //   //   newSlipInputs[editingStudentId] = { ...studentSlipInputs[editingStudentId] };
  //   // }
    
  //   // setStudentSlipInputs(newSlipInputs);
  //   // setInitialLoadedStudentSlipIds(newInitialLoadedIds);
  //   // console.log('[PLLPage] Main useEffect: studentSlipInputs and initialLoadedStudentSlipIds set.');

  //   // // Reset editingStudentId if the student being edited is no longer in the initial loaded set
  //   // // or if their loaded data is now empty (e.g., was deleted from DB by another client)
  //   // // This line was removed as a potential cause of infinite loops when editingStudentId was in dependency array
  //   // // if (editingStudentId && (!newInitialLoadedIds.has(editingStudentId) || (newSlipInputs[editingStudentId] && isSlipInputEmpty(newSlipInputs[editingStudentId])))) {
  //   // //   console.log(`[PLLPage] Main useEffect: Resetting editingStudentId because student ${editingStudentId} is no longer in initial loaded set or their data is empty.`);
  //   // //   setEditingStudentId(null);
  //   // // }

  // }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient, memoizedFormattedSelectedDateKey]);


  // useEffect to reset local states when class or date changes
  useEffect(() => {
    if (!isClient) return;
    console.log(`[PLLPage] Date or Class changed. Date: ${memoizedFormattedSelectedDateKey}, ClassID: ${selectedClassId}. Resetting local states.`);
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null); 
    // No need to invalidate 'existingPhieuLienLac' here, useQuery's 'enabled' and 'queryKey' handle refetching.
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient]);


  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || {};
      let updatedEntry: StudentSlipInput = { ...currentEntry, [field]: value };

      if (field === 'testFormat' || field === 'score') {
        const masteryDetails = calculateLessonMasteryDetails(
          field === 'testFormat' ? value as TestFormatPLC : updatedEntry.testFormat,
          field === 'score' ? value : updatedEntry.score
        );
        updatedEntry.lessonMasteryText = masteryDetails.text;
      }
      return { ...prev, [studentId]: updatedEntry };
    });
  }, []); // Simplified dependency array

  // const { data: studentsForHistoryTab = [], isLoading: isLoadingStudentsForHistoryTab } = useMemo(() => { // Replaced with simpler useMemo
  const studentsForHistoryTab = useMemo(() => {
    // Temporarily return empty or simple logic to avoid complex computations during loop debugging
    // if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    // return studentsInSelectedClass.filter(student =>
    //   initialLoadedStudentSlipIds.has(student.id) &&
    //   student.id !== editingStudentId && 
    //   !isSlipInputEmpty(studentSlipInputs[student.id])
    // );
    return [];
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);

  // const { data: studentsForEntryTab = [], isLoading: isLoadingStudentsForEntryTab } = useMemo(() => { // Replaced with simpler useMemo
  const studentsForEntryTab = useMemo(() => {
    // Temporarily return all students or simple logic
    // if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    // if (editingStudentId) {
    //   const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
    //   return studentBeingEdited ? [studentBeingEdited] : [];
    // }
    // const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    // return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    return studentsInSelectedClass; // For now, show all students here if student list is available
  }, [studentsInSelectedClass, /*studentsForHistoryTab, editingStudentId,*/ isLoadingStudents, isLoadingExistingSlips]);


  // const saveSlipsMutation = useMutation({
  //   mutationFn: savePhieuLienLacRecords,
  //   onSuccess: () => {
  //     toast({ title: "Thành công!", description: "Phiếu liên lạc đã được lưu." });
  //     queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
  //     setEditingStudentId(null); 
  //   },
  //   onError: (error: Error) => {
  //     toast({
  //       title: "Lỗi khi lưu phiếu liên lạc",
  //       description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
  //       variant: "destructive",
  //     });
  //   },
  // });
  const saveSlipsMutation = {isPending: false, mutate: (data: any) => console.log("Mock saveSlipsMutation called with:", data)};


  const handleSaveAllSlips = () => {
    if (!selectedClassId || !selectedDate) {
      toast({ title: "Lỗi", description: "Vui lòng chọn lớp và ngày.", variant: "destructive" });
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" });
      return;
    }

    const recordsToSave: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt'>> = [];
    const studentsToProcess = editingStudentId 
      ? studentsInSelectedClass.filter(s => s.id === editingStudentId)
      : studentsForEntryTab;

    studentsToProcess.forEach(student => {
      const input = studentSlipInputs[student.id];
      if (input && !isSlipInputEmpty(input)) {
        const masteryDetails = calculateLessonMasteryDetails(input.testFormat, input.score);
        recordsToSave.push({
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey,
          testFormat: input.testFormat,
          score: (input.score === undefined || input.score === null || String(input.score).trim() === '') ? null : Number(input.score),
          lessonMasteryText: masteryDetails.text, 
          homeworkStatus: input.homeworkStatus,
          vocabularyToReview: input.vocabularyToReview,
          remarks: input.remarks,
        });
      } else if (input && isSlipInputEmpty(input) && initialLoadedStudentSlipIds.has(student.id)) {
         // If the entry was previously loaded (not empty) but is now empty, we might want to "delete" or "clear" it
         // This logic depends on whether an empty submission means "delete existing entry"
         // For now, we'll only save non-empty inputs or inputs that are clearing a previously non-empty loaded record.
         // To truly delete, the service would need to handle finding and deleting the record.
         // Or, we send an empty record, and the service updates it to be empty.
        const masteryDetails = calculateLessonMasteryDetails(input.testFormat, input.score); // Recalculate for consistency
        recordsToSave.push({
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey,
          testFormat: input.testFormat || undefined, // Ensure it's undefined if empty string
          score: null, // Explicitly null for "empty"
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: input.homeworkStatus || undefined,
          vocabularyToReview: input.vocabularyToReview || '',
          remarks: input.remarks || '',
        });
      }
    });

    if (recordsToSave.length === 0) {
      toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc." });
      return;
    }
    console.log("[PLLPage] Records to save:", recordsToSave);
    saveSlipsMutation.mutate(recordsToSave);
  };
  
  const handleEditSlip = (studentId: string) => {
    console.log(`[PLLPage] Edit slip requested for student: ${studentId}`);
    const studentToEdit = studentsInSelectedClass.find(s => s.id === studentId);
    const slipEntry = studentSlipInputs[studentId];

    if (studentToEdit && slipEntry) {
        // Ensure local state reflects what's being edited, even if it was from initial load
        // The main useEffect should have populated studentSlipInputs already.
        // If editing, we might want to ensure the student is in studentSlipInputs if they weren't before (e.g. loading an old record to edit)
        // For now, assume studentSlipInputs[studentId] is already populated by the main useEffect
        setEditingStudentId(studentId);
        setActiveTab("nhap-diem");
        // const entryTabTrigger = document.querySelector('button[data-state="inactive"][value="nhap-diem"]') as HTMLButtonElement | null;
        // if (entryTabTrigger) {
        //     entryTabTrigger.click();
        // } else {
        //     console.warn("Could not find entry tab trigger to click");
        // }
        console.log(`[PLLPage] Student ${studentId} moved to 'Nhập điểm' tab for editing.`);
    } else {
        console.warn(`[PLLPage] Cannot edit slip for student ${studentId}: student or slip data not found locally.`);
        toast({ title: "Lỗi", description: "Không tìm thấy dữ liệu phiếu liên lạc để sửa.", variant: "destructive"});
    }
  };

  const handleDeleteSlipEntry = (studentId: string) => {
    console.log(`[PLLPage] Delete slip entry requested for student: ${studentId}`);
    const masteryDetailsForEmpty = calculateLessonMasteryDetails(undefined, null);
    setStudentSlipInputs(prev => ({
      ...prev,
      [studentId]: {
        testFormat: undefined,
        score: null, // Use null to signify cleared score
        lessonMasteryText: masteryDetailsForEmpty.text,
        homeworkStatus: undefined,
        vocabularyToReview: '',
        remarks: '',
      }
    }));
    // The student will move to "Nhập điểm" tab because their entry is now empty (or considered so).
    // To persist this deletion, user needs to click "Lưu Tất Cả".
    // We should NOT remove from initialLoadedStudentSlipIds here, as that would prevent the "empty" state from being saved.
    // Instead, the save logic should handle updating the existing record to an empty state.
    toast({ description: `Đã xoá dữ liệu phiếu liên lạc cục bộ cho học sinh. Nhấn "Lưu" để cập nhật vào hệ thống.` });
    if (editingStudentId === studentId) {
        setEditingStudentId(null); // Stop editing if the entry being edited is deleted
    }
  };

  const handleOpenSlipDialog = async (studentId: string) => {
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const inputData = studentSlipInputs[studentId];

    if (!student || !selectedClass || !inputData) {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu xem trước.", variant: "destructive" });
      return;
    }
    const masteryDetails = calculateLessonMasteryDetails(inputData.testFormat, inputData.score);
    const slip: PhieuLienLacRecord = {
      id: '', // Not relevant for preview
      studentId: student.id,
      studentName: student.hoTen,
      classId: selectedClassId,
      className: selectedClass.tenLop,
      date: memoizedFormattedSelectedDateKey,
      testFormat: inputData.testFormat,
      score: (inputData.score === undefined || inputData.score === null || String(inputData.score).trim() === '') ? null : Number(inputData.score),
      lessonMasteryText: masteryDetails.text,
      homeworkStatus: inputData.homeworkStatus,
      vocabularyToReview: inputData.vocabularyToReview,
      remarks: inputData.remarks,
    };
    setCurrentSlipData(slip);
    setIsSlipModalOpen(true);
  };

 const handleExportSlipImage = async () => {
    if (!slipDialogContentRef.current || !currentSlipData) return;
    // if (typeof html2canvas === 'undefined') {
    //   toast({ title: "Lỗi", description: "Thư viện html2canvas chưa tải. Vui lòng thử lại.", variant: "destructive" });
    //   return;
    // }
    // try {
    //   const canvas = await html2canvas(slipDialogContentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    //   const image = canvas.toDataURL('image/png', 1.0);
    //   const link = document.createElement('a');
    //   link.href = image;
    //   link.download = `PhieuLienLac_${currentSlipData.studentName?.replace(/\s+/g, '_')}_${currentSlipData.date}.png`;
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
    //   toast({ title: "Thành công!", description: "Phiếu liên lạc đã được xuất ra ảnh." });
    // } catch (error) {
    //   console.error("Error exporting grade slip to image:", error);
    //   toast({ title: "Lỗi xuất ảnh", description: (error as Error).message, variant: "destructive" });
    // }
    toast({title: "Thông báo", description: "Chức năng xuất ảnh đang tạm thời vô hiệu hóa để gỡ lỗi."});
  };
  
  const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
    let starColor = "text-gray-300 dark:text-gray-600"; // Default for no stars or low scores

    if (score >= 9 && score <= 10) { numStars = 5; starColor = "text-green-500 dark:text-green-400"; }
    else if (score >= 7 && score < 9) { numStars = 4; starColor = "text-green-500 dark:text-green-400"; }
    else if (score >= 5 && score < 7) { numStars = 3; starColor = "text-green-500 dark:text-green-400"; }
    else { numStars = 0; } // No stars for scores below 5

    if (numStars === 0) return null; // Don't render if no stars to show

    return (
      <div className="flex items-center ml-2">
        {[...Array(numStars)].map((_, i) => (
          <Star key={i} className={cn("h-4 w-4 fill-current", starColor)} />
        ))}
        {[...Array(maxStars - numStars)].map((_, i) => (
           <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300 dark:text-gray-600" />
        ))}
      </div>
    );
  };

  const renderScoreDisplay = (scoreValue?: number | null | string) => {
    if (scoreValue === null || scoreValue === undefined || String(scoreValue).trim() === '') return <span className="text-muted-foreground">N/A</span>;
    const score = Number(scoreValue);
    if (isNaN(score)) return <span className="text-destructive">Không hợp lệ</span>;
    
    let scoreTextColor = "text-foreground"; 
    if (score >= 9 && score <= 10) scoreTextColor = "text-red-600 dark:text-red-400";
    else if (score >= 7 && score < 9) scoreTextColor = "text-blue-600 dark:text-blue-400";
    else if (score >= 5 && score < 7) scoreTextColor = "text-violet-600 dark:text-violet-400";
    
    return (
      <div className="flex items-center">
        <span className={cn("font-semibold", scoreTextColor)}>{score}</span>
        <StarRating score={score} />
      </div>
    );
  };


  const getHomeworkStatusColor = (status?: HomeworkStatusPLC) => {
    if (status === "Đã làm bài đầy đủ") return "text-blue-600 dark:text-blue-400";
    if (status === "Chỉ làm bài 1 phần" || status === "Chỉ làm 2/3 bài") return "text-orange-500 dark:text-orange-400";
    if (status === "Không làm bài") return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getLessonMasteryTextColor = (masteryText: string | undefined, isTrulyMastered: boolean) => {
    if (!masteryText || masteryText.includes("Chưa chọn hình thức KT") || masteryText.includes("Chưa có điểm/Chưa đánh giá")) return "text-muted-foreground";
    if (masteryText.includes("Không có KT bài")) return "text-muted-foreground font-normal";
    if (masteryText.includes("Không thuộc bài")) return "text-red-600 dark:text-red-400";
    if (isTrulyMastered) return "text-blue-600 dark:text-blue-400"; // "Thuộc bài", "Thuộc bài, còn sai sót ít"
    return "text-orange-500 dark:text-orange-400"; // Các trường hợp "Có học bài..."
  };


  const isLoadingInitialData = isLoadingClasses || (selectedClassId && (isLoadingStudents || isLoadingExistingSlips));
  
  const saveButtonText = editingStudentId ? "Lưu Thay Đổi" : "Lưu Tất Cả"; 
  
  // const canSaveChanges = useMemo(() => { // Simplified for debugging
  //   if (saveSlipsMutation.isPending) return false;
  //   if (editingStudentId) return true; 
  //   const hasMeaningfulChanges = Object.values(studentSlipInputs).some(entry => !isSlipInputEmpty(entry));
  //   return hasMeaningfulChanges;
  // }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending]);
  const canSaveChanges = true;


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <ClipboardList className="mr-3 h-8 w-8 text-primary" /> Phiếu Liên Lạc
          </h1>
        </div>

        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle>Thông tin chung phiếu liên lạc</CardTitle>
            <CardDescription>Chọn lớp và ngày để bắt đầu ghi nhận phiếu liên lạc.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-select">Chọn Lớp</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingClasses}>
                <SelectTrigger id="class-select">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn lớp học"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((lop) => (
                    <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chọn Ngày</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={vi} />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {isErrorClasses && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách lớp.</div>}
        {selectedClassId && isErrorStudents && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách học sinh cho lớp này.</div>}
        {selectedClassId && selectedDate && isErrorExistingSlips && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử phiếu liên lạc đã có.</div>}


        {selectedClassId && selectedDate && !isErrorClasses && !isErrorStudents && !isErrorExistingSlips && (
          <Card className="shadow-md">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={(value) => {
                // If switching away from "Nhập điểm" while editing, clear editingStudentId
                if (activeTab === 'nhap-diem' && value !== 'nhap-diem' && editingStudentId) {
                    // Decide if you want to prompt user to save changes or just clear editing state
                    // For now, just clear editing state
                    // setEditingStudentId(null); 
                    // This might be too aggressive if user just wants to peek at history.
                    // Let's allow peeking. The save button state will handle if changes are lost.
                }
                setActiveTab(value as 'nhap-diem' | 'lich-su');
              }}>
                <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    {editingStudentId ? "Sửa Phiếu" : "Nhập Phiếu"} ({studentsForEntryTab.length})
                  </TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử Phiếu ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingInitialData && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!isLoadingInitialData && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!isLoadingInitialData && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && activeTab === 'nhap-diem' && !editingStudentId && (
                    <p className="text-muted-foreground p-4 text-center">Tất cả học sinh đã có phiếu hoặc đã được chuyển sang tab Lịch sử. Chọn "Sửa" từ tab Lịch sử để chỉnh sửa.</p>
                  )}
                  {!isLoadingInitialData && studentsForEntryTab.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Học sinh</TableHead>
                          <TableHead className="w-[180px]">Hình thức KT</TableHead>
                          <TableHead className="w-[100px]">Điểm</TableHead>
                          <TableHead className="w-[200px]">Thuộc bài?</TableHead>
                          <TableHead className="w-[200px]">Bài tập về nhà</TableHead>
                          <TableHead className="min-w-[200px]">Từ vựng cần học lại</TableHead>
                          <TableHead className="min-w-[200px]">Nhận xét</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForEntryTab.map((student) => {
                          const currentInput = studentSlipInputs[student.id] || {};
                          const masteryDetails = calculateLessonMasteryDetails(currentInput.testFormat, currentInput.score);
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell>
                                <Select
                                  value={currentInput.testFormat || ""}
                                  onValueChange={(value) => handleSlipInputChange(student.id, 'testFormat', value as TestFormatPLC)}
                                >
                                  <SelectTrigger><SelectValue placeholder="Chọn hình thức" /></SelectTrigger>
                                  <SelectContent>
                                    {ALL_TEST_FORMATS_PLC.map(formatValue => <SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="text" 
                                  placeholder="VD: 8"
                                  value={currentInput.score === null || currentInput.score === undefined ? '' : String(currentInput.score)}
                                  onChange={(e) => handleSlipInputChange(student.id, 'score', e.target.value)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell className={cn("font-medium", getLessonMasteryTextColor(masteryDetails.text, masteryDetails.isTrulyMastered))}>
                                {masteryDetails.text}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={currentInput.homeworkStatus || ""}
                                  onValueChange={(value) => handleSlipInputChange(student.id, 'homeworkStatus', value as HomeworkStatusPLC)}
                                >
                                  <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                                  <SelectContent>
                                    {ALL_HOMEWORK_STATUSES_PLC.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  value={currentInput.vocabularyToReview || ''}
                                  onChange={(e) => handleSlipInputChange(student.id, 'vocabularyToReview', e.target.value)}
                                  placeholder="Từ vựng..."
                                  rows={2}
                                />
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  value={currentInput.remarks || ''}
                                  onChange={(e) => handleSlipInputChange(student.id, 'remarks', e.target.value)}
                                  placeholder="Nhận xét..."
                                  rows={2}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="lich-su">
                  {isLoadingInitialData && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!isLoadingInitialData && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!isLoadingInitialData && studentsInSelectedClass.length > 0 && studentsForHistoryTab.length === 0 && (
                    <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lựa chọn này, hoặc tất cả đang ở trạng thái chỉnh sửa.</p>
                  )}
                  {!isLoadingInitialData && studentsForHistoryTab.length > 0 && (
                     <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">STT</TableHead>
                          <TableHead>Học sinh</TableHead>
                          <TableHead>Hình thức KT</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Thuộc bài?</TableHead>
                          <TableHead>Bài tập về nhà</TableHead>
                          <TableHead className="text-right w-[150px]">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForHistoryTab.map((student, index) => {
                          const slipData = studentSlipInputs[student.id] || {};
                          const masteryDetails = calculateLessonMasteryDetails(slipData.testFormat, slipData.score);
                          return (
                            <TableRow key={student.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell>{slipData.testFormat || 'N/A'}</TableCell>
                              <TableCell>{renderScoreDisplay(slipData.score)}</TableCell>
                              <TableCell className={cn("font-medium", getLessonMasteryTextColor(masteryDetails.text, masteryDetails.isTrulyMastered))}>
                                {masteryDetails.text}
                              </TableCell>
                              <TableCell className={cn(getHomeworkStatusColor(slipData.homeworkStatus))}>
                                {slipData.homeworkStatus || 'N/A'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" size="icon" onClick={() => handleEditSlip(student.id)} aria-label="Sửa phiếu">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(student.id)} aria-label="Xóa phiếu (cục bộ)">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(student.id)} aria-label="Xuất phiếu">
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardHeader>
            { (activeTab === 'nhap-diem' || (activeTab === 'lich-su' && editingStudentId) ) && (studentsForEntryTab.length > 0 || editingStudentId) && (
              <CardFooter>
                <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                  {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveButtonText}
                </Button>
                 {editingStudentId && activeTab === 'nhap-diem' && (
                    <Button variant="ghost" onClick={() => { setEditingStudentId(null); setActiveTab('lich-su');}} className="ml-2">
                        Hủy Sửa
                    </Button>
                )}
              </CardFooter>
            )}
          </Card>
        )}

        <Dialog open={isSlipModalOpen} onOpenChange={setIsSlipModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
             <DialogHeader className="p-6 pb-0">
                <ShadDialogTitle className="text-center text-2xl font-bold uppercase text-primary">
                    PHIẾU LIÊN LẠC
                </ShadDialogTitle>
                {currentSlipData?.date && (
                    <ShadDialogDescription className="text-center text-sm">
                    Ngày: {format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}
                    </ShadDialogDescription>
                )}
            </DialogHeader>
            <ScrollArea className="flex-grow">
              <div ref={slipDialogContentRef} className="p-6 bg-card font-sans leading-normal"> 
                {currentSlipData ? (
                  <div className="space-y-1"> 
                    <div className="grid grid-cols-3 gap-x-2 mb-2 text-sm">
                        <p><strong className="font-semibold">Họ và tên:</strong> <span className="text-indigo-700 font-semibold">{currentSlipData.studentName}</span></p>
                        <p><strong className="font-semibold">Mã HS:</strong> {currentSlipData.studentId}</p>
                        <p><strong className="font-semibold">Lớp:</strong> {currentSlipData.className}</p>
                    </div>
                    <SlipDetailItem label="Hình thức KT">{currentSlipData.testFormat || "N/A"}</SlipDetailItem>
                    <SlipDetailItem label="Điểm số">{renderScoreDisplay(currentSlipData.score)}</SlipDetailItem>
                    <SlipDetailItem label="Thuộc bài">
                        <span className={cn("font-medium", getLessonMasteryTextColor(currentSlipData.lessonMasteryText, calculateLessonMasteryDetails(currentSlipData.testFormat, currentSlipData.score).isTrulyMastered))}>
                            {currentSlipData.lessonMasteryText || "Chưa đánh giá"}
                        </span>
                    </SlipDetailItem>
                     <SlipDetailItem label="Từ vựng cần học lại">{currentSlipData.vocabularyToReview || "Không có"}</SlipDetailItem>
                    <SlipDetailItem label="Bài tập về nhà">
                        <span className={cn("font-medium", getHomeworkStatusColor(currentSlipData.homeworkStatus))}>
                            {currentSlipData.homeworkStatus || "Không có bài tập về nhà"}
                        </span>
                    </SlipDetailItem>
                    <SlipDetailItem label="Nhận xét">{currentSlipData.remarks || "Không có nhận xét."}</SlipDetailItem>
                    
                    <Separator className="my-3"/>

                    <p className="text-sm text-foreground mt-3 leading-relaxed">
                        Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.
                        <br />
                        Trân trọng.
                    </p>
                  </div>
                ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t sm:justify-between">
              <Button variant="outline" onClick={() => setIsSlipModalOpen(false)}>Đóng</Button>
              <Button onClick={handleExportSlipImage} disabled={!currentSlipData /* || typeof html2canvas === 'undefined' */}>
                {/* {typeof html2canvas === 'undefined' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} */}
                {/* {typeof html2canvas === 'undefined' ? "Đang tải html2canvas..." : "Xuất file ảnh"} */}
                <Printer className="mr-2 h-4 w-4" /> Xuất file ảnh (Tạm thời vô hiệu)
              </Button>

            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout> 
  );
}

const SlipDetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[150px_1fr] items-start py-1 text-sm"> 
    <strong className="font-medium text-muted-foreground">{label}:</strong>
    <div>{children}</div>
  </div>
);
