
"use client";

import * as React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// import html2canvas from 'html2canvas'; // Temporarily disabled for debugging
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // CardTitle alias was here, will be fixed
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import html2canvas from 'html2canvas';


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
  const memoizedFormattedSelectedDateKey = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);
  
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set<string>());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
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
    refetch: refetchStudentsInClass,
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
        console.log("[KiemTraPage] Skipping fetch: No class or date selected.");
        return Promise.resolve([]);
      }
      console.log(`[KiemTraPage] Fetching existing scores for Class: ${selectedClassId}, Date: ${memoizedFormattedSelectedDateKey}`);
      return getTestScoresForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && isClient,
  });
  
  useEffect(() => {
    console.log("[KiemTraPage] Selected Date or Class ID changed. Resetting local scores, editing state, and initial loaded IDs. Date:", memoizedFormattedSelectedDateKey, "ClassID:", selectedClassId);
    setStudentScores({});
    setInitialLoadedStudentIds(new Set<string>());
    setEditingStudentId(null); 
    // No need to refetch students here; it's handled by useQuery's enabled state change for selectedClassId
  }, [memoizedFormattedSelectedDateKey, selectedClassId]);
  

  useEffect(() => {
    console.log("[KiemTraPage] Effect for existingScoresData/studentsInClass change. isClient:", isClient, "isLoadingExistingScores:", isLoadingExistingScores, "existingScoresData length:", existingScoresData?.length);
    if (isClient && !isLoadingExistingScores && studentsInSelectedClass.length > 0 ) { // existingScoresData can be empty or undefined initially
        const newScores: Record<string, StudentScoreInput> = {};
        const newInitialLoadedIds = new Set<string>();

        studentsInSelectedClass.forEach(student => {
            const scoreRecord = existingScoresData?.find(sr => sr.studentId === student.id); // Use optional chaining for existingScoresData
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
                // Add to initialLoadedStudentIds ONLY if the entry from DB is not empty
                if (!isScoreEntryEmpty(newScores[student.id])) {
                    newInitialLoadedIds.add(student.id);
                }
            } else {
                // Ensure an entry exists for all students in the class for consistent form rendering
                newScores[student.id] = {
                    score: '', testFormat: "", masteredLesson: false,
                    vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
                };
            }
        });
        setStudentScores(newScores);
        setInitialLoadedStudentIds(newInitialLoadedIds);
        
        // Reset editingStudentId if the student being edited is no longer in initialLoadedStudentIds
        // or their score in newScores is empty (e.g., data was cleared from DB)
        if (editingStudentId && (!newInitialLoadedIds.has(editingStudentId) || (newScores[editingStudentId] && isScoreEntryEmpty(newScores[editingStudentId])))) {
            console.log(`[KiemTraPage] Student ${editingStudentId} was being edited but is no longer in initialLoadedStudentIds or their score is empty. Resetting editingStudentId.`);
            setEditingStudentId(null);
        }
        console.log("[KiemTraPage] Student scores and initial loaded IDs updated from existing data/students. New scores count:", Object.keys(newScores).length, "New loaded IDs count:", newInitialLoadedIds.size);
    } else if (isClient && !isLoadingExistingScores && studentsInSelectedClass.length > 0 && !existingScoresData) {
      // Handle case where students are loaded but no existing scores (e.g., new date)
      const defaultScores: Record<string, StudentScoreInput> = {};
      studentsInSelectedClass.forEach(student => {
        defaultScores[student.id] = {
          score: '', testFormat: "", masteredLesson: false,
          vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
        };
      });
      setStudentScores(defaultScores);
      setInitialLoadedStudentIds(new Set<string>()); // No initially loaded scores
      console.log("[KiemTraPage] Initialized empty scores for all students in class as no existing scores found.");
    }
  }, [existingScoresData, studentsInSelectedClass, isLoadingExistingScores, isClient, queryClient]); // Added queryClient to deps if it's used inside


  const handleScoreInputChange = useCallback((studentId: string, field: keyof StudentScoreInput, value: any) => {
    setStudentScores(prev => {
        const currentEntry = prev[studentId] || { masteredLesson: false, score: '', testFormat: "", vocabularyToReview: '', generalRemarks: '', homeworkStatus: '' };
        const updatedEntry = { ...currentEntry, [field]: value };

        if (field === 'score' || field === 'testFormat') {
            const masteryDetails = calculateMasteryDetails(updatedEntry.testFormat, updatedEntry.score);
            updatedEntry.masteredLesson = masteryDetails.isMastered;
        }
        
        // If this change makes the entry non-empty, and the student was previously considered "to enter scores"
        // (not in initialLoadedStudentIds or was being edited), then set them as editing.
        // This logic is tricky and might need refinement based on exact UX flow desired.
        // For now, explicitly setting editingStudentId is done via handleEditScore.
        // if (!isScoreEntryEmpty(updatedEntry) && (!initialLoadedStudentIds.has(studentId) || studentId === editingStudentId) ) {
        //    // This might cause issues if not handled carefully with tab switching
        //    // setEditingStudentId(studentId);
        // }

        return { ...prev, [studentId]: updatedEntry };
    });
  }, []); 
  

  const saveScoresMutation = useMutation({
    mutationFn: (records: TestScoreRecord[]) => saveTestScores(records),
    onSuccess: (data, variables) => {
      toast({
        title: "Lưu điểm thành công!",
        description: "Điểm kiểm tra đã được ghi nhận.",
      });
      if (selectedClassId && selectedDate) {
        // Invalidate to refetch the scores, which will update existingScoresData
        // and subsequently studentScores and initialLoadedStudentIds via the useEffect hook.
        queryClient.invalidateQueries({ queryKey: ['existingTestScores', selectedClassId, memoizedFormattedSelectedDateKey] });
      }
      setEditingStudentId(null); // Reset editing state after successful save
      console.log("[KiemTraPage] Save successful. Invalidated existingTestScores. EditingStudentId reset.");
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
    console.log("[KiemTraPage] handleSaveAllScores called.");
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
    console.log("[KiemTraPage] Preparing to save scores. Current studentScores:", studentScores);

    Object.keys(studentScores).forEach(studentId => {
        const currentScoreInput = studentScores[studentId];
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        
        // Save if the entry is not empty OR if it was an initially loaded entry that might have been cleared (to save the cleared state)
        if (student && currentScoreInput && (!isScoreEntryEmpty(currentScoreInput) || initialLoadedStudentIds.has(student.id))) {
            
            const scoreValue = (currentScoreInput.score !== undefined && currentScoreInput.score !== null && String(currentScoreInput.score).trim() !== '')
              ? Number(currentScoreInput.score)
              : null; 

            if (String(currentScoreInput.score).trim() !== '' && isNaN(Number(scoreValue)) && scoreValue !== null) {
                toast({ title: "Điểm không hợp lệ", description: `Điểm của học sinh ${student.hoTen} không phải là số. Sẽ không lưu điểm này.`, variant: "destructive" });
                // Skip this student's score part if invalid, but other fields might still be saved if valid.
                // Or, prevent saving entirely if any score is invalid. For now, we proceed but score will be null.
            }
            
            const masteryDetails = calculateMasteryDetails(currentScoreInput.testFormat, scoreValue);

            recordsToSave.push({
              studentId: student.id,
              studentName: student.hoTen,
              classId: selectedClassId,
              className: selectedClass.tenLop,
              testDate: memoizedFormattedSelectedDateKey,
              testFormat: currentScoreInput.testFormat || "",
              score: scoreValue, 
              masteredLesson: masteryDetails.isMastered,
              vocabularyToReview: currentScoreInput.vocabularyToReview || '',
              generalRemarks: currentScoreInput.generalRemarks || '',
              homeworkStatus: currentScoreInput.homeworkStatus || '',
            });
        }
    });
    console.log("[KiemTraPage] Records to save:", recordsToSave);

    if (recordsToSave.length === 0 && !editingStudentId) { // Also consider if an edit action (like clearing fields of an existing record) should trigger save
      toast({ title: "Không có dữ liệu mới hoặc thay đổi đáng kể để lưu", description: "Vui lòng nhập điểm hoặc thực hiện thay đổi.", variant: "default" });
      return;
    }
    saveScoresMutation.mutate(recordsToSave);
  };
  
  const handleEditScore = (studentIdToEdit: string) => {
    console.log(`[KiemTraPage] handleEditScore called for student: ${studentIdToEdit}`);
    setEditingStudentId(studentIdToEdit);
    setActiveTab("nhap-diem"); // Switch to the entry tab
    
    // Attempt to focus the tab trigger - might not work reliably due to React's rendering lifecycle
    // and depends on the exact structure of your Tabs component.
    requestAnimationFrame(() => {
        const entryTabTrigger = document.querySelector<HTMLButtonElement>('button[role="tab"][data-state="inactive"][value="nhap-diem"]');
        if (entryTabTrigger) {
            console.log("[KiemTraPage] Programmatically clicking 'Nhập điểm' tab trigger.");
            entryTabTrigger.click();
        } else {
            console.log("[KiemTraPage] 'Nhập điểm' tab trigger not found or already active.");
        }
    });
  };

  const handleDeleteScoreEntry = (studentIdToDelete: string) => {
    console.log(`[KiemTraPage] handleDeleteScoreEntry called for student: ${studentIdToDelete}`);
    const masteryDetailsForEmpty = calculateMasteryDetails("", null); 
    setStudentScores(prev => ({
        ...prev,
        [studentIdToDelete]: {
            score: null, // Explicitly set score to null to indicate deletion/clearing
            testFormat: "",
            masteredLesson: masteryDetailsForEmpty.isMastered,
            vocabularyToReview: '',
            generalRemarks: '',
            homeworkStatus: '',
        }
    }));
    // If the student being deleted was also the one being edited, reset editing state
    // but they should still be in the "Nhập điểm" tab as their entry is now empty.
    if (editingStudentId === studentIdToDelete) {
      // setEditingStudentId(null); // Don't reset here, let save or tab switch handle it.
    }
    toast({ title: "Đã xoá dữ liệu điểm cục bộ", description: `Dữ liệu điểm của học sinh đã được xoá khỏi form. Nhấn "Lưu" để cập nhật thay đổi này vào cơ sở dữ liệu.` });
  };


  const studentsForHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    return studentsInSelectedClass.filter(student =>
      initialLoadedStudentIds.has(student.id) &&
      student.id !== editingStudentId && 
      studentScores[student.id] && // Ensure score entry exists
      !isScoreEntryEmpty(studentScores[student.id])
    );
  }, [studentsInSelectedClass, studentScores, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingScores]);

  const studentsForEntryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass ) return []; // Removed isLoadingExistingScores here to allow entry even if scores are loading
    if (editingStudentId) {
        const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
        return studentBeingEdited ? [studentBeingEdited] : [];
    }
    // Students not in history tab and not being edited
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    return studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents]);


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
    else { scoreTextColor = "text-muted-foreground"; } // For 0 or invalid cases not caught by NaN
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
        toast({ title: "Xuất Ảnh (html2canvas chưa sẵn sàng)", description: "Vui lòng cài đặt 'html2canvas' và khởi động lại server để sử dụng tính năng này, hoặc đảm bảo thư viện đã được tải.", variant: "default"});
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


  const isLoadingData = isLoadingClasses || isLoadingStudents || isLoadingExistingScores;

  const saveButtonText = (activeTab === 'lich-su' && editingStudentId) ? "Lưu Thay Đổi Lịch Sử" : "Lưu Tất Cả Điểm";
  
  const canSaveChanges = useMemo(() => {
    if (saveScoresMutation.isPending) return false; // Cannot save if a save is already in progress

    // If editing a specific student, allow saving if their data is not empty or changed
    if (editingStudentId && studentScores[editingStudentId]) {
        const originalRecord = existingScoresData?.find(ex => ex.studentId === editingStudentId);
        const currentData = studentScores[editingStudentId];
        if (!isScoreEntryEmpty(currentData)){ // If current data is not empty, allow save
             if (originalRecord) { // If there's an original record, check if it's different
                if (String(currentData.score ?? '') !== String(originalRecord.score ?? '') ||
                    currentData.testFormat !== originalRecord.testFormat ||
                    currentData.vocabularyToReview !== originalRecord.vocabularyToReview ||
                    currentData.generalRemarks !== originalRecord.generalRemarks ||
                    currentData.homeworkStatus !== originalRecord.homeworkStatus) {
                    return true; // Allow saving if different from original
                }
            } else {
                 return true; // Allow saving if it's a new entry (no original record) and not empty
            }
        } else if (originalRecord && !isScoreEntryEmpty(originalRecord)) {
            return true; // Allow saving if original was not empty but current is (means it was cleared)
        }
    }
    
    // Check if there are any new, non-empty entries in the "Nhập điểm" tab (excluding the one being edited)
    const hasNewNonEmptyEntries = studentsForEntryTab.some(student =>
      student.id !== editingStudentId && 
      studentScores[student.id] &&
      !isScoreEntryEmpty(studentScores[student.id])
    );
    if (hasNewNonEmptyEntries) return true;
    
    // Check if any initially loaded records (not being edited) have been modified to be empty (deleted)
    const hasDeletionsToLoadedRecords = Object.entries(studentScores).some(([id, currentScoreData]) => {
      if (id === editingStudentId) return false; 
      if (!initialLoadedStudentIds.has(id)) return false; 
      
      const originalRecord = existingScoresData?.find(ex => ex.studentId === id);
      if (!originalRecord) return false; 

      if (!isScoreEntryEmpty(originalRecord) && isScoreEntryEmpty(currentScoreData)) {
        return true; 
      }
      return false;
    });

    if (hasDeletionsToLoadedRecords) return true;

    return false; // Default to disabled if no specific save condition is met
  }, [studentScores, existingScoresData, editingStudentId, studentsForEntryTab, initialLoadedStudentIds, saveScoresMutation.isPending]);


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
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => { if(date) setSelectedDate(date); }} initialFocus locale={vi} /></PopoverContent>
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
              {(isErrorExistingScores || isErrorStudents) && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center mb-4"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải dữ liệu: { (errorExistingScores || errorStudents)?.message || "Không thể tải dữ liệu."}<p className="text-xs ml-2">(Kiểm tra Firestore Index/Security Rules hoặc console server Next.js.)</p></div>)}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" id="tab-trigger-nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><Edit3 className="mr-2 h-4 w-4" /> Nhập điểm ({studentsForEntryTab.length})</TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><ListChecks className="mr-2 h-4 w-4" /> Lịch sử nhập ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-entry-${i}`} className="h-20 w-full" />)}</div>)}
                  {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForEntryTab.length === 0 && studentsForHistoryTab.length > 0 && (<p className="text-muted-foreground text-center py-4">Tất cả học sinh đã có điểm hoặc đã được xử lý. Chuyển sang tab 'Lịch sử nhập' để xem hoặc sửa.</p>)}
                  {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForEntryTab.length === 0 && studentsForHistoryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">{studentsInSelectedClass.length > 0 ? "Không có học sinh nào cần nhập điểm cho lựa chọn này." : "Lớp này chưa có học sinh hoặc chưa tải được danh sách học sinh."}</p>)}
                  
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
                   {!isLoadingData && !isErrorExistingScores && !isErrorStudents && studentsForHistoryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">Chưa có điểm nào được lưu hoặc tải cho lựa chọn này. Vui lòng nhập điểm ở tab "Nhập điểm".</p>)}
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
             {(selectedClassId && selectedDate && (studentsInSelectedClass.length > 0 || editingStudentId)) && (activeTab === 'nhap-diem' || (activeTab === 'lich-su' && canSaveChanges)) && (
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
            <div ref={gradeSlipDialogContentRef} className="p-6 bg-card font-sans leading-normal text-sm">
              <DialogHeader className="text-center mb-4">
                <ShadDialogTitle className="text-xl font-bold text-primary uppercase tracking-wider text-center">PHIẾU LIÊN LẠC</ShadDialogTitle>
                <ShadDialogDescription className="text-sm text-muted-foreground mt-1">Kết quả kiểm tra ngày: {gradeSlipData.testDate}</ShadDialogDescription>
              </DialogHeader>
              <div className="space-y-1.5"> {/* Reduced spacing */}
                <p><span className="font-semibold">Họ và tên:</span> {gradeSlipData.studentName}</p>
                <p><span className="font-semibold">Mã HS:</span> {gradeSlipData.studentId}</p>
                <p><span className="font-semibold">Lớp:</span> {gradeSlipData.className}</p>
                {gradeSlipData.testFormat && <p><span className="font-semibold">Hình thức KT:</span> {gradeSlipData.testFormat}</p>}
                <div><span className="font-semibold">Điểm số: </span>{renderScoreDisplay(gradeSlipData.score)}</div>
                <p><span className="font-semibold">Thuộc bài:</span> <span className={cn("font-bold", gradeSlipData.masteryColor)}>{gradeSlipData.masteryText}</span></p>
                
                <div className="mt-2"><p className="font-semibold">Bài tập về nhà:</p><p className={cn("pl-2", gradeSlipData.homeworkColor, (!gradeSlipData.homeworkStatusValue || gradeSlipData.homeworkStatusValue === "") && "italic text-muted-foreground")}>{homeworkStatusToDisplayText(gradeSlipData.homeworkStatusValue)}</p></div>
                <div className="mt-2"><p className="font-semibold">Nhận xét:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.remarks || "Không có nhận xét."}</p></div>
                <div className="mt-2"><p className="font-semibold">Từ vựng cần học lại:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.vocabularyToReview || "Không có"}</p></div>

                <div className="pt-3 mt-4 border-t"><p className="whitespace-pre-line text-sm text-foreground leading-relaxed font-sans">{gradeSlipData.footer}</p></div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-muted/50 sm:justify-between">
              <Button type="button" onClick={handleExportGradeSlipImage} 
                disabled={saveScoresMutation.isPending || (typeof html2canvas === 'undefined')} 
              >
                <Download className="mr-2 h-4 w-4" />
                {typeof html2canvas === 'undefined' ? "Cài đặt html2canvas..." : "Xuất file ảnh"}
              </Button>
              <DialogClose asChild><Button type="button" variant="outline">Đóng</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}

const homeworkStatusToDisplayText = (status?: HomeworkStatus): string => {
  if (!status || status === "") return "Không có bài tập về nhà";
  return status;
};


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
