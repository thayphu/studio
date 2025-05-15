
import LoginForm from '@/components/auth/LoginForm';
import { TEXTS_VI } from '@/lib/constants';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-primary mx-auto mb-4">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
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
