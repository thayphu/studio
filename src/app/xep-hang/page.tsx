
"use client";

import React, { useState, useMemo } from 'react';
import DashboardLayout from '../dashboard-layout';
import { useQuery } from '@tanstack/react-query';
import { getStudents } from '@/services/hocSinhService';
import { getClasses } from '@/services/lopHocService';
import { getAllTestScores } from '@/services/testScoreService';
import type { HocSinh, LopHoc, TestScoreRecord, StudentRankingInfo } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Medal, Trophy, User, School, TrendingUp, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const assignRanks = (list: StudentRankingInfo[]): StudentRankingInfo[] => {
  if (!list || list.length === 0) return [];
  const sortedList = [...list].sort((a, b) => b.totalScore - a.totalScore);
  let rank = 1;
  for (let i = 0; i < sortedList.length; i++) {
    if (i > 0 && sortedList[i].totalScore < sortedList[i - 1].totalScore) {
      rank = i + 1;
    }
    sortedList[i].rank = rank;
  }
  return sortedList;
};

export default function XepHangPage() {
  const [selectedClassIdForRanking, setSelectedClassIdForRanking] = useState<string>('');

  const { data: students = [], isLoading: isLoadingStudents, isError: isErrorStudents } = useQuery<HocSinh[], Error>({
    queryKey: ['students'],
    queryFn: getStudents,
    staleTime: 60000 * 5, // 5 minutes
  });

  const { data: classes = [], isLoading: isLoadingClasses, isError: isErrorClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
    staleTime: 60000 * 5, // 5 minutes
  });

  const { data: allScores = [], isLoading: isLoadingAllScores, isError: isErrorAllScores } = useQuery<TestScoreRecord[], Error>({
    queryKey: ['allTestScores'],
    queryFn: getAllTestScores,
    staleTime: 60000 * 2, // 2 minutes
  });

  const studentScoresMap = useMemo(() => {
    if (isLoadingAllScores || !allScores || allScores.length === 0) return new Map<string, number>();
    const map = new Map<string, number>();
    allScores.forEach(scoreRecord => {
      if (scoreRecord.studentId && typeof scoreRecord.score === 'number') {
        map.set(scoreRecord.studentId, (map.get(scoreRecord.studentId) || 0) + scoreRecord.score);
      }
    });
    return map;
  }, [allScores, isLoadingAllScores]);

  const overallRanking = useMemo(() => {
    if (isLoadingStudents || isLoadingClasses || isLoadingAllScores || !students.length) return [];
    const rankedList: StudentRankingInfo[] = students.map(student => {
      const studentClass = classes.find(cls => cls.id === student.lopId);
      return {
        studentId: student.id,
        studentName: student.hoTen,
        classId: student.lopId,
        className: studentClass?.tenLop || 'N/A',
        totalScore: studentScoresMap.get(student.id) || 0,
      };
    });
    return assignRanks(rankedList);
  }, [students, classes, studentScoresMap, isLoadingStudents, isLoadingClasses, isLoadingAllScores]);

  const classRanking = useMemo(() => {
    if (!selectedClassIdForRanking || isLoadingStudents || isLoadingAllScores || !students.length) return [];
    const studentsInClass = students.filter(s => s.lopId === selectedClassIdForRanking);
    const rankedList: StudentRankingInfo[] = studentsInClass.map(student => ({
      studentId: student.id,
      studentName: student.hoTen,
      totalScore: studentScoresMap.get(student.id) || 0,
    }));
    return assignRanks(rankedList);
  }, [selectedClassIdForRanking, students, studentScoresMap, isLoadingStudents, isLoadingAllScores]);

  const topThreeOverall = useMemo(() => overallRanking.slice(0, 3), [overallRanking]);
  const topThreeClass = useMemo(() => classRanking.slice(0, 3), [classRanking]);

  const isLoading = isLoadingStudents || isLoadingClasses || isLoadingAllScores;
  const isError = isErrorStudents || isErrorClasses || isErrorAllScores;

  if (isError) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 px-4 md:px-6">
          <div className="flex flex-col items-center justify-center h-full text-destructive p-6 border border-destructive/50 bg-destructive/10 rounded-lg shadow">
            <AlertCircle className="w-12 h-12 mb-3" />
            <p className="text-lg font-semibold">Lỗi tải dữ liệu xếp hạng</p>
            <p className="text-sm mb-4 text-center">Không thể tải dữ liệu học sinh, lớp học hoặc điểm số. Vui lòng thử lại sau.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  const renderVinhDanhCard = (student: StudentRankingInfo, index: number) => {
    let medalIcon = <Medal className="h-8 w-8 text-yellow-500" />;
    if (index === 1) medalIcon = <Medal className="h-8 w-8 text-gray-400" />;
    if (index === 2) medalIcon = <Medal className="h-8 w-8 text-orange-400" />;

    return (
      <Card key={student.studentId} className="shadow-lg flex flex-col items-center p-4 bg-card hover:shadow-xl transition-shadow">
        <div className="relative mb-3">
          <Avatar className="h-24 w-24 border-4 border-primary/50">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${student.studentName.charAt(0)}`} alt={student.studentName} data-ai-hint="student avatar" />
            <AvatarFallback>{student.studentName.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-2 -right-2 p-1 bg-background rounded-full shadow-md">
            {medalIcon}
          </div>
        </div>
        <CardTitle className="text-lg font-semibold text-primary text-center">{student.studentName}</CardTitle>
        {student.className && <CardDescription className="text-xs text-muted-foreground">{student.className}</CardDescription>}
        <p className="text-2xl font-bold text-accent mt-1">{student.totalScore} điểm</p>
        <p className="text-sm text-muted-foreground">Hạng: {student.rank}</p>
      </Card>
    );
  };

  const renderRankingTable = (rankingData: StudentRankingInfo[]) => (
    <ScrollArea className="max-h-[500px] rounded-md border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
          <TableRow>
            <TableHead className="w-[50px]">Hạng</TableHead>
            <TableHead>Họ và Tên</TableHead>
            {rankingData[0]?.className !== undefined && <TableHead>Lớp</TableHead> /* Show class only if it's overall ranking */}
            <TableHead className="text-right">Tổng Điểm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={`skel-rank-${i}`}>
                <TableCell><Skeleton className="h-5 w-6" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                {rankingData[0]?.className !== undefined && <TableCell><Skeleton className="h-5 w-24" /></TableCell>}
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))
          ) : rankingData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={rankingData[0]?.className !== undefined ? 4 : 3} className="h-24 text-center text-muted-foreground">
                Không có dữ liệu xếp hạng.
              </TableCell>
            </TableRow>
          ) : (
            rankingData.map((student) => (
              <TableRow key={student.studentId}>
                <TableCell className="font-bold text-lg text-primary">{student.rank}</TableCell>
                <TableCell className="font-medium">{student.studentName}</TableCell>
                {student.className !== undefined && <TableCell>{student.className}</TableCell>}
                <TableCell className="text-right font-semibold text-accent">{student.totalScore}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <TrendingUp className="mr-3 h-8 w-8 text-primary" /> Bảng Xếp Hạng Học Sinh
          </h1>
        </div>

        <Tabs defaultValue="overall" className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:max-w-md grid-cols-2 mb-6 bg-primary/10 p-1 rounded-lg">
            <TabsTrigger value="overall" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Toàn Bộ Hệ Thống</TabsTrigger>
            <TabsTrigger value="by-class" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md hover:bg-primary/20 hover:text-primary focus-visible:ring-primary/50">Theo Từng Lớp</TabsTrigger>
          </TabsList>

          <TabsContent value="overall">
            <Card className="shadow-md mb-6">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-center text-primary flex items-center justify-center">
                  <Trophy className="mr-2 h-7 w-7 text-yellow-400" /> Vinh Danh Top 3 Toàn Hệ Thống
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : topThreeOverall.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {topThreeOverall.map((student, index) => renderVinhDanhCard(student, index))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">Chưa có đủ dữ liệu để vinh danh.</p>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Bảng Xếp Hạng Chi Tiết - Toàn Bộ Hệ Thống</CardTitle>
                <CardDescription>Danh sách tất cả học sinh và tổng điểm của họ.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderRankingTable(overallRanking)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-class">
            <div className="mb-6">
              <Select onValueChange={setSelectedClassIdForRanking} value={selectedClassIdForRanking}>
                <SelectTrigger className="w-full md:w-[300px] bg-card shadow-sm">
                  <SelectValue placeholder={isLoadingClasses ? "Đang tải lớp..." : "Chọn lớp để xem xếp hạng"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.tenLop}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassIdForRanking && (
              <>
                <Card className="shadow-md mb-6">
                  <CardHeader>
                    <CardTitle className="text-2xl font-semibold text-center text-primary flex items-center justify-center">
                      <Trophy className="mr-2 h-7 w-7 text-yellow-400" /> Vinh Danh Top 3 Lớp {classes.find(c=>c.id === selectedClassIdForRanking)?.tenLop}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                     {isLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                        <Skeleton className="h-48 w-full" />
                      </div>
                    ) : topThreeClass.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {topThreeClass.map((student, index) => renderVinhDanhCard(student, index))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground">Chưa có đủ dữ liệu để vinh danh cho lớp này.</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-md">
                  <CardHeader>
                    <CardTitle>Bảng Xếp Hạng Chi Tiết - Lớp {classes.find(c=>c.id === selectedClassIdForRanking)?.tenLop}</CardTitle>
                    <CardDescription>Danh sách học sinh và tổng điểm của họ trong lớp đã chọn.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {renderRankingTable(classRanking)}
                  </CardContent>
                </Card>
              </>
            )}
            {!selectedClassIdForRanking && !isLoading && (
                 <div className="text-center py-10 bg-card rounded-lg shadow p-6">
                    <p className="text-xl text-muted-foreground">Vui lòng chọn một lớp để xem bảng xếp hạng chi tiết.</p>
                </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

