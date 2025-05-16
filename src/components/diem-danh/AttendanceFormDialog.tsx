
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HocSinh, LopHoc, AttendanceStatus } from '@/lib/types';
import { ALL_ATTENDANCE_STATUSES } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface AttendanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lopHoc: LopHoc | null;
  students: HocSinh[];
  existingAttendance: Record<string, AttendanceStatus>; // Existing data for the given date
  date: Date; // The date for which attendance is being taken
  onSubmit: (attendanceData: Record<string, AttendanceStatus>) => void;
  isLoadingStudents?: boolean;
}

export default function AttendanceFormDialog({
  open,
  onOpenChange,
  lopHoc,
  students,
  existingAttendance,
  date,
  onSubmit,
  isLoadingStudents = false,
}: AttendanceFormDialogProps) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (open && students.length > 0) {
      const initialAttendance: Record<string, AttendanceStatus> = {};
      students.forEach(student => {
        initialAttendance[student.id] = existingAttendance[student.id] || 'Có mặt';
      });
      setAttendance(initialAttendance);
    } else if (open && students.length === 0 && !isLoadingStudents) {
        setAttendance({});
    }
  }, [open, students, existingAttendance, isLoadingStudents]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = () => {
    onSubmit(attendance);
  };

  if (!lopHoc) return null;

  const formattedDialogDate = format(date, "dd/MM/yyyy");

  const getBorderColorClass = (studentId: string) => {
    const currentStatusInForm = attendance[studentId];
    const originalStatus = existingAttendance[studentId];

    if (!originalStatus && currentStatusInForm === 'Có mặt') {
        return "border-muted-foreground/30";
    }
    if (currentStatusInForm === 'GV nghỉ') {
      return "border-yellow-500 ring-2 ring-yellow-500/30";
    }
    if (currentStatusInForm === 'Học bù') {
      return "border-blue-500 ring-2 ring-blue-500/30";
    }
    switch (currentStatusInForm) {
      case 'Có mặt':
        return "border-green-500 ring-2 ring-green-500/30";
      case 'Vắng mặt':
        return "border-destructive ring-2 ring-destructive/30";
      default:
        return "border-muted-foreground/30";
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Điểm danh lớp: {lopHoc.tenLop}</DialogTitle>
          <DialogDescription>
            Ngày: {formattedDialogDate}. Chọn trạng thái cho từng học sinh.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-6 -mr-6">
          <div className="space-y-4 py-4">
            {isLoadingStudents && (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={`skel-student-${i}`} className="flex items-center justify-between p-3 border rounded-md">
                    <Skeleton className="h-5 w-1/2" />
                    <div className="flex gap-4">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!isLoadingStudents && students.length === 0 && (
              <p className="text-center text-muted-foreground py-4">Lớp này chưa có học sinh.</p>
            )}
            {!isLoadingStudents && students.map((student) => (
              <div
                key={student.id}
                className={cn(
                  "flex items-center justify-between p-3 border rounded-md shadow-sm bg-card transition-all",
                  getBorderColorClass(student.id)
                )}
              >
                <Label htmlFor={`status-${student.id}`} className="text-sm font-medium text-foreground">
                  {student.hoTen}
                </Label>
                <RadioGroup
                  id={`status-${student.id}`}
                  value={attendance[student.id] || 'Có mặt'}
                  onValueChange={(value) => handleStatusChange(student.id, value as AttendanceStatus)}
                  className="flex flex-wrap gap-3 sm:gap-4"
                >
                  {ALL_ATTENDANCE_STATUSES.filter(s => s !== 'Học bù').map(statusValue => ( // Exclude 'Học bù' from direct selection here
                     <div className="flex items-center space-x-2" key={statusValue}>
                        <RadioGroupItem value={statusValue} id={`${statusValue.replace(/\s+/g, '-').toLowerCase()}-${student.id}`} />
                        <Label htmlFor={`${statusValue.replace(/\s+/g, '-').toLowerCase()}-${student.id}`} className="text-sm">{statusValue}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-auto pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={isLoadingStudents || students.length === 0}>Lưu Điểm Danh</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
