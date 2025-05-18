
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { saveTestScores, getTestScoresForClassOnDate } from '@/services/testScoreService';
import type { LopHoc, HocSinh, TestScoreRecord, StudentScoreInput, HomeworkStatus } from '@/lib/types';
import { ALL_HOMEWORK_STATUSES } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, FileText, Save, Printer, AlertCircle, Download, Info, ListChecks, Edit3, Star, Loader2, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ReportData {
  studentName: string;
  studentId: string;
  className: string;
  testDate: string;
  score?: number | string;
  mastery: string;
  masteryColor: string;
  vocabularyToReview?: string;
  remarks?: string;
  homework: string;
  homeworkStatusValue?: HomeworkStatus;
  homeworkColor: string;
  footer: string;
}

const isScoreEntryEmpty = (entry: StudentScoreInput | undefined): boolean => {
  if (!entry) return true;
  return (
    (entry.score === undefined || entry.score === '') &&
    entry.masteredLesson === false &&
    (entry.vocabularyToReview === undefined || entry.vocabularyToReview === '') &&
    (entry.generalRemarks === undefined || entry.generalRemarks === '') &&
    (entry.homeworkStatus === undefined || entry.homeworkStatus === '' || entry.homeworkStatus === null)
  );
};


export default function KiemTraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gradeSlipDialogContentRef = useRef<HTMLDivElement>(null); 

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});
  
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);


  const [isGradeSlipModalOpen, setIsGradeSlipModalOpen] = useState(false);
  const [gradeSlipData, setGradeSlipData] = useState<ReportData | null>(null);


  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const activeClasses = useMemo(() => classes.filter(c => c.trangThai === 'Đang hoạt động'), [classes]);

  const {
    data: studentsInSelectedClass = [],
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
    refetch: refetchStudentsInClass,
  } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', selectedClassId],
    queryFn: () => selectedClassId ? getStudentsByClassId(selectedClassId) : Promise.resolve([]),
    enabled: !!selectedClassId,
  });
  
  useEffect(() => {
    if (selectedClassId && selectedDate) {
      console.log("[KiemTraPage] Class or Date changed. Resetting states and refetching scores.");
      setStudentScores({});
      setInitialLoadedStudentIds(new Set());
      setEditingStudentId(null); 
      queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, format(selectedDate, 'yyyy-MM-dd')] });
    }
  }, [selectedClassId, selectedDate, queryClient]);

  const formattedTestDateForQuery = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const { 
    data: existingScoresData, 
    isLoading: isLoadingExistingScores,
    isError: isErrorExistingScores,
    error: errorExistingScores,
  } = useQuery<TestScoreRecord[], Error>({
    queryKey: ['existingTestScores', selectedClassId, formattedTestDateForQuery],
    queryFn: () => {
      if (!selectedClassId || !selectedDate) {
        return Promise.resolve([]);
      }
      return getTestScoresForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate,
  });

  useEffect(() => {
    if (existingScoresData) { 
      console.log("[KiemTraPage] Populating form with existing scores:", existingScoresData);
      const newScores: Record<string, StudentScoreInput> = {};
      const newInitialLoadedIds = new Set<string>();

      studentsInSelectedClass.forEach(student => { 
        const scoreRecord = existingScoresData.find(sr => sr.studentId === student.id);
        if (scoreRecord) {
            newScores[scoreRecord.studentId] = {
                score: scoreRecord.score !== undefined ? String(scoreRecord.score) : '',
                masteredLesson: scoreRecord.masteredLesson || false,
                vocabularyToReview: scoreRecord.vocabularyToReview || '',
                generalRemarks: scoreRecord.generalRemarks || '',
                homeworkStatus: scoreRecord.homeworkStatus || '',
            };
            if (!isScoreEntryEmpty(newScores[scoreRecord.studentId])) {
                newInitialLoadedIds.add(scoreRecord.studentId);
            }
        } else {
            // Ensure all students have an entry, even if empty
            newScores[student.id] = { masteredLesson: false, score: '', vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
        }
      });
      
      setStudentScores(newScores);
      setInitialLoadedStudentIds(newInitialLoadedIds);
      
      // If the student being edited is no longer in initialLoadedStudentIds (e.g., data was cleared by a save)
      // or their score entry became empty, reset editingStudentId.
      if (editingStudentId && (!newInitialLoadedIds.has(editingStudentId) || isScoreEntryEmpty(newScores[editingStudentId]))) {
        console.log(`[KiemTraPage] Resetting editingStudentId ${editingStudentId} as they are no longer in history or their entry is empty.`);
        setEditingStudentId(null);
      }
      console.log("[KiemTraPage] After populating/refreshing with existing scores, studentScores:", newScores, "initialLoadedStudentIds:", newInitialLoadedIds, "editingStudentId:", editingStudentId);
    }
  }, [existingScoresData, studentsInSelectedClass]);


  const handleScoreInputChange = (studentId: string, field: keyof StudentScoreInput | 'homeworkStatus', value: any) => {
    setStudentScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { masteredLesson: false, score: undefined, vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' }),
        [field as keyof StudentScoreInput]: value,
      },
    }));
     
    if (initialLoadedStudentIds.has(studentId) && editingStudentId !== studentId) {
      console.log(`[KiemTraPage] Student ${studentId} was in history, now being edited. Setting editingStudentId.`);
      setEditingStudentId(studentId); // Move to entry/edit mode if they were in history
    }
  };


  const saveScoresMutation = useMutation({
    mutationFn: (records: TestScoreRecord[]) => saveTestScores(records),
    onSuccess: (data, variables) => { 
      toast({
        title: "Lưu điểm thành công!",
        description: "Điểm kiểm tra đã được ghi nhận.",
      });
      queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, formattedTestDateForQuery] });
      // After saving, existingScoresData will refetch. The useEffect for existingScoresData will then
      // update studentScores and initialLoadedStudentIds.
      // If a student was being edited, and their score is now non-empty, they should appear in history.
      // We also reset editingStudentId here to ensure the form view updates correctly after save.
      setEditingStudentId(null);
      console.log("[KiemTraPage] Save successful, editingStudentId reset to null.");
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu điểm",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
      console.error("[KiemTraPage] Error saving scores in mutation:", error);
    },
  });

 const handleSaveAllScores = () => {
    if (!selectedClassId || !selectedDate) {
      toast({
        title: "Thông tin chưa đầy đủ",
        description: "Vui lòng chọn lớp và ngày kiểm tra.",
        variant: "destructive",
      });
      return;
    }

    const selectedClass = activeClasses.find(c => c.id === selectedClassId);
    if (!selectedClass) {
        toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" });
        return;
    }
    
    const recordsToSave: TestScoreRecord[] = studentsInSelectedClass
    .map(student => {
        const currentScoreInput = studentScores[student.id];
        
        // Only save if there's an entry for the student and it's not empty,
        // OR if the student was in the initial loaded data (meaning we might be clearing their score).
        if (!currentScoreInput && !initialLoadedStudentIds.has(student.id)) {
             return null;
        }
        if (isScoreEntryEmpty(currentScoreInput) && !initialLoadedStudentIds.has(student.id)) {
            return null;
        }

        const scoreValue = currentScoreInput?.score !== undefined && currentScoreInput?.score !== null && String(currentScoreInput?.score).trim() !== '' && !isNaN(Number(currentScoreInput?.score)) 
                            ? Number(currentScoreInput.score) 
                            : undefined;

        return {
            studentId: student.id,
            studentName: student.hoTen,
            classId: selectedClassId,
            className: selectedClass.tenLop,
            testDate: format(selectedDate, 'yyyy-MM-dd'),
            score: scoreValue,
            masteredLesson: currentScoreInput?.masteredLesson || false,
            vocabularyToReview: currentScoreInput?.vocabularyToReview || '',
            generalRemarks: currentScoreInput?.generalRemarks || '',
            homeworkStatus: currentScoreInput?.homeworkStatus || '',
        };
    })
    .filter(record => record !== null) as TestScoreRecord[];


    if (recordsToSave.length === 0) {
        toast({ title: "Không có dữ liệu mới", description: "Không có điểm mới hoặc thay đổi nào để lưu.", variant: "default" });
        return;
    }
    console.log("[KiemTraPage] Data to save for test scores:", recordsToSave);
    saveScoresMutation.mutate(recordsToSave);
  };

  const handlePrepareGradeSlipData = (studentId: string): ReportData | null => {
    if (!selectedClassId || !selectedDate) return null;
    
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const studentData = studentScores[studentId];
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);

    if (!student || !selectedClass) return null;

    const masteryText = studentData?.masteredLesson ? "Đã thuộc bài" : "Chưa thuộc bài";
    const masteryColor = studentData?.masteredLesson ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400";
    
    let homeworkText = "Không có bài tập về nhà";
    let homeworkColor = "text-muted-foreground"; 
    const homeworkStatus = studentData?.homeworkStatus;

    if (homeworkStatus) {
      switch (homeworkStatus) {
        case 'Có làm đầy đủ':
          homeworkText = "Có làm đầy đủ";
          homeworkColor = "text-blue-600 dark:text-blue-400";
          break;
        case 'Chỉ làm 1 phần':
          homeworkText = "Chỉ làm 1 phần";
          homeworkColor = "text-orange-500 dark:text-orange-400";
          break;
        case 'Không có làm':
          homeworkText = "Không có làm";
          homeworkColor = "text-red-600 dark:text-red-400";
          break;
        default: // If homeworkStatus is an empty string
           homeworkText = "Không có bài tập về nhà";
           homeworkColor = "text-muted-foreground italic";
           break;
      }
    } else {
        homeworkText = "Không có bài tập về nhà";
        homeworkColor = "text-muted-foreground italic";
    }
    return {
      studentName: student.hoTen,
      studentId: student.id,
      className: selectedClass.tenLop,
      testDate: format(selectedDate, 'dd/MM/yyyy'),
      score: studentData?.score,
      mastery: masteryText,
      masteryColor: masteryColor,
      vocabularyToReview: studentData?.vocabularyToReview || "Không có",
      remarks: studentData?.generalRemarks || "Không có",
      homework: homeworkText,
      homeworkStatusValue: homeworkStatus,
      homeworkColor: homeworkColor,
      footer: "Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.\nTrân trọng"
    };
  }

  const handleViewGradeSlip = (studentId: string) => {
    const data = handlePrepareGradeSlipData(studentId);
    if (data) {
      setGradeSlipData(data);
      setIsGradeSlipModalOpen(true);
    } else {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu điểm. Vui lòng thử lại.", variant: "destructive"});
    }
  };

  const handleExportGradeSlipImage = async () => {
    if (!gradeSlipDialogContentRef.current) {
      toast({ title: "Lỗi", description: "Không tìm thấy nội dung phiếu điểm để xuất.", variant: "destructive" });
      return;
    }
    if (!gradeSlipData) {
      toast({ title: "Lỗi", description: "Không có dữ liệu phiếu điểm để xuất.", variant: "destructive" });
      return;
    }
    try {
      const canvas = await html2canvas(gradeSlipDialogContentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
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

  const handleEditScore = (studentId: string) => {
    console.log("[KiemTraPage] handleEditScore called for studentId:", studentId);
    setEditingStudentId(studentId);
    // Programmatically switch to the "Nhập điểm" tab
    const entryTabTrigger = document.querySelector<HTMLButtonElement>('button[role="tab"][data-state="inactive"][value="nhap-diem"]');
    if (entryTabTrigger) {
        entryTabTrigger.click();
    } else {
        // If it's already active or not found, ensure focus or log
        console.log("[KiemTraPage] 'Nhập điểm' tab might already be active or trigger not found.");
    }
  };

  const handleDeleteScoreEntry = (studentId: string) => { 
    console.log("[KiemTraPage] handleDeleteScoreEntry called for studentId:", studentId);
    setStudentScores(prev => {
        const newScores = {...prev};
        newScores[studentId] = { masteredLesson: false, score: '', vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
        return newScores;
    });
    // If they were being edited, stop editing
    if (editingStudentId === studentId) {
        setEditingStudentId(null);
    }
    // Remove from initialLoadedStudentIds to ensure they move to entry tab if their score becomes empty
    // This is slightly different from savedStudentIdsForSession as this tracks what came from DB
    setInitialLoadedStudentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
    });
    toast({title: "Đã xoá dữ liệu điểm", description: `Dữ liệu điểm của học sinh đã được xoá. Nhấn "Lưu Tất Cả Điểm" để cập nhật thay đổi này vào cơ sở dữ liệu (sẽ xoá bản ghi điểm của HS này cho ngày này).`});
  };

  const studentsForHistoryTab = useMemo(() => {
    console.log("[KiemTraPage] Recalculating studentsForHistoryTab. editingStudentId:", editingStudentId, "initialLoadedStudentIds:", initialLoadedStudentIds);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentIds.has(student.id) &&
      student.id !== editingStudentId && 
      !isScoreEntryEmpty(studentScores[student.id])
    );
  }, [studentsInSelectedClass, studentScores, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingScores]);

  const studentsForEntryTab = useMemo(() => {
    console.log("[KiemTraPage] Recalculating studentsForEntryTab. editingStudentId:", editingStudentId, "initialLoadedStudentIds:", initialLoadedStudentIds);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      // Ensure the student being edited is shown, plus any others not in history
      const otherEntryStudents = studentsInSelectedClass.filter(
        student => !historyStudentIds.has(student.id) && student.id !== editingStudentId
      );
      return studentBeingEdited ? [studentBeingEdited, ...otherEntryStudents] : otherEntryStudents;
    }
    
    return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingScores]);


  const StarRating = ({ count }: { count: number }) => (
    <div className="inline-flex items-center ml-1">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 text-green-500 dark:text-green-400" fill="currentColor" />
      ))}
    </div>
  );

  const renderScoreDisplay = (score?: number | string) => {
    if (score === undefined || score === '' || score === null) {
      return <span className="font-semibold text-lg">N/A</span>;
    }
    const numScore = Number(score);
    if (isNaN(numScore)) {
      return <span className="font-semibold text-lg text-muted-foreground">{String(score)}</span>;
    }

    let scoreTextColor = "text-foreground"; 
    let starCount = 0;

    if (numScore >= 9 && numScore <=10) {
      scoreTextColor = "text-red-600 dark:text-red-400";
      starCount = 5;
    } else if (numScore >= 7) { 
      scoreTextColor = "text-blue-600 dark:text-blue-400";
      starCount = 4;
    } else if (numScore >= 5) { 
      scoreTextColor = "text-violet-600 dark:text-violet-400";
      starCount = 3;
    } else if (numScore > 0) {
       scoreTextColor = "text-foreground"; 
       starCount = numScore >= 3 ? 2 : (numScore > 0 ? 1 : 0); 
    } else { 
       scoreTextColor = "text-muted-foreground";
    }


    return (
      <>
        <span className={cn("font-semibold text-lg", scoreTextColor)}>{numScore}</span>
        {starCount > 0 && <StarRating count={starCount} />}
      </>
    );
  };


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
                onValueChange={(value) => setSelectedClassId(value)}
                disabled={isLoadingClasses}
              >
                <SelectTrigger id="class-select" className="w-full">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn một lớp"} />
                </SelectTrigger>
                <SelectContent>
                  {activeClasses.length > 0 ? (
                    activeClasses.map((lop) => (
                      <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-class" disabled>Không có lớp nào đang hoạt động</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isErrorClasses && <p className="text-xs text-destructive">Lỗi tải danh sách lớp.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-date">Ngày Kiểm Tra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="test-date"
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {selectedClassId && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Danh sách học sinh</CardTitle>
              <CardDescription>
                Lớp: {activeClasses.find(c => c.id === selectedClassId)?.tenLop || 'N/A'} -
                Ngày: {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
               {isErrorExistingScores && (
                <div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center mb-4">
                  <AlertCircle className="mr-2 h-5 w-5" /> 
                  Lỗi tải điểm đã lưu: {errorExistingScores?.message || "Không thể tải dữ liệu."}
                  <p className="text-xs ml-2">(Có thể do thiếu Firestore Index cho collection 'testScores' trên các trường 'classId' và 'testDate'. Vui lòng kiểm tra console server Next.js.)</p>
                </div>
              )}
              <Tabs defaultValue="nhap-diem" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    <Edit3 className="mr-2 h-4 w-4" /> Nhập điểm ({studentsForEntryTab.length})
                  </TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    <ListChecks className="mr-2 h-4 w-4" /> Lịch sử nhập điểm ({studentsForHistoryTab.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="nhap-diem">
                  {(isLoadingStudents || isLoadingExistingScores) && (
                    <div className="space-y-2">
                      {[...Array(3)].map((_,i) => <Skeleton key={`skel-entry-${i}`} className="h-10 w-full" />)}
                    </div>
                  )}
                  {isErrorStudents && !(isLoadingStudents || isLoadingExistingScores) && (
                    <div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải danh sách học sinh của lớp này.
                    </div>
                  )}
                  {!isLoadingStudents && !isLoadingExistingScores && !isErrorStudents && studentsForEntryTab.length === 0 && studentsInSelectedClass.length > 0 && (
                     <p className="text-muted-foreground text-center py-4">
                        {editingStudentId ? "Đang chỉnh sửa học sinh ở trên. Nhấn Lưu để hoàn tất." : "Tất cả học sinh đã có điểm nhập hoặc đã được lưu. Chuyển sang tab 'Lịch sử nhập điểm' để xem hoặc sửa."}
                     </p>
                  )}
                   {!isLoadingStudents && !isLoadingExistingScores && !isErrorStudents && studentsForEntryTab.length === 0 && studentsInSelectedClass.length === 0 && (
                     <p className="text-muted-foreground text-center py-4">Lớp này chưa có học sinh.</p>
                  )}
                  {!isLoadingStudents && !isLoadingExistingScores && !isErrorStudents && studentsForEntryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">STT</TableHead>
                            <TableHead>Họ và Tên</TableHead>
                            <TableHead className="w-[100px]">Điểm số</TableHead>
                            <TableHead className="w-[120px] text-center">Thuộc bài</TableHead>
                            <TableHead className="min-w-[180px]">Từ vựng cần học lại</TableHead>
                            <TableHead className="min-w-[200px]">Bài tập về nhà?</TableHead>
                            <TableHead className="min-w-[180px]">Nhận xét</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsForEntryTab.map((student, index) => (
                            <TableRow key={student.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{student.hoTen} {student.id === editingStudentId && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">Đang sửa</Badge>}</TableCell>
                              <TableCell>
                                <Input
                                  type="text" 
                                  placeholder="Điểm"
                                  value={studentScores[student.id]?.score ?? ''}
                                  onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.value)}
                                  className="w-full"
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <Switch
                                    id={`mastered-${student.id}`}
                                    checked={studentScores[student.id]?.masteredLesson || false}
                                    onCheckedChange={(checked) => handleScoreInputChange(student.id, 'masteredLesson', checked)}
                                  />
                                  <Label htmlFor={`mastered-${student.id}`} className="sr-only">Thuộc bài</Label>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  placeholder="Liệt kê từ vựng..."
                                  value={studentScores[student.id]?.vocabularyToReview || ''}
                                  onChange={(e) => handleScoreInputChange(student.id, 'vocabularyToReview', e.target.value)}
                                  rows={1}
                                />
                              </TableCell>
                               <TableCell>
                                <Select
                                  value={studentScores[student.id]?.homeworkStatus || ''}
                                  onValueChange={(value) => handleScoreInputChange(student.id, 'homeworkStatus', value as HomeworkStatus)}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Chọn trạng thái" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_HOMEWORK_STATUSES.map(status => (
                                      <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Textarea
                                  placeholder="Nhận xét khác..."
                                  value={studentScores[student.id]?.generalRemarks || ''}
                                  onChange={(e) => handleScoreInputChange(student.id, 'generalRemarks', e.target.value)}
                                  rows={1}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="lich-su">
                   {(isLoadingStudents || isLoadingExistingScores) && (
                     <div className="space-y-2">
                        {[...Array(3)].map((_,i) => <Skeleton key={`skel-hist-${i}`} className="h-10 w-full" />)}
                      </div>
                  )}
                  {isErrorStudents && !(isLoadingStudents || isLoadingExistingScores) && (
                    <div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center">
                      <AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải danh sách học sinh của lớp này.
                    </div>
                  )}
                  {!isLoadingStudents && !isLoadingExistingScores && !isErrorStudents && studentsForHistoryTab.length === 0 && (
                     <p className="text-muted-foreground text-center py-4">Chưa có điểm nào được lưu hoặc tải cho lựa chọn này. Hãy nhập điểm ở tab 'Nhập điểm'.</p>
                  )}
                  {!isLoadingStudents && !isLoadingExistingScores && !isErrorStudents && studentsForHistoryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">STT</TableHead>
                            <TableHead>Họ và Tên</TableHead>
                            <TableHead className="w-[100px]">Điểm số</TableHead>
                            <TableHead className="w-[120px]">Thuộc bài</TableHead>
                            <TableHead>Bài tập về nhà?</TableHead>
                             <TableHead>Nhận xét</TableHead>
                            <TableHead className="w-[150px] text-center">Hành động</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsForHistoryTab.map((student, index) => {
                            const scores = studentScores[student.id] || {};
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{student.hoTen}</TableCell>
                                <TableCell>{renderScoreDisplay(scores.score)}</TableCell>
                                <TableCell>{scores.masteredLesson ? 'Đã thuộc' : 'Chưa thuộc'}</TableCell>
                                <TableCell>{scores.homeworkStatus || 'N/A'}</TableCell>
                                <TableCell className="text-xs max-w-xs truncate">{scores.generalRemarks || 'N/A'}</TableCell>
                                <TableCell className="text-center space-x-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleEditScore(student.id)}
                                    aria-label={`Sửa điểm cho ${student.hoTen}`}
                                    disabled={saveScoresMutation.isPending || editingStudentId === student.id}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDeleteScoreEntry(student.id)}
                                    aria-label={`Xóa (reset) điểm cho ${student.hoTen}`}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/50"
                                    disabled={saveScoresMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleViewGradeSlip(student.id)}
                                    aria-label={`Xuất phiếu điểm cho ${student.hoTen}`}
                                    disabled={saveScoresMutation.isPending}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
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
            {selectedClassId && (studentsInSelectedClass.length > 0) && (
              <CardFooter className="justify-end border-t pt-6">
                <Button
                  onClick={handleSaveAllScores}
                  disabled={saveScoresMutation.isPending || (studentsForEntryTab.length === 0 && !editingStudentId) }
                >
                  {saveScoresMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                  Lưu Tất Cả Điểm
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>

      {isGradeSlipModalOpen && gradeSlipData && (
        <Dialog open={isGradeSlipModalOpen} onOpenChange={setIsGradeSlipModalOpen}>
          <DialogContent className="sm:max-w-lg p-0"> 
            <div ref={gradeSlipDialogContentRef} className="p-6 bg-card font-sans"> 
              <DialogHeader className="text-center mb-4">
                <DialogTitle className="text-xl font-bold text-primary">PHIẾU LIÊN LẠC</DialogTitle>
                <ShadDialogDescription className="text-sm text-muted-foreground">
                  Kết quả kiểm tra ngày: {gradeSlipData.testDate}
                </ShadDialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm leading-normal font-sans">
                <p><span className="font-semibold">Họ và tên:</span> {gradeSlipData.studentName}</p>
                <p><span className="font-semibold">Mã HS:</span> {gradeSlipData.studentId}</p>
                <p><span className="font-semibold">Lớp:</span> {gradeSlipData.className}</p>
                
                <div>
                  <span className="font-semibold">Điểm số: </span>
                  {renderScoreDisplay(gradeSlipData.score)}
                </div>

                <p><span className="font-semibold">Thuộc bài:</span> <span className={cn("font-bold", gradeSlipData.masteryColor)}>{gradeSlipData.mastery}</span></p>
                
                <div>
                  <p className="font-semibold">Bài tập về nhà:</p>
                  <p className={cn("pl-2", gradeSlipData.homeworkColor, !gradeSlipData.homeworkStatusValue && "italic text-muted-foreground")}>
                    {gradeSlipData.homework}
                  </p>
                </div>
                
                <div>
                  <p className="font-semibold">Nhận xét:</p>
                  <p className="pl-2 whitespace-pre-line">{gradeSlipData.remarks}</p>
                </div>

                <div>
                  <p className="font-semibold">Từ vựng cần học lại:</p>
                  <p className="pl-2 whitespace-pre-line">{gradeSlipData.vocabularyToReview}</p>
                </div>

                <div className="pt-3 mt-3 border-t">
                  <p className="whitespace-pre-line text-muted-foreground italic">{gradeSlipData.footer}</p>
                </div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-muted/50 sm:justify-between">
              <Button type="button" onClick={handleExportGradeSlipImage}>
                <Download className="mr-2 h-4 w-4" /> Xuất file ảnh
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Đóng
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}


