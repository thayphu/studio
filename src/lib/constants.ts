
import type { LucideIcon } from 'lucide-react';
import { Users, CreditCard, UserCheck, BarChart3, Search, School, ClipboardList, Award, FileQuestion, Home } from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/lop-hoc", label: "Lớp học", icon: School },
  { href: "/hoc-sinh", label: "Học sinh", icon: Users },
  { href: "/hoc-phi", label: "Học phí", icon: CreditCard },
  { href: "/diem-danh", label: "Điểm danh", icon: UserCheck },
  { href: "/phieu-lien-lac", label: "Phiếu liên lạc", icon: ClipboardList },
  // { href: "/bai-kiem-tra", label: "Đề kiểm tra", icon: FileQuestion }, // Feature removed
  { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 },
  { href: "/xep-hang", label: "Xếp hạng", icon: Award },
];

export const PARENT_PORTAL_LINK = {
  href: "/cong-phu-huynh", // Updated link
  label: "Cổng thông tin Phụ huynh",
  icon: Search
};

// Vietnamese Texts
export const TEXTS_VI = {
  appName: "HoEdu Solution",
  loginTitle: "Đăng nhập quản trị",
  usernameLabel: "Email",
  passwordLabel: "Mật khẩu",
  loginButton: "Đăng nhập",
  logoutButton: "Đăng xuất",
  // Add Class Form
  addClassTitle: "Thêm lớp mới",
  classNameLabel: "Tên lớp",
  scheduleLabel: "Lịch học",
  classTimeLabel: "Giờ học (VD: 18:00 - 19:30)",
  locationLabel: "Địa điểm",
  feeLabel: "Học phí (VNĐ)",
  paymentCycleLabel: "Chu kỳ thanh toán",
  saveButton: "Lưu",
  cancelButton: "Hủy",
  // Class Card
  currentStudentsLabel: "Học sinh hiện tại",
  statusLabel: "Trạng thái",
  activeStatus: "Đang hoạt động",
  closedStatus: "Đã đóng",
  editButton: "Sửa",
  deleteButton: "Xóa",
  closeClassButton: "Đóng lớp",
  addStudentButton: "Thêm HS",
  noClassesFound: "Chưa có lớp học nào. Hãy thêm lớp mới!",
};

export const WEEKDAYS_VI: Record<string, number> = {
  'Chủ Nhật': 0,
  'Thứ 2': 1,
  'Thứ 3': 2,
  'Thứ 4': 3,
  'Thứ 5': 4,
  'Thứ 6': 5,
  'Thứ 7': 6,
};
