
"use client";
import { useState, useEffect, useMemo, Suspense } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit2, Trash2, Search, RefreshCw } from 'lucide-react';
import { TEXTS_VI } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as ShadAlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader as ShadAlertDialogHeader,
  AlertDialogTitle as AlertDialogTitleComponent,
} from "@/components/ui/alert-dialog";
import AddStudentForm from '@/components/hoc-sinh/AddStudentForm';
import type { HocSinh, LopHoc } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses, recalculateAndUpdateClassStudentCount } from '@/services/lopHocService';
import { getStudents, addStudent, deleteStudent as deleteStudentService, updateStudent as updateStudentService } from '@/services/hocSinhService';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams, useRouter } from 'next/navigation';

const StudentRowSkeleton = () => (
  <TableRow>
    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </TableCell>
  </TableRow>
);

function HocSinhPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<HocSinh | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<HocSinh | null>(null);
  const [initialClassIdFromUrl, setInitialClassIdFromUrl] = useState<string | null>(null);

  const { data: existingClasses = [], isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: studentsData = [], isLoading: isLoadingStudents, isError: isErrorStudents, error: errorStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['students'],
    queryFn: getStudents,
  });

  useEffect(() => {
    const classId = searchParams.get('classId');
    if (classId) {
      console.log("[HocSinhPage] ClassId from URL detected:", classId);
      setInitialClassIdFromUrl(classId);
      // Open the add student modal, not edit
      setEditingStudent(null);
      setIsEditStudentModalOpen(false);
      setIsAddStudentModalOpen(true);
      console.log("[HocSinhPage] Attempting to open AddStudentModal for classId:", classId);
      // Remove classId from URL to prevent re-triggering on refresh or manual dialog open
      router.replace('/hoc-sinh', { scroll: false });
    }
  }, [searchParams, router]);
  
  const filteredStudents = useMemo(() => {
    const currentStudents = studentsData || [];
    return currentStudents.filter(student =>
      student.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (student.tenLop && student.tenLop.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [studentsData, searchTerm]);

  const addStudentMutation = useMutation({
    mutationFn: (params: { studentData: Omit<HocSinh, 'id' | 'tenLop' | 'tinhTrangThanhToan'>, studentId: string }) => 
      addStudent(params.studentData, params.studentId),
    onSuccess: async (addedStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      if (addedStudent.lopId) {
        console.log(`[HocSinhPage] Student added to class ${addedStudent.lopId}. Recalculating count.`);
        await recalculateAndUpdateClassStudentCount(addedStudent.lopId);
        queryClient.invalidateQueries({ queryKey: ['classes'] }); 
      }
      closeDialogs(); // Close dialog and reset initialClassIdFromUrl
      toast({
        title: "Thêm học sinh thành công!",
        description: `Học sinh "${addedStudent.hoTen}" đã được thêm với mã HS: ${addedStudent.id}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi thêm học sinh",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: (studentData: HocSinh) => updateStudentService(studentData.id, studentData),
    onSuccess: async (_data, updatedStudentDataFromForm) => { 
      console.log("[HocSinhPage] updateStudentMutation onSuccess. Data from form:", updatedStudentDataFromForm);
      queryClient.invalidateQueries({ queryKey: ['students'] });

      const studentBeforeEdit = editingStudent; 
      const newLopId = updatedStudentDataFromForm.lopId;
      const oldLopId = studentBeforeEdit?.lopId;

      if (newLopId) {
        console.log(`[HocSinhPage] Student updated in class ${newLopId}. Recalculating count for this class.`);
        await recalculateAndUpdateClassStudentCount(newLopId);
      }

      if (oldLopId && oldLopId !== newLopId) {
        console.log(`[HocSinhPage] Student moved from old class ${oldLopId}. Recalculating count for old class.`);
        await recalculateAndUpdateClassStudentCount(oldLopId);
      }
      
      queryClient.invalidateQueries({ queryKey: ['classes'] }); 

      closeDialogs();
      toast({
        title: "Cập nhật thành công!",
        description: `Thông tin học sinh "${updatedStudentDataFromForm.hoTen}" đã được cập nhật.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi cập nhật học sinh",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
    },
  });


  const deleteStudentMutation = useMutation({
    mutationFn: async (params: { studentId: string; lopId?: string }) => {
      await deleteStudentService(params.studentId);
      return params; 
    },
    onSuccess: async (params) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      if (params.lopId) {
        console.log(`[HocSinhPage] Student deleted from class ${params.lopId}. Recalculating count.`);
        await recalculateAndUpdateClassStudentCount(params.lopId);
        queryClient.invalidateQueries({ queryKey: ['classes'] });
      }
      toast({
        title: "Đã xóa học sinh",
        description: `Học sinh với mã ${params.studentId} đã được xóa khỏi hệ thống.`,
      });
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi xóa học sinh",
        description: `${error.message}. Vui lòng kiểm tra console server để biết thêm chi tiết.`,
        variant: "destructive",
      });
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
    },
  });


  const handleAddStudentSubmit = (newStudentDataFromForm: HocSinh) => {
    const { id: studentId, ...restOfData } = newStudentDataFromForm;
    const studentDataForAdd: Omit<HocSinh, 'id' | 'tenLop' | 'tinhTrangThanhToan' | 'ngayThanhToanGanNhat' | 'soBuoiDaHocTrongChuKy'> = {
      hoTen: restOfData.hoTen,
      ngaySinh: restOfData.ngaySinh,
      diaChi: restOfData.diaChi,
      soDienThoai: restOfData.soDienThoai,
      lopId: restOfData.lopId,
      ngayDangKy: restOfData.ngayDangKy,
      chuKyThanhToan: restOfData.chuKyThanhToan,
    };
    addStudentMutation.mutate({ studentData: studentDataForAdd, studentId });
  };

  const handleUpdateStudentSubmit = (updatedStudentDataFromForm: HocSinh) => {
    console.log("[HocSinhPage] handleUpdateStudentSubmit called with:", updatedStudentDataFromForm);
    updateStudentMutation.mutate(updatedStudentDataFromForm);
  };

  const handleOpenAddStudentModal = () => {
    console.log("[HocSinhPage] handleOpenAddStudentModal called (manual open).");
    setInitialClassIdFromUrl(null); // Ensure no pre-selection if opened manually
    setEditingStudent(null);
    setIsEditStudentModalOpen(false); 
    setIsAddStudentModalOpen(true);
  };
  
  const handleOpenDeleteStudentDialog = (student: HocSinh) => {
    setStudentToDelete(student);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete) {
      deleteStudentMutation.mutate({ studentId: studentToDelete.id, lopId: studentToDelete.lopId });
    }
  };
  
  const handleEditStudent = (student: HocSinh) => {
    console.log("[HocSinhPage] handleEditStudent called with student:", student.id);
    setInitialClassIdFromUrl(null); // Not pre-selecting class for edit
    setEditingStudent(student);
    setIsAddStudentModalOpen(false); 
    setIsEditStudentModalOpen(true);
    console.log("[HocSinhPage] States after handleEditStudent: isEditStudentModalOpen=true, isAddStudentModalOpen=false, editingStudent set to:", student);
  };

  const closeDialogs = () => {
    console.log("[HocSinhPage] closeDialogs called. Resetting modal states and initialClassIdFromUrl.");
    setIsAddStudentModalOpen(false);
    setIsEditStudentModalOpen(false);
    setEditingStudent(null);
    setInitialClassIdFromUrl(null); // Important to reset this
  }

  if (isErrorClasses || isErrorStudents) {
    const combinedError = errorClasses?.message || errorStudents?.message;
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500 p-6">
          <p className="text-lg font-semibold">Lỗi tải dữ liệu</p>
          <p className="text-sm mb-2">{combinedError}</p>
          <p className="text-xs text-muted-foreground mb-4">
            Vui lòng kiểm tra console của server Next.js để biết chi tiết lỗi từ Firebase (thường liên quan đến thiếu Index hoặc Firestore Security Rules).
          </p>
          <Button onClick={() => {
            if(isErrorClasses) queryClient.invalidateQueries({ queryKey: ['classes'] });
            if(isErrorStudents) queryClient.invalidateQueries({ queryKey: ['students'] });
          }} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  console.log("[HocSinhPage] Rendering. isAddStudentModalOpen:", isAddStudentModalOpen, "isEditStudentModalOpen:", isEditStudentModalOpen, "editingStudent:", editingStudent?.id, "initialClassIdFromUrl:", initialClassIdFromUrl);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Quản lý Học sinh</h1>
            <Button 
              onClick={handleOpenAddStudentModal} 
              disabled={isLoadingClasses || addStudentMutation.isPending || updateStudentMutation.isPending}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> 
              {isLoadingClasses ? "Đang tải lớp..." : "Thêm Học sinh"}
            </Button>
        </div>
        
        <Dialog open={isAddStudentModalOpen || isEditStudentModalOpen} onOpenChange={(open) => {
          if (!open) closeDialogs();
          // Explicitly set modal states based on which one was intended to be open
          // This can prevent issues if onOpenChange is called unexpectedly
          else if (editingStudent) setIsEditStudentModalOpen(true);
          else setIsAddStudentModalOpen(true);
        }}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {isEditStudentModalOpen && editingStudent ? "Chỉnh sửa thông tin học sinh" : "Thêm học sinh mới"}
              </DialogTitle>
              <DialogDescription>
                {isEditStudentModalOpen && editingStudent ? "Cập nhật các thông tin dưới đây cho học sinh." : "Điền đầy đủ thông tin để thêm học sinh vào hệ thống."}
              </DialogDescription>
            </DialogHeader>
            {isLoadingClasses && (isAddStudentModalOpen || isEditStudentModalOpen) ? (
              <div className="p-6 text-center">Đang tải danh sách lớp...</div>
            ) : ( (isAddStudentModalOpen || (isEditStudentModalOpen && editingStudent)) &&
              <AddStudentForm
                onSubmit={isEditStudentModalOpen && editingStudent ? handleUpdateStudentSubmit : handleAddStudentSubmit}
                onClose={closeDialogs}
                existingClasses={existingClasses}
                initialData={editingStudent} 
                isEditing={isEditStudentModalOpen && !!editingStudent}
                isSubmitting={addStudentMutation.isPending || updateStudentMutation.isPending}
                initialClassId={initialClassIdFromUrl}
              />
            )}
          </DialogContent>
        </Dialog>


        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm kiếm học sinh (theo tên, mã HS, lớp)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>
        
        <div className="rounded-lg border overflow-hidden shadow-sm bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">STT</TableHead>
                <TableHead>Mã HS</TableHead>
                <TableHead>Họ và tên</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead>Ngày ĐK</TableHead>
                <TableHead>Chu kỳ TT</TableHead>
                <TableHead>Trạng thái TT</TableHead>
                <TableHead className="text-right w-[100px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStudents ? (
                <>
                  {[...Array(5)].map((_, i) => ( 
                    <StudentRowSkeleton key={`student-skel-${i}`} />
                  ))}
                </>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {(studentsData || []).length > 0 ? "Không tìm thấy học sinh nào khớp với tìm kiếm." : "Chưa có học sinh nào. Hãy thêm học sinh mới!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{student.id}</TableCell>
                    <TableCell className="font-medium text-primary">{student.hoTen}</TableCell>
                    <TableCell>{student.tenLop || 'N/A'}</TableCell>
                    <TableCell>{student.soDienThoai || 'N/A'}</TableCell>
                    <TableCell>{format(parseISO(student.ngayDangKy), "dd/MM/yyyy", { locale: vi })}</TableCell>
                    <TableCell>{student.chuKyThanhToan}</TableCell>
                    <TableCell>
                      <Badge variant={student.tinhTrangThanhToan === 'Đã thanh toán' ? 'default' : (student.tinhTrangThanhToan === 'Chưa thanh toán' ? 'secondary' : 'destructive')}>
                        {student.tinhTrangThanhToan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleEditStudent(student)}
                          disabled={deleteStudentMutation.isPending || addStudentMutation.isPending || updateStudentMutation.isPending}
                          aria-label="Sửa học sinh"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          onClick={() => handleOpenDeleteStudentDialog(student)}
                          disabled={deleteStudentMutation.isPending && deleteStudentMutation.variables?.studentId === student.id}
                          aria-label="Xóa học sinh"
                        >
                          {deleteStudentMutation.isPending && deleteStudentMutation.variables?.studentId === student.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {studentToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <ShadAlertDialogHeader>
              <AlertDialogTitleComponent>Xác nhận xóa học sinh</AlertDialogTitleComponent>
              <ShadAlertDialogDescription>
                Bạn có chắc chắn muốn xóa học sinh "{studentToDelete?.hoTen}" (Mã HS: {studentToDelete?.id}) không? Hành động này không thể hoàn tác.
              </ShadAlertDialogDescription>
            </ShadAlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setStudentToDelete(null);
                }}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteStudent}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteStudentMutation.isPending}
              >
                {deleteStudentMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Xác nhận Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </DashboardLayout>
  );
}

export default function HocSinhPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-6 text-center">Đang tải thông tin trang...</div></DashboardLayout>}>
      <HocSinhPageContent />
    </Suspense>
  )
}
