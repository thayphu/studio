
"use client";
import { useState, useEffect } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit2, Trash2, Search, RefreshCw } from 'lucide-react';
import { TEXTS_VI } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import AddStudentForm from '@/components/hoc-sinh/AddStudentForm';
import type { HocSinh, LopHoc } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses, recalculateAndUpdateClassStudentCount } from '@/services/lopHocService';
import { getStudents, addStudent, deleteStudent as deleteStudentService } from '@/services/hocSinhService';
import { Skeleton } from '@/components/ui/skeleton';

const StudentRowSkeleton = () => (
  <TableRow>
    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </TableCell>
  </TableRow>
);


export default function HocSinhPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: existingClasses = [], isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const { data: students = [], isLoading: isLoadingStudents, isError: isErrorStudents, error: errorStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['students'],
    queryFn: getStudents,
  });
  
  const filteredStudents = students.filter(student =>
    student.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (student.tenLop && student.tenLop.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addStudentMutation = useMutation({
    mutationFn: (params: { studentData: Omit<HocSinh, 'id' | 'tenLop' | 'tinhTrangThanhToan'>, studentId: string }) => 
      addStudent(params.studentData, params.studentId),
    onSuccess: async (addedStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      if (addedStudent.lopId) {
        await recalculateAndUpdateClassStudentCount(addedStudent.lopId);
        queryClient.invalidateQueries({ queryKey: ['classes'] }); 
      }
      setIsAddStudentModalOpen(false);
      // Toast for success is now handled within AddStudentForm
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi thêm học sinh",
        description: error.message,
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
        await recalculateAndUpdateClassStudentCount(params.lopId);
        queryClient.invalidateQueries({ queryKey: ['classes'] });
      }
      toast({
        title: "Đã xóa học sinh",
        description: `Học sinh với mã ${params.studentId} đã được xóa khỏi hệ thống.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi xóa học sinh",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleAddStudent = (newStudentDataFromForm: Omit<HocSinh, 'tinhTrangThanhToan' | 'tenLop'>) => {
    const { id: studentId, ...restOfData } = newStudentDataFromForm;
    addStudentMutation.mutate({ studentData: restOfData, studentId });
  };

  const handleOpenAddStudentModal = () => {
    setIsAddStudentModalOpen(true);
  };

  const handleDeleteStudent = (studentId: string, lopId?: string) => {
    deleteStudentMutation.mutate({ studentId, lopId });
  };
  
  if (isErrorClasses || isErrorStudents) {
    const combinedError = errorClasses?.message || errorStudents?.message;
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <p>Lỗi tải dữ liệu: {combinedError}</p>
          <Button onClick={() => {
            if(isErrorClasses) queryClient.invalidateQueries({ queryKey: ['classes'] });
            if(isErrorStudents) queryClient.invalidateQueries({ queryKey: ['students'] });
          }} className="mt-4">
            <RefreshCw className="mr-2" /> Thử lại
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Quản lý Học sinh</h1>
           <Dialog open={isAddStudentModalOpen} onOpenChange={setIsAddStudentModalOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleOpenAddStudentModal} 
                disabled={isLoadingClasses || addStudentMutation.isPending}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> 
                {isLoadingClasses ? "Đang tải lớp..." : (addStudentMutation.isPending ? "Đang thêm..." : "Thêm Học sinh")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Thêm học sinh mới</DialogTitle>
                 {/* Description removed as per previous request */}
              </DialogHeader>
              {isLoadingClasses ? (
                <div className="p-6 text-center">Đang tải danh sách lớp...</div>
              ) : (
                <AddStudentForm
                  onSubmit={handleAddStudent}
                  onClose={() => setIsAddStudentModalOpen(false)}
                  existingClasses={existingClasses} 
                />
              )}
            </DialogContent>
          </Dialog>
        </div>

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
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingStudents ? (
                <>
                  {[...Array(3)].map((_, i) => (
                    <StudentRowSkeleton key={i} />
                  ))}
                </>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    {students.length > 0 ? "Không tìm thấy học sinh nào khớp với tìm kiếm." : "Chưa có học sinh nào. Hãy thêm học sinh mới!"}
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
                    <TableCell>{format(new Date(student.ngayDangKy), "dd/MM/yyyy", { locale: vi })}</TableCell>
                    <TableCell>{student.chuKyThanhToan}</TableCell>
                    <TableCell>
                      <Badge variant={student.tinhTrangThanhToan === 'Đã thanh toán' ? 'default' : (student.tinhTrangThanhToan === 'Chưa thanh toán' ? 'secondary' : 'destructive')}>
                        {student.tinhTrangThanhToan}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mr-2"
                        onClick={() => toast({title: "Tính năng đang phát triển", description: "Chỉnh sửa học sinh sẽ được thêm sau."})}
                        disabled={deleteStudentMutation.isPending}
                      >
                        <Edit2 className="mr-1 h-3 w-3" /> Sửa
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteStudent(student.id, student.lopId)}
                        disabled={deleteStudentMutation.isPending && deleteStudentMutation.variables?.studentId === student.id}
                      >
                        {deleteStudentMutation.isPending && deleteStudentMutation.variables?.studentId === student.id ? <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                         Xóa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}

