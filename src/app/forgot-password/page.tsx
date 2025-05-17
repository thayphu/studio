
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { app } from "@/lib/firebase"; // Ensure Firebase app is initialized and exported

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(""); // To display success/error messages within the card
  const { toast } = useToast();
  const auth = getAuth(app); // Initialize Firebase Auth

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(""); // Clear previous messages

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
      setMessage("Một email đặt lại mật khẩu đã được gửi đến địa chỉ của bạn (nếu tài khoản tồn tại). Vui lòng kiểm tra hộp thư đến, bao gồm cả thư mục spam.");
      toast({
        title: "Thành công",
        description: "Yêu cầu đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email.",
      });
      setEmail(""); // Clear email field on success
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      let errorMessage = "Đã có lỗi xảy ra khi gửi email đặt lại mật khẩu. Vui lòng thử lại.";
      if (error.code === "auth/user-not-found") {
        // To avoid disclosing whether an email is registered, you might want to show a generic message for both user-not-found and success.
        // However, for development/admin purposes, a specific message can be helpful.
        // For now, we will stick to a generic success message to prevent user enumeration.
        setMessage("Nếu địa chỉ email của bạn tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư đến.");
        toast({
            title: "Yêu cầu đã được xử lý",
            description: "Nếu email của bạn được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
        });
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.";
        setMessage(errorMessage);
        toast({
            title: "Lỗi",
            description: errorMessage,
            variant: "destructive",
        });
      } else {
        // For other errors, show a generic message to the user
        setMessage(errorMessage);
        toast({
            title: "Lỗi",
            description: errorMessage,
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
