
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getAuth, sendPasswordResetEmail, type AuthError } from "firebase/auth";
import { app } from "@/lib/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const auth = getAuth(app);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    if (!email) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập địa chỉ email của bạn.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      const successMessage = "Một email đặt lại mật khẩu đã được gửi đến địa chỉ của bạn (nếu tài khoản tồn tại). Vui lòng kiểm tra hộp thư đến, bao gồm cả thư mục spam.";
      setMessage(successMessage);
      toast({
        title: "Yêu cầu đã được gửi",
        description: successMessage,
      });
      setEmail(""); 
    } catch (error) {
      const authError = error as AuthError;
      console.error("Error sending password reset email:", authError.code, authError.message);
      let userFriendlyMessage = "Đã có lỗi xảy ra khi gửi email đặt lại mật khẩu. Vui lòng thử lại.";

      if (authError.code === "auth/user-not-found") {
        // To prevent email enumeration, show a generic message for user-not-found
        userFriendlyMessage = "Nếu địa chỉ email của bạn tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư đến.";
         setMessage(userFriendlyMessage);
         toast({
            title: "Yêu cầu đã được xử lý",
            description: userFriendlyMessage,
        });
      } else if (authError.code === "auth/invalid-email") {
        userFriendlyMessage = "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.";
         setMessage(userFriendlyMessage);
         toast({
            title: "Lỗi",
            description: userFriendlyMessage,
            variant: "destructive",
        });
      } else {
        setMessage(userFriendlyMessage);
        toast({
            title: "Lỗi",
            description: userFriendlyMessage,
            variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Quên Mật khẩu</CardTitle>
            <CardDescription>
              Nhập địa chỉ email đã đăng ký của bạn để nhận liên kết đặt lại mật khẩu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email">Địa chỉ Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nhapemail@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                  disabled={isLoading}
                />
              </div>
              {message && <p className="text-sm text-center text-muted-foreground p-3 bg-muted/50 rounded-md">{message}</p>}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                {isLoading ? "Đang xử lý..." : "Gửi liên kết đặt lại"}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Button variant="link" asChild>
                <Link href="/login">Quay lại Đăng nhập</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
