
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
// import { getAuth, sendPasswordResetEmail } from "firebase/auth"; // To be used later
// import { app } from "@/lib/firebase"; // To be used later

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

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

    // ---- PHẦN TÍCH HỢP FIREBASE SẼ Ở ĐÂY ----
    // const auth = getAuth(app);
    // try {
    //   await sendPasswordResetEmail(auth, email);
    //   setMessage("Một email đặt lại mật khẩu đã được gửi đến địa chỉ của bạn (nếu tài khoản tồn tại). Vui lòng kiểm tra hộp thư đến.");
    //   toast({
    //     title: "Thành công",
    //     description: "Yêu cầu đặt lại mật khẩu đã được gửi.",
    //   });
    // } catch (error: any) {
    //   console.error("Error sending password reset email:", error);
    //   let errorMessage = "Đã có lỗi xảy ra. Vui lòng thử lại.";
    //   if (error.code === "auth/user-not-found") {
    //     errorMessage = "Không tìm thấy người dùng với địa chỉ email này.";
    //   } else if (error.code === "auth/invalid-email") {
    //     errorMessage = "Địa chỉ email không hợp lệ.";
    //   }
    //   setMessage(errorMessage);
    //   toast({
    //     title: "Lỗi",
    //     description: errorMessage,
    //     variant: "destructive",
    //   });
    // }
    // -----------------------------------------

    // Placeholder logic for now:
    setTimeout(() => {
      setMessage(
        `Tính năng gửi email đặt lại mật khẩu cho ${email} đang được phát triển. Vui lòng liên hệ quản trị viên.`
      );
      toast({
        title: "Tính năng đang phát triển",
        description: `Yêu cầu đặt lại mật khẩu cho ${email} đã được ghi nhận.`,
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Quên Mật khẩu</CardTitle>
            <CardDescription>
              Nhập địa chỉ email của bạn để nhận liên kết đặt lại mật khẩu.
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
                />
              </div>
              {message && <p className="text-sm text-center text-muted-foreground">{message}</p>}
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
