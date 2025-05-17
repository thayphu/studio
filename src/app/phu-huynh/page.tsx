
"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserCircle, School, CalendarDays, FileText, PieChart, QrCode, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { HocSinh } from '@/lib/types'; // Import HocSinh type
import { getStudentById } from '@/services/hocSinhService'; // Import the service
import { useToast } from '@/hooks/use-toast';
import { format as formatDate, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { formatCurrencyVND } from '@/lib/utils';

export default function PhuHuynhPage() {
  const [studentId, setStudentId] = useState('');
  const [studentInfo, setStudentInfo] = useState<HocSinh | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập Mã Học Sinh.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setStudentInfo(null); // Clear previous info

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

  // Placeholder data for sections not yet implemented with real data
  const hocPhiCanDongPlaceholder = "N/A (liên hệ trung tâm)";
  const tongBuoiHocPlaceholder = "--";
  const buoiCoMatPlaceholder = "--";
  const buoiVangPlaceholder = "--";
  const buoiGVVangPlaceholder = "--";
  const lichSuDiemDanhPlaceholder: { ngay: string; trangThai: string }[] = [];
  const lichSuThanhToanPlaceholder: any[] = [];


  const qrAmount = 0; // Placeholder amount, actual fee calculation is complex and not yet implemented here
  const qrInfo = `HP ${studentInfo?.id || ''}`; // Use studentInfo.id
  const qrLink = `https://api.vietqr.io/v2/generate?accountNo=9704229262085470&accountName=Tran Dong Phu&acqId=970422&amount=${qrAmount}&addInfo=${encodeURIComponent(qrInfo)}&template=compact`;


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
                onChange={(e) => setStudentId(e.target.value.toUpperCase())} // Auto uppercase for consistency
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
                {/* Basic Info */}
                <InfoSection title="Thông tin chung" icon={<UserCircle className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Họ và tên" value={studentInfo.hoTen} />
                  <InfoRow label="Mã HS" value={studentInfo.id} />
                  <InfoRow label="Lớp" value={studentInfo.tenLop || 'N/A'} icon={<School className="h-5 w-5 text-muted-foreground" />} />
                  <InfoRow label="Ngày đăng ký" value={formatDate(parseISO(studentInfo.ngayDangKy), "dd/MM/yyyy", {locale: vi})} icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} />
                </InfoSection>

                {/* Payment Info */}
                <InfoSection title="Thông tin học phí" icon={<FileText className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Chu kỳ thanh toán" value={studentInfo.chuKyThanhToan} />
                  <InfoRow label="Trạng thái" value={studentInfo.tinhTrangThanhToan} highlight={studentInfo.tinhTrangThanhToan === 'Chưa thanh toán' || studentInfo.tinhTrangThanhToan === 'Quá hạn'} />
                   <InfoRow label="Học phí cần đóng" value={hocPhiCanDongPlaceholder} highlight={studentInfo.tinhTrangThanhToan !== 'Đã thanh toán'} />
                </InfoSection>

                {/* Attendance Stats */}
                 <InfoSection title="Thống kê điểm danh (Toàn khóa)" icon={<PieChart className="h-6 w-6 text-primary" />}>
                   <p className="text-xs text-muted-foreground text-center mb-2">(Dữ liệu thống kê chi tiết đang được cập nhật)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <StatBox label="Tổng buổi đã học" value={tongBuoiHocPlaceholder} color="bg-blue-100 text-blue-700" />
                    <StatBox label="Buổi có mặt" value={buoiCoMatPlaceholder} color="bg-green-100 text-green-700" />
                    <StatBox label="Buổi vắng" value={buoiVangPlaceholder} color="bg-red-100 text-red-700" />
                    <StatBox label="GV vắng" value={buoiGVVangPlaceholder} color="bg-yellow-100 text-yellow-700" />
                  </div>
                </InfoSection>

                {/* Attendance History */}
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

                {/* Payment History */}
                <InfoSection title="Lịch sử thanh toán" icon={<FileText className="h-6 w-6 text-primary" />}>
                   {lichSuThanhToanPlaceholder.length > 0 ? (
                    <ul className="space-y-2">
                      {lichSuThanhToanPlaceholder.map((item: any, index: number) => (
                        <li key={index} className="flex justify-between p-2 bg-gray-50 rounded-md">
                          <span>{item.ngayThanhToan} - HĐ: {item.hoaDonSo}</span>
                          <span className="font-medium text-green-600">{formatCurrencyVND(item.soTien)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">Chưa có lịch sử thanh toán chi tiết để hiển thị.</p>}
                </InfoSection>

                {/* Payment Instructions */}
                {(studentInfo.tinhTrangThanhToan === 'Chưa thanh toán' || studentInfo.tinhTrangThanhToan === 'Quá hạn') && (
                  <InfoSection title="Hướng dẫn thanh toán" icon={<QrCode className="h-6 w-6 text-primary" />}>
                    <p className="font-semibold text-lg mb-2">Thông tin chuyển khoản:</p>
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                      <li>Số tài khoản: <strong className="text-foreground">9704229262085470</strong></li>
                      <li>Ngân hàng: <strong className="text-foreground">Ngân hàng Quân đội (MB Bank)</strong></li>
                      <li>Chủ tài khoản: <strong className="text-foreground">Tran Dong Phu</strong></li>
                      <li>Nội dung chuyển khoản: <strong className="text-destructive">HP {studentInfo.id}</strong></li>
                      <li>Số tiền cần thanh toán: <strong className="text-destructive">{hocPhiCanDongPlaceholder}</strong></li>
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
                       <p className="text-xs text-muted-foreground mt-1">(Mã QR này chỉ chứa nội dung CK, chưa bao gồm số tiền)</p>
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
    <span className={`font-medium ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
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
