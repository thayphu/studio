
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format, parse } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { GiaoVienVangRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const scheduleMakeupFormSchema = z.object({
  makeupDate: z.date({
    required_error: "Ngày học bù không được để trống.",
  }),
  makeupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "Giờ học bù không hợp lệ. Ví dụ: 18:00 - 19:30",
  }),
  notes: z.string().optional(),
});

type ScheduleMakeupFormValues = z.infer<typeof scheduleMakeupFormSchema>;

interface ScheduleMakeupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: GiaoVienVangRecord | null;
  onSubmit: (data: { makeupDate: Date; makeupTime: string; notes?: string }) => void;
  isSubmitting?: boolean;
}

export default function ScheduleMakeupFormDialog({
  open,
  onOpenChange,
  record,
  onSubmit,
  isSubmitting = false,
}: ScheduleMakeupFormDialogProps) {
  const form = useForm<ScheduleMakeupFormValues>({
    resolver: zodResolver(scheduleMakeupFormSchema),
    defaultValues: {
      makeupDate: new Date(),
      makeupTime: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (record && open) {
      form.reset({
        makeupDate: record.makeupDate ? parse(record.makeupDate, 'yyyyMMdd', new Date()) : new Date(),
        makeupTime: record.makeupTime || "",
        notes: record.notes || "",
      });
    } else if (!open) {
        form.reset({ // Reset to defaults when dialog closes or no record
            makeupDate: new Date(),
            makeupTime: "",
            notes: "",
        });
    }
  }, [record, open, form]);

  const handleSubmitForm = (data: ScheduleMakeupFormValues) => {
    if (!record) return;
    onSubmit({
      makeupDate: data.makeupDate,
      makeupTime: data.makeupTime,
      notes: data.notes,
    });
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Lên lịch học bù cho lớp: {record.className}</DialogTitle>
          <DialogDescription>
            Ngày GV vắng: {format(parse(record.originalDate, "yyyyMMdd", new Date()), "dd/MM/yyyy", { locale: vi })}.
            Chọn ngày giờ học bù và ghi chú (nếu có).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="makeupDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Ngày học bù</FormLabel>
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
                            format(field.value, "PPP", { locale: vi })
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
                        disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1))} // Disable past dates
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="makeupTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giờ học bù (VD: 14:00 - 15:30)</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhập giờ học bù" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú (tùy chọn)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Thêm ghi chú cho buổi học bù..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Xác nhận Lịch bù
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
