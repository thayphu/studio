
"use client";

import * as React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// import DashboardLayout from '../dashboard-layout'; // Temporarily commented out for debugging
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle as ShadCardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { saveTestScores, getTestScoresForClassOnDate } from '@/services/testScoreService';
import type { LopHoc, HocSinh, TestScoreRecord, StudentScoreInput, HomeworkStatus, TestFormat } from '@/lib/types';
import { ALL_HOMEWORK_STATUSES, ALL_TEST_FORMATS } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Save, Printer, AlertCircle, Download, Star, Loader2, Trash2, Edit, ListChecks, Edit3, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';


// Helper function to determine if a score entry is empty
const isScoreEntryEmpty = (entry: StudentScoreInput | undefined): boolean => {
  if (!entry) return true;
  // A score of 0 is considered not empty. Only null/undefined/empty string for score is empty.
  const scoreIsEmpty = entry.score === undefined || entry.score === '' || entry.score === null;
  const testFormatIsEmpty = entry.testFormat === undefined || entry.testFormat === "" || entry.testFormat === null;
  const vocabIsEmpty = entry.vocabularyToReview === undefined || entry.vocabularyToReview === '';
  const remarksIsEmpty = entry.generalRemarks === undefined || entry.generalRemarks === '';
  const homeworkIsEmpty = entry.homeworkStatus === undefined || entry.homeworkStatus === '' || entry.homeworkStatus === null;
  
  return scoreIsEmpty && testFormatIsEmpty && vocabIsEmpty && remarksIsEmpty && homeworkIsEmpty;
};

// Helper function to calculate mastery text and boolean
const calculateMasteryDetails = (testFormat?: TestFormat, scoreInput?: number | string | null): { text: string; isMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== '' && scoreInput !== null && !isNaN(Number(scoreInput)) ? Number(scoreInput) : undefined;

  if (!testFormat || testFormat === "") return { text: "Chưa chọn hình thức KT", isMastered: false };

  switch (testFormat) {
    case "Kiểm tra bài cũ":
      if (score === 10) return { text: "Đã thuộc bài", isMastered: true };
      if (score === 9) return { text: "Thuộc bài nhưng còn sai sót", isMastered: true };
      if (score !== undefined && score < 9 && score >=0) return { text: "Chưa thuộc bài", isMastered: false };
      return { text: "Chưa có điểm/đánh giá", isMastered: false };
    case "Kiểm tra miệng":
        if (score === 10) return { text: "Đã thuộc bài", isMastered: true };
        if (score === 9) return { text: "Thuộc bài nhưng còn sai sót", isMastered: true };
        if (score !== undefined && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isMastered: false };
        if (score !== undefined && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isMastered: false };
        if (score !== undefined && score < 5 && score >=0) return { text: "Chưa thuộc bài", isMastered: false };
        return { text: "Chưa có điểm/đánh giá", isMastered: false };
    case "Kiểm tra 15 phút":
    case "Kiểm tra 45 phút":
    case "Chấm bài tập":
      if (score !== undefined) return { text: "Đã chấm điểm", isMastered: score >= 5 };
      return { text: "Không kiểm tra từ vựng", isMastered: false }; // Or suitable default text
    default:
      return { text: "Chưa đánh giá", isMastered: false };
  }
};

// Minimal Layout for Debugging
const MinimalLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-100 p-4">
    <header className="bg-white shadow p-4 mb-4">
      <h1 className="text-xl font-bold">Minimal Layout for KiemTraPage</h1>
    </header>
    <main>{children}</main>
  </div>
);


export default function KiemTraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const gradeSlipDialogContentRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const memoizedFormattedSelectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set()); // Tracks students with scores from DB
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null); // Tracks student currently being edited
  const [activeTab, setActiveTab] = useState<string>("nhap-diem");

  const [isGradeSlipModalOpen, setIsGradeSlipModalOpen] = useState(false);
  const [gradeSlipData, setGradeSlipData] = useState<ReportData | null>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const activeClasses = useMemo(() => classes.filter(c => c.trangThai === 'Đang hoạt động'), [classes]);

  const {
    data: studentsInSelectedClass = [],
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
  } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', selectedClassId],
    queryFn: () => selectedClassId ? getStudentsByClassId(selectedClassId) : Promise.resolve([]),
    enabled: !!selectedClassId && isClient,
  });

  const {
    data: existingScoresData, 
    isLoading: isLoadingExistingScores,
    isError: isErrorExistingScores,
    error: errorExistingScores,
  } = useQuery<TestScoreRecord[], Error>({
    queryKey: ['existingTestScores', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => {
      if (!selectedClassId || !selectedDate) {
        console.log("[KiemTraPage] Skipping fetch for existingTestScores - no class or date selected.");
        return Promise.resolve([]);
      }
      console.log(`[KiemTraPage] Fetching existingTestScores for class ${selectedClassId} on date ${memoizedFormattedSelectedDateKey}`);
      return getTestScoresForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && isClient,
  });
  
  // Effect to reset scores and editing state when class or date changes
  useEffect(() => {
    console.log(`[KiemTraPage] Date or Class changed. Resetting scores and editing state. SelectedDate: ${memoizedFormattedSelectedDateKey}, SelectedClassId: ${selectedClassId}`);
    setStudentScores({});
    setInitialLoadedStudentIds(new Set<string>());
    setEditingStudentId(null); 
    // Invalidate to refetch new scores for the new selection
    if (selectedClassId && memoizedFormattedSelectedDateKey) {
        queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, memoizedFormattedSelectedDateKey] });
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, queryClient]); 
  

  // Effect to populate local scores state from fetched existing scores
  useEffect(() => {
    console.log("[KiemTraPage] Effect for existingScoresData/studentsInSelectedClass change. isClient:", isClient, "isLoadingExistingScores:", isLoadingExistingScores, "existingScoresData length:", existingScoresData?.length);
    if (isClient && !isLoadingExistingScores && existingScoresData && studentsInSelectedClass) {
        const newScores: Record<string, StudentScoreInput> = {};
        const newInitialLoadedIds = new Set<string>();

        studentsInSelectedClass.forEach(student => {
            const scoreRecord = existingScoresData.find(sr => sr.studentId === student.id);
            if (scoreRecord) {
                const masteryDetails = calculateMasteryDetails(scoreRecord.testFormat, scoreRecord.score);
                newScores[student.id] = {
                    score: (scoreRecord.score !== undefined && scoreRecord.score !== null) ? String(scoreRecord.score) : '',
                    testFormat: scoreRecord.testFormat || "",
                    masteredLesson: masteryDetails.isMastered, // Use the calculated boolean
                    vocabularyToReview: scoreRecord.vocabularyToReview || '',
                    generalRemarks: scoreRecord.generalRemarks || '',
                    homeworkStatus: scoreRecord.homeworkStatus || '',
                };
                // Add to initialLoadedStudentIds ONLY if the entry from DB is not empty
                if (!isScoreEntryEmpty(newScores[student.id])) {
                    newInitialLoadedIds.add(student.id);
                }
            } else {
                // If no existing score, initialize with defaults
                const masteryDetails = calculateMasteryDetails("", "");
                newScores[student.id] = {
                    score: '', testFormat: "", masteredLesson: masteryDetails.isMastered,
                    vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
                };
            }
        });
        setStudentScores(newScores);
        setInitialLoadedStudentIds(newInitialLoadedIds); // Set based on non-empty DB entries
        
        console.log("[KiemTraPage] studentScores and initialLoadedStudentIds updated from existingScoresData. New initialLoadedStudentIds:", newInitialLoadedIds);
    } else if (isClient && !isLoadingExistingScores && !existingScoresData && studentsInSelectedClass.length > 0) {
        // No existing scores, initialize empty scores for all students in class
        const newScores: Record<string, StudentScoreInput> = {};
        studentsInSelectedClass.forEach(student => {
            const masteryDetails = calculateMasteryDetails("", "");
            newScores[student.id] = {
                score: '', testFormat: "", masteredLesson: masteryDetails.isMastered,
                vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
            };
        });
        setStudentScores(newScores);
        setInitialLoadedStudentIds(new Set<string>()); // No scores loaded from DB
        console.log("[KiemTraPage] No existing scores, initialized empty scores for students.");
    } else if (isClient && !isLoadingExistingScores && studentsInSelectedClass.length === 0) {
        setStudentScores({});
        setInitialLoadedStudentIds(new Set<string>());
        console.log("[KiemTraPage] No students in selected class. Cleared scores.");
    }
  }, [existingScoresData, studentsInSelectedClass, isLoadingExistingScores, isClient]);


  const handleScoreInputChange = useCallback((studentId: string, field: keyof StudentScoreInput, value: any) => {
    setStudentScores(prev => {
        const currentEntry = prev[studentId] || { masteredLesson: false, score: '', testFormat: "", vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
        const updatedEntry = { ...currentEntry, [field]: value };
        
        // Recalculate mastery status whenever score or testFormat changes
        if (field === 'score' || field === 'testFormat') {
            const masteryDetails = calculateMasteryDetails(updatedEntry.testFormat, updatedEntry.score);
            updatedEntry.masteredLesson = masteryDetails.isMastered;
        }
        
        return { ...prev, [studentId]: updatedEntry };
    });
  }, []); // Removed dependencies that might cause new function references too often
  

  const saveScoresMutation = useMutation({
    mutationFn: (records: TestScoreRecord[]) => saveTestScores(records),
    onSuccess: (data, variables) => {
      toast({
        title: "Lưu điểm thành công!",
        description: "Điểm kiểm tra đã được ghi nhận.",
      });
      // Refetch existing scores to update the view and move students to history if applicable
      if (selectedClassId && selectedDate) {
        queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, memoizedFormattedSelectedDateKey] });
      }
      setEditingStudentId(null); // Clear editing state after successful save
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
    console.log("[KiemTraPage] handleSaveAllScores called. Current studentScores:", JSON.parse(JSON.stringify(studentScores)));

    Object.keys(studentScores).forEach(studentId => {
        const currentScoreInput = studentScores[studentId];
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        
        if (student && currentScoreInput) { 
             // Convert score to number or null before saving
             const scoreValue = (currentScoreInput.score !== undefined && currentScoreInput.score !== null && String(currentScoreInput.score).trim() !== '')
                ? (isNaN(Number(String(currentScoreInput.score).trim())) ? null : Number(String(currentScoreInput.score).trim()))
                : null; // Use null for empty/invalid scores

            // Recalculate mastery details with the final scoreValue for saving
            const masteryDetails = calculateMasteryDetails(currentScoreInput.testFormat, scoreValue);

            // Save if the entry is not empty OR if it was loaded from DB (to save cleared entries)
            if (!isScoreEntryEmpty(currentScoreInput) || initialLoadedStudentIds.has(studentId)) {
              recordsToSave.push({
                studentId: student.id,
                studentName: student.hoTen,
                classId: selectedClassId,
                className: selectedClass.tenLop,
                testDate: memoizedFormattedSelectedDateKey, // Use YYYY-MM-DD format
                testFormat: currentScoreInput.testFormat || "",
                score: scoreValue,
                masteredLesson: masteryDetails.isMastered,
                vocabularyToReview: currentScoreInput.vocabularyToReview || '',
                generalRemarks: currentScoreInput.generalRemarks || '',
                homeworkStatus: currentScoreInput.homeworkStatus || '',
              });
            }
        }
    });

    console.log("[KiemTraPage] Records to save:", JSON.parse(JSON.stringify(recordsToSave)));
    if (recordsToSave.length === 0) {
      toast({ title: "Không có gì để lưu", description: "Không có điểm mới hoặc thay đổi nào được thực hiện.", variant: "default" });
      return;
    }
    saveScoresMutation.mutate(recordsToSave);
  };
  
  const handleEditScore = (studentIdToEdit: string) => {
    console.log(`[KiemTraPage] handleEditScore called for studentId: ${studentIdToEdit}`);
    setEditingStudentId(studentIdToEdit);
    setActiveTab("nhap-diem"); // Switch to the entry tab
    // Attempt to focus the tab trigger - might not work consistently due to timing
    requestAnimationFrame(() => {
        const entryTabTrigger = document.querySelector<HTMLButtonElement>('button[role="tab"][value="nhap-diem"]');
        if (entryTabTrigger && entryTabTrigger.getAttribute('data-state') === 'inactive') {
            entryTabTrigger.click();
        }
    });
  };

  const handleDeleteScoreEntry = (studentIdToDelete: string) => {
    console.log(`[KiemTraPage] handleDeleteScoreEntry called for studentId: ${studentIdToDelete}`);
    const masteryDetailsForEmpty = calculateMasteryDetails("", null); // Ensure this calculates correctly for an empty state
    setStudentScores(prev => ({
        ...prev,
        [studentIdToDelete]: {
            score: null, // Explicitly null to indicate cleared score
            testFormat: "",
            masteredLesson: masteryDetailsForEmpty.isMastered,
            vocabularyToReview: '',
            generalRemarks: '',
            homeworkStatus: '',
        }
    }));
    // Do not remove from initialLoadedStudentIds here, so that the cleared state can be saved.
    // The student will move to "Nhập điểm" tab due to isScoreEntryEmpty becoming true for them.
    if (editingStudentId === studentIdToDelete) {
      setEditingStudentId(null); // If deleting the student being edited, clear editing state
    }
    toast({ title: "Đã xoá dữ liệu điểm cục bộ", description: `Dữ liệu điểm của học sinh đã được xoá khỏi form. Nhấn "Lưu" để cập nhật thay đổi này vào cơ sở dữ liệu.` });
  };


  // Memoized lists for tabs
  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    console.log("[KiemTraPage] Recalculating studentsForHistoryTab. initialLoadedStudentIds:", initialLoadedStudentIds, "editingStudentId:", editingStudentId);
    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentIds.has(student.id) &&
      student.id !== editingStudentId && // Exclude if currently being edited
      studentScores[student.id] && // Ensure there's an entry in local state
      !isScoreEntryEmpty(studentScores[student.id]) // And that entry is not empty
    );
  }, [studentsInSelectedClass, studentScores, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingScores]);

  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    console.log("[KiemTraPage] Recalculating studentsForEntryTab. editingStudentId:", editingStudentId);

    if (editingStudentId) {
        const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
        console.log("[KiemTraPage] Editing student, studentsForEntryTab will be:", studentBeingEdited ? [studentBeingEdited] : []);
        return studentBeingEdited ? [studentBeingEdited] : [];
    }
    // Students not in history (i.e., not loaded from DB as non-empty, or were loaded but cleared)
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const entryStudents = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    console.log("[KiemTraPage] Not editing, studentsForEntryTab based on difference from history:", entryStudents);
    return entryStudents;
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingScores]);


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
    else if (numScore >= 7 && numScore < 9) { scoreTextColor = "text-blue-600 dark:text-blue-400"; starCount = 4; } 
    else if (numScore >= 5 && numScore < 7) { scoreTextColor = "text-violet-600 dark:text-violet-400"; starCount = 3; } 
    else if (numScore > 0 && numScore < 5) { scoreTextColor = "text-foreground"; starCount = numScore >= 3 ? 2 : (numScore > 0 ? 1 : 0); }
    else if (numScore === 0) { scoreTextColor = "text-muted-foreground"; starCount = 0; } // Handle 0 score distinctly
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
    if (!html2canvas) {
        toast({ title: "Lỗi", description: "Chức năng xuất ảnh chưa sẵn sàng. Vui lòng thử lại sau.", variant: "destructive" });
        console.error("html2canvas is not loaded");
        return;
    }
    if (!gradeSlipDialogContentRef.current) {
        toast({ title: "Lỗi", description: "Không tìm thấy nội dung phiếu điểm.", variant: "destructive" });
        return;
    }
    if (!gradeSlipData) {
        toast({ title: "Lỗi", description: "Không có dữ liệu phiếu điểm để xuất.", variant: "destructive" });
        return;
    }
    
    try {
        toast({ title: "Đang xử lý...", description: "Phiếu điểm đang được tạo, vui lòng đợi."});
        const canvas = await html2canvas(gradeSlipDialogContentRef.current, { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff', 
            logging: true,
            onclone: (document) => { // Ensure styles are applied in the cloned document
                const content = document.getElementById('grade-slip-content');
                if (content) {
                    // You might need to re-apply specific styles here if they are dynamic or complex
                    // For example, if Tailwind classes are not fully captured.
                }
            }
        });
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


  const isLoadingData = isLoadingClasses || isLoadingStudents || isLoadingExistingScores;

  const saveButtonText = (activeTab === 'lich-su' && editingStudentId) ? "Lưu Thay Đổi Lịch Sử" : "Lưu Tất Cả Điểm";
  
  const canSaveChanges = useMemo(() => {
    if (saveScoresMutation.isPending) return false;
    if (editingStudentId) return true; // Always allow saving if in edit mode

    // Check if there are any new entries in the "Nhập điểm" tab that are not empty
    const hasNewNonEmptyEntries = studentsForEntryTab.some(student =>
      studentScores[student.id] && !isScoreEntryEmpty(studentScores[student.id])
    );
    if (hasNewNonEmptyEntries) return true;
    
    // Check if any loaded entries have been cleared (marked for deletion)
    const hasDeletions = Array.from(initialLoadedStudentIds).some(id => {
        // Check if the original record was non-empty
        const originalRecord = existingScoresData?.find(ex => ex.studentId === id && !isScoreEntryEmpty(ex as StudentScoreInput));
        // And the current data for this ID is empty
        const currentData = studentScores[id];
        return originalRecord && currentData && isScoreEntryEmpty(currentData);
    });

    if(hasDeletions) return true;

    return false; 
  }, [studentScores, studentsForEntryTab, editingStudentId, saveScoresMutation.isPending, initialLoadedStudentIds, existingScoresData]);


  const PageContent = () => (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-foreground flex items-center">
          <FileText className="mr-3 h-8 w-8" /> Ghi Điểm Kiểm Tra
        </h1>
      </div>

      <Card className="mb-8 shadow-md">
        <CardHeader>
          <ShadCardTitle>Thông tin chung bài kiểm tra</ShadCardTitle>
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
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { if(date) setSelectedDate(date); }} initialFocus locale={vi} /></PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {selectedClassId && selectedDate && (
        <Card className="shadow-md">
          <CardHeader>
            <ShadCardTitle>Danh sách học sinh</ShadCardTitle>
            <CardDescription>Lớp: {activeClasses.find(c => c.id === selectedClassId)?.tenLop || 'N/A'} - Ngày: {format(selectedDate, "dd/MM/yyyy", { locale: vi })}</CardDescription>
          </CardHeader>
          <CardContent>
            {(isErrorExistingScores || isErrorStudents) && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center mb-4"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải dữ liệu: { (errorExistingScores || errorStudents)?.message || "Không thể tải dữ liệu."}<p className="text-xs ml-2">(Kiểm tra Firestore Index/Security Rules hoặc console server Next.js.)</p></div>)}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                <TabsTrigger value="nhap-diem" id="tab-trigger-nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><Edit3 className="mr-2 h-4 w-4" /> Nhập điểm ({studentsForEntryTab.length})</TabsTrigger>
                <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><ListChecks className="mr-2 h-4 w-4" /> Lịch sử nhập ({studentsForHistoryTab.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="nhap-diem">
                {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-entry-${i}`} className="h-20 w-full" />)}</div>)}
                {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForEntryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">{studentsInSelectedClass.length === 0 ? "Lớp này chưa có học sinh." : "Tất cả học sinh đã có điểm hoặc đã được xử lý. Chuyển sang tab 'Lịch sử nhập' để xem hoặc sửa."}</p>)}
                
                {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForEntryTab.length > 0 && (
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
                          const scoreEntry = studentScores[student.id] || { score: '', testFormat: "", masteredLesson: false, vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
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
                              <TableCell className="text-xs">{masteryDetails.text}</TableCell>
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
                 {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForHistoryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">{studentsInSelectedClass.length === 0 ? "Lớp này chưa có học sinh." : "Chưa có điểm nào được lưu hoặc tải cho lựa chọn này. Vui lòng nhập điểm ở tab 'Nhập điểm'."}</p>)}
                {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForHistoryTab.length > 0 && (
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
                              <TableCell className="text-xs">{masteryDetails.text}</TableCell>
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
           {(activeTab === 'nhap-diem' || (activeTab === 'lich-su' && canSaveChanges && editingStudentId)) && selectedClassId && selectedDate && (studentsInSelectedClass.length > 0 || editingStudentId) && (
              <CardFooter className="justify-end border-t pt-6">
                  <Button onClick={handleSaveAllScores} disabled={saveScoresMutation.isPending || !canSaveChanges}>
                      {saveScoresMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {saveButtonText}
                  </Button>
              </CardFooter>
          )}
        </Card>
      )}

      {isGradeSlipModalOpen && gradeSlipData && (
        <Dialog open={isGradeSlipModalOpen} onOpenChange={setIsGradeSlipModalOpen}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <ShadDialogTitle className="text-center text-xl">PHIẾU LIÊN LẠC</ShadDialogTitle>
                    <ShadDialogDescription className="text-center text-xs">Lớp: {gradeSlipData.className} - Ngày kiểm tra: {gradeSlipData.testDate}</ShadDialogDescription>
                </DialogHeader>
                <div id="grade-slip-content" ref={gradeSlipDialogContentRef} className="flex-grow overflow-y-auto p-6 space-y-3 bg-white text-black font-sans"> {/* Added font-sans for potentially better rendering */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-primary">PHIẾU LIÊN LẠC</h2>
                        <p className="text-sm text-muted-foreground">Ngày {format(selectedDate, 'dd')} tháng {format(selectedDate, 'MM')} năm {format(selectedDate, 'yyyy')}</p>
                    </div>
                    
                    <div className="mt-2">
                        <p><strong className="font-semibold">Họ và tên:</strong> {gradeSlipData.studentName} ({gradeSlipData.studentId})</p>
                        <p><strong className="font-semibold">Lớp:</strong> {gradeSlipData.className}</p>
                    </div>

                    <div className="mt-2 border-t border-border pt-2">
                        <p><strong className="font-semibold">Hình thức kiểm tra:</strong> {gradeSlipData.testFormat || "Chưa xác định"}</p>
                        <div className="flex items-center">
                            <strong className="font-semibold mr-2">Điểm số:</strong> {renderScoreDisplay(gradeSlipData.score)}
                        </div>
                        <p><strong className="font-semibold">Kết quả thuộc bài:</strong> <span className={cn("font-medium", gradeSlipData.masteryColor)}>{gradeSlipData.masteryText}</span></p>
                    </div>

                    <div className="mt-2 border-t border-border pt-2">
                         <p><strong className="font-semibold">Bài tập về nhà:</strong> <span className={cn("font-medium", gradeSlipData.homeworkColor)}>{gradeSlipData.homeworkText}</span></p>
                    </div>
                    
                    <div className="mt-2 border-t border-border pt-2">
                        <p><strong className="font-semibold">Từ vựng cần học lại:</strong></p>
                        <p className="whitespace-pre-wrap text-sm pl-2">{gradeSlipData.vocabularyToReview || "Không có."}</p>
                    </div>
                    
                    <div className="mt-2 border-t border-border pt-2">
                        <p><strong className="font-semibold">Nhận xét:</strong></p>
                        <p className="whitespace-pre-wrap text-sm pl-2">{gradeSlipData.remarks || "Không có."}</p>
                    </div>
                    
                    <div className="mt-4 pt-2 border-t border-border text-center text-sm text-muted-foreground">
                        <p className="whitespace-pre-line">{gradeSlipData.footer}</p>
                    </div>
                </div>
                <DialogFooter className="p-6 pt-0 border-t sm:justify-between">
                     <Button variant="outline" onClick={() => setIsGradeSlipModalOpen(false)}>Đóng</Button>
                     <Button onClick={handleExportGradeSlipImage} disabled={!html2canvas}> 
                        {/* {!html2canvas && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} */}
                        <Download className="mr-2 h-4 w-4" />Xuất file ảnh
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );

  // Use MinimalLayout for debugging if DashboardLayout is suspected
  return <MinimalLayout>{PageContent()}</MinimalLayout>;
  // return <DashboardLayout>{PageContent()}</DashboardLayout>; // Restore when DashboardLayout is stable
}

// This type is for the data structure of the grade slip itself
interface ReportData {
  studentName: string;
  studentId: string;
  className: string;
  testDate: string; // Already formatted dd/MM/yyyy
  testFormat?: TestFormat;
  score?: number | string | null;
  masteryText: string;
  masteryColor: string;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkText: string;
  homeworkStatusValue?: HomeworkStatus; // The actual value
  homeworkColor: string;
  footer: string;
}


// ``` -- This was the extraneous line, removed.