
"use client";

import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle as ShadDialogTitle, DialogDescription as ShadDialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { getStudents } from '@/services/hocSinhService';
import { getClasses } from '@/services/lopHocService';
import { getOverallAttendanceSummary, getDetailedAttendanceForDate } from '@/services/diemDanhService'; // Updated import
import { getTeacherAbsentDaysSummary } from '@/services/giaoVienVangService';
import type { HocSinh, LopHoc, AttendanceStatus, DiemDanhGhiNhan, GiaoVienVangRecord } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserCheck, UserX, CalendarOff, LineChart, Archive, AlertCircle, BookCopy, DollarSign, CalendarDays, BadgeDollarSign } from 'lucide-react';
import { format, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrencyVND } from '@/lib/utils';

type ModalType = 
  | 'totalStudents' 
  | 'presentStudents' 
  | 'absentStudents' 
  | 'teacherAbsentDays' 
  | 'revenueCollected' 
  | 'revenueExpected'
  | 'closedClasses';

interface ModalData {
  students?: HocSinh[];
  attendanceRecords?: DiemDanhGhiNhan[];
  teacherAbsentRecords?: GiaoVienVangRecord[];
  classes?: LopHoc[];
  financialData?: Array<HocSinh & { calculatedFee: number | null }>;
}

const calculateTuitionForStudent = (student: HocSinh, classesMap: Map<string, LopHoc>): number | null => {
  if (!student.lopId) return null;
  const studentClass = classesMap.get(student.lopId);
  if (!studentClass) return null;

  let tongHocPhi: number;
  const sessionsInCycleMap: { [key: string]: number | undefined } = {
    '8 buổi': 8,
    '10 buổi': 10,
  };
  const sessionsInDefinedCycle = sessionsInCycleMap[studentClass.chuKyDongPhi];

  if (sessionsInDefinedCycle) {
    tongHocPhi = studentClass.hocPhi * sessionsInDefinedCycle;
  } else if (studentClass.chuKyDongPhi === '1 tháng' || studentClass.chuKyDongPhi === 'Theo ngày') {
    tongHocPhi = studentClass.hocPhi;
  } else {
    tongHocPhi = studentClass.hocPhi;
  }
  return tongHocPhi;
};


export default function BaoCaoPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<ModalData>({});
  const [selectedDateForStats] = useState(new Date()); // For modal details for "today"

  const { data: students = [], isLoading: isLoadingStudents, isError: isErrorStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['students'],
    queryFn: getStudents,
  });

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: overallAttendanceSummary, isLoading: isLoadingOverallAttendance, isError: isErrorOverallAttendance } = useQuery({
    queryKey: ['overallAttendanceSummary'],
    queryFn: getOverallAttendanceSummary,
  });
  
  const { data: detailedAttendance, isLoading: isLoadingDetailedAttendance, isError: isErrorDetailedAttendance } = useQuery({
    queryKey: ['detailedAttendanceForDate', format(selectedDateForStats, 'yyyyMMdd')],
    queryFn: () => getDetailedAttendanceForDate(selectedDateForStats),
    enabled: !!modalType && (modalType === 'presentStudents' || modalType === 'absentStudents'),
  });

  const { data: teacherAbsentSummary, isLoading: isLoadingTeacherAbsentSummary, isError: isErrorTeacherAbsentSummary } = useQuery({
    queryKey: ['teacherAbsentDaysSummary'],
    queryFn: getTeacherAbsentDaysSummary,
  });

  const classesMap = useMemo(() => {
    if (isLoadingClasses || !classes) return new Map<string, LopHoc>();
    const map = new Map<string, LopHoc>();
    classes.forEach(cls => map.set(cls.id, cls));
    return map;
  }, [classes, isLoadingClasses]);

  const financialStats = useMemo(() => {
    if (isLoadingStudents || isLoadingClasses || !students || !classesMap.size) {
      return { revenueCollected: 0, revenueExpected: 0, collectedDetails: [], expectedDetails: [] };
    }
    let revenueCollected = 0;
    let revenueExpected = 0;
    const collectedDetails: Array<HocSinh & { calculatedFee: number | null }> = [];
    const expectedDetails: Array<HocSinh & { calculatedFee: number | null }> = [];

    students.forEach(student => {
      const fee = calculateTuitionForStudent(student, classesMap);
      if (fee === null) return;

      if (student.tinhTrangThanhToan === 'Đã thanh toán') {
        revenueCollected += fee;
        collectedDetails.push({ ...student, calculatedFee: fee });
      } else if (student.tinhTrangThanhToan === 'Chưa thanh toán' || student.tinhTrangThanhToan === 'Quá hạn') {
        revenueExpected += fee;
        expectedDetails.push({ ...student, calculatedFee: fee });
      }
    });
    return { revenueCollected, revenueExpected, collectedDetails, expectedDetails };
  }, [students, classesMap, isLoadingStudents, isLoadingClasses]);

  const closedClasses = useMemo(() => {
    if (isLoadingClasses || !classes) return [];
    return classes.filter(cls => cls.trangThai === 'Đã đóng');
  }, [classes, isLoadingClasses]);
  
  const presentStudentsForModal = useMemo(() => {
    if (!detailedAttendance) return [];
    return detailedAttendance.filter(att => att.trangThai === 'Có mặt').map(att => {
        const student = students.find(s => s.id === att.hocSinhId);
        const lop = classesMap.get(att.lopId);
        return {...att, hoTen: student?.hoTen || 'N/A', tenLop: lop?.tenLop || 'N/A' };
    });
  }, [detailedAttendance, students, classesMap]);

  const absentStudentsForModal = useMemo(() => {
    if (!detailedAttendance) return [];
    return detailedAttendance.filter(att => att.trangThai === 'Vắng mặt').map(att => {
        const student = students.find(s => s.id === att.hocSinhId);
        const lop = classesMap.get(att.lopId);
        return {...att, hoTen: student?.hoTen || 'N/A', tenLop: lop?.tenLop || 'N/A' };
    });
  }, [detailedAttendance, students, classesMap]);


  const openModal = (type: ModalType, title: string, data: ModalData = {}) => {
    setModalType(type);
    setModalTitle(title);
    setModalData(data);
    setIsModalOpen(true);
  };

  const renderModalContent = () => {
    if (!modalType) return null;

    switch (modalType) {
      case 'totalStudents':
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>STT</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Mã HS</TableHead>
                <TableHead className="text-right">Tổng tiền đóng (ước tính)</TableHead>
                <TableHead className="text-center">Tổng buổi học</TableHead>
                <TableHead className="text-center">Có mặt</TableHead>
                <TableHead className="text-center">Vắng mặt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modalData.students?.map((student, index) => {
                const tuitionPaid = student.tinhTrangThanhToan === 'Đã thanh toán' ? calculateTuitionForStudent(student, classesMap) : 0;
                return (
                  <TableRow key={student.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{student.hoTen}</TableCell>
                    <TableCell>{student.tenLop || 'N/A'}</TableCell>
                    <TableCell>{student.id}</TableCell>
                    <TableCell className="text-right">{formatCurrencyVND(tuitionPaid ?? 0)}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">(N/A)</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">(N/A)</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">(N/A)</TableCell>
                  </TableRow>
                );
              })}
               <TableRow><TableCell colSpan={8} className="text-xs text-muted-foreground text-center">Lưu ý: "Tổng tiền đóng" là ước tính dựa trên trạng thái thanh toán hiện tại. Số buổi học, có mặt, vắng mặt chi tiết sẽ được cập nhật sau.</TableCell></TableRow>
            </TableBody>
          </Table>
        );
      case 'presentStudents':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Ngày</TableHead><TableHead>Họ tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoadingDetailedAttendance && <TableRow><TableCell colSpan={6} className="text-center">Đang tải...</TableCell></TableRow>}
              {presentStudentsForModal.map((att, index) => (
                <TableRow key={att.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{format(selectedDateForStats, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{att.hoTen}</TableCell>
                  <TableCell>{att.hocSinhId}</TableCell>
                  <TableCell>{att.tenLop}</TableCell>
                  <TableCell>{att.trangThai}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
    case 'absentStudents':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Ngày</TableHead><TableHead>Họ tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoadingDetailedAttendance && <TableRow><TableCell colSpan={6} className="text-center">Đang tải...</TableCell></TableRow>}
              {absentStudentsForModal.map((att, index) => (
                <TableRow key={att.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{format(selectedDateForStats, 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{att.hoTen}</TableCell>
                  <TableCell>{att.hocSinhId}</TableCell>
                  <TableCell>{att.tenLop}</TableCell>
                  <TableCell>{att.trangThai}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'teacherAbsentDays':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Ngày vắng</TableHead><TableHead>Lớp</TableHead><TableHead>Lịch học bù</TableHead></TableRow></TableHeader>
            <TableBody>
              {modalData.teacherAbsentRecords?.map((record, index) => (
                <TableRow key={record.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{record.originalDate ? format(parse(record.originalDate, 'yyyyMMdd', new Date()), 'dd/MM/yyyy', { locale: vi }) : 'N/A'}</TableCell>
                  <TableCell>{record.className}</TableCell>
                  <TableCell>{record.makeupDate ? format(parse(record.makeupDate, 'yyyyMMdd', new Date()), 'dd/MM/yyyy', { locale: vi }) + (record.makeupTime ? ` (${record.makeupTime})` : '') : record.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      case 'revenueCollected':
         return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Ngày TT (gần nhất)</TableHead><TableHead>Họ tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead className="text-right">Số tiền</TableHead></TableRow></TableHeader>
            <TableBody>
              {modalData.financialData?.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.ngayThanhToanGanNhat ? format(new Date(item.ngayThanhToanGanNhat), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                  <TableCell>{item.hoTen}</TableCell>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.tenLop}</TableCell>
                  <TableCell className="text-right">{formatCurrencyVND(item.calculatedFee ?? undefined)}</TableCell>
                </TableRow>
              ))}
               <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground text-center">Lưu ý: Dữ liệu dựa trên trạng thái thanh toán hiện tại của học sinh, chưa phải lịch sử giao dịch chi tiết.</TableCell></TableRow>
            </TableBody>
          </Table>
        );
      case 'revenueExpected':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Họ tên</TableHead><TableHead>Mã HS</TableHead><TableHead>Lớp</TableHead><TableHead className="text-right">Số tiền dự kiến</TableHead></TableRow></TableHeader>
            <TableBody>
              {modalData.financialData?.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{item.hoTen}</TableCell>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.tenLop}</TableCell>
                  <TableCell className="text-right">{formatCurrencyVND(item.calculatedFee ?? undefined)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
       case 'closedClasses':
        return (
          <Table>
            <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Tên Lớp</TableHead><TableHead>Lịch học</TableHead><TableHead>Sĩ số (cuối)</TableHead></TableRow></TableHeader>
            <TableBody>
              {modalData.classes?.map((cls, index) => (
                <TableRow key={cls.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{cls.tenLop}</TableCell>
                  <TableCell>{cls.lichHoc.join(', ')} - {cls.gioHoc}</TableCell>
                  <TableCell>{cls.soHocSinhHienTai}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );
      default:
        return <p>Không có dữ liệu chi tiết.</p>;
    }
  };
  
  const StatCard = ({ title, value, icon, isLoading, onClick, description, error }: { title: string, value: string | number, icon: React.ReactNode, isLoading: boolean, onClick?: () => void, description?: string, error?: boolean }) => (
    <Card className={`shadow-md hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''} ${error ? 'border-destructive bg-destructive/10' : ''}`} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : error ? (
           <div className="text-2xl font-bold text-destructive">Lỗi</div>
        ) : (
          <div className="text-2xl font-bold text-primary">{value}</div>
        )}
        {description && !isLoading && !error && <p className="text-xs text-muted-foreground">{description}</p>}
         {error && <p className="text-xs text-destructive-foreground">Không thể tải dữ liệu</p>}
      </CardContent>
    </Card>
  );


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <h1 className="text-3xl font-bold text-foreground mb-6">Báo cáo & Thống kê</h1>

        <Tabs defaultValue="tong-quan" className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6">
            <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
            <TabsTrigger value="tai-chinh">Báo cáo Tài chính</TabsTrigger>
            <TabsTrigger value="lop-da-dong">Lớp đã đóng</TabsTrigger>
          </TabsList>

          <TabsContent value="tong-quan">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard 
                title="Tổng số học sinh" 
                value={students.length} 
                icon={<Users className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingStudents}
                onClick={() => openModal('totalStudents', 'Danh sách tổng số học sinh', { students })}
                error={isErrorStudents}
              />
              <StatCard 
                title="Tổng số lượt HS Có mặt"
                value={overallAttendanceSummary?.totalPresent ?? 0}
                icon={<UserCheck className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingOverallAttendance}
                onClick={() => openModal('presentStudents', `Học sinh có mặt - ${format(selectedDateForStats, 'dd/MM/yyyy')}`)}
                description={`Chi tiết cho ngày: ${format(selectedDateForStats, 'dd/MM')}`}
                error={isErrorOverallAttendance}
              />
              <StatCard 
                title="Tổng số lượt HS Vắng mặt"
                value={overallAttendanceSummary?.totalAbsent ?? 0}
                icon={<UserX className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingOverallAttendance}
                onClick={() => openModal('absentStudents', `Học sinh vắng mặt - ${format(selectedDateForStats, 'dd/MM/yyyy')}`)}
                description={`Chi tiết cho ngày: ${format(selectedDateForStats, 'dd/MM')}`}
                error={isErrorOverallAttendance}
              />
              <StatCard 
                title="Số ngày GV vắng" 
                value={teacherAbsentSummary?.totalAbsentDays ?? 0}
                icon={<CalendarOff className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingTeacherAbsentSummary}
                onClick={() => openModal('teacherAbsentDays', 'Chi tiết các ngày GV vắng', { teacherAbsentRecords: teacherAbsentSummary?.records })}
                error={isErrorTeacherAbsentSummary}
              />
            </div>
          </TabsContent>

          <TabsContent value="tai-chinh">
            <div className="grid gap-4 md:grid-cols-2">
               <StatCard 
                title="Tổng số tiền đã thu (ước tính)" 
                value={formatCurrencyVND(financialStats.revenueCollected)}
                icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingStudents || isLoadingClasses}
                onClick={() => openModal('revenueCollected', 'Chi tiết học phí đã thu (ước tính)', { financialData: financialStats.collectedDetails })}
                description="Dựa trên trạng thái 'Đã thanh toán' của HS."
                error={isErrorStudents || isErrorClasses}
              />
              <StatCard 
                title="Số tiền dự kiến thu (ước tính)" 
                value={formatCurrencyVND(financialStats.revenueExpected)}
                icon={<BadgeDollarSign className="h-5 w-5 text-muted-foreground" />}
                isLoading={isLoadingStudents || isLoadingClasses}
                onClick={() => openModal('revenueExpected', 'Chi tiết học phí dự kiến thu (ước tính)', { financialData: financialStats.expectedDetails })}
                description="Dựa trên HS 'Chưa TT' & 'Quá hạn'."
                error={isErrorStudents || isErrorClasses}
              />
            </div>
            <Card className="mt-6 shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-primary"/>Báo cáo dòng tiền (Placeholder)</CardTitle>
                    <CardDescription>Biểu đồ thu chi theo thời gian sẽ được hiển thị ở đây.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Cần có hệ thống ghi nhận giao dịch chi tiết (`HocPhiGhiNhan`) để xây dựng báo cáo này.</p>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lop-da-dong">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center"><Archive className="mr-2 h-5 w-5 text-primary"/>Danh sách các lớp đã đóng</CardTitle>
                <CardDescription>Thông tin về các lớp học không còn hoạt động.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingClasses ? (
                  <Skeleton className="h-20 w-full" />
                ) : isErrorClasses ? (
                   <div className="text-destructive flex items-center"><AlertCircle className="mr-2"/> Lỗi tải danh sách lớp.</div>
                ) : closedClasses.length === 0 ? (
                  <p className="text-muted-foreground">Không có lớp nào đã đóng.</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>STT</TableHead><TableHead>Tên Lớp</TableHead><TableHead>Lịch học</TableHead><TableHead>Sĩ số (cuối)</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {closedClasses.map((cls, index) => (
                        <TableRow key={cls.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{cls.tenLop}</TableCell>
                          <TableCell>{cls.lichHoc.join(', ')} - {cls.gioHoc}</TableCell>
                          <TableCell>{cls.soHocSinhHienTai}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <ShadDialogTitle>{modalTitle}</ShadDialogTitle>
              <ShadDialogDescription className="sr-only">Chi tiết thông tin.</ShadDialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-4 -mr-4">
              {renderModalContent()}
            </ScrollArea>
            <div className="pt-4 border-t text-right">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Đóng</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
