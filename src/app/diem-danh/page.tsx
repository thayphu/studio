
"use client";
import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { getAttendanceForClassOnDate, saveAttendance } from '@/services/diemDanhService';
import type { LopHoc, DayOfWeek, HocSinh, AttendanceStatus } from '@/lib/types';
import { ALL_DAYS_OF_WEEK } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, CalendarIcon, CheckCheck, UserX, Ban } from 'lucide-react';
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
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';


const getCurrentVietnameseDayOfWeek = (date: Date): DayOfWeek => {
  const todayIndex = date.getDay();
  if (todayIndex === 0) return ALL_DAYS_OF_WEEK[6]; // Chủ Nhật
  return ALL_DAYS_OF_WEEK[todayIndex - 1]; // Thứ 2 đến Thứ 7
};

export default function DiemDanhPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDisplayDayOfWeek, setCurrentDisplayDayOfWeek] = useState<DayOfWeek | null>(null);

  const { data: classes, isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses, refetch } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<LopHoc | null>(null);
  const [studentsForAttendanceList, setStudentsForAttendanceList] = useState<HocSinh[]>([]);
  const [existingAttendanceData, setExistingAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [isLoadingStudentsForAttendance, setIsLoadingStudentsForAttendance] = useState(false);

  const [classToMarkTeacherAbsent, setClassToMarkTeacherAbsent] = useState<LopHoc | null>(null);
  const [isTeacherAbsentConfirmOpen, setIsTeacherAbsentConfirmOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
    setCurrentDisplayDayOfWeek(getCurrentVietnameseDayOfWeek(selectedDate));
  }, [selectedDate]);

  const classesTodayOrSelectedDate = useMemo(() => {
    if (!classes || !currentDisplayDayOfWeek) return [];
    return classes.filter(cls =>
      cls.trangThai === 'Đang hoạt động' && cls.lichHoc.includes(currentDisplayDayOfWeek)
    );
  }, [classes, currentDisplayDayOfWeek]);

  const saveAttendanceMutation = useMutation({
    mutationFn: (data: { classId: string; date: Date; attendanceData: Record<string, AttendanceStatus>; className: string }) =>
      saveAttendance(data.classId, data.date, data.attendanceData),
    onSuccess: (_, variables) => {
      toast({
        title: `Điểm danh đã được lưu cho lớp ${variables.className} vào ngày ${format(variables.date, 'dd/MM/yyyy')}.`,
        description: "Dữ liệu đã được cập nhật.",
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.classId, format(variables.date, 'yyyyMMdd')] });
      queryClient.invalidateQueries({ queryKey: ['studentsInClass', variables.classId] }); // To re-evaluate isSessionMarkedTeacherAbsent
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
      const students = await getStudentsByClassId(data.lop.id);
      const attendanceData: Record<string, AttendanceStatus> = {};
      students.forEach(student => {
        attendanceData[student.id] = 'GV nghỉ';
      });
      // Also save for the class itself if no students, or as a general marker
      if (students.length === 0) {
         // Potentially save a class-level marker if needed, though current logic saves per student
      }
      return saveAttendance(data.lop.id, data.date, attendanceData);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Đã ghi nhận GV vắng",
        description: `Buổi học ngày ${format(variables.date, 'dd/MM/yyyy')} của lớp ${variables.lop.tenLop} đã được ghi nhận là GV vắng.`,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.lop.id, format(variables.date, 'yyyyMMdd')] });
      queryClient.invalidateQueries({ queryKey: ['studentsInClass', variables.lop.id] });
    },
    onError: (error: Error, variables) => {
      toast({
        title: `Lỗi khi ghi nhận GV vắng cho lớp ${variables.lop.tenLop}`,
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleDiemDanhClick = async (lop: LopHoc) => {
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


  const showLoadingState = isLoadingClasses || !isClient || !currentDisplayDayOfWeek;

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
          <TabsList className="grid w-full grid-cols-2 mb-6 md:w-1/3">
            <TabsTrigger value="diem-danh">Điểm danh</TabsTrigger>
            <TabsTrigger value="hoc-bu">Lịch Học Bù</TabsTrigger>
          </TabsList>

          <TabsContent value="diem-danh">
            <div className="mb-6 p-4 bg-card rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-1 text-foreground">
                Ngày được chọn: <span className="text-primary">{format(selectedDate, "dd/MM/yyyy")} ({currentDisplayDayOfWeek || <Skeleton className="h-6 w-20 inline-block" />})</span>
              </h2>
              <p className="text-sm text-muted-foreground">Danh sách các lớp có lịch học cần điểm danh vào ngày này.</p>
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
                <Button onClick={() => refetch()} variant="destructive">
                  <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
                </Button>
              </div>
            )}

            {!showLoadingState && !isErrorClasses && classesTodayOrSelectedDate.length === 0 && (
              <div className="text-center py-10 bg-card rounded-lg shadow p-6">
                <p className="text-xl text-muted-foreground">
                  {(classes && classes.length > 0) || (classes && classes.length === 0 && classesTodayOrSelectedDate.length === 0)
                    ? `Không có lớp nào có lịch học vào ${currentDisplayDayOfWeek} ngày ${format(selectedDate, "dd/MM/yyyy")}.`
                    : "Chưa có dữ liệu lớp học hoặc không có lớp nào hoạt động."}
                </p>
              </div>
            )}

            {!showLoadingState && !isErrorClasses && classesTodayOrSelectedDate.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classesTodayOrSelectedDate.map(lop => (
                  <ClassAttendanceCard
                    key={lop.id}
                    lop={lop}
                    selectedDate={selectedDate}
                    onDiemDanhClick={handleDiemDanhClick}
                    onMarkTeacherAbsent={handleOpenTeacherAbsentConfirm}
                    isLoadingStudentsForModal={isLoadingStudentsForAttendance}
                    isSavingAttendance={saveAttendanceMutation.isPending}
                    isMarkingTeacherAbsent={markTeacherAbsentMutation.isPending}
                    selectedClassForActionId={
                      saveAttendanceMutation.isPending || markTeacherAbsentMutation.isPending || isLoadingStudentsForAttendance
                      ? selectedClassForAttendance?.id || classToMarkTeacherAbsent?.id || null
                      : null
                    }
                  />
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-8 pt-4 border-t">
              Các tính năng chi tiết như: ghi nhận GV nghỉ/học bù, thống kê điểm danh thực tế sẽ được triển khai sau.
            </p>
          </TabsContent>
          <TabsContent value="hoc-bu">
             <div className="p-6 bg-card rounded-lg shadow">
              <p className="text-muted-foreground">Tính năng quản lý lịch học bù sẽ được triển khai tại đây.</p>
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
                Bạn có chắc chắn muốn ghi nhận buổi học ngày {format(selectedDate, "dd/MM/yyyy")} của lớp "{classToMarkTeacherAbsent.tenLop}" là GV vắng không?
                Tất cả học sinh trong lớp sẽ được cập nhật trạng thái "GV nghỉ" cho buổi học này.
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
                disabled={markTeacherAbsentMutation.isPending}
              >
                {markTeacherAbsentMutation.isPending && markTeacherAbsentMutation.variables?.lop.id === classToMarkTeacherAbsent.id ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Xác nhận GV Vắng
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DashboardLayout>
  );
}
