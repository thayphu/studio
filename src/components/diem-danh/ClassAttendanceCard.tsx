
"use client";

import type { LopHoc, AttendanceStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Users, CheckCircle, CheckCheck, Ban, UserX, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getAttendanceForClassOnDate } from '@/services/diemDanhService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClassAttendanceCardProps {
  lop: LopHoc;
  selectedDate: Date;
  onDiemDanhClick: (lop: LopHoc) => void;
  onMarkTeacherAbsent: (lop: LopHoc) => void;
  isLoadingStudentsForModal: boolean;
  isSavingAttendance: boolean;
  isMarkingTeacherAbsent: boolean;
  selectedClassForActionId: string | null;
}

export const ClassAttendanceCardSkeleton = () => (
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
    <CardFooter className="grid grid-cols-2 gap-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </CardFooter>
  </Card>
);

export default function ClassAttendanceCard({
  lop,
  selectedDate,
  onDiemDanhClick,
  onMarkTeacherAbsent,
  isLoadingStudentsForModal,
  isSavingAttendance,
  isMarkingTeacherAbsent,
  selectedClassForActionId
}: ClassAttendanceCardProps) {
  const formattedDateKey = format(selectedDate, 'yyyyMMdd');

  const { data: studentsInClass, isLoading: isLoadingClassStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', lop.id],
    queryFn: () => getStudentsByClassId(lop.id),
    enabled: !!lop.id,
  });

  const { data: classAttendanceToday, isLoading: isLoadingAttendance } = useQuery<Record<string, AttendanceStatus>, Error>({
    queryKey: ['attendance', lop.id, formattedDateKey],
    queryFn: () => getAttendanceForClassOnDate(lop.id, selectedDate),
    enabled: !!lop.id && !!selectedDate,
  });

  const attendedCount = useMemo(() => {
    if (!classAttendanceToday) return 0;
    return Object.values(classAttendanceToday).filter(status => status === 'Có mặt').length;
  }, [classAttendanceToday]);

  const isSessionMarkedTeacherAbsent = useMemo(() => {
    if (isLoadingClassStudents || isLoadingAttendance || !studentsInClass || !classAttendanceToday) {
      return false;
    }
    if (lop.soHocSinhHienTai === 0 && Object.keys(classAttendanceToday).length === 0) return false; // No students, no attendance yet
    if (lop.soHocSinhHienTai > 0 && Object.keys(classAttendanceToday).length === 0) return false; // Students exist, but no attendance record for this date

    // Check if ALL students present in the class are marked as 'GV nghỉ'
    // OR if there are no students but there's a single entry for the class indicating 'GV nghỉ' (less likely with current save logic)
    return studentsInClass.length > 0 && studentsInClass.every(student => classAttendanceToday[student.id] === 'GV nghỉ');
  }, [classAttendanceToday, studentsInClass, lop.soHocSinhHienTai, isLoadingClassStudents, isLoadingAttendance]);


  const allMarkedPresent = useMemo(() => {
    return !isLoadingAttendance && !isSessionMarkedTeacherAbsent && classAttendanceToday && lop.soHocSinhHienTai > 0 && attendedCount === lop.soHocSinhHienTai;
  }, [isLoadingAttendance, classAttendanceToday, lop.soHocSinhHienTai, attendedCount, isSessionMarkedTeacherAbsent]);

  const isAnyActionInProgress = (isLoadingStudentsForModal && selectedClassForActionId === lop.id) ||
                                (isSavingAttendance && selectedClassForActionId === lop.id) ||
                                (isMarkingTeacherAbsent && selectedClassForActionId === lop.id);


  return (
    <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl text-primary flex items-center">
          <CalendarDays className="mr-2 h-6 w-6 text-primary" />
          {lop.tenLop}
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-2 items-center">
          <Badge variant={lop.trangThai === "Đang hoạt động" ? "secondary" : "outline"}>{lop.trangThai}</Badge>
          {isSessionMarkedTeacherAbsent && <Badge variant="destructive" className="bg-yellow-500 text-yellow-900">GV Vắng</Badge>}
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
           {isSessionMarkedTeacherAbsent ? (
            <UserX className="mr-2 h-4 w-4 text-yellow-500" />
          ) : (
            <Users className="mr-2 h-4 w-4 text-green-500" />
          )}
          {isLoadingAttendance || isLoadingClassStudents ? (
            <Skeleton className="h-4 w-24" />
          ) : isSessionMarkedTeacherAbsent ? (
             <span className="font-medium text-yellow-600">Tất cả HS được ghi nhận GV vắng</span>
          ) : (
            <span className="font-medium">Đã điểm danh "Có mặt": {attendedCount} / {lop.soHocSinhHienTai}</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 pt-4 border-t">
        <Button
          onClick={() => onDiemDanhClick(lop)}
          className={cn(!allMarkedPresent && !isSessionMarkedTeacherAbsent && "flashing-button")}
          variant={allMarkedPresent || isSessionMarkedTeacherAbsent ? "secondary" : "default"}
          size="lg"
          disabled={isAnyActionInProgress || allMarkedPresent || isSessionMarkedTeacherAbsent}
        >
          {isSavingAttendance && selectedClassForActionId === lop.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : allMarkedPresent ? (
            <CheckCheck className="mr-2 h-5 w-5" />
          ) : (
            <CheckCircle className="mr-2 h-5 w-5" />
          )}
          {allMarkedPresent ? "Đã điểm danh đủ" : "Điểm danh"}
        </Button>
        <Button
          onClick={() => onMarkTeacherAbsent(lop)}
          variant={isSessionMarkedTeacherAbsent ? "secondary" : "outline"}
          className={isSessionMarkedTeacherAbsent ? "border-yellow-500 text-yellow-600" : "border-amber-500 text-amber-600 hover:bg-amber-50"}
          size="lg"
          disabled={isAnyActionInProgress || isSessionMarkedTeacherAbsent || allMarkedPresent}
        >
          {isMarkingTeacherAbsent && selectedClassForActionId === lop.id ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isSessionMarkedTeacherAbsent ? (
             <Ban className="mr-2 h-5 w-5" />
          ) : (
            <UserX className="mr-2 h-5 w-5" />
          )}
          {isSessionMarkedTeacherAbsent ? "Đã ghi GV vắng" : "GV vắng"}
        </Button>
      </CardFooter>
    </Card>
  );
}

