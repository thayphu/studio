
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HocSinh, LopHoc, AttendanceStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

interface AttendanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lopHoc: LopHoc | null;
  students: HocSinh[];
  onSubmit: (attendanceData: Record<string, AttendanceStatus>) => void;
  isLoadingStudents?: boolean;
}

export default function AttendanceFormDialog({
  open,
  onOpenChange,
  lopHoc,
  students,
  onSubmit,
  isLoadingStudents = false,
}: AttendanceFormDialogProps) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (open && students.length > 0) {
      const initialAttendance: Record<string, AttendanceStatus> = {};
      students.forEach(student => {
        initialAttendance[student.id] = 'Có mặt'; // Default to 'Có mặt'
      });
      setAttendance(initialAttendance);
    }
  }, [open, students]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSubmit = () => {
    onSubmit(attendance);
  };

  if (!lopHoc) return null;

  const today = new Date();
  const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Điểm danh lớp: {lopHoc.tenLop}</DialogTitle>
          <DialogDescription>
            Ngày: {formattedDate}. Chọn trạng thái cho từng học sinh.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-grow pr-6 -mr-6">
          <div className="space-y-4 py-4">
            {isLoadingStudents && (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-md">
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
              <div key={student.id} className="flex items-center justify-between p-3 border rounded-md shadow-sm bg-card">
                <Label htmlFor={`status-${student.id}`} className="text-sm font-medium text-foreground">
                  {student.hoTen}
                </Label>
                <RadioGroup
                  id={`status-${student.id}`}
                  value={attendance[student.id] || 'Có mặt'}
                  onValueChange={(value) => handleStatusChange(student.id, value as AttendanceStatus)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Có mặt" id={`present-${student.id}`} />
                    <Label htmlFor={`present-${student.id}`} className="text-sm">Có mặt</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Vắng mặt" id={`absent-${student.id}`} />
                    <Label htmlFor={`absent-${student.id}`} className="text-sm">Vắng mặt</Label>
                  </div>
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
