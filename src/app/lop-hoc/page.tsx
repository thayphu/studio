
"use client";

import { useState, useEffect } from 'react';
import { PlusCircle, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AddClassForm from '@/components/lop-hoc/AddClassForm';
import ClassCard from '@/components/lop-hoc/ClassCard';
import type { LopHoc } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import DashboardLayout from '../dashboard-layout';

// Mock data for LopHoc
const initialClasses: LopHoc[] = [
  { id: 'lop1', tenLop: 'Lớp 1A', lichHoc: ['Thứ 2', 'Thứ 4', 'Thứ 6'], gioHoc: '17:30 - 19:00', diaDiem: 'Phòng A101', hocPhi: 1200000, chuKyDongPhi: '1 tháng', soHocSinhHienTai: 25, trangThai: 'Đang hoạt động' },
  { id: 'lop2', tenLop: 'Lớp Tiếng Anh Giao Tiếp', lichHoc: ['Thứ 3', 'Thứ 5'], gioHoc: '18:00 - 19:30', diaDiem: 'Phòng B203', hocPhi: 800000, chuKyDongPhi: '8 buổi', soHocSinhHienTai: 15, trangThai: 'Đang hoạt động' },
  { id: 'lop3', tenLop: 'Luyện thi IELTS', lichHoc: ['Thứ 7', 'Chủ Nhật'], gioHoc: '09:00 - 11:00', diaDiem: 'Phòng C305', hocPhi: 2500000, chuKyDongPhi: '10 buổi', soHocSinhHienTai: 10, trangThai: 'Đã đóng' },
  { id: 'lop4', tenLop: 'Toán Tư Duy Lớp 3', lichHoc: ['Thứ 2', 'Thứ 5'], gioHoc: '16:00 - 17:30', diaDiem: 'Phòng A102', hocPhi: 1000000, chuKyDongPhi: '1 tháng', soHocSinhHienTai: 18, trangThai: 'Đang hoạt động' },
];


export default function LopHocPage() {
  const [classes, setClasses] = useState<LopHoc[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<LopHoc | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetching
    setClasses(initialClasses.sort((a, b) => a.tenLop.localeCompare(b.tenLop, 'vi')));
    setIsLoading(false);
  }, []);
  
  const handleAddClass = (newClass: LopHoc) => {
    setClasses(prevClasses => [...prevClasses, newClass].sort((a,b) => a.tenLop.localeCompare(b.tenLop, 'vi')));
    setIsModalOpen(false);
  };

  const handleEditClass = (updatedClass: LopHoc) => {
    setClasses(prevClasses => 
      prevClasses.map(c => c.id === updatedClass.id ? updatedClass : c).sort((a,b) => a.tenLop.localeCompare(b.tenLop, 'vi'))
    );
    setEditingClass(null);
    setIsModalOpen(false);
  };

  const handleDeleteClass = (classId: string) => {
    // Add confirmation dialog here in a real app
    setClasses(prevClasses => prevClasses.filter(c => c.id !== classId));
  };

  const handleOpenEditModal = (lopHoc: LopHoc) => {
    setEditingClass(lopHoc);
    setIsModalOpen(true);
  };
  
  const handleOpenAddModal = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <DashboardLayout><div className="flex justify-center items-center h-full">{TEXTS_VI.loading}</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Danh sách Lớp học</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Lọc">
              <Filter className="h-4 w-4" />
            </Button>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenAddModal} size="icon" aria-label={TEXTS_VI.addClassTitle}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingClass ? TEXTS_VI.editButton + " lớp học" : TEXTS_VI.addClassTitle}</DialogTitle>
                </DialogHeader>
                <AddClassForm 
                  onSubmit={editingClass ? handleEditClass : handleAddClass} 
                  initialData={editingClass}
                  onClose={() => setIsModalOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xl text-muted-foreground">{TEXTS_VI.noClassesFound}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((lopHoc) => (
              <ClassCard 
                key={lopHoc.id} 
                lopHoc={lopHoc} 
                onEdit={() => handleOpenEditModal(lopHoc)}
                onDelete={() => handleDeleteClass(lopHoc.id)} 
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
