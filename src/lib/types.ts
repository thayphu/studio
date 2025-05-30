
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
  hoTen?: string;
  tenLop?: string;
}


export type MakeupClassStatus = 'chờ xếp lịch' | 'đã xếp lịch' | 'đã hoàn thành' | 'đã hủy';
export const ALL_MAKEUP_CLASS_STATUSES: MakeupClassStatus[] = ['chờ xếp lịch' , 'đã xếp lịch' , 'đã hoàn thành' , 'đã hủy'];


export interface GiaoVienVangRecord {
  id: string;
  classId: string;
  className: string;
  originalDate: string; // YYYYMMDD format
  status: MakeupClassStatus;
  makeupDate?: string; // YYYYMMDD format, if scheduled
  makeupTime?: string; // e.g., "18:00 - 19:30", if scheduled
  notes?: string;
  createdAt: string; // ISO Date string
}

// Types for PhieuLienLac (PLC)
export type TestFormatPLC = "KT bài cũ" | "KT miệng" | "KT 15 phút" | "KT 45 Phút" | "Làm bài tập" | "";
export const ALL_TEST_FORMATS_PLC: TestFormatPLC[] = ["KT bài cũ", "KT miệng", "KT 15 phút", "KT 45 Phút", "Làm bài tập"];

export type HomeworkStatusPLC = "Đã làm bài đầy đủ" | "Chỉ làm bài 1 phần" | "Chỉ làm 2/3 bài" | "Không làm bài" | "";
export const ALL_HOMEWORK_STATUSES_PLC: HomeworkStatusPLC[] = ["Đã làm bài đầy đủ", "Chỉ làm bài 1 phần", "Chỉ làm 2/3 bài", "Không làm bài"];

export interface PhieuLienLacRecord {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  className?: string;
  date: string; // YYYY-MM-DD
  testFormat?: TestFormatPLC;
  score?: number | null;
  lessonMasteryText?: string;
  homeworkStatus?: HomeworkStatusPLC;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkAssignmentVocabulary?: string;
  homeworkAssignmentTasks?: string;
  periodicSummaryRemark?: string; // New field for summary remark of the cycle
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentSlipInput {
  testFormat?: TestFormatPLC;
  score?: string | number | null;
  lessonMasteryText?: string;
  homeworkStatus?: HomeworkStatusPLC;
  vocabularyToReview?: string;
  remarks?: string;
  homeworkAssignmentVocabulary?: string;
  homeworkAssignmentTasks?: string;
  // periodicSummaryRemark is not part of daily input, but part of the record
}

export interface StudentRankingInfo {
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  totalScore: number;
  rank?: number;
}

// Types for TestScoreRecord (used for ranking, populated from PhieuLienLacRecord)
export interface TestScoreRecord {
  id: string; // Can be the ID of the PhieuLienLacRecord
  studentId: string;
  classId?: string;
  score: number; // Score from PhieuLienLacRecord
  testDate?: string; // Date from PhieuLienLacRecord
}
