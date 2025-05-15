
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { HocSinh, PaymentMethod, HocPhiGhiNhan } from "@/lib/types";
import { ALL_PAYMENT_METHODS } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import { cn, formatCurrencyVND } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const DIEN_GIAI_CHI_PHI_BO_SUNG = ["Tài liệu", "Chi phí khác"] as const;
const LY_DO_KHAU_TRU = ["GV vắng nhưng không dạy bù", "Học sinh nghỉ do hoàn cảnh", "Lớp nghỉ sớm", "Trường hợp khác"] as const;

const paymentFormSchema = z.object({
  ngayThanhToan: z.date({ required_error: "Ngày thanh toán không được để trống." }),
  phuongThucThanhToan: z.enum(ALL_PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]], { message: "Phương thức thanh toán không hợp lệ." }),
  
  chiPhiBoSung_soTien: z.coerce.number().nonnegative({message: "Số tiền phải lớn hơn hoặc bằng 0"}).optional().default(0),
  chiPhiBoSung_dienGiai: z.enum(["", ...DIEN_GIAI_CHI_PHI_BO_SUNG]).optional().default(""),
  
  hocPhiLinhHoat_soTien: z.coerce.number().nonnegative({message: "Số tiền phải lớn hơn hoặc bằng 0"}).optional().default(0),
  hocPhiLinhHoat_soBuoi: z.coerce.number().int().nonnegative({message: "Số buổi phải là số nguyên lớn hơn hoặc bằng 0"}).optional().default(0),

  khauTru_soTien: z.coerce.number().nonnegative({message: "Số tiền phải lớn hơn hoặc bằng 0"}).optional().default(0),
  khauTru_lyDo: z.enum(["", ...LY_DO_KHAU_TRU]).optional().default(""),

  ghiChu: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  student: HocSinh;
  expectedAmount: number; // This is the base tuition fee
  onSubmit: (data: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopId' | 'lopTen' | 'hoaDonSo'>) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function PaymentForm({ student, expectedAmount, onSubmit, onClose, isSubmitting }: PaymentFormProps) {
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      ngayThanhToan: new Date(),
      phuongThucThanhToan: "Chuyển khoản",
      chiPhiBoSung_soTien: 0,
      chiPhiBoSung_dienGiai: "",
      hocPhiLinhHoat_soTien: 0,
      hocPhiLinhHoat_soBuoi: 0,
      khauTru_soTien: 0,
      khauTru_lyDo: "",
      ghiChu: "",
    },
  });

  const [calculatedTotal, setCalculatedTotal] = React.useState(expectedAmount);

  const watchedFields = form.watch([
    "chiPhiBoSung_soTien",
    "hocPhiLinhHoat_soTien",
    "khauTru_soTien",
  ]);

  React.useEffect(() => {
    const baseAmountNum = Number(expectedAmount) || 0;
    const chiPhiBoSungNum = Number(form.getValues("chiPhiBoSung_soTien")) || 0;
    const hocPhiLinhHoatNum = Number(form.getValues("hocPhiLinhHoat_soTien")) || 0;
    const khauTruNum = Number(form.getValues("khauTru_soTien")) || 0;
    
    const newTotal = baseAmountNum + chiPhiBoSungNum + hocPhiLinhHoatNum - khauTruNum;
    setCalculatedTotal(newTotal < 0 ? 0 : newTotal); // Ensure total is not negative
  }, [watchedFields, expectedAmount, form]); // form.getValues reference is stable, but watching specific fields is better


  function handleSubmit(data: PaymentFormValues) {
    // data object from Zod will have correctly typed numbers
    const finalAmountToPay = Number(expectedAmount) + 
                             (data.chiPhiBoSung_soTien || 0) + 
                             (data.hocPhiLinhHoat_soTien || 0) - 
                             (data.khauTru_soTien || 0);
    
    const submissionData: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopId' | 'lopTen' | 'hoaDonSo'> = {
      ngayThanhToan: data.ngayThanhToan.toISOString(),
      soTienDaDong: finalAmountToPay < 0 ? 0 : finalAmountToPay, 
      soTienTheoChuKy: Number(expectedAmount) || 0, 
      phuongThucThanhToan: data.phuongThucThanhToan,
      chuKyDongPhi: student.chuKyThanhToan,
      ghiChu: data.ghiChu,
    };
    onSubmit(submissionData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div>
          <Label>Học sinh</Label>
          <p className="text-sm font-medium text-foreground">{student.hoTen} - Lớp: {student.tenLop || 'N/A'}</p>
        </div>
        <div>
          <Label>Học phí cơ bản</Label>
          <p className="text-sm font-medium text-primary">{formatCurrencyVND(expectedAmount)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        
        <Tabs defaultValue="chi-phi-bo-sung" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chi-phi-bo-sung">Chi phí bổ sung</TabsTrigger>
            <TabsTrigger value="hoc-phi-linh-hoat">Học phí linh hoạt</TabsTrigger>
            <TabsTrigger value="khau-tru">Khấu trừ</TabsTrigger>
          </TabsList>
          <TabsContent value="chi-phi-bo-sung" className="mt-4 space-y-4 p-4 border rounded-md">
            <FormField
              control={form.control}
              name="chiPhiBoSung_soTien"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VNĐ)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Nhập số tiền" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="chiPhiBoSung_dienGiai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diễn giải</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn diễn giải" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIEN_GIAI_CHI_PHI_BO_SUNG.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="hoc-phi-linh-hoat" className="mt-4 space-y-4 p-4 border rounded-md">
            <FormField
              control={form.control}
              name="hocPhiLinhHoat_soTien"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VNĐ)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Nhập số tiền" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="hocPhiLinhHoat_soBuoi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số buổi tương ứng</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Nhập số buổi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          <TabsContent value="khau-tru" className="mt-4 space-y-4 p-4 border rounded-md">
            <FormField
              control={form.control}
              name="khauTru_soTien"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VNĐ)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Nhập số tiền" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="khauTru_lyDo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lý do</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn lý do" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LY_DO_KHAU_TRU.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <FormField
          control={form.control}
          name="ghiChu"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú chung (tùy chọn)</FormLabel>
              <FormControl>
                <Textarea placeholder="Thêm ghi chú nếu cần..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4 space-y-2">
          <Label className="text-md">Tổng tiền thực đóng:</Label>
          <p className="text-2xl font-bold text-destructive">{formatCurrencyVND(calculatedTotal)}</p>
        </div>

        <div className="flex justify-end gap-2 pt-6">
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

      