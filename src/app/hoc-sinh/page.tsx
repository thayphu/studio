
"use client";
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { TEXTS_VI } from '@/lib/constants';

export default function HocSinhPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Quản lý Học sinh</h1>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Thêm Học sinh
          </Button>
        </div>
        <div className="p-6 bg-card rounded-lg shadow">
          <p className="text-muted-foreground">Tính năng quản lý học sinh sẽ được triển khai tại đây.</p>
          <p className="text-muted-foreground">Bao gồm: danh sách học sinh, thêm/sửa/xóa học sinh, thông tin chi tiết, tình trạng thanh toán, v.v.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
