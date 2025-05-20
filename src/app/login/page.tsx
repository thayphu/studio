
import LoginForm from '@/components/auth/LoginForm';
import { TEXTS_VI } from '@/lib/constants';
import Image from 'next/image'; // Import next/image

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="HoEdu Solution Logo" width={64} height={64} className="mx-auto mb-4" data-ai-hint="app logo education" />
          <h1 className="text-4xl font-bold text-primary">{TEXTS_VI.appName}</h1>
          <p className="text-muted-foreground mt-2">{TEXTS_VI.loginTitle}</p>
        </div>
        <LoginForm />
         <p className="mt-8 text-center text-sm text-muted-foreground">
          Chỉ dành cho quản trị viên. Không có chức năng đăng ký.
        </p>
      </div>
    </div>
  );
}
