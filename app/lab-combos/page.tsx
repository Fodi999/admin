"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getLabCombos,
  generateCombo,
  generatePopularCombos,
  publishCombo,
  archiveCombo,
  deleteCombo,
  updateCombo,
  getComboImageUploadUrl,
  saveComboImageUrl,
  getTypedImageUploadUrl,
  saveTypedImageUrl,
  type LabComboPage,
  type GenerateComboRequest,
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
  Pencil,
  Save,
  X,
  ImageIcon,
  Upload,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const LOCALES = ["en", "ru", "pl", "uk"];
const GOALS = ["high_protein", "low_carb", "keto", "weight_loss", "muscle_gain", "energy_boost", "balanced"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];
const DIETS = ["vegetarian", "vegan", "gluten_free"];
const COOKING_TIMES = ["quick", "medium", "long"];
const BUDGETS = ["cheap", "premium"];
const CUISINES = ["italian", "asian", "mexican"];
const AI_MODELS = [
  { value: "flash", label: "⚡ Flash (быстрый)" },
  { value: "pro", label: "🧠 Pro (точный SEO)" },
];

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

  // Generate dialog
  const [showGenerate, setShowGenerate] = useState(false);
  const [genIngredientsText, setGenIngredientsText] = useState("");
  const [genLocale, setGenLocale] = useState("en");
  const [genGoal, setGenGoal] = useState<string>("");
  const [genMealType, setGenMealType] = useState<string>("");
  const [genDiet, setGenDiet] = useState<string>("");
  const [genCookingTime, setGenCookingTime] = useState<string>("");
  const [genBudget, setGenBudget] = useState<string>("");
  const [genCuisine, setGenCuisine] = useState<string>("");
  const [genModel, setGenModel] = useState<string>("pro");
  const [generating, setGenerating] = useState(false);

  // Popular combos generation
  const [generatingPopular, setGeneratingPopular] = useState(false);
  const [popularLocale, setPopularLocale] = useState("en");

  // Action loading states
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Detail dialog
  const [detailCombo, setDetailCombo] = useState<LabComboPage | null>(null);

  // Edit mode inside detail dialog
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editH1, setEditH1] = useState("");
  const [editIntro, setEditIntro] = useState("");
  const [editWhyItWorks, setEditWhyItWorks] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Image upload state
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  const startEditing = (combo: LabComboPage) => {
    setEditTitle(combo.title);
    setEditDescription(combo.description);
    setEditH1(combo.h1);
    setEditIntro(combo.intro);
    setEditWhyItWorks(combo.why_it_works || "");
    setEditImageUrl(combo.image_url || "");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!token || !detailCombo) return;
    setSaving(true);
    try {
      const updated = await updateCombo(token, detailCombo.id, {
        title: editTitle,
        description: editDescription,
        h1: editH1,
        intro: editIntro,
        why_it_works: editWhyItWorks,
        ...(editImageUrl ? { image_url: editImageUrl } : {}),
      });
      setDetailCombo(updated);
      setEditing(false);
      toast.success("Сохранено!");
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка сохранения", { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!token || !detailCombo) return;
    setImageUploading(true);
    setUploadingKind("hero");
    try {
      const { upload_url, public_url } = await getComboImageUploadUrl(token, detailCombo.id, file.type || "image/webp");
      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/webp" },
        body: file,
      });
      const updated = await saveComboImageUrl(token, detailCombo.id, public_url);
      setDetailCombo(updated);
      toast.success("Фото загружено!");
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setImageUploading(false);
      setUploadingKind(null);
    }
  };

  const handleTypedImageUpload = async (file: File, kind: "process" | "detail") => {
    if (!token || !detailCombo) return;
    setImageUploading(true);
    setUploadingKind(kind);
    try {
      const { upload_url, public_url } = await getTypedImageUploadUrl(token, detailCombo.id, kind, file.type || "image/webp");
      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/webp" },
        body: file,
      });
      const updated = await saveTypedImageUrl(token, detailCombo.id, kind, public_url);
      setDetailCombo(updated);
      toast.success(`${kind === "process" ? "Процесс" : "Детали"} — фото загружено!`);
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setImageUploading(false);
      setUploadingKind(null);
    }
  };

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

  // ── Generate single combo ─────────────────────────────────────────

  const handleGenerate = async () => {
    if (!token || !genIngredientsText.trim()) return;
    setGenerating(true);
    try {
      const ingredients = genIngredientsText
        .split(/[,\n]+/)
        .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean);

      if (ingredients.length === 0) {
        toast.error("Введите хотя бы 1 ингредиент");
        return;
      }

      const req: GenerateComboRequest = {
        ingredients,
        locale: genLocale,
        ...(genGoal && { goal: genGoal }),
        ...(genMealType && { meal_type: genMealType }),
        ...(genDiet && { diet: genDiet }),
        ...(genCookingTime && { cooking_time: genCookingTime }),
        ...(genBudget && { budget: genBudget }),
        ...(genCuisine && { cuisine: genCuisine }),
        model: genModel,
      };

      const page = await generateCombo(token, req);
      toast.success("Combo создан!", { description: page.slug });
      setShowGenerate(false);
      resetGenForm();
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка генерации", { description: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  const resetGenForm = () => {
    setGenIngredientsText("");
    setGenGoal("");
    setGenMealType("");
    setGenDiet("");
    setGenCookingTime("");
    setGenBudget("");
    setGenCuisine("");
    setGenModel("pro");
  };

  // ── Generate popular ──────────────────────────────────────────────

  const handleGeneratePopular = async () => {
    if (!token) return;
    setGeneratingPopular(true);
    try {
      const result = await generatePopularCombos(token, { locale: popularLocale, limit: 14 });
      toast.success(`Сгенерировано: ${result.generated} combo`, {
        description: result.details.slice(0, 5).join("\n"),
      });
      await loadCombos();
    } catch (err: unknown) {
      toast.error("Ошибка генерации популярных", { description: String(err) });
    } finally {
      setGeneratingPopular(false);
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
          <Button size="sm" onClick={() => setShowGenerate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Создать Combo
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
            <Select value={popularLocale} onValueChange={setPopularLocale}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Создать 14 популярных Combo
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
              onClick={() => setDetailCombo(combo)}
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
                          href={`${BLOG_BASE}/${combo.locale}/chef-tools/lab/combo/${combo.slug}`}
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
                              href={`${BLOG_BASE}/${combo.locale}/chef-tools/lab/combo/${combo.slug}`}
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

      {/* ── Detail / Preview / Edit Drawer ──────────────────────────── */}
      <Sheet open={!!detailCombo} onOpenChange={(open) => { if (!open) { setDetailCombo(null); setEditing(false); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-4 sm:px-6">
          {detailCombo && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  {editing ? "Редактирование" : "Детали Combo"}
                  <Badge className={`ml-2 text-[10px] ${STATUS_COLORS[detailCombo.status]}`}>
                    {detailCombo.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {detailCombo.locale.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Score: {detailCombo.quality_score}/5
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 text-sm pb-6">
                {/* Slug & Link */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ссылка</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 break-all">
                      /chef-tools/lab/combo/{detailCombo.slug}
                    </code>
                    {detailCombo.status === "published" && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`${BLOG_BASE}/${detailCombo.locale}/chef-tools/lab/combo/${detailCombo.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Открыть
                        </a>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Images — Hero / Process / Detail */}
                <div className="space-y-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Изображения (Hero · Process · Detail)</p>

                  {/* Hero Image */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">🖼️ Hero (готовое блюдо)</span>
                      <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer px-2 py-1 rounded-lg border border-dashed transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:text-primary"}`}>
                        {uploadingKind === "hero" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {uploadingKind === "hero" ? "…" : "Загрузить"}
                        <input type="file" accept="image/*" className="hidden" disabled={imageUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }} />
                      </label>
                    </div>
                    {editing ? (
                      <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." className="text-xs" />
                    ) : detailCombo.image_url ? (
                      <img src={detailCombo.image_url} alt="Hero" className="w-full max-h-36 object-cover rounded-xl border" />
                    ) : (
                      <div className="flex items-center justify-center h-16 rounded-xl border border-dashed bg-muted/20 text-muted-foreground/40 text-xs">нет Hero</div>
                    )}
                  </div>

                  {/* Process Image */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">🔥 Process (процесс готовки)</span>
                      <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer px-2 py-1 rounded-lg border border-dashed transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:text-primary"}`}>
                        {uploadingKind === "process" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {uploadingKind === "process" ? "…" : "Загрузить"}
                        <input type="file" accept="image/*" className="hidden" disabled={imageUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTypedImageUpload(f, "process"); e.target.value = ""; }} />
                      </label>
                    </div>
                    {detailCombo.process_image_url ? (
                      <img src={detailCombo.process_image_url} alt="Process" className="w-full max-h-36 object-cover rounded-xl border" />
                    ) : (
                      <div className="flex items-center justify-center h-16 rounded-xl border border-dashed bg-muted/20 text-muted-foreground/40 text-xs">нет Process</div>
                    )}
                  </div>

                  {/* Detail Image */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">🥑 Detail (ингредиенты / текстура)</span>
                      <label className={`flex items-center gap-1.5 text-[11px] cursor-pointer px-2 py-1 rounded-lg border border-dashed transition-colors ${imageUploading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:text-primary"}`}>
                        {uploadingKind === "detail" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {uploadingKind === "detail" ? "…" : "Загрузить"}
                        <input type="file" accept="image/*" className="hidden" disabled={imageUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleTypedImageUpload(f, "detail"); e.target.value = ""; }} />
                      </label>
                    </div>
                    {detailCombo.detail_image_url ? (
                      <img src={detailCombo.detail_image_url} alt="Detail" className="w-full max-h-36 object-cover rounded-xl border" />
                    ) : (
                      <div className="flex items-center justify-center h-16 rounded-xl border border-dashed bg-muted/20 text-muted-foreground/40 text-xs">нет Detail</div>
                    )}
                  </div>
                </div>

                {/* Ingredients */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Ингредиенты</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailCombo.ingredients.map((ing) => (
                      <span key={ing} className="inline-block px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">{ing}</span>
                    ))}
                  </div>
                </div>

                {/* 6D Context */}
                {(detailCombo.goal || detailCombo.meal_type || detailCombo.diet || detailCombo.cooking_time || detailCombo.budget || detailCombo.cuisine) && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Контекст 6D</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailCombo.goal && <Badge variant="secondary">🎯 {detailCombo.goal.replace(/_/g, " ")}</Badge>}
                      {detailCombo.meal_type && <Badge variant="secondary">🍽️ {detailCombo.meal_type}</Badge>}
                      {detailCombo.diet && <Badge variant="secondary">🥗 {detailCombo.diet.replace(/_/g, " ")}</Badge>}
                      {detailCombo.cooking_time && <Badge variant="secondary">⏱️ {detailCombo.cooking_time}</Badge>}
                      {detailCombo.budget && <Badge variant="secondary">💰 {detailCombo.budget}</Badge>}
                      {detailCombo.cuisine && <Badge variant="secondary">🌍 {detailCombo.cuisine}</Badge>}
                    </div>
                  </div>
                )}

                {/* SEO Metadata — editable or view */}
                <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SEO-метаданные</p>
                    {!editing && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEditing(detailCombo)}>
                        <Pencil className="h-3 w-3 mr-1" /> Редактировать
                      </Button>
                    )}
                  </div>

                  {editing ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Заголовок <span className="text-muted-foreground/50">({editTitle.length}/60)</span></p>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Описание <span className="text-muted-foreground/50">({editDescription.length}/155)</span></p>
                        <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="text-xs" rows={3} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">H1</p>
                        <Input value={editH1} onChange={(e) => setEditH1(e.target.value)} className="text-xs" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Вступление</p>
                        <Textarea value={editIntro} onChange={(e) => setEditIntro(e.target.value)} className="text-xs" rows={4} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Почему это работает</p>
                        <Textarea value={editWhyItWorks} onChange={(e) => setEditWhyItWorks(e.target.value)} className="text-xs" rows={4} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Заголовок</p>
                        <p className="font-semibold">{detailCombo.title}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Описание</p>
                        <p className="text-muted-foreground">{detailCombo.description}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">H1</p>
                        <p className="font-bold text-base">{detailCombo.h1}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">Вступление</p>
                        <p className="text-muted-foreground">{detailCombo.intro}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Why It Works (view only — shown when not editing) */}
                {!editing && detailCombo.why_it_works && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Почему это работает</p>
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                      <p className="text-sm text-foreground/90">{detailCombo.why_it_works}</p>
                    </div>
                  </div>
                )}

                {/* How to Cook */}
                {Array.isArray(detailCombo.how_to_cook) && detailCombo.how_to_cook.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Как готовить ({detailCombo.how_to_cook.length} шагов)
                    </p>
                    <div className="space-y-1.5">
                      {detailCombo.how_to_cook.map((step, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                            {step.step}
                          </span>
                          <p className="text-foreground/80 flex-1">{step.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimization Tips */}
                {Array.isArray(detailCombo.optimization_tips) && detailCombo.optimization_tips.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Советы по оптимизации ({detailCombo.optimization_tips.length})
                    </p>
                    <div className="space-y-1">
                      {detailCombo.optimization_tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span>{tip.icon}</span>
                          <span className="text-foreground/80">
                            {tip.ingredient && <strong className="text-primary mr-1">{tip.ingredient}</strong>}
                            {tip.tip}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FAQ */}
                {Array.isArray(detailCombo.faq) && detailCombo.faq.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      FAQ ({detailCombo.faq.length} вопросов)
                    </p>
                    <div className="space-y-2">
                      {detailCombo.faq.map((item, i) => (
                        <div key={i} className="border rounded-lg p-3 bg-muted/10">
                          <p className="font-semibold text-xs">{item.question}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SmartResponse preview */}
                <details className="group">
                  <summary className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer">
                    SmartResponse (JSON) ▾
                  </summary>
                  <pre className="text-[10px] bg-muted/40 rounded-lg p-3 overflow-auto max-h-64 font-mono whitespace-pre-wrap break-all mt-2">
                    {JSON.stringify(detailCombo.smart_response, null, 2)}
                  </pre>
                </details>

                {/* Timestamps */}
                <div className="flex gap-6 text-[10px] text-muted-foreground/60">
                  <span>Создано: {new Date(detailCombo.created_at).toLocaleString()}</span>
                  <span>Обновлено: {new Date(detailCombo.updated_at).toLocaleString()}</span>
                  {detailCombo.published_at && (
                    <span>Опубликовано: {new Date(detailCombo.published_at).toLocaleString()}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <SheetFooter className="flex-row gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Сохранить
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                        <X className="h-4 w-4 mr-1" /> Отмена
                      </Button>
                    </>
                  ) : (
                    <>
                      {detailCombo.status !== "published" && (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (!token) return;
                            doAction(detailCombo.id, () => publishCombo(token, detailCombo.id), "Опубликовано!");
                            setDetailCombo(null);
                          }}
                          disabled={actionLoading[detailCombo.id]}
                        >
                          <ArrowUpCircle className="h-4 w-4 mr-1" /> Опубликовать
                        </Button>
                      )}
                      {detailCombo.status !== "archived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!token) return;
                            doAction(detailCombo.id, () => archiveCombo(token, detailCombo.id), "В архиве!");
                            setDetailCombo(null);
                          }}
                          disabled={actionLoading[detailCombo.id]}
                        >
                          <Archive className="h-4 w-4 mr-1" /> В архив
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {!editing && detailCombo.status === "published" && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={`${BLOG_BASE}/${detailCombo.locale}/chef-tools/lab/combo/${detailCombo.slug}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> На сайт
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setDetailCombo(null); setEditing(false); }}>
                    Закрыть
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Generate Drawer ──────────────────────────────────────────── */}
      <Sheet open={showGenerate} onOpenChange={setShowGenerate}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto px-4 sm:px-6">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Создать Combo-страницу
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            {/* Ingredients */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Ингредиенты (по одному на строке или через запятую)
              </label>
              <Textarea
                placeholder={"salmon\nrice\navocado"}
                value={genIngredientsText}
                onChange={(e) => setGenIngredientsText(e.target.value)}
                className="font-mono text-sm"
                rows={4}
              />
            </div>

            {/* Locale */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Язык</label>
                <Select value={genLocale} onValueChange={setGenLocale}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((l) => (
                      <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Цель</label>
                <Select value={genGoal || "__none__"} onValueChange={(v) => setGenGoal(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Нет</SelectItem>
                    {GOALS.map((g) => (
                      <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Приём пищи</label>
                <Select value={genMealType || "__none__"} onValueChange={(v) => setGenMealType(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Нет</SelectItem>
                    {MEAL_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Диета</label>
                <Select value={genDiet || "__none__"} onValueChange={(v) => setGenDiet(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Нет" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Нет</SelectItem>
                    {DIETS.map((d) => (
                      <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Время</label>
                <Select value={genCookingTime || "__none__"} onValueChange={(v) => setGenCookingTime(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Любое" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любое</SelectItem>
                    {COOKING_TIMES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Бюджет</label>
                <Select value={genBudget || "__none__"} onValueChange={(v) => setGenBudget(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Любой" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любой</SelectItem>
                    {BUDGETS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Кухня</label>
                <Select value={genCuisine || "__none__"} onValueChange={(v) => setGenCuisine(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Любая" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любая</SelectItem>
                    {CUISINES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Model */}
            <div>
              <label className="text-sm font-medium mb-1 block">🤖 AI Модель</label>
              <Select value={genModel} onValueChange={setGenModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Pro: точные числа (белок, ккал), лучшие SEO-тексты. Flash: быстрее, для тестов.
              </p>
            </div>
          </div>

          <SheetFooter className="flex-row gap-2 pt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowGenerate(false)}>
              Отмена
            </Button>
            <Button className="flex-1 rounded-xl" onClick={handleGenerate} disabled={generating || !genIngredientsText.trim()}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Создать
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
