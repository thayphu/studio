
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from 'nanoid';
import { format as formatDateFn, parseISO, addMonths, addDays, getDay, isSameDay, isBefore, isAfter, addWeeks, differenceInCalendarDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { HocSinh, LopHoc, DayOfWeek, PhieuLienLacRecord } from '@/lib/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrencyVND = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "N/A";
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const generateId = (prefix: string = '', length: number = 8): string => {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, length);
  return `${prefix}${nanoid()}`;
};

export const generateStudentId = (): string => {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(Math.random() * 10000); // Generates a number between 0 and 9999
  return `${year}${String(randomNumber).padStart(4, '0')}`; // Pads with leading zeros to ensure 4 digits
};

export const generateReceiptNumber = (): string => {
  const year = new Date().getFullYear();
  const orderNumber = Math.floor(Math.random() * 9999) + 1;
  return `${year}${String(orderNumber).padStart(4, '0')}`;
}

export const dayOfWeekToNumber = (dayName: DayOfWeek): number => {
  const map: Record<DayOfWeek, number> = {
    'Chủ Nhật': 0,
    'Thứ 2': 1,
    'Thứ 3': 2,
    'Thứ 4': 3,
    'Thứ 5': 4,
    'Thứ 6': 5,
    'Thứ 7': 6,
  };
  return map[dayName];
};

export const calculateCycleDisplayRange = (
  student: HocSinh,
  studentClassDetails: LopHoc | undefined,
  allStudentSlips?: PhieuLienLacRecord[] // Used by dialog to show range based on actual slips
): string => {
  console.log(`[utils.ts calculateCycleDisplayRange] Called for student: ${student.id}, class: ${studentClassDetails?.tenLop}`);
  if (!studentClassDetails || !studentClassDetails.chuKyDongPhi || !studentClassDetails.lichHoc || studentClassDetails.lichHoc.length === 0) {
    console.warn(`[utils.ts calculateCycleDisplayRange] Missing class details for student ${student.id}, class ${studentClassDetails?.id}`);
    return "N/A (Thiếu thông tin lớp)";
  }

  const cycleStartDateForDisplayStr = student.ngayThanhToanGanNhat || student.ngayDangKy;
  if (!cycleStartDateForDisplayStr) {
    console.warn(`[utils.ts calculateCycleDisplayRange] Missing start date for student ${student.id}`);
    return "N/A (Thiếu ngày bắt đầu)";
  }

  const cycleStartDateForDisplay = parseISO(cycleStartDateForDisplayStr);
  console.log(`[utils.ts calculateCycleDisplayRange] Start Date for Display: ${formatDateFn(cycleStartDateForDisplay, 'yyyy-MM-dd')}`);
  console.log(`[utils.ts calculateCycleDisplayRange] Cycle Type: ${studentClassDetails.chuKyDongPhi}`);
  console.log(`[utils.ts calculateCycleDisplayRange] Class Schedule (LopHoc): ${JSON.stringify(studentClassDetails.lichHoc)}`);

  const classScheduleDayNumbers = studentClassDetails.lichHoc.map(dayOfWeekToNumber).filter(n => n !== undefined) as number[];
  console.log(`[utils.ts calculateCycleDisplayRange] Class Schedule (Day Numbers): ${JSON.stringify(classScheduleDayNumbers)}`);


  if (classScheduleDayNumbers.length === 0 && (studentClassDetails.chuKyDongPhi === "8 buổi" || studentClassDetails.chuKyDongPhi === "10 buổi")) {
    return "N/A (Lịch học không hợp lệ)";
  }

  let calculatedEndDate: Date | null = null;

  if (studentClassDetails.chuKyDongPhi === "1 tháng") {
    calculatedEndDate = addDays(addMonths(cycleStartDateForDisplay, 1), -1);
  } else if (studentClassDetails.chuKyDongPhi === "8 buổi" || studentClassDetails.chuKyDongPhi === "10 buổi") {
    const sessionsInCycle = studentClassDetails.chuKyDongPhi === "8 buổi" ? 8 : 10;
    console.log(`[utils.ts calculateCycleDisplayRange] sessionsInCycle determined as: ${sessionsInCycle}`);
    let sessionsCounted = 0;
    let tempDate = new Date(cycleStartDateForDisplay);
    
    // Adjust tempDate to the first actual class day on or after cycleStartDateForDisplay
    let initialOffset = 0;
    while(!classScheduleDayNumbers.includes(getDay(tempDate))) {
        tempDate = addDays(tempDate, 1);
        initialOffset++;
        if (initialOffset > 7) { // Safety break if no valid class day found in a week
            console.error(`[utils.ts calculateCycleDisplayRange] Could not find first class day for student ${student.id} starting ${formatDateFn(cycleStartDateForDisplay, 'yyyy-MM-dd')}`);
            return "N/A (Lỗi lịch)";
        }
    }
    console.log(`[utils.ts calculateCycleDisplayRange] First actual class day for cycle: ${formatDateFn(tempDate, 'yyyy-MM-dd')}`);


    for (let i = 0; i < 365; i++) { // Safety break after 1 year of days
      // tempDate is already the current day to check
      console.log(`[utils.ts calculateCycleDisplayRange] Iterating: Date: ${formatDateFn(tempDate, 'yyyy-MM-dd')}, DayOfWeek: ${getDay(tempDate)}, sessionsCounted: ${sessionsCounted}`);
      if (classScheduleDayNumbers.includes(getDay(tempDate))) {
        sessionsCounted++;
        console.log(`[utils.ts calculateCycleDisplayRange] Counted session ${sessionsCounted} on ${formatDateFn(tempDate, 'yyyy-MM-dd')}`);
      }
      if (sessionsCounted >= sessionsInCycle) {
        calculatedEndDate = new Date(tempDate);
        break;
      }
      tempDate = addDays(tempDate, 1);
    }
  } else if (studentClassDetails.chuKyDongPhi === "Theo ngày") {
    calculatedEndDate = new Date(cycleStartDateForDisplay);
  }

  if (!calculatedEndDate) {
    console.warn(`[utils.ts calculateCycleDisplayRange] Could not calculate end date for student ${student.id}`);
    return "N/A (Lỗi tính toán)";
  }
  console.log(`[utils.ts calculateCycleDisplayRange] Calculated End Date: ${formatDateFn(calculatedEndDate, 'yyyy-MM-dd')}`);

  const finalStartDate = cycleStartDateForDisplay;
  const finalEndDate = calculatedEndDate;

  const rangeString = `${formatDateFn(finalStartDate, "dd/MM/yy", { locale: vi })} - ${formatDateFn(finalEndDate, "dd/MM/yy", { locale: vi })}`;
  console.log(`[utils.ts calculateCycleDisplayRange] Returning range: ${rangeString}`);
  return rangeString;
};

// Helper function to get the display text and color for mastery status
export const getMasteryDisplayDetails = (masteredLesson: boolean, masteryText?: string): { text: string; className: string } => {
  const defaultText = masteredLesson ? "Đã thuộc bài" : "Chưa thuộc bài";
  const textToDisplay = masteryText && masteryText.trim() !== "" ? masteryText : defaultText;

  if (masteredLesson) {
    return { text: textToDisplay, className: "text-blue-600 dark:text-blue-400 font-medium" };
  }
  return { text: textToDisplay, className: "text-red-600 dark:text-red-400 font-medium" };
};

// Helper function to get the display text and color for homework status
export const getHomeworkDisplayDetails = (homeworkStatus?: string): { text: string; className: string } => {
  if (!homeworkStatus || homeworkStatus.trim() === "") {
    return { text: "Không có bài tập về nhà", className: "text-muted-foreground" };
  }
  switch (homeworkStatus) {
    case "Đã làm bài đầy đủ":
      return { text: homeworkStatus, className: "text-blue-600 dark:text-blue-400 font-medium" };
    case "Chỉ làm bài 1 phần":
    case "Chỉ làm 2/3 bài":
      return { text: homeworkStatus, className: "text-orange-500 dark:text-orange-400 font-medium" };
    case "Không làm bài":
      return { text: homeworkStatus, className: "text-red-600 dark:text-red-400 font-medium" };
    default:
      return { text: homeworkStatus, className: "text-muted-foreground" };
  }
};

export const calculateMasteryDetailsForPLL = (testFormat?: string, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (!testFormat || testFormat === "") {
    return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
  }
  if (testFormat === "KT bài cũ") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Thuộc bài, còn sai sót 1 vài từ", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài, còn sai sót nhiều", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT miệng") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    if (score !== null) return { text: "Cần cố gắng hơn", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") {
    return { text: "Không có KT bài", isTrulyMastered: false };
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
};
