
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Import next/image
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { NAV_LINKS, PARENT_PORTAL_LINK, TEXTS_VI } from '@/lib/constants';
import { cn } from '@/lib/utils';
import React, { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getAuth, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { app } from "@/lib/firebase";
import ChangePasswordDialog from '@/components/auth/ChangePasswordDialog';

interface DashboardLayoutProps {
  children: ReactNode;
}

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async (isAutoLogout: boolean = false) => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      toast({
        title: isAutoLogout ? "Đã tự động đăng xuất" : "Đã đăng xuất",
        description: isAutoLogout ? "Bạn đã không hoạt động trong một khoảng thời gian." : "Bạn đã đăng xuất thành công.",
      });
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({
        title: "Lỗi đăng xuất",
        description: "Đã có lỗi xảy ra khi đăng xuất. Vui lòng thử lại.",
        variant: "destructive",
      });
      router.push('/login'); // Fallback redirect
    } finally {
      setIsLoggingOut(false);
    }
  }, [auth, router, toast]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (currentUser) { // Only set timer if user is logged in
      inactivityTimerRef.current = setTimeout(() => {
        toast({
          title: "Phiên sắp hết hạn",
          description: "Bạn sẽ tự động đăng xuất sau một phút nữa nếu không có hoạt động.",
          variant: "default",
          duration: 60000, // Show for 1 minute
        });
        // Set another shorter timer for actual logout
        setTimeout(() => {
          if (auth.currentUser) { // Check again if user is still logged in
             handleLogout(true);
          }
        }, 60000); // 1 minute warning
      }, INACTIVITY_TIMEOUT_MS - 60000); // Trigger warning 1 min before actual timeout
    }
  }, [currentUser, handleLogout, toast, auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        resetInactivityTimer();
      } else if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    });
    return () => unsubscribe();
  }, [auth, resetInactivityTimer]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentUser) {
      const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
      activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer));

      resetInactivityTimer(); // Initial timer start

      return () => {
        activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      };
    }
  }, [resetInactivityTimer, currentUser]);


  useEffect(() => {
    console.log("DashboardLayout mounted or updated - " + new Date().toLocaleTimeString());
  }, []);

  const handleParentPortalClick = useCallback(() => {
    window.open(PARENT_PORTAL_LINK.href, '_blank');
  }, []);

  const handleAccountSettingsClick = () => {
    setIsChangePasswordDialogOpen(true);
  };
  
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex items-center justify-between">
            <Link href="/lop-hoc" className="flex items-center gap-2">
              <Image src="/logo.png" alt="HoEdu Solution Logo" width={32} height={32} style={{ height: 'auto' }} data-ai-hint="app logo" />
              <h1 className="text-xl font-semibold text-primary">
                {TEXTS_VI.appName}
              </h1>
            </Link>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {NAV_LINKS.map((link) => {
                const tooltipContent = link.label;
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(link.href)}
                      className={cn(
                        pathname.startsWith(link.href) ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      tooltip={tooltipContent} 
                    >
                      <Link href={link.href}>
                        <link.icon className="h-5 w-5" />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-2 mt-auto border-t">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={PARENT_PORTAL_LINK.label}
                  className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={handleParentPortalClick}
                >
                  <a> 
                    <PARENT_PORTAL_LINK.icon className="h-5 w-5" />
                    <span>{PARENT_PORTAL_LINK.label}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-6">
            <div className="flex items-center">
              <SidebarTrigger className="md:hidden mr-2" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="https://placehold.co/100x100.png" alt="Admin Avatar" data-ai-hint="avatar user" />
                    <AvatarFallback>{currentUser?.email?.substring(0,2)?.toUpperCase() || "AD"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{currentUser?.displayName || currentUser?.email || "Admin"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAccountSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Cài đặt tài khoản</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleLogout(false)} disabled={isLoggingOut}>
                  {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                  <span>{TEXTS_VI.logoutButton}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <SidebarInset>
              {children}
            </SidebarInset>
          </main>
        </div>
      </div>
      <ChangePasswordDialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen} />
    </SidebarProvider>
  );
}
