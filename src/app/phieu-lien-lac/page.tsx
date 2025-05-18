
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '../dashboard-layout'; // Added import
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
// import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate } from '@/services/phieuLienLacService';
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { format, parseISO, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatCurrencyVND } from '@/lib/utils';
// import html2canvas from 'html2canvas'; // Temporarily commented out

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
    return { text: "Không có KT bài", isTrulyMastered: false };
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
  //   queryFn: () => getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate), // This service function needs to be implemented
  //   enabled: !!selectedClassId && !!selectedDate && isClient,
  // });

  const isLoadingExistingSlips = false; // Placeholder
  const isErrorExistingSlips = false; // Placeholder
  const existingSlipsData: PhieuLienLacRecord[] = []; // Placeholder


  // Main useEffect for syncing existingSlipsData to local state - Temporarily commented out for debugging infinite loops
  /*
  useEffect(() => {
    if (!isClient || isLoadingStudents || isLoadingExistingSlips) {
      console.log('[PLLPage] Main useEffect: Pre-condition fail. Returning.');
      return;
    }
    console.log('[PLLPage] Main useEffect: Processing data. existingSlipsData:', existingSlipsData, 'studentsInSelectedClass:', studentsInSelectedClass);
    const newSlipInputs: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIds = new Set<string>();

    studentsInSelectedClass.forEach(student => {
      const existingSlip = existingSlipsData.find(s => s.studentId === student.id);
      const masteryDetails = calculateLessonMasteryDetails(existingSlip?.testFormat, existingSlip?.score);
      if (existingSlip) {
        newSlipInputs[student.id] = {
          testFormat: existingSlip.testFormat,
          score: existingSlip.score === null || existingSlip.score === undefined ? '' : String(existingSlip.score),
          lessonMasteryText: masteryDetails.text, // Store this for consistency if needed, though it's calculated
          homeworkStatus: existingSlip.homeworkStatus,
          vocabularyToReview: existingSlip.vocabularyToReview || '',
          remarks: existingSlip.remarks || '',
        };
        if (!isSlipInputEmpty(newSlipInputs[student.id])) {
          newInitialLoadedIds.add(student.id);
        }
      } else {
        newSlipInputs[student.id] = {
          testFormat: undefined,
          score: '',
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: undefined,
          vocabularyToReview: '',
          remarks: '',
        };
      }
    });
    
    console.log('[PLLPage] Main useEffect: newSlipInputs populated:', newSlipInputs);
    console.log('[PLLPage] Main useEffect: newInitialLoadedIds populated:', newInitialLoadedIds);

    if (editingStudentId && newSlipInputs[editingStudentId] && studentSlipInputs[editingStudentId]) {
      // Preserve current input for editing student if different from loaded data
      // This logic might need to be more nuanced based on user expectations
      // For now, if editing, local changes might take precedence.
       if (JSON.stringify(newSlipInputs[editingStudentId]) !== JSON.stringify(studentSlipInputs[editingStudentId])) {
          console.log(`[PLLPage] Main useEffect: Preserving current input for editing student ${editingStudentId} as it differs from loaded data.`);
          newSlipInputs[editingStudentId] = { ...studentSlipInputs[editingStudentId] };
       }
    }
    
    setStudentSlipInputs(newSlipInputs);
    setInitialLoadedStudentSlipIds(newInitialLoadedIds);

  // }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient, memoizedFormattedSelectedDateKey]);
  }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient, memoizedFormattedSelectedDateKey]);
  */


  useEffect(() => {
    if (!isClient) return;
    console.log(`[PLLPage] Date or Class changed. Date: ${memoizedFormattedSelectedDateKey}, ClassID: ${selectedClassId}. Resetting local states.`);
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null); 
    // queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient]);


  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || {};
      let updatedEntry: StudentSlipInput = { ...currentEntry, [field]: value };

      if (field === 'testFormat' || field === 'score') {
        const masteryDetails = calculateLessonMasteryDetails(
          field === 'testFormat' ? value as TestFormatPLC : updatedEntry.testFormat,
          field === 'score' ? String(value) : updatedEntry.score 
        );
        updatedEntry.lessonMasteryText = masteryDetails.text;
      }
      
      // If user starts typing in an entry that was previously loaded and considered "non-empty",
      // and they are not explicitly in "editingStudentId" mode for this student,
      // this implicitly means they are editing it.
      // if (initialLoadedStudentSlipIds.has(studentId) && editingStudentId !== studentId) {
      //   console.log(`[PLLPage] handleSlipInputChange: Student ${studentId} (loaded) changed, setting as editingStudentId.`);
      //   // setEditingStudentId(studentId); // This might cause loops if not careful with dependencies
      // }

      return { ...prev, [studentId]: updatedEntry };
    });
  }, []); 


  const studentsForHistoryTab = useMemo(() => {
    // Temporarily return empty array or simple logic to avoid complex computations during loop debugging
    // If data is not fully loaded, return empty array.
    if (isLoadingStudents || isLoadingExistingSlips || !studentsInSelectedClass || !isClient) return [];

    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentSlipIds.has(student.id) &&
      student.id !== editingStudentId && 
      !isSlipInputEmpty(studentSlipInputs[student.id]) // Check against current inputs
    );
  // }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips, isClient]);
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips, isClient]);


  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || isLoadingExistingSlips || !studentsInSelectedClass || !isClient) return [];
    
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
  // }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingSlips, isClient]);
   }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingSlips, isClient]);


  // const saveSlipsMutation = useMutation({
  //   mutationFn: savePhieuLienLacRecords, // This service function needs to be implemented
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
  const saveSlipsMutation = {isPending: false, mutate: (data: any) => console.log("[PLLPage] Mock saveSlipsMutation called with:", data)};


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
      : studentsInSelectedClass; // Save all, service will upsert based on loaded data

    studentsToProcess.forEach(student => {
      const input = studentSlipInputs[student.id];
      if (input) { // Always include if there's an input entry, even if empty (to clear existing)
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
      }
    });

    if (recordsToSave.length === 0 && !editingStudentId) {
      toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc." });
      return;
    }
    console.log("[PLLPage] Records to save:", recordsToSave);
    // saveSlipsMutation.mutate(recordsToSave);
    toast({ title: "Thông báo", description: "Chức năng lưu phiếu liên lạc đang được hoàn thiện."});
  };
  
  const handleEditSlip = (studentId: string) => {
    console.log(`[PLLPage] Edit slip requested for student: ${studentId}`);
    const studentToEdit = studentsInSelectedClass.find(s => s.id === studentId);
    const slipEntry = studentSlipInputs[studentId];

    if (studentToEdit && slipEntry) {
        setEditingStudentId(studentId);
        setActiveTab("nhap-diem"); 
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
        score: null,
        lessonMasteryText: masteryDetailsForEmpty.text,
        homeworkStatus: undefined,
        vocabularyToReview: '',
        remarks: '',
      }
    }));
    toast({ description: `Đã xoá dữ liệu phiếu liên lạc cục bộ cho học sinh. Nhấn "Lưu" để cập nhật vào hệ thống.` });
    if (editingStudentId === studentId) {
        setEditingStudentId(null);
    }
    // If the student was in initialLoadedStudentSlipIds, they will now be considered "empty"
    // and should move to the entry tab upon next render due to useMemo logic.
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
      id: '', 
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
    // if (!slipDialogContentRef.current || !currentSlipData) return;
    // if (typeof html2canvas === 'undefined') {
    //   toast({ title: "Lỗi", description: "Thư viện html2canvas chưa tải. Vui lòng chạy 'npm install html2canvas' và khởi động lại server.", variant: "destructive" });
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
    toast({title: "Thông báo", description: "Chức năng xuất ảnh đang tạm thời vô hiệu hóa. Vui lòng cài đặt 'html2canvas' và bỏ comment code."});
  };
  
  const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
    // Use green for all stars as per latest request
    const starColor = "text-green-500 dark:text-green-400"; 

    if (score >= 9 && score <= 10) { numStars = 5; }
    else if (score >= 7 && score < 9) { numStars = 4; }
    else if (score >= 5 && score < 7) { numStars = 3; }
    else { numStars = 0; } 

    if (numStars === 0) return null;

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
    if (isTrulyMastered) return "text-blue-600 dark:text-blue-400";
    return "text-orange-500 dark:text-orange-400"; 
  };


  const isLoadingInitialData = isLoadingClasses || (selectedClassId && (isLoadingStudents || isLoadingExistingSlips));
  
  const saveButtonText = editingStudentId ? "Lưu Thay Đổi" : "Lưu Tất Cả"; 
  
  const canSaveChanges = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId) return true; // Always allow save if editing a specific student

    // Check if any entry in studentSlipInputs (for students currently in the entry tab) is non-empty
    const hasMeaningfulChangesInEntryTab = studentsForEntryTab.some(student => 
        studentSlipInputs[student.id] && !isSlipInputEmpty(studentSlipInputs[student.id])
    );
    return hasMeaningfulChangesInEntryTab;
  // }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsForEntryTab]);
  }, [studentSlipInputs, editingStudentId, false, studentsForEntryTab]); // saveSlipsMutation.isPending is mocked to false


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
              <Label htmlFor="class-select-pll">Chọn Lớp</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingClasses}>
                <SelectTrigger id="class-select-pll">
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
              <Label htmlFor="date-select-pll">Chọn Ngày</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date-select-pll"
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
        {/* {selectedClassId && selectedDate && isErrorExistingSlips && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử phiếu liên lạc đã có.</div>} */}


        {selectedClassId && selectedDate && !isErrorClasses && !isErrorStudents /*&& !isErrorExistingSlips*/ && (
          <Card className="shadow-md">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'nhap-diem' | 'lich-su')}>
                <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    {editingStudentId ? "Sửa Phiếu" : "Nhập Phiếu"} ({studentsForEntryTab.length})
                  </TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử Phiếu ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && activeTab === 'nhap-diem' && !editingStudentId && (
                    <p className="text-muted-foreground p-4 text-center">Tất cả học sinh đã có phiếu hoặc đã được chuyển sang tab Lịch sử. Chọn "Sửa" từ tab Lịch sử để chỉnh sửa.</p>
                  )}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsForEntryTab.length > 0 && (
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
                  {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForHistoryTab.length === 0 && (
                    <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lựa chọn này, hoặc tất cả đang ở trạng thái chỉnh sửa.</p>
                  )}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsForHistoryTab.length > 0 && (
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
              <Button onClick={handleExportSlipImage} disabled={!currentSlipData /*|| typeof html2canvas === 'undefined'*/}>
                 {/* {typeof html2canvas === 'undefined' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />} */}
                 {/* {typeof html2canvas === 'undefined' ? "Đang tải html2canvas..." : "Xuất file ảnh"} */}
                 <Printer className="mr-2 h-4 w-4" /> Xuất file ảnh (Tạm vô hiệu)
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

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shrink-0 bg-border h-[1px] w-full", className)}
    {...props}
  />
));
Separator.displayName = "Separator";
