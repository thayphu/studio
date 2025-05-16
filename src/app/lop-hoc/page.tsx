
"use client";

import { useState } from 'react';
import { PlusCircle, Filter, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation'; // Added for navigation
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AddClassForm from '@/components/lop-hoc/AddClassForm';
import ClassCard from '@/components/lop-hoc/ClassCard';
import type { LopHoc } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import DashboardLayout from '../dashboard-layout';
import { useToast } from '@/hooks/use-toast';
import { getClasses, addClass, updateClass, deleteClass } from '@/services/lopHocService';
import { generateId } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function LopHocPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter(); // Initialize router

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<LopHoc | null>(null);

  const { data: classes = [], isLoading, isError, error } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const addClassMutation = useMutation({
    mutationFn: (params: { newClassData: Omit<LopHoc, 'id' | 'soHocSinhHienTai' | 'trangThai'>, classId: string }) => {
      return addClass(params.newClassData, params.classId);
    },
    onMutate: async (params) => {
      console.log('addClassMutation onMutate called with:', params);
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      const optimisticClass: LopHoc = {
        ...params.newClassData,
        id: params.classId,
        soHocSinhHienTai: 0,
        trangThai: 'Đang hoạt động',
      };
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) => [...old, optimisticClass].sort((a, b) => a.tenLop.localeCompare(b.tenLop, 'vi')));
      return { previousClasses };
    },
    onError: (err, variables, context) => {
      console.error('addClassMutation onError called. Error:', err, 'Variables:', variables);
      if (context?.previousClasses) {
        queryClient.setQueryData<LopHoc[]>(['classes'], context.previousClasses);
      }
      toast({
        title: "Lỗi khi thêm lớp",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      console.log('addClassMutation onSuccess called. Data:', data);
      // Modal is closed here to ensure it only closes on success
      setIsModalOpen(false);
      toast({
        title: "Thêm lớp thành công!",
        description: `Lớp "${data.tenLop}" đã được thêm vào hệ thống.`,
      });
      console.log('addClassMutation onSuccess: Modal should be closed and toast shown.');
    },
    onSettled: () => {
      console.log('addClassMutation onSettled called.');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: (updatedClass: LopHoc) => {
      const { id, ...dataToUpdate } = updatedClass;
      return updateClass(id, dataToUpdate);
    },
    onMutate: async (updatedClass) => {
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) =>
        old.map(cls => cls.id === updatedClass.id ? updatedClass : cls).sort((a,b) => a.tenLop.localeCompare(b.tenLop, 'vi'))
      );
      return { previousClasses };
    },
    onError: (err, variables, context) => {
      if (context?.previousClasses) {
        queryClient.setQueryData<LopHoc[]>(['classes'], context.previousClasses);
      }
      toast({
        title: "Lỗi khi cập nhật lớp",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Cập nhật thành công!",
        description: `Lớp "${variables.tenLop}" đã được cập nhật.`,
      });
      setIsModalOpen(false); 
      setEditingClass(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onMutate: async (classIdToDelete) => {
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) =>
        old.filter(cls => cls.id !== classIdToDelete)
      );
      return { previousClasses, classIdToDelete };
    },
    onError: (err, classId, context) => {
      if (context?.previousClasses) {
        queryClient.setQueryData<LopHoc[]>(['classes'], context.previousClasses);
      }
      toast({
        title: "Lỗi khi xóa lớp học",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (_, classId) => {
      toast({
        title: "Đã xóa lớp học",
        description: `Lớp học với ID ${classId} đã được xóa.`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

 const handleSubmitClassForm = (data: LopHoc) => {
    if (editingClass) {
      updateClassMutation.mutate(data);
    } else {
      const classId = generateId('lop_');
      // Destructure to exclude client-side only or default fields before sending to mutation
      const { id, soHocSinhHienTai, trangThai, ...newClassData } = data;
      console.log('Calling addClassMutation.mutate with:', { newClassData, classId });
      addClassMutation.mutate({ newClassData, classId });
    }
  };
  
  const handleDeleteClass = (classId: string) => {
    deleteClassMutation.mutate(classId);
  };

  const handleOpenEditModal = (lopHoc: LopHoc) => {
    setEditingClass(lopHoc);
    setIsModalOpen(true);
  };
  
  const handleOpenAddModal = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const handleAddStudentToClass = (classId: string) => {
    alert(`LopHocPage: Yêu cầu thêm học sinh vào lớp ${classId}. Chuyển đến trang quản lý học sinh.`);
    console.log("Attempting to navigate to student page for class:", classId);
    router.push('/hoc-sinh'); // Navigate to the student management page
  };

  if (isError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <p>Lỗi tải danh sách lớp học: {error.message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['classes'] })} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Danh sách Lớp học</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" aria-label="Lọc">
              <Filter />
            </Button>
            <Dialog open={isModalOpen} onOpenChange={(open) => {
              setIsModalOpen(open);
              if (!open) setEditingClass(null); 
            }}>
              <DialogTrigger asChild>
                 <Button onClick={handleOpenAddModal} aria-label={TEXTS_VI.addClassTitle}>
                  <PlusCircle className="mr-2 h-4 w-4" /> {TEXTS_VI.addClassTitle}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingClass ? TEXTS_VI.editButton + " lớp học" : TEXTS_VI.addClassTitle}</DialogTitle>
                </DialogHeader>
                <AddClassForm 
                  onSubmit={handleSubmitClassForm} 
                  initialData={editingClass}
                  onClose={() => {
                    setIsModalOpen(false);
                    setEditingClass(null);
                  }}
                  isSubmitting={addClassMutation.isPending || updateClassMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-lg shadow p-6">
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
                onAddStudent={handleAddStudentToClass} // Pass the handler directly
                isDeleting={deleteClassMutation.isPending && deleteClassMutation.variables === lopHoc.id}
                isUpdating={updateClassMutation.isPending && updateClassMutation.variables?.id === lopHoc.id}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const CardSkeleton = () => (
  <div className="flex flex-col space-y-3 p-4 border rounded-lg shadow">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <div className="space-y-2 pt-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
    </div>
    <div className="flex gap-2 pt-4 border-t mt-auto">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  </div>
);

