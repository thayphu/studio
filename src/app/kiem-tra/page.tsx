
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
      if (score !== undefined) return { text: "Đã chấm điểm", isMastered: score >= 5 }; // Assuming >= 5 is mastery for graded tests
      return { text: "Không kiểm tra từ vựng", isMastered: false }; // Or some neutral state
    default:
      return { text: "Chưa đánh giá", isMastered: false };
  }
};

const isScoreEntryEmpty = (entry: StudentScoreInput | undefined): boolean => {
  if (!entry) return true;
  return (
    (entry.score === undefined || entry.score === '' || entry.score === null) &&
    (entry.testFormat === undefined || entry.testFormat === "" || entry.testFormat === null) &&
    // masteredLesson is derived, so not part of emptiness check
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});
  const [initialLoadedStudentIds, setInitialLoadedStudentIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("nhap-diem");

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
        console.log("[KiemTraPage] Skipping fetch of existing scores: class or date not selected.");
        return Promise.resolve([]);
      }
      console.log(`[KiemTraPage] Fetching existing scores for class ${selectedClassId} on ${formattedTestDateForQuery}`);
      return getTestScoresForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate,
  });

 useEffect(() => {
    console.log("[KiemTraPage] Effect for existingScoresData triggered. isLoading:", isLoadingExistingScores, "Data:", existingScoresData);
    if (!isLoadingExistingScores && studentsInSelectedClass.length > 0) {
        const newScores: Record<string, StudentScoreInput> = {};
        const newInitialLoadedIds = new Set<string>();

        studentsInSelectedClass.forEach(student => {
            const scoreRecord = existingScoresData?.find(sr => sr.studentId === student.id);
            if (scoreRecord) {
                const masteryDetails = calculateMasteryDetails(scoreRecord.testFormat, scoreRecord.score);
                const populatedEntry: StudentScoreInput = {
                    score: scoreRecord.score !== undefined && scoreRecord.score !== null ? String(scoreRecord.score) : '',
                    testFormat: scoreRecord.testFormat || "",
                    masteredLesson: masteryDetails.isMastered,
                    vocabularyToReview: scoreRecord.vocabularyToReview || '',
                    generalRemarks: scoreRecord.generalRemarks || '',
                    homeworkStatus: scoreRecord.homeworkStatus || '',
                };
                newScores[student.id] = populatedEntry;
                if (!isScoreEntryEmpty(populatedEntry)) { // Only add to initialLoaded if it's not empty
                    newInitialLoadedIds.add(student.id);
                }
            } else {
                // Student exists in class, but no score record for this date/class
                newScores[student.id] = {
                    score: '', testFormat: "", masteredLesson: false,
                    vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
                };
            }
        });
        setStudentScores(newScores);
        setInitialLoadedStudentIds(newInitialLoadedIds);
        console.log("[KiemTraPage] Populated studentScores from DB. Scores:", newScores, "InitialLoadedIDs:", newInitialLoadedIds);
        
        // Reset editingStudentId if their DB-loaded entry is empty or they are no longer in the initial loaded set
        if (editingStudentId && (!newInitialLoadedIds.has(editingStudentId) || isScoreEntryEmpty(newScores[editingStudentId]))) {
           console.log(`[KiemTraPage] Resetting editingStudentId ${editingStudentId} as their DB-loaded entry is empty or they are no longer in initial loaded set.`);
           setEditingStudentId(null); 
        }
    } else if (!isLoadingExistingScores && (!existingScoresData || existingScoresData.length === 0) && studentsInSelectedClass.length > 0) {
        // No existing scores, but students are present. Initialize empty scores for all.
        console.log("[KiemTraPage] No existing scores from DB, but students are present. Initializing empty scores for all.");
        const emptyScores: Record<string, StudentScoreInput> = {};
        studentsInSelectedClass.forEach(student => {
            emptyScores[student.id] = {
                score: '', testFormat: "", masteredLesson: false,
                vocabularyToReview: '', generalRemarks: '', homeworkStatus: ''
            };
        });
        setStudentScores(emptyScores);
        setInitialLoadedStudentIds(new Set());
         if (editingStudentId) setEditingStudentId(null); // Also reset editing state if no scores were loaded
    } else if (studentsInSelectedClass.length === 0 && !isLoadingStudents) {
        // No students in selected class. Clear scores and edit state.
        console.log("[KiemTraPage] No students in selected class. Clearing scores and edit state.");
        setStudentScores({});
        setInitialLoadedStudentIds(new Set());
        setEditingStudentId(null);
    }
}, [existingScoresData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingScores]);


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
    
    // If this student was previously loaded from DB (or saved in this session) and is now being changed, mark them as being edited.
    if (initialLoadedStudentIds.has(studentId) && editingStudentId !== studentId && field !== 'masteredLesson') {
        console.log(`[KiemTraPage] User is editing student ${studentId} who was initially loaded (or has data). Setting as editingStudentId.`);
        setEditingStudentId(studentId);
         // Optionally switch to the "Nhập điểm" tab if not already active
        // if (activeTab !== "nhap-diem") {
            // setActiveTab("nhap-diem"); // This might be too aggressive, consider user experience
        // }
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
      setEditingStudentId(null); 
      console.log("[KiemTraPage] Save successful, editingStudentId reset. Existing scores query invalidated.");
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
      toast({ title: "Thông tin chưa đầy đủ", description: "Vui lòng chọn lớp và ngày kiểm tra.", variant: "destructive" });
      return;
    }
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);
    if (!selectedClass) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" });
      return;
    }

    console.log("[KiemTraPage] handleSaveAllScores triggered. Current studentScores:", JSON.parse(JSON.stringify(studentScores)));
    const recordsToSave: TestScoreRecord[] = studentsInSelectedClass
      .map(student => {
        const currentScoreInput = studentScores[student.id];
        
        // Determine if this student's data should be processed for saving:
        // 1. They are the student currently being edited.
        // 2. They were initially loaded with data (meaning they have an existing record or were saved this session).
        // 3. They have a non-empty score entry now (meaning new data was entered for them).
        const shouldProcess = editingStudentId === student.id || 
                              initialLoadedStudentIds.has(student.id) || 
                              (currentScoreInput && !isScoreEntryEmpty(currentScoreInput));

        if (!shouldProcess) {
           console.log(`[KiemTraPage] Skipping save for student ${student.id} as their entry is empty and they weren't edited or initially loaded with data.`);
           return null;
        }
        console.log(`[KiemTraPage] Preparing to save for student ${student.id}, currentScoreInput:`, currentScoreInput);

        // Convert score to number or null, ensure it's not an empty string or NaN
        const scoreValue = (currentScoreInput?.score !== undefined && currentScoreInput?.score !== null && String(currentScoreInput?.score).trim() !== '' && !isNaN(Number(currentScoreInput?.score)))
          ? Number(currentScoreInput.score)
          : null; // Use null for empty/invalid scores to signify "no score" or "cleared score"

        const masteryDetails = calculateMasteryDetails(currentScoreInput?.testFormat, scoreValue);

        return {
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          testDate: format(selectedDate, 'yyyy-MM-dd'),
          testFormat: currentScoreInput?.testFormat || "",
          score: scoreValue, 
          masteredLesson: masteryDetails.isMastered,
          vocabularyToReview: currentScoreInput?.vocabularyToReview || '',
          generalRemarks: currentScoreInput?.generalRemarks || '',
          homeworkStatus: currentScoreInput?.homeworkStatus || '',
        };
      })
      .filter(record => record !== null) as TestScoreRecord[];

    if (recordsToSave.length === 0) {
      toast({ title: "Không có dữ liệu mới hoặc thay đổi để lưu", description: "Vui lòng nhập điểm hoặc thực hiện thay đổi.", variant: "default" });
      return;
    }
    console.log("[KiemTraPage] Data to save to Firestore:", JSON.stringify(recordsToSave, null, 2));
    saveScoresMutation.mutate(recordsToSave);
  };


  const handlePrepareGradeSlipData = (studentId: string): ReportData | null => {
    if (!selectedClassId || !selectedDate) return null;
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const studentData = studentScores[studentId];
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);
    if (!student || !selectedClass) return null;

    const masteryDetails = calculateMasteryDetails(studentData?.testFormat, studentData?.score);
    const masteryText = masteryDetails.text;
    const isActuallyMastered = masteryDetails.isMastered; 
    const masteryColor = isActuallyMastered ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400";

    let homeworkText = "Không có bài tập về nhà";
    let homeworkColor = "text-muted-foreground";
    const homeworkStatus = studentData?.homeworkStatus;
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
      testDate: format(selectedDate, 'dd/MM/yyyy'), testFormat: studentData?.testFormat, score: studentData?.score,
      masteryText: masteryText, masteryColor: masteryColor,
      vocabularyToReview: studentData?.vocabularyToReview || "Không có",
      remarks: studentData?.generalRemarks || "Không có",
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
      toast({ title: "Lỗi", description: "Không thể tạo phiếu điểm. Vui lòng thử lại.", variant: "destructive" });
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
    // Check if html2canvas is loaded (it might be commented out for debugging)
    if (typeof html2canvas === 'undefined') {
        toast({ 
            title: "Chức năng Xuất Ảnh Chưa Sẵn Sàng", 
            description: "Thư viện html2canvas chưa được tải. Vui lòng đảm bảo đã cài đặt (npm install html2canvas) và khởi động lại server.", 
            variant: "warning",
            duration: 7000
        });
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

  const handleEditScore = (studentId: string) => {
    console.log("[KiemTraPage] handleEditScore called for studentId:", studentId);
    if (studentScores[studentId]) { // Ensure the student has an entry
        setEditingStudentId(studentId);
        setActiveTab("nhap-diem"); 
        // Attempt to click tab trigger if not already active
        requestAnimationFrame(() => {
            const entryTabTrigger = document.querySelector<HTMLButtonElement>('button[role="tab"][data-state="inactive"][value="nhap-diem"]');
            if (entryTabTrigger) {
                entryTabTrigger.click();
            } else {
                // If already active or not found, check if form fields need focus.
                // This part is more complex and might involve refs to form fields.
            }
        });
    } else {
        toast({ title: "Không thể sửa", description: "Không tìm thấy dữ liệu điểm của học sinh này để sửa.", variant: "warning" });
    }
  };

  const handleDeleteScoreEntry = (studentId: string) => {
    console.log("[KiemTraPage] handleDeleteScoreEntry called for studentId:", studentId);
    const masteryDetailsForEmpty = calculateMasteryDetails("", null); // Calculate mastery for an empty entry

    setStudentScores(prev => ({
        ...prev,
        [studentId]: {
            score: null, // Explicitly set score to null for "deleted" state
            testFormat: "",
            masteredLesson: masteryDetailsForEmpty.isMastered,
            vocabularyToReview: '',
            generalRemarks: '',
            homeworkStatus: '',
        }
    }));
    // If this student was being edited, clear editing state.
    // This student will move to "Nhập điểm" tab because their entry in studentScores is now "empty"
    // and they will likely be removed from initialLoadedStudentIds after a save and reload if the empty state is persisted.
    if (editingStudentId === studentId) {
      setEditingStudentId(null); 
    }
    toast({ title: "Đã xoá dữ liệu điểm cục bộ", description: `Dữ liệu điểm của học sinh đã được xoá khỏi form. Nhấn "Lưu Tất Cả Điểm" hoặc "Lưu Thay Đổi Lịch Sử" để cập nhật thay đổi này vào cơ sở dữ liệu.` });
  };


 const studentsForHistoryTab = useMemo(() => {
    console.log("[KiemTraPage] Recalculating studentsForHistoryTab. InitialLoadedIDs:", initialLoadedStudentIds, "EditingStudentId:", editingStudentId, "studentScores:", studentScores);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    
    return studentsInSelectedClass.filter(student =>
        initialLoadedStudentIds.has(student.id) && // Student has existing data or was saved this session
        student.id !== editingStudentId && // And is not currently being edited
        !isScoreEntryEmpty(studentScores[student.id]) // And their current data in the form is not empty
    );
}, [studentsInSelectedClass, studentScores, initialLoadedStudentIds, editingStudentId, isLoadingStudents, isLoadingExistingScores]);


const studentsForEntryTab = useMemo(() => {
    console.log("[KiemTraPage] Recalculating studentsForEntryTab. EditingStudentId:", editingStudentId, "initialLoadedStudentIds:", initialLoadedStudentIds, "studentScores:", studentScores);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingScores) return [];
    
    if (editingStudentId) {
        // If a student is being edited, only show them in the entry tab.
        const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
        const result = studentBeingEdited ? [studentBeingEdited] : [];
        console.log("[KiemTraPage] studentsForEntryTab (editing):", result.map(s => ({id: s.id, name: s.hoTen})));
        return result;
    }

    // Otherwise, show students who are NOT in the history tab (i.e., new entries or cleared entries)
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const result = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    console.log("[KiemTraPage] studentsForEntryTab (not editing):", result.map(s => ({id: s.id, name: s.hoTen})));
    return result;
}, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingScores, initialLoadedStudentIds, studentScores]); // Ensure all dependencies are listed


  const StarRating = ({ count }: { count: number }) => (
    <div className="inline-flex items-center ml-1">
      {[...Array(count)].map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 text-green-500 dark:text-green-400" fill="currentColor" />
      ))}
    </div>
  );

  const renderScoreDisplay = (scoreInput?: number | string | null) => {
    if (scoreInput === undefined || scoreInput === '' || scoreInput === null) {
      return <span className="font-semibold text-lg">N/A</span>;
    }
    const numScore = Number(scoreInput);
    if (isNaN(numScore)) {
      return <span className="font-semibold text-lg text-muted-foreground">{String(scoreInput)}</span>;
    }
    let scoreTextColor = "text-foreground"; let starCount = 0;
    if (numScore >= 9 && numScore <= 10) { scoreTextColor = "text-red-600 dark:text-red-400"; starCount = 5; }
    else if (numScore >= 7) { scoreTextColor = "text-blue-600 dark:text-blue-400"; starCount = 4; }
    else if (numScore >= 5) { scoreTextColor = "text-violet-600 dark:text-violet-400"; starCount = 3; }
    else if (numScore > 0) { scoreTextColor = "text-foreground"; starCount = numScore >= 3 ? 2 : (numScore > 0 ? 1 : 0); }
    else { scoreTextColor = "text-muted-foreground"; }
    return (<><span className={cn("font-semibold text-lg", scoreTextColor)}>{numScore}</span>{starCount > 0 && <StarRating count={starCount} />}</>);
  };

  const isLoadingData = isLoadingClasses || isLoadingStudents || isLoadingExistingScores;

  // Determine if there are actual changes to save
  const hasNewOrChangedEntries = useMemo(() => {
    if (editingStudentId && studentScores[editingStudentId] && !isScoreEntryEmpty(studentScores[editingStudentId])) {
        const originalRecord = existingScoresData?.find(s => s.studentId === editingStudentId);
        // A more robust check would involve deep comparing studentScores[editingStudentId] with the original record.
        // For now, assume any edit means changes.
        if (originalRecord) return true; // Simplified: if editing an existing, assume change
        if (!originalRecord && !isScoreEntryEmpty(studentScores[editingStudentId])) return true; // New entry for a student
    }
    // Check if any student in the entry tab (who is not being edited) has non-empty data
    return studentsForEntryTab.some(student => student.id !== editingStudentId && !isScoreEntryEmpty(studentScores[student.id]));
  }, [studentsForEntryTab, editingStudentId, studentScores, existingScoresData]);
  
  // Determine if any initially loaded student record has been "emptied" (marked for deletion by clearing their data)
  const hasPendingDeletions = useMemo(() => {
      return Array.from(initialLoadedStudentIds).some(studentId => {
          const currentEntry = studentScores[studentId];
          const originalEntry = existingScoresData?.find(s => s.studentId === studentId);
          // If original was not empty, and current is empty, it's a pending deletion
          return originalEntry && !isScoreEntryEmpty(originalEntry as StudentScoreInput) && currentEntry && isScoreEntryEmpty(currentEntry);
      });
  }, [initialLoadedStudentIds, studentScores, existingScoresData]);
  
  const canSaveChanges = hasNewOrChangedEntries || hasPendingDeletions;
  
  const saveButtonText = 
    (activeTab === 'lich-su' && (editingStudentId || hasPendingDeletions)) ? "Lưu Thay Đổi Lịch Sử" : 
    (editingStudentId ? "Lưu Thay Đổi" : "Lưu Tất Cả Điểm");


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
              <Select value={selectedClassId || undefined} onValueChange={(value) => setSelectedClassId(value)} disabled={isLoadingClasses}>
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
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus locale={vi} /></PopoverContent>
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
              {isErrorExistingScores && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center mb-4"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải điểm đã lưu: {errorExistingScores?.message || "Không thể tải dữ liệu."}<p className="text-xs ml-2">(Có thể do thiếu Firestore Index. Vui lòng kiểm tra console server Next.js.)</p></div>)}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger value="nhap-diem" id="tab-trigger-nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><Edit3 className="mr-2 h-4 w-4" /> Nhập điểm ({studentsForEntryTab.length})</TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50"><ListChecks className="mr-2 h-4 w-4" /> Lịch sử nhập ({studentsForHistoryTab.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-entry-${i}`} className="h-10 w-full" />)}</div>)}
                  {isErrorStudents && !isLoadingData && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải danh sách học sinh của lớp này.</div>)}
                  {!isLoadingData && !isErrorStudents && studentsForEntryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">{studentsInSelectedClass.length > 0 ? (studentsForHistoryTab.length > 0 ? "Tất cả học sinh đã có điểm hoặc đang được sửa. Chuyển sang tab 'Lịch sử nhập điểm' để xem." : "Lớp này không có học sinh hoặc tất cả đã được xử lý.") : "Lớp này chưa có học sinh."}</p>)}
                  {!isLoadingData && !isErrorStudents && studentsForEntryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và Tên</TableHead><TableHead className="min-w-[180px]">Hình thức KT</TableHead><TableHead className="w-[100px]">Điểm số</TableHead><TableHead className="min-w-[200px]">Thuộc bài</TableHead><TableHead className="min-w-[200px]">Bài tập về nhà?</TableHead><TableHead className="min-w-[180px]">Từ vựng cần học lại</TableHead><TableHead className="min-w-[180px]">Nhận xét</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {studentsForEntryTab.map((student, index) => {
                            const scoreEntry = studentScores[student.id] || {}; const masteryDetails = calculateMasteryDetails(scoreEntry.testFormat, scoreEntry.score);
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="font-medium">{student.hoTen} {student.id === editingStudentId && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">Đang sửa</Badge>}</TableCell>
                                <TableCell><Select value={scoreEntry.testFormat || ""} onValueChange={(value) => handleScoreInputChange(student.id, 'testFormat', value as TestFormat)}><SelectTrigger><SelectValue placeholder="Chọn hình thức" /></SelectTrigger><SelectContent>{ALL_TEST_FORMATS.map(formatValue => (<SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>))}</SelectContent></Select></TableCell>
                                <TableCell><Input type="text" placeholder="Điểm" value={scoreEntry.score ?? ''} onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.value)} className="w-full" /></TableCell>
                                <TableCell>{masteryDetails.text}</TableCell>
                                <TableCell><Select value={scoreEntry.homeworkStatus || ''} onValueChange={(value) => handleScoreInputChange(student.id, 'homeworkStatus', value as HomeworkStatus)}><SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger><SelectContent>{ALL_HOMEWORK_STATUSES.map(status => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select></TableCell>
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
                  {isLoadingData && (<div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={`skel-hist-${i}`} className="h-10 w-full" />)}</div>)}
                  {isErrorStudents && !isLoadingData && (<div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center"><AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải danh sách học sinh của lớp này.</div>)}
                  {!isLoadingData && !isErrorStudents && studentsForHistoryTab.length === 0 && (<p className="text-muted-foreground text-center py-4">Chưa có điểm nào được lưu hoặc tải cho lựa chọn này. Hãy nhập điểm ở tab 'Nhập điểm'.</p>)}
                  {!isLoadingData && !isErrorStudents && studentsForHistoryTab.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và Tên</TableHead><TableHead>Hình thức KT</TableHead><TableHead className="w-[100px]">Điểm số</TableHead><TableHead className="min-w-[200px]">Thuộc bài</TableHead><TableHead>Bài tập về nhà?</TableHead><TableHead>Nhận xét</TableHead><TableHead className="w-[200px] text-center">Hành động</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {studentsForHistoryTab.map((student, index) => {
                            const scores = studentScores[student.id] || {}; const masteryDetails = calculateMasteryDetails(scores.testFormat, scores.score);
                            return (
                              <TableRow key={student.id}>
                                <TableCell>{index + 1}</TableCell><TableCell className="font-medium">{student.hoTen}</TableCell>
                                <TableCell>{scores.testFormat || 'N/A'}</TableCell><TableCell>{renderScoreDisplay(scores.score)}</TableCell>
                                <TableCell>{masteryDetails.text}</TableCell><TableCell>{scores.homeworkStatus || 'N/A'}</TableCell>
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
             {selectedClassId && selectedDate && (studentsInSelectedClass.length > 0 || editingStudentId) && (
                <CardFooter className="justify-end border-t pt-6">
                  {(activeTab === 'nhap-diem' || (activeTab === 'lich-su' && (editingStudentId || hasPendingDeletions))) && (
                    <Button onClick={handleSaveAllScores} disabled={saveScoresMutation.isPending || !canSaveChanges}>
                        {saveScoresMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
                        {saveButtonText}
                    </Button>
                  )}
                </CardFooter>
            )}
          </Card>
        )}
      </div>

      {isGradeSlipModalOpen && gradeSlipData && (
        <Dialog open={isGradeSlipModalOpen} onOpenChange={setIsGradeSlipModalOpen}>
          <DialogContent className="sm:max-w-lg p-0 font-sans"> {/* Added font-sans here */}
            <div ref={gradeSlipDialogContentRef} className="p-6 bg-card font-sans"> {/* Added font-sans here */}
              <DialogHeader className="text-center mb-4"><ShadDialogTitle className="text-xl font-bold text-primary uppercase tracking-wider">PHIẾU LIÊN LẠC</ShadDialogTitle><ShadDialogDescription className="text-sm text-muted-foreground mt-1">Kết quả kiểm tra ngày: {gradeSlipData.testDate}</ShadDialogDescription></DialogHeader>
              <div className="space-y-1 text-sm leading-snug"> {/* Reduced space-y and leading */}
                <p><span className="font-semibold">Họ và tên:</span> {gradeSlipData.studentName}</p>
                <p><span className="font-semibold">Mã HS:</span> {gradeSlipData.studentId}</p>
                <p><span className="font-semibold">Lớp:</span> {gradeSlipData.className}</p>
                {gradeSlipData.testFormat && <p><span className="font-semibold">Hình thức KT:</span> {gradeSlipData.testFormat}</p>}
                <div><span className="font-semibold">Điểm số: </span>{renderScoreDisplay(gradeSlipData.score)}</div>
                
                <p><span className="font-semibold">Thuộc bài:</span> <span className={cn("font-bold", gradeSlipData.masteryColor)}>{gradeSlipData.masteryText}</span></p>
                
                <div className="mt-1"><p className="font-semibold">Bài tập về nhà:</p><p className={cn("pl-2", gradeSlipData.homeworkColor, (!gradeSlipData.homeworkStatusValue || gradeSlipData.homeworkStatusValue === "") && "italic text-muted-foreground")}>{gradeSlipData.homeworkStatusValue && gradeSlipData.homeworkStatusValue !== "" ? gradeSlipData.homeworkText : "Không có bài tập về nhà"}</p></div>
                <div className="mt-1"><p className="font-semibold">Nhận xét:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.remarks}</p></div>
                <div className="mt-1"><p className="font-semibold">Từ vựng cần học lại:</p><p className="pl-2 whitespace-pre-line">{gradeSlipData.vocabularyToReview}</p></div>
                
                <div className="pt-3 mt-3 border-t"><p className="whitespace-pre-line text-sm text-muted-foreground italic">{gradeSlipData.footer}</p></div>
              </div>
            </div>
            <DialogFooter className="p-4 border-t bg-muted/50 sm:justify-between">
              <Button type="button" onClick={handleExportGradeSlipImage} disabled={typeof html2canvas === 'undefined' || saveScoresMutation.isPending}>
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
