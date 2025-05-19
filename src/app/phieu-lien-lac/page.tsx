
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle as ShadCNCardTitle, CardDescription as ShadCNCardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader as ShadDialogHeader, DialogTitle as ShadDialogTitleOriginal, DialogDescription as ShadDialogDescriptionOriginal, DialogFooter, DialogClose } from '@/components/ui/dialog';
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
import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate, getPhieuLienLacRecordsForStudentInRange } from '@/services/phieuLienLacService';
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { format, parse, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle, BookCopy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
// @ts-ignore
import html2canvas from 'html2canvas';
import DashboardLayout from '../dashboard-layout';

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

const calculateMasteryDetailsForPLL = (testFormat?: TestFormatPLC, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (!testFormat || testFormat === "") {
    return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
  }
  if (testFormat === "KT bài cũ") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Thuộc bài, còn sai sót 1 vài từ", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài, còn sai sót nhiều", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT miệng") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") {
    return { text: "Không có KT bài", isTrulyMastered: false };
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};


export default function PhieuLienLacPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null); 

  const [studentSlipInputs, setStudentSlipInputs] = useState<Record<string, StudentSlipInput>>({});
  const [initialLoadedStudentSlipIds, setInitialLoadedStudentSlipIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'nhap-diem' | 'lich-su'>('nhap-diem');

  const [commonHomeworkVocabulary, setCommonHomeworkVocabulary] = useState<string>("");
  const [commonHomeworkTasks, setCommonHomeworkTasks] = useState<string>("");

  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [currentSlipData, setCurrentSlipData] = useState<PhieuLienLacRecord | null>(null);
  const slipDialogContentRef = useRef<HTMLDivElement>(null);
  const entryTabTriggerRef = useRef<HTMLButtonElement>(null);

  const [isPeriodicSlipModalOpen, setIsPeriodicSlipModalOpen] = useState(false);
  const [periodicSlipStudent, setPeriodicSlipStudent] = useState<HocSinh | null>(null);
  const [allDailySlipsForPeriodic, setAllDailySlipsForPeriodic] = useState<PhieuLienLacRecord[]>([]);
  const [isLoadingPeriodicSlipRecords, setIsLoadingPeriodicSlipRecords] = useState(false);
  const [periodicSlipSummaryRemark, setPeriodicSlipSummaryRemark] = useState<string>("");
  const periodicSlipDialogContentRef = useRef<HTMLDivElement>(null);

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 60000 * 1,
  });

  const { data: studentsInSelectedClass = [], isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudentsInClass } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClassForPLL', selectedClassId],
    queryFn: () => getStudentsByClassId(selectedClassId),
    enabled: !!selectedClassId && isClient,
    staleTime: 60000 * 1,
  });

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    if (!selectedDate) return '';
    return format(selectedDate, 'yyyy-MM-dd');
  }, [selectedDate]);

  const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, isError: isErrorExistingSlips, error: errorExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate!), 
    enabled: !!selectedClassId && !!selectedDate && !!memoizedFormattedSelectedDateKey && isClient && !isLoadingClasses && !isLoadingStudents,
    staleTime: 60000 * 1, // Consider shorter staleTime if immediate reflection of saves is critical without manual refetch
  });
  
  useEffect(() => {
    setIsClient(true);
    setSelectedDate(new Date());
    console.log("[PLLPage] Component mounted on client, selectedDate initialized.");
  }, []);

  useEffect(() => {
    console.log(`[PLLPage] Date or Class changed effect. Resetting states. New DateKey: ${memoizedFormattedSelectedDateKey}, New ClassId: ${selectedClassId}`);
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null);
    setCommonHomeworkVocabulary(""); // Reset common homework too
    setCommonHomeworkTasks("");

    if (selectedClassId && memoizedFormattedSelectedDateKey) {
      console.log(`[PLLPage] Date/Class Change: Invalidating existingPhieuLienLac for key: ['existingPhieuLienLac', ${selectedClassId}, ${memoizedFormattedSelectedDateKey}]`);
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
    }
    if (selectedClassId) {
      console.log(`[PLLPage] Date/Class Change: Refetching students for class ${selectedClassId}`);
      refetchStudentsInClass();
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient]); // queryClient, refetchStudentsInClass removed to simplify, actions are fine

  useEffect(() => {
    console.log(`[PLLPage] Main useEffect (data sync) triggered. isClient: ${isClient}, isLoadingStudents: ${isLoadingStudents}, isLoadingExistingSlips: ${isLoadingExistingSlips}, studentsInSelectedClass count: ${studentsInSelectedClass?.length}, existingSlipsData count: ${existingSlipsData?.length}`);
    
    if (!isClient || isLoadingStudents || isLoadingExistingSlips || !studentsInSelectedClass || !selectedDate) {
      console.log(`[PLLPage] Main useEffect (data sync): Skipping state update due to loading/missing data, not client, or no students/date.`);
      return;
    }
    
    const newInputsToSet: Record<string, StudentSlipInput> = {};
    const newLoadedIds = new Set<string>();
    let commonVocabFromDb = "";
    let commonTasksFromDb = "";
    let commonHwInitializedFromDb = false;

    studentsInSelectedClass.forEach(student => {
      const existingDbSlip = existingSlipsData?.find(s => s.studentId === student.id);
      const currentLocalInput = studentSlipInputs[student.id]; // User's current possibly modified input

      if (existingDbSlip) {
        const masteryDetailsFromDb = calculateMasteryDetailsForPLL(existingDbSlip.testFormat, existingDbSlip.score);
        const entryFromDb: StudentSlipInput = {
          testFormat: existingDbSlip.testFormat,
          score: existingDbSlip.score === null || existingDbSlip.score === undefined ? '' : String(existingDbSlip.score),
          lessonMasteryText: masteryDetailsFromDb.text,
          homeworkStatus: existingDbSlip.homeworkStatus,
          vocabularyToReview: existingDbSlip.vocabularyToReview || '',
          remarks: existingDbSlip.remarks || '',
          homeworkAssignmentVocabulary: existingDbSlip.homeworkAssignmentVocabulary || '',
          homeworkAssignmentTasks: existingDbSlip.homeworkAssignmentTasks || '',
        };
        
        // Prioritize user's current input if they are editing this specific student
        if (student.id === editingStudentId && currentLocalInput) {
          newInputsToSet[student.id] = currentLocalInput;
          console.log(`[PLLPage] Main useEffect (data sync): Student ${student.id} is being edited, preserving local input:`, currentLocalInput);
        } else {
          newInputsToSet[student.id] = entryFromDb;
        }

        if (!isSlipInputEmpty(entryFromDb)) {
          newLoadedIds.add(student.id);
        }
        if (!commonHwInitializedFromDb && (existingDbSlip.homeworkAssignmentVocabulary || existingDbSlip.homeworkAssignmentTasks)) {
            commonVocabFromDb = existingDbSlip.homeworkAssignmentVocabulary || "";
            commonTasksFromDb = existingDbSlip.homeworkAssignmentTasks || "";
            commonHwInitializedFromDb = true;
        }
      } else { // No data in DB for this student
        // If there's already local input (e.g., user started typing for a new entry), preserve it.
        // Otherwise, create a new empty entry.
        if (currentLocalInput && student.id === editingStudentId) { // Preserve if editing a "new" entry that isn't in DB yet
            newInputsToSet[student.id] = currentLocalInput;
             console.log(`[PLLPage] Main useEffect (data sync): Student ${student.id} (no DB slip) is being edited, preserving local input:`, currentLocalInput);
        } else if (currentLocalInput && !isSlipInputEmpty(currentLocalInput) && !initialLoadedStudentSlipIds.has(student.id)) {
            // User has typed something for a brand new entry (not yet saved, not in initialLoaded)
            newInputsToSet[student.id] = currentLocalInput;
            console.log(`[PLLPage] Main useEffect (data sync): Student ${student.id} (no DB slip) has unsaved local input, preserving:`, currentLocalInput);
        }
        else { // New, truly empty entry to be created in the form
          const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
          newInputsToSet[student.id] = {
            testFormat: undefined, score: '', lessonMasteryText: masteryDetailsForEmpty.text,
            homeworkStatus: undefined, vocabularyToReview: '', remarks: '',
            homeworkAssignmentVocabulary: commonHomeworkVocabulary,
            homeworkAssignmentTasks: commonHomeworkTasks,
          };
        }
      }
    });
    
    // This ensures common homework is applied to entries that might not have received it
    // (e.g., entries that were preserved as `currentLocalInput` above)
    studentsInSelectedClass.forEach(student => {
        if (newInputsToSet[student.id]) {
            if (newInputsToSet[student.id].homeworkAssignmentVocabulary === undefined || newInputsToSet[student.id].homeworkAssignmentVocabulary === '') {
                newInputsToSet[student.id].homeworkAssignmentVocabulary = commonHomeworkVocabulary;
            }
            if (newInputsToSet[student.id].homeworkAssignmentTasks === undefined || newInputsToSet[student.id].homeworkAssignmentTasks === '') {
                newInputsToSet[student.id].homeworkAssignmentTasks = commonHomeworkTasks;
            }
        }
    });

    // Only update states if they've actually changed to prevent unnecessary re-renders
    if (JSON.stringify(studentSlipInputs) !== JSON.stringify(newInputsToSet)) {
        console.log("[PLLPage] Main useEffect (data sync): Updating studentSlipInputs because new derived state is different.");
        setStudentSlipInputs(newInputsToSet);
    } else {
        console.log("[PLLPage] Main useEffect (data sync): studentSlipInputs are the same as new derived state, skipping update.");
    }

    if (JSON.stringify(Array.from(initialLoadedStudentSlipIds).sort()) !== JSON.stringify(Array.from(newLoadedIds).sort())) {
        console.log("[PLLPage] Main useEffect (data sync): Updating initialLoadedStudentSlipIds.", newLoadedIds);
        setInitialLoadedStudentSlipIds(newLoadedIds);
    }
    
    if (commonHwInitializedFromDb) {
        if (commonHomeworkVocabulary !== commonVocabFromDb) setCommonHomeworkVocabulary(commonVocabFromDb);
        if (commonHomeworkTasks !== commonTasksFromDb) setCommonHomeworkTasks(commonTasksFromDb);
    }
  }, [existingSlipsData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingSlips, isClient, commonHomeworkVocabulary, commonHomeworkTasks, editingStudentId]); // Key: editingStudentId is a dep so that preserving its input works

  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    console.log(`[PLLPage] handleSlipInputChange: Student ${studentId}, Field: ${field}, Value:`, value);
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || { score: '', vocabularyToReview: '', remarks: '', homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks };
      let updatedEntry: StudentSlipInput = { ...currentEntry, [field]: value };

      if (field === 'testFormat' || field === 'score') {
        const masteryDetails = calculateMasteryDetailsForPLL(
          field === 'testFormat' ? value as TestFormatPLC : updatedEntry.testFormat,
          String(field === 'score' ? value : updatedEntry.score)
        );
        updatedEntry.lessonMasteryText = masteryDetails.text;
      }
      return { ...prev, [studentId]: updatedEntry };
    });
  }, [commonHomeworkVocabulary, commonHomeworkTasks]); // Dependencies ensure common HW is correctly referenced if currentEntry is new

 const studentsForHistoryTab = useMemo(() => {
    console.log(`[PLLPage] studentsForHistoryTab useMemo. initialLoadedStudentSlipIds:`, initialLoadedStudentSlipIds, `editingStudentId: ${editingStudentId}`);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) {
      console.log("[PLLPage] studentsForHistoryTab: Bailing early due to loading state or no students.");
      return [];
    }
    const result = studentsInSelectedClass.filter(student => 
        initialLoadedStudentSlipIds.has(student.id) && 
        !isSlipInputEmpty(studentSlipInputs[student.id]) &&
        student.id !== editingStudentId 
    );
    console.log(`[PLLPage] Result for studentsForHistoryTab (count: ${result.length}):`, result.map(s => ({id: s.id, name: s.hoTen})));
    return result;
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);


  const studentsForEntryTab = useMemo(() => {
    console.log(`[PLLPage] studentsForEntryTab useMemo. editingStudentId: ${editingStudentId}, initialLoadedStudentIds:`, initialLoadedStudentSlipIds);
     if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) {
      console.log("[PLLPage] studentsForEntryTab: Bailing early due to loading state or no students.");
      return [];
    }

    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      console.log(`[PLLPage] Students for EntryTab (editing student ${editingStudentId}):`, studentBeingEdited ? [studentBeingEdited].map(s=>({id: s.id, name: s.hoTen})) : []);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }

    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const entryCandidates = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    console.log(`[PLLPage] Students for EntryTab (not editing, count: ${entryCandidates.length}):`, entryCandidates.map(s=>({id: s.id, name: s.hoTen})));
    return entryCandidates;
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);


  const saveSlipsMutation = useMutation({
    mutationFn: savePhieuLienLacRecords,
    onSuccess: (data, variables) => {
      console.log("[PLLPage] saveSlipsMutation onSuccess. Variables:", variables);
      toast({ title: "Thành công!", description: `Phiếu liên lạc đã được lưu cho ${variables.length} học sinh.` });
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      setEditingStudentId(null); // Clear editing state after save
      setActiveTab('lich-su');
    },
    onError: (error: Error) => {
      console.error("[PLLPage] saveSlipsMutation error:", error);
      toast({
        title: "Lỗi khi lưu phiếu liên lạc",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
        duration: 7000,
      });
    },
  });

  const handleSaveAllSlips = useCallback(() => {
    console.log("[PLLPage] handleSaveAllSlips called.");
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
    
    // Process students who are either being edited or are new entries, or loaded entries that might have changed common HW
    const studentsToProcess = studentsInSelectedClass.filter(student => {
        const input = studentSlipInputs[student.id];
        // Save if it's the student being edited,
        // OR if it's a new entry that's not empty,
        // OR if it's a loaded entry (to ensure common HW updates are saved even if student-specific fields didn't change)
        return student.id === editingStudentId || 
               (input && !isSlipInputEmpty(input) && !initialLoadedStudentSlipIds.has(student.id)) ||
               initialLoadedStudentSlipIds.has(student.id);
    });

    console.log("[PLLPage] handleSaveAllSlips: Students to process for saving:", studentsToProcess.map(s => ({id: s.id, name: s.hoTen})));

    studentsToProcess.forEach(student => {
      const input = studentSlipInputs[student.id];
      if (input) { // Ensure input exists
        const masteryDetails = calculateMasteryDetailsForPLL(input.testFormat, input.score);
        const scoreToSave = (input.score === undefined || input.score === null || String(input.score).trim() === '')
                            ? null
                            : (isNaN(Number(input.score)) ? null : Number(input.score));

        if (input.score !== undefined && input.score !== null && String(input.score).trim() !== '' && isNaN(Number(input.score))) {
            toast({ title: "Lỗi dữ liệu", description: `Điểm số không hợp lệ cho học sinh ${student.hoTen}. Sẽ được lưu là không có điểm.`, variant: "warning", duration: 5000});
        }

        const recordPayload: Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt'> = {
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey, // Use the string key
          testFormat: input.testFormat || undefined,
          score: scoreToSave,
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: input.homeworkStatus || undefined,
          vocabularyToReview: input.vocabularyToReview || '',
          remarks: input.remarks || '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, // Save common homework
          homeworkAssignmentTasks: commonHomeworkTasks,       // Save common homework
        };
        recordsToSave.push(recordPayload);
      }
    });

    console.log("[PLLPage] handleSaveAllSlips: Records to save to Firestore:", recordsToSave);
    if (recordsToSave.length === 0) {
        toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." });
        return;
    }

    saveSlipsMutation.mutate(recordsToSave);
  }, [selectedClassId, selectedDate, classes, studentsInSelectedClass, studentSlipInputs, editingStudentId, initialLoadedStudentSlipIds, saveSlipsMutation, toast, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, queryClient, setActiveTab]);

  const handleEditSlip = useCallback((studentId: string) => {
    console.log(`[PLLPage] handleEditSlip called for studentId: ${studentId}`);
    setEditingStudentId(studentId);
    setActiveTab("nhap-diem");
    requestAnimationFrame(() => {
        const trigger = entryTabTriggerRef.current;
        if (trigger) {
          trigger.focus(); // Focus first for screen readers
          trigger.click(); // Then click
        } else {
            console.warn("[PLLPage] handleEditSlip: Entry tab trigger ref not found.");
        }
    });
  }, [setActiveTab]);

  const handleDeleteSlipEntry = useCallback((studentId: string) => {
    console.log(`[PLLPage] handleDeleteSlipEntry called for studentId: ${studentId}`);
    const studentName = studentsInSelectedClass.find(s=>s.id === studentId)?.hoTen || "học sinh này";
    const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, null);
    setStudentSlipInputs(prev => ({
      ...prev,
      [studentId]: {
        testFormat: undefined, score: null, lessonMasteryText: masteryDetailsForEmpty.text,
        homeworkStatus: undefined, vocabularyToReview: '', remarks: '',
        homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
        homeworkAssignmentTasks: commonHomeworkTasks, 
      }
    }));
    setEditingStudentId(studentId); // Set as editing to ensure it moves to entry tab and save button is enabled
    setActiveTab("nhap-diem");
    requestAnimationFrame(() => { entryTabTriggerRef.current?.click(); });
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho ${studentName}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
  }, [studentsInSelectedClass, toast, commonHomeworkVocabulary, commonHomeworkTasks, setActiveTab]);

  const handleOpenSlipDialog = useCallback(async (studentId: string) => {
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const inputData = studentSlipInputs[studentId];

    if (!student || !selectedClass || !inputData || !selectedDate) {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu xem trước. Dữ liệu nhập hoặc ngày/lớp còn thiếu.", variant: "destructive" });
      return;
    }

    const masteryDetails = calculateMasteryDetailsForPLL(inputData.testFormat, inputData.score);
    const scoreForSlip = (inputData.score === undefined || inputData.score === null || String(inputData.score).trim() === '') ? null : Number(inputData.score);

    const slip: PhieuLienLacRecord = {
      id: existingSlipsData?.find(s => s.studentId === student.id && s.classId === selectedClassId && s.date === memoizedFormattedSelectedDateKey)?.id || `temp-${student.id}-${Date.now()}`,
      studentId: student.id, studentName: student.hoTen, classId: selectedClassId,
      className: selectedClass.tenLop, date: memoizedFormattedSelectedDateKey,
      testFormat: inputData.testFormat, score: scoreForSlip, lessonMasteryText: masteryDetails.text,
      homeworkStatus: inputData.homeworkStatus, vocabularyToReview: inputData.vocabularyToReview,
      remarks: inputData.remarks,
      homeworkAssignmentVocabulary: commonHomeworkVocabulary,
      homeworkAssignmentTasks: commonHomeworkTasks,
    };
    setCurrentSlipData(slip);
    setIsSlipModalOpen(true);
  }, [studentsInSelectedClass, classes, selectedClassId, studentSlipInputs, existingSlipsData, memoizedFormattedSelectedDateKey, toast, commonHomeworkVocabulary, commonHomeworkTasks, selectedDate]);

  const handleExportSlipImage = useCallback(async () => {
    if (!slipDialogContentRef.current || !currentSlipData) {
      toast({ title: "Lỗi", description: "Không có nội dung phiếu để xuất.", variant: "destructive"});
      return;
    }
    if (typeof html2canvas === 'undefined') {
        toast({ title: "Lỗi Xuất Ảnh", description: "Thư viện html2canvas chưa được tải. Vui lòng cài đặt và khởi động lại server.", variant: "destructive"});
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
      console.error("[PLLPage] Error exporting daily slip image:", error);
      toast({ title: "Lỗi xuất ảnh", description: (error as Error).message, variant: "destructive" });
    }
  }, [currentSlipData, toast]);

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

  const getHomeworkStatusTextAndColor = (status?: HomeworkStatusPLC): {text: string, className: string} => {
    if (!status || status === "") return {text: "Không có bài tập về nhà", className: "text-muted-foreground"};
    if (status === "Đã làm bài đầy đủ") return {text: status, className: "text-blue-600 dark:text-blue-400 font-medium"};
    if (status === "Chỉ làm bài 1 phần" || status === "Chỉ làm 2/3 bài") return {text: status, className: "text-orange-500 dark:text-orange-400 font-medium"};
    if (status === "Không làm bài") return {text: status, className: "text-red-600 dark:text-red-400 font-medium"};
    return {text: status || "Không có bài tập về nhà", className: "text-muted-foreground"};
  };

  const getLessonMasteryTextAndColor = (masteryText: string | undefined, isTrulyMastered: boolean): {text: string, className: string} => {
    const defaultText = "Chưa đánh giá";
    if (!masteryText || masteryText.includes("Chưa chọn hình thức KT") || masteryText.includes("Chưa có điểm/Chưa đánh giá")) {
        return {text: masteryText || defaultText, className: "text-muted-foreground"};
    }
    if (masteryText.includes("Không có KT bài")) return {text: masteryText, className: "text-muted-foreground font-normal"};
    if (masteryText.includes("Không thuộc bài")) return {text: masteryText, className: "text-red-600 dark:text-red-400 font-medium"};
    if (isTrulyMastered) return {text: masteryText, className: "text-blue-600 dark:text-blue-400 font-medium"};
    return {text: masteryText, className: "text-orange-500 dark:text-orange-400 font-medium"};
  };

  const saveButtonText = useMemo(() => {
    if (editingStudentId) return "Lưu Thay Đổi";
    return "Lưu Tất Cả";
  }, [editingStudentId]);


  const canSaveChanges = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId) return true; // Always allow save if editing

    return studentsInSelectedClass.some(student => {
        const input = studentSlipInputs[student.id];
        return input && !isSlipInputEmpty(input) && !initialLoadedStudentSlipIds.has(student.id);
    }) || (initialLoadedStudentSlipIds.size > 0 && 
           (studentsInSelectedClass.some(s => {
                const originalSlip = existingSlipsData?.find(es => es.studentId === s.id);
                const currentInput = studentSlipInputs[s.id];
                if (!originalSlip || !currentInput) return false;
                return originalSlip.homeworkAssignmentVocabulary !== currentInput.homeworkAssignmentVocabulary ||
                       originalSlip.homeworkAssignmentTasks !== currentInput.homeworkAssignmentTasks;
           }))
    );
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, initialLoadedStudentSlipIds, existingSlipsData]);

  const handleOpenPeriodicSlipDialog = async (student: HocSinh) => {
    if (!selectedClassId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn lớp trước.", variant: "destructive"});
      return;
    }
    setIsLoadingPeriodicSlipRecords(true);
    setPeriodicSlipStudent(student);
    setPeriodicSlipSummaryRemark(""); 
    try {
      console.log(`[PLLPage] Fetching periodic slips for student ${student.id} in class ${selectedClassId}`);
      const records = await getPhieuLienLacRecordsForStudentInRange(student.id, selectedClassId);
      console.log(`[PLLPage] Fetched ${records.length} periodic slips for student ${student.id}:`, records);
      setAllDailySlipsForPeriodic(records);
      setIsPeriodicSlipModalOpen(true);
    } catch (error) {
       console.error(`[PLLPage] Error fetching periodic slips for student ${student.id}:`, error);
       toast({
        title: "Lỗi tải dữ liệu phiếu chu kỳ",
        description: (error as Error).message || "Không thể tải dữ liệu phiếu liên lạc cho học sinh này. Vui lòng kiểm tra console server (Firebase Studio terminal) để biết lỗi chi tiết từ Firebase (e.g., missing index, permissions).",
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoadingPeriodicSlipRecords(false);
    }
  };

  const handleExportPeriodicSlipImage = async () => {
    if (!periodicSlipDialogContentRef.current || !periodicSlipStudent) {
      toast({ title: "Lỗi", description: "Không có nội dung phiếu để xuất.", variant: "destructive"});
      return;
    }
    if (typeof html2canvas === 'undefined') {
        toast({ title: "Lỗi Xuất Ảnh", description: "Thư viện html2canvas chưa được tải. Vui lòng cài đặt và khởi động lại server.", variant: "destructive"});
        return;
    }
    try {
        const canvas = await html2canvas(periodicSlipDialogContentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `PhieuLienLacChuKy_${periodicSlipStudent.hoTen.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Thành công!", description: "Phiếu liên lạc chu kỳ đã được xuất ra ảnh." });
    } catch (error) {
      console.error("[PLLPage] Error exporting periodic slip image:", error);
      toast({ title: "Lỗi xuất ảnh", description: (error as Error).message, variant: "destructive" });
    }
  };

  const currentClassForPeriodicSlip = useMemo(() => classes.find(c => c.id === periodicSlipStudent?.lopId), [classes, periodicSlipStudent]);

  const periodicSlipDateRange = useMemo(() => {
    if (allDailySlipsForPeriodic.length === 0) return "N/A";
    const sortedSlips = [...allDailySlipsForPeriodic].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstDate = parseISO(sortedSlips[0].date);
    const lastDate = parseISO(sortedSlips[sortedSlips.length - 1].date);
    return `Từ ${format(firstDate, "dd/MM/yyyy", {locale: vi})} đến ${format(lastDate, "dd/MM/yyyy", {locale: vi})}`;
  }, [allDailySlipsForPeriodic]);

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
            <ShadCNCardTitle>Thông tin chung phiếu liên lạc</ShadCNCardTitle>
            <ShadCNCardDescription>Chọn lớp và ngày để bắt đầu ghi nhận phiếu liên lạc.</ShadCNCardDescription>
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
                  <Calendar mode="single" selected={selectedDate || undefined} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={vi} />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-md">
          <CardHeader>
            <ShadCNCardTitle>Hướng dẫn Bài tập về nhà (Chung cho cả lớp)</ShadCNCardTitle>
            <ShadCNCardDescription>Nhập nội dung bài tập về nhà sẽ được áp dụng cho tất cả học sinh trong lớp vào ngày đã chọn.</ShadCNCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="common-hw-vocab">Từ vựng cần học</Label>
              <Textarea
                id="common-hw-vocab"
                placeholder="VD: Unit 1 - Vocabulary List A, B, C..."
                value={commonHomeworkVocabulary}
                onChange={(e) => setCommonHomeworkVocabulary(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="common-hw-tasks">Bài tập làm tại nhà</Label>
              <Textarea
                id="common-hw-tasks"
                placeholder="VD: Workbook trang 10-12, Viết 5 câu sử dụng thì hiện tại đơn..."
                value={commonHomeworkTasks}
                onChange={(e) => setCommonHomeworkTasks(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>


        {isErrorClasses && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách lớp.</div>}
        {selectedClassId && isErrorStudents && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách học sinh cho lớp này.</div>}
        {selectedClassId && selectedDate && isErrorExistingSlips &&
          <div className="p-4 text-destructive text-center border border-destructive/50 bg-destructive/10 rounded-md shadow-sm">
            <AlertCircle className="inline mr-2 h-5 w-5"/>Lỗi tải lịch sử phiếu liên lạc đã có.
            <p className="text-xs text-muted-foreground mt-1">{(errorExistingSlips as Error)?.message || "Không thể tải dữ liệu."} Kiểm tra console server Next.js.</p>
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
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Lịch sử nhận xét ({studentsForHistoryTab.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="nhap-diem">
                  {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                  {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && activeTab === 'nhap-diem' && (
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
                          <TableHead className="w-[200px] sticky top-0 bg-card z-10">Bài tập về nhà</TableHead>
                          <TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Từ vựng cần học lại</TableHead>
                          <TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Nhận xét</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForEntryTab.map((student) => {
                          const currentInput = studentSlipInputs[student.id] || {};
                           console.log(`[PLLPage] Rendering score input for ${student.hoTen}, score in state: '${currentInput.score}'`);
                          const masteryDetails = calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score);
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
                                  value={currentInput.score || ''}
                                  onChange={(e) => handleSlipInputChange(student.id, 'score', e.target.value)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell className={cn("font-medium", getLessonMasteryTextAndColor(masteryDetails.text, masteryDetails.isTrulyMastered).className)}>
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
                          <TableHead className="sticky top-0 bg-card z-10">Bài tập về nhà</TableHead>
                          <TableHead className="text-right w-[220px] sticky top-0 bg-card z-10">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsForHistoryTab.map((student, index) => {
                          const slipData = studentSlipInputs[student.id] || {};
                          const masteryDetails = calculateMasteryDetailsForPLL(slipData.testFormat, slipData.score);
                          const homeworkDisplay = getHomeworkStatusTextAndColor(slipData.homeworkStatus);
                          const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, calculateMasteryDetailsForPLL(slipData.testFormat, slipData.score).isTrulyMastered);
                          return (
                            <TableRow key={student.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell>{slipData.testFormat || 'N/A'}</TableCell>
                              <TableCell>{renderScoreDisplay(slipData.score)}</TableCell>
                              <TableCell className={cn("font-medium", lessonMasteryDisplay.className)}>
                                {lessonMasteryDisplay.text}
                              </TableCell>
                              <TableCell className={cn(homeworkDisplay.className)}>
                                {homeworkDisplay.text}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                   <Button variant="outline" size="icon" onClick={() => handleEditSlip(student.id)} aria-label="Sửa phiếu" disabled={saveSlipsMutation.isPending}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(student.id)} aria-label="Xóa phiếu (cục bộ)" disabled={saveSlipsMutation.isPending}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(student.id)} aria-label="Xem/Xuất phiếu ngày" disabled={saveSlipsMutation.isPending}>
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                   <Button variant="secondary" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Xuất phiếu chu kỳ" disabled={isLoadingPeriodicSlipRecords || saveSlipsMutation.isPending}>
                                    {isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id ? <Loader2 className="animate-spin h-4 w-4"/> : <BookCopy className="h-4 w-4" />}
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
             {selectedClassId && selectedDate && studentsInSelectedClass.length > 0 && (activeTab === 'nhap-diem' || editingStudentId) && (
              <CardFooter className="border-t pt-6">
                <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                  {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveButtonText}
                </Button>
                 {editingStudentId && activeTab === 'nhap-diem' && (
                    <Button variant="ghost" onClick={() => {
                        setEditingStudentId(null); // Clear editing state
                        // Optionally, revert changes for this student if desired, or just switch tab
                        setActiveTab('lich-su'); 
                    }} className="ml-2" disabled={saveSlipsMutation.isPending}>
                        Hủy Sửa
                    </Button>
                )}
              </CardFooter>
            )}
          </Card>
        )}

        {/* Dialog for Daily Slip Preview */}
        <Dialog open={isSlipModalOpen} onOpenChange={setIsSlipModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
            <ShadDialogHeader className="p-4 pb-0 sticky top-0 z-10 bg-background text-center"> 
              <ShadDialogTitleOriginal className="text-2xl font-bold uppercase text-primary text-center">
                  PHIẾU LIÊN LẠC
              </ShadDialogTitleOriginal>
              {currentSlipData?.date && (
                  <ShadDialogDescriptionOriginal className="text-sm text-center">
                  Ngày: {format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}
                  </ShadDialogDescriptionOriginal>
              )}
            </ShadDialogHeader>
            <ScrollArea className="flex-grow pt-0 p-0"> 
              <div ref={slipDialogContentRef} className="bg-background font-sans leading-snug p-4 space-y-0.5"> 
                  {currentSlipData ? (
                  <>
                     <div className="grid grid-cols-2 gap-x-6 mb-1 text-sm">
                        <p><strong className="font-medium text-muted-foreground mr-1">Họ và tên:</strong> <span className="text-indigo-700 font-semibold text-base">{currentSlipData.studentName}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Lớp:</strong> <span className="font-medium text-base">{currentSlipData.className}</span></p>
                        <p><strong className="font-medium text-muted-foreground mr-1">Mã HS:</strong> <span className="font-medium text-base">{currentSlipData.studentId}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Ngày KT:</strong> <span className="font-medium text-base">{format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}</span></p>
                     </div>
                      <Separator className="my-1 mt-2"/>
                      <h3 className="text-md font-semibold text-foreground mt-2 mb-1">Kết quả học tập:</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-sm">
                          <div className="space-y-0.5">
                            <div className="flex"><strong className="font-medium text-muted-foreground mr-1 w-28 shrink-0">Hình thức KT:</strong> <span className="font-medium flex-1 text-left">{currentSlipData.testFormat || "N/A"}</span></div>
                            <div className="flex"><strong className="font-medium text-muted-foreground mr-1 w-28 shrink-0">Thuộc bài:</strong> <span className={cn("font-medium flex-1 text-left", getLessonMasteryTextAndColor(currentSlipData.lessonMasteryText, calculateMasteryDetailsForPLL(currentSlipData.testFormat, currentSlipData.score).isTrulyMastered).className)}>{currentSlipData.lessonMasteryText || "Chưa đánh giá"}</span></div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex"><strong className="font-medium text-muted-foreground mr-1 w-28 shrink-0">Điểm số:</strong> <span className="flex-1 text-left">{renderScoreDisplay(currentSlipData.score)}</span></div>
                            <div className="flex"><strong className="font-medium text-muted-foreground mr-1 w-28 shrink-0">Bài tập về nhà:</strong> <span className={cn("font-medium flex-1 text-left", getHomeworkStatusTextAndColor(currentSlipData.homeworkStatus).className)}>{currentSlipData.homeworkStatus ? getHomeworkStatusTextAndColor(currentSlipData.homeworkStatus).text : "Không có bài tập về nhà"}</span></div>
                          </div>
                        </div>
                      <Separator className="my-1 mt-2"/>
                      <SlipDetailItem label="Từ vựng cần học lại:">{currentSlipData.vocabularyToReview || "Không có"}</SlipDetailItem>
                      <SlipDetailItem label="Nhận xét:">{currentSlipData.remarks || "Không có nhận xét."}</SlipDetailItem>

                      <Separator className="my-1 mt-2"/>
                      <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mt-2 mb-1">Hướng dẫn Bài tập về nhà:</h3>
                      <SlipDetailItem label="Từ vựng cần học:">{currentSlipData.homeworkAssignmentVocabulary || "Không có"}</SlipDetailItem>
                      <SlipDetailItem label="Bài tập làm tại nhà:">{currentSlipData.homeworkAssignmentTasks || "Không có"}</SlipDetailItem>

                      <Separator className="my-1 mt-2"/>
                      <div className="text-sm font-medium leading-normal mt-2">
                        {(currentSlipData.vocabularyToReview && currentSlipData.vocabularyToReview.trim() !== "") ? (
                            <>
                                <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.</p>
                                <p className="mt-1"><strong>Trân trọng.</strong></p>
                            </>
                        ) : (
                            <p className="mt-1"><strong>Trân trọng.</strong></p>
                        )}
                      </div>
                  </>
                  ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background sticky bottom-0 z-10">
              <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm">Đóng</Button>
              </DialogClose>
              <Button
                onClick={handleExportSlipImage}
                disabled={!currentSlipData || saveSlipsMutation.isPending || (typeof html2canvas === 'undefined')}
                size="sm"
              >
                 {typeof html2canvas === 'undefined' && !(saveSlipsMutation.isPending || !currentSlipData) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                 {typeof html2canvas === 'undefined' && !(saveSlipsMutation.isPending || !currentSlipData) ? "Đang tải..." : "Xuất file ảnh"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog for Periodic Slip Preview */}
        <Dialog open={isPeriodicSlipModalOpen} onOpenChange={(open) => {
            setIsPeriodicSlipModalOpen(open);
            if (!open) {
                setPeriodicSlipStudent(null);
                setAllDailySlipsForPeriodic([]);
                setPeriodicSlipSummaryRemark("");
            }
        }}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <ShadDialogHeader className="p-6 pb-2 sticky top-0 z-10 bg-background text-center">
                    <ShadDialogTitleOriginal className="text-2xl font-bold uppercase text-primary text-center">
                        PHIẾU LIÊN LẠC CHU KỲ
                    </ShadDialogTitleOriginal>
                    <ShadDialogDescriptionOriginal className="text-sm text-center">
                        Ngày xuất: {format(new Date(), "dd/MM/yyyy", { locale: vi })}
                    </ShadDialogDescriptionOriginal>
                </ShadDialogHeader>
                <ScrollArea className="flex-grow">
                  <div ref={periodicSlipDialogContentRef} className="bg-background font-sans leading-snug p-6 pt-2">
                      {isLoadingPeriodicSlipRecords && <div className="text-center p-10"><Loader2 className="h-8 w-8 animate-spin mx-auto"/> Đang tải dữ liệu...</div>}
                      {!isLoadingPeriodicSlipRecords && periodicSlipStudent && currentClassForPeriodicSlip && (
                          <div className="space-y-1 text-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 mb-2">
                                  <p><strong className="font-medium text-muted-foreground">Họ và tên:</strong> <span className="font-semibold text-indigo-700">{periodicSlipStudent.hoTen}</span></p>
                                  <p><strong className="font-medium text-muted-foreground">Lớp:</strong> <span className="font-medium">{currentClassForPeriodicSlip.tenLop}</span></p>
                                  <p><strong className="font-medium text-muted-foreground">Mã HS:</strong> <span className="font-medium">{periodicSlipStudent.id}</span></p>
                                  <p><strong className="font-medium text-muted-foreground">Chu kỳ học:</strong> <span className="font-medium">{currentClassForPeriodicSlip.chuKyDongPhi} ({periodicSlipDateRange})</span></p>
                              </div>
                              <Separator className="my-2" />
                              <h3 className="text-lg font-semibold text-foreground mt-2 mb-1">Tình hình học tập:</h3>
                              {allDailySlipsForPeriodic.length > 0 ? (
                                  <Table>
                                      <TableHeader>
                                          <TableRow>
                                              <TableHead className="w-[50px]">STT</TableHead>
                                              <TableHead>Ngày KT</TableHead>
                                              <TableHead>Hình thức</TableHead>
                                              <TableHead>Điểm</TableHead>
                                              <TableHead>Thuộc bài</TableHead>
                                              <TableHead>Bài tập về nhà</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {allDailySlipsForPeriodic.map((slip, index) => {
                                              const masteryDetails = calculateMasteryDetailsForPLL(slip.testFormat, slip.score);
                                              const homeworkDisplay = getHomeworkStatusTextAndColor(slip.homeworkStatus);
                                                const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, masteryDetails.isTrulyMastered);
                                              return (
                                              <TableRow key={slip.id}>
                                                  <TableCell>{index + 1}</TableCell>
                                                  <TableCell>{format(parseISO(slip.date), "dd/MM/yy")}</TableCell>
                                                  <TableCell>{slip.testFormat || 'N/A'}</TableCell>
                                                  <TableCell>{renderScoreDisplay(slip.score)}</TableCell>
                                                  <TableCell className={cn("font-medium", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell>
                                                  <TableCell className={cn(homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell>
                                              </TableRow>
                                          )})}
                                      </TableBody>
                                  </Table>
                              ) : (
                                  <p className="text-muted-foreground">Không có dữ liệu phiếu liên lạc chi tiết cho chu kỳ này.</p>
                              )}
                              <Separator className="my-2" />
                                <div className="mt-2">
                                  <Label htmlFor="periodic-summary-remark" className="text-lg font-semibold text-foreground mb-1 block">Nhận xét tổng hợp:</Label>
                                  <Textarea
                                      id="periodic-summary-remark"
                                      value={periodicSlipSummaryRemark}
                                      onChange={(e) => setPeriodicSlipSummaryRemark(e.target.value)}
                                      placeholder="Nhập nhận xét tổng hợp cho học sinh..."
                                      rows={3}
                                      className="text-sm"
                                  />
                              </div>
                                <Separator className="my-2"/>
                              <div className="text-lg font-semibold text-foreground mt-2 text-center">
                                  <p><strong>Trân trọng.</strong></p>
                                  <p><strong>Trần Đông Phú</strong></p>
                              </div>
                          </div>
                      )}
                      {!isLoadingPeriodicSlipRecords && !periodicSlipStudent && <p className="text-center p-10 text-muted-foreground">Không có thông tin học sinh.</p>}
                  </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t sm:justify-between bg-background sticky bottom-0 z-10">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                              setPeriodicSlipSummaryRemark(""); 
                        }}>Đóng</Button>
                    </DialogClose>
                    <Button onClick={handleExportPeriodicSlipImage} disabled={isLoadingPeriodicSlipRecords || !periodicSlipStudent || (typeof html2canvas === 'undefined')} size="sm">
                        {typeof html2canvas === 'undefined' && !(isLoadingPeriodicSlipRecords || !periodicSlipStudent) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        {typeof html2canvas === 'undefined' && !(isLoadingPeriodicSlipRecords || !periodicSlipStudent) ? "Đang tải..." : "Xuất file ảnh"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}


const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shrink-0 bg-border h-[1px] w-full my-1", className)}
    {...props}
  />
));
Separator.displayName = "DialogSeparator";

interface SlipDetailItemProps {
  label: string;
  children: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

const SlipDetailItem: React.FC<SlipDetailItemProps> = ({ label, children, labelClassName, valueClassName }) => {
  return (
    <div className="flex py-0 text-sm"> 
      <strong className={cn("font-medium text-muted-foreground mr-1 w-2/5 shrink-0 text-left", labelClassName)}>{label}</strong>
      <span className={cn("font-medium flex-1 text-left", valueClassName)}>{children}</span>
    </div>
  );
};
