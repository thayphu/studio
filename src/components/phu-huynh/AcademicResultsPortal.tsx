
"use client";

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, AlertCircle, FileText, CalendarCheck2, BookCopy, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { HocSinh, PhieuLienLacRecord, TestFormatPLC, HomeworkStatusPLC } from '@/lib/types';
import { getStudentById } from '@/services/hocSinhService';
import { getPhieuLienLacRecordsForStudentInRange } from '@/services/phieuLienLacService';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Helper function (can be moved to utils if used elsewhere)
const calculateMasteryDetailsForDisplay = (testFormat?: TestFormatPLC, scoreInput?: string | number | null): { text: string; isTrulyMastered: boolean } => {
  const score = scoreInput !== undefined && scoreInput !== null && String(scoreInput).trim() !== '' && !isNaN(Number(scoreInput)) ? Number(scoreInput) : null;

  if (!testFormat || testFormat === "") {
    return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
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
    return { text: "Không có KT bài", isTrulyMastered: false };
  }
  return { text: "Chưa chọn hình thức KT", isTrulyMastered: false };
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

export default function AcademicResultsPortal() {
  const [studentIdQuery, setStudentIdQuery] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<HocSinh | null>(null);
  const [dailySlips, setDailySlips] = useState<PhieuLienLacRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { toast } = useToast();

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
          setDailySlips(slips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())); // Sort by most recent first
        } else {
          setSearchError("Không tìm thấy thông tin lớp của học sinh để tra cứu phiếu liên lạc.");
        }
      } else {
        setSearchError(`Không tìm thấy học sinh với mã "${studentIdQuery}".`);
        toast({ title: "Không tìm thấy", description: `Không tìm thấy học sinh với mã "${studentIdQuery}".`, variant: "default" });
      }
    } catch (error) {
      console.error("[AcademicResultsPortal] Error searching:", error);
      const errorMessage = (error as Error).message || "Đã có lỗi xảy ra khi tìm kiếm.";
      setSearchError(errorMessage);
      toast({ title: "Lỗi tra cứu", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const sortedDailySlips = useMemo(() => {
    return [...dailySlips].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailySlips]);

  return (
    <Card className="shadow-xl overflow-hidden rounded-xl">
      <CardHeader className="bg-primary/10 p-6">
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
          <Button type="submit" className="h-12 bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Search className="mr-2" />} Tra cứu
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
          </div>
        )}

        {!isLoading && searchedStudent && (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Thông tin học sinh</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p><strong className="text-muted-foreground">Họ và tên:</strong> {searchedStudent.hoTen}</p>
                <p><strong className="text-muted-foreground">Mã HS:</strong> {searchedStudent.id}</p>
                <p><strong className="text-muted-foreground">Lớp:</strong> {searchedStudent.tenLop || "N/A"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><CalendarCheck2 className="mr-2 h-5 w-5 text-primary"/>Phiếu liên lạc hàng ngày</CardTitle>
                <CardDescription>Danh sách các nhận xét và kết quả học tập theo từng ngày.</CardDescription>
              </CardHeader>
              <CardContent>
                {dailySlips.length > 0 ? (
                  <ScrollArea className="max-h-[400px] rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
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
                          const masteryDetails = calculateMasteryDetailsForDisplay(slip.testFormat, slip.score);
                          const homeworkDisplay = getHomeworkStatusTextAndColorForParent(slip.homeworkStatus);
                          return (
                            <TableRow key={slip.id}>
                              <TableCell>{format(parseISO(slip.date), "dd/MM/yy", { locale: vi })}</TableCell>
                              <TableCell>{slip.testFormat || "N/A"}</TableCell>
                              <TableCell>{renderScoreDisplayForParent(slip.score)}</TableCell>
                              <TableCell className={cn(masteryDetails.isTrulyMastered ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400", "font-medium")}>
                                {masteryDetails.text}
                              </TableCell>
                              <TableCell className={cn(homeworkDisplay.className)}>{homeworkDisplay.text}</TableCell>
                              <TableCell className="text-xs">{slip.remarks || "Không có"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Không có phiếu liên lạc nào cho học sinh này.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center"><BookCopy className="mr-2 h-5 w-5 text-primary"/>Phiếu liên lạc theo chu kỳ</CardTitle>
                <CardDescription>Tổng hợp kết quả học tập theo từng chu kỳ của lớp.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground italic">Tính năng xem phiếu liên lạc tổng hợp theo chu kỳ đang được phát triển. Vui lòng xem các phiếu hàng ngày ở trên.</p>
                {/* Placeholder for a button to trigger periodic slip dialog if needed later */}
                {/* <Button variant="outline" disabled>Xem Phiếu Chu Kỳ (Sắp có)</Button> */}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

