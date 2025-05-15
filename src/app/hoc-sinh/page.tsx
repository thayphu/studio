
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService'; // Assuming you have a service for classes
import { Skeleton } from '@/components/ui/skeleton';


export default function HocSinhPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentsList, setStudentsList] = useState<HocSinh[]>([]); // Student data will be persisted later
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch classes for the AddStudentForm dropdown
  const { data: existingClasses = [], isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const getStudentDisplayList = (students: HocSinh[]): HocSinh[] => {
    return students.map(student => {
      const lop = existingClasses.find(cls => cls.id === student.lopId);
      return {
        ...student,
        tenLop: lop ? lop.tenLop : 'N/A'
      };
    });
  };
  
  const filteredStudents = getStudentDisplayList(studentsList).filter(student =>
    student.hoTen.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (student.tenLop && student.tenLop.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleAddStudent = (newStudentData: Omit<HocSinh, 'tinhTrangThanhToan' | 'tenLop'>) => {
    const selectedClass = existingClasses.find(cls => cls.id === newStudentData.lopId);
    const newStudent: HocSinh = {
      ...newStudentData,
      tinhTrangThanhToan: "Chưa thanh toán", // Default status
      tenLop: selectedClass?.tenLop,
    };
    // TODO: Replace with useMutation to add student to Firestore
    setStudentsList(prev => [...prev, newStudent].sort((a,b) => a.hoTen.localeCompare(b.hoTen, 'vi')));
    setIsAddStudentModalOpen(false);
    toast({
      title: "Thêm học sinh thành công!",
      description: `Học sinh "${newStudent.hoTen}" đã được thêm (tạm thời). Tính năng lưu trữ vĩnh viễn sẽ được cập nhật.`,
    });
  };

  const handleOpenAddStudentModal = () => {
    setIsAddStudentModalOpen(true);
  };

  const handleDeleteStudent = (studentId: string) => {
    // TODO: Replace with useMutation to delete student from Firestore
    setStudentsList(prev => prev.filter(s => s.id !== studentId));
    toast({
      title: "Đã xóa học sinh (tạm thời)",
      description: `Học sinh với mã ${studentId} đã được xóa.`,
      variant: "default",
    });
  };
  
  if (isErrorClasses) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <p>Lỗi tải danh sách lớp học: {errorClasses?.message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['classes'] })} className="mt-4">
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
              <Button onClick={handleOpenAddStudentModal} disabled={isLoadingClasses}>
                <PlusCircle className="mr-2 h-4 w-4" /> {isLoadingClasses ? "Đang tải lớp..." : "Thêm Học sinh"}
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

        {filteredStudents.length === 0 && studentsList.length > 0 ? (
          <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">
              Không tìm thấy học sinh nào khớp với tìm kiếm.
            </p>
          </div>
        ) : filteredStudents.length === 0 && studentsList.length === 0 ? (
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
                  >
                    <Edit2 className="mr-2 h-4 w-4" /> Sửa
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteStudent(student.id)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Xóa
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
