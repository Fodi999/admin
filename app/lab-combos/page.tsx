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
  const [generating, setGenerating] = useState(false);

  // Popular combos generation
  const [generatingPopular, setGeneratingPopular] = useState(false);
  const [popularLocale, setPopularLocale] = useState("en");

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
            Lab Combo SEO Pages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prerendered SEO pages for ingredient combos — clean URLs for Google
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadCombos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowGenerate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Generate Combo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-card/50 backdrop-blur">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-yellow-600">{stats.draft}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Draft</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-emerald-600">{stats.published}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Published</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-500/5 border-zinc-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-zinc-500">{stats.archived}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Archived</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">{stats.avgScore}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card/50 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Rocket className="h-4 w-4" /> Quick:
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
              Generate 14 Popular Combos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by slug, title, ingredient..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocale} onValueChange={setFilterLocale}>
          <SelectTrigger className="w-28 h-9">
            <Globe className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Locale" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {LOCALES.map((l) => (
              <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-9 px-3 text-xs">
          {filtered.length} pages
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
            <p className="text-lg font-semibold text-muted-foreground">No combo pages yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Click &quot;Generate Combo&quot; or &quot;Generate 14 Popular Combos&quot; to start
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((combo) => (
            <Card key={combo.id} className="bg-card/50 backdrop-blur hover:bg-card/80 transition-colors">
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
                  <div className="flex items-center gap-1 shrink-0">
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
                              doAction(combo.id, () => publishCombo(token, combo.id), "Published!")
                            }
                            disabled={actionLoading[combo.id]}
                          >
                            <ArrowUpCircle className="h-4 w-4 mr-2 text-emerald-500" />
                            Publish
                          </DropdownMenuItem>
                        )}
                        {combo.status !== "archived" && (
                          <DropdownMenuItem
                            onClick={() =>
                              token &&
                              doAction(combo.id, () => archiveCombo(token, combo.id), "Archived!")
                            }
                            disabled={actionLoading[combo.id]}
                          >
                            <Archive className="h-4 w-4 mr-2 text-zinc-500" />
                            Archive
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
                              View on site
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            token &&
                            doAction(combo.id, () => deleteCombo(token, combo.id), "Deleted!")
                          }
                          disabled={actionLoading[combo.id]}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
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

      {/* ── Generate Dialog ──────────────────────────────────────────── */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Generate Combo Page
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Ingredients */}
            <div>
              <label className="text-sm font-medium mb-1 block">
                Ingredients (one per line or comma-separated)
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
                <label className="text-sm font-medium mb-1 block">Locale</label>
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
                <label className="text-sm font-medium mb-1 block">Goal</label>
                <Select value={genGoal} onValueChange={setGenGoal}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {GOALS.map((g) => (
                      <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Meal Type</label>
                <Select value={genMealType} onValueChange={setGenMealType}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {MEAL_TYPES.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Diet</label>
                <Select value={genDiet} onValueChange={setGenDiet}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {DIETS.map((d) => (
                      <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Time</label>
                <Select value={genCookingTime} onValueChange={setGenCookingTime}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {COOKING_TIMES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Budget</label>
                <Select value={genBudget} onValueChange={setGenBudget}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {BUDGETS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cuisine</label>
                <Select value={genCuisine} onValueChange={setGenCuisine}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any</SelectItem>
                    {CUISINES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !genIngredientsText.trim()}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
