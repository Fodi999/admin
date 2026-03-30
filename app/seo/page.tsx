"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getIntentPages,
  getIntentPageStats,
  getIntentPageSettings,
  updateIntentPageSettings,
  generateBatch,
  generateIntentPage,
  publishIntentPage,
  unpublishIntentPage,
  enqueueIntentPage,
  archiveIntentPage,
  enqueueBulk,
  publishBulk,
  archiveBulk,
  deleteBulk,
  runScheduler,
  deleteIntentPage,
  updateIntentPage,
  regenerateIntentPage,
  findDuplicates,
  cleanupSlugs,
  setGoogleDiscovered,
  uploadImageToR2,
  type IntentPage,
  type IntentPageStats,
  type IntentPageSettings,
  type BatchResult,
  type SchedulerResult,
  type DuplicateGroup,
  type ContentBlock,
} from "@/lib/intent-pages-api";

import {
  Search,
  Globe,
  Zap,
  Clock,
  Archive,
  FileText,
  BarChart3,
  Settings,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Timer,
  Rocket,
  Filter,
  MoreVertical,
  ExternalLink,
  Copy,
  AlertTriangle,
  Layers,
  List,
  MonitorSmartphone,
  X,
  ImageIcon,
  Upload,
  Trash,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { IngredientAutocomplete } from "@/components/ingredient-autocomplete";
import { getLabCombos, type LabComboPage } from "@/lib/lab-combos-api";

// ── Конфигурация ─────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft: { label: "Черновик", color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400", icon: FileText },
  queued: { label: "В очереди", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  published: { label: "Опубликован", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  archived: { label: "В архиве", color: "bg-slate-500/15 text-slate-500 dark:text-slate-400", icon: Archive },
} as const;

const PRIORITY_CONFIG = {
  0: { label: "Низкий", color: "bg-blue-500/15 text-blue-600" },
  1: { label: "Обычный", color: "bg-zinc-500/15 text-zinc-600" },
  2: { label: "Высокий", color: "bg-red-500/15 text-red-600" },
} as const;

const LOCALE_FLAGS: Record<string, string> = { en: "🇬🇧", pl: "🇵🇱", ru: "🇷🇺", uk: "🇺🇦" };

const INTENT_LABELS: Record<string, string> = {
  question: "Вопрос",
  goal: "Цель",
  comparison: "Сравнение",
};

type TabKey = "all" | "queue" | "published" | "drafts" | "archived" | "duplicates";

// ══════════════════════════════════════════════════════════════════
// ГЛАВНАЯ СТРАНИЦА
// ══════════════════════════════════════════════════════════════════

export default function SeoPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pages, setPages] = useState<IntentPage[]>([]);
  const [stats, setStats] = useState<IntentPageStats | null>(null);
  const [settings, setSettings] = useState<IntentPageSettings | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [localeFilter, setLocaleFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [queueSort, setQueueSort] = useState<"priority" | "date">("priority");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [showGenerate, setShowGenerate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetail, setShowDetail] = useState<IntentPage | null>(null);
  const [showPreview, setShowPreview] = useState<IntentPage | null>(null);

  // ── Загрузка данных ────────────────────────────────────────────

  const loadData = useCallback(async (t: string) => {
    try {
      const [p, s, set] = await Promise.all([
        getIntentPages(t),
        getIntentPageStats(t),
        getIntentPageSettings(t),
      ]);
      setPages(p);
      setStats(s);
      setSettings(set);
    } catch (err) {
      console.error(err);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDuplicates = useCallback(async (t: string) => {
    try {
      const d = await findDuplicates(t);
      setDuplicates(d);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const t = getToken();
    if (!t) { router.push("/login"); return; }
    setToken(t);
    loadData(t);
  }, [router, loadData]);

  // Load duplicates when switching to that tab
  useEffect(() => {
    if (activeTab === "duplicates" && token) {
      loadDuplicates(token);
    }
  }, [activeTab, token, loadDuplicates]);

  const refresh = () => {
    if (!token) return;
    setLoading(true);
    loadData(token);
    if (activeTab === "duplicates") loadDuplicates(token);
  };

  // ── Фильтрация ────────────────────────────────────────────────

  const filtered = pages.filter((p) => {
    // Tab filter
    if (activeTab === "queue" && p.status !== "queued") return false;
    if (activeTab === "published" && p.status !== "published") return false;
    if (activeTab === "drafts" && p.status !== "draft") return false;
    if (activeTab === "archived" && p.status !== "archived") return false;
    // Locale filter
    if (localeFilter !== "all" && p.locale !== localeFilter) return false;
    // Intent filter
    if (intentFilter !== "all" && p.intent_type !== intentFilter) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.entity_a.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Queue sorting
  const sorted = activeTab === "queue"
    ? [...filtered].sort((a, b) => {
        if (queueSort === "priority") {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return (a.queued_at || "").localeCompare(b.queued_at || "");
        }
        return (a.queued_at || "").localeCompare(b.queued_at || "");
      })
    : filtered;

  // ── Действия ──────────────────────────────────────────────────

  const handleAction = async (
    action: (token: string, id: string) => Promise<IntentPage>,
    id: string,
    label: string,
  ) => {
    if (!token) return;
    try {
      await action(token, id);
      toast.success(label);
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm("Удалить эту страницу безвозвратно?")) return;
    try {
      await deleteIntentPage(token, id);
      toast.success("Страница удалена");
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBulkEnqueue = async (priority: number) => {
    if (!token || selected.size === 0) return;
    try {
      const result = await enqueueBulk(token, Array.from(selected), priority);
      toast.success(`В очередь: ${result.queued} (пропущено: ${result.skipped})`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBulkPublish = async () => {
    if (!token || selected.size === 0) return;
    try {
      const result = await publishBulk(token, Array.from(selected));
      toast.success(`Опубликовано: ${result.published} (пропущено: ${result.skipped})`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBulkArchive = async () => {
    if (!token || selected.size === 0) return;
    try {
      const result = await archiveBulk(token, Array.from(selected));
      toast.success(`В архив: ${result.archived} (пропущено: ${result.skipped})`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleBulkDelete = async () => {
    if (!token || selected.size === 0) return;
    if (!confirm(`Удалить ${selected.size} стр. безвозвратно?`)) return;
    try {
      const result = await deleteBulk(token, Array.from(selected));
      toast.success(`Удалено: ${result.deleted} (пропущено: ${result.skipped})`);
      setSelected(new Set());
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleRunScheduler = async () => {
    if (!token) return;
    try {
      const result: SchedulerResult = await runScheduler(token);
      if (result.reason === "daily_limit_reached") {
        toast.warning(`Дневной лимит исчерпан (${result.published_today}/${result.limit})`);
      } else if (result.reason === "queue_empty") {
        toast.info("Очередь пуста — нечего публиковать");
      } else {
        toast.success(`Планировщик опубликовал ${result.published} стр.`);
      }
      refresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleCleanupSlugs = async () => {
    if (!token) return;
    if (!confirm("Это удалит дубли и оставит только канонические slug. Продолжить?")) return;
    try {
      const result = await cleanupSlugs(token);
      toast.success(`Очищено: ${result.deleted} дублей удалено, ${result.kept} оставлено`);
      refresh();
      if (token) loadDuplicates(token);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((p) => p.id)));
    }
  };

  // ── Рендер ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TABS: { key: TabKey; label: string; count?: number; icon: React.ComponentType<{className?: string}> }[] = [
    { key: "all", label: "Все", count: pages.length, icon: Layers },
    { key: "queue", label: "Очередь", count: stats?.queued, icon: Clock },
    { key: "drafts", label: "Черновики", count: stats?.draft, icon: FileText },
    { key: "published", label: "Опубликованы", count: stats?.published, icon: CheckCircle2 },
    { key: "archived", label: "Архив", count: stats?.archived, icon: Archive },
    { key: "duplicates", label: "Дубли", count: duplicates.length || undefined, icon: Copy },
  ];

  return (
    <div className="space-y-6 p-6 max-w-[1400px] mx-auto">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SEO Страницы</h1>
          <p className="text-muted-foreground mt-1">
            Программатик SEO — генерация, очередь, публикация
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4 mr-2" /> Настройки
          </Button>
          <Button size="sm" onClick={() => setShowGenerate(true)}>
            <Zap className="w-4 h-4 mr-2" /> Сгенерировать
          </Button>
        </div>
      </div>

      {/* Карточки статистики */}
      {stats && <StatsCards stats={stats} onRunScheduler={handleRunScheduler} />}

      {/* KPI: Site-wide SEO Growth Panel */}
      {stats?.seo && (
        <SeoKpiPanel
          seo={stats.seo}
          token={token!}
          onUpdated={() => { if (token) loadData(token); }}
        />
      )}

      {/* Табы */}
      <div className="flex items-center gap-1 border-b overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Контент дублей */}
      {activeTab === "duplicates" ? (
        <DuplicatesPanel
          duplicates={duplicates}
          onCleanup={handleCleanupSlugs}
          loading={!duplicates}
        />
      ) : (
        <>
          {/* Фильтры + массовые действия */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по заголовку, slug, сущности..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={localeFilter} onValueChange={setLocaleFilter}>
              <SelectTrigger className="w-[140px]">
                <Globe className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все языки</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                <SelectItem value="uk">🇺🇦 Українська</SelectItem>
              </SelectContent>
            </Select>

            {/* Фильтр по типу интента */}
            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value="question">❓ Вопрос</SelectItem>
                <SelectItem value="goal">🎯 Цель</SelectItem>
                <SelectItem value="comparison">⚖️ Сравнение</SelectItem>
              </SelectContent>
            </Select>

            {/* Сортировка очереди */}
            {activeTab === "queue" && (
              <Select value={queueSort} onValueChange={(v) => setQueueSort(v as "priority" | "date")}>
                <SelectTrigger className="w-[170px]">
                  <List className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">По приоритету</SelectItem>
                  <SelectItem value="date">По дате добавления</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Массовые действия */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-muted-foreground">
                  Выбрано: {selected.size}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Массовые действия <ChevronDown className="w-4 h-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkEnqueue(2)}>
                      <ArrowUpCircle className="w-4 h-4 mr-2 text-red-500" /> В очередь (Высокий)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkEnqueue(1)}>
                      <Clock className="w-4 h-4 mr-2 text-amber-500" /> В очередь (Обычный)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkEnqueue(0)}>
                      <ArrowDownCircle className="w-4 h-4 mr-2 text-blue-500" /> В очередь (Низкий)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBulkPublish}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Опубликовать все
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleBulkArchive}>
                      <Archive className="w-4 h-4 mr-2 text-slate-500" /> В архив все
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" /> Удалить все
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Таблица */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-left w-10">
                        <input
                          type="checkbox"
                          checked={selected.size === sorted.length && sorted.length > 0}
                          onChange={selectAllFiltered}
                          className="rounded"
                        />
                      </th>
                      <th className="p-3 text-left">Заголовок / Slug</th>
                      <th className="p-3 text-left w-20">Язык</th>
                      {activeTab !== "queue" && <th className="p-3 text-left w-28">Статус</th>}
                      <th className="p-3 text-left w-24">Приоритет</th>
                      <th className="p-3 text-left w-28">Тип</th>
                      {activeTab === "queue" && <th className="p-3 text-left w-32">В очереди с</th>}
                      <th className="p-3 text-right w-24">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-muted-foreground">
                          {activeTab === "queue"
                            ? "Очередь пуста. Добавьте страницы через «В очередь»."
                            : "Страниц не найдено. Нажмите «Сгенерировать» для создания."}
                        </td>
                      </tr>
                    ) : (
                      sorted.map((page) => (
                        <PageRow
                          key={page.id}
                          page={page}
                          isSelected={selected.has(page.id)}
                          showStatus={activeTab !== "queue"}
                          showQueueDate={activeTab === "queue"}
                          onToggle={() => toggleSelect(page.id)}
                          onPublish={() => handleAction(publishIntentPage, page.id, "Опубликовано!")}
                          onUnpublish={() => handleAction(unpublishIntentPage, page.id, "Снято с публикации")}
                          onEnqueue={() => handleAction(enqueueIntentPage, page.id, "Добавлено в очередь")}
                          onArchive={() => handleAction(archiveIntentPage, page.id, "Отправлено в архив")}
                          onDelete={() => handleDelete(page.id)}
                          onDetail={() => setShowDetail(page)}
                          onPreview={() => setShowPreview(page)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Lab Combo SEO Pages ── */}
      <LabCombosSection token={token} router={router} />

      {/* Диалоги */}
      {showGenerate && token && (
        <GenerateDialog token={token} onClose={() => setShowGenerate(false)} onDone={() => { setShowGenerate(false); refresh(); }} />
      )}
      {showSettings && token && settings && (
        <SettingsDialog token={token} settings={settings} onClose={() => setShowSettings(false)} onSaved={(s) => { setSettings(s); setShowSettings(false); toast.success("Настройки сохранены"); }} />
      )}
      {showDetail && token && (
        <DetailDialog page={showDetail} token={token} onClose={() => setShowDetail(null)} onSaved={() => { setShowDetail(null); refresh(); }} />
      )}
      {showPreview && token && (
        <PreviewDialog page={showPreview} token={token} onClose={() => setShowPreview(null)} onPublished={() => { setShowPreview(null); refresh(); }} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SEO KPI PANEL — Site-wide Growth Counter
// ══════════════════════════════════════════════════════════════════

function SeoKpiPanel({
  seo,
  token,
  onUpdated,
}: {
  seo: IntentPageStats["seo"];
  token: string;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(String(seo.google_discovered ?? 7192));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseInt(input, 10);
    if (isNaN(val) || val < 0) { toast.error("Введите корректное число"); return; }
    setSaving(true);
    try {
      await setGoogleDiscovered(token, val);
      toast.success("Базовая метрика обновлена");
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Safe field resolution (backward-compatible with old backend) ──
  const systemTotal    = seo.system_total        ?? (seo as Record<string, number>).convert ?? 0;
  const googleSeen     = seo.google_discovered   ?? 7192;
  // ✅ Fix: coverage = tracked / google (never exceeds 100%)
  const coveragePct    = Math.min(
    (seo as Record<string, number>).coverage_pct
      ?? (googleSeen > 0 ? (systemTotal / googleSeen) * 100 : 0),
    100
  );
  const notYetIndexed  = (seo as Record<string, number>).not_yet_indexed
    ?? Math.max(0, googleSeen - systemTotal);
  const untracked      = (seo as Record<string, number>).untracked
    ?? Math.max(0, systemTotal - googleSeen);
  const intentToday    = (seo as Record<string, number>).intent_today    ?? 0;
  const intentWeek     = (seo as Record<string, number>).intent_this_week ?? 0;

  // Breakdown — use server values if present, else estimate from what we have
  const howMany        = (seo as Record<string, number>).how_many            ?? (seo as Record<string, number>).convert ?? 0;
  const statesCount    = seo.states                 ?? 0;
  const nutritionCount = seo.nutrition              ?? 0;
  const profiles       = (seo as Record<string, number>).ingredient_profiles ?? seo.active_ingredients ?? 0;
  const diet           = (seo as Record<string, number>).diet                ?? 0;
  const ranking        = (seo as Record<string, number>).ranking             ?? 0;
  const fishSeason     = (seo as Record<string, number>).fish_season         ?? 0;
  const staticPages    = (seo as Record<string, number>).static_pages        ?? 0;
  const intentPages    = seo.intent_pages           ?? 0;

  // ✅ Pages-per-ingredient ratio
  const ingredientCount   = seo.active_ingredients ?? 0;
  const pagesPerIngredient = ingredientCount > 0
    ? (systemTotal / ingredientCount)
    : 0;
  const intentPerIngredient = ingredientCount > 0
    ? (intentPages / ingredientCount)
    : 0;

  // ✅ Intent low-signal threshold
  const intentLow = intentPages < 10;

  const BREAKDOWN = [
    { label: "Сколько (how-many)", value: howMany,        icon: "⚖️",  color: "bg-violet-500" },
    { label: "Состояния",          value: statesCount,    icon: "🔥",  color: "bg-orange-500" },
    { label: "Нутриция",           value: nutritionCount, icon: "📊",  color: "bg-blue-500"   },
    { label: "Профили",            value: profiles,       icon: "🌿",  color: "bg-emerald-500" },
    { label: "Диеты",              value: diet,           icon: "🥗",  color: "bg-green-400"  },
    { label: "Рейтинги",           value: ranking,        icon: "🏆",  color: "bg-yellow-500" },
    { label: "Рыбный сезон",       value: fishSeason,     icon: "🐟",  color: "bg-cyan-500"   },
    { label: "Статика",            value: staticPages,    icon: "📄",  color: "bg-zinc-400"   },
    { label: "Intent Pages",       value: intentPages,    icon: "🧠",  color: "bg-primary"    },
  ].filter((b) => b.value > 0); // hide zero rows

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="font-semibold text-base">SEO Рост — Счётчик страниц</span>
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Google видит:</span>
              <Input
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-28 h-8 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Сохранить"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Отмена</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => { setInput(String(seo.google_discovered ?? googleSeen)); setEditing(true); }}>
              <Settings className="w-3 h-3 mr-1" /> Обновить Google
            </Button>
          )}
        </div>

        {/* ① Three main KPI boxes */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Tracked (system) */}
          <div className="bg-background/60 rounded-xl p-4 border text-center">
            <div className="text-2xl font-bold">{systemTotal.toLocaleString("ru-RU")}</div>
            <div className="text-xs text-muted-foreground mt-1">📄 Tracked (система)</div>
          </div>

          {/* Google discovered */}
          <div className="bg-background/60 rounded-xl p-4 border text-center">
            <div className="text-2xl font-bold text-blue-600">{googleSeen.toLocaleString("ru-RU")}</div>
            <div className="text-xs text-muted-foreground mt-1">🌍 Google discovered</div>
          </div>

          {/* Coverage = tracked / google */}
          <div className={`rounded-xl p-4 border text-center ${coveragePct >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : coveragePct >= 40 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <div className={`text-2xl font-bold ${coveragePct >= 80 ? "text-emerald-600" : coveragePct >= 40 ? "text-amber-600" : "text-red-500"}`}>
              {coveragePct.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">� Coverage</div>
          </div>
        </div>

        {/* Coverage progress bar: tracked / google */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Покрытие: tracked / google discovered</span>
            <span className="font-mono">
              {systemTotal.toLocaleString("ru-RU")} / {googleSeen.toLocaleString("ru-RU")}
              {notYetIndexed > 0 && (
                <span className="ml-2 text-amber-500">⏳ +{notYetIndexed.toLocaleString("ru-RU")} не проиндексировано</span>
              )}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${coveragePct >= 80 ? "bg-emerald-500" : coveragePct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${coveragePct.toFixed(1)}%` }}
            />
          </div>
        </div>

        {/* ② Intent Pages low signal */}
        {intentLow && (
          <div className="flex items-start gap-3 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                ⚠ Intent pages low — growth opportunity
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Сейчас: <span className="font-mono font-bold">{intentPages}</span> страниц.
                Intent pages — главный двигатель роста. Цель: <strong>1000+</strong>.
                Нажмите «Сгенерировать» чтобы начать.
              </div>
            </div>
          </div>
        )}

        {/* ③ Breakdown bars */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Разбивка по типам</div>
          <div className="space-y-1.5">
            {BREAKDOWN.map((b) => {
              const pct = systemTotal > 0 ? (b.value / systemTotal) * 100 : 0;
              const isIntentLowRow = b.label === "Intent Pages" && intentLow;
              return (
                <div key={b.label} className={`flex items-center gap-3 ${isIntentLowRow ? "bg-amber-500/5 rounded px-1" : ""}`}>
                  <span className="text-sm w-4 text-center">{b.icon}</span>
                  <span className={`text-xs w-32 truncate ${isIntentLowRow ? "text-amber-600 font-semibold dark:text-amber-400" : "text-muted-foreground"}`}>
                    {b.label}
                    {isIntentLowRow && " ⚠"}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${b.color}`}
                      style={{ width: `${pct.toFixed(1)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-14 text-right font-medium">
                    {b.value.toLocaleString("ru-RU")}
                  </span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ④ Intent Growth + ⑤ Pages per ingredient */}
        <div className="pt-3 border-t grid grid-cols-2 gap-4">
          {/* Intent Growth */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              🧠 Intent Growth
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center bg-background/60 rounded-lg p-2 border">
                <div className={`text-lg font-bold ${intentToday > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                  +{intentToday.toLocaleString("ru-RU")}
                </div>
                <div className="text-[10px] text-muted-foreground">📅 Сегодня</div>
              </div>
              <div className="text-center bg-background/60 rounded-lg p-2 border">
                <div className={`text-lg font-bold ${intentWeek > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                  +{intentWeek.toLocaleString("ru-RU")}
                </div>
                <div className="text-[10px] text-muted-foreground">📆 Неделя</div>
              </div>
              <div className="text-center bg-primary/5 rounded-lg p-2 border border-primary/20">
                <div className="text-lg font-bold text-primary">1 000</div>
                <div className="text-[10px] text-muted-foreground">🎯 Цель/мес</div>
              </div>
            </div>
          </div>

          {/* Pages per ingredient */}
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              📈 Pages per ingredient
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-background/60 rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">Всего / ингр.</div>
                <div className={`text-xl font-bold ${pagesPerIngredient >= 5 ? "text-emerald-600" : pagesPerIngredient >= 2 ? "text-amber-600" : "text-red-500"}`}>
                  {pagesPerIngredient.toFixed(1)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  цель: <span className="font-mono text-primary">5–10</span>
                </div>
              </div>
              <div className="bg-background/60 rounded-lg p-3 border">
                <div className="text-xs text-muted-foreground mb-1">Intent / ингр.</div>
                <div className={`text-xl font-bold ${intentPerIngredient >= 5 ? "text-emerald-600" : intentPerIngredient >= 1 ? "text-amber-600" : "text-red-500"}`}>
                  {intentPerIngredient.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  ингр.: <span className="font-mono">{ingredientCount}</span>
                </div>
              </div>
            </div>
            {pagesPerIngredient < 5 && (
              <div className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Нужно {Math.ceil((5 * ingredientCount) - systemTotal).toLocaleString("ru-RU")} страниц до цели ×5
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// КАРТОЧКИ СТАТИСТИКИ
// ══════════════════════════════════════════════════════════════════

function StatsCards({ stats, onRunScheduler }: { stats: IntentPageStats; onRunScheduler: () => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <StatCard label="Всего" value={stats.total} icon={BarChart3} />
      <StatCard label="Черновики" value={stats.draft} icon={FileText} className="text-zinc-600" />
      <StatCard
        label="В очереди"
        value={stats.queued}
        icon={Clock}
        className="text-amber-600"
        sub={stats.queued > 0 ? `В:${stats.queued_high} О:${stats.queued_normal} Н:${stats.queued_low}` : undefined}
      />
      <StatCard label="Опубликовано" value={stats.published} icon={CheckCircle2} className="text-emerald-600" />
      <StatCard
        label="Сегодня"
        value={`${stats.published_today}/${stats.publish_limit_per_day}`}
        icon={Timer}
        className="text-blue-600"
        sub={`Осталось: ${stats.remaining_today}`}
      />
      <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-dashed" onClick={onRunScheduler}>
        <CardContent className="p-4 flex flex-col items-center justify-center gap-1">
          <Rocket className="w-5 h-5 text-primary" />
          <span className="text-xs font-medium">Запустить</span>
          <span className="text-[10px] text-muted-foreground">планировщик</span>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, className, sub }: {
  label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; className?: string; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-4 h-4 ${className || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// ПАНЕЛЬ ДУБЛЕЙ
// ══════════════════════════════════════════════════════════════════

function DuplicatesPanel({ duplicates, onCleanup, loading }: {
  duplicates: DuplicateGroup[]; onCleanup: () => void; loading: boolean;
}) {
  // ── Slug-level dedup check: same slug appearing in multiple locales = real dupe ──
  const slugLocaleMap = new Map<string, string[]>();
  for (const group of duplicates) {
    for (const entry of group.pages) {
      const existing = slugLocaleMap.get(entry.slug) ?? [];
      if (!existing.includes(group.locale)) existing.push(group.locale);
      slugLocaleMap.set(entry.slug, existing);
    }
  }
  const slugCollisions = [...slugLocaleMap.entries()].filter(([, locales]) => locales.length > 1);

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (duplicates.length === 0 && slugCollisions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold">Дублей не найдено!</h3>
          <p className="text-muted-foreground mt-1">Все slug уникальны. Отличная работа 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <span className="font-semibold">Найдено {duplicates.length} групп дублей</span>
          {slugCollisions.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {slugCollisions.length} slug-коллизий
            </Badge>
          )}
        </div>
        <Button variant="destructive" size="sm" onClick={onCleanup}>
          <Trash2 className="w-4 h-4 mr-2" /> Автоочистка дублей
        </Button>
      </div>

      {/* ── Slug collisions (same slug, different locales) ── */}
      {slugCollisions.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">
                Slug-коллизии — одинаковый slug в разных локалях (критично для SEO)
              </span>
            </div>
            <div className="space-y-1.5">
              {slugCollisions.map(([slug, locales]) => (
                <div key={slug} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="font-mono text-xs flex-1">{slug}</span>
                  <div className="flex gap-1">
                    {locales.map((l) => (
                      <Badge key={l} variant="destructive" className="text-[10px] px-1.5 py-0">
                        {LOCALE_FLAGS[l] ?? "🌐"} {l}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">❌ Одинаковый slug</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Content duplicates (same entity_a + locale) ── */}
      {duplicates.map((group, gi) => (
        <Card key={gi}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-mono text-sm font-semibold text-primary">{group.canonical_slug}</span>
              <Badge variant="secondary">{LOCALE_FLAGS[group.locale]} {group.locale}</Badge>
              <span className="text-xs text-muted-foreground">• {group.entity_a}</span>
            </div>
            <div className="space-y-2">
              {group.pages.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 text-sm p-2 rounded-lg ${
                    entry.is_canonical ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"
                  }`}
                >
                  {entry.is_canonical ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs flex-1">{entry.slug}</span>
                  <Badge variant="secondary" className={STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG]?.color || ""}>
                    {STATUS_CONFIG[entry.status as keyof typeof STATUS_CONFIG]?.label || entry.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entry.is_canonical ? "✅ Каноничный" : "❌ Будет удалён"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// СТРОКА ТАБЛИЦЫ
// ══════════════════════════════════════════════════════════════════

function PageRow({
  page, isSelected, showStatus, showQueueDate,
  onToggle, onPublish, onUnpublish, onEnqueue, onArchive, onDelete, onDetail, onPreview,
}: {
  page: IntentPage; isSelected: boolean; showStatus: boolean; showQueueDate: boolean;
  onToggle: () => void; onPublish: () => void; onUnpublish: () => void;
  onEnqueue: () => void; onArchive: () => void; onDelete: () => void;
  onDetail: () => void; onPreview: () => void;
}) {
  const st = STATUS_CONFIG[page.status] || STATUS_CONFIG.draft;
  const pr = PRIORITY_CONFIG[page.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG[1];
  const StIcon = st.icon;

  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="p-3">
        <input type="checkbox" checked={isSelected} onChange={onToggle} className="rounded" />
      </td>
      <td className="p-3">
        <button onClick={onDetail} className="text-left hover:underline w-full">
          <div className="flex items-center gap-2">
            <div className="font-medium line-clamp-1 flex-1">{page.title}</div>
            <SeoScoreBadge page={page} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">/{page.slug}</div>
        </button>
      </td>
      <td className="p-3">
        <span className="text-base" title={page.locale}>{LOCALE_FLAGS[page.locale] || page.locale}</span>
      </td>
      {showStatus && (
        <td className="p-3">
          <Badge variant="secondary" className={`${st.color} gap-1`}>
            <StIcon className="w-3 h-3" />{st.label}
          </Badge>
        </td>
      )}
      <td className="p-3">
        <Badge variant="secondary" className={pr.color}>{pr.label}</Badge>
      </td>
      <td className="p-3">
        <span className="text-xs text-muted-foreground">{INTENT_LABELS[page.intent_type] || page.intent_type}</span>
      </td>
      {showQueueDate && (
        <td className="p-3">
          <span className="text-xs text-muted-foreground">
            {page.queued_at ? new Date(page.queued_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
          </span>
        </td>
      )}
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPreview} title="Превью для Google">
            <MonitorSmartphone className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDetail}>
                <Eye className="w-4 h-4 mr-2" /> Просмотр / Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPreview}>
                <MonitorSmartphone className="w-4 h-4 mr-2" /> Превью для Google
              </DropdownMenuItem>
              {page.status === "published" && (
                <DropdownMenuItem asChild>
                  <a href={`https://dima-fomin.pl/chef-tools/seo/${page.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" /> Открыть на сайте
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {page.status === "draft" && (
                <>
                  <DropdownMenuItem onClick={onEnqueue}><Clock className="w-4 h-4 mr-2" /> В очередь</DropdownMenuItem>
                  <DropdownMenuItem onClick={onPublish}><CheckCircle2 className="w-4 h-4 mr-2" /> Опубликовать сейчас</DropdownMenuItem>
                </>
              )}
              {page.status === "queued" && (
                <DropdownMenuItem onClick={onPublish}><CheckCircle2 className="w-4 h-4 mr-2" /> Опубликовать сейчас</DropdownMenuItem>
              )}
              {page.status === "published" && (
                <>
                  <DropdownMenuItem onClick={onUnpublish}><EyeOff className="w-4 h-4 mr-2" /> Снять с публикации</DropdownMenuItem>
                  <DropdownMenuItem onClick={onArchive}><Archive className="w-4 h-4 mr-2" /> В архив</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// ПРЕВЬЮ ДЛЯ GOOGLE (SERP Preview)
// ══════════════════════════════════════════════════════════════════

// ── SEO scoring: two separate scores ─────────────────────────────────────────
// uiScore  = content quality (length, FAQ count) — 0-50 pts
// seoScore = semantic quality (keyword, slug, intent match) — 0-50 pts
// total    = uiScore + seoScore → grade A+/A/B/C/D

function seoAnalysis(page: IntentPage): {
  uiScore: number;
  seoScore: number;
  total: number;
  grade: string;
  color: string;
  checks: { id: string; status: "ok" | "warn" | "err"; label: string; hint: string }[];
} {
  const tl = page.title.length;
  const dl = page.description.length;
  const al = page.answer.length;
  const fl = page.faq?.length || 0;
  const slug = page.slug.toLowerCase();
  const titleLow = page.title.toLowerCase();
  const entityA = page.entity_a.toLowerCase().replace(/-/g, " ");
  const entityASlug = page.entity_a.toLowerCase();

  // ── UI Score (50 pts) ──────────────────────────────────────────────────────
  let ui = 0;
  // Title length (15 pts)
  if (tl >= 50 && tl <= 60) ui += 15; else if (tl >= 40 && tl <= 65) ui += 9; else if (tl >= 30) ui += 3;
  // Description length (15 pts)
  if (dl >= 120 && dl <= 155) ui += 15; else if (dl >= 100 && dl <= 160) ui += 9; else if (dl >= 80) ui += 3;
  // Answer length (10 pts)
  if (al >= 400 && al <= 800) ui += 10; else if (al >= 200 && al <= 1000) ui += 6; else if (al >= 100) ui += 2;
  // FAQ count (10 pts)
  if (fl >= 4) ui += 10; else if (fl >= 3) ui += 6; else if (fl >= 2) ui += 3;

  // ── SEO Score (50 pts) ────────────────────────────────────────────────────
  let seo = 0;

  // 1. Slug contains entity keyword (15 pts)
  const slugHasKeyword = slug.includes(entityASlug);
  if (slugHasKeyword) seo += 15;

  // 2. Slug is semantic (not generic: question-X, goal-X) (10 pts)
  const genericSlug = /^(question|goal|comparison|combo)-/.test(slug);
  if (!genericSlug && slug.length > 10) seo += 10; else if (!genericSlug) seo += 5;

  // 3. Title contains entity keyword (10 pts)
  // For non-EN locales, entityA is English ("artichoke") but title is in locale ("артишок").
  // We can't match without a translation dictionary, so auto-pass non-EN locales.
  const isEnLocale = page.locale === "en";
  const titleHasKeyword = isEnLocale
    ? titleLow.includes(entityA) || titleLow.includes(entityASlug)
    : true; // non-EN: assume AI placed the translated keyword
  if (titleHasKeyword) seo += 10;

  // 4. Intent match: question → title should be a question (10 pts)
  const isQuestion = page.intent_type === "question";
  const titleIsQuestion = /\?/.test(page.title) || /^(is|are|can|does|do|how|what|why|when|полезен|можно|стоит|как|чем|что|czy|jak|co|ile|dlaczego|kiedy|чи|як|що|скільки|чому|коли)/i.test(page.title.trim());
  if (!isQuestion) seo += 10; // non-question intents always pass
  else if (titleIsQuestion) seo += 10; else seo += 3;

  // 5. Description has CTA keyword (5 pts)
  const descLow = page.description.toLowerCase();
  const hasCta = /узнайте|learn|dowiedz|дізнайтесь|прочитайте|discover/.test(descLow);
  if (hasCta) seo += 5;

  const total = ui + seo;
  const grade = total >= 90 ? "A+" : total >= 75 ? "A" : total >= 60 ? "B" : total >= 40 ? "C" : "D";
  const color = total >= 75 ? "text-emerald-600" : total >= 50 ? "text-amber-600" : "text-red-500";

  // ── Checks list ───────────────────────────────────────────────────────────
  const checks: { id: string; status: "ok" | "warn" | "err"; label: string; hint: string }[] = [
    {
      id: "title-len",
      status: tl >= 50 && tl <= 60 ? "ok" : tl >= 40 && tl <= 65 ? "warn" : "err",
      label: `Title: ${tl} символов`,
      hint: tl < 40 ? "❌ Слишком короткий (нужно 50-60)" : tl < 50 ? "⚠ Коротковат, идеал 50-60" : tl > 65 ? "❌ Обрежется в SERP" : tl > 60 ? "⚠ На грани" : "✅ Идеально",
    },
    {
      id: "desc-len",
      status: dl >= 120 && dl <= 155 ? "ok" : dl >= 100 && dl <= 160 ? "warn" : "err",
      label: `Description: ${dl} символов`,
      hint: dl < 100 ? "❌ Слишком короткий (нужно 120-155)" : dl < 120 ? "⚠ Коротковат" : dl > 160 ? "❌ Google обрежет" : dl > 155 ? "⚠ На грани" : "✅ Идеально",
    },
    {
      id: "answer-len",
      status: al >= 400 && al <= 800 ? "ok" : al >= 200 && al <= 1000 ? "warn" : "err",
      label: `Контент: ${al} символов`,
      hint: al < 200 ? "❌ Слишком мало" : al < 400 ? "⚠ Маловато, идеал 400-800" : al > 1000 ? "⚠ Можно сократить" : "✅ Идеально",
    },
    {
      id: "faq",
      status: fl >= 4 ? "ok" : fl >= 3 ? "warn" : "err",
      label: `FAQ: ${fl} вопросов`,
      hint: fl < 2 ? "❌ Нужно минимум 4 FAQ для Rich Snippets" : fl < 3 ? "⚠ Мало (нужно 4)" : fl < 4 ? "⚠ Хорошо, но идеал = 4" : "✅ Rich Snippets активны",
    },
    {
      id: "slug-keyword",
      status: slugHasKeyword ? "ok" : "err",
      label: `Slug содержит ключ: "${entityASlug}"`,
      hint: slugHasKeyword ? `✅ /${slug}` : `❌ /${slug} — нет ключа "${entityASlug}", регенерировать`,
    },
    {
      id: "slug-semantic",
      status: !genericSlug && slug.length > 10 ? "ok" : !genericSlug ? "warn" : "err",
      label: `Slug семантичный`,
      hint: genericSlug ? `❌ Шаблонный slug (${slug.split('-')[0]}-...) — регенерировать` : slug.length <= 10 ? "⚠ Очень короткий slug" : "✅ Семантический slug",
    },
    {
      id: "title-keyword",
      status: titleHasKeyword ? "ok" : "warn",
      label: isEnLocale ? `Ключ в title: "${entityA}"` : `Ключ в title (${page.locale})`,
      hint: !isEnLocale ? "✅ Non-EN — проверка невозможна без словаря" : titleHasKeyword ? "✅ Ключевое слово в заголовке" : `⚠ Нет "${entityA}" в заголовке — добавить`,
    },
    {
      id: "intent-match",
      status: !isQuestion ? "ok" : titleIsQuestion ? "ok" : "warn",
      label: `Intent match (${page.intent_type})`,
      hint: !isQuestion ? "✅ Не вопрос — ок" : titleIsQuestion ? "✅ Title — вопрос (соответствует intent)" : "⚠ Intent=question, но title не вопрос",
    },
    {
      id: "desc-cta",
      status: hasCta ? "ok" : "warn",
      label: `CTA в description`,
      hint: hasCta ? "✅ Есть призыв к действию" : "⚠ Добавь 'Узнайте' / 'Learn' / 'Discover'",
    },
  ];

  return { uiScore: ui, seoScore: seo, total, grade, color, checks };
}

// Legacy alias for badge
function seoScore(page: IntentPage): { score: number; grade: string; color: string } {
  const { total, grade, color } = seoAnalysis(page);
  return { score: total, grade, color };
}

function SeoScoreBadge({ page }: { page: IntentPage }) {
  const { grade, color } = seoScore(page);
  const bg = grade === "A+" || grade === "A" ? "bg-emerald-50" : grade === "B" ? "bg-amber-50" : "bg-red-50";
  return (
    <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold ${color} ${bg} min-w-[28px]`}>
      {grade}
    </span>
  );
}

function PreviewDialog({ page, token, onClose, onPublished }: { page: IntentPage; token: string; onClose: () => void; onPublished: () => void }) {
  const realUrl = `https://dima-fomin.pl/${page.locale}/chef-tools/seo/${page.slug}`;
  const [urlStatus, setUrlStatus] = useState<"idle" | "checking" | "ok" | "404" | "err">("idle");
  const [publishing, setPublishing] = useState(false);

  const { uiScore, seoScore: seoSc, total, grade, color, checks } = seoAnalysis(page);

  const checkUrl = async () => {
    setUrlStatus("checking");
    try {
      const res = await fetch(`/api/check-url?url=${encodeURIComponent(realUrl)}`);
      const data = await res.json();
      setUrlStatus(data.status === 200 ? "ok" : data.status === 404 ? "404" : "err");
    } catch {
      setUrlStatus("err");
    }
  };

  const gradeBg = grade === "A+" ? "bg-emerald-500" : grade === "A" ? "bg-emerald-500" : grade === "B" ? "bg-amber-500" : "bg-red-500";
  const okCount = checks.filter(c => c.status === "ok").length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="w-[600px] max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0 gap-0"
      >
        {/* Accessible title for screen readers (visually hidden) */}
        <DialogHeader className="sr-only">
          <DialogTitle>SEO Preview — {page.title}</DialogTitle>
        </DialogHeader>

        {/* ── Header with grade badge ── */}
        <div className={`${gradeBg} px-6 py-4 flex items-center gap-3 rounded-t-lg relative`}>
          {/* Custom close button on colored header */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 rounded-full bg-white/20 hover:bg-white/30 p-1 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="bg-white/20 backdrop-blur rounded-xl w-14 h-14 flex items-center justify-center">
            <span className="text-white text-2xl font-black">{grade}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-lg leading-tight truncate">SEO Preview</h2>
            <p className="text-white/80 text-sm">{total}/100 очков · {page.locale.toUpperCase()} · {page.intent_type}</p>
          </div>
          <div className="flex gap-1">
            <div className="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center">
              <div className="text-white text-xs font-medium opacity-80">UI</div>
              <div className="text-white text-sm font-bold">{uiScore}/50</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-lg px-2.5 py-1 text-center">
              <div className="text-white text-xs font-medium opacity-80">SEO</div>
              <div className="text-white text-sm font-bold">{seoSc}/50</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── URL + status check ── */}
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/50">
              <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono truncate flex-1 text-foreground select-all">{realUrl}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 shrink-0"
                onClick={checkUrl}
                disabled={urlStatus === "checking"}
              >
                {urlStatus === "checking" ? "Проверяю…" : "Проверить URL"}
              </Button>
            </div>
            {urlStatus !== "idle" && urlStatus !== "checking" && (
              <div className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                urlStatus === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : urlStatus === "404" ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}>
                {urlStatus === "ok" && <><CheckCircle2 className="w-3.5 h-3.5" /> Страница доступна (200)</>}
                {urlStatus === "404" && <><AlertCircle className="w-3.5 h-3.5" /> Страница не найдена (404)</>}
                {urlStatus === "err" && <><AlertTriangle className="w-3.5 h-3.5" /> Ошибка при проверке</>}
              </div>
            )}
          </div>

          {/* ── Google SERP mock ── */}
          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Предпросмотр в Google</h4>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border shadow-sm space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <img src="https://www.google.com/s2/favicons?domain=dima-fomin.pl&sz=16" alt="" className="w-4 h-4 rounded-full" />
                <span>dima-fomin.pl</span>
                <span className="text-zinc-400">›</span>
                <span>{page.locale}</span>
                <span className="text-zinc-400">›</span>
                <span>chef-tools</span>
                <span className="text-zinc-400">›</span>
                <span className="truncate">{page.slug}</span>
              </div>
              <h3 className="text-[#1a0dab] dark:text-blue-400 text-lg font-normal leading-snug cursor-pointer hover:underline">
                {page.title}
              </h3>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                {page.description}
              </p>
            </div>
          </div>

          {/* ── Score progress bars ── */}
          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Оценки</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold">UI Score</span>
                  <span className={`text-sm font-bold ${uiScore >= 38 ? "text-emerald-600" : uiScore >= 25 ? "text-amber-600" : "text-red-500"}`}>
                    {uiScore}<span className="text-muted-foreground font-normal">/50</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${uiScore >= 38 ? "bg-emerald-500" : uiScore >= 25 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${(uiScore / 50) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Title · Description · Контент · FAQ</p>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-semibold">SEO Score</span>
                  <span className={`text-sm font-bold ${seoSc >= 38 ? "text-emerald-600" : seoSc >= 25 ? "text-amber-600" : "text-red-500"}`}>
                    {seoSc}<span className="text-muted-foreground font-normal">/50</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${seoSc >= 38 ? "bg-emerald-500" : seoSc >= 25 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${(seoSc / 50) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Slug · Keyword · Intent · CTA</p>
              </div>
            </div>
          </div>

          {/* ── SEO audit checklist ── */}
          <div>
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              SEO аудит — {okCount}/{checks.length} пройдено
            </h4>
            <div className="rounded-lg border overflow-hidden divide-y">
              {checks.map(c => {
                const isOk = c.status === "ok";
                const isWarn = c.status === "warn";
                return (
                  <div key={c.id} className="flex items-start gap-2.5 px-3 py-2.5">
                    <div className="pt-0.5 shrink-0">
                      {isOk ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight">{c.label}</div>
                      <div className={`text-xs mt-0.5 ${isOk ? "text-emerald-600" : isWarn ? "text-amber-600" : "text-red-600"}`}>
                        {c.hint}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── FAQ Schema preview ── */}
          {page.faq && page.faq.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                FAQ Schema · Rich Snippets ({page.faq.length})
              </h4>
              <div className="rounded-lg border divide-y max-h-[200px] overflow-y-auto">
                {page.faq.map((f, i) => (
                  <div key={i} className="px-3 py-2.5">
                    <div className="text-sm font-medium text-[#1a0dab] dark:text-blue-400">{f.question}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.answer}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t bg-muted/30 space-y-3">
          {page.status !== "published" && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Страница в статусе «{page.status}» — URL вернёт 404 пока не опубликована
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Закрыть</Button>
            {page.status === "published" ? (
              <Button asChild>
                <a href={realUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Открыть страницу
                </a>
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  setPublishing(true);
                  try {
                    await publishIntentPage(token, page.id);
                    toast.success("Опубликовано! Страница доступна по URL.");
                    onPublished();
                  } catch (err) {
                    toast.error(String(err));
                  } finally {
                    setPublishing(false);
                  }
                }}
                disabled={publishing}
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Публикуем…</>
                ) : (
                  <><Rocket className="w-4 h-4 mr-2" /> Опубликовать</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════
// ДИАЛОГ ГЕНЕРАЦИИ
// ══════════════════════════════════════════════════════════════════

function GenerateDialog({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const [intentType, setIntentType] = useState("question");
  const [entityA, setEntityA] = useState("");
  const [entityB, setEntityB] = useState("");
  const [locale, setLocale] = useState("en");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  // Search in the selected locale language so user sees their language names
  const searchLang = locale;

  const handleGenerate = async () => {
    if (!entityA.trim()) { toast.error("Укажите ингредиент / продукт"); return; }
    setGenerating(true);
    try {
      const r = await generateBatch(token, {
        intent_type: intentType,
        entity_a: entityA.trim().toLowerCase(),
        entity_b: entityB.trim().toLowerCase() || undefined,
        locale,
      });
      setResult(r);
      toast.success(`Создано: ${r.generated} · Пропущено: ${r.skipped} · Ошибок: ${r.errors}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Генерация SEO-пакета
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Тип интента</Label>
              <Select value={intentType} onValueChange={setIntentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="question">❓ Вопрос</SelectItem>
                  <SelectItem value="goal">🎯 Цель</SelectItem>
                  <SelectItem value="comparison">⚖️ Сравнение</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Язык</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                  <SelectItem value="ru">🇷🇺 Русский</SelectItem>
                  <SelectItem value="uk">🇺🇦 Українська</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Продукт / Ингредиент</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Введите 2+ буквы — появится список из базы</p>
            <IngredientAutocomplete
              value={entityA}
              lang={searchLang}
              onChange={(v) => setEntityA(v)}
              placeholder="напр. salmon, almonds, авокадо..."
              disabled={generating}
            />
          </div>
          {intentType === "comparison" && (
            <div>
              <Label>Сравнить с</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Введите 2+ буквы — появится список</p>
              <IngredientAutocomplete
                value={entityB}
                lang={searchLang}
                onChange={(v) => setEntityB(v)}
                placeholder="напр. cashews, tuna, масло оливы..."
                disabled={generating}
              />
            </div>
          )}
          {result && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm max-h-[200px] overflow-y-auto">
              <div className="font-medium">✅ {result.generated} создано · ⏭️ {result.skipped} пропущено · ❌ {result.errors} ошибок</div>
              {result.results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {r.status === "ok" ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : r.status === "skipped" ? <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" /> : <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
                  <span className="font-mono truncate">{r.page?.slug || r.sub_intent}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          {result ? (
            <Button onClick={onDone}>Готово</Button>
          ) : (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерация...</> : <><Zap className="w-4 h-4 mr-2" /> Сгенерировать</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════
// ДИАЛОГ НАСТРОЕК
// ══════════════════════════════════════════════════════════════════

function SettingsDialog({ token, settings, onClose, onSaved }: {
  token: string; settings: IntentPageSettings; onClose: () => void; onSaved: (s: IntentPageSettings) => void;
}) {
  const [limit, setLimit] = useState(String(settings.publish_limit_per_day));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseInt(limit, 10);
    if (isNaN(val) || val < 1) { toast.error("Лимит должен быть не менее 1"); return; }
    setSaving(true);
    try {
      const result = await updateIntentPageSettings(token, { publish_limit_per_day: val });
      onSaved(result);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Настройки планировщика</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Дневной лимит публикаций</Label>
            <Input type="number" min={1} max={1000} value={limit} onChange={(e) => setLimit(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Максимум страниц, которые планировщик опубликует за день</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════
// ПАНЕЛЬ ПРОСМОТРА / РЕДАКТИРОВАНИЯ (Sheet)
// ══════════════════════════════════════════════════════════════════

const IMAGE_KEY_LABELS: Record<string, string> = {
  hero: "🖼 Hero — главное фото",
  benefits: "💚 Benefits — польза",
  nutrition: "📊 Nutrition — калории",
  cooking: "🍳 Cooking — приготовление",
};

function ImageUploadSlot({ pageId, imageKey, src, alt, token, onUploaded }: {
  pageId: string; imageKey: string; src?: string; alt: string;
  token: string; onUploaded: (updated: IntentPage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(src || null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      const updated = await uploadImageToR2(token, pageId, imageKey, file);
      onUploaded(updated);
      toast.success(`Фото "${IMAGE_KEY_LABELS[imageKey] || imageKey}" загружено`);
    } catch (err) {
      toast.error("Ошибка загрузки: " + String(err));
      setPreview(src || null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{IMAGE_KEY_LABELS[imageKey] || imageKey}</span>
        {preview && <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 text-[10px]">✓</Badge>}
      </div>
      <div
        className={`relative group border-2 border-dashed rounded-xl overflow-hidden transition-colors cursor-pointer
          ${preview ? "border-emerald-300 dark:border-emerald-700" : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"}`}
        style={{ aspectRatio: imageKey === "hero" ? "16/9" : "4/3" }}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {preview ? (
          <>
            <img src={preview} alt={alt} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-white text-sm font-medium flex items-center gap-2">
                <Upload className="w-4 h-4" /> Заменить
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs text-center">Перетащите или нажмите</span>
              </>
            )}
          </div>
        )}
        {uploading && preview && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2">alt: {alt}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DetailDialog({ page: initialPage, token, onClose, onSaved }: {
  page: IntentPage; token: string; onClose: () => void; onSaved: () => void;
}) {
  const [page, setPage] = useState(initialPage);
  const [title, setTitle] = useState(page.title);
  const [description, setDescription] = useState(page.description);
  const [answer, setAnswer] = useState(page.answer);
  const [slug, setSlug] = useState(page.slug);
  const [priority, setPriority] = useState(String(page.priority));
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editableBlocks, setEditableBlocks] = useState<ContentBlock[]>(
    Array.isArray(page.content_blocks) ? page.content_blocks : []
  );

  const blocks: ContentBlock[] = editableBlocks;
  const imageBlocks = blocks.filter((b): b is ContentBlock & { type: "image" } => b.type === "image");

  const updateBlock = (index: number, changes: Partial<ContentBlock>) => {
    setEditableBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...changes } as ContentBlock : b));
  };

  const handleRegenerate = async () => {
    if (!confirm("Очистить AI-кеш и сгенерировать заново? Все фото будут удалены.")) return;
    setRegenerating(true);
    try {
      await regenerateIntentPage(token, page.id);
      toast.success("Страница перегенерирована с новой структурой (16 блоков + 4 фото)");
      onSaved();
    } catch (err) {
      toast.error("Ошибка перегенерации: " + String(err));
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateIntentPage(token, page.id, { title, description, answer, slug, priority: parseInt(priority, 10), content_blocks: editableBlocks });
      toast.success("Страница обновлена");
      onSaved();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUploaded = (updated: IntentPage) => {
    setPage(updated);
    // Merge uploaded image src back into editableBlocks
    if (Array.isArray(updated.content_blocks)) {
      setEditableBlocks(prev => prev.map(b => {
        if (b.type !== "image") return b;
        const fresh = (updated.content_blocks as ContentBlock[]).find(
          (u): u is ContentBlock & { type: "image" } => u.type === "image" && u.key === b.key
        );
        return fresh ? { ...b, src: fresh.src } : b;
      }));
    }
  };

  const uploadedCount = imageBlocks.filter(b => "src" in b && b.src).length;
  const totalImages = imageBlocks.length;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              {page.entity_a}
              <Badge variant="secondary" className={STATUS_CONFIG[page.status]?.color}>{STATUS_CONFIG[page.status]?.label}</Badge>
            </SheetTitle>
          </SheetHeader>
          <div className="flex items-center gap-2 mt-3">
            <Button onClick={handleSave} disabled={saving || regenerating} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Сохранить
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || saving}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                {regenerating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Перегенерировать
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── SEO-мета ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SEO Мета</h3>
            <div>
              <Label>Заголовок <span className={title.length >= 50 && title.length <= 60 ? "text-emerald-600" : title.length >= 40 ? "text-amber-600" : "text-red-500"}>({title.length}/60)</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Описание <span className={description.length >= 120 && description.length <= 155 ? "text-emerald-600" : description.length >= 100 ? "text-amber-600" : "text-red-500"}>({description.length}/155)</span></Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" />
              </div>
              <div>
                <Label>Приоритет</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">🔵 Низкий</SelectItem>
                    <SelectItem value="1">⚪ Обычный</SelectItem>
                    <SelectItem value="2">🔴 Высокий</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Ответ ── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Контент</h3>
            <div>
              <Label>Ответ <span className={answer.length >= 400 && answer.length <= 800 ? "text-emerald-600" : answer.length >= 200 ? "text-amber-600" : "text-red-500"}>({answer.length} симв)</span></Label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="mt-1 w-full text-sm bg-muted/30 rounded-lg p-3 min-h-[120px] max-h-[250px] border resize-y"
                placeholder="Ответ на вопрос пользователя (4-6 предложений, 400-800 символов)..."
              />
            </div>
          </section>

          <Separator />

          {/* ── Фото для статьи ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Фото для статьи</h3>
              <Badge variant="secondary" className={uploadedCount === totalImages && totalImages > 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}>
                {uploadedCount}/{totalImages}
              </Badge>
            </div>
            {imageBlocks.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {imageBlocks.map((block) => (
                  <ImageUploadSlot
                    key={block.key}
                    pageId={page.id}
                    imageKey={block.key}
                    src={block.src}
                    alt={block.alt}
                    token={token}
                    onUploaded={handleImageUploaded}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground text-sm">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Нет блоков с фото. Перегенерируйте страницу — AI создаст блоки с фото.
              </div>
            )}
          </section>

          <Separator />

          {/* ── Превью блоков ── */}
          {blocks.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Превью статьи ({blocks.length} блоков)</h3>
              <div className="bg-muted/20 rounded-lg p-4 space-y-3 text-sm">
                {blocks.map((block, i) => {
                  if (block.type === "heading") return (
                    <div key={i} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        H{block.level}
                      </span>
                      <input
                        value={block.text}
                        onChange={(e) => updateBlock(i, { text: e.target.value })}
                        className={`w-full bg-background border rounded px-2 py-1 ${block.level === 1 ? "text-base font-bold" : "text-sm font-semibold"}`}
                      />
                    </div>
                  );
                  if (block.type === "text") return (
                    <div key={i} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Текст</span>
                      <textarea
                        value={block.content}
                        onChange={(e) => updateBlock(i, { content: e.target.value })}
                        rows={Math.max(3, Math.ceil(block.content.length / 80))}
                        className="w-full bg-background border rounded px-2 py-1 text-sm text-muted-foreground leading-relaxed resize-y"
                      />
                    </div>
                  );
                  if (block.type === "image") return (
                    <div key={i} className="flex items-center gap-2 py-1 text-xs text-muted-foreground border border-dashed rounded px-2">
                      <ImageIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="font-mono">[{block.key}]</span>
                      {block.src ? (
                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 text-[10px]">✓ загружено</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 text-[10px]">⬆ нужно фото</Badge>
                      )}
                    </div>
                  );
                  return null;
                })}
              </div>
            </section>
          )}

          <Separator />

          {/* ── FAQ ── */}
          {page.faq && page.faq.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">FAQ ({page.faq.length})</h3>
              <div className="space-y-2">
                {page.faq.map((f, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-3 text-sm">
                    <div className="font-medium">{f.question}</div>
                    <div className="text-muted-foreground mt-1 text-xs">{f.answer}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Мета-инфо ── */}
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground pb-4">
            <div><span className="font-medium">Язык:</span> {LOCALE_FLAGS[page.locale]} {page.locale}</div>
            <div><span className="font-medium">Тип:</span> {INTENT_LABELS[page.intent_type] || page.intent_type}</div>
            <div><span className="font-medium">Создано:</span> {new Date(page.created_at).toLocaleDateString("ru-RU")}</div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ══════════════════════════════════════════════════════════════════
// LAB COMBOS SECTION — SEO страницы комбинаций ингредиентов
// ══════════════════════════════════════════════════════════════════

const COMBO_BLOG_BASE = "https://dima-fomin.pl";

function LabCombosSection({
  token,
  router,
}: {
  token: string | null;
  router: ReturnType<typeof import("next/navigation").useRouter>;
}) {
  const [combos, setCombos] = useState<LabComboPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getLabCombos(token, { limit: 100 })
      .then(setCombos)
      .catch(() => toast.error("Ошибка загрузки Lab Combos"))
      .finally(() => setLoading(false));
  }, [token]);

  const published = combos.filter((c) => c.status === "published");
  const draft     = combos.filter((c) => c.status === "draft");

  return (
    <div className="space-y-4 pt-2">
      {/* Заголовок секции */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-5 w-1 rounded-full bg-violet-500" />
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              🧪 Lab Combo Pages
              <Badge className="bg-violet-500/10 text-violet-600 border-none text-[10px] font-bold uppercase tracking-widest">
                {combos.length} страниц
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Готовые SEO-страницы комбинаций ингредиентов — чистые URL для Google
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Published: <strong className="text-foreground">{published.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              Draft: <strong className="text-foreground">{draft.length}</strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-xs"
            onClick={() => router.push("/lab-combos")}
          >
            Управление →
          </Button>
        </div>
      </div>

      {/* Таблица */}
      <Card className="rounded-2xl border border-border/40 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Загрузка...</span>
            </div>
          ) : combos.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Нет страниц. Перейдите в <button onClick={() => router.push("/lab-combos")} className="text-primary underline">Lab Combos</button> для генерации.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Slug / URL</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Locale</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Goal</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Meal</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Score</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Статус</th>
                  <th className="text-left py-3 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Создано</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {combos.map((combo) => {
                  const url = `${COMBO_BLOG_BASE}/${combo.locale}/lab/${combo.slug}`;
                  return (
                    <tr key={combo.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="font-mono text-xs text-primary font-semibold truncate max-w-[280px]">
                          /{combo.locale}/lab/{combo.slug}
                        </div>
                        <div className="text-[11px] text-muted-foreground/60 truncate max-w-[280px] mt-0.5">
                          {combo.title || "—"}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-base">{LOCALE_FLAGS[combo.locale] ?? combo.locale}</span>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="secondary" className="text-[10px] font-medium rounded-md capitalize">
                          {combo.goal ?? "—"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground capitalize">
                        {combo.meal_type ?? "—"}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`text-xs font-bold tabular-nums ${combo.quality_score >= 80 ? "text-emerald-500" : combo.quality_score >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {combo.quality_score}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <Badge className={`text-[10px] font-semibold rounded-md border ${
                          combo.status === "published"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : combo.status === "archived"
                            ? "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                            : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        }`}>
                          {combo.status === "published" ? "✅ Published" : combo.status === "archived" ? "📦 Archived" : "📝 Draft"}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(combo.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {combo.status === "published" && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Открыть в блоге"
                            >
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg">
                                <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 rounded-lg"
                            title="Управление"
                            onClick={() => router.push("/lab-combos")}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
