
export type DayOfWeek = 'Thứ 2' | 'Thứ 3' | 'Thứ 4' | 'Thứ 5' | 'Thứ 6' | 'Thứ 7' | 'Chủ Nhật';
export const ALL_DAYS_OF_WEEK: DayOfWeek[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export type PaymentCycle = '1 tháng' | '8 buổi' | '10 buổi' | 'Theo ngày';
export const ALL_PAYMENT_CYCLES: PaymentCycle[] = ['1 tháng', '8 buổi', '10 buổi', 'Theo ngày'];


export interface LopHoc {
  id: string;
  tenLop: string;
  lichHoc: DayOfWeek[];
  gioHoc: string; // e.g., "18:00 - 19:30"
  diaDiem: string;
  hocPhi: number;
  chuKyDongPhi: PaymentCycle;
  soHocSinhHienTai: number;
  trangThai: 'Đang hoạt động' | 'Đã đóng';
}

// StudentSalutation and ALL_STUDENT_SALUTATIONS removed

export type PaymentStatus = 'Đã thanh toán' | 'Chưa thanh toán' | 'Quá hạn';

export interface HocSinh {
  id: string; // Mã HS: YYYYXXXX
  hoTen: string;
  ngaySinh: string; // ISO Date string
  diaChi: string;
  lopId: string;
  tenLop?: string; // Denormalized for display
  ngayDangKy: string; // ISO Date string
  chuKyThanhToan: PaymentCycle;
  tinhTrangThanhToan: PaymentStatus;
  ngayThanhToanGanNhat?: string; // ISO Date string
  soBuoiDaHocTrongChuKy?: number; // For session-based cycles
}

export interface HocPhiGhiNhan {
  id: string;
  hocSinhId: string;
  hocSinhTen?: string; // Denormalized
  lopTen?: string; // Denormalized
  ngayDong: string; // ISO Date string
  soTien: number;
  chuKyDaDong: PaymentCycle;
  hoaDonSo: string; // YYYY-XXX
}

export type AttendanceStatus = 'Có mặt' | 'Vắng mặt' | 'GV nghỉ' | 'Học bù';

export interface DiemDanhGhiNhan {
  id: string;
  hocSinhId: string;
  lopId: string;
  ngayDiemDanh: string; // ISO Date string
  trangThai: AttendanceStatus;
}

