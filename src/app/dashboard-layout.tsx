
"use client";

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings } from 'lucide-react';
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
import React, { useEffect, useCallback, useMemo } from 'react'; 
import { useToast } from "@/hooks/use-toast"; // Added useToast import

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast(); // Initialized useToast

  useEffect(() => {
    console.log("DashboardLayout mounted or updated - " + new Date().toLocaleTimeString()); 
  }, []); 


  const handleLogout = useCallback(() => {
    router.push('/login');
  }, [router]);

  const handleParentPortalClick = useCallback(() => {
    window.open(PARENT_PORTAL_LINK.href, '_blank');
  }, []);

  const handleAccountSettingsClick = () => {
    toast({
      title: "Thông báo",
      description: "Chức năng Cài đặt tài khoản đang được phát triển.",
    });
  };
  
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen bg-background">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="p-4 flex items-center justify-between">
            <Link href="/lop-hoc" className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
              </svg>
              <h1 className="text-xl font-semibold text-primary">
                {TEXTS_VI.appName}
              </h1>
            </Link>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {NAV_LINKS.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(link.href)}
                    className={cn(
                      pathname.startsWith(link.href) ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    tooltip={link.label} 
                  >
                    <Link href={link.href}>
                      <link.icon className="h-5 w-5" />
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                  <a> {/* Use <a> for onClick to work properly with window.open */}
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
                    <AvatarFallback>DP</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Đông Phú</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleAccountSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Cài đặt tài khoản</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
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
    </SidebarProvider>
  );
}
