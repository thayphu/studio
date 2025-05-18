
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    // For these formats, mastery is not directly assessed based on score in this specific way.
    // We can default to a neutral or indicate no direct vocabulary check.
    return { text: "Không có KT bài", isTrulyMastered: false }; 
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};


export default function PhieuLienLacPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [studentSlipInputs, setStudentSlipInputs] = useState<Record<string, StudentSlipInput>>({});
  
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set());
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

  const isSlipInputEmpty = useCallback((entry: StudentSlipInput | undefined): boolean => {
    if (!entry) return true;
    const scoreIsEmpty = entry.score === undefined || entry.score === null || String(entry.score).trim() === '';
    return (
      (entry.testFormat === undefined || entry.testFormat === null || entry.testFormat === "") &&
      scoreIsEmpty &&
      (entry.homeworkStatus === undefined || entry.homeworkStatus === null || entry.homeworkStatus === "") &&
      (entry.vocabularyToReview === undefined || String(entry.vocabularyToReview).trim() === '') &&
      (entry.remarks === undefined || String(entry.remarks).trim() === '')
    );
  }, []);

  useEffect(() => {
    if (isLoadingExistingSlips || isLoadingStudents || !isClient) return;

    console.log("[PhieuLienLacPage] Syncing form with existingSlipsData and studentsInSelectedClass. EditingStudentId:", editingStudentId);
    const newSlipInputs: Record<string, StudentSlipInput> = {};
    const newLoadedIds = new Set<string>();

    studentsInSelectedClass.forEach(student => {
      const existingSlip = existingSlipsData.find(s => s.studentId === student.id);
      if (existingSlip) {
        const masteryDetails = calculateLessonMasteryDetails(existingSlip.testFormat, existingSlip.score);
        newSlipInputs[student.id] = {
          testFormat: existingSlip.testFormat,
          score: existingSlip.score === null ? '' : existingSlip.score,
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: existingSlip.homeworkStatus,
          vocabularyToReview: existingSlip.vocabularyToReview,
          remarks: existingSlip.remarks,
        };
        if (!isSlipInputEmpty(newSlipInputs[student.id])) {
          newLoadedIds.add(student.id);
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
    
    setStudentSlipInputs(newSlipInputs);
    setInitialLoadedStudentIds(newLoadedIds);
    
    const currentEditingStudentId = editingStudentId; // Capture current value for closure
    if (currentEditingStudentId && (!newLoadedIds.has(currentEditingStudentId) || (newSlipInputs[currentEditingStudentId] && isSlipInputEmpty(newSlipInputs[currentEditingStudentId])))) {
        console.log("[PhieuLienLacPage] Resetting editingStudentId because student is no longer in history or their entry is empty.");
        // setEditingStudentId(null); // Potential loop source if editingStudentId is in dependency array
    }

  }, [existingSlipsData, studentsInSelectedClass, isLoadingExistingSlips, isLoadingStudents, isClient, isSlipInputEmpty]); // Removed queryClient and editingStudentId


  useEffect(() => {
    if (!isClient) return;
    console.log("[PhieuLienLacPage] Date or Class changed. Resetting studentSlipInputs, initialLoadedStudentIds, editingStudentId.");
    setStudentSlipInputs({});
    setInitialLoadedStudentIds(new Set());
    setEditingStudentId(null);
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
      
      const currentInitialLoadedIds = initialLoadedStudentIds; // Capture for closure
      const currentEditingStudentId = editingStudentId; // Capture for closure

      if (currentInitialLoadedIds.has(studentId) && currentEditingStudentId !== studentId) {
         console.log(`[PhieuLienLacPage] Student ${studentId} was in history, now being edited. Setting editingStudentId.`);
         // This setEditingStudentId might be problematic if it causes rapid re-renders of this callback
         // setEditingStudentId(studentId); 
      }

      return { ...prev, [studentId]: updatedEntry };
    });
  }, [setStudentSlipInputs]); // Removed initialLoadedStudentIds and editingStudentId

  
  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentIds.has(student.id) &&
      student.id !== editingStudentId && 
      !isSlipInputEmpty(studentSlipInputs[student.id])
    );
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips, isSlipInputEmpty]);

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
    
    // Process students currently in studentSlipInputs
    for (const studentId in studentSlipInputs) {
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        if (!student) continue;

        const input = studentSlipInputs[studentId];
        const isCurrentlyEmpty = isSlipInputEmpty(input);
        const wasInitiallyLoaded = initialLoadedStudentIds.has(studentId);

        if (!isCurrentlyEmpty || (wasInitiallyLoaded && isCurrentlyEmpty) || studentId === editingStudentId) { 
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
                vocabularyToReview: String(input.vocabularyToReview || '').trim(),
                remarks: String(input.remarks || '').trim(),
            });
        }
    }
    
    if (recordsToSave.length === 0 && !editingStudentId) {
      toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin trước khi lưu." });
      return;
    }
    console.log("[PhieuLienLacPage] Saving records:", recordsToSave);
    saveSlipsMutation.mutate(recordsToSave);
  };
  
  const handleEditSlip = (studentId: string) => {
    console.log("[PhieuLienLacPage] Edit slip for studentId:", studentId);
    setEditingStudentId(studentId);
    setActiveTab("nhap-diem");
    if (!studentSlipInputs[studentId]) {
        const studentData = studentsInSelectedClass.find(s => s.id === studentId);
        const existingSlip = existingSlipsData.find(s => s.studentId === studentId);
        if (studentData) {
            const masteryDetails = calculateLessonMasteryDetails(existingSlip?.testFormat, existingSlip?.score);
            setStudentSlipInputs(prev => ({
                ...prev,
                [studentId]: existingSlip ? {
                    testFormat: existingSlip.testFormat,
                    score: existingSlip.score === null ? '' : existingSlip.score,
                    lessonMasteryText: masteryDetails.text,
                    homeworkStatus: existingSlip.homeworkStatus,
                    vocabularyToReview: existingSlip.vocabularyToReview,
                    remarks: existingSlip.remarks,
                } : { 
                    testFormat: undefined,
                    score: '',
                    lessonMasteryText: masteryDetails.text,
                    homeworkStatus: undefined,
                    vocabularyToReview: '',
                    remarks: '',
                }
            }));
        }
    }
  };

  const handleDeleteSlipEntry = (studentId: string) => {
    console.log("[PhieuLienLacPage] Clearing slip entry for studentId:", studentId);
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
    if (editingStudentId === studentId) {
        setEditingStudentId(null); 
    }
    setInitialLoadedStudentIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(studentId);
      return newSet;
    });
    setActiveTab("nhap-diem");
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
                    hoặc 
                    <code className="bg-muted p-1 rounded-sm mx-1">yarn add html2canvas</code>
                    sau đó khởi động lại server.
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

  const renderScoreDisplay = (scoreValue?: number | null) => {
    if (scoreValue === null || scoreValue === undefined) return <span className="text-muted-foreground">N/A</span>;
    const score = Number(scoreValue);
    let scoreTextColor = "text-foreground"; // Default color

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
    
    if (isTrulyMastered) { // "Thuộc bài", "Thuộc bài, còn sai sót ít"
        return "text-blue-600 dark:text-blue-400";
    }
    // "Thuộc bài, còn sai sót 1 vài từ", "Có học bài, còn sai sót nhiều"
    return "text-orange-500 dark:text-orange-400"; 
  };


  const isLoadingInitialData = isLoadingClasses || (selectedClassId && (isLoadingStudents || isLoadingExistingSlips));
  const noClassOrDateSelected = !selectedClassId || !selectedDate;

  const saveButtonText = activeTab === 'lich-su' && editingStudentId ? "Lưu Thay Đổi" : "Lưu Tất Cả";
  
  const canSaveChanges = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId && studentSlipInputs[editingStudentId] && !isSlipInputEmpty(studentSlipInputs[editingStudentId])) return true;

    const hasNewEntries = studentsForEntryTab.some(student => 
        studentSlipInputs[student.id] && !isSlipInputEmpty(studentSlipInputs[student.id])
    );
    if (hasNewEntries) return true;
    
    const hasClearedEntries = Array.from(initialLoadedStudentIds).some(id =>
        studentSlipInputs[id] && isSlipInputEmpty(studentSlipInputs[id])
    );
    if (hasClearedEntries) return true;

    return false;
  }, [studentSlipInputs, editingStudentId, studentsForEntryTab, initialLoadedStudentIds, saveSlipsMutation.isPending, isSlipInputEmpty]);


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
            <CardTitle>Thông tin chung bài phiếu liên lạc</CardTitle>
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

        {selectedClassId && selectedDate && (
          <Card className="shadow-md">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'nhap-diem' | 'lich-su')}>
                <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Nhập Phiếu ({studentsForEntryTab.length})</TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử Phiếu ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingInitialData && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!isLoadingInitialData && studentsForEntryTab.length === 0 && !editingStudentId && <p className="text-muted-foreground p-4 text-center">Không có học sinh nào cần nhập phiếu (hoặc tất cả đã ở tab Lịch sử).</p>}
                  {!isLoadingInitialData && (studentsForEntryTab.length > 0 || editingStudentId) && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Học sinh</TableHead>
                          <TableHead className="w-[180px]">Hình thức KT</TableHead>
                          <TableHead className="w-[100px]">Điểm</TableHead>
                          <TableHead className="w-[200px]">Thuộc bài?</TableHead>
                          <TableHead className="w-[200px]">Bài tập về nhà?</TableHead>
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
                                    {ALL_TEST_FORMATS_PLC.map(format => <SelectItem key={format} value={format}>{format}</SelectItem>)}
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
                  {!isLoadingInitialData && studentsForHistoryTab.length === 0 && <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lựa chọn này.</p>}
                  {!isLoadingInitialData && studentsForHistoryTab.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[150px]">Học sinh</TableHead>
                          <TableHead>Hình thức KT</TableHead>
                          <TableHead>Điểm</TableHead>
                          <TableHead>Thuộc bài?</TableHead>
                          <TableHead>Bài tập về nhà?</TableHead>
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
                              <TableCell>{renderScoreDisplay(slip.score === undefined || slip.score === null ? null : Number(slip.score))}</TableCell>
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
            {(activeTab === 'nhap-diem' || (activeTab === 'lich-su' && editingStudentId) ) && (
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
                  <div className="space-y-2 leading-normal text-sm"> {/* Reduced line spacing */}
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
                    
                    <Separator className="my-3"/>

                    <p className="text-sm text-foreground mt-3 leading-normal">
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
  <div className="grid grid-cols-[150px_1fr] items-start py-0.5"> {/* Reduced py */}
    <strong className="font-medium text-muted-foreground">{label}:</strong>
    <div>{children}</div>
  </div>
);

