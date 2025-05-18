
"use client";

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import { getStudentsByClassId } from '@/services/hocSinhService';
import { saveTestScores } from '@/services/testScoreService'; 
import type { LopHoc, HocSinh, TestScoreRecord, StudentScoreInput } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, FileText, Save, Printer, AlertCircle, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function KiemTraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [studentScores, setStudentScores] = useState<Record<string, StudentScoreInput>>({});

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const activeClasses = useMemo(() => classes.filter(c => c.trangThai === 'Đang hoạt động'), [classes]);

  const {
    data: studentsInSelectedClass = [],
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
    refetch: refetchStudentsInClass,
  } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsInClass', selectedClassId],
    queryFn: () => selectedClassId ? getStudentsByClassId(selectedClassId) : Promise.resolve([]),
    enabled: !!selectedClassId,
  });

  useEffect(() => {
    setStudentScores({});
    // TODO: Fetch existing scores for this class/date and populate studentScores
  }, [selectedClassId, selectedDate]);

  const handleScoreInputChange = (studentId: string, field: keyof StudentScoreInput, value: any) => {
    setStudentScores(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { masteredLesson: false }),
        [field]: value,
      },
    }));
  };

  const saveScoresMutation = useMutation({
    mutationFn: (records: TestScoreRecord[]) => saveTestScores(records),
    onSuccess: () => {
      toast({
        title: "Lưu điểm thành công!",
        description: "Điểm kiểm tra đã được ghi nhận.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu điểm",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
      console.error("[KiemTraPage] Error saving scores:", error);
    },
  });

  const handleSaveAllScores = () => {
    if (!selectedClassId || !selectedDate) {
      toast({
        title: "Thông tin chưa đầy đủ",
        description: "Vui lòng chọn lớp và ngày kiểm tra.",
        variant: "destructive",
      });
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassId);
    if (!selectedClass) {
        toast({ title: "Lỗi", description: "Không tìm thấy thông tin lớp đã chọn.", variant: "destructive" });
        return;
    }

    const recordsToSave: TestScoreRecord[] = studentsInSelectedClass.map(student => ({
      studentId: student.id,
      studentName: student.hoTen,
      classId: selectedClassId,
      className: selectedClass.tenLop,
      testDate: format(selectedDate, 'yyyy-MM-dd'),
      score: studentScores[student.id]?.score !== undefined && studentScores[student.id]?.score !== null && !isNaN(Number(studentScores[student.id]?.score)) ? Number(studentScores[student.id]?.score) : undefined,
      maxScore: studentScores[student.id]?.maxScore !== undefined && studentScores[student.id]?.maxScore !== null && !isNaN(Number(studentScores[student.id]?.maxScore)) ? Number(studentScores[student.id]?.maxScore) : undefined,
      masteredLesson: studentScores[student.id]?.masteredLesson || false,
      vocabularyToReview: studentScores[student.id]?.vocabularyToReview || '',
      generalRemarks: studentScores[student.id]?.generalRemarks || '',
    }));

    if (recordsToSave.length === 0) {
        toast({ title: "Không có học sinh", description: "Không có học sinh nào trong lớp được chọn để lưu điểm.", variant: "warning" });
        return;
    }
    console.log("[KiemTraPage] Data to save for test scores:", recordsToSave);
    saveScoresMutation.mutate(recordsToSave);
  };

  const handleExportStudentReport = (studentId: string) => {
    if (!selectedClassId || !selectedDate) {
      toast({ title: "Lỗi", description: "Vui lòng chọn lớp và ngày kiểm tra để xuất phiếu điểm.", variant: "destructive" });
      return;
    }
    const student = studentsInSelectedClass.find(s => s.id === studentId);
    const studentData = studentScores[studentId];
    const selectedClass = activeClasses.find(c => c.id === selectedClassId);

    if (!student || !selectedClass) {
      toast({ title: "Lỗi", description: "Không tìm thấy thông tin học sinh hoặc lớp để xuất phiếu điểm.", variant: "destructive" });
      return;
    }

    const reportData = {
      studentName: student.hoTen,
      className: selectedClass.tenLop,
      testDate: format(selectedDate, 'dd/MM/yyyy'),
      score: studentData?.score,
      maxScore: studentData?.maxScore,
      masteredLesson: studentData?.masteredLesson,
      vocabularyToReview: studentData?.vocabularyToReview,
      generalRemarks: studentData?.generalRemarks,
    };

    console.log(`[KiemTraPage] Report data for student ${student.hoTen} (ID: ${studentId}) on ${reportData.testDate}:`, reportData);
    toast({
      title: "Đang chuẩn bị phiếu điểm",
      description: `Phiếu điểm cho ${student.hoTen} (ngày ${reportData.testDate}) sẽ được xuất. Chức năng tạo file đang được phát triển.`,
    });
    // TODO: Implement actual file generation (e.g., PDF) here
  };


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <FileText className="mr-3 h-8 w-8" /> Ghi Điểm Kiểm Tra
          </h1>
          {/* General export button removed */}
        </div>

        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle>Thông tin chung bài kiểm tra</CardTitle>
            <CardDescription>Chọn lớp và ngày để bắt đầu ghi điểm.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="class-select">Chọn Lớp</Label>
              <Select
                value={selectedClassId || undefined}
                onValueChange={(value) => setSelectedClassId(value)}
                disabled={isLoadingClasses}
              >
                <SelectTrigger id="class-select" className="w-full">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn một lớp"} />
                </SelectTrigger>
                <SelectContent>
                  {activeClasses.length > 0 ? (
                    activeClasses.map((lop) => (
                      <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-class" disabled>Không có lớp nào đang hoạt động</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {isErrorClasses && <p className="text-xs text-destructive">Lỗi tải danh sách lớp.</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-date">Ngày Kiểm Tra</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="test-date"
                    variant={"outline"}
                    className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : <span>Chọn ngày</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {selectedClassId && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Nhập điểm cho học sinh</CardTitle>
              <CardDescription>
                Lớp: {activeClasses.find(c => c.id === selectedClassId)?.tenLop || 'N/A'} -
                Ngày: {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: vi }) : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStudents && (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {isErrorStudents && (
                <div className="text-destructive p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5" /> Lỗi tải danh sách học sinh của lớp này.
                </div>
              )}
              {!isLoadingStudents && !isErrorStudents && studentsInSelectedClass.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  {selectedClassId ? "Lớp này chưa có học sinh." : "Vui lòng chọn lớp để hiển thị danh sách học sinh."}
                </p>
              )}
              {!isLoadingStudents && !isErrorStudents && studentsInSelectedClass.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">STT</TableHead>
                        <TableHead>Họ và Tên</TableHead>
                        <TableHead className="w-[100px]">Điểm số</TableHead>
                        <TableHead className="w-[100px]">Thang điểm</TableHead>
                        <TableHead className="w-[150px] text-center">Đã thuộc bài?</TableHead>
                        <TableHead>Từ vựng cần học lại</TableHead>
                        <TableHead>Ghi chú chung</TableHead>
                        <TableHead className="w-[100px] text-center">Hành động</TableHead> 
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentsInSelectedClass.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{student.hoTen}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              placeholder="Điểm"
                              value={studentScores[student.id]?.score ?? ''}
                              onChange={(e) => handleScoreInputChange(student.id, 'score', e.target.valueAsNumber)}
                              className="w-full"
                            />
                          </TableCell>
                           <TableCell>
                            <Input
                              type="number"
                              placeholder="VD: 10"
                              value={studentScores[student.id]?.maxScore ?? ''}
                              onChange={(e) => handleScoreInputChange(student.id, 'maxScore', e.target.valueAsNumber)}
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <Switch
                                id={`mastered-${student.id}`}
                                checked={studentScores[student.id]?.masteredLesson || false}
                                onCheckedChange={(checked) => handleScoreInputChange(student.id, 'masteredLesson', checked)}
                              />
                              <Label htmlFor={`mastered-${student.id}`} className="sr-only">Đã thuộc bài</Label>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Textarea
                              placeholder="Liệt kê từ vựng..."
                              value={studentScores[student.id]?.vocabularyToReview || ''}
                              onChange={(e) => handleScoreInputChange(student.id, 'vocabularyToReview', e.target.value)}
                              rows={1}
                            />
                          </TableCell>
                          <TableCell>
                            <Textarea
                              placeholder="Nhận xét khác..."
                              value={studentScores[student.id]?.generalRemarks || ''}
                              onChange={(e) => handleScoreInputChange(student.id, 'generalRemarks', e.target.value)}
                              rows={1}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleExportStudentReport(student.id)}
                              aria-label={`Xuất phiếu điểm cho ${student.hoTen}`}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            {studentsInSelectedClass.length > 0 && (
              <CardFooter className="justify-end border-t pt-6">
                <Button
                  onClick={handleSaveAllScores}
                  disabled={saveScoresMutation.isPending}
                >
                  {saveScoresMutation.isPending && <Save className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu Tất Cả Điểm
                </Button>
              </CardFooter>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
