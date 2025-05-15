
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { HocSinh, PaymentMethod, HocPhiGhiNhan } from "@/lib/types"; 
import { ALL_PAYMENT_METHODS } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import { cn, formatCurrencyVND } from "@/lib/utils";
import { Label } from "@/components/ui/label";


const paymentFormSchema = z.object({
  ngayThanhToan: z.date({ required_error: "Ngày thanh toán không được để trống." }),
  soTienDaDong: z.coerce.number().min(1, { message: "Số tiền phải lớn hơn 0." }),
  phuongThucThanhToan: z.enum(ALL_PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { message: "Phương thức thanh toán không hợp lệ." }),
  ghiChu: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  student: HocSinh;
  expectedAmount: number;
  onSubmit: (data: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopId' | 'lopTen' | 'hoaDonSo'>) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function PaymentForm({ student, expectedAmount, onSubmit, onClose, isSubmitting }: PaymentFormProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      ngayThanhToan: new Date(),
      soTienDaDong: expectedAmount,
      phuongThucThanhToan: "Chuyển khoản",
      ghiChu: "",
    },
  });

  React.useEffect(() => {
    form.setValue("soTienDaDong", expectedAmount);
  }, [expectedAmount, form]);

  function handleSubmit(data: PaymentFormValues) {
    const submissionData: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopId' | 'lopTen' | 'hoaDonSo'> = {
      ngayThanhToan: data.ngayThanhToan.toISOString(),
      soTienDaDong: data.soTienDaDong,
      soTienTheoChuKy: expectedAmount,
      phuongThucThanhToan: data.phuongThucThanhToan,
      chuKyDongPhi: student.chuKyThanhToan, // Assuming student object has this from their class
      ghiChu: data.ghiChu,
    };
    onSubmit(submissionData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div>
          <Label>Học sinh</Label>
          <p className="text-sm font-medium text-foreground">{student.hoTen} - Lớp: {student.tenLop || 'N/A'}</p>
        </div>
        <div>
          <Label>Số tiền cần đóng (dự kiến)</Label>
          <p className="text-sm font-medium text-destructive">{formatCurrencyVND(expectedAmount)}</p>
        </div>

        <FormField
          control={form.control}
          name="ngayThanhToan"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Ngày thanh toán</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "dd/MM/yyyy", { locale: vi })
                      ) : (
                        <span>Chọn ngày</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="soTienDaDong"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Số tiền thực đóng (VNĐ)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Nhập số tiền đã đóng" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phuongThucThanhToan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phương thức thanh toán</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn phương thức" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ALL_PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>{method}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ghiChu"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú (tùy chọn)</FormLabel>
              <FormControl>
                <Textarea placeholder="Thêm ghi chú nếu cần..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {TEXTS_VI.cancelButton}
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : "Xác nhận thanh toán"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
