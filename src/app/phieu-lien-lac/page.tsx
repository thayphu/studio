
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import DashboardLayout from '../dashboard-layout';
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
import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate } from '@/services/phieuLienLacService';
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { format, parseISO, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatCurrencyVND } from '@/lib/utils';
import html2canvas from 'html2canvas';
import { Separator } from '@/components/ui/separator';

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

  const { data: studentsInSelectedClass = [], isLoading: isLoadingStudents, refetch: refetchStudentsInClass } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', selectedClassId],
    queryFn: () => getStudentsByClassId(selectedClassId),
    enabled: !!selectedClassId && isClient,
  });

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    return format(selectedDate, 'yyyy-MM-dd');
  }, [selectedDate]);

  const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, refetch: refetchExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate),
    enabled: !!selectedClassId && !!selectedDate && isClient,
  });


  useEffect(() => {
    if (!isClient || isLoadingStudents || isLoadingExistingSlips) return;

    console.log("[PLC Page] Syncing scores. EditingStudentId:", editingStudentId);
    const newSlipInputs: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIds = new Set<string>();

    studentsInSelectedClass.forEach(student => {
      const existingSlip = existingSlipsData.find(s => s.studentId === student.id);
      if (existingSlip) {
        const masteryDetails = calculateLessonMasteryDetails(existingSlip.testFormat, existingSlip.score);
        newSlipInputs[student.id] = {
          testFormat: existingSlip.testFormat,
          score: existingSlip.score === null || existingSlip.score === undefined ? '' : String(existingSlip.score),
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: existingSlip.homeworkStatus,
          vocabularyToReview: existingSlip.vocabularyToReview || '',
          remarks: existingSlip.remarks || '',
        };
        if (!isSlipInputEmpty(newSlipInputs[student.id])) {
          newInitialLoadedIds.add(student.id);
        }
      } else {
        const masteryDetails = calculateLessonMasteryDetails(undefined, undefined);
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
    
    // Preserve editing student's current input if they are being edited
    if (editingStudentId && studentSlipInputs[editingStudentId]) {
        console.log("[PLC Page] Preserving input for editing student:", editingStudentId);
        newSlipInputs[editingStudentId] = { ...studentSlipInputs[editingStudentId] };
    }

    setStudentSlipInputs(newSlipInputs);
    setInitialLoadedStudentSlipIds(newInitialLoadedIds);
    
  }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient /* Removed queryClient, editingStudentId */]);


  useEffect(() => {
    if (!isClient) return;
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null);
    console.log("[PLC Page] Class or Date changed. Resetting local states.");
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
  }, [/* Empty dependency array */]);

  
  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentSlipIds.has(student.id) &&
      student.id !== editingStudentId && 
      !isSlipInputEmpty(studentSlipInputs[student.id])
    );
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);

  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);


  const saveSlipsMutation = useMutation({
    mutationFn: savePhieuLienLacRecords,
    onSuccess: () => {
      toast({ title: "Thành công!", description: "Phiếu liên lạc đã được lưu." });
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      setEditingStudentId(null); 
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu phiếu liên lạc",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
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
    
    // Process all students to correctly handle cleared entries and edited entries
    studentsInSelectedClass.forEach(student => {
        const input = studentSlipInputs[student.id];
        if (!input) return; 

        const isCurrentlyEmpty = isSlipInputEmpty(input);
        const wasInitiallyLoaded = initialLoadedStudentSlipIds.has(student.id);

        // Save if:
        // 1. It's the student being actively edited.
        // 2. It's a new entry that's not empty.
        // 3. It was an existing entry that has been modified (now empty or not empty).
        if (student.id === editingStudentId || !isCurrentlyEmpty || (wasInitiallyLoaded && isCurrentlyEmpty)) {
             const masteryDetails = calculateLessonMasteryDetails(input.testFormat, input.score);
             recordsToSave.push({
                studentId: student.id,
                studentName: student.hoTen,
                classId: selectedClassId,
                className: selectedClass.tenLop,
                date: memoizedFormattedSelectedDateKey,
                testFormat: input.testFormat || undefined, // Ensure it's undefined if empty
                score: (input.score === undefined || input.score === null || String(input.score).trim() === '') ? null : Number(input.score),
                lessonMasteryText: masteryDetails.text, 
                homeworkStatus: input.homeworkStatus || undefined, // Ensure it's undefined if empty
                vocabularyToReview: String(input.vocabularyToReview || '').trim(),
                remarks: String(input.remarks || '').trim(),
            });
        }
    });
    
    if (recordsToSave.length === 0 && !editingStudentId) { // No changes if not editing anyone and nothing new
      toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin hoặc thực hiện thay đổi trước khi lưu." });
      return;
    }
    saveSlipsMutation.mutate(recordsToSave);
  };
  
  const handleEditSlip = (studentId: string) => {
    setEditingStudentId(studentId);
    setActiveTab("nhap-diem");
    // Data for editing will be picked up by the main useEffect or already present in studentSlipInputs
  };

  const handleDeleteSlipEntry = (studentId: string) => {
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
    toast({ title: "Đã xoá dữ liệu phiếu cục bộ", description: "Nhấn 'Lưu' để cập nhật thay đổi vào cơ sở dữ liệu." });
    if (editingStudentId === studentId) { // If deleting the one being edited
        setEditingStudentId(null); // Stop editing mode
    }
    // The student will move to "Nhập điểm" tab due to empty data, or if already there, form clears.
  };

  const handleOpenSlipDialog = async (studentId: string) => {
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const slipInput = studentSlipInputs[studentId];
    const selectedClass = classes.find(c => c.id === selectedClassId);

    if (student && slipInput && selectedClass) {
      const masteryDetails = calculateLessonMasteryDetails(slipInput.testFormat, slipInput.score);
      const slipDetail: PhieuLienLacRecord = {
        id: student.id, 
        studentId: student.id,
        studentName: student.hoTen,
        classId: selectedClassId,
        className: selectedClass.tenLop,
        date: memoizedFormattedSelectedDateKey,
        testFormat: slipInput.testFormat,
        score: (slipInput.score === undefined || slipInput.score === null || String(slipInput.score).trim() === '') ? null : Number(slipInput.score),
        lessonMasteryText: masteryDetails.text,
        homeworkStatus: slipInput.homeworkStatus,
        vocabularyToReview: slipInput.vocabularyToReview,
        remarks: slipInput.remarks,
      };
      setCurrentSlipData(slipDetail);
      setIsSlipModalOpen(true);
    } else {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu, thiếu thông tin.", variant: "destructive" });
    }
  };

 const handleExportSlipImage = async () => {
    if (!slipDialogContentRef.current) {
      toast({ title: "Lỗi", description: "Không tìm thấy nội dung phiếu để xuất.", variant: "destructive" });
      return;
    }
    if (typeof html2canvas === 'undefined') {
        toast({ 
            title: "Lỗi thư viện", 
            description: (
                <span>
                    Thư viện html2canvas chưa tải. Vui lòng cài đặt bằng lệnh:
                    <code className="bg-muted p-1 rounded-sm mx-1">npm install html2canvas</code>
                    sau đó khởi động lại server. Hoặc tính năng này tạm thời bị vô hiệu hóa.
                </span>
            ), 
            variant: "destructive",
            duration: 10000,
        });
        return;
    }

    try {
      const canvas = await html2canvas(slipDialogContentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = image;
      link.download = `PhieuLienLac_${currentSlipData?.studentName?.replace(/\s+/g, '_')}_${currentSlipData?.date}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Thành công!", description: "Phiếu liên lạc đã được tải xuống." });
    } catch (error) {
      console.error("Error exporting grade slip to image:", error);
      toast({ title: "Lỗi xuất file", description: (error as Error).message, variant: "destructive" });
    }
  };
  
  const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined || score < 5) return null;
    let numStars = 0;
    if (score >= 9) numStars = 5;
    else if (score >= 7) numStars = 4;
    else if (score >= 5) numStars = 3;

    return (
      <div className="flex items-center ml-2">
        {[...Array(numStars)].map((_, i) => (
          <Star key={i} className="h-4 w-4 text-green-500 dark:text-green-400 fill-current" />
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

  const getLessonMasteryColor = (masteryText: string | undefined, isTrulyMastered: boolean) => {
    if (!masteryText) return "text-muted-foreground";
    if (masteryText.includes("Không có KT bài") || masteryText.includes("Chưa chọn")) return "text-muted-foreground";
    if (masteryText.includes("Không thuộc bài")) return "text-red-600 dark:text-red-400";
    
    if (isTrulyMastered) {
        return "text-blue-600 dark:text-blue-400";
    }
    return "text-orange-500 dark:text-orange-400"; 
  };


  const isLoadingInitialData = isLoadingClasses || (selectedClassId && (isLoadingStudents || isLoadingExistingSlips));
  
  const saveButtonText = editingStudentId ? "Lưu Thay Đổi" : "Lưu Tất Cả";
  
  const canSaveChanges = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId) return true; 

    const hasNewOrChangedEntries = studentsInSelectedClass.some(student => {
        const currentInput = studentSlipInputs[student.id];
        const originalSlip = existingSlipsData.find(s => s.studentId === student.id);
        
        if (!originalSlip && currentInput && !isSlipInputEmpty(currentInput)) {
            return true; // New entry with data
        }
        if (originalSlip && currentInput) { // Existing entry, check for changes
            const originalIsEmpty = isSlipInputEmpty({
                testFormat: originalSlip.testFormat,
                score: originalSlip.score,
                homeworkStatus: originalSlip.homeworkStatus,
                vocabularyToReview: originalSlip.vocabularyToReview,
                remarks: originalSlip.remarks,
            });
            const currentIsEmpty = isSlipInputEmpty(currentInput);
            if (originalIsEmpty !== currentIsEmpty) return true; // Changed from empty to not-empty or vice-versa
            if (!currentIsEmpty) { // Both not empty, compare fields
                 if (originalSlip.testFormat !== currentInput.testFormat) return true;
                 if (Number(originalSlip.score) !== Number(currentInput.score) && !(isNaN(Number(originalSlip.score)) && isNaN(Number(currentInput.score)))) return true;
                 if (originalSlip.homeworkStatus !== currentInput.homeworkStatus) return true;
                 if (originalSlip.vocabularyToReview !== currentInput.vocabularyToReview) return true;
                 if (originalSlip.remarks !== currentInput.remarks) return true;
            }
        }
        return false;
    });
    return hasNewOrChangedEntries;
  }, [studentSlipInputs, editingStudentId, studentsInSelectedClass, existingSlipsData, saveSlipsMutation.isPending]);


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
                setActiveTab(value as 'nhap-diem' | 'lich-su');
                if (value === 'lich-su' && editingStudentId) {
                    // If switching to history tab while editing, save changes or discard? For now, just switch.
                    // Consider prompting user or auto-saving if moving away from an active edit.
                }
              }}>
                <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Nhập Phiếu ({studentsForEntryTab.length})</TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử Phiếu ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingInitialData && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!isLoadingInitialData && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!isLoadingInitialData && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && !editingStudentId && <p className="text-muted-foreground p-4 text-center">Tất cả học sinh đã có phiếu hoặc đang được hiển thị ở tab Lịch sử.</p>}
                  {!isLoadingInitialData && (studentsForEntryTab.length > 0 || editingStudentId) && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Học sinh</TableHead>
                          <TableHead className="w-[180px]">Hình thức</TableHead>
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
                              <TableCell className={cn(getLessonMasteryColor(masteryDetails.text, masteryDetails.isTrulyMastered))}>
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
                  {!isLoadingInitialData && studentsForHistoryTab.length === 0 && <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lựa chọn này.</p>}
                  {!isLoadingInitialData && studentsForHistoryTab.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Học sinh</TableHead>
                          <TableHead>Hình thức</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Thuộc bài?</TableHead>
                          <TableHead>Bài tập về nhà</TableHead>
                          <TableHead className="w-[150px] text-right">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForHistoryTab.map((student) => {
                          const slip = studentSlipInputs[student.id] || {};
                           const masteryDetails = calculateLessonMasteryDetails(slip.testFormat, slip.score);
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell>{slip.testFormat || 'N/A'}</TableCell>
                              <TableCell>{renderScoreDisplay(slip.score)}</TableCell>
                              <TableCell className={cn(getLessonMasteryColor(masteryDetails.text, masteryDetails.isTrulyMastered))}>
                                {masteryDetails.text}
                                </TableCell>
                              <TableCell className={cn(getHomeworkStatusColor(slip.homeworkStatus))}>
                                {slip.homeworkStatus || 'N/A'}
                                </TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button variant="outline" size="icon" onClick={() => handleEditSlip(student.id)} aria-label="Sửa Phiếu">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(student.id)} aria-label="Xóa Phiếu">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button variant="secondary" size="icon" onClick={() => handleOpenSlipDialog(student.id)} aria-label="Xuất Phiếu">
                                  <Printer className="h-4 w-4" />
                                </Button>
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
            {( (activeTab === 'nhap-diem' && (studentsForEntryTab.length > 0 || editingStudentId)) || canSaveChanges ) && (
              <CardFooter>
                <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                  {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveButtonText}
                </Button>
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
              <div ref={slipDialogContentRef} className="p-6 bg-card font-sans">
                {currentSlipData ? (
                  <div className="space-y-1 leading-tight text-sm">
                    <div className="grid grid-cols-2 gap-x-2 mb-2">
                        <p><strong className="font-semibold">Họ và tên:</strong> <span className="text-indigo-700 font-semibold">{currentSlipData.studentName}</span></p>
                        <p><strong className="font-semibold">Mã HS:</strong> {currentSlipData.studentId}</p>
                        <p><strong className="font-semibold">Lớp:</strong> {currentSlipData.className}</p>
                        <p><strong className="font-semibold">Hình thức KT:</strong> {currentSlipData.testFormat || "N/A"}</p>
                    </div>
                    
                    <Separator/>
                    
                    <SlipDetailItem label="Điểm số">{renderScoreDisplay(currentSlipData.score)}</SlipDetailItem>
                    <SlipDetailItem label="Thuộc bài">
                        <span className={cn(getLessonMasteryColor(currentSlipData.lessonMasteryText, calculateLessonMasteryDetails(currentSlipData.testFormat, currentSlipData.score).isTrulyMastered))}>
                            {currentSlipData.lessonMasteryText || "Chưa đánh giá"}
                        </span>
                    </SlipDetailItem>
                     <SlipDetailItem label="Từ vựng cần học lại">{currentSlipData.vocabularyToReview || "Không có"}</SlipDetailItem>
                    <SlipDetailItem label="Bài tập về nhà">
                        <span className={cn(getHomeworkStatusColor(currentSlipData.homeworkStatus))}>
                            {currentSlipData.homeworkStatus || "Không có bài tập về nhà"}
                        </span>
                    </SlipDetailItem>
                    <SlipDetailItem label="Nhận xét">{currentSlipData.remarks || "Không có nhận xét."}</SlipDetailItem>
                    
                    <Separator className="my-2"/>

                    <p className="text-sm text-foreground mt-2 leading-normal">
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
              <Button onClick={handleExportSlipImage} disabled={!currentSlipData || typeof html2canvas === 'undefined'}>
                {typeof html2canvas === 'undefined' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                {typeof html2canvas === 'undefined' ? "Đang tải thư viện..." : "Xuất file ảnh"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout> 
  );
}

const SlipDetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[150px_1fr] items-start py-0.5"> 
    <strong className="font-medium text-muted-foreground">{label}:</strong>
    <div>{children}</div>
  </div>
);

    
