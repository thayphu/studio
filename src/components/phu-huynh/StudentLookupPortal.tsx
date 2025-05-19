
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle as ShadCardTitle } from '@/components/ui/card'; // Renamed CardTitle to avoid conflict
import { Search, UserCircle, School, CalendarDays, FileText, PieChart, QrCode, Loader2, BadgePercent, BookOpen, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import type { HocSinh, LopHoc } from '@/lib/types';
import { getStudentById } from '@/services/hocSinhService';
import { getClasses } from '@/services/lopHocService';
import { useToast } from '@/hooks/use-toast';
import { format as formatDateFn, parseISO, addMonths, addDays, getDay, isEqual } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrencyVND, generateReceiptNumber, dayOfWeekToNumber } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from '@tanstack/react-query';

// Local CardTitle alias if needed, or ensure global ShadCN components are used consistently
const CardTitle = ShadCardTitle;


const calculateTuitionForStudent = (student: HocSinh | null, classesMap: Map<string, LopHoc>): number | null => {
  if (!student || !student.lopId) {
    console.log("[StudentLookupPortal] calculateTuitionForStudent: student or student.lopId is null/undefined.");
    return null;
  }
  const studentClass = classesMap.get(student.lopId);
  if (!studentClass) {
    console.log("[StudentLookupPortal] calculateTuitionForStudent: studentClass not found for lopId:", student.lopId);
    return null;
  }
  
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
  console.log("[StudentLookupPortal] calculateTuitionForStudent: calculated fee:", tongHocPhi, "for student:", student.id);
  return tongHocPhi;
};

const calculateNextPaymentDateDisplay = (student: HocSinh | null, studentClass: LopHoc | undefined): string => {
  if (!student || !studentClass || !studentClass.lichHoc || studentClass.lichHoc.length === 0) {
    return "N/A (thiếu thông tin lớp/lịch học)";
  }

  const startDateString = student.ngayThanhToanGanNhat || student.ngayDangKy;
  if (!startDateString) {
    return "N/A (thiếu ngày bắt đầu)";
  }
  
  let currentCycleStartDate = parseISO(startDateString);
  let nextPaymentDate: Date | null = null;

  const classScheduleDays = studentClass.lichHoc.map(day => dayOfWeekToNumber(day)).filter(dayNum => dayNum !== undefined) as number[];
  if (classScheduleDays.length === 0) {
    return "N/A (lịch học không hợp lệ)";
  }

  const findNextScheduledDay = (fromDate: Date, inclusive: boolean = true): Date | null => {
    let currentDate = new Date(fromDate);
    if (!inclusive) {
      currentDate = addDays(currentDate, 1);
    }
    for (let i = 0; i < 365; i++) { 
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
      return "N/A (không tính đủ số buổi)";
    }

  } else if (student.chuKyThanhToan === '1 tháng') {
    const nextCycleStartDateAttempt = addMonths(currentCycleStartDate, 1);
    nextPaymentDate = findNextScheduledDay(nextCycleStartDateAttempt, true);
  } else if (student.chuKyThanhToan === 'Theo ngày') {
    let dateToStartLookingFrom = currentCycleStartDate;
    // If start date is today and is a class day, next payment is the next class day
    if (isEqual(new Date(currentCycleStartDate).setHours(0,0,0,0), new Date().setHours(0,0,0,0)) && classScheduleDays.includes(getDay(currentCycleStartDate))) {
        dateToStartLookingFrom = addDays(currentCycleStartDate, 1); 
    }
    nextPaymentDate = findNextScheduledDay(dateToStartLookingFrom, true);
    // Ensure next payment isn't the same as current cycle start if conditions already met
    if (nextPaymentDate && isEqual(new Date(nextPaymentDate).setHours(0,0,0,0), new Date(currentCycleStartDate).setHours(0,0,0,0))) {
        nextPaymentDate = findNextScheduledDay(addDays(nextPaymentDate, 1), true);
    }
  } else {
    return "N/A (chu kỳ TT không xác định)";
  }

  if (nextPaymentDate) {
    return `dự kiến từ ${formatDateFn(nextPaymentDate, "dd/MM/yyyy", { locale: vi })}`;
  }
  return "N/A (không tính được)";
};


export default function StudentLookupPortal() {
  const [studentId, setStudentId] = useState('');
  const [studentInfo, setStudentInfo] = useState<HocSinh | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: classesData, isLoading: isLoadingClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'], // Using the same key as other places
    queryFn: getClasses,
    staleTime: 60000 * 5, // 5 minutes
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
    console.log(`[StudentLookupPortal] handleSearch started for studentId: ${studentId.trim()}`);

    try {
      const foundStudent = await getStudentById(studentId.trim());
      console.log("[StudentLookupPortal] Student data from service:", foundStudent);
      if (foundStudent) {
        setStudentInfo(foundStudent);
      } else {
        setStudentInfo(null);
        toast({ title: "Không tìm thấy", description: `Không tìm thấy học sinh với mã "${studentId}".`, variant: "default" });
      }
    } catch (error) {
      console.error("[StudentLookupPortal] Error in handleSearch:", error);
      toast({
        title: "Lỗi tra cứu",
        description: (error as Error).message || "Đã có lỗi xảy ra khi tìm kiếm thông tin học sinh.",
        variant: "destructive",
      });
      setStudentInfo(null);
    } finally {
      setIsLoading(false);
      console.log("[StudentLookupPortal] handleSearch finished.");
    }
  };
  
  useEffect(() => {
    console.log("[StudentLookupPortal] studentInfo state updated:", studentInfo);
    if (studentInfo) {
      console.log("[StudentLookupPortal] VietQR Env Vars from studentInfo effect:", { 
        bin: process.env.NEXT_PUBLIC_VIETQR_BANK_BIN, 
        accNo: process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO, 
        accName: process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NAME,
        template: process.env.NEXT_PUBLIC_VIETQR_TEMPLATE
      });
    }
  }, [studentInfo]);


  const studentClass = useMemo(() => {
    if (studentInfo && studentInfo.lopId && classesMap.size > 0) {
      const sClass = classesMap.get(studentInfo.lopId);
      console.log("[StudentLookupPortal] studentClass computed:", sClass);
      return sClass;
    }
    console.log("[StudentLookupPortal] studentClass computed: undefined", {studentInfo, classesMapSize: classesMap.size});
    return undefined;
  }, [studentInfo, classesMap]);

  const displayedPaymentHistory = useMemo(() => {
    if (studentInfo && studentInfo.tinhTrangThanhToan === 'Đã thanh toán' && studentInfo.ngayThanhToanGanNhat && classesMap.size > 0 && studentClass) {
      const paidAmount = calculateTuitionForStudent(studentInfo, classesMap);
      return [
        {
          stt: 1,
          date: formatDateFn(parseISO(studentInfo.ngayThanhToanGanNhat), "dd/MM/yyyy", { locale: vi }),
          receiptNo: generateReceiptNumber(), 
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

  const vietQR_BankBin = process.env.NEXT_PUBLIC_VIETQR_BANK_BIN || "YOUR_BANK_BIN";
  const vietQR_AccountNo = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NO || "YOUR_ACCOUNT_NO";
  const vietQR_AccountName = process.env.NEXT_PUBLIC_VIETQR_ACCOUNT_NAME || "YOUR_ACCOUNT_NAME";
  const vietQR_Template = process.env.NEXT_PUBLIC_VIETQR_TEMPLATE || "compact";


  const tuitionFee = studentInfo ? calculateTuitionForStudent(studentInfo, classesMap) : null;
  const qrAmount = studentInfo && studentInfo.tinhTrangThanhToan !== 'Đã thanh toán' && tuitionFee && tuitionFee > 0 ? tuitionFee : 0;
  const qrInfo = `HP ${studentInfo?.id || ''}`;
  
  const canGenerateQr = vietQR_BankBin && vietQR_AccountNo && vietQR_Template &&
                        vietQR_BankBin !== "YOUR_BANK_BIN" && vietQR_BankBin !== "VIETQR_BANK_BIN_CHUA_CAU_HINH" &&
                        vietQR_AccountNo !== "YOUR_ACCOUNT_NO" && vietQR_AccountNo !== "SO_TK_CHUA_CAU_HINH";

  const qrLink = studentInfo && qrAmount > 0 && canGenerateQr
    ? `https://img.vietqr.io/image/${vietQR_BankBin}-${vietQR_AccountNo}-${vietQR_Template}.png?amount=${qrAmount}&addInfo=${encodeURIComponent(qrInfo)}&accountName=${encodeURIComponent(vietQR_AccountName)}`
    : null;

  useEffect(() => {
    console.log("[StudentLookupPortal] Final qrLink:", qrLink);
    console.log("[StudentLookupPortal] Conditions for QR:", {
        studentInfoExists: !!studentInfo,
        isNotPaid: studentInfo?.tinhTrangThanhToan !== 'Đã thanh toán',
        qrAmountPositive: qrAmount > 0,
        canGenerateQr: canGenerateQr
    });
  }, [qrLink, studentInfo, qrAmount, canGenerateQr]);


  return (
    <div className="space-y-8">
        <Card className="shadow-xl overflow-hidden rounded-xl">
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
              <Button type="submit" className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading || isLoadingClasses}>
                {(isLoading || isLoadingClasses) ? <Loader2 className="animate-spin" /> : 'Tra cứu'}
              </Button>
            </form>

            {isLoading && <div className="text-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /> <p className="text-muted-foreground mt-2">Đang tải thông tin...</p></div>}

            {!isLoading && studentInfo && (
              <div className="space-y-8">
                <InfoSection title="Thông tin chung" icon={<UserCircle className="h-6 w-6 text-primary" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <InfoRow label="Họ và tên" value={studentInfo.hoTen} />
                    <InfoRow label="Mã HS" value={studentInfo.id} />
                     <InfoRow 
                      label="Lớp" 
                      value={studentClass?.tenLop || 'N/A'} 
                    />
                     <InfoRow 
                      label="Lịch học" 
                      value={studentClass?.lichHoc?.join(', ') || 'N/A'} 
                      icon={<BookOpen className="h-5 w-5 text-muted-foreground" />} 
                    />
                    <InfoRow label="Ngày đăng ký" value={formatDateFn(parseISO(studentInfo.ngayDangKy), "dd/MM/yyyy", {locale: vi})} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} />
                  </div>
                </InfoSection>

                <InfoSection title="Thông tin học phí" icon={<FileText className="h-6 w-6 text-primary" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    <InfoRow label="Chu kỳ thanh toán" value={studentInfo.chuKyThanhToan} />
                    <InfoRow label="Trạng thái" value={studentInfo.tinhTrangThanhToan} highlight={studentInfo.tinhTrangThanhToan === 'Chưa thanh toán' || studentInfo.tinhTrangThanhToan === 'Quá hạn'} />
                    <InfoRow label="Học phí cần đóng" value={hocPhiCanDongDisplay} highlight={studentInfo.tinhTrangThanhToan !== 'Đã thanh toán'} />
                    <InfoRow label="Chu kỳ thanh toán tiếp theo" value={nextPaymentDateText} icon={<BadgePercent className="h-5 w-5 text-muted-foreground" />} />
                  </div>
                </InfoSection>

                 <InfoSection title="Thống kê điểm danh (Toàn khóa)" icon={<PieChart className="h-6 w-6 text-primary" />}>
                   <p className="text-xs text-muted-foreground text-center mb-2">(Dữ liệu thống kê chi tiết đang được cập nhật)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <StatBox label="Tổng buổi đã học" value="--" color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200" />
                    <StatBox label="Buổi có mặt" value="--" color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200" />
                    <StatBox label="Buổi vắng" value="--" color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200" />
                    <StatBox label="GV vắng" value="--" color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200" />
                  </div>
                </InfoSection>

                <InfoSection title="Lịch sử điểm danh (Gần đây)" icon={<CalendarDays className="h-6 w-6 text-primary" />}>
                  <p className="text-muted-foreground">Chưa có lịch sử điểm danh chi tiết để hiển thị.</p>
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

                {studentInfo && studentInfo.tinhTrangThanhToan !== 'Đã thanh toán' && qrAmount > 0 && (
                  <InfoSection title="Hướng dẫn thanh toán" icon={<QrCode className="h-6 w-6 text-primary" />}>
                    <div className="flex flex-col md:flex-row gap-4 items-start"> 
                      <div className="flex-1">
                        <p className="font-semibold text-lg mb-2">Thông tin chuyển khoản:</p>
                        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                          <li>Số tài khoản: <strong className="text-foreground">{vietQR_AccountNo}</strong></li>
                          <li>Ngân hàng: <strong className="text-foreground">Ngân hàng Quân đội (MB Bank)</strong></li> 
                          <li>Chủ tài khoản: <strong className="text-foreground">{vietQR_AccountName}</strong></li>
                          <li>Nội dung chuyển khoản: <strong className="text-destructive">HP {studentInfo.id}</strong></li>
                          <li>Số tiền cần thanh toán: <strong className="text-destructive">{formatCurrencyVND(qrAmount)}</strong></li>
                        </ul>
                      </div>
                      <div className="md:w-auto flex flex-col items-center md:items-start mt-4 md:mt-0"> 
                        <p className="mb-2 font-medium text-center md:text-left">Hoặc quét mã QR:</p>
                        {qrLink ? (
                          <Image
                            src={qrLink}
                            alt="QR Code thanh toán"
                            width={150} 
                            height={150}
                            className="rounded-lg shadow-md"
                            priority
                            data-ai-hint="payment qrcode"
                          />
                        ) : (
                          <div className="p-4 border border-dashed border-destructive/50 bg-destructive/10 rounded-md text-center">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                            <p className="text-sm text-destructive-foreground font-medium">Không thể tạo mã QR</p>
                            <p className="text-xs text-muted-foreground">Vui lòng kiểm tra cấu hình thông tin tài khoản ngân hàng (biến môi trường) hoặc liên hệ quản trị viên.</p>
                          </div>
                        )}
                      </div>
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
