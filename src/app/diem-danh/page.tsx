
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
import { RefreshCw, AlertCircle, Users, CalendarDays, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AttendanceFormDialog from '@/components/diem-danh/AttendanceFormDialog';
import { format } from 'date-fns';

const getCurrentVietnameseDayOfWeek = (): DayOfWeek => {
  const todayIndex = new Date().getDay();
  if (todayIndex === 0) return ALL_DAYS_OF_WEEK[6]; // Chủ Nhật
  return ALL_DAYS_OF_WEEK[todayIndex - 1]; // Thứ 2 đến Thứ 7
};

const ClassCardSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2 mt-1" />
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="flex items-center">
        <Skeleton className="h-5 w-5 mr-2 rounded-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex items-center">
        <Skeleton className="h-5 w-5 mr-2 rounded-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex items-center">
        <Skeleton className="h-5 w-5 mr-2 rounded-full" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex items-center">
        <Skeleton className="h-5 w-5 mr-2 rounded-full" />
        <Skeleton className="h-4 w-1/2 mt-1" />
      </div>
    </CardContent>
    <CardFooter>
      <Skeleton className="h-10 w-full" />
    </CardFooter>
  </Card>
);

const ClassAttendanceCard = ({ lop, currentDate, onDiemDanhClick, isLoadingStudents, selectedClassForAttendanceId, isSavingAttendance }: {
  lop: LopHoc;
  currentDate: Date;
  onDiemDanhClick: (lop: LopHoc) => void;
  isLoadingStudents: boolean;
  selectedClassForAttendanceId: string | null;
  isSavingAttendance: boolean;
}) => {
  const formattedDateKey = format(currentDate, 'yyyyMMdd');
  const { data: classAttendanceToday, isLoading: isLoadingAttendance } = useQuery<Record<string, AttendanceStatus>, Error>({
    queryKey: ['attendance', lop.id, formattedDateKey],
    queryFn: () => getAttendanceForClassOnDate(lop.id, currentDate),
    enabled: !!lop.id && !!currentDate,
  });

  const attendedCount = useMemo(() => {
    if (!classAttendanceToday) return 0;
    return Object.values(classAttendanceToday).filter(status => status === 'Có mặt').length;
  }, [classAttendanceToday]);

  return (
    <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" />
          {lop.tenLop}
        </CardTitle>
        <CardDescription>
          <Badge variant={lop.trangThai === "Đang hoạt động" ? "secondary" : "outline"}>{lop.trangThai}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-2 text-sm">
        <div className="flex items-center">
          <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Lịch học: {lop.lichHoc.join(', ')}</span>
        </div>
        <div className="flex items-center">
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Giờ: {lop.gioHoc}</span>
        </div>
        <div className="flex items-center">
          <Users className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Sĩ số: {lop.soHocSinhHienTai} học sinh</span>
        </div>
        <div className="flex items-center pt-1">
          <Users className="mr-2 h-4 w-4 text-green-500" />
          {isLoadingAttendance ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="font-medium">Đã điểm danh: {attendedCount} / {lop.soHocSinhHienTai}</span>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() => onDiemDanhClick(lop)}
          className="w-full flashing-button"
          variant="default"
          size="lg"
          disabled={(isLoadingStudents && selectedClassForAttendanceId === lop.id) || isSavingAttendance}
        >
          {(isLoadingStudents || isSavingAttendance) && selectedClassForAttendanceId === lop.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-5 w-5" />
          )}
          Điểm danh
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function DiemDanhPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isClient, setIsClient] = useState(false);
  const [actualTodayVietnamese, setActualTodayVietnamese] = useState<DayOfWeek | null>(null);
  const [todayDate, setTodayDate] = useState<Date | null>(null);

  const { data: classes, isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses, refetch } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<LopHoc | null>(null);
  const [studentsForAttendanceList, setStudentsForAttendanceList] = useState<HocSinh[]>([]);
  const [existingAttendanceData, setExistingAttendanceData] = useState<Record<string, AttendanceStatus>>({});
  const [isLoadingStudentsForAttendance, setIsLoadingStudentsForAttendance] = useState(false);
  const [currentDateForAttendance, setCurrentDateForAttendance] = useState<Date>(new Date());

  useEffect(() => {
    setIsClient(true);
    setActualTodayVietnamese(getCurrentVietnameseDayOfWeek());
    setTodayDate(new Date());
  }, []);

  const classesToday = useMemo(() => {
    if (!classes || !actualTodayVietnamese) return [];
    return classes.filter(cls =>
      cls.trangThai === 'Đang hoạt động' && cls.lichHoc.includes(actualTodayVietnamese)
    );
  }, [classes, actualTodayVietnamese]);

  const saveAttendanceMutation = useMutation({
    mutationFn: (data: { classId: string; date: Date; attendanceData: Record<string, AttendanceStatus>; className: string }) =>
      saveAttendance(data.classId, data.date, data.attendanceData),
    onSuccess: (_, variables) => {
      toast({
        title: `Điểm danh đã được lưu (mock) cho lớp ${variables.className} vào ngày ${format(variables.date, 'dd/MM/yyyy')}.`,
        description: "Dữ liệu đã được cập nhật trong mock DB.",
      });
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.classId, format(variables.date, 'yyyyMMdd')] });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu điểm danh",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDiemDanhClick = async (lop: LopHoc) => {
    const today = new Date();
    setCurrentDateForAttendance(today);
    setSelectedClassForAttendance(lop);
    setIsLoadingStudentsForAttendance(true);
    setIsAttendanceModalOpen(true);

    try {
      const [students, fetchedAttendance] = await Promise.all([
        getStudentsByClassId(lop.id),
        getAttendanceForClassOnDate(lop.id, today)
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
    if (selectedClassForAttendance && currentDateForAttendance) {
      saveAttendanceMutation.mutate({
        classId: selectedClassForAttendance.id,
        date: currentDateForAttendance,
        attendanceData: submittedAttendanceData,
        className: selectedClassForAttendance.tenLop, // Pass className here
      });
    }
    setIsAttendanceModalOpen(false);
    setSelectedClassForAttendance(null);
    setStudentsForAttendanceList([]);
    setExistingAttendanceData({});
  };

  const showLoadingState = isLoadingClasses || !isClient || !actualTodayVietnamese || !todayDate;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Điểm danh Học sinh</h1>
        </div>

        <div className="mb-6 p-4 bg-card rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-1 text-foreground">
            Hôm nay: <span className="text-primary">{actualTodayVietnamese || <Skeleton className="h-6 w-20 inline-block" />}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Danh sách các lớp có lịch học cần điểm danh.</p>
        </div>

        {showLoadingState && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <ClassCardSkeleton key={`skel-${i}`} />)}
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

        {!showLoadingState && !isErrorClasses && classesToday.length === 0 && (
          <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">
              {(classes && classes.length > 0) || (classes && classes.length === 0 && classesToday.length === 0)
                ? `Không có lớp nào có lịch học vào ${actualTodayVietnamese} hôm nay.`
                : "Chưa có dữ liệu lớp học hoặc không có lớp nào hoạt động."}
            </p>
          </div>
        )}

        {!showLoadingState && !isErrorClasses && classesToday.length > 0 && todayDate && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classesToday.map(lop => (
              <ClassAttendanceCard
                key={lop.id}
                lop={lop}
                currentDate={todayDate}
                onDiemDanhClick={handleDiemDanhClick}
                isLoadingStudents={isLoadingStudentsForAttendance}
                selectedClassForAttendanceId={selectedClassForAttendance?.id || null}
                isSavingAttendance={saveAttendanceMutation.isPending}
              />
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-8 pt-4 border-t">
          Các tính năng chi tiết như: ghi nhận GV nghỉ/học bù, thống kê điểm danh thực tế sẽ được triển khai sau.
        </p>
      </div>
      {selectedClassForAttendance && currentDateForAttendance && (
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
          date={currentDateForAttendance}
          onSubmit={handleSubmitAttendance}
          isLoadingStudents={isLoadingStudentsForAttendance}
        />
      )}
    </DashboardLayout>
  );
}
