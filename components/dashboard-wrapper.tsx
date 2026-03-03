"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { isAuthenticated, clearToken, getToken } from "@/lib/auth";
import { verifyToken } from "@/lib/api";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = getToken();
      const isPublicPage = pathname === "/login";

      setMounted(true);
      
      if (!token) {
        if (!isPublicPage) {
          router.push("/login");
        }
        setLoading(false);
        return;
      }

      // Verify token with backend
      const isValid = await verifyToken(token);
      if (!isValid) {
        clearToken();
        if (!isPublicPage) {
          router.push("/login");
        }
      } else if (isPublicPage) {
        router.push("/dashboard");
      }
      
      setLoading(false);
    }
    
    checkAuth();
  }, [pathname, router]);

  if (!mounted || (loading && pathname !== "/login")) return null;

  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
