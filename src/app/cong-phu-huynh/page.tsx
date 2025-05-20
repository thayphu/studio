
"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image'; // Import next/image
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import StudentLookupPortal from '@/components/phu-huynh/StudentLookupPortal';
import AcademicResultsPortal from '@/components/phu-huynh/AcademicResultsPortal'; // New import
import { useQuery } from '@tanstack/react-query';
import { getClasses } from '@/services/lopHocService';
import type { LopHoc } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { School, CalendarDays, Clock, MapPin, AlertCircle, BookOpen, FileText } from 'lucide-react'; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';


const ParentViewClassCardSkeleton = () => (
  <Card className="shadow">
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2 mt-1" />
    </CardHeader>
    <CardContent className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </CardContent>
  </Card>
);

export default function MainParentPortalPage() {
  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses, error: errorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 60000 * 5, // 5 minutes
  });

  const activeClasses = useMemo(() => {
    return classes.filter(cls => cls.trangThai === 'Đang hoạt động');
  }, [classes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <Link href="/" className="inline-block mb-4">
          <Image 
            src="https://placehold.co/128x128.png" 
            alt="HoEdu Solution Logo" 
            width={64} 
            height={64} 
            style={{ height: 'auto' }} 
            className="mx-auto" 
            data-ai-hint="app logo education" />
        </Link>
        <h1 className="text-4xl font-extrabold text-primary sm:text-5xl">
          HoEdu Solution
        </h1>
        <p className="mt-3 text-xl text-muted-foreground">
          Cổng thông tin dành cho Phụ huynh
        </p>
      </header>

      <main className="max-w-5xl mx-auto">
        <Tabs defaultValue="tra-cuu-hoc-sinh" className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:max-w-lg grid-cols-3 mb-6 bg-primary/10 p-1 rounded-lg mx-auto">
            <TabsTrigger value="lich-hoc" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Lịch học</TabsTrigger>
            <TabsTrigger value="tra-cuu-hoc-sinh" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Tra cứu HS</TabsTrigger>
            <TabsTrigger value="ket-qua-hoc-tap" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Kết quả học tập</TabsTrigger>
          </TabsList>

          <TabsContent value="lich-hoc">
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-primary flex items-center">
                  <CalendarDays className="mr-3 h-7 w-7" /> Thời Khóa Biểu Các Lớp
                </CardTitle>
                <CardDescription>Danh sách các lớp học đang hoạt động.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingClasses && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => <ParentViewClassCardSkeleton key={`skel-cls-${i}`} />)}
                  </div>
                )}
                {isErrorClasses && (
                  <div className="text-destructive text-center py-6">
                    <AlertCircle className="mx-auto h-10 w-10 mb-2" />
                    <p>Lỗi tải danh sách lớp học: {errorClasses?.message}</p>
                  </div>
                )}
                {!isLoadingClasses && !isErrorClasses && activeClasses.length === 0 && (
                  <p className="text-muted-foreground text-center py-6">Hiện tại chưa có thông tin lớp học nào.</p>
                )}
                {!isLoadingClasses && !isErrorClasses && activeClasses.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeClasses.map((lop) => (
                      <Card key={lop.id} className="shadow hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-semibold text-primary flex items-center">
                            <School className="mr-2 h-5 w-5" /> {lop.tenLop}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            <span>Lịch: {lop.lichHoc.join(', ')}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>Giờ: {lop.gioHoc}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            <span>Địa điểm: {lop.diaDiem}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tra-cuu-hoc-sinh">
            <StudentLookupPortal />
          </TabsContent>

          <TabsContent value="ket-qua-hoc-tap">
            <AcademicResultsPortal />
          </TabsContent>
        </Tabs>
      </main>
       <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} HoEdu Solution. Phát triển bởi Đông Phú.</p>
        </footer>
    </div>
  );
}
