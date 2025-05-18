
export type DayOfWeek = 'Thứ 2' | 'Thứ 3' | 'Thứ 4' | 'Thứ 5' | 'Thứ 6' | 'Thứ 7' | 'Chủ Nhật';
export const ALL_DAYS_OF_WEEK: DayOfWeek[] = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export type PaymentCycle = '1 tháng' | '8 buổi' | '10 buổi' | 'Theo ngày';
export const ALL_PAYMENT_CYCLES: PaymentCycle[] = ['1 tháng', '8 buổi', '10 buổi', 'Theo ngày'];

export type PaymentMethod = 'Tiền mặt' | 'Chuyển khoản' | 'Khác';
export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['Tiền mặt', 'Chuyển khoản', 'Khác'];

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
  ngayDongLop?: string; // YYYYMMDD format
}

export type PaymentStatus = 'Đã thanh toán' | 'Chưa thanh toán' | 'Quá hạn';

export interface HocSinh {
  id: string; // Mã HS: YYYYXXXX
  hoTen: string;
  ngaySinh: string; // ISO Date string
  diaChi: string;
  soDienThoai?: string;
  lopId: string;
  tenLop?: string; // Denormalized for display
  ngayDangKy: string; // ISO Date string
  chuKyThanhToan: PaymentCycle;
  tinhTrangThanhToan: PaymentStatus;
  ngayThanhToanGanNhat?: string; // ISO Date string
  soBuoiDaHocTrongChuKy?: number; // For session-based cycles
}

export interface HocPhiGhiNhan {
  id: string; // Tự động tạo khi ghi nhận
  hocSinhId: string;
  hocSinhTen?: string; // Denormalized
  lopId?: string;
  lopTen?: string; // Denormalized
  ngayThanhToan: string; // ISO Date string, from form
  soTienDaDong: number; // from form
  soTienTheoChuKy: number; // expected tuition fee for the cycle
  phuongThucThanhToan: PaymentMethod; // from form
  chuKyDongPhi: PaymentCycle; // from student/class
  ghiChu?: string; // from form
  hoaDonSo?: string; // Tự động tạo dạng YYYY-XXXX
}


export type AttendanceStatus = 'Có mặt' | 'Vắng mặt' | 'GV nghỉ' | 'Học bù';
export const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = ['Có mặt', 'Vắng mặt', 'GV nghỉ', 'Học bù'];

export interface DiemDanhGhiNhan {
  id: string; // Auto-generated when recording
  hocSinhId: string;
  lopId: string;
  ngayDiemDanh: string; // ISO Date string (YYYYMMDD)
  trangThai: AttendanceStatus;
  ghiChu?: string;
  // Add hoTen and tenLop for modal display if needed directly from this record
  hoTen?: string; // Denormalized student name
  tenLop?: string; // Denormalized class name
}


export type MakeupClassStatus = 'chờ xếp lịch' | 'đã xếp lịch' | 'đã hoàn thành' | 'đã hủy';
export const ALL_MAKEUP_CLASS_STATUSES: MakeupClassStatus[] = ['chờ xếp lịch' , 'đã xếp lịch' , 'đã hoàn thành' , 'đã hủy'];


export interface GiaoVienVangRecord {
  id: string; // Auto-generated
  classId: string;
  className: string; // Denormalized for easier display
  originalDate: string; // YYYYMMDD format
  status: MakeupClassStatus;
  makeupDate?: string; // YYYYMMDD format, if scheduled
  makeupTime?: string; // e.g., "18:00 - 19:30", if scheduled
  notes?: string;
  createdAt: string; // ISO Date string
}

// Types for PhieuLienLac (PLC)
export type TestFormatPLC = "KT bài cũ" | "KT 15 phút" | "KT 45 Phút" | "Làm bài tập" | "KT miệng";
export const ALL_TEST_FORMATS_PLC: TestFormatPLC[] = ["KT bài cũ", "KT miệng", "KT 15 phút", "KT 45 Phút", "Làm bài tập"];

export type HomeworkStatusPLC = "Đã làm bài đầy đủ" | "Chỉ làm bài 1 phần" | "Chỉ làm 2/3 bài" | "Không làm bài";
export const ALL_HOMEWORK_STATUSES_PLC: HomeworkStatusPLC[] = ["Đã làm bài đầy đủ", "Chỉ làm bài 1 phần", "Chỉ làm 2/3 bài", "Không làm bài"];

export interface PhieuLienLacRecord {
  id: string; // Auto-generated Firestore ID
  studentId: string;
  studentName?: string; // Denormalized
  classId: string;
  className?: string; // Denormalized
  date: string; // YYYY-MM-DD, date of the assessment/communication
  testFormat?: TestFormatPLC;
  score?: number | null;
  lessonMasteryText?: string; // Calculated text for "Thuộc bài"
  homeworkStatus?: HomeworkStatusPLC;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkAssignmentVocabulary?: string; // Common homework vocab for the class/date
  homeworkAssignmentTasks?: string;    // Common homework tasks for the class/date
  createdAt?: string; // ISO string, Firestore server timestamp
  updatedAt?: string; // ISO string, Firestore server timestamp
}

export interface StudentSlipInput {
  testFormat?: TestFormatPLC;
  score?: string | number | null; // Input can be string
  lessonMasteryText?: string; // Displayed text, not directly input
  homeworkStatus?: HomeworkStatusPLC;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkAssignmentVocabulary?: string;
  homeworkAssignmentTasks?: string;
}
