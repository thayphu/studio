
"use client";

import { useState } from 'react';
import { PlusCircle, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as ShadAlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as ShadAlertDialogHeader,
  AlertDialogTitle as ShadAlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AddClassForm from '@/components/lop-hoc/AddClassForm';
import ClassCard from '@/components/lop-hoc/ClassCard';
import type { LopHoc } from '@/lib/types';
import { TEXTS_VI } from '@/lib/constants';
import DashboardLayout from '../dashboard-layout';
import { useToast } from '@/hooks/use-toast';
import { getClasses, addClass, updateClass, deleteClass } from '@/services/lopHocService';
import { generateId } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function LopHocPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<LopHoc | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<LopHoc | null>(null);
  const [isCloseClassDialogOpen, setIsCloseClassDialogOpen] = useState(false);
  const [classToClose, setClassToClose] = useState<LopHoc | null>(null);


  const { data: classes = [], isLoading, isError, error, refetch } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 60000 * 1, // 1 minute
  });

  const addClassMutation = useMutation({
    mutationFn: (params: { newClassData: Omit<LopHoc, 'id' | 'soHocSinhHienTai' | 'trangThai' | 'ngayDongLop'>, classId: string }) => {
      return addClass(params.newClassData, params.classId);
    },
    onMutate: async (params) => {
      console.log('[LopHocPage] addClassMutation onMutate called with:', params);
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      const optimisticClass: LopHoc = {
        ...params.newClassData,
        id: params.classId,
        soHocSinhHienTai: 0,
        trangThai: 'Đang hoạt động',
        ngayDongLop: undefined, 
      };
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) => [...old, optimisticClass].sort((a, b) => a.tenLop.localeCompare(b.tenLop, 'vi')));
      return { previousClasses };
    },
    onError: (err, variables, context) => {
      console.error('[LopHocPage] addClassMutation onError called. Error:', err, 'Variables:', variables);
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
      console.log('[LopHocPage] addClassMutation onSuccess called. Data:', data);
      setIsModalOpen(false); 
      toast({
        title: "Thêm lớp thành công!",
        description: `Lớp "${data.tenLop}" đã được thêm vào hệ thống.`,
      });
      console.log('[LopHocPage] addClassMutation onSuccess: Modal should be closed and toast shown.');
    },
    onSettled: () => {
      console.log('[LopHocPage] addClassMutation onSettled called.');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const updateClassMutation = useMutation({
    mutationFn: (updatedClass: LopHoc) => {
      const { id, ...dataToUpdate } = updatedClass;
      return updateClass(id, dataToUpdate);
    },
    onMutate: async (updatedClass) => {
      console.log('[LopHocPage] updateClassMutation onMutate called with:', updatedClass);
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) =>
        old.map(cls => cls.id === updatedClass.id ? updatedClass : cls).sort((a,b) => a.tenLop.localeCompare(b.tenLop, 'vi'))
      );
      return { previousClasses, updatedClassFromMutate: updatedClass }; 
    },
    onError: (err, variables, context) => {
      console.error('[LopHocPage] updateClassMutation onError. Error:', err, 'Variables:', variables);
      if (context?.previousClasses) {
        queryClient.setQueryData<LopHoc[]>(['classes'], context.previousClasses);
      }
      toast({
        title: "Lỗi khi cập nhật lớp",
        description: err.message,
        variant: "destructive",
      });
    },
    onSuccess: (data, variables, context) => { 
      console.log('[LopHocPage] updateClassMutation onSuccess. Variables (updatedClass):', variables);
      toast({
        title: "Cập nhật thành công!",
        description: `Lớp "${variables.tenLop}" đã được cập nhật.`,
      });
      if (variables.trangThai === 'Đã đóng') {
        console.log('[LopHocPage] Closing "Close Class" dialog because class status is now Đã đóng.');
        setIsCloseClassDialogOpen(false);
        setClassToClose(null);
      } else { 
        console.log('[LopHocPage] Closing "Edit Class" dialog.');
        setIsModalOpen(false);
        setEditingClass(null);
      }
    },
    onSettled: () => {
      console.log('[LopHocPage] updateClassMutation onSettled.');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const deleteClassMutation = useMutation({
    mutationFn: deleteClass,
    onMutate: async (classIdToDelete) => {
      console.log('[LopHocPage] deleteClassMutation onMutate for classId:', classIdToDelete);
      await queryClient.cancelQueries({ queryKey: ['classes'] });
      const previousClasses = queryClient.getQueryData<LopHoc[]>(['classes']);
      queryClient.setQueryData<LopHoc[]>(['classes'], (old = []) =>
        old.filter(cls => cls.id !== classIdToDelete)
      );
      return { previousClasses, classIdToDelete };
    },
    onError: (err, classId, context) => {
      console.error('[LopHocPage] deleteClassMutation onError. Error:', err, 'ClassId:', classId);
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
      console.log('[LopHocPage] deleteClassMutation onSuccess for classId:', classId);
      toast({
        title: "Đã xóa lớp học",
        description: `Lớp học với ID ${classId} đã được xóa.`,
      });
      setIsDeleteDialogOpen(false);
      setClassToDelete(null);
    },
    onSettled: () => {
      console.log('[LopHocPage] deleteClassMutation onSettled.');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

 const handleSubmitClassForm = (data: LopHoc) => {
    if (editingClass) {
      console.log('[LopHocPage] Submitting edit for class:', data);
      updateClassMutation.mutate(data);
    } else {
      const classId = generateId('lop_');
      const { id, soHocSinhHienTai, trangThai, ngayDongLop, ...newClassData } = data;
      console.log('[LopHocPage] Submitting add for new class. Generated ID:', classId, 'Data:', newClassData);
      addClassMutation.mutate({ newClassData, classId });
    }
  };

  const handleOpenDeleteDialog = (lopHoc: LopHoc) => {
    console.log('[LopHocPage] handleOpenDeleteDialog for class:', lopHoc.tenLop);
    if (lopHoc.soHocSinhHienTai > 0) {
      toast({
        title: "Không thể xóa lớp học",
        description: `Lớp "${lopHoc.tenLop}" vẫn còn ${lopHoc.soHocSinhHienTai} học sinh. Vui lòng chuyển hoặc xóa hết học sinh trước khi xóa lớp.`,
        variant: "destructive",
        duration: 5000,
      });
      return;
    }
    setClassToDelete(lopHoc);
    setIsDeleteDialogOpen(true);
    console.log('[LopHocPage] Delete dialog opened for:', lopHoc.tenLop);
  };

  const confirmDeleteClass = () => {
    console.log('[LopHocPage] confirmDeleteClass called for:', classToDelete?.tenLop);
    if (classToDelete) {
      deleteClassMutation.mutate(classToDelete.id);
    }
  };

  const handleOpenEditModal = (lopHoc: LopHoc) => {
    console.log('[LopHocPage] handleOpenEditModal for class:', lopHoc.tenLop);
    setEditingClass(lopHoc);
    setIsModalOpen(true);
  };

  const handleOpenAddModal = () => {
    console.log('[LopHocPage] handleOpenAddModal called.');
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const handleAddStudentToClass = (classId: string) => {
    console.log("[LopHocPage] Navigating to add student for class:", classId);
    router.push(`/hoc-sinh?classId=${classId}`);
  };

  const handleOpenCloseClassDialog = (lopHoc: LopHoc) => {
    console.log('[LopHocPage] handleOpenCloseClassDialog triggered for class:', lopHoc.tenLop, lopHoc.id);
    if (lopHoc.trangThai === 'Đã đóng') {
      toast({
        title: "Thông báo",
        description: `Lớp "${lopHoc.tenLop}" đã được đóng.`,
      });
      return;
    }
    setClassToClose(lopHoc);
    setIsCloseClassDialogOpen(true);
    console.log('[LopHocPage] State after setting for Close Class dialog: isCloseClassDialogOpen=', isCloseClassDialogOpen, 'classToClose=', classToClose?.tenLop); 
  };

  const confirmCloseClass = () => {
    console.log('[LopHocPage] confirmCloseClass triggered for:', classToClose?.tenLop);
    if (classToClose) {
      try {
        const dataToUpdate: LopHoc = {
          ...classToClose,
          trangThai: 'Đã đóng' as const,
          ngayDongLop: format(new Date(), 'yyyyMMdd'),
        };
        console.log('[LopHocPage] Data to update for closing class:', dataToUpdate);
        updateClassMutation.mutate(dataToUpdate);
      } catch (e) {
        console.error('[LopHocPage] Error in confirmCloseClass before mutate:', e);
        toast({
          title: "Lỗi khi đóng lớp",
          description: "Có lỗi xảy ra. Vui lòng thử lại.",
          variant: "destructive",
        });
        setIsCloseClassDialogOpen(false);
        setClassToClose(null);
      }
    } else {
      console.warn('[LopHocPage] confirmCloseClass called but classToClose is null.');
    }
  };


  if (isError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-destructive p-6">
          <p className="text-lg font-semibold">Lỗi tải danh sách lớp học</p>
          <p className="text-sm mb-2">{error.message}</p>
          <p className="text-xs text-muted-foreground mb-4">
            Vui lòng kiểm tra console của server Next.js để biết chi tiết lỗi từ Firebase (thường liên quan đến thiếu Index hoặc Firestore Security Rules).
          </p>
          <Button onClick={() => refetch()} className="mt-4">
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
              <Filter className="h-4 w-4"/>
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
                  <DialogDescription>
                    {editingClass ? "Cập nhật thông tin chi tiết cho lớp học." : "Điền thông tin chi tiết để tạo lớp học mới."}
                  </DialogDescription>
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
                onDelete={() => handleOpenDeleteDialog(lopHoc)}
                onAddStudent={handleAddStudentToClass}
                onCloseClass={handleOpenCloseClassDialog}
                isDeleting={deleteClassMutation.isPending && deleteClassMutation.variables === lopHoc.id}
                isUpdating={updateClassMutation.isPending && updateClassMutation.variables?.id === lopHoc.id}
              />
            ))}
          </div>
        )}
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <ShadAlertDialogHeader>
            <ShadAlertDialogTitle>Xác nhận xóa lớp học</ShadAlertDialogTitle>
            <ShadAlertDialogDescription>
              Bạn có chắc chắn muốn xóa lớp học "{classToDelete?.tenLop}" không? 
              Lớp học này có {classToDelete?.soHocSinhHienTai || 0} học sinh.
              Hành động này không thể hoàn tác.
            </ShadAlertDialogDescription>
          </ShadAlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setClassToDelete(null);
            }}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClass}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClassMutation.isPending}
            >
              {deleteClassMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {console.log('[LopHocPage] Rendering AlertDialog for Close Class, isCloseClassDialogOpen:', isCloseClassDialogOpen, 'classToClose:', classToClose?.tenLop)}
      <AlertDialog open={isCloseClassDialogOpen} onOpenChange={(open) => {
          console.log('[LopHocPage] Close Class AlertDialog onOpenChange called with:', open);
          setIsCloseClassDialogOpen(open);
          if (!open) {
            console.log('[LopHocPage] Resetting classToClose due to onOpenChange (dialog closed).');
            setClassToClose(null);
          }
      }}>
        <AlertDialogContent>
          <ShadAlertDialogHeader>
            <ShadAlertDialogTitle>Xác nhận đóng lớp học</ShadAlertDialogTitle>
            <ShadAlertDialogDescription>
              Bạn có chắc chắn muốn đóng lớp học "{classToClose?.tenLop}" không?
              Lớp sẽ không còn hiển thị trong trang điểm danh và các chức năng thông thường.
              Bạn có thể khôi phục lớp này từ trang Báo cáo.
            </ShadAlertDialogDescription>
          </ShadAlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              console.log('[LopHocPage] Close Class AlertDialog Cancel clicked.');
              setIsCloseClassDialogOpen(false);
              setClassToClose(null);
            }}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCloseClass}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={updateClassMutation.isPending && updateClassMutation.variables?.id === classToClose?.id && updateClassMutation.variables?.trangThai === 'Đã đóng'}
            >
              {(updateClassMutation.isPending && updateClassMutation.variables?.id === classToClose?.id && updateClassMutation.variables?.trangThai === 'Đã đóng') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xác nhận Đóng lớp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

const CardSkeleton = () => (
  <div className="flex flex-col space-y-3 p-6 border rounded-lg shadow-sm bg-card">
    <div className="flex justify-between items-start">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-5 w-20" />
    </div>
    <Skeleton className="h-4 w-1/2 mt-1" />
    <div className="space-y-2 pt-2 text-sm">
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-1/3" />
    </div>
    <div className="flex flex-wrap gap-2 pt-4 border-t mt-auto">
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-10 w-10" />
      <Skeleton className="h-10 w-10" />
    </div>
  </div>
);
