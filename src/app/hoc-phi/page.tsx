
"use client";

import { useState, useMemo, useEffect } from 'react';
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';
import { Download, CreditCard, FileText, Edit2, Trash2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getStudents, updateStudent } from '@/services/hocSinhService';
import { getClasses } from '@/services/lopHocService';
import type { HocSinh, LopHoc, HocPhiGhiNhan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyVND, generateReceiptNumber } from '@/lib/utils';
import PaymentForm from '@/components/hoc-phi/PaymentForm';
// import { recordPayment } from '@/services/hocPhiService'; // To be created

const StudentRowSkeleton = () => (
  <TableRow>
    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell> 
    <TableCell><Skeleton className="h-4 w-24" /></TableCell> 
    <TableCell>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </TableCell>
  </TableRow>
);

const calculateTuitionForStudent = (student: HocSinh, classesMap: Map<string, LopHoc>): number | null => {
  if (!student.lopId) return null;
  const studentClass = classesMap.get(student.lopId);
  if (!studentClass) return null;

  let tongHocPhi: number;
  const sessionsInCycleMap: { [key: string]: number | undefined } = {
    '8 buổi': 8,
    '10 buổi': 10,
  };
  const sessionsInDefinedCycle = sessionsInCycleMap[studentClass.chuKyDongPhi];

  if (sessionsInDefinedCycle) {
    tongHocPhi = studentClass.hocPhi * sessionsInDefinedCycle;
  } else if (studentClass.chuKyDongPhi === '1 tháng' || studentClass.chuKyDongPhi === 'Theo ngày') {
    tongHocPhi = studentClass.hocPhi;
  } else {
    tongHocPhi = studentClass.hocPhi; 
  }
  return tongHocPhi;
};


export default function HocPhiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTermUnpaid, setSearchTermUnpaid] = useState('');
  const [searchTermPaid, setSearchTermPaid] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [studentForPayment, setStudentForPayment] = useState<HocSinh | null>(null);

  const { data: students = [], isLoading: isLoadingStudents, isError: isErrorStudents, error: errorStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsForTuition'],
    queryFn: getStudents,
  });

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classesForTuition'],
    queryFn: getClasses,
  });

  const classesMap = useMemo(() => {
    const map = new Map<string, LopHoc>();
    classes.forEach(cls => map.set(cls.id, cls));
    return map;
  }, [classes]);

  const unpaidStudents = useMemo(() => {
    return students
      .filter(s => s.tinhTrangThanhToan === 'Chưa thanh toán' || s.tinhTrangThanhToan === 'Quá hạn')
      .filter(student =>
        student.hoTen.toLowerCase().includes(searchTermUnpaid.toLowerCase()) ||
        (student.tenLop && student.tenLop.toLowerCase().includes(searchTermUnpaid.toLowerCase()))
      ).map(student => ({
        ...student,
        expectedTuitionFee: calculateTuitionForStudent(student, classesMap),
      }));
  }, [students, classesMap, searchTermUnpaid]);

  const paidStudents = useMemo(() => {
    return students
      .filter(s => s.tinhTrangThanhToan === 'Đã thanh toán')
      .filter(student =>
        student.hoTen.toLowerCase().includes(searchTermPaid.toLowerCase()) ||
        (student.tenLop && student.tenLop.toLowerCase().includes(searchTermPaid.toLowerCase()))
      ).map(student => ({
        ...student,
        paidAmount: calculateTuitionForStudent(student, classesMap), 
      }));
  }, [students, classesMap, searchTermPaid]);

  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: { studentId: string, paymentDetails: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopTen' | 'hoaDonSo'> }) => {
      // Placeholder for actual service call
      // await recordPayment(paymentData.studentId, paymentData.paymentDetails); 
      // For now, directly update student status
      await updateStudent(paymentData.studentId, { 
        tinhTrangThanhToan: 'Đã thanh toán',
        ngayThanhToanGanNhat: paymentData.paymentDetails.ngayThanhToan 
      });
      return paymentData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['studentsForTuition'] });
      setIsPaymentModalOpen(false);
      setStudentForPayment(null);
      toast({
        title: "Thanh toán thành công!",
        description: `Đã ghi nhận thanh toán cho học sinh.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi ghi nhận thanh toán",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const handleOpenPaymentModal = (student: HocSinh) => {
    setStudentForPayment(student);
    setIsPaymentModalOpen(true);
  };

  const handleProcessPayment = (paymentDetails: Omit<HocPhiGhiNhan, 'id' | 'hocSinhId' | 'hocSinhTen' | 'lopTen' | 'hoaDonSo'>) => {
    if (!studentForPayment) return;
    
    // Here you would normally call a service to save the HocPhiGhiNhan record
    // and then update the student's status.
    // For now, we will directly call the mutation to update the student.
    
    recordPaymentMutation.mutate({ studentId: studentForPayment.id, paymentDetails });
    
    // Example of creating a full HocPhiGhiNhan object if needed
    // const fullPaymentRecord: HocPhiGhiNhan = {
    //   id: generateId('txn_'), // Or generated by backend
    //   hocSinhId: studentForPayment.id,
    //   hocSinhTen: studentForPayment.hoTen,
    //   lopId: studentForPayment.lopId,
    //   lopTen: studentForPayment.tenLop,
    //   hoaDonSo: generateReceiptNumber(),
    //   ...paymentDetails
    // };
    // console.log("Payment to be processed:", fullPaymentRecord);
    // toast({
    //   title: "Xử lý thanh toán",
    //   description: `Đang xử lý thanh toán cho ${studentForPayment.hoTen}. Dữ liệu: ${JSON.stringify(paymentDetails)}`,
    // });
    // setIsPaymentModalOpen(false);
    // setStudentForPayment(null);
    // // Placeholder: update student status and refetch data
    // // In a real app, you'd make an API call here.
    // queryClient.invalidateQueries({ queryKey: ['studentsForTuition'] });
  };


  const handleViewReceipt = (student: HocSinh) => {
    toast({
      title: "Xem biên nhận",
      description: `Chức năng xem biên nhận cho ${student.hoTen} đang được phát triển.`,
    });
  };
  
  const handleEditReceipt = (student: HocSinh) => {
    toast({
      title: "Sửa biên nhận",
      description: `Chức năng sửa biên nhận cho ${student.hoTen} đang được phát triển.`,
    });
  };

  const handleDeleteReceipt = (student: HocSinh) => {
    toast({
      title: "Xóa biên nhận",
      description: `Chức năng xóa biên nhận cho ${student.hoTen} đang được phát triển.`,
    });
  };

  const combinedError = errorStudents?.message || errorClasses?.message;
  const isLoading = isLoadingStudents || isLoadingClasses;


  if (isErrorStudents || isErrorClasses) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <p>Lỗi tải dữ liệu: {combinedError}</p>
          <Button onClick={() => {
            if(isErrorStudents) queryClient.invalidateQueries({ queryKey: ['studentsForTuition'] });
            if(isErrorClasses) queryClient.invalidateQueries({ queryKey: ['classesForTuition'] });
          }} className="mt-4">
            <RefreshCw className="mr-2" /> Thử lại
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  
  const currentExpectedTuition = studentForPayment ? calculateTuitionForStudent(studentForPayment, classesMap) : 0;

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground">Quản lý Học phí</h1>
           <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Xuất báo cáo
          </Button>
        </div>

        <Tabs defaultValue="unpaid" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-1/2 mb-6">
            <TabsTrigger value="unpaid">Chưa thanh toán ({unpaidStudents.length})</TabsTrigger>
            <TabsTrigger value="paid">Đã thanh toán ({paidStudents.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="unpaid">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Danh sách học sinh chưa thanh toán</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Tìm học sinh chưa thanh toán..."
                    value={searchTermUnpaid}
                    onChange={(e) => setSearchTermUnpaid(e.target.value)}
                    className="pl-10 w-full sm:w-1/2"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">STT</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Số tiền (dự kiến)</TableHead>
                      <TableHead className="text-right w-[120px]">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <>
                        {[...Array(3)].map((_, i) => <StudentRowSkeleton key={`unpaid-skel-${i}`} />)}
                      </>
                    ) : unpaidStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          {students.length > 0 || classes.length > 0 ? "Không có học sinh nào chưa thanh toán khớp với tìm kiếm." : "Chưa có dữ liệu học sinh hoặc lớp học."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      unpaidStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium text-primary">{student.hoTen}</TableCell>
                          <TableCell>{student.tenLop || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={student.tinhTrangThanhToan === 'Quá hạn' ? 'destructive' : 'secondary'}>
                              {student.tinhTrangThanhToan}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrencyVND(student.expectedTuitionFee ?? undefined)}</TableCell>
                          <TableCell className="text-right">
                            <Button onClick={() => handleOpenPaymentModal(student)} size="sm">
                              <CreditCard className="mr-2 h-4 w-4" /> Thanh toán
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paid">
             <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Danh sách học sinh đã thanh toán</CardTitle>
                 <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Tìm học sinh đã thanh toán..."
                    value={searchTermPaid}
                    onChange={(e) => setSearchTermPaid(e.target.value)}
                    className="pl-10 w-full sm:w-1/2"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">STT</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Ngày thanh toán</TableHead>
                      <TableHead>Số tiền</TableHead>
                      <TableHead className="text-right w-[150px]">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                       <>
                        {[...Array(3)].map((_, i) => <StudentRowSkeleton key={`paid-skel-${i}`} />)}
                      </>
                    ) : paidStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                         {students.length > 0 || classes.length > 0 ? "Không có học sinh nào đã thanh toán khớp với tìm kiếm." : "Chưa có dữ liệu học sinh hoặc lớp học."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paidStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium text-primary">{student.hoTen}</TableCell>
                          <TableCell>{student.tenLop || 'N/A'}</TableCell>
                          <TableCell>{student.ngayThanhToanGanNhat ? new Date(student.ngayThanhToanGanNhat).toLocaleDateString('vi-VN') : 'N/A'}</TableCell>
                          <TableCell>{formatCurrencyVND(student.paidAmount ?? undefined)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="icon" onClick={() => handleViewReceipt(student)} aria-label="Xem biên nhận">
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" onClick={() => handleEditReceipt(student)} aria-label="Sửa biên nhận">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                               <Button variant="destructive" size="icon" onClick={() => handleDeleteReceipt(student)} aria-label="Xóa biên nhận">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {studentForPayment && (
          <Dialog open={isPaymentModalOpen} onOpenChange={(isOpen) => {
            setIsPaymentModalOpen(isOpen);
            if (!isOpen) setStudentForPayment(null);
          }}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Thanh toán học phí cho {studentForPayment.hoTen}</DialogTitle>
              </DialogHeader>
              <PaymentForm 
                student={studentForPayment}
                expectedAmount={currentExpectedTuition ?? 0}
                onSubmit={handleProcessPayment}
                onClose={() => {
                  setIsPaymentModalOpen(false);
                  setStudentForPayment(null);
                }}
                isSubmitting={recordPaymentMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}

      </div>
    </DashboardLayout>
  );
}
