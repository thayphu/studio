
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from 'nanoid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatCurrencyVND = (amount: number | undefined): string => {
  if (amount === undefined || isNaN(amount)) {
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
  // This should ideally come from a persistent counter from the database
  // For now, using a random number as a placeholder
  const orderNumber = Math.floor(Math.random() * 9999) + 1; 
  return `${year}${String(orderNumber).padStart(4, '0')}`; // Removed hyphen
}

// Helper to convert Vietnamese day name to a number (0 for Sunday, 1 for Monday, etc.)
// consistent with Date.getDay()
export const dayOfWeekToNumber = (dayName: string): number | undefined => {
  const map: { [key: string]: number } = {
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
