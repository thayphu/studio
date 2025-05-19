
"use client";

import React, { useState, useCallback } from 'react';
import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as ShadCardDescription } from '@/components/ui/card';
import { PlusCircle, Trash2, AlertCircle, Loader2, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Quiz, Question, QuestionOption, OptionLabel } from '@/lib/types';
import { ALL_OPTION_LABELS } from '@/lib/types';
import { saveQuiz, getQuizzes } from '@/services/quizService';
import { nanoid } from 'nanoid';

interface NewQuestionFormState {
  text: string;
  options: Record<OptionLabel, string>;
  correctOptionLabel: OptionLabel | '';
}

const initialNewQuestionState: NewQuestionFormState = {
  text: '',
  options: { A: '', B: '', C: '', D: '' },
  correctOptionLabel: '',
};

export default function BaiKiemTraPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateQuizModalOpen, setIsCreateQuizModalOpen] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDescription, setNewQuizDescription] = useState('');
  const [currentQuestions, setCurrentQuestions] = useState<Omit<Question, 'id'>[]>([]);
  const [newQuestion, setNewQuestion] = useState<NewQuestionFormState>(initialNewQuestionState);

  const { data: quizzes = [], isLoading: isLoadingQuizzes, isError: isErrorQuizzes, error: errorQuizzes } = useQuery<Quiz[], Error>({
    queryKey: ['quizzes'],
    queryFn: getQuizzes,
  });

  const saveQuizMutation = useMutation({
    mutationFn: (data: { quizData: Omit<Quiz, 'id' | 'createdAt' | 'questions'>, questions: Omit<Question, 'id'>[] }) =>
      saveQuiz(data.quizData, data.questions),
    onSuccess: () => {
      toast({ title: "Thành công!", description: "Đề kiểm tra đã được lưu." });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      setIsCreateQuizModalOpen(false);
      setNewQuizTitle('');
      setNewQuizDescription('');
      setCurrentQuestions([]);
      setNewQuestion(initialNewQuestionState);
    },
    onError: (error: Error) => {
      toast({
        title: "Lỗi khi lưu đề kiểm tra",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNewQuestionInputChange = <K extends keyof NewQuestionFormState>(field: K, value: NewQuestionFormState[K]) => {
    setNewQuestion(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionInputChange = (optionLabel: OptionLabel, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: { ...prev.options, [optionLabel]: value },
    }));
  };

  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) {
      toast({ title: "Lỗi", description: "Nội dung câu hỏi không được để trống.", variant: "destructive" });
      return;
    }
    if (ALL_OPTION_LABELS.some(label => !newQuestion.options[label].trim())) {
      toast({ title: "Lỗi", description: "Vui lòng nhập nội dung cho tất cả các lựa chọn A, B, C, D.", variant: "destructive" });
      return;
    }
    if (!newQuestion.correctOptionLabel) {
      toast({ title: "Lỗi", description: "Vui lòng chọn đáp án đúng.", variant: "destructive" });
      return;
    }

    const questionToAdd: Omit<Question, 'id'> = {
      text: newQuestion.text.trim(),
      options: ALL_OPTION_LABELS.map(label => ({
        id: label, // Using A, B, C, D as IDs for options within a question
        text: newQuestion.options[label].trim(),
      })),
      correctOptionId: newQuestion.correctOptionLabel,
    };
    setCurrentQuestions(prev => [...prev, questionToAdd]);
    setNewQuestion(initialNewQuestionState); // Reset for next question
  };

  const handleRemoveQuestion = (indexToRemove: number) => {
    setCurrentQuestions(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSaveQuiz = () => {
    if (!newQuizTitle.trim()) {
      toast({ title: "Lỗi", description: "Tiêu đề đề kiểm tra không được để trống.", variant: "destructive" });
      return;
    }
    if (currentQuestions.length === 0) {
      toast({ title: "Lỗi", description: "Đề kiểm tra phải có ít nhất một câu hỏi.", variant: "destructive" });
      return;
    }
    saveQuizMutation.mutate({
      quizData: { title: newQuizTitle.trim(), description: newQuizDescription.trim() },
      questions: currentQuestions,
    });
  };


  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <ListChecks className="mr-3 h-8 w-8 text-primary" /> Quản lý Đề kiểm tra
          </h1>
          <Button onClick={() => setIsCreateQuizModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Tạo Đề kiểm tra mới
          </Button>
        </div>

        {isLoadingQuizzes && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={`quiz-skel-${i}`}><CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader><CardContent><div className="h-4 bg-muted rounded w-1/2"></div></CardContent></Card>
            ))}
          </div>
        )}

        {isErrorQuizzes && (
          <div className="p-4 text-destructive text-center border border-destructive/50 bg-destructive/10 rounded-md shadow-sm">
            <AlertCircle className="inline mr-2 h-5 w-5"/>Lỗi tải danh sách đề kiểm tra.
            <p className="text-xs text-muted-foreground mt-1">{(errorQuizzes as Error)?.message || "Không thể tải dữ liệu."}</p>
          </div>
        )}

        {!isLoadingQuizzes && !isErrorQuizzes && quizzes.length === 0 && (
          <div className="text-center py-10 bg-card rounded-lg shadow p-6">
            <p className="text-xl text-muted-foreground">Chưa có đề kiểm tra nào. Hãy tạo đề mới!</p>
          </div>
        )}

        {!isLoadingQuizzes && !isErrorQuizzes && quizzes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map(quiz => (
              <Card key={quiz.id} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{quiz.title}</CardTitle>
                  <ShadCardDescription>{quiz.description || "Không có mô tả"}</ShadCardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Số câu hỏi: {quiz.questions.length}</p>
                  <p className="text-xs text-muted-foreground">Ngày tạo: {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}</p>
                </CardContent>
                {/* Add Edit/Delete/View buttons later */}
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isCreateQuizModalOpen} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setNewQuizTitle(''); setNewQuizDescription(''); setCurrentQuestions([]); setNewQuestion(initialNewQuestionState);
            }
            setIsCreateQuizModalOpen(isOpen);
        }}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Tạo Đề kiểm tra mới</DialogTitle>
              <DialogDescription>Điền thông tin và thêm các câu hỏi cho đề kiểm tra của bạn.</DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-grow -mx-6 px-6 py-4 border-y">
              <div className="space-y-6">
                {/* Quiz Info */}
                <div className="space-y-2">
                  <Label htmlFor="quiz-title">Tiêu đề Đề kiểm tra</Label>
                  <Input id="quiz-title" value={newQuizTitle} onChange={(e) => setNewQuizTitle(e.target.value)} placeholder="VD: Kiểm tra giữa kỳ Tiếng Anh lớp 12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quiz-description">Mô tả (tùy chọn)</Label>
                  <Textarea id="quiz-description" value={newQuizDescription} onChange={(e) => setNewQuizDescription(e.target.value)} placeholder="Mô tả ngắn về nội dung đề kiểm tra..." />
                </div>

                <hr className="my-4"/>

                {/* Add Question Form */}
                <Card className="bg-muted/50">
                  <CardHeader><CardTitle className="text-lg">Thêm Câu hỏi mới</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-question-text">Nội dung câu hỏi</Label>
                      <Textarea id="new-question-text" value={newQuestion.text} onChange={(e) => handleNewQuestionInputChange('text', e.target.value)} placeholder="Nhập nội dung câu hỏi ở đây..." />
                    </div>
                    {ALL_OPTION_LABELS.map(label => (
                      <div key={label} className="space-y-1">
                        <Label htmlFor={`new-option-${label}`}>Lựa chọn {label}</Label>
                        <Input id={`new-option-${label}`} value={newQuestion.options[label]} onChange={(e) => handleOptionInputChange(label, e.target.value)} placeholder={`Nội dung lựa chọn ${label}`} />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <Label>Đáp án đúng</Label>
                      <RadioGroup
                        value={newQuestion.correctOptionLabel}
                        onValueChange={(val) => handleNewQuestionInputChange('correctOptionLabel', val as OptionLabel)}
                        className="flex space-x-4"
                      >
                        {ALL_OPTION_LABELS.map(label => (
                          <div key={`radio-${label}`} className="flex items-center space-x-2">
                            <RadioGroupItem value={label} id={`correct-${label}`} />
                            <Label htmlFor={`correct-${label}`}>{label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                    <Button onClick={handleAddQuestion} type="button" variant="outline" size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" /> Thêm câu hỏi này
                    </Button>
                  </CardContent>
                </Card>

                {/* Current Questions List */}
                {currentQuestions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-md font-semibold">Các câu hỏi đã thêm ({currentQuestions.length}):</h3>
                    <ScrollArea className="max-h-60 border rounded-md p-3 space-y-2 bg-background">
                      {currentQuestions.map((q, index) => (
                        <div key={index} className="p-2 border rounded-md text-sm">
                          <div className="flex justify-between items-start">
                            <p className="font-medium flex-1">Câu {index + 1}: {q.text}</p>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveQuestion(index)} className="h-7 w-7 shrink-0">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <ul className="list-disc list-inside pl-4 mt-1">
                            {q.options.map(opt => (
                              <li key={opt.id} className={opt.id === q.correctOptionId ? 'font-bold text-green-600' : ''}>
                                {opt.id}: {opt.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Hủy</Button>
              </DialogClose>
              <Button onClick={handleSaveQuiz} disabled={saveQuizMutation.isPending}>
                {saveQuizMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Lưu Bài kiểm tra
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}

