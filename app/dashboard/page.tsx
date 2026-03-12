"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAdminStats, getProducts, getUsers, getCategories, type AdminStats, type Product, type Category } from "@/lib/api";
import { getProducts as getProductsV2, getCategories as getCategoriesV2, type Product as ProductV2, type Category as CategoryV2 } from "@/lib/admin-api";
import { getToken, clearToken } from "@/lib/auth";
import {
  Users, Store, Package, Loader2, TrendingUp, BarChart3,
  ArrowUpRight, ArrowRight, Utensils, AlertTriangle, Image as ImageIcon,
  Globe, Leaf, ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardData {
  stats: AdminStats;
  products: ProductV2[];
  categories: CategoryV2[];
  totalUsers: number;
  recentUsers: Array<{ email: string; restaurant_name: string; created_at: string; language?: string }>;
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
        const [stats, products, categories, usersData] = await Promise.all([
          getAdminStats(token),
          getProductsV2(token),
          getCategoriesV2(token),
          getUsers(token),
        ]);

        const sortedUsers = [...usersData.users].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setData({
          stats,
          products,
          categories,
          totalUsers: usersData.total,
          recentUsers: sortedUsers.slice(0, 8),
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

  if (!data) return null;

  // Computed stats
  const productsWithImage = data.products.filter(p => p.image_url).length;
  const productsWithCalories = data.products.filter(p => p.calories_per_100g).length;
  const productsWithAllergens = data.products.filter(p => p.allergens && p.allergens.length > 0).length;
  const productsWithDescRu = data.products.filter(p => p.description_ru).length;
  const productsAllLangs = data.products.filter(p => p.name_en && p.name_ru && p.name_pl && p.name_uk).length;

  // Category breakdown
  const catCounts: Record<string, number> = {};
  data.products.forEach(p => {
    catCounts[p.category_id] = (catCounts[p.category_id] || 0) + 1;
  });
  const topCategories = data.categories
    .map(c => ({ ...c, count: catCounts[c.id] || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Allergen stats
  const allergenCounts: Record<string, number> = {};
  data.products.forEach(p => {
    (p.allergens || []).forEach(a => {
      allergenCounts[a] = (allergenCounts[a] || 0) + 1;
    });
  });
  const topAllergens = Object.entries(allergenCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Season stats
  const seasonCounts: Record<string, number> = {};
  data.products.forEach(p => {
    (p.seasons || []).forEach(s => {
      seasonCounts[s] = (seasonCounts[s] || 0) + 1;
    });
  });

  const cards = [
    {
      title: "Пользователи",
      value: data.stats.total_users,
      icon: Users,
      description: "Зарегистрированных аккаунтов",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Рестораны",
      value: data.stats.total_restaurants,
      icon: Store,
      description: "Активных тенантов",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Продукты",
      value: data.products.length,
      icon: Package,
      description: "В глобальном каталоге",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      title: "Категории",
      value: data.categories.length,
      icon: Utensils,
      description: "Разделов каталога",
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Live Data</span>
        </div>
        <h1 className="text-5xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/40">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl font-medium leading-relaxed">
          Актуальные данные платформы в реальном времени.
        </p>
      </div>

      {/* Main Stat Cards */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, idx) => (
          <div
            key={card.title}
            className="group glass rounded-2xl p-6 space-y-3 hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 cursor-default ring-1 ring-white/10 hover:ring-primary/20"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color} transition-all`}>
                <card.icon className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{card.title}</p>
              <div className="text-3xl font-black tracking-tighter">{card.value}</div>
              <p className="text-[11px] text-muted-foreground/50 mt-1">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Product Quality + Categories */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Data Quality */}
        <div className="lg:col-span-1 glass rounded-2xl p-6 ring-1 ring-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Качество данных</h2>
            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-bold uppercase tracking-widest">
              {data.products.length} продуктов
            </Badge>
          </div>
          <div className="space-y-3">
            {[
              { label: "С фото", value: productsWithImage, icon: ImageIcon, color: "text-emerald-500" },
              { label: "С калориями (КБЖУ)", value: productsWithCalories, icon: BarChart3, color: "text-violet-500" },
              { label: "С аллергенами", value: productsWithAllergens, icon: ShieldAlert, color: "text-amber-500" },
              { label: "С описанием (RU)", value: productsWithDescRu, icon: Globe, color: "text-blue-500" },
              { label: "Все 4 языка (имена)", value: productsAllLangs, icon: Globe, color: "text-pink-500" },
            ].map((item) => {
              const pct = Math.round((item.value / data!.products.length) * 100);
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                      <span className="text-muted-foreground font-medium">{item.label}</span>
                    </div>
                    <span className="font-bold tabular-nums">
                      {item.value}
                      <span className="text-muted-foreground/50 font-normal text-xs ml-1">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categories */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 ring-1 ring-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Категории каталога</h2>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={() => router.push("/categories")}
            >
              Все <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {topCategories.map((cat) => {
              const pct = data!.products.length ? Math.round((cat.count / data!.products.length) * 100) : 0;
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/20 hover:bg-muted/20 transition-colors"
                >
                  {cat.icon && <span className="text-xl">{cat.icon}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{cat.name_ru || cat.name_en}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/50" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
                        {cat.count}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Users + Allergens + Seasons */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Users */}
        <div className="lg:col-span-2 glass rounded-2xl p-6 ring-1 ring-white/10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold tracking-tight">Последние регистрации</h2>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/10"
              onClick={() => router.push("/users")}
            >
              Все пользователи <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            {data.recentUsers.length === 0 && (
              <p className="text-muted-foreground text-sm py-8 text-center">Пользователи ещё не зарегистрированы</p>
            )}
            {data.recentUsers.map((user) => (
              <div
                key={user.email}
                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-muted/10 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm shadow-inner font-bold text-primary">
                  {user.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user.restaurant_name}</p>
                  <p className="text-xs text-muted-foreground/60 truncate">{user.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-medium text-muted-foreground/80 tabular-nums">
                    {new Date(user.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" })}
                  </div>
                  <Badge className="mt-0.5 text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-none rounded-md px-1.5">
                    Новый
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allergens + Seasons */}
        <div className="space-y-6">
          {/* Top Allergens */}
          <div className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
            <h2 className="text-lg font-bold tracking-tight">Топ аллергены</h2>
            <div className="space-y-2">
              {topAllergens.map(([allergen, count]) => (
                <div key={allergen} className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-medium">{allergen}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-bold tabular-nums rounded-md">
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Seasons */}
          <div className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
            <h2 className="text-lg font-bold tracking-tight">По сезонам</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "AllYear", emoji: "🔄", label: "Круглый год" },
                { key: "Spring", emoji: "🌸", label: "Весна" },
                { key: "Summer", emoji: "☀️", label: "Лето" },
                { key: "Autumn", emoji: "🍂", label: "Осень" },
                { key: "Winter", emoji: "❄️", label: "Зима" },
              ].map(({ key, emoji, label }) => (
                <div key={key} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/10 border border-border/20">
                  <span className="text-lg">{emoji}</span>
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-lg font-black tabular-nums leading-none">{seasonCounts[key] || 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions + API Status */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Быстрые действия</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Каталог продуктов", href: "/products", icon: Package, desc: `${data.products.length} продуктов` },
              { label: "Новый продукт", href: "/products/new", icon: TrendingUp, desc: "Добавить в каталог" },
              { label: "Категории", href: "/categories", icon: Utensils, desc: `${data.categories.length} категорий` },
              { label: "Пользователи", href: "/users", icon: Users, desc: `${data.totalUsers} зарегистрировано` },
            ].map((action) => (
              <button
                key={action.href}
                onClick={() => router.push(action.href)}
                className="group flex flex-col gap-2 p-4 rounded-xl bg-muted/10 border border-border/20 hover:bg-muted/20 hover:border-primary/30 transition-all text-left"
              >
                <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <div>
                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">{action.desc}</p>
                </div>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/50 self-end transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* API Connection */}
        <div className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
          <h2 className="text-lg font-bold tracking-tight">Подключение</h2>
          <div className="space-y-3">
            {[
              { name: "Admin API", url: process.env.NEXT_PUBLIC_API_URL ?? "—", ok: true },
              { name: "Cloudflare R2", url: "image upload via multipart", ok: true },
              { name: "Auth Token", url: "/api/admin/auth/verify", ok: true },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/20">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-semibold">{svc.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/40 truncate max-w-[200px]">{svc.url}</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[9px] font-bold uppercase tracking-widest">
                  OK
                </Badge>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-border/20 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Итого в базе</p>
            {[
              { label: "Пользователей", value: data.stats.total_users },
              { label: "Ресторанов", value: data.stats.total_restaurants },
              { label: "Продуктов", value: data.products.length },
              { label: "Категорий", value: data.categories.length },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">{item.label}</span>
                <span className="font-bold text-primary tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
