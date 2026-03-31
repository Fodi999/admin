"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getLabCombos,
  updateCombo,
  publishCombo,
  archiveCombo,
  deleteCombo,
  getComboImageUploadUrl,
  saveComboImageUrl,
  getTypedImageUploadUrl,
  saveTypedImageUrl,
  backfillStructuredIngredients,
  type LabComboPage,
} from "@/lib/lab-combos-api";
import {
  searchProducts,
  getProduct,
  type SearchProductResult,
} from "@/lib/admin-api";

import {
  ArrowLeft,
  Save,
  Loader2,
  Upload,
  ExternalLink,
  ArrowUpCircle,
  Archive,
  Trash2,
  FlaskConical,
  ImageIcon,
  Check,
  Globe,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Lock,
  Unlock,
  Search,
  X,
  RefreshCw,
  Lightbulb,
  Settings2,
  Copy,
  Pencil,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ══════════════════════════════════════════════════════════════════════
// TYPES — DishState (single source of truth)
// ══════════════════════════════════════════════════════════════════════

interface DishIngredient {
  slug: string;
  name: string;
  grams: number; // base grams (×1)
  kcal_per_100: number;
  protein_per_100: number;
  fat_per_100: number;
  carbs_per_100: number;
  image_url: string | null;
  product_type: string | null;
  locked: boolean;
}

interface DishContext {
  vegetarian: boolean;
  quick: boolean;
  cheap: boolean;
  cuisine: string;
  goal: string;
}

interface DishState {
  ingredients: DishIngredient[];
  context: DishContext;
  multiplier: number;
}

// ══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════

const BLOG_BASE = "https://dima-fomin.pl";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const GOALS = [
  "balanced",
  "high_protein",
  "low_carb",
  "low_fat",
  "keto",
  "bulking",
];
const CUISINES = [
  "any",
  "asian",
  "mediterranean",
  "mexican",
  "american",
  "italian",
  "japanese",
  "french",
];

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

function typeEmoji(pt: string | null): string {
  const map: Record<string, string> = {
    seafood: "🐟",
    meat: "🥩",
    poultry: "🍗",
    dairy: "🧀",
    egg: "🥚",
    grain: "🌾",
    bread: "🍞",
    legume: "🫘",
    vegetable: "🥬",
    fruit: "🍎",
    nut: "🥜",
    oil: "🫒",
    spice: "🌶️",
    condiment: "🥢",
    sauce: "🥫",
    mushroom: "🍄",
    sweetener: "🍯",
    beverage: "🥤",
  };
  return map[pt ?? ""] ?? "🍽️";
}

function roleLabel(pt: string | null): string {
  const map: Record<string, string> = {
    seafood: "🥩 Белок",
    meat: "🥩 Белок",
    poultry: "🥩 Белок",
    dairy: "🥛 Молочные",
    egg: "🥚 Яйца",
    grain: "🌾 Углеводы",
    bread: "🍞 Углеводы",
    legume: "🫘 Бобовые",
    vegetable: "🥬 Овощи",
    fruit: "🍎 Фрукты",
    nut: "🥜 Орехи",
    oil: "🫒 Жиры",
    spice: "🧂 Специи",
    condiment: "🧂 Специи",
    sauce: "🍶 Соусы",
    mushroom: "🍄 Грибы",
  };
  return map[pt ?? ""] ?? "🍽️ Прочее";
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultPortionGrams(pt: string | null): number {
  const map: Record<string, number> = {
    seafood: 150,
    meat: 150,
    poultry: 150,
    dairy: 100,
    egg: 60,
    grain: 80,
    bread: 80,
    legume: 80,
    vegetable: 120,
    fruit: 100,
    nut: 30,
    oil: 15,
    spice: 10,
    condiment: 10,
    sauce: 10,
    mushroom: 80,
    sweetener: 15,
    beverage: 200,
  };
  return map[pt ?? ""] ?? 100;
}

/** Build DishState from combo data */
function buildDishState(combo: LabComboPage): DishState {
  const ingredients: DishIngredient[] = (
    combo.structured_ingredients ?? []
  ).map((si) => ({
    slug: si.slug,
    name: si.name,
    grams: si.grams,
    kcal_per_100:
      si.grams > 0 && si.kcal > 0
        ? Math.round((si.kcal / si.grams) * 100)
        : 0,
    protein_per_100:
      si.grams > 0 && si.protein > 0
        ? +((si.protein / si.grams) * 100).toFixed(1)
        : 0,
    fat_per_100:
      si.grams > 0 && si.fat > 0
        ? +((si.fat / si.grams) * 100).toFixed(1)
        : 0,
    carbs_per_100:
      si.grams > 0 && si.carbs > 0
        ? +((si.carbs / si.grams) * 100).toFixed(1)
        : 0,
    image_url: si.image_url,
    product_type: si.product_type,
    locked: false,
  }));

  return {
    ingredients,
    context: {
      vegetarian: combo.diet === "vegetarian",
      quick: combo.cooking_time === "quick",
      cheap: combo.budget === "cheap",
      cuisine: combo.cuisine ?? "any",
      goal: combo.goal ?? "balanced",
    },
    multiplier: 1,
  };
}

/** Compute totals from DishState */
function computeTotals(dish: DishState) {
  return dish.ingredients.reduce(
    (acc, ing) => {
      const g = ing.grams * dish.multiplier;
      const factor = g / 100;
      return {
        grams: acc.grams + g,
        kcal: acc.kcal + ing.kcal_per_100 * factor,
        protein: acc.protein + ing.protein_per_100 * factor,
        fat: acc.fat + ing.fat_per_100 * factor,
        carbs: acc.carbs + ing.carbs_per_100 * factor,
      };
    },
    { grams: 0, kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

/** Replace ingredient grams in step text to match DishState */
function syncStepText(
  text: string,
  ingredients: DishIngredient[],
  multiplier: number,
): string {
  let result = text;
  for (const ing of ingredients) {
    const g = Math.round(ing.grams * multiplier);
    // Match "IngredientName (NNNg)" or "IngredientName (NNNг)"
    const pat = new RegExp(
      `(${escapeRegex(ing.name)}\\s*\\()\\d+\\s*[gг](\\))`,
      "gi",
    );
    result = result.replace(pat, `$1${g}г$2`);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════

function ImageBlock({
  label,
  emoji,
  imageUrl,
  uploading,
  onUpload,
}: {
  label: string;
  emoji: string;
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <span>{emoji}</span> {label}
        </Label>
        <label
          className={`flex items-center gap-1.5 text-xs cursor-pointer px-3 py-1.5 rounded-lg border border-dashed transition-colors ${
            uploading
              ? "opacity-50 pointer-events-none"
              : "hover:border-primary hover:text-primary"
          }`}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Загрузка…" : "Загрузить"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className="w-full max-h-56 object-cover rounded-xl border"
        />
      ) : (
        <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed bg-muted/20 text-muted-foreground/40 text-sm gap-2">
          <ImageIcon className="h-5 w-5" />
          нет фото
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 pb-5 px-4 space-y-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function MultiplierControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
      {[1, 2, 3, 4].map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
            value === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          ×{m}
        </button>
      ))}
    </div>
  );
}

function InlineIngredientSearch({
  token,
  onAdd,
}: {
  token: string;
  onAdd: (ing: DishIngredient) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await searchProducts(token, query.trim());
        setResults(hits.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, token]);

  const handleAdd = async (hit: SearchProductResult) => {
    try {
      const full = await getProduct(token, hit.id);
      const dg = defaultPortionGrams(hit.product_type);
      onAdd({
        slug: hit.slug || hit.name_en.toLowerCase().replace(/\s+/g, "-"),
        name: hit.name_ru || hit.name_en,
        grams: dg,
        kcal_per_100: full.calories_per_100g ?? 0,
        protein_per_100: full.protein_per_100g
          ? parseFloat(String(full.protein_per_100g))
          : 0,
        fat_per_100: full.fat_per_100g
          ? parseFloat(String(full.fat_per_100g))
          : 0,
        carbs_per_100: full.carbs_per_100g
          ? parseFloat(String(full.carbs_per_100g))
          : 0,
        image_url: hit.image_url,
        product_type: hit.product_type,
        locked: false,
      });
      setQuery("");
      setResults([]);
      setOpen(false);
    } catch {
      toast.error("Не удалось загрузить продукт");
    }
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 border-dashed"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Добавить ингредиент
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="salmon, лосось..."
          className="pl-8 h-9 text-sm"
          autoFocus
        />
        <button
          onClick={() => {
            setOpen(false);
            setQuery("");
            setResults([]);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      {searching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Поиск...
        </div>
      )}
      {results.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-lg border divide-y">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex items-center gap-2 w-full px-2.5 py-2 text-left hover:bg-accent transition text-xs"
              onClick={() => handleAdd(r)}
            >
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt=""
                  className="w-6 h-6 rounded object-cover shrink-0"
                />
              ) : (
                <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs shrink-0">
                  {typeEmoji(r.product_type)}
                </span>
              )}
              <span className="font-medium truncate flex-1">
                {r.name_ru || r.name_en}
              </span>
              <Plus className="h-3 w-3 text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Render step text with clickable ingredient badges
// ══════════════════════════════════════════════════════════════════════

function renderStepWithIngredients(
  text: string,
  ingredients: DishIngredient[],
  onIngredientClick: (slug: string) => void,
): React.ReactNode {
  if (ingredients.length === 0) return text;

  const sorted = [...ingredients].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const pattern = sorted.map((i) => escapeRegex(i.name)).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const match = sorted.find(
      (ing) => ing.name.toLowerCase() === part.toLowerCase(),
    );
    if (match) {
      return (
        <button
          key={i}
          type="button"
          onClick={() => onIngredientClick(match.slug)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition cursor-pointer mx-0.5"
        >
          {typeEmoji(match.product_type)} {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ══════════════════════════════════════════════════════════════════════
// Tip Action Card
// ══════════════════════════════════════════════════════════════════════

function TipActionCard({
  tip,
  onApply,
}: {
  tip: { icon: string; action: string; ingredient: string; tip: string };
  onApply?: () => void;
}) {
  const actionLabel =
    {
      add: "Добавить",
      remove: "Убрать",
      swap: "Заменить",
      adjust: "Изменить",
      tip: "",
    }[tip.action] || "";

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/20 border border-muted/30 hover:border-primary/20 transition group">
      <span className="text-base mt-0.5 shrink-0">{tip.icon}</span>
      <div className="flex-1 min-w-0">
        {tip.ingredient && (
          <span className="font-bold text-sm text-primary mr-1">
            {tip.ingredient}
          </span>
        )}
        <span className="text-sm text-foreground/80">{tip.tip}</span>
      </div>
      {onApply && actionLabel && (
        <button
          onClick={onApply}
          className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition opacity-0 group-hover:opacity-100"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN EDITOR PAGE
// ══════════════════════════════════════════════════════════════════════

export default function LabComboEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [combo, setCombo] = useState<LabComboPage | null>(null);
  const [loading, setLoading] = useState(true);

  // DishState — single source of truth
  const [dish, setDish] = useState<DishState>({
    ingredients: [],
    context: {
      vegetarian: false,
      quick: false,
      cheap: false,
      cuisine: "any",
      goal: "balanced",
    },
    multiplier: 1,
  });

  // Editable SEO fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [h1, setH1] = useState("");
  const [intro, setIntro] = useState("");
  const [whyItWorks, setWhyItWorks] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // UI states
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null);

  // ── Auth ────────────────────────────────────────────────────────

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
  }, [router]);

  // ── Load combo ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const all = await getLabCombos(token, { limit: 500 });
        const found = all.find((c) => c.id === id);
        if (!found) {
          toast.error("Combo не найден");
          router.push("/lab-combos");
          return;
        }
        setCombo(found);
        populateFields(found);
        setDish(buildDishState(found));
      } catch (err: unknown) {
        toast.error("Ошибка загрузки", { description: String(err) });
      } finally {
        setLoading(false);
      }
    })();
  }, [token, id, router]);

  function populateFields(c: LabComboPage) {
    setTitle(c.title);
    setDescription(c.description);
    setH1(c.h1);
    setIntro(c.intro);
    setWhyItWorks(c.why_it_works || "");
    setImageUrl(c.image_url || "");
  }

  // ── DishState mutators ──────────────────────────────────────────

  const updateIngredientGrams = useCallback(
    (slug: string, grams: number) => {
      setDish((prev) => ({
        ...prev,
        ingredients: prev.ingredients.map((i) =>
          i.slug === slug ? { ...i, grams: Math.max(1, grams) } : i,
        ),
      }));
    },
    [],
  );

  const toggleLock = useCallback((slug: string) => {
    setDish((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) =>
        i.slug === slug ? { ...i, locked: !i.locked } : i,
      ),
    }));
  }, []);

  const removeIngredient = useCallback((slug: string) => {
    setDish((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((i) => i.slug !== slug),
    }));
  }, []);

  const addIngredient = useCallback((ing: DishIngredient) => {
    setDish((prev) => {
      if (prev.ingredients.some((i) => i.slug === ing.slug)) {
        toast.info("Уже добавлен");
        return prev;
      }
      return { ...prev, ingredients: [...prev.ingredients, ing] };
    });
  }, []);

  const setMultiplier = useCallback((m: number) => {
    setDish((prev) => ({ ...prev, multiplier: m }));
  }, []);

  const setGoal = useCallback((goal: string) => {
    setDish((prev) => ({ ...prev, context: { ...prev.context, goal } }));
  }, []);

  const setCuisine = useCallback((cuisine: string) => {
    setDish((prev) => ({
      ...prev,
      context: { ...prev.context, cuisine },
    }));
  }, []);

  const toggleContextFlag = useCallback(
    (key: "vegetarian" | "quick" | "cheap") => {
      setDish((prev) => ({
        ...prev,
        context: { ...prev.context, [key]: !prev.context[key] },
      }));
    },
    [],
  );

  // ── Scroll to ingredient ────────────────────────────────────────

  const scrollToIngredient = useCallback((slug: string) => {
    setHighlightSlug(slug);
    const el = document.getElementById(`ing-${slug}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHighlightSlug(null), 2000);
  }, []);

  // ── Save ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!token || !combo) return;
    setSaving(true);
    try {
      const updated = await updateCombo(token, combo.id, {
        title,
        description,
        h1,
        intro,
        why_it_works: whyItWorks,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      });
      setCombo(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Сохранено!");
    } catch (err: unknown) {
      toast.error("Ошибка сохранения", { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  // ── Publish / Archive / Delete ──────────────────────────────────

  const handlePublish = async () => {
    if (!token || !combo) return;
    setActionLoading(true);
    try {
      const updated = await publishCombo(token, combo.id);
      setCombo(updated);
      toast.success("Опубликовано!");
    } catch (err: unknown) {
      toast.error("Ошибка", { description: String(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!token || !combo) return;
    setActionLoading(true);
    try {
      const updated = await archiveCombo(token, combo.id);
      setCombo(updated);
      toast.success("В архиве");
    } catch (err: unknown) {
      toast.error("Ошибка", { description: String(err) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !combo) return;
    if (!confirm("Удалить combo навсегда?")) return;
    setActionLoading(true);
    try {
      await deleteCombo(token, combo.id);
      toast.success("Удалено");
      router.push("/lab-combos");
    } catch (err: unknown) {
      toast.error("Ошибка", { description: String(err) });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Image uploads ───────────────────────────────────────────────

  const handleHeroUpload = async (file: File) => {
    if (!token || !combo) return;
    setUploadingKind("hero");
    try {
      const { upload_url, public_url } = await getComboImageUploadUrl(
        token,
        combo.id,
        file.type || "image/webp",
      );
      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/webp" },
        body: file,
      });
      const updated = await saveComboImageUrl(token, combo.id, public_url);
      setCombo(updated);
      setImageUrl(updated.image_url || "");
      toast.success("Hero загружен!");
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setUploadingKind(null);
    }
  };

  const handleTypedUpload = async (
    file: File,
    kind: "process" | "detail",
  ) => {
    if (!token || !combo) return;
    setUploadingKind(kind);
    try {
      const { upload_url, public_url } = await getTypedImageUploadUrl(
        token,
        combo.id,
        kind,
        file.type || "image/webp",
      );
      await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/webp" },
        body: file,
      });
      const updated = await saveTypedImageUrl(
        token,
        combo.id,
        kind,
        public_url,
      );
      setCombo(updated);
      toast.success(
        `${kind === "process" ? "Process" : "Detail"} загружен!`,
      );
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setUploadingKind(null);
    }
  };

  // ── Backfill ────────────────────────────────────────────────────

  const handleBackfill = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const result = await backfillStructuredIngredients(token);
      toast.success(`Backfill: ${result.message}`);
      // Reload
      const all = await getLabCombos(token, { limit: 500 });
      const found = all.find((c) => c.id === id);
      if (found) {
        setCombo(found);
        setDish(buildDishState(found));
      }
    } catch (err: unknown) {
      toast.error("Backfill ошибка", { description: String(err) });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Computed ────────────────────────────────────────────────────

  const totals = computeTotals(dish);
  const howToCook = combo?.how_to_cook ?? [];
  const optimizationTips = combo?.optimization_tips ?? [];
  const faq = combo?.faq ?? [];

  // ── Loading ─────────────────────────────────────────────────────

  if (loading || !combo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky Top Bar ── */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/lab-combos")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Назад
            </Button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <FlaskConical className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-xs text-muted-foreground truncate">
                /{combo.slug}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${STATUS_COLORS[combo.status]}`}>
              {combo.status}
            </Badge>
            <Badge variant="outline" className="text-xs font-bold">
              {combo.locale.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Star className="h-3 w-3 mr-1 text-yellow-500" />
              {combo.quality_score}/5
            </Badge>
            {/* Macro summary in topbar */}
            <div className="hidden md:flex items-center gap-2 text-[10px] font-medium text-muted-foreground ml-2">
              <span className="text-orange-500">
                {Math.round(totals.kcal)} kcal
              </span>
              <span className="text-blue-500">
                Б{Math.round(totals.protein)}
              </span>
              <span className="text-yellow-500">
                Ж{Math.round(totals.fat)}
              </span>
              <span className="text-green-500">
                У{Math.round(totals.carbs)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {combo.status === "published" && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Сайт</span>
                </a>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "✓" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* ══════════════════════════════════════════════════════
              LEFT: Editor blocks
          ══════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Images */}
            <Section
              title="Изображения"
              icon={<ImageIcon className="h-4 w-4" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ImageBlock
                  label="Hero"
                  emoji="🖼️"
                  imageUrl={combo.image_url}
                  uploading={uploadingKind === "hero"}
                  onUpload={handleHeroUpload}
                />
                <ImageBlock
                  label="Process"
                  emoji="🔥"
                  imageUrl={combo.process_image_url}
                  uploading={uploadingKind === "process"}
                  onUpload={(f) => handleTypedUpload(f, "process")}
                />
                <ImageBlock
                  label="Detail"
                  emoji="🥑"
                  imageUrl={combo.detail_image_url}
                  uploading={uploadingKind === "detail"}
                  onUpload={(f) => handleTypedUpload(f, "detail")}
                />
              </div>
            </Section>

            {/* SEO Content */}
            <Section
              title="SEO-контент"
              icon={<Pencil className="h-4 w-4" />}
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex justify-between">
                  <span>Title</span>
                  <span
                    className={
                      title.length > 60
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }
                  >
                    {title.length}/60
                  </span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex justify-between">
                  <span>Description</span>
                  <span
                    className={
                      description.length > 155
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }
                  >
                    {description.length}/155
                  </span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">H1</Label>
                <Input
                  value={h1}
                  onChange={(e) => setH1(e.target.value)}
                  className="text-lg font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Intro</Label>
                <Textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Why It Works
                </Label>
                <Textarea
                  value={whyItWorks}
                  onChange={(e) => setWhyItWorks(e.target.value)}
                  rows={3}
                />
              </div>
            </Section>

            {/* ═══════════════════════════════════════════════════
                🧾 BLOCK 1: RECIPE — Dynamic Steps + Multiplier
            ═══════════════════════════════════════════════════ */}
            <Section
              title="🧾 Рецепт"
              icon={<Clock className="h-4 w-4" />}
              defaultOpen={true}
            >
              {/* Multiplier + summary */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <MultiplierControl
                  value={dish.multiplier}
                  onChange={setMultiplier}
                />
                <div className="flex gap-3 text-xs font-medium">
                  <span>{Math.round(totals.grams)}г</span>
                  <span className="text-orange-600">
                    {Math.round(totals.kcal)} kcal
                  </span>
                  <span className="text-blue-600">
                    Б{Math.round(totals.protein)}г
                  </span>
                  <span className="text-yellow-600">
                    Ж{Math.round(totals.fat)}г
                  </span>
                  <span className="text-green-600">
                    У{Math.round(totals.carbs)}г
                  </span>
                </div>
              </div>

              {howToCook.length > 0 ? (
                <div className="space-y-3">
                  {howToCook.map((step, i) => {
                    const text = syncStepText(
                      step.text,
                      dish.ingredients,
                      dish.multiplier,
                    );
                    return (
                      <div
                        key={i}
                        className="flex gap-3 p-3 rounded-xl bg-muted/20 border border-muted/30"
                      >
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {step.step}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">
                            {renderStepWithIngredients(
                              text,
                              dish.ingredients,
                              scrollToIngredient,
                            )}
                          </p>
                          {step.time_minutes != null &&
                            step.time_minutes > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />{" "}
                                {step.time_minutes} мин
                              </p>
                            )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Total time */}
                  {howToCook.some((s) => s.time_minutes) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Clock className="h-3.5 w-3.5" />
                      Общее время: ~
                      {howToCook.reduce(
                        (s, st) => s + (st.time_minutes ?? 0),
                        0,
                      )}{" "}
                      мин
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <p>Рецепт ещё не сгенерирован</p>
                  <p className="text-xs mt-1">
                    Нажмите «Пересобрать ингредиенты» в панели справа
                  </p>
                </div>
              )}
            </Section>

            {/* ═══════════════════════════════════════════════════
                💡 BLOCK 2: OPTIMIZATION TIPS — Action Engine
            ═══════════════════════════════════════════════════ */}
            <Section
              title="💡 Советы по оптимизации"
              icon={<Lightbulb className="h-4 w-4" />}
              defaultOpen={true}
            >
              {optimizationTips.length > 0 ? (
                <div className="space-y-4">
                  {(() => {
                    const addTips = optimizationTips.filter((t) =>
                      ["add", "swap"].includes(t.action),
                    );
                    const adjustTips = optimizationTips.filter((t) =>
                      ["adjust", "tip"].includes(t.action),
                    );
                    const removeTips = optimizationTips.filter(
                      (t) => t.action === "remove",
                    );

                    return (
                      <>
                        {addTips.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              🧠 Вкус и баланс
                            </p>
                            <div className="space-y-1.5">
                              {addTips.map((tip, i) => (
                                <TipActionCard
                                  key={`a-${i}`}
                                  tip={tip}
                                  onApply={() => {
                                    if (
                                      tip.ingredient &&
                                      tip.action === "add"
                                    ) {
                                      addIngredient({
                                        slug: tip.ingredient
                                          .toLowerCase()
                                          .replace(/\s+/g, "-"),
                                        name: tip.ingredient,
                                        grams: 10,
                                        kcal_per_100: 0,
                                        protein_per_100: 0,
                                        fat_per_100: 0,
                                        carbs_per_100: 0,
                                        image_url: null,
                                        product_type: null,
                                        locked: false,
                                      });
                                      toast.success(
                                        `${tip.ingredient} добавлен`,
                                      );
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {adjustTips.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              💡 Практические советы
                            </p>
                            <div className="space-y-1.5">
                              {adjustTips.map((tip, i) => (
                                <TipActionCard key={`t-${i}`} tip={tip} />
                              ))}
                            </div>
                          </div>
                        )}

                        {removeTips.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              ➖ Убрать лишнее
                            </p>
                            <div className="space-y-1.5">
                              {removeTips.map((tip, i) => (
                                <TipActionCard
                                  key={`r-${i}`}
                                  tip={tip}
                                  onApply={() => {
                                    if (tip.ingredient) {
                                      removeIngredient(
                                        tip.ingredient
                                          .toLowerCase()
                                          .replace(/\s+/g, "-"),
                                      );
                                      toast.success(
                                        `${tip.ingredient} убран`,
                                      );
                                    }
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {addTips.length === 0 &&
                          adjustTips.length === 0 &&
                          removeTips.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Нет советов
                            </p>
                          )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Советы появятся после генерации
                </p>
              )}
            </Section>

            {/* FAQ */}
            {faq.length > 0 && (
              <Section
                title="❓ FAQ"
                icon={<span className="text-sm">❓</span>}
                defaultOpen={false}
              >
                <div className="space-y-2">
                  {faq.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/10">
                      <p className="font-semibold text-sm">{item.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* JSON debug */}
            <Section
              title="🔧 JSON"
              icon={<Settings2 className="h-4 w-4" />}
              defaultOpen={false}
            >
              <pre className="text-[10px] bg-muted/40 rounded-lg p-4 overflow-auto max-h-72 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(combo.smart_response, null, 2)}
              </pre>
            </Section>
          </div>

          {/* ══════════════════════════════════════════════════════
              ⚙️ RIGHT: CONTROL CENTER (w-80)
          ══════════════════════════════════════════════════════ */}
          <div className="w-80 shrink-0 space-y-4 sticky top-20">
            {/* Status & Actions */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Публикация
                </p>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[combo.status]}>
                    {combo.status === "draft" && "Черновик"}
                    {combo.status === "published" && "✓ Опубликовано"}
                    {combo.status === "archived" && "В архиве"}
                  </Badge>
                  {combo.published_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(combo.published_at).toLocaleDateString("ru")}
                    </span>
                  )}
                </div>
                <div className="space-y-2 pt-1">
                  {combo.status !== "published" && (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handlePublish}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4 mr-1" />
                      )}
                      Опубликовать
                    </Button>
                  )}
                  {combo.status !== "archived" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="sm"
                      onClick={handleArchive}
                      disabled={actionLoading}
                    >
                      <Archive className="h-4 w-4 mr-1" /> В архив
                    </Button>
                  )}
                  {combo.status === "published" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      size="sm"
                      asChild
                    >
                      <a
                        href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> На сайте
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    size="sm"
                    onClick={handleDelete}
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Editable Ingredients ── */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    🥩 Ингредиенты ({dish.ingredients.length})
                  </p>
                  <MultiplierControl
                    value={dish.multiplier}
                    onChange={setMultiplier}
                  />
                </div>

                {dish.ingredients.length > 0 ? (
                  <div className="space-y-1.5">
                    {dish.ingredients.map((ing) => {
                      const g = Math.round(ing.grams * dish.multiplier);
                      const kcal = Math.round(
                        (ing.kcal_per_100 * g) / 100,
                      );
                      const isHighlighted = highlightSlug === ing.slug;
                      return (
                        <div
                          key={ing.slug}
                          id={`ing-${ing.slug}`}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all group ${
                            isHighlighted
                              ? "bg-primary/10 ring-2 ring-primary/40"
                              : "bg-muted/20 hover:bg-muted/40"
                          }`}
                        >
                          {ing.image_url ? (
                            <img
                              src={ing.image_url}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm shrink-0">
                              {typeEmoji(ing.product_type)}
                            </span>
                          )}

                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {ing.name}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {roleLabel(ing.product_type)} · {kcal} kcal
                            </p>
                          </div>

                          {/* ±10 buttons + input */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() =>
                                updateIngredientGrams(
                                  ing.slug,
                                  ing.grams - 10,
                                )
                              }
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted transition"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <input
                              type="number"
                              value={ing.grams}
                              onChange={(e) =>
                                updateIngredientGrams(
                                  ing.slug,
                                  parseInt(e.target.value) || 1,
                                )
                              }
                              className="w-12 h-6 text-center text-xs font-mono rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                              min={1}
                              max={2000}
                            />
                            <button
                              onClick={() =>
                                updateIngredientGrams(
                                  ing.slug,
                                  ing.grams + 10,
                                )
                              }
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-muted transition"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                            <span className="text-[10px] text-muted-foreground w-3">
                              г
                            </span>
                          </div>

                          {/* Lock */}
                          <button
                            onClick={() => toggleLock(ing.slug)}
                            className={`p-1 rounded transition ${
                              ing.locked
                                ? "text-amber-500"
                                : "text-muted-foreground/30 hover:text-muted-foreground"
                            }`}
                            title={
                              ing.locked
                                ? "Разблокировать"
                                : "AI не заменит"
                            }
                          >
                            {ing.locked ? (
                              <Lock className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* Remove */}
                          <button
                            onClick={() => removeIngredient(ing.slug)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 transition hover:bg-destructive/10"
                          >
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Totals */}
                    <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-primary/5 border border-primary/20 mt-1">
                      <span className="text-[10px] font-semibold">
                        📊 Итого
                      </span>
                      <div className="flex gap-2 text-[10px] font-medium">
                        <span>{Math.round(totals.grams)}г</span>
                        <span className="text-orange-600">
                          {Math.round(totals.kcal)} kcal
                        </span>
                        <span className="text-blue-600">
                          Б{Math.round(totals.protein)}
                        </span>
                        <span className="text-yellow-600">
                          Ж{Math.round(totals.fat)}
                        </span>
                        <span className="text-green-600">
                          У{Math.round(totals.carbs)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground space-y-2">
                    <p>Нет структурированных ингредиентов</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBackfill}
                      disabled={actionLoading}
                      className="gap-1.5"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Backfill ингредиенты
                    </Button>
                  </div>
                )}

                {/* Add ingredient search */}
                {token && (
                  <InlineIngredientSearch
                    token={token}
                    onAdd={addIngredient}
                  />
                )}
              </CardContent>
            </Card>

            {/* ── Context Toggles ── */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ⚙️ Контекст
                </p>

                {/* Goal */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">
                    🎯 Цель
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        onClick={() => setGoal(g)}
                        className={`text-[10px] px-2 py-1 rounded-full font-medium transition ${
                          dish.context.goal === g
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {g.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cuisine */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">
                    🌍 Кухня
                  </Label>
                  <select
                    value={dish.context.cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    className="w-full h-8 rounded-lg border bg-background px-2 text-xs"
                  >
                    {CUISINES.map((c) => (
                      <option key={c} value={c}>
                        {c === "any"
                          ? "Любая"
                          : c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Toggles */}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      {
                        key: "vegetarian" as const,
                        icon: "🌱",
                        label: "Вегетариан",
                      },
                      { key: "quick" as const, icon: "⚡", label: "Быстро" },
                      {
                        key: "cheap" as const,
                        icon: "💰",
                        label: "Бюджетно",
                      },
                    ] as const
                  ).map(({ key, icon, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleContextFlag(key)}
                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg font-medium transition border ${
                        dish.context[key]
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-muted/20 border-muted/30 text-muted-foreground hover:border-muted"
                      }`}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Quality + URL ── */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  📊 Инфо
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    <span className="font-medium">Качество:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={
                            n <= combo.quality_score
                              ? "text-yellow-500"
                              : "text-muted-foreground/20"
                          }
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">Язык:</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold"
                    >
                      {combo.locale.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* URL */}
                <div>
                  <Label className="text-[10px] text-muted-foreground mb-1 block">
                    URL
                  </Label>
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] bg-muted px-2 py-1.5 rounded font-mono flex-1 break-all block">
                      /{combo.locale}/recipes/{combo.slug}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`,
                        );
                        toast.success("URL скопирован");
                      }}
                      className="p-1.5 rounded hover:bg-muted transition shrink-0"
                      title="Копировать"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5 text-[10px] text-muted-foreground/60 pt-1 border-t">
                  <p>
                    Создано:{" "}
                    {new Date(combo.created_at).toLocaleString("ru")}
                  </p>
                  <p>
                    Обновлено:{" "}
                    {new Date(combo.updated_at).toLocaleString("ru")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Rebuild + Save */}
            <Button
              variant="outline"
              className="w-full gap-2"
              size="lg"
              onClick={handleBackfill}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              🔄 Пересобрать ингредиенты
            </Button>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={saving}
              size="lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4 mr-2 text-green-400" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saved ? "Сохранено!" : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
