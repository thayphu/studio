
"use client";

import type { LopHoc, HocSinh, AttendanceStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Users, CheckCircle, CheckCheck, Ban, UserX, Loader2, RotateCcw } from 'lucide-react';
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
  onCancelTeacherAbsentClick: (lop: LopHoc) => void; // New prop
  isLoadingStudentsForModal: boolean;
  isSavingAttendance: boolean;
  isMarkingTeacherAbsent: boolean;
  isCancellingTeacherAbsent: boolean; // New prop
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
  onCancelTeacherAbsentClick,
  isLoadingStudentsForModal,
  isSavingAttendance,
  isMarkingTeacherAbsent,
  isCancellingTeacherAbsent,
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
    if (lop.soHocSinhHienTai === 0 && Object.keys(classAttendanceToday).length === 0) return false;
    if (lop.soHocSinhHienTai > 0 && Object.keys(classAttendanceToday).length === 0 && studentsInClass && studentsInClass.length > 0) return false;

    return studentsInClass && studentsInClass.length > 0 && studentsInClass.every(student => classAttendanceToday[student.id] === 'GV nghỉ');
  }, [classAttendanceToday, studentsInClass, lop.soHocSinhHienTai, isLoadingClassStudents, isLoadingAttendance]);


  const allMarkedPresent = useMemo(() => {
    return !isLoadingAttendance && !isSessionMarkedTeacherAbsent && classAttendanceToday && lop.soHocSinhHienTai > 0 && attendedCount === lop.soHocSinhHienTai;
  }, [isLoadingAttendance, classAttendanceToday, lop.soHocSinhHienTai, attendedCount, isSessionMarkedTeacherAbsent]);

  const isButtonLoading = (isLoadingStudentsForModal && selectedClassForActionId === lop.id);
  const isSavingOrMarkingInProgress = (isSavingAttendance && selectedClassForActionId === lop.id) || (isMarkingTeacherAbsent && selectedClassForActionId === lop.id) || (isCancellingTeacherAbsent && selectedClassForActionId === lop.id);

  const isAnyActionInProgress = isButtonLoading || isSavingOrMarkingInProgress;

  const attendanceButtonLabel = allMarkedPresent ? "Đã điểm danh" : "Điểm danh";
  const teacherAbsentButtonLabel = isSessionMarkedTeacherAbsent ? "Đã ghi GV vắng" : "GV vắng";
  const cancelTeacherAbsentButtonLabel = "Hủy GV vắng";

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
          ) : allMarkedPresent ? (
            <CheckCheck className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Users className="mr-2 h-4 w-4 text-green-500" />
          )}
          {isLoadingAttendance || isLoadingClassStudents ? (
            <Skeleton className="h-4 w-24" />
          ) : isSessionMarkedTeacherAbsent ? (
             <span className="font-medium text-yellow-600">Tất cả HS được ghi nhận GV vắng</span>
          ) : allMarkedPresent ? (
             <span className="font-medium text-green-600">Đã điểm danh</span>
          ) : (
            <span className="font-medium">Đã điểm danh: {attendedCount} / {lop.soHocSinhHienTai}</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid grid-cols-2 gap-2 pt-4 border-t">
        <Button
          onClick={() => onDiemDanhClick(lop)}
          variant={allMarkedPresent ? "default" : "default"}
          size="icon"
          aria-label={attendanceButtonLabel}
          disabled={isAnyActionInProgress || allMarkedPresent || isSessionMarkedTeacherAbsent}
          className={cn(!allMarkedPresent && !isSessionMarkedTeacherAbsent && !isAnyActionInProgress && "flashing-button")}
        >
          {isButtonLoading || (isSavingAttendance && selectedClassForActionId === lop.id) ? (
            <Loader2 className="animate-spin" />
          ) : allMarkedPresent ? (
            <CheckCheck />
          ) : (
            <CheckCircle />
          )}
        </Button>
        
        {isSessionMarkedTeacherAbsent ? (
          <Button
            onClick={() => onCancelTeacherAbsentClick(lop)}
            variant="outline"
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
            size="icon"
            aria-label={cancelTeacherAbsentButtonLabel}
            disabled={isAnyActionInProgress}
          >
            {isCancellingTeacherAbsent && selectedClassForActionId === lop.id ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RotateCcw />
            )}
          </Button>
        ) : (
          <Button
            onClick={() => onMarkTeacherAbsent(lop)}
            variant={isSessionMarkedTeacherAbsent ? "secondary" : "outline"}
            className={isSessionMarkedTeacherAbsent ? "border-yellow-500 text-yellow-600" : "border-amber-500 text-amber-600 hover:bg-amber-50"}
            size="icon"
            aria-label={teacherAbsentButtonLabel}
            disabled={isAnyActionInProgress || isSessionMarkedTeacherAbsent}
          >
            {isMarkingTeacherAbsent && selectedClassForActionId === lop.id ? (
              <Loader2 className="animate-spin" />
            ) : (
              <UserX />
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
