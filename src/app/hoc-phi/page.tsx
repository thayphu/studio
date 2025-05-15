
"use client";
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HocPhiPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Quản lý Học phí</h1>
           <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Xuất báo cáo
          </Button>
        </div>
        <div className="p-6 bg-card rounded-lg shadow">
          <p className="text-muted-foreground">Tính năng quản lý học phí sẽ được triển khai tại đây.</p>
          <p className="text-muted-foreground">Bao gồm: danh sách học sinh đã đóng tiền, xuất biên nhận, v.v.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
