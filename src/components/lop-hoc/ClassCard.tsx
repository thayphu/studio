
import type { LopHoc } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { School, CalendarDays, Clock, MapPin, DollarSign, Users, Edit, Trash2, UserPlus, XCircle, Loader2 } from 'lucide-react';
import { TEXTS_VI } from '@/lib/constants';

interface ClassCardProps {
  lopHoc: LopHoc;
  onEdit: (lopHoc: LopHoc) => void;
  onDelete: (lopHoc: LopHoc) => void;
  onAddStudent: (lopHocId: string) => void;
  onCloseClass: (lopHoc: LopHoc) => void; // Added prop for closing class
  isDeleting?: boolean;
  isUpdating?: boolean;
}

export default function ClassCard({ lopHoc, onEdit, onDelete, onAddStudent, onCloseClass, isDeleting, isUpdating }: ClassCardProps) {
  let tongHocPhi: number;
  let hocPhiBuoi: number;

  const sessionsInCycleMap: { [key: string]: number | undefined } = {
    '8 buổi': 8,
    '10 buổi': 10,
  };
  const sessionsInDefinedCycle = sessionsInCycleMap[lopHoc.chuKyDongPhi];

  if (sessionsInDefinedCycle) {
    tongHocPhi = lopHoc.hocPhi * sessionsInDefinedCycle;
    hocPhiBuoi = lopHoc.hocPhi;
  } else if (lopHoc.chuKyDongPhi === '1 tháng') {
    tongHocPhi = lopHoc.hocPhi;
    const sessionsPerWeek = lopHoc.lichHoc.length;
    const sessionsPerMonth = sessionsPerWeek * 4; // Assuming 4 weeks per month
    hocPhiBuoi = sessionsPerMonth > 0 ? lopHoc.hocPhi / sessionsPerMonth : 0;
  } else if (lopHoc.chuKyDongPhi === 'Theo ngày') {
    tongHocPhi = lopHoc.hocPhi;
    hocPhiBuoi = lopHoc.hocPhi;
  } else {
    // Fallback for any other undefined cycles
    tongHocPhi = lopHoc.hocPhi;
    hocPhiBuoi = 0;
  }

  const actionInProgress = isDeleting || isUpdating;

  const handleCloseClassClick = () => {
    console.log('[ClassCard] Close Class button clicked for:', lopHoc.tenLop, lopHoc.id);
    onCloseClass(lopHoc);
  };

  return (
    <Card className={`flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 ${actionInProgress ? 'opacity-50 pointer-events-none' : ''}`}>
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <School className="mr-2 h-6 w-6" /> {lopHoc.tenLop}
          </CardTitle>
          <Badge variant={lopHoc.trangThai === 'Đang hoạt động' ? 'default' : 'destructive'}>
            {lopHoc.trangThai}
            {lopHoc.trangThai === 'Đã đóng' && lopHoc.ngayDongLop && (
              <span className="text-xs ml-1">({lopHoc.ngayDongLop.substring(6,8)}/{lopHoc.ngayDongLop.substring(4,6)}/{lopHoc.ngayDongLop.substring(0,4)})</span>
            )}
          </Badge>
        </div>
        <CardDescription className="flex items-center text-sm text-muted-foreground pt-1">
          <MapPin className="mr-1.5 h-4 w-4" /> {lopHoc.diaDiem}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 text-sm">
        <div className="flex items-center">
          <CalendarDays className="mr-2 h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium">Lịch học: </span>
            {lopHoc.lichHoc.join(', ')}
          </div>
        </div>
        <div className="flex items-center">
          <Clock className="mr-2 h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium">Giờ học: </span>
            {lopHoc.gioHoc}
          </div>
        </div>
        <div className="flex items-start">
          <DollarSign className="mr-2 h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <div>
              <span className="font-medium">Tổng học phí: </span>
              <span className="font-bold text-red-600">
                {formatCurrencyVND(tongHocPhi)}
              </span>
              <span className="font-medium"> / {lopHoc.chuKyDongPhi}</span>
            </div>
            {hocPhiBuoi > 0 && (
              <div className="text-xs text-muted-foreground">
                (Học phí / buổi: {formatCurrencyVND(hocPhiBuoi)})
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center">
          <Users className="mr-2 h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium">{TEXTS_VI.currentStudentsLabel}: </span>
            {lopHoc.soHocSinhHienTai}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 pt-4 border-t">
        <Button aria-label={TEXTS_VI.editButton} variant="outline" size="icon" onClick={() => onEdit(lopHoc)} disabled={actionInProgress}>
          {isUpdating && lopHoc.trangThai !== 'Đã đóng' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
        </Button>
        <Button aria-label={TEXTS_VI.deleteButton} variant="destructive" size="icon" onClick={() => onDelete(lopHoc)} disabled={actionInProgress}>
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
        <Button
          aria-label={TEXTS_VI.addStudentButton}
          variant="secondary"
          size="icon"
          onClick={() => onAddStudent(lopHoc.id)}
          disabled={actionInProgress || lopHoc.trangThai === 'Đã đóng'}
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleCloseClassClick} 
            aria-label={TEXTS_VI.closeClassButton} 
            className="border-amber-500 text-amber-600 hover:bg-amber-50" 
            disabled={actionInProgress || lopHoc.trangThai === 'Đã đóng'}
          >
             {isUpdating && lopHoc.trangThai === 'Đang hoạt động' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          </Button>
        
      </CardFooter>
    </Card>
  );
}
