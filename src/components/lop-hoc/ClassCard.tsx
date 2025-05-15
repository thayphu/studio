
import type { LopHoc } from '@/lib/types';
import { formatCurrencyVND } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { School, CalendarDays, Clock, MapPin, DollarSign, Users, Edit, Trash2, UserPlus, XCircle } from 'lucide-react';
import { TEXTS_VI } from '@/lib/constants';

interface ClassCardProps {
  lopHoc: LopHoc;
  onEdit: (lopHoc: LopHoc) => void;
  onDelete: (id: string) => void;
  // onAddStudent: (lopHocId: string) => void;
  // onCloseClass: (lopHocId: string) => void;
}

export default function ClassCard({ lopHoc, onEdit, onDelete }: ClassCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <School className="mr-2 h-6 w-6" /> {lopHoc.tenLop}
          </CardTitle>
          <Badge variant={lopHoc.trangThai === 'Đang hoạt động' ? 'default' : 'destructive'}>
            {lopHoc.trangThai}
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
        <div className="flex items-center">
          <DollarSign className="mr-2 h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium">Học phí: </span>
            {formatCurrencyVND(lopHoc.hocPhi)} / {lopHoc.chuKyDongPhi}
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
        <Button variant="outline" size="icon" onClick={() => onEdit(lopHoc)} aria-label={TEXTS_VI.editButton} className="flex-1 min-w-[40px]">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDelete(lopHoc.id)} aria-label={TEXTS_VI.deleteButton} className="flex-1 min-w-[40px]">
          <Trash2 className="h-4 w-4" />
        </Button>
        {/* Placeholder for other actions */}
        <Button variant="secondary" size="icon" aria-label={TEXTS_VI.addStudentButton} className="flex-1 min-w-[40px]">
          <UserPlus className="h-4 w-4" />
        </Button>
        {lopHoc.trangThai === 'Đang hoạt động' && (
          <Button variant="outline" size="icon" aria-label={TEXTS_VI.closeClassButton} className="flex-1 min-w-[40px] border-amber-500 text-amber-600 hover:bg-amber-50">
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
