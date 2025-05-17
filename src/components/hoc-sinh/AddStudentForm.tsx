
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, parse, parseISO } from "date-fns";
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
import type { HocSinh, PaymentCycle, LopHoc } from "@/lib/types"; 
import { ALL_PAYMENT_CYCLES } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import { generateStudentId, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

const studentFormSchema = z.object({
  hoTen: z.string().min(3, { message: "Họ tên phải có ít nhất 3 ký tự." }),
  ngaySinh: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, { message: "Ngày sinh phải có định dạng DD/MM/YYYY." }),
  diaChi: z.string().min(5, { message: "Địa chỉ phải có ít nhất 5 ký tự." }),
  soDienThoai: z.string().optional().refine(val => !val || /^\d{10,11}$/.test(val), { message: "Số điện thoại không hợp lệ (10-11 số)." }),
  lopId: z.string().min(1, { message: "Vui lòng chọn lớp học." }),
  ngayDangKy: z.date({ required_error: "Ngày đăng ký không được để trống." }),
  chuKyThanhToan: z.enum(ALL_PAYMENT_CYCLES as [PaymentCycle, ...PaymentCycle[]], { message: "Chu kỳ thanh toán không hợp lệ." }),
});

type StudentFormInputValues = z.infer<typeof studentFormSchema>;

interface AddStudentFormProps {
  onSubmit: (data: HocSinh) => void;
  onClose: () => void;
  existingClasses: LopHoc[];
  initialData?: HocSinh | null;
  isEditing?: boolean;
  isSubmitting?: boolean;
  initialClassId?: string | null;
}

const capitalizeWords = (str: string): string => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function AddStudentForm({ 
  onSubmit, 
  onClose, 
  existingClasses, 
  initialData, 
  isEditing = false, 
  isSubmitting = false,
  initialClassId = null,
}: AddStudentFormProps) {
  const { toast } = useToast();
  const [displayStudentId, setDisplayStudentId] = React.useState('');

  const form = useForm<StudentFormInputValues>({
    resolver: zodResolver(studentFormSchema),
    // Default values are set in useEffect based on mode
  });
  
  const selectedLopId = form.watch('lopId');

  React.useEffect(() => {
    console.log("[AddStudentForm] useEffect for form init/reset triggered. isEditing:", isEditing, "initialData:", initialData, "initialClassId:", initialClassId);
    if (isEditing && initialData) {
      console.log("[AddStudentForm] Setting form for EDIT mode. Student ID:", initialData.id);
      setDisplayStudentId(initialData.id);
      form.reset({
        hoTen: initialData.hoTen,
        ngaySinh: format(parseISO(initialData.ngaySinh), "dd/MM/yyyy", { locale: vi }),
        diaChi: initialData.diaChi,
        soDienThoai: initialData.soDienThoai || "",
        lopId: initialData.lopId,
        ngayDangKy: parseISO(initialData.ngayDangKy),
        chuKyThanhToan: initialData.chuKyThanhToan as PaymentCycle,
      });
    } else if (!isEditing) { // Add mode
      const newStudentId = generateStudentId();
      console.log("[AddStudentForm] Setting form for ADD mode. Generated Student ID:", newStudentId, "Received initialClassId:", initialClassId);
      setDisplayStudentId(newStudentId);

      let defaultLopId = "";
      let defaultChuKyThanhToan: PaymentCycle = "1 tháng";

      if (initialClassId && existingClasses && existingClasses.length > 0) {
        const selectedClass = existingClasses.find(cls => cls.id === initialClassId);
        if (selectedClass) {
          defaultLopId = selectedClass.id;
          defaultChuKyThanhToan = selectedClass.chuKyDongPhi;
          console.log(`[AddStudentForm] Pre-filling for Add mode. Class: ${selectedClass.tenLop} (ID: ${defaultLopId}), Payment Cycle: ${defaultChuKyThanhToan}`);
        } else {
          console.warn(`[AddStudentForm] Initial class ID "${initialClassId}" provided but not found in existing classes. Using defaults for payment cycle, but will use initialClassId for lopId if it was passed.`);
          defaultLopId = initialClassId; // Still attempt to set lopId if initialClassId was passed
        }
      } else if (initialClassId) {
          defaultLopId = initialClassId; // Set lopId if initialClassId is passed, even if class details for cycle aren't found yet
          console.warn(`[AddStudentForm] Initial class ID "${initialClassId}" provided, but existingClasses is empty or not yet loaded. Setting lopId, using default payment cycle.`);
      } else {
        console.log("[AddStudentForm] No initialClassId provided for Add mode. Using default empty lopId.");
      }

      form.reset({
        hoTen: "",
        ngaySinh: "",
        diaChi: "",
        soDienThoai: "",
        lopId: defaultLopId,
        ngayDangKy: new Date(),
        chuKyThanhToan: defaultChuKyThanhToan,
      });
    }
  }, [isEditing, initialData, initialClassId, existingClasses, form]);


  React.useEffect(() => {
    // This effect updates the payment cycle if the class is changed *manually* in the form,
    // and it's not in edit mode, and the manually selected lopId is different from any initialClassId.
    const currentLopIdValue = form.getValues('lopId');
    if (!isEditing && currentLopIdValue && currentLopIdValue !== initialClassId && existingClasses && existingClasses.length > 0) {
      console.log(`[AddStudentForm] Manual class selection changed to: ${currentLopIdValue}. initialClassId was: ${initialClassId}`);
      const selectedClass = existingClasses.find(cls => cls.id === currentLopIdValue);
      if (selectedClass && selectedClass.chuKyDongPhi !== form.getValues('chuKyThanhToan')) {
        console.log(`[AddStudentForm] Auto-updating payment cycle to: ${selectedClass.chuKyDongPhi} for class ${selectedClass.tenLop}`);
        form.setValue('chuKyThanhToan', selectedClass.chuKyDongPhi, { shouldValidate: true });
      }
    }
  }, [form.watch('lopId'), existingClasses, isEditing, initialClassId, form]);


  function handleSubmit(data: StudentFormInputValues) {
    let ngaySinhISO: string;
    try {
      const parsedNgaySinh = parse(data.ngaySinh, "dd/MM/yyyy", new Date());
      if (isNaN(parsedNgaySinh.getTime())) {
        throw new Error("Ngày sinh không hợp lệ");
      }
      const year = parsedNgaySinh.getFullYear();
      if (year < 1900 || year > new Date().getFullYear()) {
         toast({
            title: "Năm sinh không hợp lệ",
            description: "Vui lòng nhập năm sinh trong khoảng 1900 đến năm hiện tại.",
            variant: "destructive",
        });
        return;
      }
      ngaySinhISO = parsedNgaySinh.toISOString();
    } catch (error) {
      toast({
        title: "Định dạng ngày sinh không đúng",
        description: "Vui lòng nhập ngày sinh theo định dạng DD/MM/YYYY và đảm bảo ngày hợp lệ.",
        variant: "destructive",
      });
      return;
    }

    const submissionData: HocSinh = {
      id: displayStudentId, // For new, this is generated; for edit, this is from initialData via displayStudentId
      ...data,
      hoTen: capitalizeWords(data.hoTen),
      ngaySinh: ngaySinhISO,
      ngayDangKy: data.ngayDangKy.toISOString(),
      soDienThoai: data.soDienThoai || undefined,
      tenLop: isEditing && initialData ? initialData.tenLop : (existingClasses.find(c=>c.id === data.lopId)?.tenLop || 'N/A'), 
      tinhTrangThanhToan: isEditing && initialData ? initialData.tinhTrangThanhToan : "Chưa thanh toán",
      ngayThanhToanGanNhat: isEditing && initialData ? initialData.ngayThanhToanGanNhat : undefined,
      soBuoiDaHocTrongChuKy: isEditing && initialData ? initialData.soBuoiDaHocTrongChuKy : undefined,
    };
    console.log("[AddStudentForm] Submitting data:", submissionData);
    onSubmit(submissionData);
  }
  
  const submitButtonText = isEditing ? "Lưu thay đổi" : TEXTS_VI.saveButton;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hoTen"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Họ và tên học sinh</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ví dụ: Nguyễn Văn A" 
                    {...field} 
                    onChange={(e) => {
                      const capitalized = capitalizeWords(e.target.value);
                      field.onChange(capitalized);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-1">
              <Label htmlFor="autoGeneratedStudentId">Mã HS {isEditing ? "" : "(tự động)"}</Label>
              <p 
                id="autoGeneratedStudentId" 
                className={cn(
                    "text-sm h-10 flex items-center px-3 py-2 border rounded-md w-full",
                    isEditing ? "text-muted-foreground bg-muted/50" : "text-foreground"
                )}
              >
                  {displayStudentId || (isEditing ? initialData?.id : 'Đang tạo...')}
              </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ngaySinh"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày sinh (DD/MM/YYYY)</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: 25/12/2000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ngayDangKy"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Ngày đăng ký</FormLabel>
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
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="diaChi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Địa chỉ</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: 123 Đường ABC, P.XYZ, Q.KLM, TP HCM" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="soDienThoai"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại (tùy chọn)</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: 0901234567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="lopId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lớp</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingClasses || !(existingClasses && existingClasses.length > 0)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn lớp học"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {existingClasses && existingClasses.length > 0 ? existingClasses.map((lop) => (
                      <SelectItem key={lop.id} value={lop.id}>{lop.tenLop}</SelectItem>
                    )) : <SelectItem value="no-class" disabled>Không có lớp nào</SelectItem>}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="chuKyThanhToan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chu kỳ thanh toán</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLopId && !isEditing}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chu kỳ (tự động theo lớp)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ALL_PAYMENT_CYCLES.map((cycle) => (
                      <SelectItem key={cycle} value={cycle}>{cycle}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {TEXTS_VI.cancelButton}
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
            {isSubmitting ? "Đang xử lý..." : submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}
