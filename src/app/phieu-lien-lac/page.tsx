
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
  CardDescription as ShadCNCardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription as ShadDialogDescriptionOriginal,
  DialogFooter,
  DialogHeader as ShadDialogHeaderOriginal,
  DialogTitle as ShadDialogTitleOriginal,
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
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types'; // Removed ALL_OPTION_LABELS as it's not used
import { format, parse, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle, BookCopy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
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
  const [activeTab, setActiveTab] = useState<'nhap-diem' | 'lich-su' | 'theo-chu-ky'>('nhap-diem');
  
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

  useEffect(() => {
    setIsClient(true);
    setSelectedDate(new Date());
    console.log("[PLLPage] PhieuLienLacPage mounted or updated - " + new Date().toLocaleTimeString());
  }, []);

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    if (!selectedDate) return '';
    return format(selectedDate, 'yyyy-MM-dd');
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
        console.log("[PLLPage] Skipping fetch for existingPhieuLienLac due to missing params.");
        return Promise.resolve([]);
      }
      return getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && !!memoizedFormattedSelectedDateKey && isClient,
  });
  
  useEffect(() => {
    console.log(`[PLLPage] Main useEffect triggered. DateKey: ${memoizedFormattedSelectedDateKey}, ClassId: ${selectedClassId}, isClient: ${isClient}, isLoadingStudents: ${isLoadingStudents}, isLoadingExistingSlips: ${isLoadingExistingSlips}`);
    console.log(`[PLLPage] Main useEffect: existingSlipsData (size: ${existingSlipsData?.length}):`, existingSlipsData);
    console.log(`[PLLPage] Main useEffect: studentsInSelectedClass (size: ${studentsInSelectedClass?.length}):`, studentsInSelectedClass.map(s => s.id));
    console.log(`[PLLPage] Main useEffect: current editingStudentId: ${editingStudentId}`);
    console.log(`[PLLPage] Main useEffect: current studentSlipInputs:`, studentSlipInputs);

    if (!isClient || isLoadingStudents || isLoadingExistingSlips || !selectedDate || !selectedClassId) {
        console.log("[PLLPage] Main useEffect: Skipping state update due to loading/missing data or not client.");
        return;
    }

    const newInputsFromEffect: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIdsFromEffect = new Set<string>();
    let commonVocabFromDb = "";
    let commonTasksFromDb = "";
    let commonHwInitializedFromDb = false;

    studentsInSelectedClass.forEach(student => {
        const existingDbSlip = existingSlipsData?.find(s => s.studentId === student.id);
        const currentLocalInputForStudent = studentSlipInputs[student.id]; 

        let entryToUse: StudentSlipInput;

        if (existingDbSlip) {
            console.log(`[PLLPage] Main useEffect: Student ${student.id} (${student.hoTen}), existingDbSlip found:`, existingDbSlip);
            const masteryDetailsFromDb = calculateMasteryDetailsForPLL(existingDbSlip.testFormat, existingDbSlip.score);
            entryToUse = {
                testFormat: existingDbSlip.testFormat || "",
                score: existingDbSlip.score === null || existingDbSlip.score === undefined ? '' : String(existingDbSlip.score),
                lessonMasteryText: masteryDetailsFromDb.text,
                homeworkStatus: existingDbSlip.homeworkStatus || "",
                vocabularyToReview: existingDbSlip.vocabularyToReview || '',
                remarks: existingDbSlip.remarks || '',
                homeworkAssignmentVocabulary: existingDbSlip.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
                homeworkAssignmentTasks: existingDbSlip.homeworkAssignmentTasks || commonHomeworkTasks,
            };
            console.log(`[PLLPage] Main useEffect: Student ${student.id}, entryFromDb created:`, entryToUse);

            if (student.id === editingStudentId && currentLocalInputForStudent) {
                console.log(`[PLLPage] Main useEffect: Student ${student.id} is being edited. Preserving local input for this student over DB data.`);
                entryToUse = currentLocalInputForStudent; 
            }
            
            if (!isSlipInputEmpty(entryToUse)) { 
                newInitialLoadedIdsFromEffect.add(student.id);
            }

            if (!commonHwInitializedFromDb && (existingDbSlip.homeworkAssignmentVocabulary || existingDbSlip.homeworkAssignmentTasks)) {
                commonVocabFromDb = existingDbSlip.homeworkAssignmentVocabulary || "";
                commonTasksFromDb = existingDbSlip.homeworkAssignmentTasks || "";
                commonHwInitializedFromDb = true;
                console.log(`[PLLPage] Main useEffect: Common HW initialized from DB for student ${student.id}. Vocab: "${commonVocabFromDb}", Tasks: "${commonTasksFromDb}"`);
            }
        } else {
            console.log(`[PLLPage] Main useEffect: Student ${student.id} (${student.hoTen}), no existingDbSlip found.`);
            if (student.id === editingStudentId && currentLocalInputForStudent) {
                 console.log(`[PLLPage] Main useEffect: Student ${student.id} is new and being edited. Preserving local input.`);
                entryToUse = currentLocalInputForStudent;
            } else if (currentLocalInputForStudent && !initialLoadedStudentSlipIds.has(student.id) && !isSlipInputEmpty(currentLocalInputForStudent)){
                console.log(`[PLLPage] Main useEffect: Student ${student.id} is new with local unsaved changes (not initialLoaded, not empty). Preserving.`);
                entryToUse = currentLocalInputForStudent;
            } else {
                console.log(`[PLLPage] Main useEffect: Student ${student.id}, creating new empty entry.`);
                const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
                entryToUse = {
                    testFormat: "", score: '', lessonMasteryText: masteryDetailsForEmpty.text,
                    homeworkStatus: "", vocabularyToReview: '', remarks: '',
                    homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
                    homeworkAssignmentTasks: commonHomeworkTasks,
                };
            }
        }
        newInputsFromEffect[student.id] = entryToUse;
    });
    
    if (commonHwInitializedFromDb) {
        console.log("[PLLPage] Main useEffect: Common HW was initialized from DB. Applying to all newInputsFromEffect entries.");
        Object.keys(newInputsFromEffect).forEach(studentId => {
            if (newInputsFromEffect[studentId]) {
                newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonVocabFromDb;
                newInputsFromEffect[studentId].homeworkAssignmentTasks = commonTasksFromDb;
            }
        });
        if (commonHomeworkVocabulary !== commonVocabFromDb) {
            console.log(`[PLLPage] Main useEffect: Updating global commonHomeworkVocabulary from "${commonHomeworkVocabulary}" to "${commonVocabFromDb}"`);
            setCommonHomeworkVocabulary(commonVocabFromDb);
        }
        if (commonHomeworkTasks !== commonTasksFromDb) {
             console.log(`[PLLPage] Main useEffect: Updating global commonHomeworkTasks from "${commonHomeworkTasks}" to "${commonTasksFromDb}"`);
            setCommonHomeworkTasks(commonTasksFromDb);
        }
    } else if (existingSlipsData && existingSlipsData.length === 0 && !isLoadingExistingSlips) {
        if (commonHomeworkVocabulary !== "") {
            console.log("[PLLPage] Main useEffect: No existing slips from DB, resetting commonHomeworkVocabulary.");
            setCommonHomeworkVocabulary("");
        }
        if (commonHomeworkTasks !== "") {
            console.log("[PLLPage] Main useEffect: No existing slips from DB, resetting commonHomeworkTasks.");
            setCommonHomeworkTasks("");
        }
    }
    
    if (JSON.stringify(studentSlipInputs) !== JSON.stringify(newInputsFromEffect)) {
        console.log("[PLLPage] Main useEffect: studentSlipInputs changed. Updating state. New inputs:", newInputsFromEffect);
        setStudentSlipInputs(newInputsFromEffect);
    } else {
        console.log("[PLLPage] Main useEffect: studentSlipInputs are the same as newInputsFromEffect. Skipping state update.");
    }

    if (JSON.stringify(Array.from(initialLoadedStudentSlipIds).sort()) !== JSON.stringify(Array.from(newInitialLoadedIdsFromEffect).sort())) {
        console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds changed. Updating state. New IDs:", newInitialLoadedIdsFromEffect);
        setInitialLoadedStudentSlipIds(newInitialLoadedIdsFromEffect);
    } else {
         console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds are the same. Skipping state update.");
    }
    
  }, [existingSlipsData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingSlips, isClient, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, editingStudentId, initialLoadedStudentSlipIds, studentSlipInputs]); // Added studentSlipInputs here to re-evaluate if local edits should override DB when editingStudentId changes


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
      console.log(`[PLLPage] handleSlipInputChange: Updated entry for student ${studentId}:`, updatedEntry);
      return { ...prev, [studentId]: updatedEntry };
    });
    
    if (editingStudentId !== studentId) {
        console.log(`[PLLPage] handleSlipInputChange: Setting editingStudentId to ${studentId} because it was different or null.`);
        setEditingStudentId(studentId);
    }
  }, [commonHomeworkVocabulary, commonHomeworkTasks]); 

  const studentsForHistoryTab = useMemo(() => {
    console.log(`[PLLPage] studentsForHistoryTab useMemo. initialLoadedStudentSlipIds:`, initialLoadedStudentSlipIds, `editingStudentId:`, editingStudentId);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) {
      console.log("[PLLPage] HistoryTab: Loading or no data yet, returning empty array.");
      return [];
    }
    const result = studentsInSelectedClass.filter(student => 
        initialLoadedStudentSlipIds.has(student.id) && 
        studentSlipInputs[student.id] && // Ensure input exists
        !isSlipInputEmpty(studentSlipInputs[student.id]) &&
        student.id !== editingStudentId 
    );
    console.log(`[PLLPage] Result for studentsForHistoryTab (count: ${result.length}):`, result.map(s => ({id: s.id, name: s.hoTen})));
    return result;
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);

  const studentsForEntryTab = useMemo(() => {
    console.log(`[PLLPage] studentsForEntryTab useMemo. editingStudentId:`, editingStudentId, `, initialLoadedStudentSlipIds:`, initialLoadedStudentSlipIds);
    if (isLoadingStudents || !studentsInSelectedClass || isLoadingExistingSlips) {
      console.log("[PLLPage] EntryTab: Loading or no data yet, returning empty array.");
      return [];
    }
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      const result = studentBeingEdited ? [studentBeingEdited] : [];
      console.log(`[PLLPage] Students for EntryTab (editing ${editingStudentId}, count: ${result.length}):`, result.map(s => ({id: s.id, name: s.hoTen})));
      return result;
    }
    const historyStudentIds = new Set(studentsForHistoryTab.map(s => s.id));
    const result = studentsInSelectedClass.filter(student => !historyStudentIds.has(student.id));
    console.log(`[PLLPage] Students for EntryTab (not editing, count: ${result.length}):`, result.map(s => ({id: s.id, name: s.hoTen})));
    return result;
  }, [studentsInSelectedClass, studentsForHistoryTab, editingStudentId, isLoadingStudents, isLoadingExistingSlips]);


  const saveSlipsMutation = useMutation({
    mutationFn: savePhieuLienLacRecords,
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: `Phiếu liên lạc đã được lưu cho ${variables.length} học sinh.` });
      console.log("[PLLPage] saveSlipsMutation onSuccess. Invalidating queries for existingPhieuLienLac.");
      
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

    const recordsToSave: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>> = [];
    // Consider ALL students in the class for saving, or only those with changes/new entries
    const studentsToProcess = editingStudentId 
      ? studentsInSelectedClass.filter(s => s.id === editingStudentId) 
      : studentsInSelectedClass; 

    console.log("[PLLPage] handleSaveAllSlips - Students to process for saving:", studentsToProcess.map(s => s.id));

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
      } else {
         console.log(`[PLLPage] handleSaveAllSlips: No input found for student ${student.id}, skipping save for this student.`);
      }
    });
     console.log("[PLLPage] handleSaveAllSlips: Records to save:", recordsToSave);
    if (recordsToSave.length === 0) {
        toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." });
        return;
    }
    saveSlipsMutation.mutate(recordsToSave);
  }, [selectedClassId, selectedDate, classes, studentsInSelectedClass, studentSlipInputs, editingStudentId, saveSlipsMutation, toast, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks]);

  const handleEditSlip = useCallback((studentId: string) => {
    console.log(`[PLLPage] handleEditSlip called for studentId: ${studentId}`);
    setEditingStudentId(studentId);
    setActiveTab("nhap-diem");
    requestAnimationFrame(() => {
        entryTabTriggerRef.current?.focus(); 
        entryTabTriggerRef.current?.click(); 
    });
  }, [setActiveTab]);

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
    setEditingStudentId(studentId); 
    setActiveTab("nhap-diem");
    requestAnimationFrame(() => { entryTabTriggerRef.current?.click(); });
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho ${studentName}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
  }, [studentsInSelectedClass, toast, commonHomeworkVocabulary, commonHomeworkTasks, setActiveTab]);

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
    if (typeof html2canvas === 'undefined') {
        toast({ title: "Lỗi Xuất Ảnh", description: "Chức năng xuất ảnh đang được cấu hình (html2canvas). Vui lòng thử lại sau.", variant: "warning", duration: 7000});
        return;
    }
    try {
        const canvas = await html2canvas(contentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        link.download = `PhieuLienLac_${studentName?.replace(/\s+/g, '_') || 'HS'}_${slipIdentifier}.png`;
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
              masteryDetails.text !== (currentInput.lessonMasteryText || "") ||
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
    
    const hasNewEntriesToSave = studentsForEntryTab.some(student => {
        const input = studentSlipInputs[student.id];
        const isNewNonEmpty = input && !isSlipInputEmpty(input) && !initialLoadedStudentSlipIds.has(student.id);
        if(isNewNonEmpty) console.log(`[PLLPage] canSaveChanges: Student ${student.id} is new and non-empty.`);
        return isNewNonEmpty;
    });
    if(hasNewEntriesToSave) {
        console.log("[PLLPage] canSaveChanges: Found new entries to save. Returning true.");
        return true;
    }
    
     const hasModifiedCommonHWForLoaded = initialLoadedStudentSlipIds.size > 0 && studentsInSelectedClass.some(student => {
        if (!initialLoadedStudentSlipIds.has(student.id)) return false;
        const input = studentSlipInputs[student.id];
        const originalSlip = existingSlipsData?.find(es => es.studentId === student.id);
        if (!input || !originalSlip) return false; 
        const commonHWChanged = (originalSlip.homeworkAssignmentVocabulary || "") !== (input.homeworkAssignmentVocabulary || commonHomeworkVocabulary) ||
               (originalSlip.homeworkAssignmentTasks || "") !== (input.homeworkAssignmentTasks || commonHomeworkTasks);
        if(commonHWChanged) console.log(`[PLLPage] canSaveChanges: Common HW changed for loaded student ${student.id}`);
        return commonHWChanged;
    });
    if(hasModifiedCommonHWForLoaded) {
        console.log("[PLLPage] canSaveChanges: Found modified common HW for loaded students. Returning true.");
        return true;
    }
    console.log("[PLLPage] canSaveChanges: No conditions met for enabling save. Returning false.");
    return false;
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, initialLoadedStudentSlipIds, existingSlipsData, commonHomeworkVocabulary, commonHomeworkTasks, studentsForEntryTab]);

  const savePeriodicRemarkMutation = useMutation({
    mutationFn: (data: { slipId: string, summaryRemark: string }) => updatePeriodicSummaryForSlip(data.slipId, data.summaryRemark),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: "Nhận xét tổng hợp đã được lưu." });
      queryClient.invalidateQueries({ queryKey: ['phieuLienLacRecordsForStudent', periodicSlipStudent?.id, selectedClassId] }); 
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
      const records = await getPhieuLienLacRecordsForStudentInRange(student.id, selectedClassId);
      console.log(`[PLLPage] Fetched ${records.length} daily slips for periodic view for student ${student.id}:`, records);
      setAllDailySlipsForPeriodic(records);
      
      if (records.length > 0) {
        const lastSlipInFetchedData = [...records].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()).pop();
        if (lastSlipInFetchedData?.periodicSummaryRemark) {
          console.log(`[PLLPage] Found existing periodic summary remark for last slip ${lastSlipInFetchedData.id}: "${lastSlipInFetchedData.periodicSummaryRemark}"`);
          setPeriodicSlipSummaryRemark(lastSlipInFetchedData.periodicSummaryRemark);
        } else {
          console.log(`[PLLPage] No existing periodic summary remark found for last slip ${lastSlipInFetchedData?.id}.`);
        }
      } else {
        console.log(`[PLLPage] No daily slips found for student ${student.id} to populate periodic view.`);
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
  }, [selectedClassId, toast]);

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
            <CardTitle>Hướng dẫn Bài tập về nhà (Chung cho cả lớp)</CardTitle>
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
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'nhap-diem' | 'lich-su' | 'theo-chu-ky')}>
                <TabsList className="grid w-full sm:w-auto grid-cols-3 mb-4 bg-primary/10 p-1 rounded-lg">
                  <TabsTrigger ref={entryTabTriggerRef} value="nhap-diem" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Nhập điểm ({studentsForEntryTab.length})
                  </TabsTrigger>
                  <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Lịch sử nhận xét ({studentsForHistoryTab.length})
                  </TabsTrigger>
                  <TabsTrigger value="theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">
                    Theo chu kỳ
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
                              <TableCell className={cn("font-medium", getLessonMasteryTextAndColor(masteryDetails.text, calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score).isTrulyMastered).className)}>
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
                          <TableHead className="text-right w-[180px] sticky top-0 bg-card z-10">Hành động</TableHead>
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
                 <TabsContent value="theo-chu-ky">
                  {(isLoadingStudents) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải học sinh...</div>}
                  {!(isLoadingStudents) && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh hoặc chưa chọn lớp.</p>}
                  {!(isLoadingStudents) && studentsInSelectedClass.length > 0 && (
                    <ScrollArea className="max-h-[60vh] pr-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px] sticky top-0 bg-card z-10">STT</TableHead>
                            <TableHead className="sticky top-0 bg-card z-10">Họ và tên</TableHead>
                            <TableHead className="text-right w-[180px] sticky top-0 bg-card z-10">Hành động</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentsInSelectedClass.map((student, index) => (
                            <TableRow key={`periodic-${student.id}`}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell className="text-right">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleOpenPeriodicSlipDialog(student)} 
                                  aria-label="Xem Phiếu Chu Kỳ" 
                                  disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}
                                >
                                  {isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id ? 
                                    <Loader2 className="animate-spin h-4 w-4 mr-2"/> : 
                                    <BookCopy className="h-4 w-4 mr-2" />
                                  }
                                  Xem Phiếu Chu Kỳ
                                </Button>
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
             {(activeTab === 'nhap-diem' || (activeTab === 'lich-su' && editingStudentId)) && (selectedClassId && selectedDate) && (
              <CardFooter className="border-t pt-6">
                <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || !canSaveChanges}>
                  {saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saveButtonText}
                </Button>
                 {editingStudentId && activeTab === 'nhap-diem' && (
                    <Button variant="ghost" onClick={() => {
                        console.log(`[PLLPage] Cancelling edit for student ${editingStudentId}. Resetting their input and clearing editingStudentId.`);
                        const originalSlipForEditing = existingSlipsData.find(s => s.studentId === editingStudentId);
                        if (originalSlipForEditing) {
                            const masteryDetails = calculateMasteryDetailsForPLL(originalSlipForEditing.testFormat, originalSlipForEditing.score);
                            setStudentSlipInputs(prev => ({
                                ...prev,
                                [editingStudentId!]: {
                                    testFormat: originalSlipForEditing.testFormat || "",
                                    score: originalSlipForEditing.score === null || originalSlipForEditing.score === undefined ? '' : String(originalSlipForEditing.score),
                                    lessonMasteryText: masteryDetails.text,
                                    homeworkStatus: originalSlipForEditing.homeworkStatus || "",
                                    vocabularyToReview: originalSlipForEditing.vocabularyToReview || '',
                                    remarks: originalSlipForEditing.remarks || '',
                                    homeworkAssignmentVocabulary: originalSlipForEditing.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
                                    homeworkAssignmentTasks: originalSlipForEditing.homeworkAssignmentTasks || commonHomeworkTasks,
                                }
                            }));
                        } else {
                             const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
                             setStudentSlipInputs(prev => ({
                                ...prev,
                                [editingStudentId!]: {
                                     testFormat: "", score: '', lessonMasteryText: masteryDetailsForEmpty.text,
                                    homeworkStatus: "", vocabularyToReview: '', remarks: '',
                                    homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
                                    homeworkAssignmentTasks: commonHomeworkTasks,
                                }
                            }));
                        }
                        setEditingStudentId(null); 
                        setActiveTab('lich-su'); 
                        
                    }} className="ml-2" disabled={saveSlipsMutation.isPending}>
                        Hủy Sửa
                    </Button>
                )}
              </CardFooter>
            )}
          </Card>
        )}

        {/* Daily Slip Detail Dialog */}
        <Dialog open={isSlipModalOpen} onOpenChange={setIsSlipModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
              <ShadDialogHeaderOriginal className="p-4 pb-0 text-center sticky top-0 z-10 bg-background"> 
                <ShadDialogTitleOriginal className="text-2xl font-bold uppercase text-primary text-center">
                    PHIẾU LIÊN LẠC
                </ShadDialogTitleOriginal>
                {currentSlipData?.date && (
                    <ShadDialogDescriptionOriginal className="text-sm text-center text-muted-foreground">
                    Ngày: {isValid(parse(currentSlipData.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}
                    </ShadDialogDescriptionOriginal>
                )}
              </ShadDialogHeaderOriginal>
              <ScrollArea className="flex-grow">
                 <div ref={slipDialogContentRef} className="bg-background font-sans p-4 space-y-1 leading-normal">
                  {currentSlipData ? (
                  <div className="space-y-0.5 text-sm leading-snug">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 mb-1">
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[70px] inline-block">Họ và tên:</strong> <span className="text-indigo-700 font-semibold text-base">{currentSlipData.studentName}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[70px] inline-block">Lớp:</strong> <span className="font-medium text-base">{currentSlipData.className}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[70px] inline-block">Mã HS:</strong> <span className="font-medium text-base">{currentSlipData.studentId}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[70px] inline-block">Ngày KT:</strong> <span className="font-medium text-base">{isValid(parse(currentSlipData.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipData.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</span></p>
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
                      <SlipDetailItem label="Từ vựng cần học lại:" fullWidth>{currentSlipData.vocabularyToReview}</SlipDetailItem>
                      <SlipDetailItem label="Nhận xét:" fullWidth>{currentSlipData.remarks}</SlipDetailItem>

                      <Separator className="my-1.5"/>
                      <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mt-2 mb-0.5">Hướng dẫn Bài tập về nhà:</h3>
                      <SlipDetailItem label="Từ vựng cần học:" fullWidth>{currentSlipData.homeworkAssignmentVocabulary}</SlipDetailItem>
                      <SlipDetailItem label="Bài tập làm tại nhà:" fullWidth>{currentSlipData.homeworkAssignmentTasks}</SlipDetailItem>

                      <Separator className="my-1.5"/>
                        <div className="text-sm font-medium leading-snug mt-2">
                            {currentSlipData.vocabularyToReview && currentSlipData.vocabularyToReview.trim() !== "" ? (
                                <>
                                <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc.</p>
                                <p className="mt-1"><strong>Trân trọng.</strong></p>
                                </>
                            ) : (
                                <p className="mt-1"><strong>Trân trọng.</strong></p>
                            )}
                        </div>
                  </div>
                  ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background">
              <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm">Đóng</Button>
              </DialogClose>
              <Button
                onClick={() => handleExportSlipImage(slipDialogContentRef, currentSlipData?.date || 'phieu-ngay', currentSlipData?.studentName)}
                disabled={!currentSlipData || (typeof html2canvas === 'undefined')}
                size="sm"
              >
                 {typeof html2canvas === 'undefined' && currentSlipData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                 {typeof html2canvas === 'undefined' && currentSlipData ? "Đang tải..." : "Xuất file ảnh"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Periodic Slip Dialog */}
        <Dialog open={isPeriodicSlipModalOpen} onOpenChange={(open) => {
            setIsPeriodicSlipModalOpen(open);
            if (!open) {
                setPeriodicSlipStudent(null);
                setAllDailySlipsForPeriodic([]);
                setPeriodicSlipSummaryRemark("");
            }
        }}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <ShadDialogHeaderOriginal className="p-4 pb-0 text-center sticky top-0 z-10 bg-background">
                    <Image 
                        src="/logo.png" 
                        alt="HoEdu Solution Logo" 
                        width={60} 
                        height={60} 
                        style={{ height: 'auto' }} 
                        className="mx-auto mb-1" 
                        priority
                        data-ai-hint="app logo education"
                    />
                    <ShadDialogTitleOriginal className="text-xl font-bold uppercase text-primary text-center">
                        PHIẾU LIÊN LẠC CHU KỲ
                    </ShadDialogTitleOriginal>
                    <ShadDialogDescriptionOriginal className="text-xs text-center text-muted-foreground">
                    Ngày xuất: {format(new Date(), "dd/MM/yyyy", { locale: vi })}
                    </ShadDialogDescriptionOriginal>
                </ShadDialogHeaderOriginal>
                <ScrollArea className="flex-grow">
                    <div ref={periodicSlipDialogContentRef} className="bg-background font-sans p-4 space-y-2 leading-normal">
                      {isLoadingPeriodicSlipRecords && <div className="text-center p-10"><Loader2 className="h-8 w-8 animate-spin mx-auto"/> Đang tải dữ liệu...</div>}
                      {!isLoadingPeriodicSlipRecords && periodicSlipStudent && currentClassForPeriodicSlip && (
                          <div className="space-y-1.5 text-sm mt-2 leading-snug">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 mb-2">
                                  <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Họ và tên:</strong> <span className="font-semibold text-indigo-700">{periodicSlipStudent.hoTen}</span></p>
                                  <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Lớp:</strong> <span className="font-medium">{currentClassForPeriodicSlip.tenLop}</span></p>
                                  <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Mã HS:</strong> <span className="font-medium">{periodicSlipStudent.id}</span></p>
                                  <p className="text-left"><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Chu kỳ học:</strong> <span className="font-medium">{currentClassForPeriodicSlip.chuKyDongPhi} ({periodicSlipDateRangeText})</span></p>
                              </div>
                              <Separator className="my-1.5" />
                              <h3 className="text-base font-semibold text-foreground mt-2 mb-0.5">Tình hình học tập:</h3>
                              {allDailySlipsForPeriodic.length > 0 ? (
                                  <Table>
                                      <TableHeader>
                                          <TableRow>
                                              <TableHead className="w-[40px] p-1.5">STT</TableHead>
                                              <TableHead className="p-1.5">Ngày KT</TableHead>
                                              <TableHead className="p-1.5">Hình thức</TableHead>
                                              <TableHead className="p-1.5">Điểm</TableHead>
                                              <TableHead className="p-1.5">Thuộc bài</TableHead>
                                              <TableHead className="p-1.5">Bài tập về nhà</TableHead>
                                          </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {allDailySlipsForPeriodic.sort((a, b) => {
                                              const dateA = parseISO(a.date);
                                              const dateB = parseISO(b.date);
                                              return dateA.getTime() - dateB.getTime();
                                            }).map((slip, index) => {
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
                              ) : (
                                  <p className="text-muted-foreground">Không có dữ liệu phiếu liên lạc chi tiết cho chu kỳ này.</p>
                              )}
                              <Separator className="my-1.5" />
                                <div className="mt-2">
                                  <Label htmlFor="periodic-summary-remark" className="text-base font-semibold text-foreground mb-0.5 block">Nhận xét tổng hợp:</Label>
                                  <Textarea
                                      id="periodic-summary-remark"
                                      value={periodicSlipSummaryRemark}
                                      onChange={(e) => setPeriodicSlipSummaryRemark(e.target.value)}
                                      placeholder="Nhập nhận xét tổng hợp cho học sinh..."
                                      rows={3}
                                      className="text-sm"
                                  />
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
                <DialogFooter className="p-2 border-t sm:justify-between bg-background sticky bottom-0 z-10">
                     <div className="flex gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline" size="sm">Đóng</Button>
                        </DialogClose>
                        <Button onClick={handleSavePeriodicRemark} size="sm" disabled={savePeriodicRemarkMutation.isPending || !periodicSlipStudent || allDailySlipsForPeriodic.length === 0}>
                            {savePeriodicRemarkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Lưu Nhận Xét
                        </Button>
                    </div>
                    <Button onClick={() => handleExportSlipImage(periodicSlipDialogContentRef, periodicSlipStudent?.hoTen ? `${periodicSlipStudent.hoTen}_ChuKy` : 'PhieuChuKy', periodicSlipDateRangeText)} disabled={isLoadingPeriodicSlipRecords || !periodicSlipStudent || (typeof html2canvas === 'undefined')} size="sm">
                        {typeof html2canvas === 'undefined' && !isLoadingPeriodicSlipRecords && periodicSlipStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        {typeof html2canvas === 'undefined' && !isLoadingPeriodicSlipRecords && periodicSlipStudent ? "Đang tải..." : "Xuất file ảnh"}
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
  fullWidth?: boolean;
}

const SlipDetailItem: React.FC<SlipDetailItemProps> = ({ label, children, labelClassName, valueClassName, fullWidth = false }) => {
  if (fullWidth) {
    return (
      <div className="text-sm leading-normal pb-0.5 mt-1">
        <strong className={cn("font-medium text-muted-foreground mr-2 block mb-0.5 text-left", labelClassName)}>{label}</strong>
        <div className={cn("font-medium text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</div>
      </div>
    );
  }
  // For non-fullWidth, create a flex container to allow label and value to sit side-by-side
  return (
    <div className="flex text-sm leading-normal py-0">
      <strong className={cn("font-medium text-muted-foreground mr-1 text-left w-[140px] shrink-0", labelClassName)}>{label}</strong>
      <span className={cn("font-medium text-left text-foreground flex-1", valueClassName)}>{children || <span className="text-muted-foreground italic">N/A</span>}</span>
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
