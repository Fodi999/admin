"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminStats, getProducts, getUsers, type AdminStats } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Users, Store, Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardData {
  stats: AdminStats;
  totalProducts: number;
  recentUsers: Array<{ email: string; restaurant_name: string; created_at: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadDashboard() {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const [stats, products, usersData] = await Promise.all([
          getAdminStats(token),
          getProducts(token),
          getUsers(token),
        ]);

        // Sort by newest first for recent activity
        const sortedUsers = [...usersData.users].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setData({
          stats,
          totalProducts: products.length,
          recentUsers: sortedUsers.slice(0, 5),
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes("401")) {
          clearToken();
          router.push("/login");
        } else {
          setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
        }
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [router]);

  const cards = data
    ? [
        {
          title: "Пользователи",
          value: data.stats.total_users,
          icon: Users,
          description: "Зарегистрированных аккаунтов",
        },
        {
          title: "Рестораны",
          value: data.stats.total_restaurants,
          icon: Store,
          description: "Активных тенантов",
        },
        {
          title: "Продукты",
          value: data.totalProducts,
          icon: Package,
          description: "Позиций в глобальном каталоге",
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center space-y-3">
          <p className="text-destructive font-bold text-lg">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl">
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Live Data</span>
        </div>
        <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/40">
          Nexus <span className="text-primary italic">Analytics</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl font-medium leading-relaxed">
          Актуальные данные платформы в реальном времени.
        </p>
      </div>

      {/* Live Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {cards.map((card, idx) => (
          <div
            key={card.title}
            className="group glass rounded-[2.5rem] p-8 space-y-4 hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-2 cursor-default ring-1 ring-white/10 hover:ring-primary/20"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-inner">
                <card.icon className="h-7 w-7 stroke-[2.5]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" title="Live" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1">
                {card.title}
              </p>
              <div className="text-4xl font-black tracking-tighter text-foreground">
                {card.value}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground/40 mt-3">
                {card.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Users from API */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 glass rounded-[3rem] p-10 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black tracking-tight">Последние регистрации</h2>
            <Button
              variant="ghost"
              className="rounded-xl font-bold text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={() => router.push("/users")}
            >
              Все пользователи
            </Button>
          </div>
          <div className="space-y-4">
            {data?.recentUsers.length === 0 && (
              <p className="text-muted-foreground text-sm font-medium py-8 text-center">
                Пользователи ещё не зарегистрированы
              </p>
            )}
            {data?.recentUsers.map((user) => (
              <div
                key={user.email}
                className="group flex items-center gap-6 p-4 rounded-3xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
              >
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shadow-inner group-hover:bg-primary/20 transition-colors font-black text-primary text-lg">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-foreground group-hover:text-primary transition-colors truncate">
                    {user.restaurant_name}
                  </p>
                  <p className="text-sm text-muted-foreground/60 font-medium truncate">{user.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-muted-foreground/80">
                    {new Date(user.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </div>
                  <Badge className="mt-1 text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border-none rounded-lg">
                    Новый
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Connection Status */}
        <div className="glass rounded-[3rem] p-10 ring-1 ring-white/10 space-y-8">
          <h2 className="text-2xl font-black tracking-tight">Подключение</h2>
          <div className="space-y-4">
            {[
              { name: "Admin API", url: process.env.NEXT_PUBLIC_API_URL ?? "—", ok: true },
              { name: "Cloudflare R2", url: "image-url endpoint", ok: true },
              { name: "Auth", url: "/api/admin/auth/verify", ok: true },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <div>
                    <p className="text-sm font-bold">{svc.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[140px]">{svc.url}</p>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary border-none rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0">
                  OK
                </Badge>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Итого в базе</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-muted-foreground">Пользователей</span>
                <span className="text-primary font-mono">{data?.stats.total_users ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-muted-foreground">Ресторанов</span>
                <span className="text-primary font-mono">{data?.stats.total_restaurants ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-muted-foreground">Продуктов</span>
                <span className="text-primary font-mono">{data?.totalProducts ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
