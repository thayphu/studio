
"use client";

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
import type { HocSinh, StudentSalutation, PaymentCycle } from "@/lib/types";
import { ALL_STUDENT_SALUTATIONS, ALL_PAYMENT_CYCLES } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import { generateStudentId, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const studentFormSchema = z.object({
  hoTen: z.string().min(3, { message: "Họ tên phải có ít nhất 3 ký tự." }),
  danhXung: z.enum(ALL_STUDENT_SALUTATIONS as [StudentSalutation, ...StudentSalutation[]], { message: "Danh xưng không hợp lệ." }),
  lopId: z.string().min(1, { message: "Mã lớp không được để trống. VD: lop_xxxx" }),
  ngayDangKy: z.date({ required_error: "Ngày đăng ký không được để trống." }),
  chuKyThanhToan: z.enum(ALL_PAYMENT_CYCLES as [PaymentCycle, ...PaymentCycle[]], { message: "Chu kỳ thanh toán không hợp lệ." }),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

interface AddStudentFormProps {
  onSubmit: (data: HocSinh) => void;
  // initialData?: HocSinh | null; // For editing in the future
  onClose: () => void;
  existingClasses?: { id: string; tenLop: string }[]; // Optional: for class selection dropdown
}

export default function AddStudentForm({ onSubmit, onClose, existingClasses }: AddStudentFormProps) {
  const { toast } = useToast();
  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      hoTen: "",
      danhXung: "Học sinh",
      lopId: "",
      ngayDangKy: new Date(),
      chuKyThanhToan: "1 tháng",
    },
  });

  function handleSubmit(data: StudentFormValues) {
    const newStudent: HocSinh = {
      id: generateStudentId(),
      ...data,
      ngayDangKy: data.ngayDangKy.toISOString(),
      tinhTrangThanhToan: "Chưa thanh toán", // Default status
      // tenLop can be fetched based on lopId if needed for display elsewhere
    };
    onSubmit(newStudent);
    toast({
      title: "Thêm học sinh thành công!",
      description: `Học sinh "${newStudent.hoTen}" đã được thêm vào hệ thống với mã HS: ${newStudent.id}.`,
      variant: "default",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="hoTen"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Họ và tên học sinh</FormLabel>
              <FormControl>
                <Input placeholder="Ví dụ: Nguyễn Văn A" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="danhXung"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Danh xưng</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn danh xưng" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ALL_STUDENT_SALUTATIONS.map((salutation) => (
                      <SelectItem key={salutation} value={salutation}>{salutation}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        
        <FormField
          control={form.control}
          name="lopId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mã Lớp học</FormLabel>
              <FormControl>
                 {/* TODO: Replace with a Select component populated with existingClasses if provided */}
                <Input placeholder="Nhập mã lớp học (VD: lop_abc123)" {...field} />
              </FormControl>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chu kỳ thanh toán" />
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

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {TEXTS_VI.cancelButton}
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {TEXTS_VI.saveButton}
          </Button>
        </div>
      </form>
    </Form>
  );
}

