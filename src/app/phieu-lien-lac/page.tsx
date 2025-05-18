"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// import DashboardLayout from '../dashboard-layout'; // Temporarily using MinimalLayout for debugging
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription as ShadCardDescriptionOriginal, CardFooter, CardHeader, CardTitle as ShadCardTitleOriginal } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate } from '@/services/phieuLienLacService';
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { format, parseISO, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatCurrencyVND } from '@/lib/utils';
import html2canvas from 'html2canvas';
import DashboardLayout from '../dashboard-layout'; // Restored

const CardTitle = ShadCardTitleOriginal;
const CardDescription = ShadCardDescriptionOriginal;


// Helper function to determine mastery text based on test format and score
const calculateMasteryDetails = (testFormat?: TestFormatPLC, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (testFormat === "KT bài cũ") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Thuộc bài, còn sai sót 1 vài từ", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài, còn sai sót nhiều", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  // Added "Kiểm tra miệng" logic
  if (testFormat === "Kiểm tra miệng") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isTrulyMastered: false };
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
  const entryTabTriggerRef = useRef<HTMLButtonElement>(null);
  const historyTabTriggerRef = useRef<HTMLButtonElement>(null);


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

  const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, isError: isErrorExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate),
    enabled: !!selectedClassId && !!selectedDate && isClient,
  });
  
  useEffect(() => {
    if (!isClient || isLoadingStudents || isLoadingExistingSlips) {
      return;
    }
    
    const newInputsFromEffect: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIdsFromEffect = new Set<string>();

    studentsInSelectedClass.forEach(student => {
      const existingSlip = existingSlipsData.find(s => s.studentId === student.id);
      const masteryDetails = calculateMasteryDetails(existingSlip?.testFormat, existingSlip?.score);
      
      if (existingSlip) {
        const slipEntry: StudentSlipInput = {
          testFormat: existingSlip.testFormat,
          score: existingSlip.score === null || existingSlip.score === undefined ? '' : String(existingSlip.score),
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: existingSlip.homeworkStatus,
          vocabularyToReview: existingSlip.vocabularyToReview || '',
          remarks: existingSlip.remarks || '',
        };
        newInputsFromEffect[student.id] = slipEntry;
        if (!isSlipInputEmpty(slipEntry)) {
            newInitialLoadedIdsFromEffect.add(student.id);
        }
      } else {
        newInputsFromEffect[student.id] = {
          testFormat: undefined,
          score: '',
          lessonMasteryText: calculateMasteryDetails(undefined, '').text,
          homeworkStatus: undefined,
          vocabularyToReview: '',
          remarks: '',
        };
      }
    });
    
    // If a student is being edited, ensure their current form state is preserved
    // This check should happen *after* populating from existingSlipsData to allow edits to override loaded data.
    if (editingStudentId && studentSlipInputs[editingStudentId]) {
        newInputsFromEffect[editingStudentId] = studentSlipInputs[editingStudentId];
        // If the student being edited has non-empty data (even if just in form), ensure they are in initialLoaded for tab logic.
        if (!isSlipInputEmpty(newInputsFromEffect[editingStudentId])) {
          newInitialLoadedIdsFromEffect.add(editingStudentId);
        }
    }
        
    setStudentSlipInputs(newInputsFromEffect);
    setInitialLoadedStudentSlipIds(newInitialLoadedIdsFromEffect);
    
  }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient, memoizedFormattedSelectedDateKey]);
  // Removed editingStudentId and studentSlipInputs from this effect's dependencies


  useEffect(() => {
    if (!isClient) return;
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null); 
    if (selectedClassId && selectedDate) {
       queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
       if (typeof refetchStudentsInClass === 'function') { 
           refetchStudentsInClass(); 
       }
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient, refetchStudentsInClass, queryClient]);


  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || {};
      let updatedEntry: StudentSlipInput = { ...currentEntry, [field]: value };

      if (field === 'testFormat' || field === 'score') {
        const masteryDetails = calculateMasteryDetails(
          field === 'testFormat' ? value as TestFormatPLC : updatedEntry.testFormat,
          field === 'score' ? String(value) : updatedEntry.score 
        );
        updatedEntry.lessonMasteryText = masteryDetails.text;
      }
      return { ...prev, [studentId]: updatedEntry };
    });
  }, []); // Empty dependency array for stable callback reference

  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    const result = studentsInSelectedClass.filter(student =>
      initialLoadedStudentSlipIds.has(student.id) &&
      student.id !== editingStudentId && 
      !isSlipInputEmpty(studentSlipInputs[student.id]) 
    );
    return result;
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);


  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const result = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    return result;
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents]);

  const saveSlipsMutation = useMutation({
    mutationFn: savePhieuLienLacRecords,
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: `Phiếu liên lạc đã được lưu cho ${variables.length} học sinh.` });
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      setEditingStudentId(null); 
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu phiếu liên lạc",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết (PERMISSION_DENIED hoặc lỗi index).`,
        variant: "destructive",
        duration: 7000,
      });
    },
  });


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
    
    let studentsToProcessForSave: HocSinh[];
    if (editingStudentId) {
        studentsToProcessForSave = studentsInSelectedClass.filter(s => s.id === editingStudentId);
    } else {
        studentsToProcessForSave = studentsInSelectedClass.filter(
            s => studentSlipInputs[s.id] || initialLoadedStudentSlipIds.has(s.id)
        );
    }


    studentsToProcessForSave.forEach(student => {
      const input = studentSlipInputs[student.id];
      if (input) { 
        const currentInput = input; 
        const masteryDetails = calculateMasteryDetails(currentInput.testFormat, currentInput.score);
        
        const scoreToSave = (currentInput.score === undefined || currentInput.score === null || String(currentInput.score).trim() === '') 
          ? null 
          : Number(currentInput.score);

        if (isNaN(scoreToSave as number) && scoreToSave !== null) {
            toast({ title: "Lỗi dữ liệu", description: `Điểm số không hợp lệ cho học sinh ${student.hoTen}. Sẽ bỏ qua mục này.`, variant: "destructive"});
            return; 
        }

        const record: Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt'> = {
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey, 
          testFormat: currentInput.testFormat || undefined,
          score: scoreToSave,
          lessonMasteryText: masteryDetails.text, 
          homeworkStatus: currentInput.homeworkStatus || undefined,
          vocabularyToReview: currentInput.vocabularyToReview || '',
          remarks: currentInput.remarks || '',
        };
        recordsToSave.push(record);
      } else {
         recordsToSave.push({ 
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey,
        });
      }
    });
    
    if (recordsToSave.length === 0 && !editingStudentId) { 
      toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." });
      return;
    }
    saveSlipsMutation.mutate(recordsToSave);
  };
  
  const handleEditSlip = (studentId: string) => {
    const studentToEdit = studentsInSelectedClass.find(s => s.id === studentId);
    if (studentToEdit) {
        const currentInputs = studentSlipInputs[studentId]; 
        if (currentInputs) {
             const mastery = calculateMasteryDetails(currentInputs.testFormat, currentInputs.score);
             setStudentSlipInputs(prev => ({...prev, [studentId]: {
                ...currentInputs, 
                lessonMasteryText: mastery.text, 
             }}));
        } else {
            const mastery = calculateMasteryDetails(undefined, '');
            setStudentSlipInputs(prev => ({...prev, [studentId]: {
                testFormat: undefined, score: '', lessonMasteryText: mastery.text, homeworkStatus: undefined, vocabularyToReview: '', remarks: '',
             }}));
        }
        setEditingStudentId(studentId);
        setActiveTab("nhap-diem");
        entryTabTriggerRef.current?.focus(); 
        entryTabTriggerRef.current?.click(); 
    } else {
        toast({ title: "Lỗi", description: "Không tìm thấy học sinh để sửa.", variant: "destructive"});
    }
  };

  const handleDeleteSlipEntry = (studentId: string) => {
    const masteryDetailsForEmpty = calculateMasteryDetails(undefined, null);
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
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho học sinh ${studentsInSelectedClass.find(s=>s.id === studentId)?.hoTen}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
    
    if (editingStudentId === studentId) { 
        setEditingStudentId(null); 
    }
  };

  const handleOpenSlipDialog = async (studentId: string) => {
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const inputData = studentSlipInputs[studentId];

    if (!student || !selectedClass || !inputData) {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu xem trước. Dữ liệu nhập chưa đầy đủ hoặc học sinh/lớp không tồn tại.", variant: "destructive" });
      return;
    }
    const masteryDetails = calculateMasteryDetails(inputData.testFormat, inputData.score);
    const slip: PhieuLienLacRecord = {
      id: existingSlipsData.find(s => s.studentId === student.id)?.id || '', 
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
    if (!html2canvas) {
      toast({ title: "Lỗi", description: "Chức năng xuất ảnh chưa sẵn sàng (html2canvas chưa được tải). Vui lòng cài đặt và khởi động lại.", variant: "destructive" });
      return;
    }
    if (!slipDialogContentRef.current || !currentSlipData) {
      toast({ title: "Lỗi", description: "Không có nội dung phiếu để xuất.", variant: "destructive"});
      return;
    }
    try {
      const canvas = await html2canvas(slipDialogContentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `PhieuLienLac_${currentSlipData.studentName?.replace(/\s+/g, '_')}_${currentSlipData.date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Thành công!", description: "Phiếu liên lạc đã được xuất ra ảnh." });
    } catch (error) {
      toast({ title: "Lỗi xuất ảnh", description: (error as Error).message, variant: "destructive" });
    }
  };
  
  const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
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
    else scoreTextColor = "text-orange-600 dark:text-orange-400"; 
    
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
  
  const saveButtonText = editingStudentId ? "Lưu Thay Đổi Cho HS Này" : "Lưu Tất Cả"; 
  
  const canSaveChanges = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;

    if (editingStudentId) {
        const currentInput = studentSlipInputs[editingStudentId];
        const originalSlip = existingSlipsData.find(s => s.studentId === editingStudentId);
        if (!originalSlip && !isSlipInputEmpty(currentInput)) return true; 
        if (originalSlip) {
            const originalComparable = {
                 testFormat: originalSlip.testFormat,
                 score: originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score),
                 lessonMasteryText: originalSlip.lessonMasteryText,
                 homeworkStatus: originalSlip.homeworkStatus,
                 vocabularyToReview: originalSlip.vocabularyToReview || '',
                 remarks: originalSlip.remarks || '',
            };
            return JSON.stringify(currentInput) !== JSON.stringify(originalComparable);
        }
        return !isSlipInputEmpty(currentInput); 
    }

    const hasMeaningfulChanges = studentsInSelectedClass.some(student => {
        const currentInput = studentSlipInputs[student.id];
        if (!currentInput) return false; 
        if (isSlipInputEmpty(currentInput)) {
            const originalSlip = existingSlipsData.find(s => s.studentId === student.id);
            return !!originalSlip && !isSlipInputEmpty({ 
                testFormat: originalSlip.testFormat,
                score: originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score),
                lessonMasteryText: originalSlip.lessonMasteryText,
                homeworkStatus: originalSlip.homeworkStatus,
                vocabularyToReview: originalSlip.vocabularyToReview || '',
                remarks: originalSlip.remarks || '',
            });
        }
        
        const originalSlip = existingSlipsData.find(s => s.studentId === student.id);
        if (!originalSlip) return true; 

        const originalComparable = {
             testFormat: originalSlip.testFormat,
             score: originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score),
             lessonMasteryText: originalSlip.lessonMasteryText,
             homeworkStatus: originalSlip.homeworkStatus,
             vocabularyToReview: originalSlip.vocabularyToReview || '',
             remarks: originalSlip.remarks || '',
        };
        return JSON.stringify(currentInput) !== JSON.stringify(originalComparable);
    });
    return hasMeaningfulChanges;
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, existingSlipsData]);

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
        {selectedClassId && selectedDate && isErrorExistingSlips && 
          <div className="p-4 text-destructive text-center border border-destructive/50 bg-destructive/10 rounded-md shadow-sm">
            <AlertCircle className="inline mr-2 h-5 w-5"/>Lỗi tải lịch sử phiếu liên lạc đã có.
            <p className="text-xs text-muted-foreground mt-1">Nguyên nhân có thể do thiếu Firestore Index hoặc vấn đề về quyền. Kiểm tra console server Next.js ({isErrorExistingSlips.message}).</p>
          </div>
        }


        {selectedClassId && selectedDate && !isErrorClasses && !isErrorStudents && (
          <Card className="shadow-md">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'nhap-diem' | 'lich-su')}>
                <TabsList className="grid w-full sm:w-auto sm:max-w-md grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger ref={entryTabTriggerRef} value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Nhập điểm ({studentsForEntryTab.length})
                  </TabsTrigger>
                  <TabsTrigger ref={historyTabTriggerRef} value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Lịch sử nhận xét ({studentsForHistoryTab.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && !editingStudentId && (
                    <p className="text-muted-foreground p-4 text-center">Tất cả học sinh đã có phiếu hoặc đã được chuyển sang tab Lịch sử. Chọn "Sửa" từ tab Lịch sử để chỉnh sửa.</p>
                  )}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsForEntryTab.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px] sticky top-0 bg-card z-10">Học sinh</TableHead>
                          <TableHead className="w-[180px] sticky top-0 bg-card z-10">Hình thức KT</TableHead>
                          <TableHead className="w-[100px] sticky top-0 bg-card z-10">Điểm</TableHead>
                          <TableHead className="w-[200px] sticky top-0 bg-card z-10">Thuộc bài?</TableHead>
                          <TableHead className="w-[200px] sticky top-0 bg-card z-10">Bài tập về nhà?</TableHead>
                          <TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Từ vựng cần học lại</TableHead>
                          <TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Nhận xét</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForEntryTab.map((student) => {
                          const currentInput = studentSlipInputs[student.id] || {};
                          const masteryDetails = calculateMasteryDetails(currentInput.testFormat, currentInput.score);
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
                          <TableHead className="w-[50px] sticky top-0 bg-card z-10">STT</TableHead>
                          <TableHead className="sticky top-0 bg-card z-10">Học sinh</TableHead>
                          <TableHead className="sticky top-0 bg-card z-10">Hình thức KT</TableHead>
                          <TableHead className="sticky top-0 bg-card z-10">Điểm</TableHead>
                          <TableHead className="sticky top-0 bg-card z-10">Thuộc bài?</TableHead>
                          <TableHead className="sticky top-0 bg-card z-10">Bài tập về nhà?</TableHead>
                          <TableHead className="text-right w-[150px] sticky top-0 bg-card z-10">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForHistoryTab.map((student, index) => {
                          const slipData = studentSlipInputs[student.id] || {};
                          const masteryDetails = calculateMasteryDetails(slipData.testFormat, slipData.score);
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
                                  <Button variant="outline" size="icon" onClick={() => handleEditSlip(student.id)} aria-label="Sửa phiếu" disabled={saveSlipsMutation.isPending}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(student.id)} aria-label="Xóa phiếu (cục bộ)" disabled={saveSlipsMutation.isPending}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(student.id)} aria-label="Xuất phiếu" disabled={saveSlipsMutation.isPending}>
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
             { (activeTab === 'nhap-diem' || (activeTab === 'lich-su' && canSaveChanges)) && selectedClassId && selectedDate && studentsInSelectedClass.length > 0 && (
              <CardFooter className="border-t pt-6">
                <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                  {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveButtonText}
                </Button>
                 {editingStudentId && (
                    <Button variant="ghost" onClick={() => { setEditingStudentId(null); setActiveTab('lich-su'); historyTabTriggerRef.current?.focus(); historyTabTriggerRef.current?.click();}} className="ml-2" disabled={saveSlipsMutation.isPending}>
                        Hủy Sửa & Quay Lại Lịch Sử
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
              <div ref={slipDialogContentRef} className="p-6 bg-card font-sans text-sm leading-normal"> 
                {currentSlipData ? (
                  <div className="space-y-1"> 
                    <div className="grid grid-cols-2 gap-x-2 mb-2">
                        <p><strong className="font-semibold">Họ và tên:</strong> <span className="text-indigo-700 font-semibold">{currentSlipData.studentName}</span></p>
                        <p><strong className="font-semibold">Mã HS:</strong> {currentSlipData.studentId}</p>
                        <p><strong className="font-semibold">Lớp:</strong> {currentSlipData.className}</p>
                        <p><strong className="font-semibold">Ngày KT:</strong> {format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}</p>
                    </div>
                    <SlipDetailItem label="Hình thức KT">{currentSlipData.testFormat || "N/A"}</SlipDetailItem>
                    <SlipDetailItem label="Điểm số">{renderScoreDisplay(currentSlipData.score)}</SlipDetailItem>
                    <SlipDetailItem label="Thuộc bài">
                        <span className={cn("font-medium", getLessonMasteryTextColor(currentSlipData.lessonMasteryText, calculateMasteryDetails(currentSlipData.testFormat, currentSlipData.score).isTrulyMastered))}>
                            {currentSlipData.lessonMasteryText || "Chưa đánh giá"}
                        </span>
                    </SlipDetailItem>
                    <SlipDetailItem label="Bài tập về nhà">
                        <span className={cn("font-medium", getHomeworkStatusColor(currentSlipData.homeworkStatus))}>
                           {currentSlipData.homeworkStatus || "Không có bài tập về nhà"}
                        </span>
                    </SlipDetailItem>
                    <SlipDetailItem label="Từ vựng cần học lại">{currentSlipData.vocabularyToReview || "Không có"}</SlipDetailItem>
                    <SlipDetailItem label="Nhận xét">{currentSlipData.remarks || "Không có nhận xét."}</SlipDetailItem>
                    
                    <Separator className="my-3"/>

                    <div className="text-foreground mt-3 leading-relaxed">
                        <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.</p>
                        <p className="mt-2">Trân trọng.</p>
                    </div>
                  </div>
                ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-4 border-t sm:justify-between">
              <DialogClose asChild>
                  <Button type="button" variant="outline">Đóng</Button>
              </DialogClose>
              <Button 
                onClick={handleExportSlipImage} 
                disabled={!currentSlipData || saveSlipsMutation.isPending || (typeof html2canvas === 'undefined')}
              >
                 {(typeof html2canvas === 'undefined' && !saveSlipsMutation.isPending) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                 {(typeof html2canvas === 'undefined' && !saveSlipsMutation.isPending) ? "Đang tải thư viện..." : "Xuất file ảnh"}
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
