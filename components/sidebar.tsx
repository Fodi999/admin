"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Package, 
  Tags,
  Users, 
  Settings,
  ChefHat,
  FileText,
  Menu,
  X 
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Catalog",
    icon: Package,
    href: "/products",
  },
  {
    label: "О шефе",
    icon: ChefHat,
    href: "/about",
  },
  {
    label: "Статьи",
    icon: FileText,
    href: "/articles",
  },
  {
    label: "Categories",
    icon: Tags,
    href: "/categories",
  },
  {
    label: "Users",
    icon: Users,
    href: "/users",
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className={cn(
      "relative flex flex-col h-full bg-sidebar/80 backdrop-blur-xl border-r border-sidebar-border transition-all duration-500 ease-in-out",
      isOpen ? "w-72" : "w-24"
    )}>
      <div className="px-4 py-6 flex-1 space-y-8">
        <div className="flex items-center justify-between px-2">
          {isOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center glow">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
                Nexus Admin
              </h1>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "hover:bg-sidebar-accent transition-colors",
              !isOpen && "mx-auto"
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        
        <nav className="space-y-1.5 pt-4">
          {routes.map((route) => {
            const isActive = pathname === route.href;
            return (
              <Link
                key={route.label}
                href={route.href}
                className={cn(
                  "group flex items-center px-3 py-2.5 text-sm font-medium rounded-2xl transition-all duration-300 relative overflow-hidden",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                  !isOpen && "justify-center px-0 mx-auto w-12"
                )}
              >
                <route.icon className={cn(
                  "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                  isOpen && "mr-3",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
                )} />
                {isOpen && (
                  <span className="relative z-10 transition-opacity duration-300">
                    {route.label}
                  </span>
                )}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/20">
        <div className={cn(
          "flex items-center gap-3",
          !isOpen && "justify-center"
        )}>
           <ModeToggle />
           {isOpen && (
             <div className="flex flex-col">
               <span className="text-xs font-semibold">Premium Plan</span>
               <span className="text-[10px] text-muted-foreground">Pro Support</span>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
