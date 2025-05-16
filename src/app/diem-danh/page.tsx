
"use client";
import { useState, useMemo } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService'; // Import new service
import type { LopHoc, DayOfWeek, HocSinh, AttendanceStatus } from '@/lib/types';
import { ALL_DAYS_OF_WEEK } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle, Users, CalendarDays, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AttendanceFormDialog from '@/components/diem-danh/AttendanceFormDialog'; // Import the dialog

const getCurrentVietnameseDayOfWeek = (): DayOfWeek => {
  const todayIndex = new Date().getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  if (todayIndex === 0) { // Sunday
    return ALL_DAYS_OF_WEEK[6];
  }
  return ALL_DAYS_OF_WEEK[todayIndex - 1];
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
    </CardContent>
    <CardFooter>
      <Skeleton className="h-10 w-full" />
    </CardFooter>
  </Card>
);

export default function DiemDanhPage() {
  const { toast } = useToast();
  const { data: classes, isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses, refetch } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<LopHoc | null>(null);
  const [studentsForAttendanceList, setStudentsForAttendanceList] = useState<HocSinh[]>([]);
  const [isLoadingStudentsForAttendance, setIsLoadingStudentsForAttendance] = useState(false);

  const todayVietnamese = useMemo(() => getCurrentVietnameseDayOfWeek(), []);

  const classesToday = useMemo(() => {
    if (!classes) return [];
    return classes.filter(cls => 
      cls.trangThai === 'Đang hoạt động' && cls.lichHoc.includes(todayVietnamese)
    );
  }, [classes, todayVietnamese]);

  const handleDiemDanhClick = async (lop: LopHoc) => {
    console.log(`[DiemDanhPage] handleDiemDanhClick called for class: ${lop.tenLop} (ID: ${lop.id})`);
    setSelectedClassForAttendance(lop);
    setIsLoadingStudentsForAttendance(true);
    setIsAttendanceModalOpen(true); // Open modal immediately, show loading inside
    try {
      const students = await getStudentsByClassId(lop.id);
      setStudentsForAttendanceList(students);
    } catch (err) {
      console.error("Error fetching students for attendance:", err);
      toast({
        title: "Lỗi tải danh sách học sinh",
        description: (err as Error).message || "Không thể tải học sinh cho lớp này.",
        variant: "destructive",
      });
      setIsAttendanceModalOpen(false); // Close modal on error
    } finally {
      setIsLoadingStudentsForAttendance(false);
    }
  };

  const handleSubmitAttendance = (attendanceData: Record<string, AttendanceStatus>) => {
    console.log("Attendance Data Submitted:", attendanceData);
    if (selectedClassForAttendance) {
        toast({
            title: `Điểm danh đã được ghi nhận (tạm thời) cho lớp ${selectedClassForAttendance.tenLop}.`,
            description: "Tính năng lưu trữ vĩnh viễn sẽ được triển khai sau.",
        });
    }
    setIsAttendanceModalOpen(false);
    setSelectedClassForAttendance(null);
    setStudentsForAttendanceList([]);
    // Here you would typically call a mutation to save the attendanceData to Firestore
    // and then invalidate relevant queries to update UI (e.g., number of students attended)
  };


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Điểm danh Học sinh</h1>
        </div>
        
        <div className="mb-6 p-4 bg-card rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-1 text-foreground">
            Hôm nay: <span className="text-primary">{todayVietnamese}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Danh sách các lớp có lịch học cần điểm danh.</p>
        </div>
          
        {isLoadingClasses && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <ClassCardSkeleton key={i} />
            ))}
          </div>
        )}

        {isErrorClasses && (
          <div className="flex flex-col items-center justify-center text-destructive p-6 border border-destructive/50 bg-destructive/10 rounded-lg shadow">
            <AlertCircle className="w-12 h-12 mb-3" />
            <p className="text-lg font-semibold">Lỗi tải danh sách lớp học</p>
            <p className="text-sm mb-4 text-center">{errorClasses?.message}</p>
            <Button onClick={() => refetch()} variant="destructive">
              <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
            </Button>
          </div>
        )}

        {!isLoadingClasses && !isErrorClasses && classesToday.length === 0 && (
           <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">
              {(classes && classes.length > 0) || (classes && classes.length === 0 && classesToday.length ===0) ? `Không có lớp nào có lịch học vào ${todayVietnamese} hôm nay.` : "Chưa có dữ liệu lớp học hoặc không có lớp nào hoạt động."}
            </p>
          </div>
        )}

        {!isLoadingClasses && !isErrorClasses && classesToday.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classesToday.map(lop => (
              <Card key={lop.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
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
                    <span className="font-medium">Đã điểm danh: 0 / {lop.soHocSinhHienTai}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => handleDiemDanhClick(lop)}
                    className="w-full flashing-button"
                    variant="default"
                    size="lg"
                    disabled={isLoadingStudentsForAttendance && selectedClassForAttendance?.id === lop.id}
                  >
                    {isLoadingStudentsForAttendance && selectedClassForAttendance?.id === lop.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-5 w-5" />
                    )}
                    Tiến hành Điểm danh
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
         <p className="text-sm text-muted-foreground mt-8 pt-4 border-t">
          Các tính năng chi tiết như: ghi nhận có mặt/vắng mặt/GV nghỉ/học bù, thống kê điểm danh thực tế sẽ được triển khai sau.
        </p>
      </div>
      {selectedClassForAttendance && (
        <AttendanceFormDialog
            open={isAttendanceModalOpen}
            onOpenChange={(open) => {
                if (!open) {
                    setSelectedClassForAttendance(null);
                    setStudentsForAttendanceList([]);
                }
                setIsAttendanceModalOpen(open);
            }}
            lopHoc={selectedClassForAttendance}
            students={studentsForAttendanceList}
            onSubmit={handleSubmitAttendance}
            isLoadingStudents={isLoadingStudentsForAttendance}
        />
      )}
    </DashboardLayout>
  );
}
    
