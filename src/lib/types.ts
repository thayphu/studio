
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
}

export interface StudentRankingInfo {
  studentId: string;
  studentName: string;
  classId?: string;
  className?: string;
  totalScore: number;
  rank?: number;
}

// Types for Quiz/Question Bank Feature
export type OptionLabel = 'A' | 'B' | 'C' | 'D';
export const ALL_OPTION_LABELS: OptionLabel[] = ['A', 'B', 'C', 'D'];

export interface MultipleChoiceOption {
  id: OptionLabel; // A, B, C, D
  text: string;
}

export type GradeLevel =
  | "Lớp 1" | "Lớp 2" | "Lớp 3" | "Lớp 4" | "Lớp 5"
  | "Lớp 6" | "Lớp 7" | "Lớp 8" | "Lớp 9"
  | "Lớp 10" | "Lớp 11" | "Lớp 12" | "Khác";

export const ALL_GRADE_LEVELS: GradeLevel[] = [
  "Lớp 1", "Lớp 2", "Lớp 3", "Lớp 4", "Lớp 5",
  "Lớp 6", "Lớp 7", "Lớp 8", "Lớp 9",
  "Lớp 10", "Lớp 11", "Lớp 12", "Khác"
];

export type CurriculumType = "Global Success" | "Friends plus" | "I learn smart";
export const ALL_CURRICULUM_TYPES: CurriculumType[] = ["Global Success", "Friends plus", "I learn smart"];

export type TestBankType = "15 phút" | "45 phút" | "Giữa kỳ" | "Cuối kỳ";
export const ALL_TEST_BANK_TYPES: TestBankType[] = ["15 phút", "45 phút", "Giữa kỳ", "Cuối kỳ"];

export type QuestionType = "Nhiều lựa chọn" | "True/False" | "Tự luận";
export const ALL_QUESTION_TYPES: QuestionType[] = ["Nhiều lựa chọn", "True/False", "Tự luận"];

export interface QuestionBankEntry {
  id: string; // Firestore document ID
  gradeLevel: GradeLevel;
  curriculumType: CurriculumType; // Added curriculum type
  testBankType: TestBankType;
  questionType: QuestionType;
  text: string; // Question content
  options?: MultipleChoiceOption[]; // For multiple choice
  correctOptionId?: OptionLabel;   // For multiple choice
  correctBooleanAnswer?: boolean; // For True/False
  modelAnswer?: string;           // For Essay (optional)
  tags?: string[];                // Optional tags for further categorization
  createdAt: string;              // ISO string
  updatedAt: string;              // ISO string
}
