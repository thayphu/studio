
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, CreditCard, UserCheck, BarChart3, Search, LogOut, School } from 'lucide-react';

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
  { href: "/bao-cao", label: "Báo cáo", icon: BarChart3 },
];

export const PARENT_PORTAL_LINK = { 
  href: "/phu-huynh", 
  label: "Cổng thông tin Phụ huynh",
  icon: Search 
};

// Admin Credentials - WARNING: Storing credentials in client-side code is insecure.
// Consider using Firebase Authentication or another secure method for production.
export const ADMIN_USERNAME = "dongphubte@gmail.com";
export const ADMIN_PASSWORD_TEMP = "@Quantriweb2013"; 


// Vietnamese Texts
export const TEXTS_VI = {
  appName: "HoEdu Solution",
  loginTitle: "Đăng nhập quản trị",
  usernameLabel: "Tên đăng nhập",
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
  // Generic
  loading: "Đang tải...",
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

