
"use client";
import { useMemo } from 'react';
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import type { LopHoc, DayOfWeek } from '@/lib/types';
import { ALL_DAYS_OF_WEEK } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const getCurrentVietnameseDayOfWeek = (): DayOfWeek => {
  const todayIndex = new Date().getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  // ALL_DAYS_OF_WEEK is ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']
  // Indices:             0,       1,       2,       3,       4,       5,       6
  if (todayIndex === 0) { // Sunday
    return ALL_DAYS_OF_WEEK[6];
  }
  return ALL_DAYS_OF_WEEK[todayIndex - 1];
};

export default function DiemDanhPage() {
  const { toast } = useToast();
  const { data: classes, isLoading, isError, error, refetch } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const todayVietnamese = useMemo(() => getCurrentVietnameseDayOfWeek(), []);

  const classesToday = useMemo(() => {
    if (!classes) return [];
    return classes.filter(cls => 
      cls.trangThai === 'Đang hoạt động' && cls.lichHoc.includes(todayVietnamese)
    );
  }, [classes, todayVietnamese]);

  const handleDiemDanhClick = (lop: LopHoc) => {
    toast({
      title: "Chức năng Điểm danh",
      description: `Sẵn sàng điểm danh cho lớp ${lop.tenLop}. Tính năng chi tiết sẽ được triển khai.`,
    });
    // Logic điểm danh chi tiết sẽ ở đây
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Điểm danh Học sinh</h1>
        </div>
        <div className="p-6 bg-card rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Các lớp có lịch học hôm nay ({todayVietnamese}):
          </h2>
          
          {isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full max-w-sm rounded-md" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center text-red-500 p-4 border border-red-500/50 bg-red-500/10 rounded-md">
              <AlertCircle className="w-12 h-12 mb-2" />
              <p className="text-lg font-semibold">Lỗi tải danh sách lớp học</p>
              <p className="text-sm mb-4">{error?.message}</p>
              <Button onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
              </Button>
            </div>
          )}

          {!isLoading && !isError && classesToday.length === 0 && (
             <p className="text-muted-foreground">
              {classes && classes.length > 0 ? `Không có lớp nào có lịch học vào ${todayVietnamese} hôm nay.` : "Chưa có dữ liệu lớp học."}
            </p>
          )}

          {!isLoading && !isError && classesToday.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classesToday.map(lop => (
                <Button 
                  key={lop.id} 
                  onClick={() => handleDiemDanhClick(lop)}
                  className="flashing-button w-full justify-center"
                  variant="default"
                  size="lg"
                >
                  Điểm danh ({lop.tenLop})
                </Button>
              ))}
            </div>
          )}
           <p className="text-sm text-muted-foreground mt-8 pt-4 border-t">
            Các tính năng chi tiết như: ghi nhận có mặt/vắng mặt/GV nghỉ/học bù, thống kê điểm danh sẽ được triển khai sau.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

    