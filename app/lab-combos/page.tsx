"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getLabCombos,
  generatePopularCombos,
  publishCombo,
  archiveCombo,
  deleteCombo,
  backfillStructuredIngredients,
  type LabComboPage,
} from "@/lib/lab-combos-api";

import {
  FlaskConical,
  Search,
  Globe,
  Loader2,
  Trash2,
  ArrowUpCircle,
  Archive,
  Eye,
  ExternalLink,
  Rocket,
  Plus,
  RefreshCw,
  Filter,
  Sparkles,
  ChevronDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const LOCALES = ["en", "ru", "pl", "uk"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const BLOG_BASE = "https://dima-fomin.pl";

// ── Page ─────────────────────────────────────────────────────────────

export default function LabCombosPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [combos, setCombos] = useState<LabComboPage[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocale, setFilterLocale] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Popular combos generation
  const [generatingPopular, setGeneratingPopular] = useState(false);
  const [popularLocale, setPopularLocale] = useState("en");
  const [backfilling, setBackfilling] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Auth ───────────────────────────────────────────────────────────

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
  }, [router]);

  // ── Load data ─────────────────────────────────────────────────────

  const loadCombos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getLabCombos(token, {
        status: filterStatus === "all" ? undefined : filterStatus,
        locale: filterLocale === "all" ? undefined : filterLocale,
        limit: 100,
      });
      setCombos(data);
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus, filterLocale]);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  // ── Filtered list ─────────────────────────────────────────────────

  const filtered = combos.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.slug.includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.ingredients.some((i) => i.includes(q))
      );
    }
    return true;
  });

  // ── Stats ─────────────────────────────────────────────────────────

  const stats = {
    total: combos.length,
    draft: combos.filter((c) => c.status === "draft").length,
    published: combos.filter((c) => c.status === "published").length,
    archived: combos.filter((c) => c.status === "archived").length,
    avgScore: combos.length > 0
      ? (combos.reduce((s, c) => s + c.quality_score, 0) / combos.length).toFixed(1)
      : "0",
  };

  // ── Actions ───────────────────────────────────────────────────────

  const doAction = async (id: string, action: () => Promise<unknown>, label: string) => {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await action();
      toast.success(label);
      await loadCombos();
    } catch (err: unknown) {
      toast.error(`Ошибка: ${label}`, { description: String(err) });
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── Generate popular ──────────────────────────────────────────────

  const handleGeneratePopular = async () => {
    if (!token) return;
    setGeneratingPopular(true);
    try {
      const result = await generatePopularCombos(token, { locale: "en", limit: 14 });
      toast.success(`Сгенерировано: ${result.generated} combo (×4 языка)`, {
        description: result.details.slice(0, 5).join("\n"),
      });
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка генерации популярных", { description: String(err) });
    } finally {
      setGeneratingPopular(false);
    }
  };

  // ── Backfill structured ingredients ───────────────────────────────

  const handleBackfill = async () => {
    if (!token) return;
    setBackfilling(true);
    try {
      const result = await backfillStructuredIngredients(token);
      toast.success(`Backfill: обновлено ${result.updated} записей`, {
        description: result.message,
      });
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка backfill", { description: String(err) });
    } finally {
      setBackfilling(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <FlaskConical className="h-7 w-7 text-primary" />
            SEO-страницы Lab Combo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Готовые SEO-страницы комбинаций ингредиентов — чистые URL для Google
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCombos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          <Button size="sm" asChild>
            <Link href="/lab-combos/new">
              <Plus className="h-4 w-4 mr-1" />
              Создать Combo
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card
          className="bg-card/50 backdrop-blur cursor-pointer hover:ring-2 ring-primary/30 transition-all"
          onClick={() => setFilterStatus("all")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Всего</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-yellow-500/5 border-yellow-500/20 cursor-pointer hover:ring-2 ring-yellow-500/30 transition-all ${filterStatus === "draft" ? "ring-2" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "draft" ? "all" : "draft")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-yellow-600">{stats.draft}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Черновик</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-emerald-500/5 border-emerald-500/20 cursor-pointer hover:ring-2 ring-emerald-500/30 transition-all ${filterStatus === "published" ? "ring-2" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "published" ? "all" : "published")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-emerald-600">{stats.published}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Опубликовано</p>
          </CardContent>
        </Card>
        <Card
          className={`bg-zinc-500/5 border-zinc-500/20 cursor-pointer hover:ring-2 ring-zinc-500/30 transition-all ${filterStatus === "archived" ? "ring-2" : ""}`}
          onClick={() => setFilterStatus(filterStatus === "archived" ? "all" : "archived")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-zinc-500">{stats.archived}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">В архиве</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">{stats.avgScore}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ср. балл</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Rocket className="h-4 w-4" /> Быстро:
            </span>
            <Badge variant="outline" className="text-xs">EN • PL • RU • UK</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGeneratePopular}
              disabled={generatingPopular}
            >
              {generatingPopular ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Создать 14 популярных Combo (×4 языка)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackfill}
              disabled={backfilling}
            >
              {backfilling ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Backfill ингредиенты
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по slug, названию, ингредиенту..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="draft">Черновик</SelectItem>
            <SelectItem value="published">Опубликовано</SelectItem>
            <SelectItem value="archived">В архиве</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocale} onValueChange={setFilterLocale}>
          <SelectTrigger className="w-28 h-9">
            <Globe className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Язык" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            {LOCALES.map((l) => (
              <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-9 px-3 text-xs">
          {filtered.length} страниц
        </Badge>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card/50">
          <CardContent className="p-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-semibold text-muted-foreground">Пока нет combo-страниц</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Нажмите &quot;Создать Combo&quot; или &quot;Создать 14 популярных Combo&quot; чтобы начать
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((combo) => (
            <Card
              key={combo.id}
              className="bg-card/50 backdrop-blur hover:bg-card/80 transition-colors cursor-pointer"
              onClick={() => router.push(`/lab-combos/${combo.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[10px] ${STATUS_COLORS[combo.status]}`}>
                        {combo.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {combo.locale.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        Score: {combo.quality_score}/5
                      </Badge>
                      {combo.goal && (
                        <Badge variant="secondary" className="text-[10px]">
                          🎯 {combo.goal.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {combo.meal_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          🍽️ {combo.meal_type}
                        </Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm truncate">{combo.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{combo.description}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {combo.ingredients.map((ing) => (
                        <span
                          key={ing}
                          className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
                      /{combo.slug}
                    </p>
                  </div>

                  {/* Right: actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {combo.status === "published" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        asChild
                      >
                        <a
                          href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {combo.status !== "published" && (
                          <DropdownMenuItem
                            onClick={() =>
                              token &&
                              doAction(combo.id, () => publishCombo(token, combo.id), "Опубликовано!")
                            }
                            disabled={actionLoading[combo.id]}
                          >
                            <ArrowUpCircle className="h-4 w-4 mr-2 text-emerald-500" />
                            Опубликовать
                          </DropdownMenuItem>
                        )}
                        {combo.status !== "archived" && (
                          <DropdownMenuItem
                            onClick={() =>
                              token &&
                              doAction(combo.id, () => archiveCombo(token, combo.id), "В архиве!")
                            }
                            disabled={actionLoading[combo.id]}
                          >
                            <Archive className="h-4 w-4 mr-2 text-zinc-500" />
                            В архив
                          </DropdownMenuItem>
                        )}
                        {combo.status === "published" && (
                          <DropdownMenuItem asChild>
                            <a
                              href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Открыть на сайте
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            token &&
                            doAction(combo.id, () => deleteCombo(token, combo.id), "Удалено!")
                          }
                          disabled={actionLoading[combo.id]}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
