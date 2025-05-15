
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LopHoc, DayOfWeek, PaymentCycle } from "@/lib/types";
import { ALL_DAYS_OF_WEEK, ALL_PAYMENT_CYCLES } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import { generateId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const classFormSchema = z.object({
  tenLop: z.string().min(3, { message: "Tên lớp phải có ít nhất 3 ký tự." }),
  lichHoc: z.array(z.string()).min(1, { message: "Phải chọn ít nhất một ngày học." }),
  gioHoc: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/, { message: "Giờ học không hợp lệ. Ví dụ: 18:00 - 19:30" }),
  diaDiem: z.string().min(3, { message: "Địa điểm phải có ít nhất 3 ký tự." }),
  hocPhi: z.coerce.number().min(0, { message: "Học phí không hợp lệ." }),
  chuKyDongPhi: z.enum(ALL_PAYMENT_CYCLES as [PaymentCycle, ...PaymentCycle[]], { message: "Chu kỳ đóng phí không hợp lệ." }),
});

type ClassFormValues = z.infer<typeof classFormSchema>;

interface AddClassFormProps {
  onSubmit: (data: LopHoc) => void;
  initialData?: LopHoc | null;
  onClose: () => void;
}

export default function AddClassForm({ onSubmit, initialData, onClose }: AddClassFormProps) {
  const { toast } = useToast();
  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      lichHoc: initialData.lichHoc as string[],
      chuKyDongPhi: initialData.chuKyDongPhi as PaymentCycle,
    } : {
      tenLop: "",
      lichHoc: [],
      gioHoc: "",
      diaDiem: "",
      hocPhi: 0,
      chuKyDongPhi: "1 tháng",
    },
  });

  function handleSubmit(data: ClassFormValues) {
    const classData: LopHoc = {
      id: initialData?.id || generateId('lop_'),
      ...data,
      lichHoc: data.lichHoc as DayOfWeek[],
      soHocSinhHienTai: initialData?.soHocSinhHienTai || 0,
      trangThai: initialData?.trangThai || 'Đang hoạt động',
    };
    onSubmit(classData);
    toast({
      title: initialData ? "Cập nhật thành công!" : "Thêm lớp thành công!",
      description: `Lớp "${classData.tenLop}" đã được ${initialData ? 'cập nhật' : 'thêm vào hệ thống'}.`,
      variant: "default",
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="tenLop"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{TEXTS_VI.classNameLabel}</FormLabel>
              <FormControl>
                <Input placeholder="Ví dụ: Lớp Toán Cao Cấp 10A1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lichHoc"
          render={() => (
            <FormItem>
              <FormLabel>{TEXTS_VI.scheduleLabel}</FormLabel>
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="grid grid-cols-2 gap-2">
                {ALL_DAYS_OF_WEEK.map((day) => (
                  <FormField
                    key={day}
                    control={form.control}
                    name="lichHoc"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={day}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(day)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), day])
                                  : field.onChange(
                                      (field.value || []).filter(
                                        (value) => value !== day
                                      )
                                    )
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal">
                            {day}
                          </FormLabel>
                        </FormItem>
                      )
                    }}
                  />
                ))}
                </div>
              </ScrollArea>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gioHoc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{TEXTS_VI.classTimeLabel}</FormLabel>
                <FormControl>
                  <Input placeholder="18:00 - 19:30" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="diaDiem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{TEXTS_VI.locationLabel}</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: Phòng học A1, Zoom ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hocPhi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{TEXTS_VI.feeLabel}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Ví dụ: 1000000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="chuKyDongPhi"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{TEXTS_VI.paymentCycleLabel}</FormLabel>
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
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {TEXTS_VI.cancelButton}
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {initialData ? TEXTS_VI.saveButton : TEXTS_VI.addClassTitle}
          </Button>
        </div>
      </form>
    </Form>
  );
}
