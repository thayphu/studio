
"use client";
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';

export default function BaoCaoPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Báo cáo Thống kê</h1>
        </div>
        <div className="p-6 bg-card rounded-lg shadow">
          <p className="text-muted-foreground">Tính năng báo cáo, thống kê sẽ được triển khai tại đây.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
