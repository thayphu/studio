
"use client";
import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { getAttendanceForClassOnDate, saveAttendance } from '@/services/diemDanhService';
import { createGiaoVienVangRecord, getPendingMakeupClasses, deleteGiaoVienVangRecordByClassAndDate, scheduleMakeupClass, getScheduledMakeupSessionsForDate } from '@/services/giaoVienVangService';
import type { LopHoc, DayOfWeek, HocSinh, AttendanceStatus, GiaoVienVangRecord } from '@/lib/types';
import { ALL_DAYS_OF_WEEK } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, CalendarIcon, ListChecks, CalendarPlus, Pencil, Trash2, Edit, Edit3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AttendanceFormDialog from '@/components/diem-danh/AttendanceFormDialog';
import ClassAttendanceCard, { ClassAttendanceCardSkeleton } from '@/components/diem-danh/ClassAttendanceCard';
import ScheduleMakeupFormDialog from '@/components/diem-danh/ScheduleMakeupFormDialog';
import { format, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle as ShadCardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


const getCurrentVietnameseDayOfWeek = (date: Date): DayOfWeek => {
  const todayIndex = date.getDay();
  if (todayIndex === 0) return ALL_DAYS_OF_WEEK[6]; // Chủ Nhật
  return ALL_DAYS_OF_WEEK[todayIndex - 1]; // Thứ 2 đến Thứ 7
};

export interface DisplayableClassForAttendance extends LopHoc {
  isMakeupSession?: boolean;
  sessionTime?: string;
  originalDateForMakeup?: string; // YYYYMMDD format of the original missed date for context
}

export default function DiemDanhPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDisplayDayOfWeek, setCurrentDisplayDayOfWeek] = useState<DayOfWeek | null>(null);

  const { data: classes, isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses, refetch: refetchClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: allMakeupRecords = [], isLoading: isLoadingAllMakeupRecords, isError: isErrorAllMakeupRecords, error: errorAllMakeupRecords, refetch: refetchAllMakeupRecords } = useQuery<GiaoVienVangRecord[], Error>({
    queryKey: ['allMakeupRecords'],
    queryFn: getPendingMakeupClasses,
  });
  
  const formattedSelectedDateKey = format(selectedDate, 'yyyyMMdd');
  const { data: scheduledMakeupSessionsForSelectedDate = [], isLoading: isLoadingScheduledMakeupForDate, isError: isErrorScheduledMakeupForDate, error: errorScheduledMakeupForDate } = useQuery<GiaoVienVangRecord[], Error>(
    ['scheduledMakeupForDate', formattedSelectedDateKey],
    () => getScheduledMakeupSessionsForDate(selectedDate),
    { enabled: !!selectedDate && isClient }
  );


  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<DisplayableClassForAttendance | null>(null);
  const [studentsForAttendanceList, setStudentsForAttendanceList] = useState<HocSinh[]>([]);
  const [existingAttendanceData, setExistingAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [isLoadingStudentsForAttendance, setIsLoadingStudentsForAttendance] = useState(false);

  const [classToMarkTeacherAbsent, setClassToMarkTeacherAbsent] = useState<LopHoc | null>(null);
  const [isTeacherAbsentConfirmOpen, setIsTeacherAbsentConfirmOpen] = useState(false);

  const [classToCancelTeacherAbsent, setClassToCancelTeacherAbsent] = useState<LopHoc | null>(null);
  const [isCancelTeacherAbsentConfirmOpen, setIsCancelTeacherAbsentConfirmOpen] = useState(false);

  const [isScheduleMakeupModalOpen, setIsScheduleMakeupModalOpen] = useState(false);
  const [selectedRecordForMakeup, setSelectedRecordForMakeup] = useState<GiaoVienVangRecord | null>(null);


  useEffect(() => {
    setIsClient(true);
    setCurrentDisplayDayOfWeek(getCurrentVietnameseDayOfWeek(selectedDate));
  }, [selectedDate]);

  const classesToDisplay = useMemo((): DisplayableClassForAttendance[] => {
    if (!classes || !currentDisplayDayOfWeek || !isClient) return [];

    const finalClasses: DisplayableClassForAttendance[] = [];
    const processedClassIds = new Set<string>(); // To ensure a class is added only once if it's a makeup

    // Prioritize makeup sessions scheduled for the selectedDate
    scheduledMakeupSessionsForSelectedDate.forEach(record => {
        const makeupClass = classes.find(cls => cls.id === record.classId);
        if (makeupClass && makeupClass.trangThai === 'Đang hoạt động') {
            finalClasses.push({
                ...makeupClass,
                isMakeupSession: true,
                sessionTime: record.makeupTime,
                originalDateForMakeup: record.originalDate
            });
            processedClassIds.add(makeupClass.id);
        }
    });

    // Add regularly scheduled classes if they haven't been added as makeup for this specific date
    classes.forEach(cls => {
        if (cls.trangThai === 'Đang hoạt động' &&
            cls.lichHoc.includes(currentDisplayDayOfWeek) &&
            !processedClassIds.has(cls.id) // Only add if not already processed as a makeup session for this date
        ) {
            finalClasses.push({
                ...cls,
                isMakeupSession: false,
                sessionTime: cls.gioHoc
            });
        }
    });
    
    return finalClasses.sort((a, b) => a.tenLop.localeCompare(b.tenLop, 'vi'));

  }, [classes, currentDisplayDayOfWeek, scheduledMakeupSessionsForSelectedDate, isClient]);


  const saveAttendanceMutation = useMutation({
    mutationFn: (data: { classId: string; date: Date; attendanceData: Record<string, AttendanceStatus>; className: string }) =>
      saveAttendance(data.classId, data.date, data.attendanceData),
    onSuccess: (_, variables) => {
      toast({
        title: `Điểm danh đã được lưu cho lớp ${variables.className} vào ngày ${format(variables.date, 'dd/MM/yyyy')}.`,
        description: "Dữ liệu đã được cập nhật.",
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.classId, format(variables.date, 'yyyyMMdd')] });
      queryClient.invalidateQueries({ queryKey: ['studentsInClass', variables.classId] }); 
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu điểm danh",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markTeacherAbsentMutation = useMutation({
    mutationFn: async (data: { lop: LopHoc; date: Date }) => {
      console.log(`[DiemDanhPage] markTeacherAbsentMutation started for class: ${data.lop.tenLop}, date: ${data.date.toISOString()}`);
      const students = await getStudentsByClassId(data.lop.id);
      const attendanceData: Record<string, AttendanceStatus> = {};
      students.forEach(student => {
        attendanceData[student.id] = 'GV nghỉ';
      });

      console.log(`[DiemDanhPage] Saving attendance for GV nghỉ for class: ${data.lop.tenLop}`);
      await saveAttendance(data.lop.id, data.date, attendanceData);

      console.log(`[DiemDanhPage] Attempting to create GiaoVienVangRecord for class: ${data.lop.tenLop}`);
      const createdRecord = await createGiaoVienVangRecord(data.lop.id, data.lop.tenLop, data.date);
      console.log(`[DiemDanhPage] markTeacherAbsentMutation finished. Result from createGiaoVienVangRecord:`, createdRecord);
      return { ...data, createdRecord };
    },
    onSuccess: (result) => {
      if (result.createdRecord && result.createdRecord.id) {
         toast({
          title: "Đã ghi nhận GV vắng",
          description: `Buổi học ngày ${format(result.date, 'dd/MM/yyyy')} của lớp ${result.lop.tenLop} đã được ghi nhận là GV vắng và một yêu cầu học bù đã được tạo.`,
        });
      } else {
         toast({ 
          title: "GV Vắng",
          description: `Buổi học ngày ${format(result.date, 'dd/MM/yyyy')} của lớp ${result.lop.tenLop} đã được cập nhật là GV vắng. Yêu cầu học bù có thể đã tồn tại hoặc không thể tạo mới.`,
          variant: result.createdRecord ? "default" : "warning", 
        });
      }
      queryClient.invalidateQueries({ queryKey: ['attendance', result.lop.id, format(result.date, 'yyyyMMdd')] });
      queryClient.invalidateQueries({ queryKey: ['studentsInClass', result.lop.id] });
      queryClient.invalidateQueries({ queryKey: ['allMakeupRecords'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledMakeupForDate', format(result.date, 'yyyyMMdd')] });
      console.log(`[DiemDanhPage] markTeacherAbsentMutation onSuccess for class ${result.lop.tenLop}. Invalidated queries.`);
    },
    onError: (error: Error, variables) => {
      toast({
        title: `Lỗi khi ghi nhận GV vắng cho lớp ${variables.lop.tenLop}`,
        description: `${error.message}. Kiểm tra console server Next.js để biết chi tiết (ví dụ: lỗi PERMISSION_DENIED khi tạo bản ghi học bù).`,
        variant: "destructive",
        duration: 10000,
      });
      console.error(`[DiemDanhPage] Error in markTeacherAbsentMutation for class ${variables.lop.tenLop}:`, error);
    },
  });

  const cancelTeacherAbsentMutation = useMutation({
    mutationFn: async (data: { lop: LopHoc; date: Date }) => {
      console.log(`[DiemDanhPage] cancelTeacherAbsentMutation started for class: ${data.lop.tenLop}, date: ${data.date.toISOString()}`);
      const students = await getStudentsByClassId(data.lop.id);
      const attendanceData: Record<string, AttendanceStatus> = {};
      students.forEach(student => {
        attendanceData[student.id] = 'Có mặt'; // Revert to 'Có mặt'
      });

      console.log(`[DiemDanhPage] Reverting attendance for class: ${data.lop.tenLop}`);
      await saveAttendance(data.lop.id, data.date, attendanceData);

      console.log(`[DiemDanhPage] Attempting to delete GiaoVienVangRecord for class: ${data.lop.tenLop} on ${format(data.date, 'yyyyMMdd')}`);
      await deleteGiaoVienVangRecordByClassAndDate(data.lop.id, data.date);
      console.log(`[DiemDanhPage] cancelTeacherAbsentMutation finished for class: ${data.lop.tenLop}`);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Đã hủy GV vắng",
        description: `Buổi học ngày ${format(data.date, 'dd/MM/yyyy')} của lớp ${data.lop.tenLop} không còn được ghi nhận là GV vắng. Yêu cầu học bù (nếu có) đã được xóa.`,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', data.lop.id, format(data.date, 'yyyyMMdd')] });
      queryClient.invalidateQueries({ queryKey: ['studentsInClass', data.lop.id] });
      queryClient.invalidateQueries({ queryKey: ['allMakeupRecords'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledMakeupForDate', format(data.date, 'yyyyMMdd')] });
      console.log(`[DiemDanhPage] cancelTeacherAbsentMutation onSuccess for class ${data.lop.tenLop}.`);
    },
    onError: (error: Error, variables) => {
      toast({
        title: `Lỗi khi hủy GV vắng cho lớp ${variables.lop.tenLop}`,
        description: error.message,
        variant: "destructive",
      });
      console.error(`[DiemDanhPage] Error in cancelTeacherAbsentMutation for class ${variables.lop.tenLop}:`, error);
    },
  });

  const scheduleMakeupMutation = useMutation({
    mutationFn: (data: { recordId: string; makeupDate: Date; makeupTime: string; notes?: string, className: string }) =>
      scheduleMakeupClass(data.recordId, data.makeupDate, data.makeupTime, data.notes),
    onSuccess: (_, variables) => {
      toast({
        title: "Đã lên lịch học bù",
        description: `Lịch học bù cho lớp ${variables.className} đã được cập nhật.`,
      });
      queryClient.invalidateQueries({ queryKey: ['allMakeupRecords'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledMakeupForDate'] }); // Invalidate all dates or specific one if possible
      setIsScheduleMakeupModalOpen(false);
      setSelectedRecordForMakeup(null);
    },
    onError: (error: Error, variables) => {
      toast({
        title: `Lỗi khi lên lịch học bù cho lớp ${variables.className}`,
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleDiemDanhClick = async (lop: DisplayableClassForAttendance) => {
    setSelectedClassForAttendance(lop);
    setIsLoadingStudentsForAttendance(true);
    setIsAttendanceModalOpen(true);

    try {
      const [students, fetchedAttendance] = await Promise.all([
        getStudentsByClassId(lop.id),
        getAttendanceForClassOnDate(lop.id, selectedDate)
      ]);
      setStudentsForAttendanceList(students);
      setExistingAttendanceData(fetchedAttendance);
    } catch (err) {
      console.error("Error fetching students or attendance:", err);
      toast({
        title: "Lỗi tải dữ liệu điểm danh",
        description: (err as Error).message || "Không thể tải học sinh hoặc dữ liệu điểm danh cho lớp này.",
        variant: "destructive",
      });
      setIsAttendanceModalOpen(false);
    } finally {
      setIsLoadingStudentsForAttendance(false);
    }
  };

  const handleSubmitAttendance = (submittedAttendanceData: Record<string, AttendanceStatus>) => {
    if (selectedClassForAttendance) {
      saveAttendanceMutation.mutate({
        classId: selectedClassForAttendance.id,
        date: selectedDate,
        attendanceData: submittedAttendanceData,
        className: selectedClassForAttendance.tenLop,
      });
    }
    setIsAttendanceModalOpen(false);
    setSelectedClassForAttendance(null);
    setStudentsForAttendanceList([]);
    setExistingAttendanceData({});
  };

  const handleOpenTeacherAbsentConfirm = (lop: LopHoc) => {
    setClassToMarkTeacherAbsent(lop);
    setIsTeacherAbsentConfirmOpen(true);
  };

  const confirmMarkTeacherAbsent = () => {
    if (classToMarkTeacherAbsent) {
      markTeacherAbsentMutation.mutate({ lop: classToMarkTeacherAbsent, date: selectedDate });
    }
    setIsTeacherAbsentConfirmOpen(false);
    setClassToMarkTeacherAbsent(null);
  };

  const handleOpenCancelTeacherAbsentConfirm = (lop: LopHoc) => {
    setClassToCancelTeacherAbsent(lop);
    setIsCancelTeacherAbsentConfirmOpen(true);
  };

  const confirmCancelTeacherAbsent = () => {
    if (classToCancelTeacherAbsent) {
      cancelTeacherAbsentMutation.mutate({ lop: classToCancelTeacherAbsent, date: selectedDate });
    }
    setIsCancelTeacherAbsentConfirmOpen(false);
    setClassToCancelTeacherAbsent(null);
  };


  const handleOpenScheduleMakeupModal = (record: GiaoVienVangRecord) => {
    setSelectedRecordForMakeup(record);
    setIsScheduleMakeupModalOpen(true);
  };

  const handleSubmitScheduleMakeup = (data: { makeupDate: Date; makeupTime: string; notes?: string }) => {
    if (selectedRecordForMakeup) {
      scheduleMakeupMutation.mutate({
        recordId: selectedRecordForMakeup.id,
        className: selectedRecordForMakeup.className,
        ...data
      });
    }
  };

  const handleEditMakeup = (record: GiaoVienVangRecord) => {
    handleOpenScheduleMakeupModal(record);
  };

  const handleCancelMakeup = (record: GiaoVienVangRecord) => {
    toast({
      title: "Hủy Lịch Bù (Đang phát triển)",
      description: `Chức năng hủy lịch bù cho lớp ${record.className} đang được phát triển.`,
    });
  };


  const showLoadingState = isLoadingClasses || !isClient || !currentDisplayDayOfWeek || isLoadingScheduledMakeupForDate;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Điểm danh Học sinh</h1>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: vi }) : <span>Chọn ngày</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
                locale={vi}
              />
            </PopoverContent>
          </Popover>
        </div>

        <Tabs defaultValue="diem-danh" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 md:w-1/2 lg:w-1/3">
            <TabsTrigger value="diem-danh">Điểm danh</TabsTrigger>
            <TabsTrigger value="hoc-bu">Lịch Học Bù</TabsTrigger>
          </TabsList>

          <TabsContent value="diem-danh">
            <div className="mb-6 p-4 bg-card rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-1 text-foreground">
                Ngày được chọn: <span className="text-primary">{format(selectedDate, "dd/MM/yyyy")} ({currentDisplayDayOfWeek || <Skeleton className="h-6 w-20 inline-block" />})</span>
              </h2>
              <p className="text-sm text-muted-foreground">Danh sách các lớp có lịch học (bao gồm cả học bù) cần điểm danh vào ngày này.</p>
            </div>

            {showLoadingState && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <ClassAttendanceCardSkeleton key={`skel-${i}`} />)}
              </div>
            )}

            {isErrorClasses && !showLoadingState && (
              <div className="flex flex-col items-center justify-center text-destructive p-6 border border-destructive/50 bg-destructive/10 rounded-lg shadow">
                <AlertCircle className="w-12 h-12 mb-3" />
                <p className="text-lg font-semibold">Lỗi tải danh sách lớp học</p>
                <p className="text-sm mb-4 text-center">{errorClasses?.message}</p>
                <Button onClick={() => refetchClasses()} variant="destructive">
                  <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                </Button>
              </div>
            )}
             {isErrorScheduledMakeupForDate && !showLoadingState && (
              <div className="flex flex-col items-center justify-center text-destructive p-6 border border-destructive/50 bg-destructive/10 rounded-lg shadow mt-4">
                <AlertCircle className="w-12 h-12 mb-3" />
                <p className="text-lg font-semibold">Lỗi tải lịch học bù</p>
                <p className="text-sm mb-4 text-center">{(errorScheduledMakeupForDate as Error)?.message || "Không thể tải dữ liệu học bù cho ngày này."}</p>
                <p className="text-xs text-muted-foreground text-center mb-3">
                    Vui lòng kiểm tra console của server Next.js để biết chi tiết lỗi từ Firebase (thường liên quan đến thiếu Index).
                </p>
                <Button onClick={() => queryClient.invalidateQueries(['scheduledMakeupForDate', formattedSelectedDateKey])} variant="destructive">
                  <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                </Button>
              </div>
            )}


            {!showLoadingState && !isErrorClasses && !isErrorScheduledMakeupForDate && classesToDisplay.length === 0 && (
              <div className="text-center py-10 bg-card rounded-lg shadow p-6">
                <p className="text-xl text-muted-foreground">
                  { (classes && classes.length > 0) || (allMakeupRecords && allMakeupRecords.length > 0)
                    ? `Không có lớp nào có lịch học (thường hoặc bù) vào ${currentDisplayDayOfWeek} ngày ${format(selectedDate, "dd/MM/yyyy")}.`
                    : "Chưa có dữ liệu lớp học hoặc yêu cầu học bù nào trong hệ thống."
                  }
                </p>
                 <p className="text-sm text-muted-foreground mt-2">Vui lòng kiểm tra lại ngày đã chọn hoặc lịch học của các lớp.</p>
              </div>
            )}

            {!showLoadingState && !isErrorClasses && !isErrorScheduledMakeupForDate && classesToDisplay.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classesToDisplay.map(lop => (
                  <ClassAttendanceCard
                    key={lop.id + (lop.isMakeupSession ? '-makeup' : '-regular')} // Ensure unique key if a class can be both
                    lop={lop}
                    selectedDate={selectedDate}
                    onDiemDanhClick={() => handleDiemDanhClick(lop)}
                    onMarkTeacherAbsent={() => handleOpenTeacherAbsentConfirm(lop)}
                    onCancelTeacherAbsentClick={() => handleOpenCancelTeacherAbsentConfirm(lop)}
                    isLoadingStudentsForModal={isLoadingStudentsForAttendance && selectedClassForAttendance?.id === lop.id}
                    isSavingAttendance={saveAttendanceMutation.isPending && saveAttendanceMutation.variables?.classId === lop.id}
                    isMarkingTeacherAbsent={markTeacherAbsentMutation.isPending && markTeacherAbsentMutation.variables?.lop.id === lop.id}
                    isCancellingTeacherAbsent={cancelTeacherAbsentMutation.isPending && cancelTeacherAbsentMutation.variables?.lop.id === lop.id}
                    selectedClassForActionId={
                      (isLoadingStudentsForAttendance && selectedClassForAttendance?.id === lop.id) ||
                      (saveAttendanceMutation.isPending && saveAttendanceMutation.variables?.classId === lop.id) ||
                      (markTeacherAbsentMutation.isPending && markTeacherAbsentMutation.variables?.lop.id === lop.id) ||
                      (cancelTeacherAbsentMutation.isPending && cancelTeacherAbsentMutation.variables?.lop.id === lop.id)
                      ? lop.id
                      : null
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="hoc-bu">
             <div className="p-6 bg-card rounded-lg shadow">
                <h2 className="text-2xl font-bold text-foreground mb-4">Quản lý Lịch Học Bù</h2>
                {isLoadingAllMakeupRecords && (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Card key={`makeup-skel-${i}`} className="shadow-sm">
                                <CardHeader><Skeleton className="h-5 w-3/4" /></CardHeader>
                                <CardContent><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3 mt-1" /></CardContent>
                                <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
                {isErrorAllMakeupRecords && !isLoadingAllMakeupRecords && (
                  <div className="flex flex-col items-center justify-center text-destructive p-6 border border-destructive/50 bg-destructive/10 rounded-lg shadow">
                    <AlertCircle className="w-10 h-10 mb-2" />
                    <p className="text-lg font-semibold mb-1">Lỗi tải danh sách học bù</p>
                    <p className="text-sm text-center mb-2">
                      {(errorAllMakeupRecords as Error)?.message || "Đã có lỗi xảy ra."}
                    </p>
                     <p className="text-xs text-muted-foreground text-center mb-3">
                      Vui lòng kiểm tra console của server Next.js để biết chi tiết lỗi từ Firebase (thường liên quan đến thiếu Index hoặc Firestore Security Rules).
                    </p>
                    <Button onClick={() => refetchAllMakeupRecords()} variant="destructive" size="sm">
                      <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                    </Button>
                  </div>
                )}
                {!isLoadingAllMakeupRecords && !isErrorAllMakeupRecords && allMakeupRecords && allMakeupRecords.length === 0 && (
                    <p className="text-muted-foreground">Không có lớp nào đã được ghi nhận GV vắng.</p>
                )}
                {!isLoadingAllMakeupRecords && !isErrorAllMakeupRecords && allMakeupRecords && allMakeupRecords.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allMakeupRecords.map(record => (
                            <Card key={record.id} className="shadow-md hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <ShadCardTitle className="text-lg text-primary flex items-center">
                                      <ListChecks className="mr-2 h-5 w-5"/>
                                      {record.className}
                                    </ShadCardTitle>
                                    <CardDescription>
                                        GV vắng ngày: {format(parse(record.originalDate, 'yyyyMMdd', new Date()), 'dd/MM/yyyy', { locale: vi })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {record.status === 'chờ xếp lịch' && <Badge variant="outline" className="border-orange-500 text-orange-600">{record.status}</Badge>}
                                    {record.status === 'đã xếp lịch' && (
                                        <div>
                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 mb-2">Đã xếp lịch</Badge>
                                            <p className="text-sm">Ngày bù: <strong className="text-foreground">{record.makeupDate ? format(parse(record.makeupDate, 'yyyyMMdd', new Date()), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}</strong></p>
                                            <p className="text-sm">Giờ bù: <strong className="text-foreground">{record.makeupTime || 'N/A'}</strong></p>
                                            {record.notes && <p className="text-xs text-muted-foreground mt-1">Ghi chú: {record.notes}</p>}
                                        </div>
                                    )}
                                    {record.status === 'đã hoàn thành' && <Badge variant="secondary">Đã hoàn thành</Badge>}
                                    {record.status === 'đã hủy' && <Badge variant="destructive">Đã hủy</Badge>}
                                </CardContent>
                                <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                                    {record.status === 'chờ xếp lịch' && (
                                        <Button onClick={() => handleOpenScheduleMakeupModal(record)} size="sm" className="w-full sm:w-auto">
                                            <CalendarPlus className="mr-2 h-4 w-4" /> Lên lịch bù
                                        </Button>
                                    )}
                                    {record.status === 'đã xếp lịch' && (
                                        <>
                                            <Button variant="outline" onClick={() => handleEditMakeup(record)} size="sm" className="w-full sm:w-auto">
                                                <Edit3 className="mr-2 h-4 w-4" /> Đổi lịch
                                            </Button>
                                            <Button variant="ghost" onClick={() => handleCancelMakeup(record)} size="sm" className="text-destructive hover:bg-destructive/10 w-full sm:w-auto">
                                                <Trash2 className="mr-2 h-4 w-4" /> Hủy lịch
                                            </Button>
                                        </>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {selectedClassForAttendance && (
        <AttendanceFormDialog
          open={isAttendanceModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedClassForAttendance(null);
              setStudentsForAttendanceList([]);
              setExistingAttendanceData({});
            }
            setIsAttendanceModalOpen(open);
          }}
          lopHoc={selectedClassForAttendance}
          students={studentsForAttendanceList}
          existingAttendance={existingAttendanceData}
          date={selectedDate}
          onSubmit={handleSubmitAttendance}
          isLoadingStudents={isLoadingStudentsForAttendance}
        />
      )}

      {classToMarkTeacherAbsent && (
        <AlertDialog open={isTeacherAbsentConfirmOpen} onOpenChange={setIsTeacherAbsentConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận GV vắng</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn ghi nhận buổi học ngày {format(selectedDate, "dd/MM/yyyy", { locale: vi })} của lớp "{classToMarkTeacherAbsent.tenLop}" là GV vắng không?
                Tất cả học sinh trong lớp sẽ được cập nhật trạng thái "GV nghỉ" cho buổi học này, và một yêu cầu học bù sẽ được tạo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsTeacherAbsentConfirmOpen(false);
                setClassToMarkTeacherAbsent(null);
              }}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmMarkTeacherAbsent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={markTeacherAbsentMutation.isPending && markTeacherAbsentMutation.variables?.lop.id === classToMarkTeacherAbsent.id}
              >
                {(markTeacherAbsentMutation.isPending && markTeacherAbsentMutation.variables?.lop.id === classToMarkTeacherAbsent.id) && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                Xác nhận GV Vắng
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {classToCancelTeacherAbsent && (
         <AlertDialog open={isCancelTeacherAbsentConfirmOpen} onOpenChange={setIsCancelTeacherAbsentConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận Hủy GV vắng</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn có chắc chắn muốn hủy trạng thái "GV vắng" cho buổi học ngày {format(selectedDate, "dd/MM/yyyy", { locale: vi })} của lớp "{classToCancelTeacherAbsent.tenLop}" không?
                Trạng thái điểm danh của học sinh sẽ được đặt lại (mặc định là "Có mặt") và yêu cầu học bù (nếu có) sẽ bị xóa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsCancelTeacherAbsentConfirmOpen(false);
                setClassToCancelTeacherAbsent(null);
              }}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCancelTeacherAbsent}
                className="bg-blue-600 text-primary-foreground hover:bg-blue-700"
                disabled={cancelTeacherAbsentMutation.isPending && cancelTeacherAbsentMutation.variables?.lop.id === classToCancelTeacherAbsent.id}
              >
                {(cancelTeacherAbsentMutation.isPending && cancelTeacherAbsentMutation.variables?.lop.id === classToCancelTeacherAbsent.id) && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
                Xác nhận Hủy GV Vắng
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {selectedRecordForMakeup && (
        <ScheduleMakeupFormDialog
          open={isScheduleMakeupModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRecordForMakeup(null);
            }
            setIsScheduleMakeupModalOpen(open);
          }}
          record={selectedRecordForMakeup}
          onSubmit={handleSubmitScheduleMakeup}
          isSubmitting={scheduleMakeupMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}

    