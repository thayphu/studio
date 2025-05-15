
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getClasses, recalculateAndUpdateClassStudentCount } from '@/services/lopHocService';
import { getStudents, addStudent, deleteStudent as deleteStudentService } from '@/services/hocSinhService';
import { Skeleton } from '@/components/ui/skeleton';

const StudentCardSkeleton = () => (
  <Card className="flex flex-col shadow-lg">
    <CardHeader>
      <Skeleton className="h-6 w-3/4 mb-1" /> {/* For name and ID */}
      <Skeleton className="h-4 w-1/2" /> {/* For class name */}
    </CardHeader>
    <CardContent className="flex-grow space-y-2 text-sm">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-5 w-1/3" /> {/* For badge */}
    </CardContent>
    <CardFooter className="flex gap-2 pt-4 border-t">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-8 w-1/2" />
    </CardFooter>
  </Card>
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
        queryClient.invalidateQueries({ queryKey: ['classes'] }); // Refresh class list if student count is displayed there
      }
      setIsAddStudentModalOpen(false);
      toast({
        title: "Thêm học sinh thành công!",
        description: `Học sinh "${addedStudent.hoTen}" đã được thêm vào hệ thống.`,
      });
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
      return params; // Pass params to onSuccess
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
    // The ID is already generated and included in newStudentDataFromForm by AddStudentForm
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
                <DialogDescription>
                  Điền thông tin chi tiết của học sinh để thêm vào hệ thống.
                </DialogDescription>
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
        
        {isLoadingStudents ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <StudentCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredStudents.length === 0 && students.length > 0 ? (
          <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">
              Không tìm thấy học sinh nào khớp với tìm kiếm.
            </p>
          </div>
        ) : filteredStudents.length === 0 && students.length === 0 ? (
           <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">
              Chưa có học sinh nào. Hãy thêm học sinh mới!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <Card key={student.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold text-primary">
                    {student.hoTen} 
                    <span className="text-sm font-normal text-muted-foreground ml-2">(Mã HS: {student.id})</span>
                  </CardTitle>
                  <CardDescription>Lớp: {student.tenLop || 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-2 text-sm">
                  <p><strong>Ngày sinh:</strong> {format(new Date(student.ngaySinh), "dd/MM/yyyy", { locale: vi })}</p>
                  <p><strong>Địa chỉ:</strong> {student.diaChi}</p>
                  {student.soDienThoai && <p><strong>SĐT:</strong> {student.soDienThoai}</p>}
                  <p><strong>Ngày đăng ký:</strong> {format(new Date(student.ngayDangKy), "dd/MM/yyyy", { locale: vi })}</p>
                  <p><strong>Chu kỳ thanh toán:</strong> {student.chuKyThanhToan}</p>
                  <p>
                    <strong>Tình trạng thanh toán: </strong> 
                    <Badge variant={student.tinhTrangThanhToan === 'Đã thanh toán' ? 'default' : (student.tinhTrangThanhToan === 'Chưa thanh toán' ? 'secondary' : 'destructive')}>
                      {student.tinhTrangThanhToan}
                    </Badge>
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm" className="flex-1" 
                    onClick={() => toast({title: "Tính năng đang phát triển", description: "Chỉnh sửa học sinh sẽ được thêm sau."})}
                    disabled={deleteStudentMutation.isPending}
                  >
                    <Edit2 className="mr-2 h-4 w-4" /> Sửa
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="flex-1" 
                    onClick={() => handleDeleteStudent(student.id, student.lopId)}
                    disabled={deleteStudentMutation.isPending}
                  >
                    {deleteStudentMutation.isPending && deleteStudentMutation.variables?.studentId === student.id ? 'Đang xóa...' : <><Trash2 className="mr-2 h-4 w-4" /> Xóa</>}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

