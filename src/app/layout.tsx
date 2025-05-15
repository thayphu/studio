
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a common, readable font
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from '@/components/QueryProvider';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'HoEdu Solution',
  description: 'Hệ thống quản lý giáo dục HoEdu Solution',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.className} antialiased`}>
        <QueryProvider>
          {children}
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
