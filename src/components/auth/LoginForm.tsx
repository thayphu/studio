
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter, type NextRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TEXTS_VI } from '@/lib/constants';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getAuth, signInWithEmailAndPassword, type AuthError } from "firebase/auth";
import { app } from "@/lib/firebase"; // Firebase app instance

const loginFormSchema = z.object({
  email: z.string().email({ message: "Địa chỉ email không hợp lệ." }).min(1, { message: "Email không được để trống." }),
  password: z.string().min(1, { message: "Mật khẩu không được để trống." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginForm() {
  const router = useRouter() as NextRouter;
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const auth = getAuth(app); // Initialize Firebase Auth

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      toast({
        title: "Đăng nhập thành công!",
        description: "Chào mừng quay trở lại.",
      });
      router.push('/lop-hoc');
    } catch (error) {
      const authError = error as AuthError;
      console.error("Firebase Auth Error:", authError.code, authError.message);
      let description = "Tên đăng nhập hoặc mật khẩu không đúng.";
      if (authError.code === "auth/user-not-found" || authError.code === "auth/wrong-password" || authError.code === "auth/invalid-credential") {
        description = "Email hoặc mật khẩu không chính xác. Vui lòng thử lại.";
      } else if (authError.code === "auth/too-many-requests") {
        description = "Quá nhiều lần thử đăng nhập không thành công. Vui lòng thử lại sau.";
      } else if (authError.code === "auth/invalid-email") {
        description = "Địa chỉ email không hợp lệ.";
      }
      toast({
        title: "Đăng nhập thất bại",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">{TEXTS_VI.loginTitle}</CardTitle>
        <CardDescription>Vui lòng nhập thông tin đăng nhập của bạn.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{TEXTS_VI.passwordLabel}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <div></div> {/* Empty div for spacing if needed, or remove if not needed */}
              <Button
                type="button"
                variant="link"
                className="px-0 text-sm text-muted-foreground hover:text-primary"
                asChild
              >
                <Link href="/forgot-password">Quên mật khẩu?</Link>
              </Button>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading ? "Đang xử lý..." : TEXTS_VI.loginButton}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
