
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserCircle, School, CalendarDays, FileText, PieChart, QrCode, Loader2, BadgePercent, BookOpen } from 'lucide-react';
import Image from 'next/image';
import type { HocSinh, LopHoc, DayOfWeek } from '@/lib/types';
import { getStudentById } from '@/services/hocSinhService';
import { getClasses } from '@/services/lopHocService';
import { useToast } from '@/hooks/use-toast';
import { format as formatDateFn, parseISO, addMonths, addDays, getDay, isEqual, isAfter } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrencyVND, generateReceiptNumber, dayOfWeekToNumber } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from '@tanstack/react-query';


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

const calculateNextPaymentDateDisplay = (student: HocSinh | null, studentClass: LopHoc | undefined): string => {
  if (!student || !studentClass || !studentClass.lichHoc || studentClass.lichHoc.length === 0) {
    return "N/A (thiếu thông tin lớp hoặc lịch học)";
  }

  const startDateString = student.ngayThanhToanGanNhat || student.ngayDangKy;
  if (!startDateString) return "N/A (thiếu ngày bắt đầu)";

  let currentCycleStartDate = parseISO(startDateString);
  let nextPaymentDate: Date | null = null;

  const classScheduleDays = studentClass.lichHoc.map(day => dayOfWeekToNumber(day)).filter(dayNum => dayNum !== undefined) as number[];
  if (classScheduleDays.length === 0) return "N/A (lịch học không hợp lệ)";

  const findNextScheduledDay = (fromDate: Date, inclusive: boolean = true): Date | null => {
    let currentDate = new Date(fromDate);
    if (!inclusive) {
      currentDate = addDays(currentDate, 1);
    }
    for (let i = 0; i < 365; i++) { // Limit search to avoid infinite loop
      if (classScheduleDays.includes(getDay(currentDate))) {
        return currentDate;
      }
      currentDate = addDays(currentDate, 1);
    }
    return null;
  };

  if (student.chuKyThanhToan === '8 buổi' || student.chuKyThanhToan === '10 buổi') {
    const sessionsInCycle = student.chuKyThanhToan === '8 buổi' ? 8 : 10;
    let sessionsCounted = 0;
    let lastSessionDate: Date | null = null;
    let currentDate = findNextScheduledDay(currentCycleStartDate, true);

    if (!currentDate) return "N/A (không tìm thấy ngày học)";

    while (sessionsCounted < sessionsInCycle && currentDate) {
      sessionsCounted++;
      lastSessionDate = new Date(currentDate);
      if (sessionsCounted < sessionsInCycle) {
        currentDate = findNextScheduledDay(currentDate, false);
        if (!currentDate) break; 
      }
    }

    if (lastSessionDate && sessionsCounted === sessionsInCycle) {
      nextPaymentDate = findNextScheduledDay(lastSessionDate, false);
    } else {
      return "N/A (không thể tính đủ số buổi)";
    }

  } else if (student.chuKyThanhToan === '1 tháng') {
    const nextCycleStartDateAttempt = addMonths(currentCycleStartDate, 1);
    nextPaymentDate = findNextScheduledDay(nextCycleStartDateAttempt, true);
  } else if (student.chuKyThanhToan === 'Theo ngày') {
    // For "Theo ngày", the next payment is effectively the next scheduled day
    nextPaymentDate = findNextScheduledDay(currentCycleStartDate, false);
  } else {
    return "N/A (chu kỳ thanh toán không xác định)";
  }

  if (nextPaymentDate) {
    return `dự kiến từ ${formatDateFn(nextPaymentDate, "dd/MM/yyyy", { locale: vi })}`;
  }
  return "N/A (không tính được)";
};


export default function PhuHuynhPage() {
  const [studentId, setStudentId] = useState('');
  const [studentInfo, setStudentInfo] = useState<HocSinh | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: classesData, isLoading: isLoadingClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const classesMap = useMemo(() => {
    const currentClasses = classesData || [];
    if (currentClasses.length === 0 && !isLoadingClasses) return new Map<string, LopHoc>();
    const map = new Map<string, LopHoc>();
    currentClasses.forEach(cls => map.set(cls.id, cls));
    return map;
  }, [classesData, isLoadingClasses]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập Mã Học Sinh.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setStudentInfo(null);

    try {
      const foundStudent = await getStudentById(studentId.trim());
      if (foundStudent) {
        setStudentInfo(foundStudent);
      } else {
        setStudentInfo(null);
        toast({ title: "Không tìm thấy", description: `Không tìm thấy học sinh với mã "${studentId}".`, variant: "default" });
      }
    } catch (error) {
      console.error("Error searching student:", error);
      setStudentInfo(null);
      toast({ title: "Lỗi tra cứu", description: "Đã có lỗi xảy ra khi tìm kiếm thông tin học sinh.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const tongBuoiHocPlaceholder = "--";
  const buoiCoMatPlaceholder = "--";
  const buoiVangPlaceholder = "--";
  const buoiGVVangPlaceholder = "--";
  const lichSuDiemDanhPlaceholder: { ngay: string; trangThai: string }[] = [];

  const studentClass = useMemo(() => {
    if (studentInfo && studentInfo.lopId && classesMap.size > 0) {
      return classesMap.get(studentInfo.lopId);
    }
    return undefined;
  }, [studentInfo, classesMap]);

  const displayedPaymentHistory = useMemo(() => {
    if (studentInfo && studentInfo.tinhTrangThanhToan === 'Đã thanh toán' && studentInfo.ngayThanhToanGanNhat && classesMap.size > 0 && studentClass) {
      const paidAmount = calculateTuitionForStudent(studentInfo, classesMap);
      return [
        {
          stt: 1,
          date: formatDateFn(parseISO(studentInfo.ngayThanhToanGanNhat), "dd/MM/yyyy", { locale: vi }),
          receiptNo: generateReceiptNumber(), // This generates a new number each time, might not be desired for history
          amount: formatCurrencyVND(paidAmount ?? undefined),
        }
      ];
    }
    return [];
  }, [studentInfo, classesMap, studentClass]);


  const nextPaymentDateText = useMemo(() => {
    return calculateNextPaymentDateDisplay(studentInfo, studentClass);
  }, [studentInfo, studentClass]);
  
  const hocPhiCanDongDisplay = useMemo(() => {
    if (studentInfo) {
      if (studentInfo.tinhTrangThanhToan === 'Đã thanh toán') {
        return "Đã hoàn tất";
      }
      return formatCurrencyVND(calculateTuitionForStudent(studentInfo, classesMap) ?? undefined);
    }
    return "N/A";
  }, [studentInfo, classesMap]);


  const qrAmount = studentInfo && studentInfo.tinhTrangThanhToan !== 'Đã thanh toán' ? (calculateTuitionForStudent(studentInfo, classesMap) ?? 0) : 0;
  const qrInfo = `HP ${studentInfo?.id || ''}`;
  const qrLink = studentInfo && qrAmount > 0 
    ? `https://api.vietqr.io/v2/generate?accountNo=9704229262085470&accountName=Tran Dong Phu&acqId=970422&amount=${qrAmount}&addInfo=${encodeURIComponent(qrInfo)}&template=compact`
    : null;


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-primary mx-auto mb-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
           </svg>
          <h1 className="text-4xl font-extrabold text-primary sm:text-5xl">
            HoEdu Solution
          </h1>
          <p className="mt-3 text-xl text-muted-foreground">
            Cổng thông tin tra cứu dành cho Phụ huynh
          </p>
        </div>

        <Card className="shadow-2xl overflow-hidden rounded-xl">
          <CardHeader className="bg-primary/10 p-6">
            <CardTitle className="text-2xl font-semibold text-primary flex items-center">
              <Search className="mr-3 h-7 w-7" /> Tra cứu thông tin học sinh
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
              <Input
                type="text"
                placeholder="Nhập Mã Học Sinh (VD: 2024001)"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                className="flex-grow text-base h-12"
                required
              />
              <Button type="submit" className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Tra cứu'}
              </Button>
            </form>

            {isLoading && <div className="text-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /> <p className="text-muted-foreground mt-2">Đang tải thông tin...</p></div>}

            {!isLoading && studentInfo && (
              <div className="space-y-8">
                <InfoSection title="Thông tin chung" icon={<UserCircle className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Họ và tên" value={studentInfo.hoTen} />
                  <InfoRow label="Mã HS" value={studentInfo.id} />
                  <InfoRow label="Lớp" value={studentInfo.tenLop || 'N/A'} icon={<School className="h-5 w-5 text-muted-foreground" />} />
                  {studentClass && studentClass.lichHoc && (
                    <InfoRow label="Lịch học" value={studentClass.lichHoc.join(', ')} icon={<BookOpen className="h-5 w-5 text-muted-foreground" />} />
                  )}
                  <InfoRow label="Ngày đăng ký" value={formatDateFn(parseISO(studentInfo.ngayDangKy), "dd/MM/yyyy", {locale: vi})} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} />
                </InfoSection>

                <InfoSection title="Thông tin học phí" icon={<FileText className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Chu kỳ thanh toán" value={studentInfo.chuKyThanhToan} />
                  <InfoRow label="Trạng thái" value={studentInfo.tinhTrangThanhToan} highlight={studentInfo.tinhTrangThanhToan === 'Chưa thanh toán' || studentInfo.tinhTrangThanhToan === 'Quá hạn'} />
                  <InfoRow label="Học phí cần đóng" value={hocPhiCanDongDisplay} highlight={studentInfo.tinhTrangThanhToan !== 'Đã thanh toán'} />
                  <InfoRow label="Chu kỳ thanh toán tiếp theo" value={nextPaymentDateText} icon={<BadgePercent className="h-5 w-5 text-muted-foreground" />} />
                </InfoSection>

                 <InfoSection title="Thống kê điểm danh (Toàn khóa)" icon={<PieChart className="h-6 w-6 text-primary" />}>
                   <p className="text-xs text-muted-foreground text-center mb-2">(Dữ liệu thống kê chi tiết đang được cập nhật)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <StatBox label="Tổng buổi đã học" value={tongBuoiHocPlaceholder} color="bg-blue-100 text-blue-700" />
                    <StatBox label="Buổi có mặt" value={buoiCoMatPlaceholder} color="bg-green-100 text-green-700" />
                    <StatBox label="Buổi vắng" value={buoiVangPlaceholder} color="bg-red-100 text-red-700" />
                    <StatBox label="GV vắng" value={buoiGVVangPlaceholder} color="bg-yellow-100 text-yellow-700" />
                  </div>
                </InfoSection>

                <InfoSection title="Lịch sử điểm danh (Gần đây)" icon={<CalendarDays className="h-6 w-6 text-primary" />}>
                  {lichSuDiemDanhPlaceholder.length > 0 ? (
                    <ul className="space-y-2">
                      {lichSuDiemDanhPlaceholder.map((item: any, index: number) => (
                        <li key={index} className="flex justify-between p-2 bg-gray-50 rounded-md">
                          <span>{item.ngay}</span>
                          <span className={`font-medium ${item.trangThai === 'Có mặt' ? 'text-green-600' : 'text-red-600'}`}>{item.trangThai}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">Chưa có lịch sử điểm danh chi tiết để hiển thị.</p>}
                </InfoSection>

                <InfoSection title="Lịch sử thanh toán" icon={<FileText className="h-6 w-6 text-primary" />}>
                   {displayedPaymentHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table className="min-w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">STT</TableHead>
                            <TableHead>Ngày thanh toán</TableHead>
                            <TableHead>Số biên nhận</TableHead>
                            <TableHead className="text-right">Số tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedPaymentHistory.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.stt}</TableCell>
                              <TableCell>{item.date}</TableCell>
                              <TableCell>{item.receiptNo}</TableCell>
                              <TableCell className="text-right">{item.amount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : <p className="text-muted-foreground">Chưa có lịch sử thanh toán chi tiết để hiển thị.</p>}
                </InfoSection>

                {qrLink && studentInfo.tinhTrangThanhToan !== 'Đã thanh toán' && (
                  <InfoSection title="Hướng dẫn thanh toán" icon={<QrCode className="h-6 w-6 text-primary" />}>
                    <p className="font-semibold text-lg mb-2">Thông tin chuyển khoản:</p>
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Số tài khoản: <strong className="text-foreground">9704229262085470</strong></li>
                      <li>Ngân hàng: <strong className="text-foreground">Ngân hàng Quân đội (MB Bank)</strong></li>
                      <li>Chủ tài khoản: <strong className="text-foreground">Tran Dong Phu</strong></li>
                      <li>Nội dung chuyển khoản: <strong className="text-destructive">HP {studentInfo.id}</strong></li>
                      <li>Số tiền cần thanh toán: <strong className="text-destructive">{formatCurrencyVND(calculateTuitionForStudent(studentInfo, classesMap) ?? undefined)}</strong></li>
                    </ul>
                    <div className="mt-6 text-center">
                      <p className="mb-2 font-medium">Hoặc quét mã QR (chứa nội dung chuyển khoản):</p>
                      <Image
                        src={qrLink}
                        alt="QR Code thanh toán"
                        width={200}
                        height={200}
                        className="mx-auto rounded-lg shadow-md"
                        data-ai-hint="payment qrcode"
                      />
                       <p className="text-xs text-muted-foreground mt-1">(Mã QR này đã bao gồm số tiền và nội dung chuyển khoản)</p>
                    </div>
                  </InfoSection>
                )}

              </div>
            )}
            {!isLoading && !studentInfo && studentId && (
              <p className="text-center text-destructive font-medium py-4">Không tìm thấy thông tin học sinh với mã "{studentId}". Vui lòng kiểm tra lại mã học sinh.</p>
            )}
          </CardContent>
        </Card>
         <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} HoEdu Solution. Phát triển bởi Đông Phú.</p>
        </footer>
      </div>
    </div>
  );
}

interface InfoSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}
const InfoSection = ({ title, icon, children }: InfoSectionProps) => (
  <div className="border-t border-border pt-6">
    <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
      {icon}
      <span className="ml-2">{title}</span>
    </h3>
    <div className="space-y-3">{children}</div>
  </div>
);

interface InfoRowProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: boolean;
}
const InfoRow = ({ label, value, icon, highlight }: InfoRowProps) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground flex items-center">
      {icon && <span className="mr-1.5">{icon}</span>}
      {label}:
    </span>
    <span className={`font-medium ${highlight ? 'text-destructive' : 'text-foreground'}`}>{String(value)}</span>
  </div>
);

interface StatBoxProps {
  label: string;
  value: string | number;
  color: string;
}
const StatBox = ({ label, value, color }: StatBoxProps) => (
  <div className={`p-3 rounded-lg ${color}`}>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs">{label}</p>
  </div>
);

