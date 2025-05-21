
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, parseISO, isValid, addMonths, addDays, getDay, startOfMonth, endOfMonth, differenceInCalendarDays, addWeeks, isSameDay, subDays, formatISO, isAfter as dateIsAfter, isBefore as dateIsBefore } from 'date-fns';
import { vi } from 'date-fns/locale';
import html2canvas from 'html2canvas';

import DashboardLayout from '@/app/dashboard-layout';

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
  DialogHeader as ShadDialogHeaderOriginal, // Renamed to avoid conflict
  DialogTitle as ShadDialogTitleOriginal,   // Renamed to avoid conflict
  DialogDescription as ShadDialogDescriptionOriginal, // Renamed to avoid conflict
  DialogFooter,
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
import {
  savePhieuLienLacRecords,
  getPhieuLienLacRecordsForClassOnDate,
  getPhieuLienLacRecordsForStudentInRange,
  updatePeriodicSummaryForSlip,
  getAllSlipsWithPeriodicRemarksForClass,
  getAllPhieuLienLacRecordsForClass,
} from '@/services/phieuLienLacService';

import type { LopHoc, HocSinh, PhieuLienLacRecord, StudentSlipInput, TestFormatPLC, HomeworkStatusPLC, OptionLabel } from '@/lib/types';
import { ALL_TEST_FORMATS_PLC, ALL_HOMEWORK_STATUSES_PLC } from '@/lib/types';
import { cn, calculateCycleDisplayRange, dayOfWeekToNumber, formatCurrencyVND } from '@/lib/utils';
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle, BookCopy, FileText as IconFileText, Edit3, Info } from 'lucide-react';

// Use direct imports for Card components
// const CardHeader = ShadCardHeaderOriginal; // No longer needed if using direct imports
// const CardTitle = ShadCNCardTitleOriginal;   // No longer needed
// const CardDescription = ShadCNCardDescriptionOriginal; // No longer needed

// Use direct imports for Dialog components, aliasing only if necessary for clarity elsewhere
const DialogHeader = ShadDialogHeaderOriginal;
const DialogTitle = ShadDialogTitleOriginal;
const DialogDescription = ShadDialogDescriptionOriginal;


const isSlipInputEmpty = (entry: StudentSlipInput | undefined): boolean => {
  if (!entry) return true;
  const isEmpty = (
    (entry.testFormat === undefined || entry.testFormat === "" || entry.testFormat === null) &&
    (entry.score === undefined || entry.score === null || String(entry.score).trim() === '') &&
    (entry.homeworkStatus === undefined || entry.homeworkStatus === "" || entry.homeworkStatus === null) &&
    (entry.vocabularyToReview === undefined || String(entry.vocabularyToReview).trim() === '') &&
    (entry.remarks === undefined || String(entry.remarks).trim() === '')
  );
  // console.log(`[PLLPage] isSlipInputEmpty for entry:`, entry, `Result:`, isEmpty);
  return isEmpty;
};

const parseCycleRangeStringToDates = (rangeString: string): { startDate: Date | null, endDate: Date | null } => {
  if (!rangeString || typeof rangeString !== 'string' || !rangeString.includes(' - ')) {
    return { startDate: null, endDate: null };
  }
  const parts = rangeString.split(' - ');
  if (parts.length !== 2) {
    return { startDate: null, endDate: null };
  }
  try {
    const startDate = parse(parts[0], "dd/MM/yy", new Date());
    const endDate = parse(parts[1], "dd/MM/yy", new Date());
    if (!isValid(startDate) || !isValid(endDate)) {
       return { startDate: null, endDate: null };
    }
    return { startDate, endDate };
  } catch (e) {
    return { startDate: null, endDate: null };
  }
};


export default function PhieuLienLacPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  // Main selectors
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Tab management
  const [mainActiveTab, setMainActiveTab] = useState<'nhap-phieu' | 'lich-su'>('nhap-phieu');
  const [subActiveTabNhapPhieu, setSubActiveTabNhapPhieu] = useState<'theo-ngay' | 'theo-chu-ky'>('theo-ngay');
  const [subActiveTabLichSu, setSubActiveTabLichSu] = useState<'lich-su-theo-ngay' | 'lich-su-theo-chu-ky'>('lich-su-theo-ngay');
  
  // State for "Theo ngày" (daily slips) - Input Mode
  const [studentSlipInputs, setStudentSlipInputs] = useState<Record<string, StudentSlipInput>>({});
  const [initialLoadedStudentSlipIds, setInitialLoadedStudentSlipIds] = useState<Set<string>>(new Set());
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [commonHomeworkVocabulary, setCommonHomeworkVocabulary] = useState<string>("");
  const [commonHomeworkTasks, setCommonHomeworkTasks] = useState<string>("");

  // State for "Theo chu kỳ" (periodic slips)
  const [periodicSlipStudent, setPeriodicSlipStudent] = useState<HocSinh | null>(null);
  const [allDailySlipsForPeriodic, setAllDailySlipsForPeriodic] = useState<PhieuLienLacRecord[]>([]);
  const [isLoadingPeriodicSlipRecords, setIsLoadingPeriodicSlipRecords] = useState(false);
  const [periodicSlipSummaryRemark, setPeriodicSlipSummaryRemark] = useState<string>("");
  const [periodicSlipDateRangeText, setPeriodicSlipDateRangeText] = useState<string>("N/A");
  const [slipIdToUpdateForPeriodicRemark, setSlipIdToUpdateForPeriodicRemark] = useState<string | null>(null);
  
  // Modals
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false); // For daily slip detail/export
  const [currentSlipDataForModal, setCurrentSlipDataForModal] = useState<PhieuLienLacRecord | null>(null);
  const [isPeriodicSlipModalOpen, setIsPeriodicSlipModalOpen] = useState(false); // For periodic slip dialog

  const slipDialogContentRef = useRef<HTMLDivElement>(null); // For daily slip export
  const periodicSlipDialogContentRef = useRef<HTMLDivElement>(null); // For periodic slip export


  useEffect(() => {
    setIsClient(true);
    setSelectedDate(new Date()); // Initialize selectedDate on client mount
    console.log("[PLLPage] PhieuLienLacPage mounted or updated - " + new Date().toLocaleTimeString());
  }, []);

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return format(selectedDate, 'yyyy-MM-dd');
    } catch (e) {
      console.error("[PLLPage] Error formatting selectedDate for memoized key:", e);
      return new Date().toISOString().split('T')[0]; // Fallback
    }
  }, [selectedDate]);

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 0, 
  });

  const { data: studentsInSelectedClass = [], isLoading: isLoadingStudents, isError: isErrorStudents, refetch: refetchStudentsInClass } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClassForPLL', selectedClassId],
    queryFn: () => getStudentsByClassId(selectedClassId),
    enabled: !!selectedClassId && isClient,
  });

  const { data: existingSlipsData = [], isLoading: isLoadingExistingSlips, isError: isErrorExistingSlips, error: errorExistingSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey],
    queryFn: () => {
      if (!selectedClassId || !selectedDate || !memoizedFormattedSelectedDateKey) return Promise.resolve([]);
      return getPhieuLienLacRecordsForClassOnDate(selectedClassId, selectedDate);
    },
    enabled: !!selectedClassId && !!selectedDate && !!memoizedFormattedSelectedDateKey && isClient,
  });
  
  const { data: allClassSlips = [], isLoading: isLoadingAllClassSlips, isError: isErrorAllClassSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['allClassSlipsForPLLPage', selectedClassId],
    queryFn: () => getAllPhieuLienLacRecordsForClass(selectedClassId),
    enabled: !!selectedClassId && isClient && mainActiveTab === 'lich-su' && subActiveTabLichSu === 'lich-su-theo-ngay',
  });

  const { data: allSlipsWithPeriodicRemarks = [], isLoading: isLoadingAllSlipsWithRemarks, isError: isErrorAllSlipsWithRemarksData } = useQuery<PhieuLienLacRecord[], Error>({
      queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId],
      queryFn: () => getAllSlipsWithPeriodicRemarksForClass(selectedClassId),
      enabled: !!selectedClassId && isClient && mainActiveTab === 'lich-su' && subActiveTabLichSu === 'lich-su-theo-chu-ky',
  });


  useEffect(() => {
    console.log(`[PLLPage] Main useEffect triggered. DateKey: ${memoizedFormattedSelectedDateKey}, ClassId: ${selectedClassId}, isClient: ${isClient}, isLoadingStudents: ${isLoadingStudents}, isLoadingExistingSlips: ${isLoadingExistingSlips}`);
    console.log(`[PLLPage] Dependencies: existingSlipsData count: ${existingSlipsData?.length || 0}, studentsInSelectedClass count: ${studentsInSelectedClass?.length || 0}`);
    
    if (!isClient || isLoadingStudents || isLoadingExistingSlips || !selectedDate || !selectedClassId || !studentsInSelectedClass) {
      console.log("[PLLPage] Main useEffect: Skipping state update due to loading/missing data or not client-ready.");
      return;
    }
    
    const newInputsFromEffect: Record<string, StudentSlipInput> = {};
    const newInitialLoadedIdsFromEffect = new Set<string>();
    let commonVocabFromDb = "";
    let commonTasksFromDb = "";
    let commonHwInitializedFromDb = false;

    studentsInSelectedClass.forEach(student => {
      const existingDbSlip = existingSlipsData.find(s => s.studentId === student.id);
      const currentLocalInputForThisStudent = studentSlipInputs[student.id];

      if (existingDbSlip) {
        const masteryDetailsFromDb = calculateMasteryDetailsForPLL(existingDbSlip.testFormat, existingDbSlip.score);
        const entryFromDb: StudentSlipInput = {
          testFormat: existingDbSlip.testFormat || "",
          score: existingDbSlip.score === null || existingDbSlip.score === undefined ? '' : String(existingDbSlip.score),
          lessonMasteryText: masteryDetailsFromDb.text,
          masteredLesson: masteryDetailsFromDb.isTrulyMastered,
          homeworkStatus: existingDbSlip.homeworkStatus || "",
          vocabularyToReview: existingDbSlip.vocabularyToReview || '',
          remarks: existingDbSlip.remarks || '',
          homeworkAssignmentVocabulary: existingDbSlip.homeworkAssignmentVocabulary || "",
          homeworkAssignmentTasks: existingDbSlip.homeworkAssignmentTasks || "",
        };
        
        if (student.id === editingStudentId && currentLocalInputForThisStudent) {
            console.log(`[PLLPage] Main useEffect: Student ${student.id} is being edited. Preserving local input.`);
            newInputsFromEffect[student.id] = currentLocalInputForThisStudent;
        } else {
            console.log(`[PLLPage] Main useEffect: Student ${student.id}, existingDbSlip found. Using DB data:`, entryFromDb);
            newInputsFromEffect[student.id] = entryFromDb;
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
        const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
        const defaultEntry: StudentSlipInput = {
          testFormat: "", score: '', lessonMasteryText: masteryDetailsForEmpty.text,
          masteredLesson: false,
          homeworkStatus: "", vocabularyToReview: '', remarks: '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
          homeworkAssignmentTasks: commonHomeworkTasks,       
        };
        
        if (student.id === editingStudentId && currentLocalInputForThisStudent) {
            console.log(`[PLLPage] Main useEffect: Student ${student.id} is new & being edited. Preserving local input.`);
            newInputsFromEffect[student.id] = currentLocalInputForThisStudent;
        } else {
            console.log(`[PLLPage] Main useEffect: Student ${student.id}, no existingDbSlip. Using default entry:`, defaultEntry);
            newInputsFromEffect[student.id] = defaultEntry;
        }
      }
    });
    
    if (commonHwInitializedFromDb) {
      if (commonHomeworkVocabulary !== commonVocabFromDb) setCommonHomeworkVocabulary(commonVocabFromDb);
      if (commonHomeworkTasks !== commonTasksFromDb) setCommonHomeworkTasks(commonTasksFromDb);
      // Apply common HW to all entries, even those preserved from editing
      Object.keys(newInputsFromEffect).forEach(studentId => {
        if(newInputsFromEffect[studentId]) {
          newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonVocabFromDb;
          newInputsFromEffect[studentId].homeworkAssignmentTasks = commonTasksFromDb;
        }
      });
    } else if (existingSlipsData.length === 0 && studentsInSelectedClass.length > 0) {
      // Apply current common HW if no DB slips were found for anyone
      Object.keys(newInputsFromEffect).forEach(studentId => {
         if(newInputsFromEffect[studentId]) {
          newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonHomeworkVocabulary;
          newInputsFromEffect[studentId].homeworkAssignmentTasks = commonHomeworkTasks;
        }
      });
    }
    
    if (JSON.stringify(studentSlipInputs) !== JSON.stringify(newInputsFromEffect)) {
        console.log("[PLLPage] Main useEffect: studentSlipInputs changed. Updating state.");
        setStudentSlipInputs(newInputsFromEffect);
    } else {
        console.log("[PLLPage] Main useEffect: studentSlipInputs are the same. No update to studentSlipInputs state.");
    }

    if (JSON.stringify(Array.from(initialLoadedStudentSlipIds).sort()) !== JSON.stringify(Array.from(newInitialLoadedIdsFromEffect).sort())) {
        console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds changed. Updating state. New set:", newInitialLoadedIdsFromEffect);
        setInitialLoadedStudentSlipIds(newInitialLoadedIdsFromEffect);
    }
  }, [existingSlipsData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingSlips, isClient, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, editingStudentId]);


  useEffect(() => {
    if (!isClient) return;
    console.log(`[PLLPage] Date or Class changed. Resetting local states. New DateKey: ${memoizedFormattedSelectedDateKey}, New ClassId: ${selectedClassId}`);
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null); 
    // Do not reset commonHomeworkVocabulary and commonHomeworkTasks here, they should persist across dates for the same class session
    // Only reset them if selectedClassId changes OR if they should be reset based on new existingSlipsData (handled in main useEffect)
    
    if (selectedClassId && memoizedFormattedSelectedDateKey) {
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
    }
    if(selectedClassId) {
      refetchStudentsInClass(); // This should re-fetch students if class changes
      queryClient.invalidateQueries({ queryKey: ['allClassSlipsForPLLPage', selectedClassId]});
      queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] });
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient, queryClient, refetchStudentsInClass]); 

  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || { 
          score: '', vocabularyToReview: '', remarks: '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
          homeworkAssignmentTasks: commonHomeworkTasks,           
          testFormat: "", homeworkStatus: "", masteredLesson: false
      };
      let updatedEntry: StudentSlipInput = { ...currentEntry, [field]: value };

      if (field === 'testFormat' || field === 'score') {
        const masteryDetails = calculateMasteryDetailsForPLL(
          field === 'testFormat' ? value as TestFormatPLC : updatedEntry.testFormat,
          String(field === 'score' ? value : updatedEntry.score)
        );
        updatedEntry.lessonMasteryText = masteryDetails.text;
        updatedEntry.masteredLesson = masteryDetails.isTrulyMastered;
      }
      return { ...prev, [studentId]: updatedEntry };
    });
    if (editingStudentId !== studentId && !initialLoadedStudentSlipIds.has(studentId)) {
      console.log(`[PLLPage] handleSlipInputChange: Setting editingStudentId to ${studentId} because it's a new entry or changed from initial state.`);
      setEditingStudentId(studentId);
    }
  }, [commonHomeworkVocabulary, commonHomeworkTasks, initialLoadedStudentSlipIds, editingStudentId]);

  const studentsForDailyEntryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    return studentsInSelectedClass.filter(student => 
      !initialLoadedStudentSlipIds.has(student.id) || 
      isSlipInputEmpty(studentSlipInputs[student.id])
    );
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents]);

  const studentsForDailyHistoryTab = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass) return [];
     return allClassSlips; // This tab now shows all slips for the class, regardless of date
  }, [allClassSlips, isLoadingStudents]);

  const saveSlipsMutation = useMutation({
    mutationFn: (records: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>>) => savePhieuLienLacRecords(records),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: `Phiếu liên lạc hàng ngày đã được lưu cho ${variables.length > 0 ? variables.length : 'một số'} học sinh.` });
      setEditingStudentId(null); 
      const newInitialLoadedIds = new Set(initialLoadedStudentSlipIds);
      variables.forEach(rec => {
        if(!isSlipInputEmpty(rec as StudentSlipInput)) { // type assertion
            newInitialLoadedIds.add(rec.studentId);
        } else {
            newInitialLoadedIds.delete(rec.studentId);
        }
      });
      setInitialLoadedStudentSlipIds(newInitialLoadedIds);
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      queryClient.invalidateQueries({ queryKey: ['allClassSlipsForPLLPage', selectedClassId]});
      queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu phiếu liên lạc hàng ngày",
        description: `${error.message}. Kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
        duration: 7000,
      });
    },
  });

  const handleSaveAllSlips = useCallback(() => {
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
    const studentIdsToProcess = new Set<string>(studentsInSelectedClass.map(s => s.id));
    if (editingStudentId) studentIdsToProcess.add(editingStudentId); // ensure current edit is saved

    studentIdsToProcess.forEach(studentId => {
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        const input = studentSlipInputs[studentId];
        if (student && input && (student.id === editingStudentId || !isSlipInputEmpty(input) || initialLoadedStudentSlipIds.has(studentId))) {
            const masteryDetails = calculateMasteryDetailsForPLL(input.testFormat, input.score);
            let scoreToSave: number | null = null;
            if(input.score !== undefined && input.score !== null && String(input.score).trim() !== '') {
                if(!isNaN(Number(input.score))) scoreToSave = Number(input.score);
            }
            const recordPayload: Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'> = {
              studentId: student.id, studentName: student.hoTen, classId: selectedClassId,
              className: selectedClass.tenLop, date: memoizedFormattedSelectedDateKey, 
              testFormat: input.testFormat || "", score: scoreToSave, lessonMasteryText: masteryDetails.text,
              masteredLesson: masteryDetails.isTrulyMastered,
              homeworkStatus: input.homeworkStatus || "", vocabularyToReview: input.vocabularyToReview || '',
              remarks: input.remarks || '',
              homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
              homeworkAssignmentTasks: commonHomeworkTasks,         
            };
            recordsToSave.push(recordPayload);
        }
    });
    console.log("[PLLPage] handleSaveAllSlips called. Records to save:", recordsToSave);
    if (recordsToSave.length === 0) {
        toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." });
        return;
    }
    saveSlipsMutation.mutate(recordsToSave);
  }, [selectedClassId, selectedDate, classes, studentsInSelectedClass, studentSlipInputs, editingStudentId, initialLoadedStudentSlipIds, saveSlipsMutation, toast, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, queryClient]);


  const handleEditSlip = useCallback((studentId: string, slipDate: string) => {
    console.log(`[PLLPage] handleEditSlip for student ${studentId} on date ${slipDate}`);
    const dateToSelect = parseISO(slipDate);
    if (!isSameDay(selectedDate || new Date(0) , dateToSelect)) {
        setSelectedDate(dateToSelect); // This will trigger data refetch for the new date
    }
    setEditingStudentId(studentId);
    setMainActiveTab('nhap-phieu'); // Switch to the main input tab
    setSubActiveTabNhapPhieu("theo-ngay"); // Switch to the daily slip sub-tab
  }, [selectedDate]);

  const handleDeleteSlipEntry = useCallback((studentId: string) => { // No longer needs slipDate if acting on current studentSlipInputs
    const studentName = studentsInSelectedClass.find(s=>s.id === studentId)?.hoTen || "học sinh này";
    const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, null);
    setStudentSlipInputs(prev => ({
      ...prev,
      [studentId]: { 
        testFormat: "", score: null, lessonMasteryText: masteryDetailsForEmpty.text,
        masteredLesson: false,
        homeworkStatus: "", vocabularyToReview: '', remarks: '',
        homeworkAssignmentVocabulary: commonHomeworkVocabulary, 
        homeworkAssignmentTasks: commonHomeworkTasks,        
      }
    }));
    setEditingStudentId(studentId); // Keep them in edit mode to save this cleared state
    setMainActiveTab('nhap-phieu');
    setSubActiveTabNhapPhieu("theo-ngay");
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho ${studentName}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
  }, [studentsInSelectedClass, toast, commonHomeworkVocabulary, commonHomeworkTasks]); 

  const handleOpenSlipDialog = useCallback(async (studentId: string) => { // Daily slip dialog
    if (!selectedDate) {
      toast({ title: "Lỗi", description: "Vui lòng chọn ngày.", variant: "destructive" });
      return;
    }
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const slipInputData = studentSlipInputs[studentId];
    if (!student || !slipInputData) {
       toast({ title: "Lỗi", description: "Không tìm thấy thông tin phiếu hoặc học sinh.", variant: "destructive" });
       return;
    }
    
    // Construct slip data from current input state for preview
    const masteryDetails = calculateMasteryDetailsForPLL(slipInputData.testFormat, slipInputData.score);
    let scoreToDisplay: number | null = null;
    if(slipInputData.score !== undefined && slipInputData.score !== null && String(slipInputData.score).trim() !== '') {
        if(!isNaN(Number(slipInputData.score))) scoreToDisplay = Number(slipInputData.score);
    }
    const previewSlip: PhieuLienLacRecord = {
      id: 'preview-' + student.id, // Temporary ID for preview
      studentId: student.id,
      studentName: student.hoTen,
      classId: selectedClassId,
      className: classes.find(c => c.id === selectedClassId)?.tenLop || 'N/A',
      date: memoizedFormattedSelectedDateKey,
      testFormat: slipInputData.testFormat,
      score: scoreToDisplay,
      lessonMasteryText: masteryDetails.text,
      masteredLesson: masteryDetails.isTrulyMastered,
      homeworkStatus: slipInputData.homeworkStatus,
      vocabularyToReview: slipInputData.vocabularyToReview,
      remarks: slipInputData.remarks,
      homeworkAssignmentVocabulary: slipInputData.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
      homeworkAssignmentTasks: slipInputData.homeworkAssignmentTasks || commonHomeworkTasks,
    };
    setCurrentSlipDataForModal(previewSlip);
    setIsSlipModalOpen(true);
  }, [selectedDate, studentsInSelectedClass, studentSlipInputs, selectedClassId, classes, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, toast]); 


  // ---- Periodic Slip Logic ----
  const studentsToListInPeriodicTabs = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    console.log(`[PLLPage] studentsToListInPeriodicTabs updated. Count: ${studentsInSelectedClass.length}`);
    return studentsInSelectedClass;
  }, [studentsInSelectedClass, isLoadingStudents]);
  
  const studentsForNhanXetChuKyTab = useMemo(() => {
    if (isLoadingStudents || isLoadingClasses || !selectedDate || !studentsToListInPeriodicTabs || !allSlipsWithPeriodicRemarks) return [];
    const idsWithAnyRemark = new Set(allSlipsWithPeriodicRemarks.map(slip => slip.studentId));

    return studentsToListInPeriodicTabs.filter(student => {
        const studentClassDetails = classes.find(c => c.id === student.lopId);
        if (!studentClassDetails) return true; // Default to needing remark if class info is missing

        const cycleRangeString = calculateCycleDisplayRange(student, studentClassDetails, undefined);
        const { startDate: currentCycleStartDate, endDate: currentCycleEndDate } = parseCycleRangeStringToDates(cycleRangeString);
        
        if (!currentCycleStartDate || !currentCycleEndDate) return true; // Default to needing if cycle cannot be determined

        const latestRemarkSlipForStudent = allSlipsWithPeriodicRemarks
            .filter(slip => slip.studentId === student.id && slip.periodicSummaryRemark && slip.periodicSummaryRemark.trim() !== "")
            .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];

        if (!latestRemarkSlipForStudent) return true; // Needs remark if no prior remark

        const latestRemarkDate = parseISO(latestRemarkSlipForStudent.date);
        if (!isValid(latestRemarkDate)) return true; // Invalid date means needs remark

        // If the latest remark is before the current cycle started, it needs a new remark.
        if (dateIsBefore(latestRemarkDate, currentCycleStartDate)) return true;

        // If selectedDate indicates a new cycle has begun after the current one (which has a remark)
        if (dateIsAfter(selectedDate, currentCycleEndDate) && 
            (isSameDay(latestRemarkDate, currentCycleEndDate) || dateIsBefore(latestRemarkDate, currentCycleEndDate))) {
            return true;
        }
        return false; // Already has a remark for the current or a future cycle relative to latestRemarkDate
    }).map(student => {
        const studentClassDetails = classes.find(c => c.id === student.lopId);
        const cycleDisplay = studentClassDetails ? calculateCycleDisplayRange(student, studentClassDetails, undefined) : "N/A";
        return { ...student, displayCycle: cycleDisplay };
      });
  }, [studentsToListInPeriodicTabs, allSlipsWithPeriodicRemarks, classes, isLoadingStudents, isLoadingClasses, selectedDate, memoizedFormattedSelectedDateKey]);

  const studentsForLichSuChuKyTab = useMemo(() => {
    if (isLoadingStudents || isLoadingClasses || !studentsToListInPeriodicTabs || !allSlipsWithPeriodicRemarks) return [];
    const nhanXetStudentIds = new Set(studentsForNhanXetChuKyTab.map(s => s.id));
    
    return studentsToListInPeriodicTabs
      .filter(student => !nhanXetStudentIds.has(student.id)) // Show students who are *not* in the "needs remark" list
      .map(student => {
        const studentClassDetails = classes.find(c => c.id === student.lopId);
        const cycleDisplay = studentClassDetails ? calculateCycleDisplayRange(student, studentClassDetails, undefined) : "N/A";
        const latestRemarkSlipForStudent = allSlipsWithPeriodicRemarks
          .filter(slip => slip.studentId === student.id && slip.periodicSummaryRemark && slip.periodicSummaryRemark.trim() !== "")
          .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];
        return {
          ...student,
          lastSlipDateWithRemark: latestRemarkSlipForStudent ? latestRemarkSlipForStudent.date : undefined,
          displayCycle: cycleDisplay,
        };
      });
  }, [studentsToListInPeriodicTabs, allSlipsWithPeriodicRemarks, classes, isLoadingStudents, isLoadingClasses, studentsForNhanXetChuKyTab]);

  const savePeriodicRemarkMutation = useMutation({
    mutationFn: (data: { slipId: string, summaryRemark: string }) => updatePeriodicSummaryForSlip(data.slipId, data.summaryRemark),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: "Nhận xét tổng hợp đã được lưu." });
      if (selectedClassId){
        queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] }); 
      }
      setAllDailySlipsForPeriodic(prevSlips =>
        prevSlips.map(slip => slip.id === variables.slipId ? { ...slip, periodicSummaryRemark: variables.summaryRemark } : slip)
      );
      setIsPeriodicSlipModalOpen(false); 
    },
    onError: (error: Error) => {
      toast({ title: "Lỗi", description: `Không thể lưu nhận xét tổng hợp: ${error.message}. Kiểm tra console server để biết chi tiết.`, variant: "destructive" });
    },
  });

  const handleSavePeriodicRemark = useCallback(() => {
    if (!periodicSlipStudent || !slipIdToUpdateForPeriodicRemark) {
      toast({ title: "Lỗi", description: "Không có thông tin phiếu hoặc phiếu cuối cùng để lưu nhận xét.", variant: "destructive" });
      return;
    }
    savePeriodicRemarkMutation.mutate({ slipId: slipIdToUpdateForPeriodicRemark, summaryRemark: periodicSlipSummaryRemark });
  }, [periodicSlipStudent, slipIdToUpdateForPeriodicRemark, periodicSlipSummaryRemark, savePeriodicRemarkMutation, toast]);

  const handleOpenPeriodicSlipDialog = useCallback(async (student: HocSinh) => {
    console.log(`[PLLPage] handleOpenPeriodicSlipDialog for student: ${student.hoTen} (ID: ${student.id}) in class ${selectedClassId}`);
    if (!selectedClassId || !classes || classes.length === 0) {
      toast({ title: "Lỗi", description: "Vui lòng chọn lớp trước hoặc đợi danh sách lớp tải xong.", variant: "destructive"});
      return;
    }
    setIsLoadingPeriodicSlipRecords(true);
    setPeriodicSlipStudent(student);
    setPeriodicSlipSummaryRemark(""); 
    setSlipIdToUpdateForPeriodicRemark(null);

    try {
      const studentClassForDialog = classes.find(cls => cls.id === student.lopId);
      if (!studentClassForDialog) {
        toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp của học sinh.", variant: "destructive"});
        setIsLoadingPeriodicSlipRecords(false);
        return;
      }
      
      const fetchedStudentSlipsInRange = await getPhieuLienLacRecordsForStudentInRange(student.id, student.lopId);
      const sortedSlips = fetchedStudentSlipsInRange.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      setAllDailySlipsForPeriodic(sortedSlips);
      
      const cycleRangeString = calculateCycleDisplayRange(student, studentClassForDialog, undefined); // Pass undefined for allSlips here
      setPeriodicSlipDateRangeText(cycleRangeString);
      const { startDate: currentCycleStartDate, endDate: currentCycleEndDate } = parseCycleRangeStringToDates(cycleRangeString);
      console.log(`[PLLPage] Calculated current cycle for dialog: ${cycleRangeString}`, {currentCycleStartDate, currentCycleEndDate});


      if (sortedSlips.length > 0 && currentCycleStartDate && currentCycleEndDate) {
        // Filter slips to only those within the current theoretical cycle
        const slipsInCurrentCycle = sortedSlips.filter(s => {
            const slipDateObj = parseISO(s.date);
            return isValid(slipDateObj) && 
                   !dateIsBefore(slipDateObj, currentCycleStartDate) && // on or after start date
                   !dateIsAfter(slipDateObj, currentCycleEndDate);   // on or before end date
        });
        console.log(`[PLLPage] Found ${slipsInCurrentCycle.length} slips within the current cycle for student ${student.id}`);
        
        if (slipsInCurrentCycle.length > 0) {
          const lastSlipInCycle = slipsInCurrentCycle[slipsInCurrentCycle.length - 1]; // Already sorted by date asc
          setSlipIdToUpdateForPeriodicRemark(lastSlipInCycle.id);
          if (lastSlipInCycle.periodicSummaryRemark && lastSlipInCycle.periodicSummaryRemark.trim() !== "") {
            setPeriodicSlipSummaryRemark(lastSlipInCycle.periodicSummaryRemark);
          }
        } else {
            console.log(`[PLLPage] No daily slips found within the current cycle range (${cycleRangeString}) for student ${student.id}. Remark will be empty.`);
        }
      } else {
         console.log(`[PLLPage] No daily slips found at all for student ${student.id} or cycle dates invalid. Remark will be empty.`);
      }
      setIsPeriodicSlipModalOpen(true);
    } catch (error) {
       const errorMsg = (error as Error).message || "Không thể tải dữ liệu phiếu chu kỳ.";
       toast({
        title: "Lỗi tải dữ liệu phiếu chu kỳ",
        description: `${errorMsg}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).`,
        variant: "destructive",
        duration: 10000,
      });
    } finally {
      setIsLoadingPeriodicSlipRecords(false);
    }
  }, [selectedClassId, classes, toast]); 

  const selectedClassDetails = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  
  const canSaveChangesDaily = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId && studentSlipInputs[editingStudentId] ) {
        const originalSlip = existingSlipsData.find(s => s.studentId === editingStudentId && s.date === memoizedFormattedSelectedDateKey);
        const currentInput = studentSlipInputs[editingStudentId];
        if(!originalSlip && !isSlipInputEmpty(currentInput)) return true;
        if(originalSlip && JSON.stringify(currentInput) !== JSON.stringify({
             testFormat: originalSlip.testFormat || "",
             score: originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score),
             lessonMasteryText: calculateMasteryDetailsForPLL(originalSlip.testFormat, originalSlip.score).text,
             masteredLesson: calculateMasteryDetailsForPLL(originalSlip.testFormat, originalSlip.score).isTrulyMastered,
             homeworkStatus: originalSlip.homeworkStatus || "",
             vocabularyToReview: originalSlip.vocabularyToReview || '',
             remarks: originalSlip.remarks || '',
             homeworkAssignmentVocabulary: originalSlip.homeworkAssignmentVocabulary || commonHomeworkVocabulary,
             homeworkAssignmentTasks: originalSlip.homeworkAssignmentTasks || commonHomeworkTasks,
        })) return true;
    }
    const hasNewOrModifiedEntries = studentsInSelectedClass.some(student => {
      if(student.id === editingStudentId) return false; 
      const input = studentSlipInputs[student.id];
      return input && !isSlipInputEmpty(input);
    });
    return hasNewOrModifiedEntries;
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, existingSlipsData, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks]);

  const saveButtonText = useMemo(() => {
    if (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay') {
      if (editingStudentId) return "Lưu Thay Đổi Phiếu Ngày";
      return "Lưu Tất Cả Phiếu Ngày";
    }
    // Logic for periodic save button text can be added if needed
    return "Lưu"; 
  }, [mainActiveTab, subActiveTabNhapPhieu, editingStudentId]);

  // JSX for the page
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
                <SelectTrigger id="class-select-pll" aria-label="Chọn lớp">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn lớp học"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((lop) => <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-select-pll">Chọn Ngày</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button id="date-select-pll" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")} disabled={!selectedClassId}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate || undefined} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={vi} /></PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Tabs value={mainActiveTab} onValueChange={(value) => setMainActiveTab(value as 'nhap-phieu' | 'lich-su')} className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:max-w-lg grid-cols-2 mb-6 bg-primary/10 p-1 rounded-lg">
            <TabsTrigger value="nhap-phieu" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Nhập Phiếu</TabsTrigger>
            <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch Sử</TabsTrigger>
          </TabsList>

          {/* ==================== MAIN TAB CONTENT: NHẬP PHIẾU ==================== */}
          <TabsContent value="nhap-phieu">
            <Card className="shadow-md">
              <CardHeader>
                 <Tabs value={subActiveTabNhapPhieu} onValueChange={(value) => setSubActiveTabNhapPhieu(value as 'theo-ngay' | 'theo-chu-ky')}>
                    <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                      <TabsTrigger value="theo-ngay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo ngày</TabsTrigger>
                      <TabsTrigger value="theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo chu kỳ</TabsTrigger>
                    </TabsList>
                    
                    {/* --- SUB TAB CONTENT: NHẬP PHIẾU - THEO NGÀY --- */}
                    <TabsContent value="theo-ngay">
                      <Card className="mb-6 shadow-sm">
                        <CardHeader>
                          <CardTitle>Thông tin chung phiếu liên lạc (Hàng ngày)</CardTitle>
                          <CardDescription>Lớp: {selectedClassDetails?.tenLop || <Skeleton className="h-5 w-24 inline-block" />} | Ngày: {selectedDate ? format(selectedDate, "dd/MM/yyyy", {locale: vi}) : <Skeleton className="h-5 w-20 inline-block" />}</CardDescription>
                        </CardHeader>
                      </Card>
                      <Card className="mb-6 shadow-sm">
                        <CardHeader><CardTitle>Hướng dẫn Bài tập về nhà (Chung cho cả lớp)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                          <div><Label htmlFor="common-hw-vocab">Từ vựng cần học</Label><Textarea id="common-hw-vocab" placeholder="VD: Unit 1 - Vocabulary List A, B, C..." value={commonHomeworkVocabulary} onChange={(e) => setCommonHomeworkVocabulary(e.target.value)} rows={2}/></div>
                          <div><Label htmlFor="common-hw-tasks">Bài tập làm tại nhà</Label><Textarea id="common-hw-tasks" placeholder="VD: Workbook trang 10-12..." value={commonHomeworkTasks} onChange={(e) => setCommonHomeworkTasks(e.target.value)} rows={2}/></div>
                        </CardContent>
                      </Card>

                      {isErrorClasses && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách lớp.</div>}
                      {selectedClassId && isErrorStudents && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách học sinh cho lớp này.</div>}
                      {selectedClassId && selectedDate && isErrorExistingSlips && <div className="p-4 text-destructive text-center border border-destructive/50 bg-destructive/10 rounded-md shadow-sm"><AlertCircle className="inline mr-2 h-5 w-5"/>Lỗi tải lịch sử phiếu liên lạc đã có.<p className="text-xs text-muted-foreground mt-1">{(errorExistingSlips as Error)?.message || "Không thể tải dữ liệu."} Kiểm tra console server Next.js.</p></div>}

                      {(isLoadingStudents || isLoadingExistingSlips) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải danh sách học sinh hoặc phiếu đã có...</div>}
                      {!(isLoadingStudents || isLoadingExistingSlips) && selectedClassId && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                      {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để bắt đầu nhập phiếu.</p>}
                      
                      {!(isLoadingStudents || isLoadingExistingSlips) && selectedClassId && studentsInSelectedClass.length > 0 && (
                        <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[150px] sticky top-0 bg-card z-10">Học sinh</TableHead><TableHead className="w-[180px] sticky top-0 bg-card z-10">Hình thức KT</TableHead><TableHead className="w-[100px] sticky top-0 bg-card z-10">Điểm</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Thuộc bài?</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Bài tập về nhà</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Từ vựng cần học lại</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Nhận xét</TableHead></TableRow></TableHeader><TableBody>
                            {studentsInSelectedClass.filter(student => student.id === editingStudentId || !initialLoadedStudentSlipIds.has(student.id) || isSlipInputEmpty(studentSlipInputs[student.id])).map((student) => {
                              const currentInput = studentSlipInputs[student.id] || {};
                              const masteryDetails = calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score);
                              return (<TableRow key={`entry-${student.id}`}><TableCell className="font-medium">{student.hoTen}</TableCell><TableCell><Select value={currentInput.testFormat || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'testFormat', value as TestFormatPLC)}><SelectTrigger aria-label={`Hình thức KT cho ${student.hoTen}`}><SelectValue placeholder="Chọn hình thức" /></SelectTrigger><SelectContent>{ALL_TEST_FORMATS_PLC.map(formatValue => <SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input type="text" placeholder="VD: 8" value={currentInput.score || ''} onChange={(e) => handleSlipInputChange(student.id, 'score', e.target.value)} className="w-20" aria-label={`Điểm cho ${student.hoTen}`}/></TableCell><TableCell className={cn("font-medium", getLessonMasteryTextAndColor(masteryDetails.text, masteryDetails.isTrulyMastered).className)}>{masteryDetails.text}</TableCell><TableCell><Select value={currentInput.homeworkStatus || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'homeworkStatus', value as HomeworkStatusPLC)}><SelectTrigger aria-label={`Bài tập về nhà cho ${student.hoTen}`}><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger><SelectContent>{ALL_HOMEWORK_STATUSES_PLC.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Textarea value={currentInput.vocabularyToReview || ''} onChange={(e) => handleSlipInputChange(student.id, 'vocabularyToReview', e.target.value)} placeholder="Từ vựng..." rows={1} aria-label={`Từ vựng cần học lại cho ${student.hoTen}`}/></TableCell><TableCell><Textarea value={currentInput.remarks || ''} onChange={(e) => handleSlipInputChange(student.id, 'remarks', e.target.value)} placeholder="Nhận xét..." rows={1} aria-label={`Nhận xét cho ${student.hoTen}`}/></TableCell></TableRow>);
                            })}
                          </TableBody></Table></ScrollArea>
                      )}
                    </TabsContent>

                    {/* --- SUB TAB CONTENT: NHẬP PHIẾU - THEO CHU KỲ --- */}
                    <TabsContent value="theo-chu-ky">
                      <CardDescription className="mb-4">Chọn học sinh để nhập/cập nhật nhận xét tổng hợp cho chu kỳ hiện tại của họ.</CardDescription>
                      {(isLoadingStudents || !selectedClassId) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> {isLoadingStudents ? "Đang tải học sinh..." : "Vui lòng chọn lớp."}</div>}
                      {!isLoadingStudents && selectedClassId && studentsToListInPeriodicTabs.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                      {!isLoadingStudents && studentsToListInPeriodicTabs.length > 0 && (
                        <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Chu kỳ hiện tại</TableHead><TableHead className="text-right w-[220px]">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {studentsToListInPeriodicTabs.map((student, index) => {
                                const studentClassDetails = classes.find(c => c.id === student.lopId);
                                const cycleDisplay = studentClassDetails ? calculateCycleDisplayRange(student, studentClassDetails, undefined) : "N/A";
                                return (<TableRow key={`periodic-entry-${student.id}`}><TableCell>{index + 1}</TableCell><TableCell className="font-medium">{student.hoTen}</TableCell><TableCell>{student.id}</TableCell><TableCell>{cycleDisplay}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Nhập/Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}>{isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <IconFileText className="h-4 w-4 mr-2" />}Nhập/Sửa Nhận Xét</Button></TableCell></TableRow>);
                              })}
                            </TableBody></Table></ScrollArea>
                      )}
                    </TabsContent>
                 </Tabs>
              </CardHeader>
              {(mainActiveTab === 'nhap-phieu' && selectedClassId && selectedDate ) && (
                  <CardFooter className="border-t pt-6">
                    <Button onClick={handleSaveAllSlips} disabled={saveSlipsMutation.isPending || (subActiveTabNhapPhieu === 'theo-ngay' && !canSaveChangesDaily)}>{saveSlipsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saveButtonText}</Button>
                     {subActiveTabNhapPhieu === 'theo-ngay' && editingStudentId && (<Button variant="ghost" onClick={() => {setEditingStudentId(null);}} className="ml-2" disabled={saveSlipsMutation.isPending}>Hủy Sửa</Button>)}
                  </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* ==================== MAIN TAB CONTENT: LỊCH SỬ ==================== */}
          <TabsContent value="lich-su">
             <Card className="shadow-md">
              <CardHeader>
                <Tabs value={subActiveTabLichSu} onValueChange={(value) => setSubActiveTabLichSu(value as 'lich-su-theo-ngay' | 'lich-su-theo-chu-ky')}>
                  <TabsList className="grid w-full sm:w-auto sm:max-w-md grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                    <TabsTrigger value="lich-su-theo-ngay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử theo ngày</TabsTrigger>
                    <TabsTrigger value="lich-su-theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử theo chu kỳ</TabsTrigger>
                  </TabsList>

                  {/* --- SUB TAB CONTENT: LỊCH SỬ - THEO NGÀY --- */}
                  <TabsContent value="lich-su-theo-ngay">
                     <CardDescription className="mb-4">Hiển thị tất cả phiếu liên lạc hàng ngày đã lưu cho lớp "{selectedClassDetails?.tenLop || 'N/A'}". Nhấp vào một hàng để xem chi tiết hoặc sửa.</CardDescription>
                      {(isLoadingAllClassSlips) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải lịch sử phiếu...</div>}
                      {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để xem lịch sử.</p>}
                      {selectedClassId && !isLoadingAllClassSlips && isErrorAllClassSlips && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử phiếu.</div>}
                      {selectedClassId && !isLoadingAllClassSlips && !isErrorAllClassSlips && studentsForDailyHistoryTab.length === 0 && <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lớp này.</p>}
                      {selectedClassId && !isLoadingAllClassSlips && !isErrorAllClassSlips && studentsForDailyHistoryTab.length > 0 && (
                         <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[100px]">Ngày</TableHead><TableHead>Học sinh</TableHead><TableHead>Hình thức KT</TableHead><TableHead>Điểm</TableHead><TableHead>Thuộc bài?</TableHead><TableHead>Bài tập về nhà</TableHead><TableHead className="text-right w-[180px]">Hành động</TableHead></TableRow></TableHeader><TableBody>
                            {studentsForDailyHistoryTab.map((slip) => {
                              if(!slip) return null; 
                              const masteryDetails = calculateMasteryDetailsForPLL(slip.testFormat, slip.score);
                              const homeworkDisplay = getHomeworkStatusTextAndColor(slip.homeworkStatus);
                              const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, slip.masteredLesson);
                              return (<TableRow key={`hist-daily-${slip.id}`}><TableCell>{format(parseISO(slip.date), "dd/MM/yy")}</TableCell><TableCell className="font-medium">{slip.studentName}</TableCell><TableCell>{slip.testFormat || 'N/A'}</TableCell><TableCell>{renderScoreDisplay(slip.score)}</TableCell><TableCell className={cn("font-medium", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell><TableCell className={cn(homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell><TableCell className="text-right"><div className="flex gap-2 justify-end"><Button variant="outline" size="icon" onClick={() => handleEditSlip(slip.studentId, slip.date)} aria-label="Sửa phiếu" disabled={saveSlipsMutation.isPending}><Edit3 className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(slip.studentId)} aria-label="Xóa phiếu (cục bộ)" disabled={saveSlipsMutation.isPending}><Trash2 className="h-4 w-4" /></Button><Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(slip.studentId)} aria-label="Xem/Xuất phiếu ngày" disabled={saveSlipsMutation.isPending}><Printer className="h-4 w-4" /></Button></div></TableCell></TableRow>);
                            })}
                          </TableBody></Table></ScrollArea>
                      )}
                  </TabsContent>
                  
                  {/* --- SUB TAB CONTENT: LỊCH SỬ - THEO CHU KỲ --- */}
                  <TabsContent value="lich-su-theo-chu-ky">
                    <CardDescription className="mb-4">Hiển thị danh sách học sinh đã có nhận xét tổng hợp cho một chu kỳ. Chọn học sinh để xem/sửa hoặc xuất phiếu.</CardDescription>
                    {(isLoadingStudents || isLoadingClasses || isLoadingAllSlipsWithRemarks) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                    {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để xem.</p>}
                    {selectedClassId && !isLoadingAllSlipsWithRemarks && isErrorAllSlipsWithRemarksData && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử nhận xét chu kỳ.<p className="text-xs text-muted-foreground mt-1">{(errorAllSlipsWithRemarksData as Error)?.message || "Không thể tải dữ liệu."} { (errorAllSlipsWithRemarksData as Error)?.message?.includes("index") ? "Kiểm tra console server Next.js (có thể thiếu index cho classId và periodicSummaryRemark)." : ""}</p></div>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsToListInPeriodicTabs.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsForLichSuChuKyTab.length === 0 && studentsToListInPeriodicTabs.length > 0 && <p className="text-muted-foreground p-4 text-center">Chưa có học sinh nào có nhận xét chu kỳ được lưu.</p>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsForLichSuChuKyTab.length > 0 && (
                      <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Chu kỳ</TableHead><TableHead className="text-right w-[180px]">Hành động</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {studentsForLichSuChuKyTab.map((student, index) => (<TableRow key={`periodic-history-${student.id}`}><TableCell>{index + 1}</TableCell><TableCell className="font-medium">{student.hoTen}</TableCell><TableCell>{student.id}</TableCell><TableCell>{student.displayCycle}</TableCell><TableCell className="text-right"><div className="flex gap-2 justify-end"><Button variant="outline" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Edit3 className="h-4 w-4"/></Button><Button variant="destructive" size="icon" onClick={() => toast({title: "Chức năng đang phát triển", description: "Xóa nhận xét chu kỳ sẽ được thêm sau."})} aria-label="Xóa Nhận Xét Chu Kỳ"><Trash2 className="h-4 w-4"/></Button><Button variant="default" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Xuất Phiếu Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Printer className="h-4 w-4"/></Button></div></TableCell></TableRow>))}
                          </TableBody></Table></ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ==================== DIALOG FOR DAILY SLIP PREVIEW ==================== */}
        <Dialog open={isSlipModalOpen} onOpenChange={(open) => {setIsSlipModalOpen(open); if(!open) setCurrentSlipDataForModal(null);}}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
              <div ref={slipDialogContentRef} className="bg-background font-sans p-4 sm:p-6 space-y-0.5 leading-tight"> 
                <DialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-10 bg-background">
                    <DialogTitle className="text-2xl font-bold uppercase text-primary text-center">PHIẾU LIÊN LẠC</DialogTitle>
                    {currentSlipDataForModal?.date && (<DialogDescription className="text-sm text-center text-muted-foreground">Ngày: {isValid(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</DialogDescription>)}
                </DialogHeader>
                {currentSlipDataForModal ? (
                <div className="space-y-0.5 text-sm mt-1 leading-normal"> 
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 mb-1">
                      <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Họ và tên:</strong> <span className="text-indigo-700 font-semibold text-base">{currentSlipDataForModal.studentName}</span></p>
                      <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Lớp:</strong> <span className="font-medium text-base">{currentSlipDataForModal.className}</span></p>
                      <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Mã HS:</strong> <span className="font-medium text-base">{currentSlipDataForModal.studentId}</span></p>
                      <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Ngày KT:</strong> <span className="font-medium text-base">{isValid(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</span></p>
                    </div>
                    <Separator className="my-1.5"/>
                     <h3 className="text-md font-semibold text-foreground mt-2 mb-1">Kết quả học tập:</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-sm">
                        <div className="space-y-0.5">
                          <SlipDetailItem label="Hình thức KT:" labelClassName="w-[120px]">{currentSlipDataForModal.testFormat || "N/A"}</SlipDetailItem>
                          <SlipDetailItem label="Thuộc bài:" labelClassName="w-[120px]"> <span className={cn("font-medium", getLessonMasteryTextAndColor(currentSlipDataForModal.lessonMasteryText, currentSlipDataForModal.masteredLesson).className)}>{currentSlipDataForModal.lessonMasteryText || "Chưa đánh giá"}</span></SlipDetailItem>
                        </div>
                        <div className="space-y-0.5">
                          <SlipDetailItem label="Điểm số:" labelClassName="w-[120px]">{renderScoreDisplay(currentSlipDataForModal.score)}</SlipDetailItem>
                          <SlipDetailItem label="Bài tập về nhà:" labelClassName="w-[120px]"> <span className={cn("font-medium", getHomeworkStatusTextAndColor(currentSlipDataForModal.homeworkStatus).className)}>{currentSlipDataForModal.homeworkStatus ? getHomeworkStatusTextAndColor(currentSlipDataForModal.homeworkStatus).text : "Không có bài tập về nhà"}</span></SlipDetailItem>
                        </div>
                    </div>
                    <Separator className="my-1.5"/>
                    <SlipDetailItem label="Từ vựng cần học lại:" fullWidth>{currentSlipDataForModal.vocabularyToReview}</SlipDetailItem>
                    <SlipDetailItem label="Nhận xét:" fullWidth>{currentSlipDataForModal.remarks}</SlipDetailItem>
                    <Separator className="my-1.5"/>
                    <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mt-2 mb-1">Hướng dẫn Bài tập về nhà:</h3>
                    <SlipDetailItem label="Từ vựng cần học:" fullWidth>{currentSlipDataForModal.homeworkAssignmentVocabulary}</SlipDetailItem>
                    <SlipDetailItem label="Bài tập làm tại nhà:" fullWidth>{currentSlipDataForModal.homeworkAssignmentTasks}</SlipDetailItem>
                    <Separator className="my-1.5"/>
                    <div className="text-sm font-medium leading-snug mt-2 space-y-0.5 text-center">
                        {(currentSlipDataForModal.vocabularyToReview && currentSlipDataForModal.vocabularyToReview.trim() !== "") || (currentSlipDataForModal.remarks && (currentSlipDataForModal.remarks.toLowerCase().includes("nhắc nhở") || currentSlipDataForModal.remarks.toLowerCase().includes("cần cố gắng"))) ? (
                            <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc và/hoặc hoàn thành các nội dung được giáo viên dặn dò.</p>
                        ) : null}
                      <p className="mt-1"><strong>Trân trọng.</strong></p>
                    </div>
                </div>
                ) : <p>Không có dữ liệu phiếu liên lạc để hiển thị.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background">
              <DialogClose asChild><Button type="button" variant="outline" size="sm">Đóng</Button></DialogClose>
              <Button onClick={() => handleExportSlipImage(slipDialogContentRef, currentSlipDataForModal?.date || 'phieu-ngay', currentSlipDataForModal?.studentName)} disabled={!currentSlipDataForModal || typeof html2canvas === 'undefined'} size="sm"><Printer className="mr-2 h-4 w-4" />{typeof html2canvas === 'undefined' ? 'Đang tải...' : 'Xuất file ảnh'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ==================== DIALOG FOR PERIODIC SLIP PREVIEW/INPUT ==================== */}
        <Dialog open={isPeriodicSlipModalOpen} onOpenChange={(open) => { setIsPeriodicSlipModalOpen(open); if (!open) {setPeriodicSlipStudent(null); setAllDailySlipsForPeriodic([]); setPeriodicSlipSummaryRemark(""); setSlipIdToUpdateForPeriodicRemark(null);}}}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
                <div ref={periodicSlipDialogContentRef} className="bg-background font-sans p-4 sm:p-6 space-y-1 leading-tight"> 
                     <DialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-20 bg-background">
                        <Image src="/logo.png" alt="HoEdu Solution Logo" width={60} height={60} style={{ height: 'auto' }} className="mx-auto mb-1" data-ai-hint="app logo" priority/>
                        <DialogTitle className="text-xl font-bold uppercase text-primary text-center">PHIẾU LIÊN LẠC CHU KỲ</DialogTitle>
                        <DialogDescription className="text-sm text-center text-muted-foreground">Ngày xuất: {format(new Date(), "dd/MM/yyyy", { locale: vi })}</DialogDescription>
                    </DialogHeader>
                    
                    {!isLoadingPeriodicSlipRecords && periodicSlipStudent && (
                        <div className="space-y-1 text-xs sm:text-sm mt-1 leading-normal">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5 mb-1">
                                <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Họ và tên:</strong> <span className="font-semibold text-indigo-700">{periodicSlipStudent.hoTen}</span></p>
                                <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Lớp:</strong> <span className="font-medium">{periodicSlipStudent.tenLop || 'N/A'}</span></p>
                                <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Mã HS:</strong> <span className="font-medium">{periodicSlipStudent.id}</span></p>
                                <p><strong className="font-medium text-muted-foreground mr-1 w-[80px] inline-block">Chu kỳ học:</strong> <span className="font-medium">{periodicSlipDateRangeText}</span></p>
                            </div>
                            <Separator className="my-1.5" />
                            <h3 className="text-sm sm:text-base font-semibold text-foreground mt-2 mb-1">Tình hình học tập:</h3>
                            {allDailySlipsForPeriodic.length > 0 ? (
                                <ScrollArea className="max-h-[250px] border rounded-md">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[30px] sm:w-[40px] p-1 sm:p-1.5 text-xs">STT</TableHead><TableHead className="p-1 sm:p-1.5 text-xs">Ngày KT</TableHead><TableHead className="p-1 sm:p-1.5 text-xs">Hình thức</TableHead><TableHead className="p-1 sm:p-1.5 text-xs">Điểm</TableHead><TableHead className="p-1 sm:p-1.5 text-xs">Thuộc bài</TableHead><TableHead className="p-1 sm:p-1.5 text-xs">Bài tập về nhà</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {allDailySlipsForPeriodic.map((slip, index) => {
                                            const masteryDetails = calculateMasteryDetailsForPLL(slip.testFormat, slip.score);
                                            const homeworkDisplay = getHomeworkStatusTextAndColor(slip.homeworkStatus);
                                            const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, slip.masteredLesson);
                                            return (<TableRow key={`periodic-detail-${slip.id}`}><TableCell className="p-1 sm:p-1.5 text-xs">{index + 1}</TableCell><TableCell className="p-1 sm:p-1.5 text-xs">{isValid(parseISO(slip.date)) ? format(parseISO(slip.date), "dd/MM/yy", {locale: vi}) : "N/A"}</TableCell><TableCell className="p-1 sm:p-1.5 text-xs">{slip.testFormat || 'N/A'}</TableCell><TableCell className="p-1 sm:p-1.5 text-xs">{renderScoreDisplay(slip.score)}</TableCell><TableCell className={cn("font-medium p-1 sm:p-1.5 text-xs", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell><TableCell className={cn("p-1 sm:p-1.5 text-xs", homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell></TableRow>);
                                        })}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            ) : (<p className="text-muted-foreground text-xs sm:text-sm">Không có dữ liệu phiếu liên lạc chi tiết cho chu kỳ này.</p>)}
                            <Separator className="my-1.5" />
                            <div className="mt-2">
                                <Label htmlFor="periodic-summary-remark" className="text-sm sm:text-base font-semibold text-foreground mb-1 block">Nhận xét tổng hợp:</Label>
                                <Textarea id="periodic-summary-remark" value={periodicSlipSummaryRemark} onChange={(e) => setPeriodicSlipSummaryRemark(e.target.value)} placeholder="Nhập nhận xét tổng hợp cho học sinh..." rows={3} className="text-xs sm:text-sm"/>
                            </div>
                            <Separator className="my-1.5"/>
                            <div className="text-sm font-medium mt-2 text-center space-y-0.5 mb-1 leading-snug">
                                <p><strong>Trân trọng.</strong></p>
                                <p><strong>Trần Đông Phú</strong></p>
                            </div>
                        </div>
                    )}
                    {isLoadingPeriodicSlipRecords && <div className="text-center p-10"><Loader2 className="h-8 w-8 animate-spin mx-auto"/> Đang tải dữ liệu...</div>}
                    {!isLoadingPeriodicSlipRecords && !periodicSlipStudent && <p className="text-center p-10 text-muted-foreground">Không có thông tin học sinh.</p>}
                </div>
            </ScrollArea>
             <DialogFooter className="p-2 border-t sm:justify-between bg-background">
                  <DialogClose asChild><Button type="button" variant="outline" size="sm">Đóng</Button></DialogClose>
                  <div className="flex gap-2">
                      <Button onClick={handleSavePeriodicRemark} size="sm" disabled={savePeriodicRemarkMutation.isPending || !periodicSlipStudent || !slipIdToUpdateForPeriodicRemark}>{savePeriodicRemarkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Lưu Nhận Xét</Button>
                      <Button onClick={() => handleExportSlipImage(periodicSlipDialogContentRef, periodicSlipStudent?.hoTen ? `${periodicSlipStudent.hoTen}_ChuKy` : 'PhieuChuKy', periodicSlipDateRangeText)} disabled={isLoadingPeriodicSlipRecords || !periodicSlipStudent || typeof html2canvas === 'undefined'} size="sm"><Printer className="mr-2 h-4 w-4" />{typeof html2canvas === 'undefined' ? 'Đang tải...' : 'Xuất file ảnh'}</Button>
                  </div>
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
      <div className="text-sm leading-normal pb-0.5"> 
        <strong className={cn("font-medium text-muted-foreground mr-2 block mb-0.5", labelClassName)}>{label}</strong>
        <div className={cn("font-medium text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-start text-sm py-0 pb-0.5 leading-normal"> 
      <strong className={cn("font-medium text-muted-foreground mr-2 w-[140px] shrink-0 text-left mb-0.5 sm:mb-0", labelClassName)}>{label}</strong>
      <span className={cn("font-medium flex-1 text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</span>
    </div>
  );
};

const Separator = React.forwardRef<
  React.ElementRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("shrink-0 bg-border h-[1px] w-full my-1.5", className)} {...props} />
));
Separator.displayName = "DialogSeparator";

// Helper functions for display (can be moved to utils if used elsewhere)
const renderScoreDisplay = (scoreValue?: number | null | string) => {
    if (scoreValue === null || scoreValue === undefined || String(scoreValue).trim() === '') return <span className="text-muted-foreground">N/A</span>;
    let score: number | null = null;
    if (!isNaN(Number(scoreValue))) score = Number(scoreValue);
    else return <span className="text-destructive">Không hợp lệ</span>;
    
    let scoreTextColor = "text-foreground";
    let starCount = 0;

    if (score >= 9 && score <= 10) { scoreTextColor = "text-red-600 dark:text-red-400"; starCount = 5; }
    else if (score >= 7 && score < 9) { scoreTextColor = "text-blue-600 dark:text-blue-400"; starCount = 4; }
    else if (score >= 5 && score < 7) { scoreTextColor = "text-violet-600 dark:text-violet-400"; starCount = 3; }
    else if (score >= 0 && score < 5) { scoreTextColor = "text-orange-600 dark:text-orange-400"; starCount = 0; }


    return (<div className="flex items-center"><span className={cn("font-semibold", scoreTextColor)}>{score}</span> {starCount > 0 && <StarRating score={score} maxStars={5} />} {starCount === 0 && score >=0 && <span className="text-xs text-orange-500 ml-1">({score}đ)</span>}</div>);
};

const StarRating = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
    const starColor = "text-green-500 dark:text-green-400";
    if (score >= 9 && score <= 10) numStars = 5;
    else if (score >= 7 && score < 9) numStars = 4;
    else if (score >= 5 && score < 7) numStars = 3;
    else numStars = 0; 
    if (numStars === 0) return null;
    return (
      <div className="flex items-center ml-1">
        {[...Array(numStars)].map((_, i) => <Star key={i} className={cn("h-3 w-3 fill-current", starColor)} />)}
        {[...Array(maxStars - numStars)].map((_, i) => <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300 dark:text-gray-600" />)}
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

const getLessonMasteryTextAndColor = (masteryText: string | undefined, isTrulyMastered?: boolean): {text: string, className: string} => {
    const defaultText = "Chưa đánh giá";
    if (!masteryText || masteryText.includes("Chưa chọn hình thức KT") || masteryText.includes("Chưa có điểm/Chưa đánh giá")) {
        return {text: masteryText || defaultText, className: "text-muted-foreground"};
    }
    if (masteryText.includes("Không có KT bài")) return {text: masteryText, className: "text-muted-foreground font-normal"};
    if (masteryText.includes("Không thuộc bài")) return {text: masteryText, className: "text-red-600 dark:text-red-400 font-medium"};
    if (isTrulyMastered) return {text: masteryText, className: "text-blue-600 dark:text-blue-400 font-medium"};
    return {text: masteryText, className: "text-orange-500 dark:text-orange-400 font-medium"};
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
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false }; // General for scores not fitting above
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT miệng") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false }; // General for scores not fitting above
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") {
    return { text: "Không có KT bài", isTrulyMastered: false }; // isTrulyMastered for these might not be relevant
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};


    