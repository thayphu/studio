
"use client";

import React, { useState, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label'; // Added Label import
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader as ShadDialogHeaderOriginal, DialogTitle as ShadDialogTitleOriginal, DialogDescription as ShadDialogDescriptionOriginal, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, AlertCircle, FileText, CalendarCheck2, BookCopy, Star, ClipboardList, UserCircle, School, Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { HocSinh, PhieuLienLacRecord, TestFormatPLC, HomeworkStatusPLC, LopHoc } from '@/lib/types';
import { getStudentById } from '@/services/hocSinhService';
import { getPhieuLienLacRecordsForStudentInRange } from '@/services/phieuLienLacService';
import { getClasses } from '@/services/lopHocService';
import { format, parseISO, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import html2canvas from 'html2canvas';
import { useQuery } from '@tanstack/react-query';

const DialogHeader = ShadDialogHeaderOriginal;
const DialogTitle = ShadDialogTitleOriginal;
const DialogDescription = ShadDialogDescriptionOriginal;

const calculateMasteryDetailsForDisplay = (testFormat?: TestFormatPLC, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (!testFormat || testFormat === "") {
    return { text: "Chưa có KT", isTrulyMastered: false };
  }
  if (testFormat === "KT bài cũ") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Thuộc bài, còn sai sót 1 vài từ", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài, còn sai sót nhiều", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT miệng") {
    if (score === 10) return { text: "Thuộc bài", isTrulyMastered: true };
    if (score === 9) return { text: "Thuộc bài, còn sai sót ít", isTrulyMastered: true };
    if (score !== null && score >= 7 && score <= 8) return { text: "Có học bài nhưng chưa thuộc hết từ vựng", isTrulyMastered: false };
    if (score !== null && score >= 5 && score <= 6) return { text: "Có học bài nhưng chỉ thuộc 1 phần từ vựng", isTrulyMastered: false };
    if (score !== null && score < 5) return { text: "Không thuộc bài", isTrulyMastered: false };
    return { text: "Chưa có điểm/Chưa đánh giá", isTrulyMastered: false };
  }
  if (testFormat === "KT 15 phút" || testFormat === "KT 45 Phút" || testFormat === "Làm bài tập") {
    return { text: "Không có KT bài cũ", isTrulyMastered: false };
  }
  return { text: "Chưa có KT", isTrulyMastered: false };
};

const StarRatingDisplay = ({ score, maxStars = 5 }: { score: number | null | undefined, maxStars?: number }) => {
    if (score === null || score === undefined) return null;
    let numStars = 0;
    const starColor = "text-green-500 dark:text-green-400";

    if (score >= 9 && score <= 10) numStars = 5;
    else if (score >= 7 && score < 9) numStars = 4;
    else if (score >= 5 && score < 7) numStars = 3;
    else numStars = 0;

    if (numStars === 0) return null;

    return (
      <div className="flex items-center">
        {[...Array(numStars)].map((_, i) => (
          <Star key={i} className={cn("h-3 w-3 fill-current", starColor)} />
        ))}
        {[...Array(maxStars - numStars)].map((_, i) => (
           <Star key={`empty-${i}`} className="h-3 w-3 text-gray-300 dark:text-gray-600" />
        ))}
      </div>
    );
};

const renderScoreDisplayForParent = (scoreValue?: number | null | string) => {
    if (scoreValue === null || scoreValue === undefined || String(scoreValue).trim() === '') return <span className="text-muted-foreground">N/A</span>;
    
    let score: number | null = null;
    if (!isNaN(Number(scoreValue))) {
        score = Number(scoreValue);
    } else {
        return <span className="text-destructive">Không hợp lệ</span>;
    }

    let scoreTextColor = "text-foreground";
    if (score >= 9 && score <= 10) scoreTextColor = "text-red-600 dark:text-red-400";
    else if (score >= 7 && score < 9) scoreTextColor = "text-blue-600 dark:text-blue-400";
    else if (score >= 5 && score < 7) scoreTextColor = "text-violet-600 dark:text-violet-400";
    else scoreTextColor = "text-orange-600 dark:text-orange-400";

    return (
      <div className="flex items-center gap-1">
        <span className={cn("font-semibold text-sm", scoreTextColor)}>{score}</span>
        <StarRatingDisplay score={score} />
      </div>
    );
};

const getHomeworkStatusTextAndColorForParent = (status?: HomeworkStatusPLC): {text: string, className: string} => {
    if (!status || status === "") return {text: "Không có bài tập", className: "text-muted-foreground"};
    if (status === "Đã làm bài đầy đủ") return {text: status, className: "text-blue-600 dark:text-blue-400 font-medium"};
    if (status === "Chỉ làm bài 1 phần" || status === "Chỉ làm 2/3 bài") return {text: status, className: "text-orange-500 dark:text-orange-400 font-medium"};
    if (status === "Không làm bài") return {text: status, className: "text-red-600 dark:text-red-400 font-medium"};
    return {text: status || "Không có bài tập", className: "text-muted-foreground"};
};

interface SlipDetailItemProps {
  label: string;
  children: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  fullWidth?: boolean;
}

const SlipDetailItem: React.FC<SlipDetailItemProps> = ({ label, children, labelClassName, valueClassName, fullWidth = false }) => {
  if (fullWidth) {
    return (
      <div className="text-sm leading-normal pb-0.5">
        <strong className={cn("font-medium text-muted-foreground mr-2 block mb-0.5", labelClassName)}>{label}</strong>
        <div className={cn("font-medium text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row sm:items-start text-sm leading-snug py-0.5">
      <strong className={cn("font-medium text-muted-foreground mr-2 w-full sm:w-[140px] shrink-0 text-left mb-0.5 sm:mb-0", labelClassName)}>{label}</strong>
      <span className={cn("font-medium flex-1 text-left text-foreground", valueClassName)}>{children || <span className="text-muted-foreground italic">Không có</span>}</span>
    </div>
  );
};

export default function AcademicResultsPortal() {
  const [studentIdQuery, setStudentIdQuery] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<HocSinh | null>(null);
  const [dailySlips, setDailySlips] = useState<PhieuLienLacRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { toast } = useToast();

  const [isDailySlipDetailModalOpen, setIsDailySlipDetailModalOpen] = useState(false);
  const [selectedDailySlip, setSelectedDailySlip] = useState<PhieuLienLacRecord | null>(null);
  const dailySlipDialogContentRef = useRef<HTMLDivElement>(null);
  const periodicSlipContentRef = useRef<HTMLDivElement>(null);

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery<LopHoc[], Error>({
    queryKey: ['classes'],
    queryFn: getClasses,
  });

  const studentClass = useMemo(() => {
    if (!searchedStudent || !searchedStudent.lopId || !classes || classes.length === 0) return undefined;
    return classes.find(cls => cls.id === searchedStudent.lopId);
  }, [searchedStudent, classes]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentIdQuery.trim()) {
      toast({ title: "Lỗi", description: "Vui lòng nhập Mã Học Sinh.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setSearchedStudent(null);
    setDailySlips([]);
    setSearchError(null);

    try {
      const student = await getStudentById(studentIdQuery.trim());
      if (student) {
        setSearchedStudent(student);
        if (student.id && student.lopId) {
          const slips = await getPhieuLienLacRecordsForStudentInRange(student.id, student.lopId);
          setDailySlips(slips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } else {
          setSearchError("Không tìm thấy thông tin lớp của học sinh để tra cứu phiếu liên lạc.");
          toast({ title: "Thiếu thông tin", description: "Không tìm thấy thông tin lớp của học sinh.", variant: "warning" });
        }
      } else {
        setSearchError(`Không tìm thấy học sinh với mã "${studentIdQuery}".`);
        toast({ title: "Không tìm thấy", description: `Không tìm thấy học sinh với mã "${studentIdQuery}".`, variant: "default" });
      }
    } catch (error) {
      console.error("[AcademicResultsPortal] Error searching:", error);
      const errorMessage = (error as Error).message || "Đã có lỗi xảy ra khi tìm kiếm.";
      setSearchError(errorMessage);
      toast({ 
        title: "Lỗi tra cứu", 
        description: `${errorMessage}. Kiểm tra console server để biết lỗi chi tiết từ Firebase (ví dụ: thiếu Index).`, 
        variant: "destructive",
        duration: 7000 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDailySlipDetail = (slip: PhieuLienLacRecord) => {
    setSelectedDailySlip(slip);
    setIsDailySlipDetailModalOpen(true);
  };
  
  const sortedDailySlips = useMemo(() => {
    return [...dailySlips].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailySlips]);
  
  const periodicSlipDateRangeText = useMemo(() => {
    if (dailySlips.length === 0) return "Chưa có dữ liệu";
    const sortedSlipsForRange = [...dailySlips].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sortedSlipsForRange.length === 0) return "Chưa có dữ liệu";
    const firstDate = parseISO(sortedSlipsForRange[0].date);
    const lastDate = parseISO(sortedSlipsForRange[sortedSlipsForRange.length - 1].date);
    return `Từ ${format(firstDate, "dd/MM/yyyy", {locale: vi})} đến ${format(lastDate, "dd/MM/yyyy", {locale: vi})}`;
  }, [dailySlips]);

  const handleExportImage = async (contentRef: React.RefObject<HTMLDivElement>, studentName: string | undefined, type: 'daily' | 'periodic', dateOrRange: string) => {
    if (!contentRef.current || !studentName) {
      toast({ title: "Lỗi", description: "Không có nội dung phiếu hoặc thông tin học sinh để xuất.", variant: "destructive"});
      return;
    }
    if (typeof html2canvas === 'undefined') {
      toast({ title: "Lỗi Xuất Ảnh", description: "Thư viện html2canvas chưa được tải.", variant: "destructive"});
      return;
    }
    try {
        const canvas = await html2canvas(contentRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
        const image = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = image;
        const safeStudentName = studentName.replace(/\s+/g, '_');
        const safeDateOrRange = dateOrRange.replace(/\s+/g, '_').replace(/\//g, '-');
        link.download = `PhieuLienLac_${type === 'daily' ? 'Ngay' : 'ChuKy'}_${safeStudentName}_${safeDateOrRange}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: "Thành công!", description: `Phiếu liên lạc ${type === 'daily' ? 'hàng ngày' : 'chu kỳ'} đã được xuất ra ảnh.` });
    } catch (error) {
      console.error(`[AcademicResultsPortal] Error exporting ${type} slip image:`, error);
      toast({ title: "Lỗi xuất ảnh", description: (error as Error).message, variant: "destructive" });
    }
  };

  return (
    <Card className="shadow-xl overflow-hidden rounded-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-primary flex items-center">
          <FileText className="mr-3 h-7 w-7" /> Tra cứu Kết quả học tập & Phiếu liên lạc
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-8">
          <Input
            type="text"
            placeholder="Nhập Mã Học Sinh (VD: 2024001)"
            value={studentIdQuery}
            onChange={(e) => setStudentIdQuery(e.target.value.toUpperCase())}
            className="flex-grow text-base h-12"
            required
          />
          <Button type="submit" className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading || isLoadingClasses}>
            {(isLoading || isLoadingClasses) ? <Loader2 className="animate-spin" /> : <Search className="mr-2" />} Tra cứu
          </Button>
        </form>

        {isLoading && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground mt-2">Đang tải dữ liệu...</p>
          </div>
        )}

        {searchError && !isLoading && (
          <div className="text-destructive text-center py-6 border border-destructive/30 bg-destructive/5 p-4 rounded-md">
            <AlertCircle className="mx-auto h-10 w-10 mb-2" />
            <p className="font-semibold">{searchError}</p>
            {searchError.includes("index") && <p className="text-xs mt-1">Vui lòng liên hệ quản trị viên để kiểm tra cấu hình cơ sở dữ liệu.</p>}
            {searchError.includes("Firebase") && <p className="text-xs mt-1">Vui lòng kiểm tra console server để biết lỗi chi tiết.</p>}
          </div>
        )}

        {!isLoading && searchedStudent && (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><UserCircle className="mr-2 h-5 w-5 text-primary"/>Thông tin học sinh</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
                  <div><strong className="text-muted-foreground">Họ và tên:</strong> {searchedStudent.hoTen}</div>
                  <div><strong className="text-muted-foreground">Mã HS:</strong> {searchedStudent.id}</div>
                  <div><strong className="text-muted-foreground">Lớp:</strong> {searchedStudent.tenLop || "N/A"}</div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="daily-slips" className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:max-w-xs mb-4 bg-primary/5 p-1 rounded-lg">
                <TabsTrigger value="daily-slips" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm hover:bg-primary/10 focus-visible:ring-primary/50">Hàng ngày</TabsTrigger>
                <TabsTrigger value="periodic-slips" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-sm hover:bg-primary/10 focus-visible:ring-primary/50">Theo chu kỳ</TabsTrigger>
              </TabsList>
              <TabsContent value="daily-slips">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center"><CalendarCheck2 className="mr-2 h-5 w-5 text-primary"/>Phiếu liên lạc hàng ngày</CardTitle>
                    <CardDescription>Danh sách các nhận xét và kết quả học tập theo từng ngày. Nhấp vào một hàng để xem chi tiết.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dailySlips.length > 0 ? (
                      <ScrollArea className="max-h-[400px] rounded-md border">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                            <TableRow>
                              <TableHead className="w-[100px]">Ngày</TableHead>
                              <TableHead>Hình thức KT</TableHead>
                              <TableHead className="w-[80px]">Điểm</TableHead>
                              <TableHead>Thuộc bài</TableHead>
                              <TableHead>Bài tập về nhà</TableHead>
                              <TableHead>Nhận xét</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedDailySlips.map((slip) => {
                              if(!slip) return null; 
                              const masteryDetails = calculateMasteryDetailsForDisplay(slip.testFormat, slip.score);
                              const homeworkDisplay = getHomeworkStatusTextAndColorForParent(slip.homeworkStatus);
                              return (
                                <TableRow key={slip.id} onClick={() => handleViewDailySlipDetail(slip)} className="cursor-pointer hover:bg-muted/50">
                                  <TableCell>{format(parseISO(slip.date), "dd/MM/yy", { locale: vi })}</TableCell>
                                  <TableCell>{slip.testFormat || "N/A"}</TableCell>
                                  <TableCell>{renderScoreDisplayForParent(slip.score)}</TableCell>
                                  <TableCell className={cn(masteryDetails.isTrulyMastered ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400", "font-medium text-xs")}>
                                    {masteryDetails.text}
                                  </TableCell>
                                  <TableCell className={cn(homeworkDisplay.className, "text-xs")}>{homeworkDisplay.text}</TableCell>
                                  <TableCell className="text-xs truncate max-w-xs">{slip.remarks || "Không có"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">Không có phiếu liên lạc hàng ngày nào cho học sinh này.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="periodic-slips">
                 <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary"/>Phiếu liên lạc theo chu kỳ</CardTitle>
                    <CardDescription>Tổng hợp kết quả học tập theo từng chu kỳ của lớp.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingClasses && <Skeleton className="h-20 w-full"/>}
                    {!isLoadingClasses && searchedStudent && studentClass && dailySlips.length > 0 ? (
                      <div className="space-y-4">
                        <div ref={periodicSlipContentRef} className="bg-background font-sans p-4 sm:p-6 border rounded-lg shadow-sm leading-normal">
                            <div className="text-center mb-4">
                                <h2 className="text-xl sm:text-2xl font-bold uppercase text-primary">PHIẾU LIÊN LẠC CHU KỲ</h2>
                                <p className="text-xs sm:text-sm text-muted-foreground">Ngày xuất: {format(new Date(), "dd/MM/yyyy", { locale: vi })}</p>
                            </div>
                            
                            <div className="space-y-1 text-xs sm:text-sm mb-3 leading-snug">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                    <p><strong className="font-medium text-muted-foreground">Họ và tên:</strong> <span className="font-semibold text-indigo-700">{searchedStudent.hoTen}</span></p>
                                    <p><strong className="font-medium text-muted-foreground">Lớp:</strong> <span className="font-medium">{studentClass.tenLop}</span></p>
                                    <p><strong className="font-medium text-muted-foreground">Mã HS:</strong> <span className="font-medium">{searchedStudent.id}</span></p>
                                    <p><strong className="font-medium text-muted-foreground">Chu kỳ học:</strong> <span className="font-medium">{studentClass.chuKyDongPhi} ({periodicSlipDateRangeText})</span></p>
                                </div>
                            </div>
                            <Separator className="my-2" />
                            
                            <h3 className="text-sm sm:text-md font-semibold text-foreground mt-2 mb-1">Tình hình học tập:</h3>
                            {dailySlips.length > 0 ? (
                                <ScrollArea className="max-h-[250px] sm:max-h-[300px] rounded-md border mb-2">
                                <Table className="text-xs sm:text-sm">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px] sm:w-[50px] p-1.5 sm:p-2">STT</TableHead>
                                            <TableHead className="p-1.5 sm:p-2">Ngày KT</TableHead>
                                            <TableHead className="p-1.5 sm:p-2">Hình thức</TableHead>
                                            <TableHead className="p-1.5 sm:p-2">Điểm</TableHead>
                                            <TableHead className="p-1.5 sm:p-2">Thuộc bài</TableHead>
                                            <TableHead className="p-1.5 sm:p-2">Bài tập về nhà</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedDailySlips.map((slip, index) => {
                                            const masteryDetails = calculateMasteryDetailsForDisplay(slip.testFormat, slip.score);
                                            const homeworkDisplay = getHomeworkStatusTextAndColorForParent(slip.homeworkStatus);
                                            return (
                                            <TableRow key={`periodic-detail-${slip.id}`}>
                                                <TableCell className="p-1.5 sm:p-2">{index + 1}</TableCell>
                                                <TableCell className="p-1.5 sm:p-2">{format(parseISO(slip.date), "dd/MM/yy")}</TableCell>
                                                <TableCell className="p-1.5 sm:p-2">{slip.testFormat || 'N/A'}</TableCell>
                                                <TableCell className="p-1.5 sm:p-2">{renderScoreDisplayForParent(slip.score)}</TableCell>
                                                <TableCell className={cn(masteryDetails.isTrulyMastered ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400", "font-medium p-1.5 sm:p-2")}>{masteryDetails.text}</TableCell>
                                                <TableCell className={cn(homeworkDisplay.className, "p-1.5 sm:p-2")}>{homeworkDisplay.text}</TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                                </ScrollArea>
                            ) : (
                                <p className="text-muted-foreground text-xs sm:text-sm">Không có dữ liệu phiếu liên lạc chi tiết cho chu kỳ này.</p>
                            )}
                            <Separator className="my-2" />
                            
                            <div className="mt-2">
                                <Label htmlFor="periodic-summary-remark-parent-view" className="text-sm sm:text-md font-semibold text-foreground mb-1 block">Nhận xét tổng hợp (của giáo viên):</Label>
                                <p className="text-xs sm:text-sm text-muted-foreground italic p-2 border rounded-md min-h-[50px] sm:min-h-[60px]">
                                    {dailySlips.find(slip => slip.remarks && (slip.remarks.toLowerCase().includes("tổng kết") || slip.remarks.toLowerCase().includes("tổng hợp")) )?.remarks || "Chưa có nhận xét tổng hợp từ giáo viên cho chu kỳ này."}
                                </p>
                            </div>
                            <Separator className="my-2"/>
                            <div className="text-sm sm:text-md font-semibold text-foreground mt-2 text-center">
                                <p><strong>Trân trọng.</strong></p>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button onClick={() => handleExportImage(periodicSlipContentRef, searchedStudent?.hoTen, 'periodic', periodicSlipDateRangeText)} disabled={typeof html2canvas === 'undefined' || !searchedStudent} size="sm">
                                {typeof html2canvas === 'undefined' && searchedStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                                {typeof html2canvas === 'undefined' && searchedStudent ? "Đang tải..." : "Xuất file ảnh"}
                            </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground italic text-center py-4">
                        {!searchedStudent ? "Vui lòng tra cứu học sinh để xem phiếu chu kỳ." : "Chưa có dữ liệu phiếu liên lạc hàng ngày để tổng hợp thành phiếu chu kỳ."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>

      {selectedDailySlip && searchedStudent && (
        <Dialog open={isDailySlipDetailModalOpen} onOpenChange={(open) => {
            setIsDailySlipDetailModalOpen(open);
            if (!open) setSelectedDailySlip(null);
        }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
            <ScrollArea className="flex-grow"> 
              <div ref={dailySlipDialogContentRef} className="bg-background font-sans p-4 space-y-1 leading-normal">
                 <DialogHeader className="p-0 pt-2 pb-1 text-center sticky top-0 z-10 bg-background">
                    <DialogTitle className="text-2xl font-bold uppercase text-primary text-center">
                        PHIẾU LIÊN LẠC
                    </DialogTitle>
                    {selectedDailySlip.date && (
                        <DialogDescription className="text-sm text-center text-muted-foreground">
                        Ngày: {format(parse(selectedDailySlip.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}
                        </DialogDescription>
                    )}
                  </DialogHeader>
                
                  <div className="space-y-0.5 text-sm mt-1">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Họ và tên:</strong> <span className="text-indigo-700 font-semibold text-base">{searchedStudent.hoTen}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Lớp:</strong> <span className="font-medium text-base">{searchedStudent.tenLop || 'N/A'}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Mã HS:</strong> <span className="font-medium text-base">{searchedStudent.id}</span></p>
                        <p className="text-left"><strong className="font-medium text-muted-foreground mr-1">Ngày KT:</strong> <span className="font-medium text-base">{format(parse(selectedDailySlip.date, 'yyyy-MM-dd', new Date()), "dd/MM/yyyy", { locale: vi })}</span></p>
                     </div>
                  </div>
                  <Separator className="my-1.5" />
                  
                  <h3 className="text-md font-semibold text-foreground mt-1.5 mb-0.5">Kết quả học tập:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-sm">
                    <div className="space-y-0.5">
                      <SlipDetailItem label="Hình thức KT:">{selectedDailySlip.testFormat || "N/A"}</SlipDetailItem>
                      <SlipDetailItem label="Thuộc bài:">
                        <span className={cn(calculateMasteryDetailsForDisplay(selectedDailySlip.testFormat, selectedDailySlip.score).isTrulyMastered ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400", "font-medium")}>
                            {calculateMasteryDetailsForDisplay(selectedDailySlip.testFormat, selectedDailySlip.score).text}
                        </span>
                      </SlipDetailItem>
                    </div>
                    <div className="space-y-0.5">
                      <SlipDetailItem label="Điểm số:">{renderScoreDisplayForParent(selectedDailySlip.score)}</SlipDetailItem>
                       <SlipDetailItem label="Bài tập về nhà:">
                         <span className={cn(getHomeworkStatusTextAndColorForParent(selectedDailySlip.homeworkStatus).className)}>
                            {getHomeworkStatusTextAndColorForParent(selectedDailySlip.homeworkStatus).text}
                         </span>
                       </SlipDetailItem>
                    </div>
                  </div>
                  <Separator className="my-1.5"/>
                  <SlipDetailItem label="Từ vựng cần học lại:" fullWidth>{selectedDailySlip.vocabularyToReview}</SlipDetailItem>
                  <SlipDetailItem label="Nhận xét:" fullWidth>{selectedDailySlip.remarks}</SlipDetailItem>

                  <Separator className="my-1.5"/>
                  <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mt-1.5 mb-0.5">Hướng dẫn Bài tập về nhà:</h3>
                  <SlipDetailItem label="Từ vựng cần học:" fullWidth>{selectedDailySlip.homeworkAssignmentVocabulary}</SlipDetailItem>
                  <SlipDetailItem label="Bài tập làm tại nhà:" fullWidth>{selectedDailySlip.homeworkAssignmentTasks}</SlipDetailItem>

                  <Separator className="my-1.5"/>
                  <div className="text-sm font-medium leading-snug mt-1.5">
                    {(selectedDailySlip.vocabularyToReview && selectedDailySlip.vocabularyToReview.trim() !== "") || (selectedDailySlip.remarks && selectedDailySlip.remarks.toLowerCase().includes("nhắc nhở")) ? (
                        <>
                            <p>Quý Phụ huynh nhắc nhở các em viết lại những từ vựng chưa thuộc và/hoặc hoàn thành các nội dung được giáo viên dặn dò.</p>
                            <p className="mt-1"><strong>Trân trọng.</strong></p>
                        </>
                    ) : (
                        <p className="mt-1"><strong>Trân trọng.</strong></p>
                    )}
                  </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-2 border-t sm:justify-between bg-background">
              <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm">Đóng</Button>
              </DialogClose>
              <Button
                onClick={() => handleExportImage(dailySlipDialogContentRef, searchedStudent?.hoTen, 'daily', selectedDailySlip.date)}
                disabled={typeof html2canvas === 'undefined' || !searchedStudent}
                size="sm"
              >
                 {typeof html2canvas === 'undefined' && searchedStudent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                 {typeof html2canvas === 'undefined' && searchedStudent ? "Đang tải..." : "Xuất file ảnh"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

