"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parse, parseISO, isValid, addMonths, addDays, getDay, startOfMonth, endOfMonth, differenceInCalendarDays, addWeeks, isSameDay, subDays, formatISO, isBefore as dateIsBefore, isAfter as dateIsAfter } from 'date-fns';
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
  DialogHeader as ShadDialogHeaderOriginal, // Keep original import alias
  DialogTitle as ShadDialogTitleOriginal,   // Keep original import alias
  DialogDescription as ShadDialogDescriptionOriginal, // Keep original import alias
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
import { cn, calculateCycleDisplayRange, formatCurrencyVND } from '@/lib/utils'; // Ensure calculateCycleDisplayRange is imported
import { CalendarIcon, ClipboardList, Edit, Printer, Save, Trash2, Star, Loader2, AlertCircle, BookCopy, FileText as IconFileText, Edit3, Info } from 'lucide-react';


// Use the originally aliased Dialog components
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
  return isEmpty;
};


export default function PhieuLienLacPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);

  // Global selectors
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

  // State for "Theo chu kỳ" (periodic slips) - Input/View Mode
  const [periodicSlipStudent, setPeriodicSlipStudent] = useState<HocSinh | null>(null);
  const [allDailySlipsForPeriodic, setAllDailySlipsForPeriodic] = useState<PhieuLienLacRecord[]>([]);
  const [isLoadingPeriodicSlipRecords, setIsLoadingPeriodicSlipRecords] = useState(false);
  const [periodicSlipSummaryRemark, setPeriodicSlipSummaryRemark] = useState<string>("");
  const [periodicSlipDateRangeText, setPeriodicSlipDateRangeText] = useState<string>("N/A");
  const [slipIdToUpdateForPeriodicRemark, setSlipIdToUpdateForPeriodicRemark] = useState<string | null>(null);
  
  // Modals
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [currentSlipDataForModal, setCurrentSlipDataForModal] = useState<PhieuLienLacRecord | null>(null);
  const [isPeriodicSlipModalOpen, setIsPeriodicSlipModalOpen] = useState(false);

  const slipDialogContentRef = useRef<HTMLDivElement>(null);
  const periodicSlipDialogContentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setIsClient(true);
    // Set selectedDate to today only on client mount
    if (!selectedDate) {
        setSelectedDate(new Date());
    }
    console.log(`[PLLPage] PhieuLienLacPage mounted or updated - ${new Date().toLocaleTimeString()}`);
  }, []); // Empty dependency array ensures this runs once on mount

  const memoizedFormattedSelectedDateKey = useMemo(() => {
    if (!selectedDate) return '';
    try {
      return format(selectedDate, 'yyyy-MM-dd');
    } catch (e) {
      console.error("[PLLPage] Error formatting selectedDate for key:", e);
      return new Date().toISOString().split('T')[0]; // Fallback, should not happen if selectedDate is always a valid Date or null
    }
  }, [selectedDate]);

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 0, // Fetch fresh data for classes
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
    enabled: !!selectedClassId && !!selectedDate && !!memoizedFormattedSelectedDateKey && isClient && mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay',
  });
  
  const { data: allClassSlips = [], isLoading: isLoadingAllClassSlips, isError: isErrorAllClassSlipsData, error: errorAllClassSlips } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['allClassSlipsForPLLPage', selectedClassId],
    queryFn: () => getAllPhieuLienLacRecordsForClass(selectedClassId),
    enabled: !!selectedClassId && isClient && mainActiveTab === 'lich-su' && subActiveTabLichSu === 'lich-su-theo-ngay',
  });

  const { data: allSlipsWithPeriodicRemarks = [], isLoading: isLoadingAllSlipsWithRemarks, isError: isErrorAllSlipsWithRemarks, error: errorLoadingPeriodicRemarks } = useQuery<PhieuLienLacRecord[], Error>({
    queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId],
    queryFn: () => getAllSlipsWithPeriodicRemarksForClass(selectedClassId),
    enabled: !!selectedClassId && isClient && mainActiveTab === 'lich-su' && subActiveTabLichSu === 'lich-su-theo-chu-ky',
  });

  // Main useEffect for syncing Firestore data to local slip input state
  useEffect(() => {
    console.log(`[PLLPage] Main useEffect triggered. DateKey: ${memoizedFormattedSelectedDateKey}, ClassId: ${selectedClassId}, isClient: ${isClient}, isLoadingStudents: ${isLoadingStudents}, isLoadingExistingSlips: ${isLoadingExistingSlips}`);
    console.log(`[PLLPage] Dependencies: existingSlipsData count: ${existingSlipsData?.length || 0}, studentsInSelectedClass count: ${studentsInSelectedClass?.length || 0}`);

    if (!isClient || isLoadingStudents || isLoadingExistingSlips || !selectedClassId || !studentsInSelectedClass) {
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
      console.log(`[PLLPage] Main useEffect: Student ${student.id} (${student.hoTen}), existingSlip from DB:`, existingDbSlip);

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
        newInputsFromEffect[student.id] = entryFromDb;
        
        if (!isSlipInputEmpty(entryFromDb)) {
            newInitialLoadedIdsFromEffect.add(student.id);
            console.log(`[PLLPage] Main useEffect: Student ${student.id} added to initialLoadedIds.`);
        }
        if (!commonHwInitializedFromDb && (existingDbSlip.homeworkAssignmentVocabulary || existingDbSlip.homeworkAssignmentTasks)) {
          commonVocabFromDb = existingDbSlip.homeworkAssignmentVocabulary || "";
          commonTasksFromDb = existingDbSlip.homeworkAssignmentTasks || "";
          commonHwInitializedFromDb = true;
        }
      } else {
        const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, '');
        newInputsFromEffect[student.id] = {
          testFormat: "", score: '', lessonMasteryText: masteryDetailsForEmpty.text,
          masteredLesson: false, homeworkStatus: "", vocabularyToReview: '', remarks: '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks,
        };
      }
    });
    
    // Preserve current edits if a student is being edited
    if (editingStudentId && studentSlipInputs[editingStudentId]) {
      console.log(`[PLLPage] Main useEffect: Preserving edits for student ${editingStudentId}`);
      newInputsFromEffect[editingStudentId] = studentSlipInputs[editingStudentId];
    }

    if (commonHwInitializedFromDb) {
      if (commonHomeworkVocabulary !== commonVocabFromDb) setCommonHomeworkVocabulary(commonVocabFromDb);
      if (commonHomeworkTasks !== commonTasksFromDb) setCommonHomeworkTasks(commonTasksFromDb);
      // Ensure all entries (even new ones) get the common HW from DB if it was set
      Object.keys(newInputsFromEffect).forEach(studentId => {
        if (newInputsFromEffect[studentId]) {
          newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonVocabFromDb;
          newInputsFromEffect[studentId].homeworkAssignmentTasks = commonTasksFromDb;
        }
      });
    } else if (existingSlipsData.length === 0 && studentsInSelectedClass.length > 0) {
        // If no existing slips for the day, but students are present, ensure common HW (from state) is applied to new entries
        Object.keys(newInputsFromEffect).forEach(studentId => {
            if (newInputsFromEffect[studentId]) {
                newInputsFromEffect[studentId].homeworkAssignmentVocabulary = commonHomeworkVocabulary;
                newInputsFromEffect[studentId].homeworkAssignmentTasks = commonHomeworkTasks;
            }
        });
    }


    if (JSON.stringify(studentSlipInputs) !== JSON.stringify(newInputsFromEffect)) {
        console.log("[PLLPage] Main useEffect: studentSlipInputs changed. Updating state.", { current: studentSlipInputs, new: newInputsFromEffect });
        setStudentSlipInputs(newInputsFromEffect);
    } else {
        console.log("[PLLPage] Main useEffect: studentSlipInputs are the same. Skipping update.");
    }

    if (JSON.stringify(Array.from(initialLoadedStudentSlipIds).sort()) !== JSON.stringify(Array.from(newInitialLoadedIdsFromEffect).sort())) {
        console.log("[PLLPage] Main useEffect: initialLoadedStudentSlipIds changed. Updating state.");
        setInitialLoadedStudentSlipIds(newInitialLoadedIdsFromEffect);
    }
  }, [existingSlipsData, studentsInSelectedClass, isLoadingStudents, isLoadingExistingSlips, isClient, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks, editingStudentId]);


  // Effect for resetting local states when class or date changes
  useEffect(() => {
    if (!isClient) return;
    console.log(`[PLLPage] Date or Class changed. Resetting local states. New DateKey: ${memoizedFormattedSelectedDateKey}, New ClassId: ${selectedClassId}`);
    setStudentSlipInputs({});
    setInitialLoadedStudentSlipIds(new Set());
    setEditingStudentId(null);
    // setCommonHomeworkVocabulary(""); // Decide if common HW should reset on date/class change
    // setCommonHomeworkTasks("");

    if (selectedClassId && memoizedFormattedSelectedDateKey) {
      queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
    }
    if(selectedClassId) {
      refetchStudentsInClass();
      queryClient.invalidateQueries({ queryKey: ['allClassSlipsForPLLPage', selectedClassId]});
      queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] });
    }
  }, [memoizedFormattedSelectedDateKey, selectedClassId, isClient]); 

  const handleSlipInputChange = useCallback((studentId: string, field: keyof StudentSlipInput, value: any) => {
    setStudentSlipInputs(prev => {
      const currentEntry = prev[studentId] || { 
          score: '', vocabularyToReview: '', remarks: '',
          homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks,           
          testFormat: "", homeworkStatus: "", masteredLesson: false, lessonMasteryText: ""
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
      console.log(`[PLLPage] handleSlipInputChange: Setting editingStudentId to ${studentId} because it's a new/unloaded entry.`);
      setEditingStudentId(studentId);
    }
  }, [commonHomeworkVocabulary, commonHomeworkTasks]); // Removed editingStudentId, initialLoadedStudentSlipIds

  const studentsForEntryTab = useMemo(() => {
    console.log("[PLLPage] studentsForEntryTab useMemo. editingStudentId:", editingStudentId, ", initialLoadedStudentSlipIds:", initialLoadedStudentSlipIds);
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    if (editingStudentId) {
      const studentBeingEdited = studentsInSelectedClass.find(s => s.id === editingStudentId);
      console.log("[PLLPage] Students for EntryTab (editing):", studentBeingEdited ? [studentBeingEdited.hoTen] : "None");
      return studentBeingEdited ? [studentBeingEdited] : [];
    }
    const result = studentsInSelectedClass.filter(student => !initialLoadedStudentSlipIds.has(student.id) || isSlipInputEmpty(studentSlipInputs[student.id]));
    console.log("[PLLPage] Students for EntryTab (not editing, count:", result.length, "):", result.map(s => s.id));
    return result;
  }, [studentsInSelectedClass, studentSlipInputs, initialLoadedStudentSlipIds, editingStudentId, isLoadingStudents]);

  const studentsForDailyHistoryTab = useMemo(() => {
    console.log("[PLLPage] studentsForDailyHistoryTab useMemo. initialLoadedStudentSlipIds:", initialLoadedStudentSlipIds, "editingStudentId:", editingStudentId);
    if (isLoadingAllClassSlips || !allClassSlips) return [];
    const result = allClassSlips.filter(slip => slip.studentId !== editingStudentId); // Don't show if being edited
    console.log("[PLLPage] Result for studentsForDailyHistoryTab (count:", result.length, "):", result.map(s => ({id:s.id, date:s.date, studentId:s.studentId})));
    return result;
  }, [allClassSlips, editingStudentId, isLoadingAllClassSlips]);
  
  const studentsToListInPeriodicTabs = useMemo(() => {
    if (isLoadingStudents || !studentsInSelectedClass) return [];
    return studentsInSelectedClass;
  }, [studentsInSelectedClass, isLoadingStudents]);

  const studentsForNhanXetChuKyTab = useMemo(() => {
    if (isLoadingStudents || !studentsToListInPeriodicTabs || isLoadingAllSlipsWithRemarks) return [];
    
    const idsWithRemarks = new Set(
      (Array.isArray(allSlipsWithPeriodicRemarks) ? allSlipsWithPeriodicRemarks : [])
        .filter(slip => slip.periodicSummaryRemark && slip.periodicSummaryRemark.trim() !== "")
        .map(slip => slip.studentId)
    );

    return studentsToListInPeriodicTabs.map(student => {
      const studentClassDetails = classes.find(c => c.id === student.lopId);
      const cycleDisplay = studentClassDetails ? calculateCycleDisplayRange(student, studentClassDetails, undefined) : "N/A (Lỗi lớp)";
      const needsRemark = !idsWithRemarks.has(student.id);

      if(selectedDate && studentClassDetails) {
        const { startDate: currentCycleStartDate } = parseCycleRangeStringToDates(cycleDisplay);
        const latestRemarkSlipForStudent = allSlipsWithPeriodicRemarks
            .filter(s => s.studentId === student.id)
            .sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];
        
        if (latestRemarkSlipForStudent && currentCycleStartDate && dateIsBefore(parseISO(latestRemarkSlipForStudent.date), currentCycleStartDate)) {
           // Remark is from a previous cycle, student needs new remark for current cycle
           if (!needsRemark) return { ...student, displayCycle: cycleDisplay, needsRemark: true }; // Override
        }
      }
      return { ...student, displayCycle: cycleDisplay, needsRemark };
    }).filter(s => s.needsRemark);
  }, [studentsToListInPeriodicTabs, allSlipsWithPeriodicRemarks, classes, isLoadingStudents, isLoadingAllSlipsWithRemarks, selectedDate]);


  const studentsForLichSuChuKyTab = useMemo(() => {
    if (isLoadingStudents || !studentsToListInPeriodicTabs || isLoadingAllSlipsWithRemarks) return [];
     const idsWithRemarks = new Set(
      (Array.isArray(allSlipsWithPeriodicRemarks) ? allSlipsWithPeriodicRemarks : [])
      .filter(slip => slip.periodicSummaryRemark && slip.periodicSummaryRemark.trim() !== "")
      .map(slip => slip.studentId)
    );
    return studentsToListInPeriodicTabs
      .filter(student => idsWithRemarks.has(student.id))
      .map(student => {
        const studentClassDetails = classes.find(c => c.id === student.lopId);
        const cycleDisplay = studentClassDetails ? calculateCycleDisplayRange(student, studentClassDetails, undefined) : "N/A";
        
        const latestRemarkSlip = allSlipsWithPeriodicRemarks
          .filter(slip => slip.studentId === student.id)
          .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];
        
        return {
          ...student,
          lastSlipDateWithRemark: latestRemarkSlip ? latestRemarkSlip.date : undefined,
          displayCycle: cycleDisplay,
        };
      });
  }, [studentsToListInPeriodicTabs, allSlipsWithPeriodicRemarks, classes, isLoadingStudents, isLoadingAllSlipsWithRemarks]);


  const saveSlipsMutation = useMutation({
    mutationFn: (records: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>>) => savePhieuLienLacRecords(records),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: `Phiếu liên lạc hàng ngày đã được lưu cho ${variables.length > 0 ? variables.length : 'một số'} học sinh.` });
      setEditingStudentId(null); 
      if (selectedClassId && memoizedFormattedSelectedDateKey) {
        queryClient.invalidateQueries({ queryKey: ['existingPhieuLienLac', selectedClassId, memoizedFormattedSelectedDateKey] });
      }
      queryClient.invalidateQueries({ queryKey: ['allClassSlipsForPLLPage', selectedClassId]});
      queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] });
      console.log("[PLLPage] saveSlipsMutation onSuccess. Invalidating queries...");
    },
    onError: (error: Error) => { toast({ title: "Lỗi khi lưu phiếu liên lạc hàng ngày", description: `${error.message}. Kiểm tra console server để biết thêm chi tiết.`, variant: "destructive", duration: 7000, }); },
  });

  const handleSaveAllSlips = useCallback(() => {
    console.log("[PLLPage] handleSaveAllSlips called.");
    if (!selectedClassId || !selectedDate) { toast({ title: "Lỗi", description: "Vui lòng chọn lớp và ngày.", variant: "destructive" }); return; }
    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) { toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" }); return; }

    const recordsToSave: Array<Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'>> = [];
    const studentIdsToProcess = new Set<string>(studentsInSelectedClass.map(s => s.id));
    if (editingStudentId) studentIdsToProcess.add(editingStudentId);

    studentIdsToProcess.forEach(studentId => {
        const student = studentsInSelectedClass.find(s => s.id === studentId);
        const input = studentSlipInputs[studentId];
        if (student && input && (student.id === editingStudentId || !isSlipInputEmpty(input) || initialLoadedStudentSlipIds.has(studentId))) {
            const masteryDetails = calculateMasteryDetailsForPLL(input.testFormat, input.score);
            let scoreToSave: number | null = null;
            if(input.score !== undefined && input.score !== null && String(input.score).trim() !== '') { if(!isNaN(Number(input.score))) scoreToSave = Number(input.score); }
            
            const recordPayload: Omit<PhieuLienLacRecord, 'id' | 'createdAt' | 'updatedAt' | 'periodicSummaryRemark'> = {
              studentId: student.id, studentName: student.hoTen, classId: selectedClassId, className: selectedClass.tenLop, 
              date: memoizedFormattedSelectedDateKey, 
              testFormat: input.testFormat || "", score: scoreToSave, 
              lessonMasteryText: masteryDetails.text, masteredLesson: masteryDetails.isTrulyMastered,
              homeworkStatus: input.homeworkStatus || "", 
              vocabularyToReview: input.vocabularyToReview || '', remarks: input.remarks || '',
              homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks,         
            };
            recordsToSave.push(recordPayload);
        }
    });
    console.log("[PLLPage] Records to save:", recordsToSave);
    if (recordsToSave.length === 0) { toast({ title: "Không có gì để lưu", description: "Vui lòng nhập thông tin phiếu liên lạc hoặc thực hiện thay đổi." }); return; }
    saveSlipsMutation.mutate(recordsToSave);
  }, [selectedClassId, selectedDate, classes, studentsInSelectedClass, studentSlipInputs, editingStudentId, initialLoadedStudentSlipIds, saveSlipsMutation, toast, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks]);

  const handleEditSlip = useCallback((slip: PhieuLienLacRecord) => {
    console.log("[PLLPage] handleEditSlip called for slip:", slip.id, "studentId:", slip.studentId);
    const dateToSelect = parseISO(slip.date);
    if (!selectedDate || !isSameDay(selectedDate, dateToSelect)) { 
        console.log("[PLLPage] handleEditSlip: Setting selectedDate to slip date:", slip.date);
        setSelectedDate(dateToSelect); 
    }
    setEditingStudentId(slip.studentId);
    setMainActiveTab('nhap-phieu');
    setSubActiveTabNhapPhieu("theo-ngay");
  }, [selectedDate]);

  const handleDeleteSlipEntry = useCallback((studentId: string) => {
    const studentName = studentsInSelectedClass.find(s=>s.id === studentId)?.hoTen || "học sinh này";
    const masteryDetailsForEmpty = calculateMasteryDetailsForPLL(undefined, null);
    setStudentSlipInputs(prev => ({ ...prev, [studentId]: { testFormat: "", score: null, lessonMasteryText: masteryDetailsForEmpty.text, masteredLesson: masteryDetailsForEmpty.isTrulyMastered, homeworkStatus: "", vocabularyToReview: '', remarks: '', homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks }}));
    setEditingStudentId(studentId); // Keep in edit mode to show the cleared form
    setMainActiveTab('nhap-phieu');
    setSubActiveTabNhapPhieu("theo-ngay");
    toast({ description: `Đã làm rỗng dữ liệu phiếu liên lạc cục bộ cho ${studentName}. Nhấn "Lưu" để cập nhật vào hệ thống.` });
  }, [studentsInSelectedClass, toast, commonHomeworkVocabulary, commonHomeworkTasks]); 

  const handleOpenSlipDialog = useCallback(async (studentIdToOpen: string) => {
    if (!selectedClassId || !selectedDate) { toast({ title: "Lỗi", description: "Vui lòng chọn lớp và ngày.", variant: "destructive" }); return; }
    console.log(`[PLLPage] handleOpenSlipDialog for studentId: ${studentIdToOpen}`);

    const slipForModal = existingSlipsData.find(s => s.studentId === studentIdToOpen && s.date === memoizedFormattedSelectedDateKey) ||
                         allClassSlips.find(s => s.studentId === studentIdToOpen && s.date === memoizedFormattedSelectedDateKey);


    if (!slipForModal) { 
        const currentInput = studentSlipInputs[studentIdToOpen];
        if (currentInput && !isSlipInputEmpty(currentInput)) {
            const student = studentsInSelectedClass.find(s => s.id === studentIdToOpen);
            const selectedClass = classes.find(c => c.id === selectedClassId);
            const tempSlip: PhieuLienLacRecord = {
                id: `temp-${studentIdToOpen}-${memoizedFormattedSelectedDateKey}`,
                studentId: studentIdToOpen,
                studentName: student?.hoTen || "N/A",
                classId: selectedClassId,
                className: selectedClass?.tenLop || "N/A",
                date: memoizedFormattedSelectedDateKey,
                ...currentInput,
                score: currentInput.score === null || currentInput.score === undefined || String(currentInput.score).trim() === '' ? null : Number(currentInput.score),
            };
            setCurrentSlipDataForModal(tempSlip);
            console.log("[PLLPage] handleOpenSlipDialog: Showing temporary slip data from form inputs.", tempSlip);
        } else {
            toast({ title: "Không có dữ liệu", description: `Chưa có phiếu liên lạc cho học sinh này vào ngày ${format(selectedDate, "dd/MM/yyyy")}.`, variant: "default" }); 
            return;
        }
    } else {
        setCurrentSlipDataForModal(slipForModal);
        console.log("[PLLPage] handleOpenSlipDialog: Showing existing slip data.", slipForModal);
    }
    setIsSlipModalOpen(true);
  }, [selectedClassId, selectedDate, existingSlipsData, allClassSlips, memoizedFormattedSelectedDateKey, toast, studentSlipInputs, studentsInSelectedClass, classes]); 
  
  const savePeriodicRemarkMutation = useMutation({
    mutationFn: (data: { slipId: string, summaryRemark: string }) => updatePeriodicSummaryForSlip(data.slipId, data.summaryRemark),
    onSuccess: (data, variables) => {
      toast({ title: "Thành công!", description: "Nhận xét tổng hợp đã được lưu." });
      if (selectedClassId){ queryClient.invalidateQueries({ queryKey: ['allSlipsWithPeriodicRemarks', selectedClassId] }); }
      setAllDailySlipsForPeriodic(prevSlips => prevSlips.map(slip => slip.id === variables.slipId ? { ...slip, periodicSummaryRemark: variables.summaryRemark } : slip));
      setIsPeriodicSlipModalOpen(false); 
    },
    onError: (error: Error) => { toast({ title: "Lỗi", description: `Không thể lưu nhận xét tổng hợp: ${error.message}. Kiểm tra console server để biết chi tiết.`, variant: "destructive" }); },
  });

  const handleSavePeriodicRemark = useCallback(() => {
    if (!periodicSlipStudent || !slipIdToUpdateForPeriodicRemark) { toast({ title: "Lỗi", description: "Không có thông tin phiếu hoặc phiếu cuối cùng để lưu nhận xét.", variant: "destructive" }); return; }
    console.log(`[PLLPage] handleSavePeriodicRemark: Saving remark for slipId ${slipIdToUpdateForPeriodicRemark}`);
    savePeriodicRemarkMutation.mutate({ slipId: slipIdToUpdateForPeriodicRemark, summaryRemark: periodicSlipSummaryRemark });
  }, [periodicSlipStudent, slipIdToUpdateForPeriodicRemark, periodicSlipSummaryRemark, savePeriodicRemarkMutation, toast]);

  const handleOpenPeriodicSlipDialog = useCallback(async (student: HocSinh) => {
    console.log(`[PLLPage] handleOpenPeriodicSlipDialog for student: ${student.hoTen} (ID: ${student.id}) in class ${selectedClassId}`);
    if (!selectedClassId || !classes || classes.length === 0) { toast({ title: "Lỗi", description: "Vui lòng chọn lớp trước.", variant: "destructive"}); return; }
    
    setIsLoadingPeriodicSlipRecords(true);
    setPeriodicSlipStudent(student);
    setPeriodicSlipSummaryRemark(""); 
    setSlipIdToUpdateForPeriodicRemark(null);

    try {
      const studentClassForDialog = classes.find(cls => cls.id === student.lopId);
      if (!studentClassForDialog) { toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp của học sinh.", variant: "destructive"}); setIsLoadingPeriodicSlipRecords(false); return; }
      
      const fetchedStudentSlipsInRange = await getPhieuLienLacRecordsForStudentInRange(student.id, student.lopId);
      const sortedSlips = fetchedStudentSlipsInRange.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      setAllDailySlipsForPeriodic(sortedSlips);
      
      const { startDate: currentCycleStartDate, endDate: currentCycleEndDate } = parseCycleRangeStringToDates(calculateCycleDisplayRange(student, studentClassForDialog, undefined));
      setPeriodicSlipDateRangeText(calculateCycleDisplayRange(student, studentClassForDialog, sortedSlips));
      console.log(`[PLLPage] Calculated date range for periodic slip for ${student.hoTen}: Start ${currentCycleStartDate ? format(currentCycleStartDate, "yyyy-MM-dd") : 'N/A'}, End ${currentCycleEndDate ? format(currentCycleEndDate, "yyyy-MM-dd") : 'N/A'}`);

      if (sortedSlips.length > 0) {
        // Find the last slip within the *current theoretical cycle* to attach the remark
        const slipsInCurrentTheoreticalCycle = sortedSlips.filter(s => {
            if (!currentCycleStartDate || !currentCycleEndDate) return true; // if cycle dates are unknown, consider all slips
            const slipDateObj = parseISO(s.date);
            return isValid(slipDateObj) && !dateIsBefore(slipDateObj, currentCycleStartDate) && !dateIsAfter(slipDateObj, currentCycleEndDate);
        });

        console.log(`[PLLPage] Slips in current theoretical cycle for ${student.hoTen}:`, slipsInCurrentTheoreticalCycle.length);

        if (slipsInCurrentTheoreticalCycle.length > 0) {
          const lastSlipInCycle = slipsInCurrentTheoreticalCycle[slipsInCurrentTheoreticalCycle.length - 1];
          setSlipIdToUpdateForPeriodicRemark(lastSlipInCycle.id);
          if (lastSlipInCycle.periodicSummaryRemark && lastSlipInCycle.periodicSummaryRemark.trim() !== "") { 
            setPeriodicSlipSummaryRemark(lastSlipInCycle.periodicSummaryRemark); 
            console.log(`[PLLPage] Found existing periodic remark for slip ${lastSlipInCycle.id}: "${lastSlipInCycle.periodicSummaryRemark}"`);
          } else {
            console.log(`[PLLPage] No existing periodic remark for slip ${lastSlipInCycle.id}. Textarea will be empty.`);
          }
        } else {
            console.log(`[PLLPage] No daily slips found within the current theoretical cycle for ${student.hoTen}. Cannot determine slipId for remark.`);
        }
      } else {
         console.log(`[PLLPage] No daily slips found at all for student ${student.hoTen}. Cannot determine slipId for remark.`);
      }
      setIsPeriodicSlipModalOpen(true);
    } catch (error) {
       const errorMsg = (error as Error).message || "Không thể tải dữ liệu phiếu chu kỳ.";
       toast({ title: "Lỗi tải dữ liệu phiếu chu kỳ", description: `${errorMsg}. Check YOUR SERVER CONSOLE (Firebase Studio terminal) for specific Firebase errors (e.g., missing index, permissions).`, variant: "destructive", duration: 10000, });
    } finally { setIsLoadingPeriodicSlipRecords(false); }
  }, [selectedClassId, classes, toast]); 

  const selectedClassDetails = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  
  const canSaveChangesDaily = useMemo(() => {
    if (saveSlipsMutation.isPending) return false;
    if (editingStudentId && studentSlipInputs[editingStudentId] ) {
        const originalSlip = existingSlipsData.find(s => s.studentId === editingStudentId && s.date === memoizedFormattedSelectedDateKey);
        const currentInput = studentSlipInputs[editingStudentId];
        
        const originalMasteryDetails = calculateMasteryDetailsForPLL(originalSlip?.testFormat, originalSlip?.score);
        const currentMasteryDetails = calculateMasteryDetailsForPLL(currentInput?.testFormat, currentInput?.score);

        const originalSlipComparable: StudentSlipInput = originalSlip ? {
            testFormat: originalSlip.testFormat || "", score: originalSlip.score === null || originalSlip.score === undefined ? '' : String(originalSlip.score),
            lessonMasteryText: originalMasteryDetails.text, masteredLesson: originalMasteryDetails.isTrulyMastered,
            homeworkStatus: originalSlip.homeworkStatus || "", vocabularyToReview: originalSlip.vocabularyToReview || '', remarks: originalSlip.remarks || '',
            homeworkAssignmentVocabulary: originalSlip.homeworkAssignmentVocabulary || commonHomeworkVocabulary, homeworkAssignmentTasks: originalSlip.homeworkAssignmentTasks || commonHomeworkTasks,
        } : { testFormat: "", score: '', lessonMasteryText: "", masteredLesson: false, homeworkStatus: "", vocabularyToReview: '', remarks: '', homeworkAssignmentVocabulary: commonHomeworkVocabulary, homeworkAssignmentTasks: commonHomeworkTasks };
        
        if(JSON.stringify(currentInput) !== JSON.stringify(originalSlipComparable)) return true;
    }
    const hasNewOrModifiedEntries = studentsInSelectedClass.some(student => {
      if(student.id === editingStudentId) return false; 
      const input = studentSlipInputs[student.id];
      return input && !isSlipInputEmpty(input);
    });
    return hasNewOrModifiedEntries;
  }, [studentSlipInputs, editingStudentId, saveSlipsMutation.isPending, studentsInSelectedClass, existingSlipsData, memoizedFormattedSelectedDateKey, commonHomeworkVocabulary, commonHomeworkTasks]);

  const saveButtonText = useMemo(() => {
    if (mainActiveTab === 'nhap-phieu') {
        if (subActiveTabNhapPhieu === 'theo-ngay') return "Lưu Phiếu Ngày";
        if (subActiveTabNhapPhieu === 'theo-chu-ky') return "Lưu Nhận Xét Chu Kỳ"; // This button is actually inside the dialog now
    }
    return "Lưu"; 
  }, [mainActiveTab, subActiveTabNhapPhieu]);

  const handleGlobalSave = () => {
    if (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay') {
      handleSaveAllSlips();
    }
    // Saving for 'theo-chu-ky' is handled inside its dialog now.
  };

  const isSaveButtonDisabled = () => {
    if (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay') {
      return saveSlipsMutation.isPending || !canSaveChangesDaily;
    }
    // Save button in main footer is not used for 'theo-chu-ky' input anymore
    if (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-chu-ky') {
      return true; 
    }
    return true;
  };

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
            <CardTitle>Chọn Lớp</CardTitle>
             <CardDescription>Chọn lớp để bắt đầu quản lý phiếu liên lạc.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-select-pll">Lớp</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingClasses}>
                <SelectTrigger id="class-select-pll" aria-label="Chọn lớp">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn lớp học"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((lop) => <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={mainActiveTab} onValueChange={(value) => setMainActiveTab(value as 'nhap-phieu' | 'lich-su')} className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:max-w-lg grid-cols-2 mb-6 bg-primary/10 p-1 rounded-lg">
            <TabsTrigger value="nhap-phieu" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Nhập Phiếu</TabsTrigger>
            <TabsTrigger value="lich-su" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch Sử</TabsTrigger>
          </TabsList>

          <TabsContent value="nhap-phieu">
            <Card className="shadow-md">
              <CardHeader>
                <Tabs value={subActiveTabNhapPhieu} onValueChange={(value) => setSubActiveTabNhapPhieu(value as 'theo-ngay' | 'theo-chu-ky')}>
                  <TabsList className="grid w-full sm:w-auto sm:max-w-sm grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                    <TabsTrigger value="theo-ngay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo ngày</TabsTrigger>
                    <TabsTrigger value="theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo chu kỳ</TabsTrigger>
                  </TabsList>
                  
                  {subActiveTabNhapPhieu === 'theo-ngay' && (
                    <>
                      <Card className="mb-6 shadow-sm">
                        <CardHeader>
                          <CardTitle>Thông tin chung & Bài tập về nhà</CardTitle>
                           <div className="mt-4 space-y-2">
                            <Label htmlFor="date-select-pll-daily">Chọn Ngày</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button id="date-select-pll-daily" variant={"outline"} className={cn("w-full md:w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")} disabled={!selectedClassId}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate || undefined} onSelect={(d) => d && setSelectedDate(d)} initialFocus locale={vi} /></PopoverContent>
                            </Popover>
                          </div>
                          <CardDescription className="mt-2">Lớp: {selectedClassDetails?.tenLop || <Skeleton className="h-5 w-24 inline-block" />} | Ngày: {selectedDate ? format(selectedDate, "dd/MM/yyyy", {locale: vi}) : "N/A"}</CardDescription>
                        </CardHeader>
                         <CardContent className="space-y-4">
                          <div><Label htmlFor="common-hw-vocab">Từ vựng cần học (Chung cho cả lớp)</Label><Textarea id="common-hw-vocab" placeholder="VD: Unit 1 - Vocabulary List A, B, C..." value={commonHomeworkVocabulary} onChange={(e) => setCommonHomeworkVocabulary(e.target.value)} rows={2}/></div>
                          <div><Label htmlFor="common-hw-tasks">Bài tập làm tại nhà (Chung cho cả lớp)</Label><Textarea id="common-hw-tasks" placeholder="VD: Workbook trang 10-12..." value={commonHomeworkTasks} onChange={(e) => setCommonHomeworkTasks(e.target.value)} rows={2}/></div>
                        </CardContent>
                      </Card>
                      {/* Content for Nhập Phiếu > Theo ngày */}
                      <TabsContent value="theo-ngay">
                          {isErrorClasses && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách lớp.</div>}
                          {selectedClassId && isErrorStudents && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải danh sách học sinh cho lớp này.</div>}
                          {selectedClassId && selectedDate && isErrorExistingSlips && <div className="p-4 text-destructive text-center border border-destructive/50 bg-destructive/10 rounded-md shadow-sm"><AlertCircle className="inline mr-2 h-5 w-5"/>Lỗi tải lịch sử phiếu liên lạc đã có.<p className="text-xs text-muted-foreground mt-1">{(errorExistingSlips as Error)?.message || "Không thể tải dữ liệu."} { (errorExistingSlips as Error)?.message?.includes("index") ? "Kiểm tra console server Next.js." : ""}</p></div>}

                          {(isLoadingStudents || (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay' && isLoadingExistingSlips)) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                          {!(isLoadingStudents || (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay' && isLoadingExistingSlips)) && selectedClassId && studentsInSelectedClass.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                          {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để bắt đầu.</p>}
                          {!(isLoadingStudents || (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay' && isLoadingExistingSlips)) && selectedClassId && studentsInSelectedClass.length > 0 && !selectedDate && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn ngày.</p>}
                          
                          {!(isLoadingStudents || (mainActiveTab === 'nhap-phieu' && subActiveTabNhapPhieu === 'theo-ngay' && isLoadingExistingSlips)) && selectedClassId && selectedDate && studentsInSelectedClass.length > 0 && (
                            <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[150px] sticky top-0 bg-card z-10">Học sinh</TableHead><TableHead className="w-[180px] sticky top-0 bg-card z-10">Hình thức KT</TableHead><TableHead className="w-[100px] sticky top-0 bg-card z-10">Điểm</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Thuộc bài?</TableHead><TableHead className="w-[200px] sticky top-0 bg-card z-10">Bài tập về nhà</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Từ vựng cần học lại</TableHead><TableHead className="min-w-[200px] sticky top-0 bg-card z-10">Nhận xét</TableHead></TableRow></TableHeader><TableBody>
                                {studentsForEntryTab.map((student) => {
                                  const currentInput = studentSlipInputs[student.id] || {};
                                  const masteryDetails = calculateMasteryDetailsForPLL(currentInput.testFormat, currentInput.score);
                                  return (<TableRow key={`entry-${student.id}`}><TableCell className="font-medium">{student.hoTen}</TableCell><TableCell><Select value={currentInput.testFormat || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'testFormat', value as TestFormatPLC)}><SelectTrigger aria-label={`Hình thức KT cho ${student.hoTen}`}><SelectValue placeholder="Chọn hình thức" /></SelectTrigger><SelectContent>{ALL_TEST_FORMATS_PLC.map(formatValue => <SelectItem key={formatValue} value={formatValue}>{formatValue}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Input type="text" placeholder="VD: 8" value={currentInput.score || ''} onChange={(e) => handleSlipInputChange(student.id, 'score', e.target.value)} className="w-20" aria-label={`Điểm cho ${student.hoTen}`}/></TableCell><TableCell className={cn("font-medium", getLessonMasteryTextAndColor(masteryDetails.text, masteryDetails.isTrulyMastered).className)}>{masteryDetails.text}</TableCell><TableCell><Select value={currentInput.homeworkStatus || ""} onValueChange={(value) => handleSlipInputChange(student.id, 'homeworkStatus', value as HomeworkStatusPLC)}><SelectTrigger aria-label={`Bài tập về nhà cho ${student.hoTen}`}><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger><SelectContent>{ALL_HOMEWORK_STATUSES_PLC.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select></TableCell><TableCell><Textarea value={currentInput.vocabularyToReview || ''} onChange={(e) => handleSlipInputChange(student.id, 'vocabularyToReview', e.target.value)} placeholder="Từ vựng..." rows={1} aria-label={`Từ vựng cần học lại cho ${student.hoTen}`}/></TableCell><TableCell><Textarea value={currentInput.remarks || ''} onChange={(e) => handleSlipInputChange(student.id, 'remarks', e.target.value)} placeholder="Nhận xét..." rows={1} aria-label={`Nhận xét cho ${student.hoTen}`}/></TableCell></TableRow>);
                                })}
                              </TableBody></Table></ScrollArea>
                          )}
                      </TabsContent>
                    </>
                  )}
                  {/* Content for Nhập Phiếu > Theo chu kỳ */}
                  <TabsContent value="theo-chu-ky">
                      <CardDescription className="mb-4">Chọn học sinh để nhập/cập nhật nhận xét tổng hợp cho chu kỳ hiện tại của họ.</CardDescription>
                      {(isLoadingStudents || !selectedClassId) && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> {isLoadingStudents ? "Đang tải học sinh..." : "Vui lòng chọn lớp."}</div>}
                      {!isLoadingStudents && selectedClassId && studentsToListInPeriodicTabs.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                      {!isLoadingStudents && studentsToListInPeriodicTabs.length > 0 && (
                        <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Chu kỳ (ước tính)</TableHead><TableHead className="text-right w-[220px]">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                              {studentsToListInPeriodicTabs.map((student, index) => (
                                <TableRow key={`periodic-entry-${student.id}`}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell className="font-medium">{student.hoTen}</TableCell>
                                  <TableCell>{student.id}</TableCell>
                                  <TableCell>{student.displayCycle || "N/A"}</TableCell>
                                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Nhập/Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}>{isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id ? <Loader2 className="animate-spin h-4 w-4 mr-2"/> : <IconFileText className="h-4 w-4 mr-2" />}Nhập/Sửa Nhận Xét</Button></TableCell>
                                </TableRow>
                              ))}
                            </TableBody></Table></ScrollArea>
                      )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
              {mainActiveTab === 'nhap-phieu' && selectedClassId && (
                  <CardFooter className="border-t pt-6">
                    <Button onClick={handleGlobalSave} disabled={isSaveButtonDisabled()}>{ (saveSlipsMutation.isPending || savePeriodicRemarkMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saveButtonText}</Button>
                     {subActiveTabNhapPhieu === 'theo-ngay' && editingStudentId && (<Button variant="ghost" onClick={() => {setEditingStudentId(null);}} className="ml-2" disabled={saveSlipsMutation.isPending}>Hủy Sửa</Button>)}
                  </CardFooter>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="lich-su">
            <Card className="shadow-md">
              <CardHeader>
                <Tabs value={subActiveTabLichSu} onValueChange={(value) => setSubActiveTabLichSu(value as 'lich-su-theo-ngay' | 'lich-su-theo-chu-ky')}>
                  <TabsList className="grid w-full sm:w-auto sm:max-w-md grid-cols-2 mb-4 bg-primary/10 p-1 rounded-lg">
                    <TabsTrigger value="lich-su-theo-ngay" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử theo ngày</TabsTrigger>
                    <TabsTrigger value="lich-su-theo-chu-ky" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch sử theo chu kỳ</TabsTrigger>
                  </TabsList>
                  
                  {/* Content for Lịch Sử > Lịch sử theo ngày */}
                  <TabsContent value="lich-su-theo-ngay">
                     <CardDescription className="mb-4">Hiển thị tất cả phiếu liên lạc hàng ngày đã lưu cho lớp "{selectedClassDetails?.tenLop || 'N/A'}".</CardDescription>
                      {(isLoadingAllClassSlips) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải lịch sử phiếu...</div>}
                      {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để xem lịch sử.</p>}
                      {selectedClassId && !isLoadingAllClassSlips && isErrorAllClassSlipsData && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử phiếu: {errorAllClassSlips?.message}</div>}
                      {selectedClassId && !isLoadingAllClassSlips && !isErrorAllClassSlipsData && allClassSlips.length === 0 && <p className="text-muted-foreground p-4 text-center">Chưa có phiếu liên lạc nào được lưu cho lớp này.</p>}
                      {selectedClassId && !isLoadingAllClassSlips && !isErrorAllClassSlipsData && allClassSlips.length > 0 && (
                         <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[100px]">Ngày</TableHead><TableHead>Học sinh</TableHead><TableHead>Hình thức KT</TableHead><TableHead>Điểm</TableHead><TableHead>Thuộc bài?</TableHead><TableHead>Bài tập về nhà</TableHead><TableHead className="text-right w-[180px]">Hành động</TableHead></TableRow></TableHeader><TableBody>
                            {studentsForDailyHistoryTab.map((slip) => {
                              if(!slip) return null; 
                              const masteryDetails = calculateMasteryDetailsForPLL(slip.testFormat, slip.score);
                              const homeworkDisplay = getHomeworkStatusTextAndColor(slip.homeworkStatus);
                              const lessonMasteryDisplay = getLessonMasteryTextAndColor(masteryDetails.text, slip.masteredLesson);
                              return (<TableRow key={`hist-daily-${slip.id}`}><TableCell>{format(parseISO(slip.date), "dd/MM/yy")}</TableCell><TableCell className="font-medium">{slip.studentName}</TableCell><TableCell>{slip.testFormat || 'N/A'}</TableCell><TableCell>{renderScoreDisplay(slip.score)}</TableCell><TableCell className={cn("font-medium", lessonMasteryDisplay.className)}>{lessonMasteryDisplay.text}</TableCell><TableCell className={cn(homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell><TableCell className="text-right"><div className="flex gap-2 justify-end"><Button variant="outline" size="icon" onClick={() => handleEditSlip(slip)} aria-label="Sửa phiếu" disabled={saveSlipsMutation.isPending}><Edit3 className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleDeleteSlipEntry(slip.studentId)} aria-label="Xóa phiếu (cục bộ)" disabled={saveSlipsMutation.isPending}><Trash2 className="h-4 w-4" /></Button><Button variant="default" size="icon" onClick={() => handleOpenSlipDialog(slip.studentId)} aria-label="Xem/Xuất phiếu ngày" disabled={saveSlipsMutation.isPending}><Printer className="h-4 w-4" /></Button></div></TableCell></TableRow>);
                            })}
                          </TableBody></Table></ScrollArea>
                      )}
                  </TabsContent>
                  
                  {/* Content for Lịch Sử > Lịch sử theo chu kỳ */}
                  <TabsContent value="lich-su-theo-chu-ky">
                    <CardDescription className="mb-4">Danh sách các học sinh đã có nhận xét chu kỳ.</CardDescription>
                    {(isLoadingStudents || isLoadingClasses || isLoadingAllSlipsWithRemarks) && selectedClassId && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /> Đang tải...</div>}
                    {!selectedClassId && <p className="text-muted-foreground p-4 text-center">Vui lòng chọn lớp để xem.</p>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && isErrorAllSlipsWithRemarks && <div className="p-4 text-destructive text-center"><AlertCircle className="inline mr-2"/>Lỗi tải lịch sử nhận xét chu kỳ.<p className="text-xs text-muted-foreground mt-1">{(errorLoadingPeriodicRemarks as Error)?.message || "Không thể tải dữ liệu."} { (errorLoadingPeriodicRemarks as Error)?.message?.includes("index") ? "Kiểm tra console server Next.js." : ""}</p></div>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsToListInPeriodicTabs.length === 0 && <p className="text-muted-foreground p-4 text-center">Lớp này chưa có học sinh.</p>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsForLichSuChuKyTab.length === 0 && studentsToListInPeriodicTabs.length > 0 && <p className="text-muted-foreground p-4 text-center">Chưa có học sinh nào có nhận xét chu kỳ được lưu.</p>}
                    {selectedClassId && !isLoadingStudents && !isLoadingAllSlipsWithRemarks && studentsForLichSuChuKyTab.length > 0 && (
                      <ScrollArea className="max-h-[60vh] pr-2"><Table><TableHeader><TableRow><TableHead className="w-[50px]">STT</TableHead><TableHead>Họ và tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Chu kỳ</TableHead><TableHead className="text-right w-[180px]">Hành động</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {studentsForLichSuChuKyTab.map((student, index) => (
                            <TableRow key={`periodic-history-${student.id}`}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-medium">{student.hoTen}</TableCell>
                              <TableCell>{student.id}</TableCell>
                              <TableCell>{student.displayCycle}</TableCell>
                              <TableCell className="text-right"><div className="flex gap-2 justify-end"><Button variant="outline" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Sửa Nhận Xét Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Edit3 className="h-4 w-4"/></Button><Button variant="destructive" size="icon" onClick={() => toast({title: "Chức năng đang phát triển", description: "Xóa nhận xét chu kỳ sẽ được thêm sau."})} aria-label="Xóa Nhận Xét Chu Kỳ"><Trash2 className="h-4 w-4"/></Button><Button variant="default" size="icon" onClick={() => handleOpenPeriodicSlipDialog(student)} aria-label="Xuất Phiếu Chu Kỳ" disabled={isLoadingPeriodicSlipRecords && periodicSlipStudent?.id === student.id}><Printer className="h-4 w-4"/></Button></div></TableCell>
                            </TableRow>))}
                          </TableBody></Table></ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG FOR DAILY SLIP PREVIEW/EXPORT */}
        <Dialog open={isSlipModalOpen} onOpenChange={(open) => {setIsSlipModalOpen(open); if(!open) setCurrentSlipDataForModal(null);}}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
              <div ref={slipDialogContentRef} className="bg-background font-sans p-4 sm:p-6 space-y-0.5 leading-normal"> 
                <DialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-10 bg-background">
                    <DialogTitle className="text-2xl font-bold uppercase text-primary text-center">PHIẾU LIÊN LẠC</DialogTitle>
                    {currentSlipDataForModal?.date && (<DialogDescription className="text-sm text-center text-muted-foreground">Ngày: {isValid(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date())) ? format(parse(currentSlipDataForModal.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi }) : "N/A"}</DialogDescription>)}
                </DialogHeader>
                {currentSlipDataForModal ? (
                <div className="space-y-1 text-sm mt-1 leading-normal"> 
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

        {/* DIALOG FOR PERIODIC SLIP PREVIEW/INPUT */}
        <Dialog open={isPeriodicSlipModalOpen} onOpenChange={(open) => { setIsPeriodicSlipModalOpen(open); if (!open) {setPeriodicSlipStudent(null); setAllDailySlipsForPeriodic([]); setPeriodicSlipSummaryRemark(""); setSlipIdToUpdateForPeriodicRemark(null);}}}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow">
                <div ref={periodicSlipDialogContentRef} className="bg-background font-sans p-4 sm:p-6 space-y-1 leading-normal"> 
                     <DialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-20 bg-background">
                        <Image src="/logo.png" alt="HoEdu Solution Logo" width={60} height={60} style={{ height: 'auto' }} className="mx-auto mb-1" data-ai-hint="app logo education" priority/>
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

// Helper components and functions (remain the same or similar)
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
    <div className="flex items-start text-sm py-0 pb-0.5 leading-normal"> 
      <strong className={cn("font-medium text-muted-foreground mr-2 w-[140px] shrink-0 text-left", labelClassName)}>{label}</strong>
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

const renderScoreDisplay = (scoreValue?: number | null | string) => {
    if (scoreValue === null || scoreValue === undefined || String(scoreValue).trim() === '') return <span className="text-muted-foreground">N/A</span>;
    let score: number | null = null;
    if (!isNaN(Number(scoreValue))) score = Number(scoreValue);
    else return <span className="text-destructive">Không hợp lệ</span>;
    
    let scoreTextColor = "text-foreground";
    if (score >= 9 && score <= 10) { scoreTextColor = "text-red-600 dark:text-red-400"; }
    else if (score >= 7 && score < 9) { scoreTextColor = "text-blue-600 dark:text-blue-400"; }
    else if (score >= 5 && score < 7) { scoreTextColor = "text-violet-600 dark:text-violet-400"; }
    else if (score >= 0 && score < 5) { scoreTextColor = "text-orange-600 dark:text-orange-400"; }

    return (<div className="flex items-center"><span className={cn("font-semibold", scoreTextColor)}>{score}</span> <StarRating score={score} maxStars={5} /> {score < 5 && score >=0 && <span className="text-xs text-orange-500 ml-1">({score}đ)</span>}</div>);
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
    return ( <div className="flex items-center ml-1"> {[...Array(numStars)].map((_, i) => <Star key={i} className={cn("h-3 w-3 fill-current", starColor)} />)} {[...Array(maxStars - numStars)].map((_, i) => <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300 dark:text-gray-600" />)} </div> );
};

const getHomeworkStatusTextAndColor = (status?: HomeworkStatusPLC | null): {text: string, className: string} => {
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

const calculateMasteryDetailsForPLL = (testFormat?: TestFormatPLC | null, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;
  if (!testFormat || testFormat === "") { return { text: "Chưa chọn hình thức KT", isTrulyMastered: false }; }
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
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") { return { text: "Không có KT bài", isTrulyMastered: false }; }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};

const handleExportSlipImage = async (contentRef: React.RefObject<HTMLDivElement>, slipIdentifier: string, studentName?: string) => {
  if (!contentRef.current) { console.error("Content ref is not available for image export."); toast({ title: "Lỗi", description: "Không tìm thấy nội dung phiếu để xuất.", variant: "destructive" }); return; }
  if (typeof html2canvas === 'undefined') { toast({ title: "Lỗi Xuất Ảnh", description: "Chức năng xuất ảnh đang được cấu hình. Vui lòng thử lại sau.", variant: "warning", duration: 7000}); console.error("html2canvas is not defined."); return; }
  try {
    const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: -window.scrollY });
    const image = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.href = image;
    const safeStudentName = studentName ? studentName.replace(/\s+/g, '_') : 'PhieuLienLac';
    const safeIdentifier = slipIdentifier.replace(/\//g, '-').replace(/\s+/g, '_');
    link.download = `PhieuLienLac_${safeStudentName}_${safeIdentifier}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Thành công!", description: "Phiếu liên lạc đã được xuất ra ảnh." });
  } catch (error) {
    console.error("Error exporting slip to image:", error);
    toast({ title: "Lỗi khi xuất phiếu", description: (error as Error).message || "Có lỗi xảy ra khi xuất phiếu.", variant: "destructive" });
  }
};

const parseCycleRangeStringToDates = (rangeString: string): { startDate: Date | null, endDate: Date | null } => {
  if (!rangeString || typeof rangeString !== 'string' || !rangeString.includes(' - ')) {
    console.warn("[PLLPage parseCycleRangeString] Invalid rangeString format:", rangeString);
    return { startDate: null, endDate: null };
  }
  const parts = rangeString.split(' - ');
  if (parts.length !== 2) {
    console.warn("[PLLPage parseCycleRangeString] rangeString does not have two parts:", rangeString);
    return { startDate: null, endDate: null };
  }
  try {
    const startDate = parse(parts[0], "dd/MM/yy", new Date());
    const endDate = parse(parts[1], "dd/MM/yy", new Date());
    if (!isValid(startDate) || !isValid(endDate)) {
       console.warn("[PLLPage parseCycleRangeString] Invalid dates after parsing:", {start: parts[0], end: parts[1]});
       return { startDate: null, endDate: null };
    }
    return { startDate, endDate };
  } catch (e) {
    console.error("[PLLPage parseCycleRangeString] Error parsing date strings:", e);
    return { startDate: null, endDate: null };
  }
};
    