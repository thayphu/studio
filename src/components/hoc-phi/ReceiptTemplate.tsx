
"use client";

import type { HocSinh } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, CalendarDays, User, BarChart2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ReceiptTemplateProps {
  student: HocSinh | null;
  receiptNumber: string;
  paidAmount: number | null; // This is the calculated tuition fee
}

// Placeholder function - in a real app, use a library or proper function
const numberToVietnameseWords = (num: number): string => {
  if (num === 0) return "Không đồng";
  // Basic placeholder, a real implementation is much more complex
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
    } else if (u > 0 && (h > 0 || result === "")) { // Handle 00x
      if (h > 0 && t === 0) result += "linh "; // e.g. một trăm linh một
      result += units[u] + " ";
    }
    return result.trim();
  };
  
  if (num < 0) return "Số âm không hỗ trợ";
  if (num === 0) return "Không đồng";

  const chunks = [];
  while (num > 0) {
    chunks.push(num % 1000);
    num = Math.floor(num / 1000);
  }
  if (chunks.length === 0) return "Không đồng";

  const chunkNames = ["", "nghìn", "triệu", "tỷ"];
  let words = "";
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk > 0) {
      words += formatGroup(chunk) + " " + chunkNames[i] + " ";
    } else if (i < chunks.length -1 && chunks.length > 1 && chunks[i+1] > 0 && i > 0) {
        // Add 'không nghìn', 'không triệu' if needed for structure, e.g., 1,000,000,001
        // but only if not the last chunk and not the first chunk if it's the only one
         if (chunkNames[i]) words += "không " + chunkNames[i] + " ";
    }
  }
  
  words = words.trim();
  if (!words) return "Không đồng"; // case for num still 0 after loop somehow
  
  // Capitalize first letter and add "đồng"
  return words.charAt(0).toUpperCase() + words.slice(1) + " đồng";
};


export default function ReceiptTemplate({ student, receiptNumber, paidAmount }: ReceiptTemplateProps) {
  if (!student) {
    return <div className="p-6 text-center text-muted-foreground">Không có thông tin học sinh để hiển thị biên nhận.</div>;
  }

  const today = new Date();
  const nextPaymentDate = new Date(today); // Placeholder for next payment date logic

  // Placeholder for attendance stats - replace with actual data later
  const attendanceStats = {
    present: 18,
    absent: 1,
    teacherAbsent: 1,
  };

  // Placeholder for attendance history
  const attendanceHistory = [
    { date: "01/10/2024", status: "Có mặt", color: "text-green-600 bg-green-100" },
    { date: "03/10/2024", status: "Vắng mặt", color: "text-red-600 bg-red-100" },
    { date: "05/10/2024", status: "GV nghỉ", color: "text-yellow-600 bg-yellow-100" },
    { date: "08/10/2024", status: "Có mặt", color: "text-green-600 bg-green-100" },
  ];
  
  // Placeholder for payment history
  const paymentHistory = student.ngayThanhToanGanNhat ? [
    { date: new Date(student.ngayThanhToanGanNhat).toLocaleDateString('vi-VN'), amount: formatCurrencyVND(paidAmount ?? 0), receiptNo: receiptNumber }
  ] : [];


  let nextPaymentCycleText = "N/A";
  if (student.chuKyThanhToan === "1 tháng" && student.ngayThanhToanGanNhat) {
    const lastPaymentDate = new Date(student.ngayThanhToanGanNhat);
    lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);
    nextPaymentCycleText = `dự kiến từ ${format(lastPaymentDate, "dd/MM/yyyy")}`;
  } else if ((student.chuKyThanhToan === "8 buổi" || student.chuKyThanhToan === "10 buổi")  && student.ngayThanhToanGanNhat) {
     // Assuming payment covers current cycle, next cycle starts after current one ends
     // This needs more complex logic based on actual session tracking. For now, a placeholder.
    nextPaymentCycleText = `sau khi hoàn thành ${student.chuKyThanhToan} hiện tại`;
  } else if (student.chuKyThanhToan === "Theo ngày" && student.ngayThanhToanGanNhat) {
     const lastPaymentDate = new Date(student.ngayThanhToanGanNhat);
     lastPaymentDate.setDate(lastPaymentDate.getDate() + 1); // Assuming daily payment means next day
     nextPaymentCycleText = `dự kiến từ ${format(lastPaymentDate, "dd/MM/yyyy")}`;
  }


  return (
    <div className="bg-card p-6 sm:p-8 rounded-lg shadow-lg max-w-2xl mx-auto font-sans text-sm">
      <div className="text-center mb-6">
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
        <p className="italic text-muted-foreground">({numberToVietnameseWords(paidAmount ?? 0)})</p>
      </div>

      <Separator className="my-6" />

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-foreground">Thông tin học sinh</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-muted-foreground">
          <div><span className="font-medium text-foreground">Họ và tên:</span> {student.hoTen}</div>
          <div><span className="font-medium text-foreground">Lớp:</span> {student.tenLop || 'N/A'}</div>
          <div><span className="font-medium text-foreground">Ngày đăng ký:</span> {format(new Date(student.ngayDangKy), "dd/MM/yyyy")}</div>
        </div>
        <p className="mt-1 text-muted-foreground">
          <span className="font-medium text-foreground">Chu kỳ thanh toán:</span> {student.chuKyThanhToan}.
          {' '}Chu kỳ thanh toán tiếp theo {nextPaymentCycleText}.
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
            <span className="font-medium text-foreground">{formatCurrencyVND(0)} <em className="text-xs">(Placeholder)</em></span>
          </div>
          <div className="ml-4 text-xs"><em>Diễn giải: (Placeholder)</em></div>

          <div className="flex justify-between">
            <span>Học phí linh hoạt:</span>
            <span className="font-medium text-foreground">{formatCurrencyVND(0)} <em className="text-xs">(Placeholder)</em></span>
          </div>
           <div className="ml-4 text-xs"><em>Số buổi tương ứng: (Placeholder)</em></div>

          <div className="flex justify-between">
            <span>Khấu trừ:</span>
            <span className="font-medium text-foreground">{formatCurrencyVND(0)} <em className="text-xs">(Placeholder)</em></span>
          </div>
           <div className="ml-4 text-xs"><em>Lý do: (Placeholder)</em></div>
        </div>
      </div>
      
      <Separator className="my-6" />

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-foreground">Thống kê điểm danh (Chu kỳ này - Placeholder)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={<CheckCircle className="h-6 w-6 text-green-500" />} label="Có mặt" value={attendanceStats.present} color="bg-green-50 border-green-200" />
          <StatCard icon={<XCircle className="h-6 w-6 text-red-500" />} label="Vắng mặt" value={attendanceStats.absent} color="bg-red-50 border-red-200" />
          <StatCard icon={<AlertTriangle className="h-6 w-6 text-yellow-500" />} label="GV vắng" value={attendanceStats.teacherAbsent} color="bg-yellow-50 border-yellow-200" />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2 text-foreground">Lịch sử điểm danh (Chu kỳ này - Placeholder)</h2>
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
          <ul className="space-y-1 list-disc list-inside text-muted-foreground">
            {paymentHistory.map((item, index) => (
              <li key={index}>Ngày {item.date}: {item.amount} (HĐ: {item.receiptNo})</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground italic">Chưa có lịch sử thanh toán.</p>
        )}
      </div>

      <Separator className="my-6" />

      <div className="text-xs text-muted-foreground space-y-2">
        <p>Anh / Chị vui lòng kiểm tra kỹ thông tin hiện trong Biên nhận này, nếu có sai sót hãy liên hệ để giải quyết.</p>
        <p className="text-center mt-4">
          Trân trọng,<br />
          Trần Đông Phú
        </p>
      </div>
    </div>
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

// Helper function to format date (if not using date-fns directly in all places)
const format = (date: Date, formatString: string): string => {
  // Basic formatting, for dd/MM/yyyy
  if (formatString === "dd/MM/yyyy") {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
   if (formatString === "dd") return String(date.getDate()).padStart(2, '0');
   if (formatString === "MM") return String(date.getMonth() + 1).padStart(2, '0');
   if (formatString === "yyyy") return String(date.getFullYear());
  return date.toLocaleDateString('vi-VN'); // fallback
};
