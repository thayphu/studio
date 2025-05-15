
"use client";
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';

export default function DiemDanhPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Điểm danh Học sinh</h1>
        </div>
        <div className="p-6 bg-card rounded-lg shadow">
          <p className="text-muted-foreground">Tính năng điểm danh sẽ được triển khai tại đây.</p>
          <p className="text-muted-foreground">Bao gồm: chọn lớp điểm danh, ghi nhận có mặt/vắng mặt/GV nghỉ/học bù, thống kê, v.v.</p>
          <div className="mt-4">
            <button className="flashing-button px-4 py-2 rounded-md">Điểm danh (Lớp Test)</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
