
"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
// Quill.js will be loaded from CDN, so no direct import of ReactQuill here.
// Ensure 'quill/dist/quill.snow.css' is imported if you use a local Quill instance,
// but for CDN, it's linked in layout.tsx.

import DashboardLayout from '../dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ListChecks, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  GradeLevel, CurriculumType, TestBankType, QuestionType, OptionLabel, QuestionBankEntry
} from '@/lib/types';
import {
  ALL_GRADE_LEVELS, ALL_CURRICULUM_TYPES, ALL_TEST_BANK_TYPES, ALL_QUESTION_TYPES, ALL_OPTION_LABELS
} from '@/lib/types';
import { nanoid } from 'nanoid';
import { Textarea } from '@/components/ui/textarea';

interface NewMultipleChoiceFormState {
  text: string; // This will store HTML content from Quill
  options: Record<OptionLabel, string>;
  correctOptionLabel: OptionLabel | '';
}
const initialNewMultipleChoiceState: NewMultipleChoiceFormState = {
  text: '',
  options: { A: '', B: '', C: '', D: '' },
  correctOptionLabel: '',
};

interface TrueFalseFormState {
  text: string;
  correctAnswer: boolean | null;
}
const initialTrueFalseState: TrueFalseFormState = {
  text: '',
  correctAnswer: null,
};

interface EssayFormState {
  text: string;
  modelAnswer: string;
}
const initialEssayState: EssayFormState = {
  text: '',
  modelAnswer: '',
};

export default function QuestionBankPage() {
  const { toast } = useToast();
  const quillInstanceRef = useRef<any>(null); // Ref for Quill.js instance
  const editorRef = useRef<HTMLDivElement>(null); // Ref for the editor div

  const [selectedGradeLevel, setSelectedGradeLevel] = useState<GradeLevel | ''>('');
  const [selectedCurriculumType, setSelectedCurriculumType] = useState<CurriculumType | ''>('');
  const [selectedTestBankType, setSelectedTestBankType] = useState<TestBankType | ''>('');
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType | ''>('');

  const [multipleChoiceData, setMultipleChoiceData] = useState<NewMultipleChoiceFormState>(initialNewMultipleChoiceState);
  const [trueFalseData, setTrueFalseData] = useState<TrueFalseFormState>(initialTrueFalseState);
  const [essayData, setEssayData] = useState<EssayFormState>(initialEssayState);

  const handleOptionInputChange = useCallback((label: OptionLabel, value: string) => {
    setMultipleChoiceData(prev => ({
      ...prev,
      options: { ...prev.options, [label]: value }
    }));
  }, []);

  const handleCorrectOptionChange = useCallback((label: OptionLabel) => {
    setMultipleChoiceData(prev => ({ ...prev, correctOptionLabel: label }));
  }, []);

  const resetQuestionForms = useCallback(() => {
    setMultipleChoiceData(initialNewMultipleChoiceState);
    if (quillInstanceRef.current) {
      quillInstanceRef.current.setText(''); // Clear Quill editor content
    }
    setTrueFalseData(initialTrueFalseState);
    setEssayData(initialEssayState);
  }, []);

  // Initialize Quill Editor
  useEffect(() => {
    if (selectedQuestionType === "Nhiều lựa chọn" && editorRef.current && typeof window !== 'undefined' && (window as any).Quill) {
      if (!quillInstanceRef.current) { // Initialize only once
        const quill = new (window as any).Quill(editorRef.current, {
          theme: 'snow',
          modules: {
            toolbar: [
              [{ 'header': [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{'list': 'ordered'}, {'list': 'bullet'}],
              ['link'],
              ['clean']
            ],
          },
          formats: [
            'header',
            'bold', 'italic', 'underline', 'strike',
            'list', 'bullet',
            'link',
          ],
          placeholder: 'Nhập nội dung câu hỏi ở đây...',
        });

        quill.on('text-change', () => {
          setMultipleChoiceData(prev => ({ ...prev, text: quill.root.innerHTML }));
        });
        
        // Set initial content if any
        if (multipleChoiceData.text) {
            const delta = quill.clipboard.convert(multipleChoiceData.text);
            quill.setContents(delta, 'silent');
        } else {
            quill.setText('');
        }


        quillInstanceRef.current = quill;
      }
    } else if (quillInstanceRef.current && selectedQuestionType !== "Nhiều lựa chọn") {
      // Clean up Quill instance if question type changes or component unmounts
      // A more robust cleanup might be needed for complex scenarios
      quillInstanceRef.current = null; 
      if(editorRef.current) editorRef.current.innerHTML = ''; // Clear the div
    }

    // Basic cleanup for when the component unmounts
    return () => {
        // This cleanup might not be perfect for Quill, as it's initialized outside React's direct control.
        // For a production app, more sophisticated cleanup or a React-specific Quill wrapper might be better.
        quillInstanceRef.current = null;
    };
  }, [selectedQuestionType, multipleChoiceData.text]); // Rerun if question type changes or to set initial text

  const handleSaveQuestion = () => {
    if (!selectedGradeLevel || !selectedCurriculumType || !selectedTestBankType || !selectedQuestionType) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng chọn đầy đủ Khối lớp, Chương trình học, Ngân hàng kiểm tra và Dạng câu hỏi.", variant: "destructive" });
      return;
    }

    let questionEntry: Omit<QuestionBankEntry, 'id' | 'createdAt' | 'updatedAt'> | null = null;
    let questionTextContent = '';

    if (selectedQuestionType === "Nhiều lựa chọn") {
      if (quillInstanceRef.current) {
        questionTextContent = quillInstanceRef.current.root.innerHTML;
        const plainText = quillInstanceRef.current.getText().trim();
        if (!plainText) {
            toast({ title: "Lỗi", description: "Nội dung câu hỏi trắc nghiệm không được để trống.", variant: "destructive" });
            return;
        }
      } else if (multipleChoiceData.text) { // Fallback if Quill not ready
        questionTextContent = multipleChoiceData.text;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = questionTextContent;
        if (!tempDiv.textContent?.trim()){
            toast({ title: "Lỗi", description: "Nội dung câu hỏi trắc nghiệm không được để trống.", variant: "destructive" });
            return;
        }
      } else {
        toast({ title: "Lỗi", description: "Nội dung câu hỏi trắc nghiệm không được để trống.", variant: "destructive" });
        return;
      }


      if (ALL_OPTION_LABELS.some(label => !multipleChoiceData.options[label].trim())) {
        toast({ title: "Lỗi", description: "Vui lòng nhập nội dung cho tất cả các lựa chọn A, B, C, D.", variant: "destructive" });
        return;
      }
      if (!multipleChoiceData.correctOptionLabel) {
        toast({ title: "Lỗi", description: "Vui lòng chọn đáp án đúng cho câu hỏi trắc nghiệm.", variant: "destructive" });
        return;
      }
      questionEntry = {
        gradeLevel: selectedGradeLevel as GradeLevel,
        curriculumType: selectedCurriculumType as CurriculumType,
        testBankType: selectedTestBankType as TestBankType,
        questionType: "Nhiều lựa chọn",
        text: questionTextContent, // Save HTML content from Quill
        options: ALL_OPTION_LABELS.map(label => ({
          id: label,
          text: multipleChoiceData.options[label].trim(),
        })),
        correctOptionId: multipleChoiceData.correctOptionLabel,
      };
    } else if (selectedQuestionType === "True/False") {
      if (!trueFalseData.text.trim()) {
        toast({ title: "Lỗi", description: "Nội dung câu hỏi Đúng/Sai không được để trống.", variant: "destructive" });
        return;
      }
      if (trueFalseData.correctAnswer === null) {
        toast({ title: "Lỗi", description: "Vui lòng chọn đáp án đúng (Đúng hoặc Sai).", variant: "destructive" });
        return;
      }
      questionEntry = {
        gradeLevel: selectedGradeLevel as GradeLevel,
        curriculumType: selectedCurriculumType as CurriculumType,
        testBankType: selectedTestBankType as TestBankType,
        questionType: "True/False",
        text: trueFalseData.text.trim(),
        correctBooleanAnswer: trueFalseData.correctAnswer,
      };
    } else if (selectedQuestionType === "Tự luận") {
      if (!essayData.text.trim()) {
        toast({ title: "Lỗi", description: "Nội dung câu hỏi tự luận không được để trống.", variant: "destructive" });
        return;
      }
      questionEntry = {
        gradeLevel: selectedGradeLevel as GradeLevel,
        curriculumType: selectedCurriculumType as CurriculumType,
        testBankType: selectedTestBankType as TestBankType,
        questionType: "Tự luận",
        text: essayData.text.trim(),
        modelAnswer: essayData.modelAnswer.trim(),
      };
    }

    if (questionEntry) {
      const fullQuestionData: QuestionBankEntry = {
        ...questionEntry,
        id: nanoid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as QuestionBankEntry;

      console.log("Saving Question:", JSON.stringify(fullQuestionData, null, 2));
      toast({ title: "Đã Lưu (Console)", description: "Câu hỏi đã được log ra console. Chức năng lưu vào DB sẽ được triển khai sau." });
      resetQuestionForms();
    } else {
      toast({ title: "Lỗi", description: "Không thể xác định dạng câu hỏi để lưu.", variant: "destructive" });
    }
  };

  const renderQuestionForm = () => {
    if (!selectedQuestionType) {
      return <p className="text-muted-foreground text-center py-4">Vui lòng chọn dạng câu hỏi để hiển thị form nhập liệu.</p>;
    }

    switch (selectedQuestionType) {
      case "Nhiều lựa chọn":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="mc-question-editor-label">Nội dung câu hỏi</Label>
              {/* Div for Quill editor to attach to */}
              <div id="mc-question-editor" ref={editorRef} className="bg-card border rounded-md min-h-[150px]">
                {/* Quill will populate this div */}
              </div>
            </div>
            {ALL_OPTION_LABELS.map(label => (
              <div key={label}>
                <Label htmlFor={`mc-option-${label}`}>Lựa chọn {label}</Label>
                <Input
                  id={`mc-option-${label}`}
                  value={multipleChoiceData.options[label]}
                  onChange={(e) => handleOptionInputChange(label, e.target.value)}
                  placeholder={`Nội dung lựa chọn ${label}`}
                />
              </div>
            ))}
            <div>
              <Label>Đáp án đúng</Label>
              <RadioGroup
                value={multipleChoiceData.correctOptionLabel}
                onValueChange={(val) => handleCorrectOptionChange(val as OptionLabel)}
                className="flex space-x-4"
              >
                {ALL_OPTION_LABELS.map(label => (
                  <div key={`radio-${label}`} className="flex items-center space-x-2">
                    <RadioGroupItem value={label} id={`mc-correct-${label}`} />
                    <Label htmlFor={`mc-correct-${label}`}>{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        );
      case "True/False":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="tf-question-text">Nội dung câu hỏi/mệnh đề</Label>
              <Textarea id="tf-question-text" value={trueFalseData.text} onChange={(e) => setTrueFalseData(prev => ({ ...prev, text: e.target.value }))} placeholder="Nhập nội dung câu hỏi hoặc mệnh đề..." />
            </div>
            <div>
              <Label>Đáp án đúng</Label>
              <RadioGroup
                value={trueFalseData.correctAnswer === null ? "" : String(trueFalseData.correctAnswer)}
                onValueChange={(val) => setTrueFalseData(prev => ({ ...prev, correctAnswer: val === "true" }))}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="tf-correct-true" />
                  <Label htmlFor="tf-correct-true">Đúng (True)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="tf-correct-false" />
                  <Label htmlFor="tf-correct-false">Sai (False)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        );
      case "Tự luận":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="essay-question-text">Nội dung câu hỏi tự luận</Label>
              <Textarea id="essay-question-text" value={essayData.text} onChange={(e) => setEssayData(prev => ({ ...prev, text: e.target.value }))} placeholder="Nhập nội dung câu hỏi tự luận..." rows={5} />
            </div>
            <div>
              <Label htmlFor="essay-model-answer">Đáp án mẫu/Gợi ý chấm (tùy chọn)</Label>
              <Textarea id="essay-model-answer" value={essayData.modelAnswer} onChange={(e) => setEssayData(prev => ({ ...prev, modelAnswer: e.target.value }))} placeholder="Nhập đáp án mẫu hoặc gợi ý chấm điểm..." rows={5}/>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <ListChecks className="mr-3 h-8 w-8 text-primary" /> Thêm Câu Hỏi vào Ngân Hàng
          </h1>
        </div>

        <Card className="mb-6 shadow-md">
          <CardHeader>
            <CardTitle>Bước 1: Chọn Thông Tin Phân Loại</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="grade-level-select">Khối lớp</Label>
              <Select value={selectedGradeLevel} onValueChange={(val) => setSelectedGradeLevel(val as GradeLevel)}>
                <SelectTrigger id="grade-level-select"><SelectValue placeholder="Chọn khối lớp" /></SelectTrigger>
                <SelectContent>
                  {ALL_GRADE_LEVELS.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="curriculum-type-select">Chương trình học</Label>
              <Select value={selectedCurriculumType} onValueChange={(val) => setSelectedCurriculumType(val as CurriculumType)}>
                <SelectTrigger id="curriculum-type-select"><SelectValue placeholder="Chọn chương trình học" /></SelectTrigger>
                <SelectContent>
                  {ALL_CURRICULUM_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="test-bank-select">Ngân hàng kiểm tra</Label>
              <Select value={selectedTestBankType} onValueChange={(val) => setSelectedTestBankType(val as TestBankType)}>
                <SelectTrigger id="test-bank-select"><SelectValue placeholder="Chọn ngân hàng KT" /></SelectTrigger>
                <SelectContent>
                  {ALL_TEST_BANK_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="question-type-select">Dạng câu hỏi</Label>
              <Select value={selectedQuestionType} onValueChange={(val) => { setSelectedQuestionType(val as QuestionType); resetQuestionForms(); }}>
                <SelectTrigger id="question-type-select"><SelectValue placeholder="Chọn dạng câu hỏi" /></SelectTrigger>
                <SelectContent>
                  {ALL_QUESTION_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedGradeLevel && selectedCurriculumType && selectedTestBankType && selectedQuestionType && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Bước 2: Nhập Nội Dung Câu Hỏi ({selectedQuestionType})</CardTitle>
              <CardDescription>
                Đang thêm câu hỏi cho: {selectedGradeLevel} - {selectedCurriculumType} - {selectedTestBankType}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderQuestionForm()}
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveQuestion}>
                <Save className="mr-2 h-4 w-4" /> Lưu Câu Hỏi Này
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
