
"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserCircle, School, CalendarDays, FileText, PieChart, QrCode } from 'lucide-react';
import Image from 'next/image';

export default function PhuHuynhPage() {
  const [studentId, setStudentId] = useState('');
  const [studentInfo, setStudentInfo] = useState<any>(null); // Replace 'any' with actual type
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock data - replace with actual data fetching logic
    if (studentId === "2024001") {
      setStudentInfo({
        hoTen: "Nguyễn Văn An",
        maHS: "2024001",
        lop: "Lớp 1A",
        ngayDangKy: "15/08/2024",
        chuKyThanhToan: "1 tháng",
        trangThaiThanhToan: "Chưa thanh toán",
        // ... other details
        tongBuoiHoc: 20,
        buoiCoMat: 18,
        buoiVang: 2,
        buoiGVVang: 0,
        lichSuDiemDanh: [
          { ngay: "01/09/2024", trangThai: "Có mặt" },
          { ngay: "03/09/2024", trangThai: "Vắng mặt" },
        ],
        lichSuThanhToan: [],
        hocPhiCanDong: 1200000,
      });
    } else {
      setStudentInfo(null);
    }
    setIsLoading(false);
  };

  const qrAmount = studentInfo?.hocPhiCanDong || 0;
  const qrInfo = `HP ${studentInfo?.maHS || ''}`;
  const qrLink = `https://api.vietqr.io/v2/generate?accountNo=9704229262085470&accountName=Tran Dong Phu&acqId=970422&amount=${qrAmount}&addInfo=${encodeURIComponent(qrInfo)}&template=compact`;


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-blue-50 to-yellow-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-primary mx-auto mb-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
           </svg>
          <h1 className="text-4xl font-extrabold text-primary sm:text-5xl">
            HoEdu Solution
          </h1>
          <p className="mt-3 text-xl text-gray-600">
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
                onChange={(e) => setStudentId(e.target.value)}
                className="flex-grow text-base h-12"
                required
              />
              <Button type="submit" className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
                {isLoading ? 'Đang tìm...' : 'Tra cứu'}
              </Button>
            </form>

            {isLoading && <p className="text-center text-gray-600">Đang tải thông tin...</p>}
            
            {!isLoading && studentInfo && (
              <div className="space-y-8">
                {/* Basic Info */}
                <InfoSection title="Thông tin chung" icon={<UserCircle className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Họ và tên" value={studentInfo.hoTen} />
                  <InfoRow label="Mã HS" value={studentInfo.maHS} />
                  <InfoRow label="Lớp" value={studentInfo.lop} icon={<School className="h-5 w-5 text-gray-500" />} />
                  <InfoRow label="Ngày đăng ký" value={studentInfo.ngayDangKy} icon={<CalendarDays className="h-5 w-5 text-gray-500" />} />
                </InfoSection>

                {/* Payment Info */}
                <InfoSection title="Thông tin học phí" icon={<FileText className="h-6 w-6 text-primary" />}>
                  <InfoRow label="Chu kỳ thanh toán" value={studentInfo.chuKyThanhToan} />
                  <InfoRow label="Trạng thái" value={studentInfo.trangThaiThanhToan} highlight={studentInfo.trangThaiThanhToan === 'Chưa thanh toán' || studentInfo.trangThaiThanhToan === 'Quá hạn'} />
                </InfoSection>

                {/* Attendance Stats */}
                 <InfoSection title="Thống kê điểm danh" icon={<PieChart className="h-6 w-6 text-primary" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <StatBox label="Tổng buổi đã học" value={studentInfo.tongBuoiHoc} color="bg-blue-100 text-blue-700" />
                    <StatBox label="Buổi có mặt" value={studentInfo.buoiCoMat} color="bg-green-100 text-green-700" />
                    <StatBox label="Buổi vắng" value={studentInfo.buoiVang} color="bg-red-100 text-red-700" />
                    <StatBox label="GV vắng" value={studentInfo.buoiGVVang} color="bg-yellow-100 text-yellow-700" />
                  </div>
                </InfoSection>

                {/* Attendance History */}
                <InfoSection title="Lịch sử điểm danh" icon={<CalendarDays className="h-6 w-6 text-primary" />}>
                  {studentInfo.lichSuDiemDanh.length > 0 ? (
                    <ul className="space-y-2">
                      {studentInfo.lichSuDiemDanh.map((item: any, index: number) => (
                        <li key={index} className="flex justify-between p-2 bg-gray-50 rounded-md">
                          <span>{item.ngay}</span>
                          <span className={`font-medium ${item.trangThai === 'Có mặt' ? 'text-green-600' : 'text-red-600'}`}>{item.trangThai}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-gray-500">Chưa có lịch sử điểm danh.</p>}
                </InfoSection>

                {/* Payment History */}
                <InfoSection title="Lịch sử thanh toán" icon={<FileText className="h-6 w-6 text-primary" />}>
                   {studentInfo.lichSuThanhToan.length > 0 ? (
                    <ul className="space-y-2">
                      {studentInfo.lichSuThanhToan.map((item: any, index: number) => (
                        <li key={index} className="flex justify-between p-2 bg-gray-50 rounded-md">
                          <span>{item.ngayThanhToan} - HĐ: {item.hoaDonSo}</span>
                          <span className="font-medium text-green-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.soTien)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-gray-500">Chưa có lịch sử thanh toán.</p>}
                </InfoSection>

                {/* Payment Instructions */}
                {(studentInfo.trangThaiThanhToan === 'Chưa thanh toán' || studentInfo.trangThaiThanhToan === 'Quá hạn') && (
                  <InfoSection title="Hướng dẫn thanh toán" icon={<QrCode className="h-6 w-6 text-primary" />}>
                    <p className="font-semibold text-lg mb-2">Thông tin chuyển khoản:</p>
                    <ul className="space-y-1 list-disc list-inside text-gray-700">
                      <li>Số tài khoản: <strong className="text-gray-900">9704229262085470</strong></li>
                      <li>Ngân hàng: <strong className="text-gray-900">Ngân hàng Quân đội (MB Bank)</strong></li>
                      <li>Chủ tài khoản: <strong className="text-gray-900">Tran Dong Phu</strong></li>
                      <li>Nội dung chuyển khoản: <strong className="text-red-600">HP {studentInfo.maHS}</strong></li>
                      <li>Số tiền cần thanh toán: <strong className="text-red-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(studentInfo.hocPhiCanDong)}</strong></li>
                    </ul>
                    <div className="mt-6 text-center">
                      <p className="mb-2 font-medium">Hoặc quét mã QR:</p>
                      <Image 
                        src={qrLink} 
                        alt="QR Code thanh toán" 
                        width={200} 
                        height={200} 
                        className="mx-auto rounded-lg shadow-md"
                        data-ai-hint="payment qrcode"
                      />
                    </div>
                  </InfoSection>
                )}

              </div>
            )}
            {!isLoading && !studentInfo && studentId && (
              <p className="text-center text-red-600 font-medium">Không tìm thấy thông tin học sinh với mã "{studentId}".</p>
            )}
          </CardContent>
        </Card>
         <footer className="mt-12 text-center text-sm text-gray-500">
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
  <div className="border-t border-gray-200 pt-6">
    <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
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
    <span className="text-gray-600 flex items-center">
      {icon && <span className="mr-1.5">{icon}</span>}
      {label}:
    </span>
    <span className={`font-medium ${highlight ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
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

