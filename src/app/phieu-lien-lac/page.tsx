
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription as ShadDialogDescription,
  DialogFooter,
  DialogHeader as ShadDialogHeader,
  DialogTitle as ShadDialogTitle,
} from '@/components/ui/dialog';
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
import { savePhieuLienLacRecords, getPhieuLienLacRecordsForClassOnDate, getPhieuLienLacRecordsForStudentInRange, updatePeriodicSummaryForSlip } from '@/services/phieuLienLacService';
import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC, OptionLabel } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC, ALL_OPTION_LABELS } from '@/lib/types';
import { format, parse, parseISO, isValid, addMonths, addWeeks, subDays, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle, BookCopy, CheckCircle, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, dayOfWeekToNumber } from '@/lib/utils';
import DashboardLayout from '../dashboard-layout';

const isSlipInputEmpty = (entry: StudentSlipInput | undefined): boolean => {
  if (!entry) return true;
  const isEmpty = (
    (entry.testFormat === undefined || entry.testFormat === "" || entry.testFormat === null) &&
    (entry.score === undefined || entry.score === null || String(entry.score).trim() === '') &&
    (entry.homeworkStatus === undefined || entry.homeworkStatus === "" || entry.homeworkStatus === null) &&
    (entry.vocabularyToReview === undefined || String(entry.vocabularyToReview).trim() === '') &&
    (entry.remarks === undefined || String(entry.remarks).trim() === '')
  );
  return isEmpty;
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
  
  const [mainActiveTab, setMainActiveTab] = useState<'theo-ngay' | 'theo-chu-ky'>('theo-ngay');
  const [dailySlipActiveTab, setDailySlipActiveTab] = useState<'nhap-phieu' | 'lich-su-nhap'>('nhap-phieu');
  const [periodicSlipActiveTab, setPeriodicSlipActiveTab] = useState<'nhan-xet' | 'lich-su-chu-ky'>('nhan-xet');

  const [commonHomeworkVocabulary, setCommonHomeworkVocabulary] = useState<string>("");
  const [commonHomeworkTasks, setCommonHomeworkTasks] = useState<string>("");

  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [currentSlipData, setCurrentSlipData] = useState<PhieuLienLacRecord | null>(null);
  const slipDialogContentRef = useRef<HTMLDivElement>(null);
  
  const [isPeriodicSlipModalOpen, setIsPeriodicSlipModalOpen] = useState(false);
  const [periodicSlipStudent, setPeriodicSlipStudent] = useState<HocSinh | null>(null);
  const [allDailySlipsForPeriodic, setAllDailySlipsForPeriodic] = useState<PhieuLienLacRecord[]>([]);
  const [isLoadingPeriodicSlipRecords, setIsLoadingPeriodicSlipRecords] = useState(false);
  const [periodicSlipSummaryRemark, setPeriodicSlipSummaryRemark] = useState<string>("");
  const periodicSlipDialogContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    setSelectedDate(new Date());
    console.log("[PLLPage] PhieuLienLacPage mounted or updated - " + new Date().toLocaleTimeString());
  }, []);

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return format(selectedDate, 'yyyy-MM-dd');
    } catch (e) {
      console.error("[PLLPage] Error formatting selectedDate in memo:", e, "selectedDate:", selectedDate);
      return '';
    }
  }, [selectedDate]);

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

  const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, isError: isErrorExistingSlips, error: errorExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => {
      if (!selectedClassId || !selectedDate || !memoizedFormattedSelectedDateKey) {
        console.log("[PLLPage] existingPhieuLienLac query: Skipping due to missing classId, selectedDate, or formattedKey.");
        return Promise.resolve([]);
      }
      console.log(`[PLLPage] existingPhieuLienLac query: Fetching for class ${selectedClassId}, date key ${memoizedFormattedSelectedDateKey}`);
      return getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && !!memoizedFormattedSelectedDateKey && isClient,
  });
  
 useEffect(() => {
    const currentTimestamp = new Date().toLocaleTimeString();
    console.log(`[PLLPage] Main useEffect triggered. Timestamp: ${currentTimestamp}. DateKey: ${memoizedFormattedSelectedDateKey}, ClassId: ${selectedClassId}, isClient: ${isClient}, isLoadingStudents: ${isLoadingStudents}, isLoadingExistingSlips: ${isLoadingExistingSlips}`);
    console.log(`[PLLPage] Main useEffect: editingStudentId: ${editingStudentId}, initialLoadedStudentSlipIds (current):`, initialLoadedStudentSlipIds);

    if (!isClient || isLoadingStudents || isLoadingExistingSlips || !selectedDate || !selectedClassId || !studentsInSelectedClass) {
      console.log("[PLLPage] Main useEffect: Skipping state update due to loading/missing data or not client-ready. StudentsInSelectedClass:", studentsInSelectedClass, "ExistingSlipsData:", existingSlipsData);
      return;
    }

    const newInputsFromEffect: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIdsFromEffect = new Set<string>();
    let commonVocabFromDb = "";
    let commonTasksFromDb = "";
    let commonHwInitializedFromDb = false;

    studentsInSelectedClass.forEach(student => {
      const existingDbSlip = existingSlipsData.find(s => s.studentId === student.id);
      let entryForStudent: StudentSlipInput;
      const currentLocalInput = studentSlipInputs[student.id];

      if (existingDbSlip) {
        const masteryDetailsFromDb = calculateMasteryDetailsForPLL(existingDbSlip.testFormat, existingDbSlip.score);
        const entryFromDb: StudentSlipInput = {
          testFormat: existingDbSlip.testFormat || "",
          score: existingDbSlip.score === null || existingDbSlip.score === undefined ? '' : String(existingDbSlip.score),
          lessonMasteryText: masteryDetailsFromDb.text,
          homeworkStatus: existingDbSlip.homeworkStatus || "",
          vocabularyToReview: existingDbSlip.vocabularyToReview || '',
          remarks: existingDbSlip.remarks || '',
          homeworkAssignmentVocabulary: existingDbSlip.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
          homeworkAssignmentTasks: existingDbSlip.homeworkAssignmentTasks || commonHomeworkTasks,
        };
        
        if (student.id === editingStudentId && currentLocalInput) {
          entryForStudent = currentLocalInput;
        } else {
          entryForStudent = entryFromDb;
        }
        
        if (!isSlipInputEmpty(entryFromDb)) {
          newInitialLoadedIdsFromEffect.add(student.id);
        }

        if (!commonHwInitializedFromDb && (existingDbSlip.homeworkAssignmentVocabulary || existingDbSlip.homeworkAssignmentTasks)) {
            commonVocabFromDb = existingDbSlip.homeworkAssignmentVocabulary || "";
            commonTasksFromDb = existingDbSlip.homeworkAssignmentTasks || "";
            commonHwInitializedFromDb = true;
        }
      } else {
        if (student.id === editingStudentId && currentLocalInput) {
            entryForStudent = currentLocalInput;
        } else {
            const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
            entryForStudent = {
                testFormat: "", score: '', lessonMasteryText: masteryDetailsForEmpty.text,
                homeworkStatus: "", vocabularyToReview: '', remarks: '',
                homeworkAssignmentVocabulary: commonHomeworkVocabulary,
                homeworkAssignmentTasks: commonHomeworkTasks,
            };
        }
      }
      newInputsFromEffect[student.id] = entryForStudent;
    });
    
    if (commonHwInitializedFromDb) {
        if (commonHomeworkVocabulary !== commonVocabFromDb) setCommonHomeworkVocabulary(commonVocabFromDb);
        if (commonHomeworkTasks !== commonTasksFromDb) setCommonHomeworkTasks(commonTasksFromDb);
        Object.keys(newInputsFromEffect).forEach(studentId => {
          if(newInputsFromEffect[studentId]) { 
            newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonVocabFromDb;
            newInputsFromEffect[studentId].homeworkAssignmentTasks = commonTasksFromDb;
          }
        });
    } else if (existingSlipsData.length === 0 && !isLoadingExistingSlips) {
        if (commonHomeworkVocabulary !== "") setCommonHomeworkVocabulary("");
        if (commonHomeworkTasks !== "") setCommonHomeworkTasks("");
         Object.keys(newInputsFromEffect).forEach(studentId => {
            if(newInputsFromEffect[studentId]) {
                newInputsFromEffect[studentId].homeworkAssignmentVocabulary = "";
                newInputsFromEffect[studentId].homeworkAssignmentTasks = "";
            }
        });
    }

    if (JSON.stringify(studentSlipInputs) !== JSON.stringify(newInputsFromEffect)) {
        console.log("[PLLPage] Main useEffect: studentSlipInputs changed. Updating state. Old:", studentSlipInputs, "New:", newInputsFromEffect);
        setStudentSlipInputs(newInputsFromEffect);
    } else {
        console.log("[PLLPage] Main useEffect: studentSlipInputs are the same. Skipping state update.");
    }

    if (JSON.stringify(Array.from(initialLoadedStudentSlipIds).sort()) !== JSON.stringify(Array.from(newInitialLoadedIdsFromEffect).sort())) {
        console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds changed. Updating state. Old:", initialLoadedStudentSlipIds, "New:", newInitialLoadedIdsFromEffect);
        setInitialLoadedStudentSlipIds(newInitialLoadedIdsFromEffect);
    } else {
        console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds are the same. Skipping state update.");
    }
     if (editingStudentId && !newInitialLoadedIdsFromEffect.has(editingStudentId) && isSlipInputEmpty(newInputsFromEffect[editingStudentId])) {
      console.log(`[PLLPage] Main useEffect: editingStudentId ${editingStudentId} is no longer in newInitialLoaded or its entry is empty. Resetting editingStudentId.`);
      setEditingStudentId(null);
    }
  }, [existingSlipsData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingSlips, isClient, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, editingStudentId]);


  useEffect(() => {
    console.log(`[PLLPage] Date or Class changed. Resetting local states. New DateKey: ${memoizedFormattedSelectedDateKey}, New ClassId: ${selectedClassId}`);
    if (!isClient) return; 
    
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null);
    setCommonHomeworkVocabulary("");
    setCommonHomeworkTasks("");
    
    if (selectedClassId && memoizedFormattedSelectedDateKey) {
      console.log(`[PLLPage] Date/Class Change: Invalidating existingPhieuLienLac for class ${selectedClassId} and date key ${memoizedFormattedSelectedDateKey}`);
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
    }
    if(selectedClassId) {
      console.log(`[PLLPage] Date/Class Change: Refetching students for class ${selectedClassId}`);
      refetchStudentsInClass(); 
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient, queryClient, refetchStudentsInClass]);


  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    console.log(`[PLLPage] handleSlipInputChange for student ${studentId}, field ${field}, value:`, value);
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || { 
          score: '', vocabularyToReview: '', remarks: '', 
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
          homeworkAssignmentTasks: commonHomeworkTasks,
          testFormat: "", homeworkStatus: ""
      };
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
    
    if (editingStudentId !== studentId) {
        console.log(`[PLLPage] handleSlipInputChange: Setting editingStudentId to ${studentId}.`);
        setEditingStudentId(studentId);
    }
  }, [commonHomeworkVocabulary, commonHomeworkTasks]);

 const studentsForHistoryTab = useMemo(() => {
    console.log(`[PLLPage] Recalculating studentsForHistoryTab. InitialLoadedIDs:`, initialLoadedStudentSlipIds, `EditingStudentId: ${editingStudentId}`);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) return [];
    const result = studentsInSelectedClass.filter(student => 
        initialLoadedStudentSlipIds.has(student.id) && 
        student.id !== editingStudentId &&
        !isSlipInputEmpty(studentSlipInputs[student.id])
    );
    console.log(`[PLLPage] Result for studentsForHistoryTab (count: ${result.length}):`, result.map(s => s.hoTen));
    return result;
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);

  const studentsForEntryTab = useMemo(() => {
    console.log(`[PLLPage] Recalculating studentsForEntryTab. EditingStudentId: ${editingStudentId}`);
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    // Students not in history (i.e., new entries or empty existing ones)
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const result = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    console.log(`[PLLPage] Students for EntryTab (not editing, count: ${result.length}):`, result.map(s => s.hoTen));
    return result;
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents]);


  const saveSlipsMutation = useMutation({
    mutationFn: savePhieuLienLacRecords,
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: `Phiếu liên lạc đã được lưu cho ${variables.length} học sinh.` });
      console.log(`[PLLPage] saveSlipsMutation onSuccess. Invalidating queries for class ${selectedClassId}, dateKey ${memoizedFormattedSelectedDateKey}.`);
      
      const newlySavedOrUpdatedNotEmptyStudentIds = new Set<string>();
       variables.forEach(v => {
        const savedInput = studentSlipInputs[v.studentId]; 
        if (savedInput && !isSlipInputEmpty(savedInput)) {
          newlySavedOrUpdatedNotEmptyStudentIds.add(v.studentId);
        }
      });

      setInitialLoadedStudentSlipIds(prev => {
        const updated = new Set(prev);
        newlySavedOrUpdatedNotEmptyStudentIds.forEach(id => updated.add(id));
        console.log("[PLLPage] saveSlipsMutation onSuccess: Updated initialLoadedStudentSlipIds:", updated);
        return updated;
      });

      setEditingStudentId(null);
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      setDailySlipActiveTab('lich-su-nhap');
    },
    onError: (error: Error) => {
      console.error("[PLLPage] saveSlipsMutation error:", error);
      toast({
        title: "Lỗi khi lưu phiếu liên lạc",
        description: `${error.message}. Kiểm tra console server để biết thêm chi tiết.`,
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

    const recordsToSave: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>> = [];
    const studentsToProcess = editingStudentId 
      ? studentsInSelectedClass.filter(s => s.id === editingStudentId) 
      : studentsInSelectedClass; 

    studentsToProcess.forEach(student => {
      const input = studentSlipInputs[student.id];
      if (input) { 
        const masteryDetails = calculateMasteryDetailsForPLL(input.testFormat, input.score);
        let scoreToSave: number | null = null;
        if(input.score !== undefined && input.score !== null && String(input.score).trim() !== '') {
            if(!isNaN(Number(input.score))) scoreToSave = Number(input.score);
        }

        const recordPayload: Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'> = {
          studentId: student.id,
          studentName: student.hoTen,
          classId: selectedClassId,
          className: selectedClass.tenLop,
          date: memoizedFormattedSelectedDateKey, 
          testFormat: input.testFormat || undefined,
          score: scoreToSave,
          lessonMasteryText: masteryDetails.text,
          homeworkStatus: input.homeworkStatus || undefined,
          vocabularyToReview: input.vocabularyToReview || '',
          remarks: input.remarks || '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
          homeworkAssignmentTasks: commonHomeworkTasks,       
        };
        recordsToSave.push(recordPayload);
      }
    });
    console.log("[PLLPage] handleSaveAllSlips: Records to save:", recordsToSave);
    if (recordsToSave.length === 0 && !editingStudentId) {
        toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." });
        return;
    }
    saveSlipsMutation.mutate(recordsToSave);
  }, [selectedClassId, selectedDate, classes, studentsInSelectedClass, studentSlipInputs, editingStudentId, saveSlipsMutation, toast, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks]);

  const handleEditSlip = useCallback((studentId: string) => {
    console.log(`[PLLPage] handleEditSlip called for studentId: ${studentId}`);
    setEditingStudentId(studentId);
    setDailySlipActiveTab("nhap-phieu");
  }, [setDailySlipActiveTab]);

  const handleDeleteSlipEntry = useCallback((studentId: string) => {
    const studentName = studentsInSelectedClass.find(s=>s.id === studentId)?.hoTen || "học sinh này";
    const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, null);
    console.log(`[PLLPage] handleDeleteSlipEntry called for studentId: ${studentId}. Clearing their local slipInput.`);
    setStudentSlipInputs(prev => ({
      ...prev,
      [studentId]: {
        testFormat: "", score: null, lessonMasteryText: masteryDetailsForEmpty.text,
        homeworkStatus: "", vocabularyToReview: '', remarks: '',
        homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
        homeworkAssignmentTasks: commonHomeworkTasks, 
      }
    }));
    setInitialLoadedStudentSlipIds(prev => {
      const updated = new Set(prev);
      updated.delete(studentId);
      return updated;
    });
    setEditingStudentId(studentId); 
    setDailySlipActiveTab("nhap-phieu");
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho ${studentName}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
  }, [studentsInSelectedClass, toast, commonHomeworkVocabulary, commonHomeworkTasks, setDailySlipActiveTab]);

  const handleOpenSlipDialog = useCallback(async (studentId: string) => {
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const selectedClass = classes.find(c => c.id === selectedClassId);
    const inputData = studentSlipInputs[studentId];

    if (!student || !selectedClass || !inputData || !selectedDate) {
      toast({ title: "Lỗi", description: "Không thể tạo phiếu xem trước.", variant: "destructive" });
      return;
    }

    const masteryDetails = calculateMasteryDetailsForPLL(inputData.testFormat, inputData.score);
    let scoreForSlip: number | null = null;
    if (inputData.score !== undefined && inputData.score !== null && String(inputData.score).trim() !== '' && !isNaN(Number(inputData.score))) {
        scoreForSlip = Number(inputData.score);
    }

    const slip: PhieuLienLacRecord = {
      id: existingSlipsData?.find(s => s.studentId === student.id && s.classId === selectedClassId && s.date === memoizedFormattedSelectedDateKey)?.id || `temp-${student.id}-${Date.now()}`,
      studentId: student.id, studentName: student.hoTen, classId: selectedClassId,
      className: selectedClass.tenLop, date: memoizedFormattedSelectedDateKey,
      testFormat: inputData.testFormat, score: scoreForSlip, lessonMasteryText: masteryDetails.text,
      homeworkStatus: inputData.homeworkStatus, vocabularyToReview: inputData.vocabularyToReview,
      remarks: inputData.remarks,
      homeworkAssignmentVocabulary: inputData.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
      homeworkAssignmentTasks: inputData.homeworkAssignmentTasks || commonHomeworkTasks,
    };
    setCurrentSlipData(slip);
    setIsSlipModalOpen(true);
  }, [studentsInSelectedClass, classes, selectedClassId, studentSlipInputs, existingSlipsData, memoizedFormattedSelectedDateKey, toast, commonHomeworkVocabulary, commonHomeworkTasks, selectedDate]);

  const handleExportSlipImage = useCallback(async (contentRef: React.RefObject<HTMLDivElement>, slipIdentifier: string, studentName?: string) => {
    if (!contentRef.current) {
      toast({ title: "Lỗi", description: "Không có nội dung phiếu để xuất.", variant: "destructive"});
      return;
    }
     if (typeof html2canvas === 'undefined' || html2canvas === null) {
        toast({ title: "Lỗi Xuất Ảnh", description: "Chức năng xuất ảnh đang được cấu hình (html2canvas chưa tải). Vui lòng thử lại sau ít giây hoặc cài đặt lại.", variant: "warning", duration: 7000});
        console.error("html2canvas is not loaded. Ensure it's imported and the module is available.");
        return;
    }
    try {
        const canvas = await html2canvas(contentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `PhieuLienLac_${studentName?.replace(/\s+/g, '_') || 'HS'}_${slipIdentifier.replace(/\//g, '-')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Thành công!", description: "Phiếu liên lạc đã được xuất ra ảnh." });
    } catch (error) {
      console.error("[PLLPage] Error exporting slip image:", error);
      toast({ title: "Lỗi xuất ảnh", description: (error as Error).message || "Có lỗi khi xuất ảnh.", variant: "destructive" });
    }
  }, [toast]);

  const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
    const starColor = "text-green-500 dark:text-green-400";

    if (score >= 9 && score <= 10) numStars = 5;
    else if (score >= 7 && score < 9) numStars = 4;
    else if (score >= 5 && score < 7) numStars = 3;
    else numStars = 0;

    if (numStars === 0 && score < 5 && score >=0) return <span className="text-xs text-orange-500 ml-1">({score}đ)</span>;
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
    
    let score: number | null = null;
    if (!isNaN(Number(scoreValue))) {
        score = Number(scoreValue);
    } else {
        return <span className="text-destructive">Không hợp lệ</span>;
    }

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
     if (editingStudentId) return "Lưu Thay Đổi Phiếu Này";
    return "Lưu Tất Cả";
  }, [editingStudentId]);

  const canSaveChanges = useMemo(() => {
    console.log("[PLLPage] canSaveChanges useMemo. editingStudentId:", editingStudentId, "saveSlipsMutation.isPending:", saveSlipsMutation.isPending);
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId) {
        const currentInput = studentSlipInputs[editingStudentId];
        const originalSlip = existingSlipsData?.find(s => s.studentId === editingStudentId);
        if (!currentInput) {
            console.log("[PLLPage] canSaveChanges: No current input for editing student. Returning false.");
            return false;
        }
        
        if (!originalSlip && !isSlipInputEmpty(currentInput)) {
            console.log("[PLLPage] canSaveChanges: Editing new, non-empty slip. Returning true.");
            return true;
        }
        if (originalSlip) {
            const masteryDetails = calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score);
            const originalScore = originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score);
            const currentScore = currentInput.score === null || currentInput.score === undefined ? '' : String(currentInput.score);
            const changed = (
              (originalSlip.testFormat || "") !== (currentInput.testFormat || "") ||
              originalScore !== currentScore ||
              (originalSlip.lessonMasteryText || "") !== (masteryDetails.text || "") ||
              (originalSlip.homeworkStatus || "") !== (currentInput.homeworkStatus || "") ||
              (originalSlip.vocabularyToReview || "") !== (currentInput.vocabularyToReview || "") ||
              (originalSlip.remarks || "") !== (currentInput.remarks || "") ||
              (originalSlip.homeworkAssignmentVocabulary || "") !== (currentInput.homeworkAssignmentVocabulary || commonHomeworkVocabulary) ||
              (originalSlip.homeworkAssignmentTasks || "") !== (currentInput.homeworkAssignmentTasks || commonHomeworkTasks)
            );
            console.log(`[PLLPage] canSaveChanges (editing existing): Changed = ${changed}. Original:`, originalSlip, "Current:", currentInput);
            return changed;
        } else if (!isSlipInputEmpty(currentInput)) { 
            console.log("[PLLPage] canSaveChanges: Editing new (was empty in DB or not present), non-empty slip. Returning true.");
            return true;
        }
        console.log("[PLLPage] canSaveChanges: Editing existing, but no changes detected or slip is empty. Returning false.");
        return false;
    }
    
    const studentsToProcess = studentsInSelectedClass.filter(s => !initialLoadedStudentSlipIds.has(s.id) || (studentSlipInputs[s.id] && !isSlipInputEmpty(studentSlipInputs[s.id])));
    const hasNewOrModifiedEntries = studentsToProcess.some(student => {
      const input = studentSlipInputs[student.id];
      if (!input) return false; // Should not happen if student is in studentsToProcess
      if (!initialLoadedStudentSlipIds.has(student.id)) { // New entry
        return !isSlipInputEmpty(input);
      }
      // Existing entry, check if modified from what might be in existingSlipsData or if common HW changed
      const originalSlip = existingSlipsData?.find(es => es.studentId === student.id);
      if (!originalSlip) return !isSlipInputEmpty(input); // If somehow not in existing, treat as new if not empty

      const masteryDetails = calculateMasteryDetailsForPLL(input.testFormat, input.score);
      const originalScore = originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score);
      const currentScore = input.score === null || input.score === undefined ? '' : String(input.score);
      return (
        (originalSlip.testFormat || "") !== (input.testFormat || "") ||
        originalScore !== currentScore ||
        (originalSlip.lessonMasteryText || "") !== (masteryDetails.text || "") ||
        (originalSlip.homeworkStatus || "") !== (input.homeworkStatus || "") ||
        (originalSlip.vocabularyToReview || "") !== (input.vocabularyToReview || "") ||
        (originalSlip.remarks || "") !== (input.remarks || "") ||
        (originalSlip.homeworkAssignmentVocabulary || "") !== (input.homeworkAssignmentVocabulary || commonHomeworkVocabulary) ||
        (originalSlip.homeworkAssignmentTasks || "") !== (input.homeworkAssignmentTasks || commonHomeworkTasks)
      );
    });

    console.log(`[PLLPage] canSaveChanges (not editing): hasNewOrModifiedEntries = ${hasNewOrModifiedEntries}`);
    return hasNewOrModifiedEntries;
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, initialLoadedStudentSlipIds, existingSlipsData, commonHomeworkVocabulary, commonHomeworkTasks]);

  const savePeriodicRemarkMutation = useMutation({
    mutationFn: (data: { slipId: string, summaryRemark: string }) => updatePeriodicSummaryForSlip(data.slipId, data.summaryRemark),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: "Nhận xét tổng hợp đã được lưu." });
      if (periodicSlipStudent?.id && selectedClassId){
        queryClient.invalidateQueries({ queryKey: ['phieuLienLacRecordsForStudent', periodicSlipStudent.id, selectedClassId] }); 
      }
      setAllDailySlipsForPeriodic(prevSlips => 
        prevSlips.map(slip => slip.id === variables.slipId ? { ...slip, periodicSummaryRemark: variables.summaryRemark } : slip)
      );
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: `Không thể lưu nhận xét tổng hợp: ${error.message}`, variant: "destructive" });
    },
  });

  const handleSavePeriodicRemark = useCallback(() => {
    if (!periodicSlipStudent || allDailySlipsForPeriodic.length === 0) {
      toast({ title: "Lỗi", description: "Không có thông tin phiếu để lưu nhận xét.", variant: "destructive" });
      return;
    }
    const lastSlip = [...allDailySlipsForPeriodic].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).pop();
    if (!lastSlip) {
      toast({ title: "Lỗi", description: "Không tìm thấy phiếu cuối cùng để lưu nhận xét.", variant: "destructive" });
      return;
    }
    savePeriodicRemarkMutation.mutate({ slipId: lastSlip.id, summaryRemark: periodicSlipSummaryRemark });
  }, [periodicSlipStudent, allDailySlipsForPeriodic, periodicSlipSummaryRemark, savePeriodicRemarkMutation, toast]);

  const handleOpenPeriodicSlipDialog = useCallback(async (student: HocSinh) => {
    if (!selectedClassId) {
      toast({ title: "Lỗi", description: "Vui lòng chọn lớp trước.", variant: "destructive"});
      return;
    }
    console.log(`[PLLPage] handleOpenPeriodicSlipDialog for student: ${student.hoTen} (ID: ${student.id}) in class ${selectedClassId}`);
    setIsLoadingPeriodicSlipRecords(true);
    setPeriodicSlipStudent(student);
    setPeriodicSlipSummaryRemark(""); 

    try {
      const studentClass = classes.find(cls => cls.id === student.lopId);
      if (!studentClass) {
        toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp của học sinh.", variant: "destructive"});
        setIsLoadingPeriodicSlipRecords(false);
        return;
      }

      const startDateString = student.ngayThanhToanGanNhat || student.ngayDangKy;
      if (!startDateString) {
        toast({ title: "Thiếu thông tin", description: "Không có ngày bắt đầu chu kỳ để tính toán.", variant: "warning"});
        setIsLoadingPeriodicSlipRecords(false);
        return;
      }
      
      let cycleStartDate = parseISO(startDateString);
      let calculatedEndDate: Date | null = null;
      let recordsToDisplay: PhieuLienLacRecord[] = [];

      if (studentClass.chuKyDongPhi === "1 tháng") {
        cycleStartDate = startOfMonth(cycleStartDate); // Start from beginning of the payment month
        calculatedEndDate = endOfMonth(cycleStartDate);
      } else if (studentClass.chuKyDongPhi === "8 buổi" || studentClass.chuKyDongPhi === "10 buổi") {
          const sessionsNeeded = studentClass.chuKyDongPhi === "8 buổi" ? 8 : 10;
          const sessionsPerWeek = studentClass.lichHoc.length;
          if (sessionsPerWeek > 0) {
              const weeksToEstimate = Math.ceil(sessionsNeeded / sessionsPerWeek) + 2; 
              calculatedEndDate = addWeeks(cycleStartDate, weeksToEstimate); 
          }
      } else if (studentClass.chuKyDongPhi === "Theo ngày") {
          calculatedEndDate = cycleStartDate;
      }
      
      console.log(`[PLLPage] Calculated date range for periodic slip: Start ${format(cycleStartDate, 'yyyy-MM-dd')}, Estimated End ${calculatedEndDate ? format(calculatedEndDate, 'yyyy-MM-dd') : 'N/A'}`);

      const allStudentSlipsInClass = await getPhieuLienLacRecordsForStudentInRange(student.id, student.lopId, cycleStartDate, calculatedEndDate || undefined);
      
      setAllDailySlipsForPeriodic(allStudentSlipsInClass);
      
      if (allStudentSlipsInClass.length > 0) {
        const lastSlipInFilteredData = [...allStudentSlipsInClass].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).pop();
        if (lastSlipInFilteredData?.periodicSummaryRemark) {
          console.log(`[PLLPage] Found existing periodic summary remark for last slip ${lastSlipInFilteredData.id}: "${lastSlipInFilteredData.periodicSummaryRemark}"`);
          setPeriodicSlipSummaryRemark(lastSlipInFilteredData.periodicSummaryRemark);
        } else {
          console.log(`[PLLPage] No existing periodic summary remark found for last slip ${lastSlipInFilteredData?.id}.`);
        }
      } else {
        console.log(`[PLLPage] No daily slips found for student ${student.id} to populate periodic view for the calculated range.`);
      }
      setIsPeriodicSlipModalOpen(true);
    } catch (error) {
       console.error(`[PLLPage] Error fetching periodic slips for student ${student.id}:`, error);
       toast({
        title: "Lỗi tải dữ liệu phiếu chu kỳ",
        description: `${(error as Error).message}. Kiểm tra console server để biết lỗi chi tiết từ Firebase.`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoadingPeriodicSlipRecords(false);
    }
  }, [selectedClassId, toast, classes, queryClient]);

  const currentClassForPeriodicSlip = useMemo(() => classes.find(c => c.id === periodicSlipStudent?.lopId), [classes, periodicSlipStudent]);

  const periodicSlipDateRangeText = useMemo(() => {
    if (allDailySlipsForPeriodic.length === 0) return "Chưa có dữ liệu";
    const sortedSlips = [...allDailySlipsForPeriodic].sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      return dateA.getTime() - dateB.getTime();
    });
    if (sortedSlips.length === 0) return "Chưa có dữ liệu";
    
    const firstDate = parseISO(sortedSlips[0].date);
    const lastDate = parseISO(sortedSlips[sortedSlips.length - 1].date);

    if (!isValid(firstDate) || !isValid(lastDate)) return "Ngày không hợp lệ";

    return `Từ ${format(firstDate, "dd/MM/yyyy", {locale: vi})} đến ${format(lastDate, "dd/MM/yyyy", {locale: vi})}`;
  }, [allDailySlipsForPeriodic]);


  const selectedClassDetails = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);


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
            <CardTitle>Chọn Lớp và Ngày</CardTitle>
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
                    disabled={!selectedClassId}
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
        
        <Tabs value={mainActiveTab} onValueChange={(value) => setMainActiveTab(value as 'theo-ngay' | 'theo-chu-ky')} className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:max-w-md grid-cols-2 mb-6 bg-primary/10 p-1 rounded-lg">
            <TabsTrigger value="theo-ngay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo ngày</TabsTrigger>
            <TabsTrigger value="theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo chu kỳ</TabsTrigger>
          </TabsList>

          <TabsContent value="theo-ngay">
            <Card className="mb-6 shadow-md">
              <CardHeader>
                <CardTitle>Thông tin chung phiếu liên lạc</CardTitle>
                <CardDescription>
                  Lớp: {selectedClassDetails?.tenLop || <Skeleton className="h-5 w-24 inline-block" />} | Ngày: {selectedDate ? format(selectedDate, "dd/MM/yyyy", {locale: vi}) : <Skeleton className="h-5 w-20 inline-block" />}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="mb-6 shadow-md">
              <CardHeader>
                <CardTitle>Hướng dẫn Bài tập về nhà (Chung cho cả lớp)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="common-hw-vocab">Từ vựng cần học</Label>
                  <Textarea id="common-hw-vocab" placeholder="VD: Unit 1 - Vocabulary List A, B, C..." value={commonHomeworkVocabulary} onChange={(e) => setCommonHomeworkVocabulary(e.target.value)} rows={3}/>
                </div>
                <div>
                  <Label htmlFor="common-hw-tasks">Bài tập làm tại nhà</Label>
                  <Textarea id="common-hw-tasks" placeholder="VD: Workbook trang 10-12..." value={commonHomeworkTasks} onChange={(e) => setCommonHomeworkTasks(e.target.value)} rows={3}/>
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
                  <Tabs value={dailySlipActiveTab} onValueChange={(value) => setDailySlipActiveTab(value as 'nhap-phieu' | 'lich-su-nhap')}>
                    <TabsList className="grid w-full sm:w-auto grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                      <TabsTrigger value="nhap-phieu" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                        Nhập phiếu ({studentsForEntryTab.length})
                      </TabsTrigger>
                      <TabsTrigger value="lich-su-nhap" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                        Lịch sử nhập ({studentsForHistoryTab.length})
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="nhap-phieu">
                      {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForEntryTab.length === 0 && dailySlipActiveTab === 'nhap-phieu' && (
                        <p className="text-muted-foreground p-4 text-center">Tất cả học sinh đã có phiếu hoặc đã được chuyển sang tab Lịch sử. Chọn "Sửa" từ tab Lịch sử để chỉnh sửa.</p>
                      )}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsForEntryTab.length > 0 && (
                        <ScrollArea className="max-h-[60vh] pr-2">
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-[150px] sticky top-0 bg-card z-10">Học sinh</TableHead><TableHead className="w-[180px] sticky top-0 bg-card z-10">Hình thức KT</TableHead><TableHead className="w-[100px] sticky top-0 bg-card z-10">Điểm</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Thuộc bài?</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Bài tập về nhà</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Từ vựng cần học lại</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Nhận xét</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {studentsForEntryTab.map((student) => {
                              const currentInput = studentSlipInputs[student.id] || {};
                              const masteryDetails = calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score);
                              return (
                                <TableRow key={student.id}>
                                  <TableCell className="font-medium">{student.hoTen}</TableCell>
                                  <TableCell><Select value={currentInput.testFormat || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'testFormat', value as TestFormatPLC)}><SelectTrigger><SelectValue placeholder="Chọn hình thức" /></SelectTrigger><SelectContent>{ALL_TEST_FORMATS_PLC.map(formatValue => <SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>)}</SelectContent></Select></TableCell>
                                  <TableCell><Input type="text" placeholder="VD: 8" value={currentInput.score || ''} onChange={(e) => handleSlipInputChange(student.id, 'score', e.target.value)} className="w-20"/></TableCell>
                                  <TableCell className={cn("font-medium", getLessonMasteryTextAndColor(masteryDetails.text, calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score).isTrulyMastered).className)}>{masteryDetails.text}</TableCell>
                                  <TableCell><Select value={currentInput.homeworkStatus || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'homeworkStatus', value as HomeworkStatusPLC)}><SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger><SelectContent>{ALL_HOMEWORK_STATUSES_PLC.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell>
                                  <TableCell><Textarea value={currentInput.vocabularyToReview || ''} onChange={(e) => handleSlipInputChange(student.id, 'vocabularyToReview', e.target.value)} placeholder="Từ vựng..." rows={2}/></TableCell>
                                  <TableCell><Textarea value={currentInput.remarks || ''} onChange={(e) => handleSlipInputChange(student.id, 'remarks', e.target.value)} placeholder="Nhận xét..." rows={2}/></TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        </ScrollArea>
                      )}
                    </TabsContent>
                    <TabsContent value="lich-su-nhap">
                      {(isLoadingStudents || isLoadingExistingSlips) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsInSelectedClass.length > 0 && studentsForHistoryTab.length === 0 && (
                        <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lựa chọn này, hoặc tất cả đang ở trạng thái chỉnh sửa.</p>
                      )}
                      {!(isLoadingStudents || isLoadingExistingSlips) && studentsForHistoryTab.length > 0 && (
                         <ScrollArea className="max-h-[60vh] pr-2">
                        <Table>
                          <TableHeader><TableRow><TableHead className="w-[50px] sticky top-0 bg-card z-10">STT</TableHead><TableHead className="sticky top-0 bg-card z-10">Học sinh</TableHead><TableHead className="sticky top-0 bg-card z-10">Hình thức KT</TableHead><TableHead className="sticky top-0 bg-card z-10">Điểm</TableHead><TableHead className="sticky top-0 bg-card z-10">Thuộc bài?</TableHead><TableHead className="sticky top-0 bg-card z-10">Bài tập về nhà</TableHead><TableHead className="text-right w-[180px] sticky top-0 bg-card z-10">Hành động</TableHead></TableRow></TableHeader>
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
                                  <TableCell className={cn("font-medium", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell>
                                  <TableCell className={cn(homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end">
                                       <Button variant="outline" size="icon" onClick={() => handleEditSlip(student.id)} aria-label="Sửa phiếu" disabled={saveSlipsMutation.isPending}><Edit className="h-4 w-4" /></Button>
                                      <Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(student.id)} aria-label="Xóa phiếu (cục bộ)" disabled={saveSlipsMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
                                      <Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(student.id)} aria-label="Xem/Xuất phiếu ngày" disabled={saveSlipsMutation.isPending}><Printer className="h-4 w-4" /></Button>
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
                {(mainActiveTab === 'theo-ngay' && (dailySlipActiveTab === 'nhap-phieu' || (dailySlipActiveTab === 'lich-su-nhap' && editingStudentId) )) && selectedClassId && selectedDate && (
                  <CardFooter className="border-t pt-6">
                    <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                      {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {saveButtonText}
                    </Button>
                     {editingStudentId && dailySlipActiveTab === 'nhap-phieu' && (
                        <Button variant="ghost" onClick={() => {setEditingStudentId(null); setDailySlipActiveTab('lich-su-nhap');}} className="ml-2" disabled={saveSlipsMutation.isPending}>Hủy Sửa</Button>
                    )}
                  </CardFooter>
                )}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="theo-chu-ky">
            <Card className="mb-6 shadow-md">
              <CardHeader>
                <CardTitle>Thông tin chung phiếu theo chu kỳ</CardTitle>
                <CardDescription>
                  Lớp: {selectedClassDetails?.tenLop || <Skeleton className="h-5 w-24 inline-block" />} | Ngày hệ thống: {format(new Date(), "dd/MM/yyyy", {locale: vi})}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="shadow-md">
              <CardHeader>
                <Tabs value={periodicSlipActiveTab} onValueChange={(value) => setPeriodicSlipActiveTab(value as 'nhan-xet' | 'lich-su-chu-ky')}>
                   <TabsList className="grid w-full sm:w-auto grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                    <TabsTrigger value="nhan-xet" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Nhận xét Chu Kỳ</TabsTrigger>
                    <TabsTrigger value="lich-su-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch Sử Phiếu Chu Kỳ</TabsTrigger>
                  </TabsList>
                  <TabsContent value="nhan-xet">
                    {(isLoadingStudents) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải học sinh...</div>}
                    {!(isLoadingStudents) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh hoặc chưa chọn lớp.</p>}
                    {!(isLoadingStudents) && studentsInSelectedClass.length > 0 && (
                      <ScrollArea className="max-h-[60vh] pr-2">
                        <Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead className="text-right w-[220px]">Hành động</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {studentsInSelectedClass.map((student, index) => (
                              <TableRow key={`periodic-remark-${student.id}`}>
                                <TableCell>{index + 1}</TableCell><TableCell className="font-medium">{student.hoTen}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="outline" size="sm" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Thêm/Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}>
                                    {isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <FileText className="h-4 w-4 mr-2" />}
                                    Thêm/Sửa Nhận Xét
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </TabsContent>
                  <TabsContent value="lich-su-chu-ky">
                     {(isLoadingStudents) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải học sinh...</div>}
                    {!(isLoadingStudents) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh hoặc chưa chọn lớp.</p>}
                    {!(isLoadingStudents) && studentsInSelectedClass.length > 0 && (
                      <ScrollArea className="max-h-[60vh] pr-2">
                        <Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead>Chu kỳ</TableHead><TableHead className="text-right w-[180px]">Hành động</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {studentsInSelectedClass.map((student, index) => ( // Placeholder: should filter for students with existing periodic slips
                              <TableRow key={`periodic-history-${student.id}`}>
                                <TableCell>{index + 1}</TableCell><TableCell className="font-medium">{student.hoTen}</TableCell>
                                <TableCell>{student.id}</TableCell><TableCell>{selectedClassDetails?.tenLop || 'N/A'}</TableCell>
                                <TableCell>{selectedClassDetails?.chuKyDongPhi || 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                   <div className="flex gap-2 justify-end">
                                    <Button variant="outline" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="destructive" size="icon" onClick={() => toast({title: "Chức năng đang phát triển", description: "Xóa nhận xét chu kỳ sẽ được thêm sau."})} aria-label="Xóa Nhận Xét Chu Kỳ"><Trash2 className="h-4 w-4"/></Button>
                                    <Button variant="default" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Xuất Phiếu Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Printer className="h-4 w-4"/></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>


        {/* Daily Slip Detail Dialog */}
        <Dialog open={isSlipModalOpen} onOpenChange={(open) => {setIsSlipModalOpen(open); if(!open) setCurrentSlipData(null);}}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
              <div ref={slipDialogContentRef} className="bg-background font-sans p-4 space-y-0.5 leading-tight">
                <ShadDialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-10 bg-background"> 
                  <ShadDialogTitle className="text-2xl font-bold uppercase text-primary text-center">PHIẾU LIÊN LẠC</ShadDialogTitle>
                  {currentSlipData?.date && (<ShadDialogDescription className="text-sm text-center text-muted-foreground">Ngày: {isValid(parse(currentSlipData.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</ShadDialogDescription>)}
                </ShadDialogHeader>
                {currentSlipData ? (
                <div className="space-y-0.5 text-sm leading-snug mt-1">
                    <div className="grid grid-cols-2 gap-x-4 mb-1">
                      <p><strong className="font-medium text-muted-foreground mr-1">Họ và tên:</strong> <span className="text-indigo-700 font-semibold text-base">{currentSlipData.studentName}</span></p>
                      <p><strong className="font-medium text-muted-foreground mr-1">Lớp:</strong> <span className="font-medium text-base">{currentSlipData.className}</span></p>
                      <p><strong className="font-medium text-muted-foreground mr-1">Mã HS:</strong> <span className="font-medium text-base">{currentSlipData.studentId}</span></p>
                      <p><strong className="font-medium text-muted-foreground mr-1">Ngày KT:</strong> <span className="font-medium text-base">{isValid(parse(currentSlipData.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</span></p>
                    </div>
                    <Separator className="my-1.5"/>
                    <h3 className="text-md font-semibold text-foreground mt-2 mb-0.5">Kết quả học tập:</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-sm">
                        <div className="space-y-0.5">
                          <div className="flex"><strong className="font-medium text-muted-foreground mr-2 w-[120px] shrink-0 text-left">Hình thức KT:</strong> <span className="font-medium flex-1 text-left">{currentSlipData.testFormat || "N/A"}</span></div>
                          <div className="flex"><strong className="font-medium text-muted-foreground mr-2 w-[120px] shrink-0 text-left">Thuộc bài:</strong> <span className={cn("font-medium flex-1 text-left", getLessonMasteryTextAndColor(currentSlipData.lessonMasteryText, calculateMasteryDetailsForPLL(currentSlipData.testFormat, currentSlipData.score).isTrulyMastered).className)}>{currentSlipData.lessonMasteryText || "Chưa đánh giá"}</span></div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex"><strong className="font-medium text-muted-foreground mr-2 w-[120px] shrink-0 text-left">Điểm số:</strong> <span className="flex-1 text-left">{renderScoreDisplay(currentSlipData.score)}</span></div>
                          <div className="flex"><strong className="font-medium text-muted-foreground mr-2 w-[120px] shrink-0 text-left">Bài tập về nhà:</strong> <span className={cn("font-medium flex-1 text-left", getHomeworkStatusTextAndColor(currentSlipData.homeworkStatus).className)}>{currentSlipData.homeworkStatus ? getHomeworkStatusTextAndColor(currentSlipData.homeworkStatus).text : "Không có bài tập về nhà"}</span></div>
                        </div>
                    </div>
                    <Separator className="my-1.5"/>
                    <SlipDetailItem label="Từ vựng cần học lại:">{currentSlipData.vocabularyToReview}</SlipDetailItem>
                    <SlipDetailItem label="Nhận xét:">{currentSlipData.remarks}</SlipDetailItem>
                    <Separator className="my-1.5"/>
                    <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mt-1.5 mb-0.5">Hướng dẫn Bài tập về nhà:</h3>
                    <SlipDetailItem label="Từ vựng cần học:">{currentSlipData.homeworkAssignmentVocabulary}</SlipDetailItem>
                    <SlipDetailItem label="Bài tập làm tại nhà:">{currentSlipData.homeworkAssignmentTasks}</SlipDetailItem>
                    <Separator className="my-1.5"/>
                    <div className="text-sm font-medium leading-normal mt-1.5 space-y-1">
                        {currentSlipData.vocabularyToReview && currentSlipData.vocabularyToReview.trim() !== "" && (
                            <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.</p>
                        )}
                        <p><strong>Trân trọng.</strong></p>
                    </div>
                </div>
                ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background">
              <DialogClose asChild><Button type="button" variant="outline" size="sm">Đóng</Button></DialogClose>
              <Button onClick={() => handleExportSlipImage(slipDialogContentRef, currentSlipData?.date || 'phieu-ngay', currentSlipData?.studentName)} disabled={!currentSlipData || (typeof html2canvas === 'undefined' || html2canvas === null)} size="sm">
                 {(typeof html2canvas === 'undefined' || html2canvas === null) && currentSlipData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                 {(typeof html2canvas === 'undefined' || html2canvas === null) && currentSlipData ? "Đang tải..." : "Xuất file ảnh"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Periodic Slip Dialog */}
        <Dialog open={isPeriodicSlipModalOpen} onOpenChange={(open) => { setIsPeriodicSlipModalOpen(open); if (!open) {setPeriodicSlipStudent(null); setAllDailySlipsForPeriodic([]); setPeriodicSlipSummaryRemark("");}}}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
              <div ref={periodicSlipDialogContentRef} className="bg-background font-sans p-4 space-y-1 leading-snug">
                <ShadDialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-10 bg-background">
                    <Image src="/logo.png" alt="HoEdu Solution Logo" width={60} height={60} style={{ height: 'auto' }} className="mx-auto mb-1" priority data-ai-hint="app logo education"/>
                    <ShadDialogTitle className="text-xl font-bold uppercase text-primary text-center">PHIẾU LIÊN LẠC CHU KỲ</ShadDialogTitle>
                    <ShadDialogDescription className="text-xs text-center text-muted-foreground">Ngày xuất: {format(new Date(), "dd/MM/yyyy", { locale: vi })}</ShadDialogDescription>
                </ShadDialogHeader>
                {isLoadingPeriodicSlipRecords && <div className="text-center p-10"><Loader2 className="h-8 w-8 animate-spin mx-auto"/> Đang tải dữ liệu...</div>}
                {!isLoadingPeriodicSlipRecords && periodicSlipStudent && currentClassForPeriodicSlip && (
                    <div className="space-y-1.5 text-sm mt-0 leading-snug">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 mb-2">
                            <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Họ và tên:</strong> <span className="font-semibold text-indigo-700">{periodicSlipStudent.hoTen}</span></p>
                            <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Lớp:</strong> <span className="font-medium">{currentClassForPeriodicSlip.tenLop}</span></p>
                            <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Mã HS:</strong> <span className="font-medium">{periodicSlipStudent.id}</span></p>
                            <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Chu kỳ học:</strong> <span className="font-medium">{currentClassForPeriodicSlip.chuKyDongPhi} ({periodicSlipDateRangeText})</span></p>
                        </div>
                        <Separator className="my-1.5" />
                        <h3 className="text-base font-semibold text-foreground mt-2 mb-0.5">Tình hình học tập:</h3>
                        {allDailySlipsForPeriodic.length > 0 ? (
                            <Table>
                                <TableHeader><TableRow><TableHead className="w-[40px] p-1.5">STT</TableHead><TableHead className="p-1.5">Ngày KT</TableHead><TableHead className="p-1.5">Hình thức</TableHead><TableHead className="p-1.5">Điểm</TableHead><TableHead className="p-1.5">Thuộc bài</TableHead><TableHead className="p-1.5">Bài tập về nhà</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {allDailySlipsForPeriodic.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).map((slip, index) => {
                                        const masteryDetails = calculateMasteryDetailsForPLL(slip.testFormat, slip.score);
                                        const homeworkDisplay = getHomeworkStatusTextAndColor(slip.homeworkStatus);
                                        const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, calculateMasteryDetailsForPLL(slip.testFormat, slip.score).isTrulyMastered);
                                        return (
                                        <TableRow key={slip.id}>
                                            <TableCell className="p-1.5">{index + 1}</TableCell>
                                            <TableCell className="p-1.5">{isValid(parseISO(slip.date)) ? format(parseISO(slip.date), "dd/MM/yy", {locale: vi}) : "N/A"}</TableCell>
                                            <TableCell className="p-1.5">{slip.testFormat || 'N/A'}</TableCell>
                                            <TableCell className="p-1.5">{renderScoreDisplay(slip.score)}</TableCell>
                                            <TableCell className={cn("font-medium p-1.5", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell>
                                            <TableCell className={cn("p-1.5", homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        ) : (<p className="text-muted-foreground">Không có dữ liệu phiếu liên lạc chi tiết cho chu kỳ này.</p>)}
                        <Separator className="my-1.5" />
                          <div className="mt-2">
                            <Label htmlFor="periodic-summary-remark" className="text-base font-semibold text-foreground mb-0.5 block">Nhận xét tổng hợp:</Label>
                            <Textarea id="periodic-summary-remark" value={periodicSlipSummaryRemark} onChange={(e) => setPeriodicSlipSummaryRemark(e.target.value)} placeholder="Nhập nhận xét tổng hợp cho học sinh..." rows={3} className="text-sm"/>
                        </div>
                          <Separator className="my-1.5"/>
                        <div className="text-sm font-medium mt-2 text-center space-y-0.5">
                            <p><strong>Trân trọng.</strong></p>
                            <p><strong>Trần Đông Phú</strong></p>
                        </div>
                    </div>
                )}
                {!isLoadingPeriodicSlipRecords && !periodicSlipStudent && <p className="text-center p-10 text-muted-foreground">Không có thông tin học sinh.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background">
                  <div className="flex gap-2">
                      <DialogClose asChild><Button type="button" variant="outline" size="sm">Đóng</Button></DialogClose>
                      <Button onClick={handleSavePeriodicRemark} size="sm" disabled={savePeriodicRemarkMutation.isPending || !periodicSlipStudent || allDailySlipsForPeriodic.length === 0}>
                          {savePeriodicRemarkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Lưu Nhận Xét
                      </Button>
                  </div>
                  <Button onClick={() => handleExportSlipImage(periodicSlipDialogContentRef, periodicSlipStudent?.hoTen ? `${periodicSlipStudent.hoTen}_ChuKy` : 'PhieuChuKy', periodicSlipDateRangeText)} disabled={isLoadingPeriodicSlipRecords || !periodicSlipStudent || (typeof html2canvas === 'undefined' || html2canvas === null)} size="sm">
                      {(typeof html2canvas === 'undefined' || html2canvas === null) && !isLoadingPeriodicSlipRecords && periodicSlipStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                      {(typeof html2canvas === 'undefined' || html2canvas === null) && !isLoadingPeriodicSlipRecords && periodicSlipStudent ? "Đang tải..." : "Xuất file ảnh"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

interface SlipDetailItemProps {
  label: string;
  children: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
}

const SlipDetailItem: React.FC<SlipDetailItemProps> = ({ label, children, labelClassName, valueClassName }) => {
    return (
      <div className="text-sm leading-normal pb-0.5 mt-1"> 
        <strong className={cn("font-medium text-muted-foreground mr-2 block mb-0.5 text-left w-[140px] shrink-0", labelClassName)}>{label}</strong>
        <div className={cn("font-medium text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</div>
      </div>
    );
  };

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("shrink-0 bg-border h-[1px] w-full my-1.5", className)} 
    {...props}
  />
));
Separator.displayName = "DialogSeparator";

    