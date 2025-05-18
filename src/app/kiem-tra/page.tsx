
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
// import html2canvas from 'html2canvas'; // Temporarily commented for stability
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { saveTestScores, getTestScoresForClassOnDate } from '@/services/testScoreService';
import type { LopHoc, HocSinh, TestScoreRecord, StudentScoreInput, HomeworkStatus, TestFormat } from '@/lib/types';
import { ALL_HOMEWORK_STATUSES, ALL_TEST_FORMATS } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, FileText, Save, Printer, AlertCircle, Download, Info, ListChecks, Edit3, Star, Loader2, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

declare global { // Declare html2canvas globally if not using direct import
    var html2canvas: any;
}

const calculateMasteryDetails = (testFormat?: TestFormat, scoreInput?: number | string | null): { text: string; isMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== '' && scoreInput !== null && !isNaN(Number(scoreInput)) ? Number(scoreInput) : undefined;

  if (!testFormat || testFormat === "") return { text: "Chưa chọn hình thức KT", isMastered: false };

  switch (testFormat) {
    case "Kiểm tra bài cũ":
    case "Kiểm tra miệng": 
      if (score === 10) return { text: "Đã thuộc bài", isMastered: true };
      if (score === 9) return { text: "Thuộc bài nhưng còn sai sót", isMastered: true };
      if (testFormat === "Kiểm tra miệng") {
        if (score !== undefined && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isMastered: false };
        if (score !== undefined && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isMastered: false };
      }
      if (score !== undefined && score < (testFormat === "Kiểm tra miệng" ? 5 : 9) && score >=0) return { text: "Chưa thuộc bài", isMastered: false };
      return { text: "Chưa có điểm/đánh giá", isMastered: false };
    case "Kiểm tra 15 phút":
    case "Kiểm tra 45 phút":
    case "Chấm bài tập":
      if (score !== undefined) return { text: "Đã chấm điểm", isMastered: score >= 5 }; 
      return { text: "Không kiểm tra từ vựng", isMastered: false }; 
    default:
      return { text: "Chưa đánh giá", isMastered: false };
  }
};

const isScoreEntryEmpty = (entry: StudentScoreInput | undefined): boolean => {
  if (!entry) return true;
  return (
    (entry.score === undefined || entry.score === '' || entry.score === null) &&
    (entry.testFormat === undefined || entry.testFormat === "" || entry.testFormat === null) &&
    (entry.vocabularyToReview === undefined || entry.vocabularyToReview === '') &&
    (entry.generalRemarks === undefined || entry.generalRemarks === '') &&
    (entry.homeworkStatus === undefined || entry.homeworkStatus === '' || entry.homeworkStatus === null)
  );
};


export default function KiemTraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gradeSlipDialogContentRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("nhap-diem");

  const [isGradeSlipModalOpen, setIsGradeSlipModalOpen] = useState(false);
  const [gradeSlipData, setGradeSlipData] = useState<ReportData | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formattedDateForEffectKey = useMemo(() => format(selectedDate, 'yyyyMMdd'), [selectedDate]);
  const formattedDateForQueryKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);


  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const activeClasses = useMemo(() => classes.filter(c => c.trangThai === 'Đang hoạt động'), [classes]);

  const {
    data: studentsInSelectedClass = [],
    // isLoading: isLoadingStudents, // isLoadingStudents will be derived from the query below
    // isError: isErrorStudents,
    refetch: refetchStudentsInClass,
  } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', selectedClassId],
    queryFn: () => selectedClassId ? getStudentsByClassId(selectedClassId) : Promise.resolve([]),
    enabled: !!selectedClassId && isClient,
  });
  
  const {
    data: existingScoresData,
    isLoading: isLoadingExistingScoresAndStudents, // Combined loading state
    isError: isErrorExistingScoresOrStudents, // Combined error state
    error: errorExistingScoresOrStudents,
  } = useQuery<TestScoreRecord[], Error>({
    queryKey: ['existingTestScores', selectedClassId, formattedDateForQueryKey],
    queryFn: () => {
      if (!selectedClassId || !selectedDate) {
        return Promise.resolve([]);
      }
      // This query implicitly depends on studentsInSelectedClass being loaded too for full context,
      // but for simplicity, we keep it focused on scores. Page-level isLoadingData handles combined state.
      return getTestScoresForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && isClient,
  });

  const isLoadingStudents = useQuery({ queryKey: ['studentsInClass', selectedClassId] }).isLoading;
  const isErrorStudents = useQuery({ queryKey: ['studentsInClass', selectedClassId] }).isError;


  // Effect to reset scores when class or date changes
  useEffect(() => {
    if (isClient) {
      setStudentScores({});
      setInitialLoadedStudentIds(new Set<string>());
      setEditingStudentId(null);
    }
  }, [selectedClassId, formattedDateForEffectKey, isClient]);


  // Effect to populate studentScores and initialLoadedStudentIds from existingScoresData
useEffect(() => {
  if (isClient && !isLoadingExistingScoresAndStudents && studentsInSelectedClass && existingScoresData) {
    const newScores: Record<string, StudentScoreInput> = {};
    const newInitialLoadedIds = new Set<string>();

    studentsInSelectedClass.forEach(student => {
      const scoreRecord = existingScoresData.find(sr => sr.studentId === student.id);
      if (scoreRecord) {
        const masteryDetails = calculateMasteryDetails(scoreRecord.testFormat, scoreRecord.score);
        newScores[student.id] = {
          score: (scoreRecord.score !== undefined && scoreRecord.score !== null) ? String(scoreRecord.score) : '',
          testFormat: scoreRecord.testFormat || "",
          masteredLesson: masteryDetails.isMastered,
          vocabularyToReview: scoreRecord.vocabularyToReview || '',
          generalRemarks: scoreRecord.generalRemarks || '',
          homeworkStatus: scoreRecord.homeworkStatus || '',
        };
        if (!isScoreEntryEmpty(newScores[student.id])) {
          newInitialLoadedIds.add(student.id);
        }
      } else {
        // Always initialize with an empty structure if no existing record
        newScores[student.id] = {
          score: '', testFormat: "", masteredLesson: false,
          vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
        };
      }
    });
    setStudentScores(newScores); // Directly set, overwriting previous state for this class/date
    setInitialLoadedStudentIds(newInitialLoadedIds);
  }
}, [existingScoresData, studentsInSelectedClass, isLoadingExistingScoresAndStudents, isClient]);


  const handleScoreInputChange = (studentId: string, field: keyof StudentScoreInput, value: any) => {
    setStudentScores(prev => {
        const currentEntry = prev[studentId] || { masteredLesson: false, score: '', testFormat: "", vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
        const updatedEntry = { ...currentEntry, [field]: value };

        if (field === 'score' || field === 'testFormat') {
            const masteryDetails = calculateMasteryDetails(updatedEntry.testFormat, updatedEntry.score);
            updatedEntry.masteredLesson = masteryDetails.isMastered;
        }
        return { ...prev, [studentId]: updatedEntry };
    });
  };

  const saveScoresMutation = useMutation({
    mutationFn: (records: TestScoreRecord[]) => saveTestScores(records),
    onSuccess: (data, variables) => {
      toast({
        title: "Lưu điểm thành công!",
        description: "Điểm kiểm tra đã được ghi nhận.",
      });
      if (selectedClassId && selectedDate) {
        queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, formattedDateForQueryKey] });
      }
      setEditingStudentId(null); 
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu điểm",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
    },
  });

  const handleSaveAllScores = () => {
    if (!selectedClassId || !selectedDate) {
      toast({ title: "Thông tin chưa đầy đủ", description: "Vui lòng chọn lớp và ngày kiểm tra.", variant: "destructive" });
      return;
    }
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);
    if (!selectedClass) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" });
      return;
    }

    const recordsToSave: TestScoreRecord[] = [];
    
    Object.keys(studentScores).forEach(studentId => {
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        if (!student) return; 

        const currentScoreInput = studentScores[studentId];
        
        if (isScoreEntryEmpty(currentScoreInput) && !initialLoadedStudentIds.has(studentId) && editingStudentId !== studentId) {
           return;
        }
         
        const scoreValue = (currentScoreInput?.score !== undefined && currentScoreInput?.score !== null && String(currentScoreInput?.score).trim() !== '' && !isNaN(Number(currentScoreInput.score)))
          ? Number(currentScoreInput.score)
          : null;

        const masteryDetails = calculateMasteryDetails(currentScoreInput?.testFormat, scoreValue);

        recordsToSave.push({
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          testDate: formattedDateForQueryKey, 
          testFormat: currentScoreInput?.testFormat || "",
          score: scoreValue, 
          masteredLesson: masteryDetails.isMastered,
          vocabularyToReview: currentScoreInput?.vocabularyToReview || '',
          generalRemarks: currentScoreInput?.generalRemarks || '',
          homeworkStatus: currentScoreInput?.homeworkStatus || '',
        });
    });

    console.log("[KiemTraPage] Records to save:", recordsToSave);
    if (recordsToSave.length === 0) {
      toast({ title: "Không có dữ liệu mới hoặc thay đổi để lưu", description: "Vui lòng nhập điểm hoặc thực hiện thay đổi.", variant: "default" });
      return;
    }
    saveScoresMutation.mutate(recordsToSave);
  };

  const handleEditScore = (studentIdToEdit: string) => {
    console.log(`[KiemTraPage] handleEditScore called for studentId: ${studentIdToEdit}`);
    setEditingStudentId(studentIdToEdit);
    setActiveTab("nhap-diem");
    requestAnimationFrame(() => {
        const entryTabTrigger = document.querySelector<HTMLButtonElement>('button[role="tab"][data-state="inactive"][value="nhap-diem"]');
        if (entryTabTrigger) {
            entryTabTrigger.click();
        }
    });
  };

  const handleDeleteScoreEntry = (studentIdToDelete: string) => {
    console.log(`[KiemTraPage] handleDeleteScoreEntry for studentId: ${studentIdToDelete}`);
    const masteryDetailsForEmpty = calculateMasteryDetails("", null); 
    setStudentScores(prev => ({
        ...prev,
        [studentIdToDelete]: {
            score: null, 
            testFormat: "",
            masteredLesson: masteryDetailsForEmpty.isMastered,
            vocabularyToReview: '',
            generalRemarks: '',
            homeworkStatus: '',
        }
    }));
    setEditingStudentId(studentIdToDelete); 
    setActiveTab("nhap-diem");
    toast({ title: "Đã xoá dữ liệu điểm cục bộ", description: `Dữ liệu điểm của học sinh đã được xoá khỏi form. Nhấn "Lưu" để cập nhật thay đổi này vào cơ sở dữ liệu.` });
  };


  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || isLoadingExistingScoresAndStudents || !studentsInSelectedClass) return [];
    return studentsInSelectedClass.filter(student =>
        initialLoadedStudentIds.has(student.id) && 
        student.id !== editingStudentId && 
        studentScores[student.id] && // Ensure score entry exists
        !isScoreEntryEmpty(studentScores[student.id]) 
    );
  }, [studentsInSelectedClass, studentScores, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingScoresAndStudents]);


  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || isLoadingExistingScoresAndStudents || !studentsInSelectedClass) return [];
    
    if (editingStudentId) {
        const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
        return studentBeingEdited ? [studentBeingEdited] : [];
    }
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingScoresAndStudents]);


  const StarRating = ({ count }: { count: number }) => (
    <div className="inline-flex items-center ml-1">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 text-green-500 dark:text-green-400" fill="currentColor" />
      ))}
    </div>
  );

  const renderScoreDisplay = (scoreInput?: number | string | null) => {
    if (scoreInput === undefined || scoreInput === '' || scoreInput === null) {
      return <span className="font-semibold text-lg text-muted-foreground">N/A</span>;
    }
    const numScore = Number(scoreInput);
    if (isNaN(numScore)) {
      return <span className="font-semibold text-lg text-muted-foreground">{String(scoreInput)}</span>;
    }
    let scoreTextColor = "text-foreground"; let starCount = 0;
    if (numScore >= 9 && numScore <= 10) { scoreTextColor = "text-red-600 dark:text-red-400"; starCount = 5; }
    else if (numScore >= 7 && numScore <=8.9) { scoreTextColor = "text-blue-600 dark:text-blue-400"; starCount = 4; } 
    else if (numScore >= 5 && numScore <=6.9) { scoreTextColor = "text-violet-600 dark:text-violet-400"; starCount = 3; } 
    else if (numScore > 0) { scoreTextColor = "text-foreground"; starCount = numScore >= 3 ? 2 : (numScore > 0 ? 1 : 0); }
    else { scoreTextColor = "text-muted-foreground"; }
    return (<><span className={cn("font-semibold text-lg", scoreTextColor)}>{numScore}</span>{starCount > 0 && <StarRating count={starCount} />}</>);
  };
  
  const handlePrepareGradeSlipData = (studentId: string): ReportData | null => {
    if (!selectedClassId || !selectedDate) return null;
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const studentData = studentScores[studentId];
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);
    if (!student || !selectedClass || !studentData) return null; 

    const masteryDetails = calculateMasteryDetails(studentData.testFormat, studentData.score);
    const masteryText = masteryDetails.text;
    const isActuallyMastered = masteryDetails.isMastered; 
    const masteryColor = isActuallyMastered ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400";

    let homeworkText = "Không có bài tập về nhà";
    let homeworkColor = "text-muted-foreground";
    const homeworkStatus = studentData.homeworkStatus;
    if (homeworkStatus && homeworkStatus !== "") {
      switch (homeworkStatus) {
        case 'Có làm đầy đủ': homeworkText = "Có làm đầy đủ"; homeworkColor = "text-blue-600 dark:text-blue-400"; break;
        case 'Chỉ làm 1 phần': homeworkText = "Chỉ làm 1 phần"; homeworkColor = "text-orange-500 dark:text-orange-400"; break;
        case 'Không có làm': homeworkText = "Không có làm"; homeworkColor = "text-red-600 dark:text-red-400"; break;
        default: homeworkText = "Không có bài tập về nhà"; break;
      }
    }
    return {
      studentName: student.hoTen, studentId: student.id, className: selectedClass.tenLop,
      testDate: format(selectedDate, 'dd/MM/yyyy'), testFormat: studentData.testFormat, score: studentData.score,
      masteryText: masteryText, masteryColor: masteryColor,
      vocabularyToReview: studentData.vocabularyToReview || "Không có",
      remarks: studentData.generalRemarks || "Không có",
      homeworkText: homeworkText, homeworkStatusValue: homeworkStatus, homeworkColor: homeworkColor,
      footer: "Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.\nTrân trọng"
    };
  }

  const handleViewGradeSlip = (studentId: string) => {
    const data = handlePrepareGradeSlipData(studentId);
    if (data) {
      setGradeSlipData(data);
      setIsGradeSlipModalOpen(true);
    } else {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu điểm. Vui lòng thử lại hoặc kiểm tra dữ liệu điểm.", variant: "destructive" });
    }
  };

 const handleExportGradeSlipImage = async () => {
    if (!gradeSlipDialogContentRef.current) {
        toast({ title: "Lỗi", description: "Không tìm thấy nội dung phiếu điểm.", variant: "destructive" });
        return;
    }
    if (!gradeSlipData) {
        toast({ title: "Lỗi", description: "Không có dữ liệu phiếu điểm để xuất.", variant: "destructive" });
        return;
    }
    
    if (typeof html2canvas === 'undefined') {
       toast({ title: "Lỗi", description: "Thư viện html2canvas chưa sẵn sàng. Vui lòng thử lại sau hoặc cài đặt 'html2canvas'.", variant: "destructive"});
       console.error("html2canvas is not defined. Ensure it's imported and the package is installed.");
       return;
    }

    try {
        toast({ title: "Đang xử lý...", description: "Phiếu điểm đang được tạo, vui lòng đợi."});
        const canvas = await html2canvas(gradeSlipDialogContentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: true });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `PhieuLienLac_${gradeSlipData.studentName.replace(/\s+/g, '_')}_${gradeSlipData.testDate.replace(/\//g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Xuất thành công!", description: "Phiếu liên lạc đã được tải xuống." });
    } catch (error) {
        console.error("Error exporting grade slip to image:", error);
        toast({ title: "Lỗi khi xuất file", description: (error as Error).message || "Đã có lỗi xảy ra.", variant: "destructive" });
    }
  };


  const isLoadingData = isLoadingClasses || isLoadingStudents || isLoadingExistingScoresAndStudents;
  
  const canSaveChanges = useMemo(() => {
    if (saveScoresMutation.isPending) return false;
    if (editingStudentId && studentScores[editingStudentId] && !isScoreEntryEmpty(studentScores[editingStudentId])) {
      const originalRecord = existingScoresData?.find(s => s.id === editingStudentId);
      if (originalRecord) {
        const currentData = studentScores[editingStudentId];
        if (String(originalRecord.score ?? '') !== String(currentData.score ?? '') || 
            (originalRecord.testFormat || "") !== (currentData.testFormat || "") ||
            (originalRecord.homeworkStatus || "") !== (currentData.homeworkStatus || "") ||
            (originalRecord.vocabularyToReview || "") !== (currentData.vocabularyToReview || "") ||
            (originalRecord.generalRemarks || "") !== (currentData.generalRemarks || "")
        ) return true;
      } else { 
        return true; 
      }
    }
    return studentsInSelectedClass.some(student => 
      !initialLoadedStudentIds.has(student.id) && 
      studentScores[student.id] && 
      !isScoreEntryEmpty(studentScores[student.id])
    );
  }, [studentScores, existingScoresData, editingStudentId, studentsInSelectedClass, initialLoadedStudentIds, saveScoresMutation.isPending]);

  const saveButtonText = (activeTab === 'lich-su' && editingStudentId) ? "Lưu Thay Đổi Lịch Sử" : "Lưu Tất Cả Điểm";


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <FileText className="mr-3 h-8 w-8" /> Ghi Điểm Kiểm Tra
          </h1>
        </div>

        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle>Thông tin chung bài kiểm tra</CardTitle>
            <CardDescription>Chọn lớp và ngày để bắt đầu ghi điểm.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-select">Chọn Lớp</Label>
              <Select 
                value={selectedClassId || undefined} 
                onValueChange={(value) => {
                  setSelectedClassId(value);
                }} 
                disabled={isLoadingClasses}
              >
                <SelectTrigger id="class-select" className="w-full"><SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn một lớp"} /></SelectTrigger>
                <SelectContent>
                  {activeClasses.length > 0 ? activeClasses.map((lop) => (<SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>)) : <SelectItem value="no-class" disabled>Không có lớp nào đang hoạt động</SelectItem>}
                </SelectContent>
              </Select>
              {isErrorClasses && <p className="text-xs text-destructive">Lỗi tải danh sách lớp.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-date">Ngày Kiểm Tra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="test-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { if(date) setSelectedDate(date);}} initialFocus locale={vi} /></PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {selectedClassId && selectedDate && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Danh sách học sinh</CardTitle>
              <CardDescription>Lớp: {activeClasses.find(c => c.id === selectedClassId)?.tenLop || 'N/A'} - Ngày: {format(selectedDate, "dd/MM/yyyy", { locale: vi })}</CardDescription>
            </CardHeader>
            <CardContent>
              {(isErrorExistingScoresOrStudents || isErrorStudents) && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center mb-4"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải dữ liệu: { (errorExistingScoresOrStudents || useQuery({ queryKey: ['studentsInClass', selectedClassId] }).error)?.message || "Không thể tải dữ liệu."}<p className="text-xs ml-2">(Kiểm tra Firestore Index/Security Rules hoặc console server Next.js.)</p></div>)}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" id="tab-trigger-nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><Edit3 className="mr-2 h-4 w-4" /> Nhập điểm ({studentsForEntryTab.length})</TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><ListChecks className="mr-2 h-4 w-4" /> Lịch sử nhập ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-entry-${i}`} className="h-20 w-full" />)}</div>)}
                  {!isLoadingData && !isErrorExistingScoresOrStudents && !isErrorStudents && studentsForEntryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">{studentsInSelectedClass.length > 0 ? "Tất cả học sinh đã có điểm (hoặc đang được sửa ở đây). Chuyển sang tab 'Lịch sử nhập' để xem." : "Lớp này chưa có học sinh."}</p>)}
                  {!isLoadingData && !isErrorExistingScoresOrStudents && !isErrorStudents && studentsForEntryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">STT</TableHead>
                            <TableHead>Họ và Tên</TableHead>
                            <TableHead className="min-w-[180px]">Hình thức KT</TableHead>
                            <TableHead className="w-[100px]">Điểm số</TableHead>
                            <TableHead className="min-w-[200px]">Thuộc bài</TableHead>
                            <TableHead className="min-w-[200px]">Bài tập về nhà?</TableHead>
                            <TableHead className="min-w-[180px]">Từ vựng cần học lại</TableHead>
                            <TableHead className="min-w-[180px]">Nhận xét</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsForEntryTab.map((student, index) => {
                            const scoreEntry = studentScores[student.id] || {}; 
                            const masteryDetails = calculateMasteryDetails(scoreEntry.testFormat, scoreEntry.score);
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{student.hoTen} {student.id === editingStudentId && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">Đang sửa</Badge>}</TableCell>
                                <TableCell>
                                  <Select value={scoreEntry.testFormat || ""} onValueChange={(value) => handleScoreInputChange(student.id, 'testFormat', value as TestFormat)}>
                                    <SelectTrigger><SelectValue placeholder="Chọn hình thức" /></SelectTrigger>
                                    <SelectContent>{ALL_TEST_FORMATS.map(formatValue => (<SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>))}</SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell><Input type="text" placeholder="Điểm" value={scoreEntry.score ?? ''} onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.value)} className="w-full" /></TableCell>
                                <TableCell>{masteryDetails.text}</TableCell>
                                <TableCell>
                                  <Select value={scoreEntry.homeworkStatus || ''} onValueChange={(value) => handleScoreInputChange(student.id, 'homeworkStatus', value as HomeworkStatus)}>
                                    <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
                                    <SelectContent>
                                      {ALL_HOMEWORK_STATUSES.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell><Textarea placeholder="Liệt kê từ vựng..." value={scoreEntry.vocabularyToReview || ''} onChange={(e) => handleScoreInputChange(student.id, 'vocabularyToReview', e.target.value)} rows={1} /></TableCell>
                                <TableCell><Textarea placeholder="Nhận xét khác..." value={scoreEntry.generalRemarks || ''} onChange={(e) => handleScoreInputChange(student.id, 'generalRemarks', e.target.value)} rows={1} /></TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="lich-su">
                  {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-hist-${i}`} className="h-20 w-full" />)}</div>)}
                   {!isLoadingData && !isErrorExistingScoresOrStudents && !isErrorStudents && studentsForHistoryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">Chưa có điểm nào được lưu hoặc tải cho lựa chọn này. Hãy nhập điểm ở tab 'Nhập điểm'.</p>)}
                  {!isLoadingData && !isErrorExistingScoresOrStudents && !isErrorStudents && studentsForHistoryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">STT</TableHead>
                            <TableHead>Họ và Tên</TableHead>
                            <TableHead className="min-w-[180px]">Hình thức KT</TableHead>
                            <TableHead className="w-[100px]">Điểm số</TableHead>
                            <TableHead className="min-w-[200px]">Thuộc bài</TableHead>
                            <TableHead className="min-w-[200px]">Bài tập về nhà?</TableHead>
                            <TableHead className="min-w-[180px]">Từ vựng cần học lại</TableHead>
                            <TableHead className="min-w-[180px]">Nhận xét</TableHead>
                            <TableHead className="w-[200px] text-center">Hành động</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsForHistoryTab.map((student, index) => {
                            const scores = studentScores[student.id] || {}; 
                            const masteryDetails = calculateMasteryDetails(scores.testFormat, scores.score);
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{student.hoTen}</TableCell>
                                <TableCell>{scores.testFormat || 'N/A'}</TableCell>
                                <TableCell>{renderScoreDisplay(scores.score)}</TableCell>
                                <TableCell>{masteryDetails.text}</TableCell>
                                <TableCell>{scores.homeworkStatus || 'N/A'}</TableCell>
                                <TableCell className="text-xs max-w-xs truncate">{scores.vocabularyToReview || 'N/A'}</TableCell>
                                <TableCell className="text-xs max-w-xs truncate">{scores.generalRemarks || 'N/A'}</TableCell>
                                <TableCell className="text-center space-x-1">
                                  <Button variant="outline" size="icon" onClick={() => handleEditScore(student.id)} aria-label={`Sửa điểm cho ${student.hoTen}`} disabled={saveScoresMutation.isPending || editingStudentId === student.id}><Edit className="h-4 w-4" /></Button>
                                  <Button variant="outline" size="icon" onClick={() => handleDeleteScoreEntry(student.id)} aria-label={`Xóa (reset) điểm cho ${student.hoTen}`} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50" disabled={saveScoresMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
                                  <Button variant="outline" size="icon" onClick={() => handleViewGradeSlip(student.id)} aria-label={`Xuất phiếu điểm cho ${student.hoTen}`} disabled={saveScoresMutation.isPending}><Printer className="h-4 w-4" /></Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
            {(activeTab === 'nhap-diem' || (activeTab === 'lich-su' && canSaveChanges)) && selectedClassId && selectedDate && (studentsInSelectedClass.length > 0 || editingStudentId) && (
                <CardFooter className="justify-end border-t pt-6">
                    <Button onClick={handleSaveAllScores} disabled={saveScoresMutation.isPending || !canSaveChanges}>
                        {saveScoresMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                        {saveButtonText}
                    </Button>
                </CardFooter>
            )}
          </Card>
        )}
      </div>

      {isGradeSlipModalOpen && gradeSlipData && (
        <Dialog open={isGradeSlipModalOpen} onOpenChange={setIsGradeSlipModalOpen}>
          <DialogContent className="sm:max-w-lg p-0 font-sans"> 
            <div ref={gradeSlipDialogContentRef} className="p-6 bg-card font-sans leading-normal"> {/* Added font-sans and leading-normal */}
              <DialogHeader className="text-center mb-4"><ShadDialogTitle className="text-xl font-bold text-primary uppercase tracking-wider">PHIẾU LIÊN LẠC</ShadDialogTitle><ShadDialogDescription className="text-sm text-muted-foreground mt-1">Kết quả kiểm tra ngày: {gradeSlipData.testDate}</ShadDialogDescription></DialogHeader>
              <div className="space-y-1 text-sm"> 
                <p><span className="font-semibold">Họ và tên:</span> {gradeSlipData.studentName}</p>
                <p><span className="font-semibold">Mã HS:</span> {gradeSlipData.studentId}</p>
                <p><span className="font-semibold">Lớp:</span> {gradeSlipData.className}</p>
                {gradeSlipData.testFormat && <p><span className="font-semibold">Hình thức KT:</span> {gradeSlipData.testFormat}</p>}
                <div><span className="font-semibold">Điểm số: </span>{renderScoreDisplay(gradeSlipData.score)}</div>
                
                <p><span className="font-semibold">Thuộc bài:</span> <span className={cn("font-bold", gradeSlipData.masteryColor)}>{gradeSlipData.masteryText}</span></p>
                
                <div className="mt-2"><p className="font-semibold">Bài tập về nhà:</p><p className={cn("pl-2", gradeSlipData.homeworkColor, (!gradeSlipData.homeworkStatusValue || gradeSlipData.homeworkStatusValue === "") && "italic text-muted-foreground")}>{gradeSlipData.homeworkStatusValue && gradeSlipData.homeworkStatusValue !== "" ? gradeSlipData.homeworkText : "Không có bài tập về nhà"}</p></div>
                <div className="mt-2"><p className="font-semibold">Nhận xét:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.remarks}</p></div>
                <div className="mt-2"><p className="font-semibold">Từ vựng cần học lại:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.vocabularyToReview}</p></div>
                
                <div className="pt-3 mt-4 border-t"><p className="whitespace-pre-line text-lg text-foreground leading-relaxed">{gradeSlipData.footer}</p></div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-muted/50 sm:justify-between">
              <Button type="button" onClick={handleExportGradeSlipImage} disabled={saveScoresMutation.isPending || (typeof html2canvas === 'undefined')}>
                <Download className="mr-2 h-4 w-4" /> 
                {typeof html2canvas === 'undefined' ? "Đang tải html2canvas..." : "Xuất file ảnh"}
              </Button>
              <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

interface ReportData {
  studentName: string;
  studentId: string;
  className: string;
  testDate: string;
  testFormat?: TestFormat;
  score?: number | string | null;
  masteryText: string;
  masteryColor: string;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkText: string;
  homeworkStatusValue?: HomeworkStatus;
  homeworkColor: string;
  footer: string;
}

```