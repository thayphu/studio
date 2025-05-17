
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from 'next/navigation';
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
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const loginFormSchema = z.object({
  username: z.string().min(1, { message: "Tên đăng nhập không được để trống." }),
  password: z.string().min(1, { message: "Mật khẩu không được để trống." }),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    // Simulate API call
    // In a real app, replace these with environment variables or a proper auth system
    const adminUsername = process.env.NEXT_PUBLIC_ADMIN_USERNAME || "default_admin";
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "default_password";

    setTimeout(() => {
      if (data.username === adminUsername && data.password === adminPassword) {
        toast({
          title: "Đăng nhập thành công!",
          description: "Chào mừng Đông Phú quay trở lại.",
        });
        router.push('/lop-hoc'); // Redirect to dashboard or main page
      } else {
        toast({
          title: "Đăng nhập thất bại",
          description: "Tên đăng nhập hoặc mật khẩu không đúng.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 1000);
  }

  const handleForgotPassword = () => {
    // For the current simple auth, a full "Forgot Password" is not feasible.
    // This placeholder provides user feedback.
    // For a real application, integrate with Firebase Authentication or a similar service.
    toast({
      title: "Quên mật khẩu?",
      description: "Vui lòng liên hệ quản trị viên để được hỗ trợ đặt lại mật khẩu.",
      duration: 5000,
    });
  };

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
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{TEXTS_VI.usernameLabel}</FormLabel>
                  <FormControl>
                    <Input placeholder="dongphubte" {...field} />
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
                        placeholder="********" 
                        {...field} 
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
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
              {/* Placeholder for "Remember me" if needed in the future */}
              <div></div>
              <Button 
                type="button" 
                variant="link" 
                className="px-0 text-sm text-muted-foreground hover:text-primary"
                onClick={handleForgotPassword}
              >
                Quên mật khẩu?
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
