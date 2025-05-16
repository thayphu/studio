
"use client";

import type { HocSinh } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import React, { useRef } from 'react';
// import html2canvas from 'html2canvas'; // Temporarily commented out

interface ReceiptTemplateProps {
  student: HocSinh | null;
  receiptNumber: string;
  paidAmount: number | null; // This is the calculated tuition fee
}

const numberToVietnameseWords = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return "Không đồng";
  if (num === 0) return "Không đồng";
  
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const teens = ["mười", "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu", "mười bảy", "mười tám", "mười chín"];
  const tens = ["", "", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
  const hundreds = ["không trăm", "một trăm", "hai trăm", "ba trăm", "bốn trăm", "năm trăm", "sáu trăm", "bảy trăm", "tám trăm", "chín trăm"];

  const formatGroup = (n: number): string => {
    let result = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) result += hundreds[h] + " ";
    if (t > 1) {
      result += tens[t] + " ";
      if (u === 1) result += "mốt ";
      else if (u > 0) result += units[u] + " ";
    } else if (t === 1) {
      result += teens[u] + " ";
    } else if (u > 0 && (h > 0 || result === "")) { 
      if (h > 0 && t === 0) result += "linh ";
      result += units[u] + " ";
    }
    return result.trim();
  };
  
  if (num < 0) return "Số âm không hỗ trợ";

  const chunks = [];
  let tempNum = num;
  while (tempNum > 0) {
    chunks.push(tempNum % 1000);
    tempNum = Math.floor(tempNum / 1000);
  }
  if (chunks.length === 0 && num !==0) return "Không đồng";

  const chunkNames = ["", "nghìn", "triệu", "tỷ"];
  let words = "";
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      words += formatGroup(chunk) + " " + chunkNames[i] + " ";
    } else if (i < chunks.length -1 && chunks.length > 1 && chunks[i+1] > 0 && i > 0) {
         if (chunkNames[i]) words += "không " + chunkNames[i] + " ";
    }
  }
  
  words = words.trim();
  if (!words && num !== 0) return "Không đồng";
  
  return words.charAt(0).toUpperCase() + words.slice(1) + " đồng";
};


export default function ReceiptTemplate({ student, receiptNumber, paidAmount }: ReceiptTemplateProps) {
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!student) {
    return <div className="p-6 text-center text-muted-foreground">Không có thông tin học sinh để hiển thị biên nhận.</div>;
  }

  const today = new Date();
  
  const attendanceStats = {
    present: "--",
    absent: "--",
    teacherAbsent: "--",
  };

  const attendanceHistory: { date: string; status: string; color: string }[] = [];
  
  const paymentHistory = student.ngayThanhToanGanNhat ? [
    { stt: 1, date: new Date(student.ngayThanhToanGanNhat).toLocaleDateString('vi-VN'), amount: formatCurrencyVND(paidAmount ?? 0), receiptNo: receiptNumber }
  ] : [];


  let nextPaymentCycleTextRaw = "N/A";
  if (student.chuKyThanhToan === "1 tháng" && student.ngayThanhToanGanNhat) {
    const lastPaymentDate = new Date(student.ngayThanhToanGanNhat);
    lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);
    nextPaymentCycleTextRaw = `dự kiến từ ${format(lastPaymentDate, "dd/MM/yyyy")}`;
  } else if ((student.chuKyThanhToan === "8 buổi" || student.chuKyThanhToan === "10 buổi")  && student.ngayThanhToanGanNhat) {
    nextPaymentCycleTextRaw = `sau khi hoàn thành ${student.chuKyThanhToan} hiện tại`;
  } else if (student.chuKyThanhToan === "Theo ngày" && student.ngayThanhToanGanNhat) {
     const lastPaymentDate = new Date(student.ngayThanhToanGanNhat);
     lastPaymentDate.setDate(lastPaymentDate.getDate() + 1);
     nextPaymentCycleTextRaw = `dự kiến từ ${format(lastPaymentDate, "dd/MM/yyyy")}`;
  }

  const renderNextPaymentCycleText = () => {
    const baseText = "Chu kỳ thanh toán tiếp theo ";
    if (nextPaymentCycleTextRaw.startsWith("dự kiến từ ")) {
      const datePart = nextPaymentCycleTextRaw.substring("dự kiến từ ".length);
      return (
        <>
          <strong className="text-foreground">{baseText}dự kiến từ </strong>
          <strong className="text-red-600 font-semibold">{datePart}</strong>.
        </>
      );
    }
    return <strong className="text-foreground">{baseText}{nextPaymentCycleTextRaw}.</strong>;
  };

  const handleExportImage = async () => {
    console.log("Export to image button clicked. html2canvas integration is temporarily disabled.");
    toast({
      title: "Chức năng đang phát triển",
      description: "Tính năng xuất biên nhận sang file ảnh sẽ sớm được cập nhật. Vui lòng cài đặt 'html2canvas' và khởi động lại server.",
    });
    // if (receiptRef.current) {
    //   try {
    //     const canvas = await html2canvas(receiptRef.current, {
    //       scale: 2, 
    //       useCORS: true, 
    //       backgroundColor: '#ffffff', 
    //     });
    //     const image = canvas.toDataURL('image/png', 1.0);
    //     const link = document.createElement('a');
    //     link.href = image;
    //     link.download = `BienNhan_${receiptNumber}_${student.hoTen.replace(/\s+/g, '_')}.png`;
    //     document.body.appendChild(link);
    //     link.click();
    //     document.body.removeChild(link);
    //     toast({
    //       title: "Xuất biên nhận thành công!",
    //       description: "Biên nhận đã được tải xuống dưới dạng file ảnh.",
    //     });
    //   } catch (error) {
    //     console.error("Error exporting receipt to image:", error);
    //     toast({
    //       title: "Lỗi khi xuất biên nhận",
    //       description: "Không thể xuất biên nhận sang file ảnh. Vui lòng thử lại.",
    //       variant: "destructive",
    //     });
    //   }
    // } else {
    //   console.error("Receipt element ref is not available.");
    //   toast({
    //       title: "Lỗi",
    //       description: "Không tìm thấy nội dung biên nhận để xuất.",
    //       variant: "destructive",
    //     });
    // }
  };

  return (
    <>
      <div className="flex justify-end mb-2 print:hidden p-4 pb-0 bg-card"> 
        <Button variant="outline" size="icon" onClick={handleExportImage} aria-label="Xuất sang file ảnh">
          <Download className="h-5 w-5" />
        </Button>
      </div>
      <div ref={receiptRef} className="bg-card p-6 sm:p-8 rounded-lg shadow-lg max-w-2xl mx-auto font-sans text-sm">
        <div className="text-center flex-grow mb-6">
          <div className="inline-block bg-accent text-accent-foreground px-6 py-2 rounded-md">
            <h1 className="text-2xl font-bold uppercase">Biên nhận</h1>
          </div>
          <p className="text-lg font-bold text-red-600 mt-2">No. {receiptNumber}</p>
        </div>
        
        <div className="mb-6 text-center">
          <p className="text-sm">Ngày {format(today, "dd")} tháng {format(today, "MM")} năm {format(today, "yyyy")}</p>
        </div>
        
        <div className="mb-6 text-center">
          <p className="text-3xl font-bold">{formatCurrencyVND(paidAmount ?? 0)}</p>
          <p className="italic text-muted-foreground">({numberToVietnameseWords(paidAmount)})</p>
        </div>

        <Separator className="my-6" />

        <div className="mb-6 text-base">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Thông tin học sinh</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div><span className="font-medium text-foreground">Họ và tên:</span> <span className="text-indigo-700 font-semibold">{student.hoTen}</span></div>
            <div><span className="font-medium text-foreground">Lớp:</span> {student.tenLop || 'N/A'}</div>
            <div><span className="font-medium text-foreground">Ngày đăng ký:</span> {format(new Date(student.ngayDangKy), "dd/MM/yyyy")}</div>
          </div>
          <p className="mt-2">
            <span className="font-medium text-foreground">Chu kỳ thanh toán:</span>
            <span className="inline-block pl-4">{student.chuKyThanhToan}.</span>
            <br /> 
            {renderNextPaymentCycleText()}
          </p>
        </div>

        <Separator className="my-6" />

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Thông tin học phí</h2>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Tổng học phí cơ bản:</span>
              <span className="font-medium text-foreground">{formatCurrencyVND(paidAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Chi phí khác:</span>
              <span className="font-medium text-foreground">{formatCurrencyVND(0)}</span>
            </div>
            <div className="ml-4 text-xs"><em>Diễn giải: </em></div>

            <div className="flex justify-between">
              <span>Học phí linh hoạt:</span>
              <span className="font-medium text-foreground">{formatCurrencyVND(0)}</span>
            </div>
            <div className="ml-4 text-xs"><em>Số buổi tương ứng: </em></div>

            <div className="flex justify-between">
              <span>Khấu trừ:</span>
              <span className="font-medium text-foreground">{formatCurrencyVND(0)}</span>
            </div>
            <div className="ml-4 text-xs"><em>Lý do: </em></div>
          </div>
        </div>
        
        <Separator className="my-6" />

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Thống kê điểm danh (Chu kỳ này)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={<CheckCircle className="h-6 w-6 text-green-500" />} label="Có mặt" value={attendanceStats.present} color="bg-green-50 border-green-200" />
            <StatCard icon={<XCircle className="h-6 w-6 text-red-500" />} label="Vắng mặt" value={attendanceStats.absent} color="bg-red-50 border-red-200" />
            <StatCard icon={<AlertTriangle className="h-6 w-6 text-yellow-500" />} label="GV vắng" value={attendanceStats.teacherAbsent} color="bg-yellow-50 border-yellow-200" />
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Lịch sử điểm danh (Chu kỳ này)</h2>
          {attendanceHistory.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {attendanceHistory.map((item, index) => (
                <div key={index} className={`p-2 rounded-md text-center text-xs ${item.color}`}>
                  <p className="font-semibold">{item.date}</p>
                  <p>{item.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground italic">Chưa có lịch sử điểm danh cho chu kỳ này.</p>
          )}
        </div>
        
        <Separator className="my-6" />

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-foreground">Lịch sử thanh toán</h2>
          {paymentHistory.length > 0 ? (
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
                  {paymentHistory.map((item, index) => (
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
          ) : (
            <p className="text-muted-foreground italic">Chưa có lịch sử thanh toán.</p>
          )}
        </div>

        <Separator className="my-6" />

        <div className="text-lg text-muted-foreground space-y-2">
          <p>Anh / Chị vui lòng kiểm tra kỹ thông tin hiện trong Biên nhận này, nếu có sai sót hãy liên hệ để giải quyết.</p>
          <p className="text-center mt-4">
            Trân trọng,<br />
            Trần Đông Phú
          </p>
        </div>
      </div>
    </>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}
const StatCard = ({ icon, label, value, color }: StatCardProps) => (
  <div className={`p-3 rounded-lg shadow-sm border ${color} flex flex-col items-center text-center`}>
    <div className="mb-1">{icon}</div>
    <p className="text-xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const format = (date: Date, formatString: string): string => {
  if (formatString === "dd/MM/yyyy") {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
   if (formatString === "dd") return String(date.getDate()).padStart(2, '0');
   if (formatString === "MM") return String(date.getMonth() + 1).padStart(2, '0');
   if (formatString === "yyyy") return String(date.getFullYear());
  return date.toLocaleDateString('vi-VN'); 
};
    
