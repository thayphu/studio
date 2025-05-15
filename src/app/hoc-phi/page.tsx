
"use client";

import { useState } from 'react';
import DashboardLayout from '../dashboard-layout';
import { TEXTS_VI } from '@/lib/constants';
import { Download, CreditCard, FileText, Edit2, Trash2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStudents } from '@/services/hocSinhService';
import type { HocSinh } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const StudentRowSkeleton = () => (
  <TableRow>
    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell> {/* Placeholder for amount or date */}
    <TableCell>
      <div className="flex gap-2 justify-end">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </TableCell>
  </TableRow>
);


export default function HocPhiPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTermUnpaid, setSearchTermUnpaid] = useState('');
  const [searchTermPaid, setSearchTermPaid] = useState('');

  const { data: students = [], isLoading, isError, error } = useQuery<HocSinh[], Error>({
    queryKey: ['studentsForTuition'], // Unique query key
    queryFn: getStudents,
  });

  const unpaidStudents = students.filter(
    s => s.tinhTrangThanhToan === 'Chưa thanh toán' || s.tinhTrangThanhToan === 'Quá hạn'
  ).filter(student =>
    student.hoTen.toLowerCase().includes(searchTermUnpaid.toLowerCase()) ||
    (student.tenLop && student.tenLop.toLowerCase().includes(searchTermUnpaid.toLowerCase()))
  );

  const paidStudents = students.filter(
    s => s.tinhTrangThanhToan === 'Đã thanh toán'
  ).filter(student =>
    student.hoTen.toLowerCase().includes(searchTermPaid.toLowerCase()) ||
    (student.tenLop && student.tenLop.toLowerCase().includes(searchTermPaid.toLowerCase()))
  );

  const handlePayment = (student: HocSinh) => {
    toast({
      title: "Xử lý thanh toán",
      description: `Chức năng thanh toán cho học sinh ${student.hoTen} đang được phát triển.`,
    });
    // Here, you would typically open a payment dialog or update student's payment status in DB
    // For now, let's optimistically update the UI and then invalidate queries
    // This is a simplified example, real implementation would involve backend update
    // queryClient.setQueryData(['studentsForTuition'], (oldData: HocSinh[] | undefined) => 
    //   oldData ? oldData.map(s => s.id === student.id ? {...s, tinhTrangThanhToan: 'Đã thanh toán'} : s) : []
    // );
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


  if (isError) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <p>Lỗi tải dữ liệu học sinh: {error?.message}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['studentsForTuition'] })} className="mt-4">
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
                          {students.length > 0 ? "Không có học sinh nào chưa thanh toán khớp với tìm kiếm." : "Chưa có dữ liệu học sinh."}
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
                          <TableCell>N/A</TableCell> {/* Placeholder for amount */}
                          <TableCell className="text-right">
                            <Button onClick={() => handlePayment(student)} size="sm">
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
                         {students.length > 0 ? "Không có học sinh nào đã thanh toán khớp với tìm kiếm." : "Chưa có dữ liệu học sinh."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paidStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium text-primary">{student.hoTen}</TableCell>
                          <TableCell>{student.tenLop || 'N/A'}</TableCell>
                          <TableCell>{student.ngayThanhToanGanNhat ? new Date(student.ngayThanhToanGanNhat).toLocaleDateString('vi-VN') : 'N/A'}</TableCell>
                          <TableCell>N/A</TableCell> {/* Placeholder for paid amount */}
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
      </div>
    </DashboardLayout>
  );
}

    