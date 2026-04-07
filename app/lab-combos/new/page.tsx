"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  generateCombo,
  getCombo,
  updateCombo,
  publishCombo,
  deleteCombo,
  classifyDish,
  type GenerateComboRequest,
  type LabComboPage,
  type DishProfile,
} from "@/lib/lab-combos-api";
import IngredientPicker, {
  type SelectedIngredient,
} from "@/components/ingredient-picker";
import {
  FlaskConical, Loader2, Sparkles, ArrowLeft, ChefHat, Globe,
  Bot, Flame, ShieldCheck, Save, ArrowUpCircle, Trash2, Check,
  ExternalLink, RefreshCw, Eye, CheckCircle2, Circle, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const LOCALES = [
  { code: "en", label: "🇬🇧 English",    flag: "EN" },
  { code: "pl", label: "🇵🇱 Polski",     flag: "PL" },
  { code: "ru", label: "🇷🇺 Русский",    flag: "RU" },
  { code: "uk", label: "🇺🇦 Українська", flag: "UK" },
] as const;

const GOALS = [
  { value: "high_protein", label: "💪 High Protein" },
  { value: "low_carb",     label: "🥦 Low Carb"    },
  { value: "keto",         label: "🥑 Keto"         },
  { value: "weight_loss",  label: "⚖️ Weight Loss"  },
  { value: "muscle_gain",  label: "🏋️ Muscle Gain" },
  { value: "balanced",     label: "🍽️ Balanced"    },
];

const MEAL_TYPES = [
  { value: "breakfast", label: "🌅 Завтрак" },
  { value: "lunch",     label: "☀️ Обед"    },
  { value: "dinner",    label: "🌙 Ужин"    },
  { value: "snack",     label: "🍿 Перекус" },
];

const DIETS = [
  { value: "vegetarian",  label: "🥕 Вегетарианская" },
  { value: "vegan",       label: "🌱 Веганская"       },
  { value: "gluten_free", label: "🌾 Без глютена"     },
];

const COOKING_TIMES = [
  { value: "quick",  label: "⚡ До 20 мин"  },
  { value: "medium", label: "⏱️ 20-45 мин" },
  { value: "long",   label: "🍲 45+ мин"    },
];

const BUDGETS = [
  { value: "cheap",   label: "💰 Бюджетный" },
  { value: "premium", label: "💎 Премиум"    },
];

const CUISINES = [
  { value: "italian",       label: "🇮🇹 Итальянская"     },
  { value: "asian",         label: "🥢 Азиатская"        },
  { value: "mexican",       label: "🌮 Мексиканская"      },
  { value: "mediterranean", label: "🫒 Средиземноморская" },
];

const AI_MODELS = [
  { value: "flash", label: "⚡ Flash", desc: "Быстро (~15 сек)"       },
  { value: "pro",   label: "🧠 Pro",   desc: "Качественнее (~30 сек)" },
];

const DISH_TYPE_EMOJI: Record<string, string> = {
  sticks: "🍗", cutlets: "🥩", pancakes: "🥞", soup: "🍲",
  salad: "🥗", bowl: "🥣", pasta: "🍝", casserole: "🫕",
  stir_fry: "🥘", baked: "🔥", wrap: "🌯", omelette: "🍳",
  porridge: "🥣", smoothie: "🥤", generic: "🍽️",
};

const BLOG_BASE = "https://dima-fomin.pl";

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived:  "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

// ── Types ────────────────────────────────────────────────────────────

type LocaleCode = "en" | "pl" | "ru" | "uk";
type SeoField = "title" | "description" | "h1" | "intro" | "why_it_works";

/** Pipeline stages for visual step-by-step generation */
const PIPELINE_STAGES = [
  { key: "classify",   label: "Классификация",     emoji: "🧠", desc: "Тип блюда, техника" },
  { key: "nutrition",  label: "Нутриенты",          emoji: "📊", desc: "КБЖУ, вес, порции" },
  { key: "seo",        label: "SEO-шаблон",         emoji: "📝", desc: "Title, H1, Intro" },
  { key: "ai",         label: "AI-обогащение",      emoji: "🤖", desc: "Gemini переписывает" },
  { key: "validate",   label: "Валидация рецепта",  emoji: "✅", desc: "Проверка шагов" },
] as const;

type PipelineStage = typeof PIPELINE_STAGES[number]["key"];
type StageStatus = "pending" | "active" | "done";

/** Which SEO fields have been "revealed" after generation */
interface RevealState {
  nutrition: boolean;
  title: boolean;
  description: boolean;
  h1: boolean;
  intro: boolean;
  why_it_works: boolean;
  steps: boolean;
}

const EMPTY_REVEAL: RevealState = {
  nutrition: false, title: false, description: false,
  h1: false, intro: false, why_it_works: false, steps: false,
};

interface LocaleState {
  page:       LabComboPage | null;
  generating: boolean;
  saving:     boolean;
  publishing: boolean;
  deleting:   boolean;
  error:      string;
  title:        string;
  description:  string;
  h1:           string;
  intro:        string;
  why_it_works: string;
  dirty: boolean;
  /** Pipeline stage statuses for animated generation */
  stages: Record<PipelineStage, StageStatus>;
  /** Progressive reveal of fields */
  revealed: RevealState;
}

function emptyStages(): Record<PipelineStage, StageStatus> {
  return { classify: "pending", nutrition: "pending", seo: "pending", ai: "pending", validate: "pending" };
}

function empty(): LocaleState {
  return {
    page: null, generating: false, saving: false,
    publishing: false, deleting: false, error: "",
    title: "", description: "", h1: "", intro: "", why_it_works: "",
    dirty: false,
    stages: emptyStages(),
    revealed: { ...EMPTY_REVEAL },
  };
}

// ── QualityBar ────────────────────────────────────────────────────────

function QualityBar({ score }: { score: number }) {
  const bar   = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";
  const text  = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Acceptable" : "Poor";
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${text}`}>{score}/100 · {label}</span>
    </div>
  );
}

// ── PipelineStepper — animated step-by-step generation visualization ──

function PipelineStepper({ stages }: { stages: Record<PipelineStage, StageStatus> }) {
  return (
    <div className="space-y-1.5">
      {PIPELINE_STAGES.map(({ key, label, emoji, desc }) => {
        const status = stages[key];
        return (
          <div
            key={key}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500 ${
              status === "active"
                ? "bg-primary/10 border border-primary/30 shadow-sm"
                : status === "done"
                ? "bg-emerald-500/5 border border-emerald-500/20"
                : "bg-muted/20 border border-transparent opacity-50"
            }`}
          >
            <span className="text-base w-6 text-center shrink-0">
              {status === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : status === "active" ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/30" />
              )}
            </span>
            <span className="text-base">{emoji}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${status === "active" ? "text-primary" : status === "done" ? "text-emerald-600" : "text-muted-foreground"}`}>
                {label}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
            </div>
            {status === "done" && (
              <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/20 shrink-0">
                OK
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── RevealField — shows field with animation after generation ─────────

function RevealField({
  visible, label, charCount, maxChars, warnBelow, children,
}: {
  visible: boolean;
  label: string;
  charCount?: number;
  maxChars?: number;
  warnBelow?: number;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 h-0 overflow-hidden"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
          {visible && <Zap className="h-3 w-3 text-amber-500 animate-pulse" />}
        </div>
        {charCount != null && maxChars && (
          <span className={`text-[10px] tabular-nums ${charCount > maxChars ? "text-red-500 font-bold" : warnBelow && charCount < warnBelow ? "text-yellow-500" : "text-muted-foreground"}`}>
            {charCount}/{maxChars}
          </span>
        )}
        {charCount != null && !maxChars && warnBelow && (
          <span className={`text-[10px] tabular-nums ${charCount < warnBelow ? "text-yellow-500" : "text-muted-foreground"}`}>
            {charCount} ch
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── LocaleBlock ───────────────────────────────────────────────────────

interface BlockProps {
  locale:       typeof LOCALES[number];
  state:        LocaleState;
  onGenerate:   () => void;
  onSave:       () => void;
  onPublish:    () => void;
  onDelete:     () => void;
  onRegenerate: () => void;
  onChange:     (field: SeoField, value: string) => void;
}

function LocaleBlock({ locale, state, onGenerate, onSave, onPublish, onDelete, onRegenerate, onChange }: BlockProps) {
  const { page, revealed } = state;
  const ok = !!page;

  return (
    <Card className={`transition-all ${ok ? "border-primary/30" : "border-muted bg-card/40"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm font-black px-3 py-1 min-w-[3.2rem] justify-center">
              {locale.flag}
            </Badge>
            <span className="font-semibold text-sm">{locale.label}</span>
            {page && (
              <>
                <Badge className={`text-[10px] ${STATUS_COLORS[page.status]}`}>{page.status}</Badge>
                <Badge variant="outline" className="text-[10px]">{page.quality_score}/100</Badge>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!ok && !state.generating && (
              <Button size="sm" onClick={onGenerate} disabled={state.generating} className="gap-1.5 h-8">
                <Sparkles className="h-3.5 w-3.5" />
                Генерировать
              </Button>
            )}
            {ok && (
              <>
                {state.dirty && (
                  <Button size="sm" onClick={onSave} disabled={state.saving} className="gap-1.5 h-8">
                    {state.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Сохранить
                  </Button>
                )}
                {!state.dirty && page.status === "draft" && (
                  <Button
                    size="sm" variant="outline" onClick={onPublish} disabled={state.publishing}
                    className="gap-1.5 h-8 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    {state.publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                    Опубликовать
                  </Button>
                )}
                {page.status === "published" && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                    <a href={`${BLOG_BASE}/${locale.code}/recipes/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={onRegenerate} disabled={state.generating} title="Перегенерировать"
                >
                  {state.generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                  onClick={onDelete} disabled={state.deleting} title="Удалить"
                >
                  {state.deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </>
            )}
          </div>
        </div>
        {page && <QualityBar score={page.quality_score} />}
      </CardHeader>

      <CardContent className="space-y-3">
        {state.error && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{state.error}</AlertDescription>
          </Alert>
        )}

        {/* ── PIPELINE STEPPER — visible during generation ── */}
        {state.generating && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-semibold text-primary">Генерация {locale.flag}…</p>
            </div>
            <PipelineStepper stages={state.stages} />
          </div>
        )}

        {!ok && !state.generating && (
          <div className="flex flex-col items-center py-8 text-muted-foreground/40 text-center">
            <Globe className="h-7 w-7 mb-2" />
            <p className="text-sm">Нажмите «Генерировать»</p>
          </div>
        )}

        {ok && !state.generating && (
          <div className="space-y-3">
            {/* Nutrition grid — reveals first */}
            <div className={`transition-all duration-700 ${revealed.nutrition ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <div className="grid grid-cols-5 gap-1 p-3 rounded-lg bg-muted/30 text-center">
                {[
                  { v: Math.round(page.calories_per_serving),        u: "kcal",   c: "text-orange-600" },
                  { v: page.protein_per_serving.toFixed(0) + "г",    u: "белок",  c: "text-blue-600"   },
                  { v: page.fat_per_serving.toFixed(0) + "г",        u: "жиры",   c: "text-yellow-600" },
                  { v: page.carbs_per_serving.toFixed(0) + "г",      u: "углев.", c: "text-green-600"  },
                  { v: page.how_to_cook?.length ?? 0,                u: "шагов",  c: "text-muted-foreground" },
                ].map(({ v, u, c }) => (
                  <div key={u}>
                    <p className={`text-sm font-black ${c}`}>{v}</p>
                    <p className="text-[9px] text-muted-foreground uppercase">{u}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-mono text-muted-foreground px-0.5">
              <span className="opacity-40">/{locale.code}/recipes/</span>
              <span className="font-semibold text-foreground">{page.slug}</span>
            </p>

            <RevealField visible={revealed.title} label="Title" charCount={state.title.length} maxChars={60}>
              <Input value={state.title} onChange={(e) => onChange("title", e.target.value)} className="h-8 text-sm" />
            </RevealField>

            <RevealField visible={revealed.description} label="Meta Description" charCount={state.description.length} maxChars={155} warnBelow={80}>
              <Textarea value={state.description} onChange={(e) => onChange("description", e.target.value)} className="text-sm resize-none" rows={2} />
            </RevealField>

            <RevealField visible={revealed.h1} label="H1">
              <Input value={state.h1} onChange={(e) => onChange("h1", e.target.value)} className="h-8 text-sm" />
            </RevealField>

            <RevealField visible={revealed.intro} label="Intro" charCount={state.intro.length} warnBelow={100}>
              <Textarea value={state.intro} onChange={(e) => onChange("intro", e.target.value)} className="text-sm resize-none" rows={3} />
            </RevealField>

            <RevealField visible={revealed.why_it_works} label="Why it works" charCount={state.why_it_works.length} warnBelow={50}>
              <Textarea value={state.why_it_works} onChange={(e) => onChange("why_it_works", e.target.value)} className="text-sm resize-none" rows={2} />
            </RevealField>

            {/* Steps preview — reveals last */}
            {page.how_to_cook && page.how_to_cook.length > 0 && (
              <div className={`transition-all duration-700 ${revealed.steps ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 h-0 overflow-hidden"}`}>
                <div className="p-3 rounded-lg bg-muted/20 border border-muted/40 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Шаги ({page.how_to_cook.length})
                  </p>
                  {page.how_to_cook.slice(0, 4).map((s, i) => {
                    const raw = s as Record<string, unknown>;
                    const stepText = (raw.text as string | undefined) ?? (raw.description as string | undefined) ?? "";
                    const mins = s.time_minutes ?? (raw.duration_minutes as number | undefined);
                    return (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="font-mono text-muted-foreground w-4 shrink-0">{s.step ?? i + 1}.</span>
                        <span className="line-clamp-1 flex-1">{stepText}</span>
                        {mins != null && mins > 0 && (
                          <span className="text-muted-foreground shrink-0 tabular-nums">{mins}м</span>
                        )}
                      </div>
                    );
                  })}
                  {page.how_to_cook.length > 4 && (
                    <p className="text-[10px] text-muted-foreground">+{page.how_to_cook.length - 4} шагов…</p>
                  )}
                </div>
              </div>
            )}

            {state.dirty && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <span className="text-xs text-yellow-700 dark:text-yellow-400">Несохранённые изменения</span>
                <Button size="sm" className="h-7 gap-1.5" onClick={onSave} disabled={state.saving}>
                  {state.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Сохранить
                </Button>
              </div>
            )}

            {page.status === "published" && (
              <a
                href={`${BLOG_BASE}/${locale.code}/recipes/${page.slug}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline"
              >
                <Eye className="h-3.5 w-3.5" />
                {locale.code}/recipes/{page.slug}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function NewLabComboPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const [dishName, setDishName] = useState("");
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [goal, setGoal]               = useState("");
  const [mealType, setMealType]       = useState("");
  const [diet, setDiet]               = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [budget, setBudget]           = useState("");
  const [cuisine, setCuisine]         = useState("");
  const [model, setModel]             = useState("pro");

  const [dishProfile, setDishProfile] = useState<DishProfile | null>(null);
  const [classifying, setClassifying] = useState(false);
  const classifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [locales, setLocales] = useState<Record<LocaleCode, LocaleState>>({
    en: empty(), pl: empty(), ru: empty(), uk: empty(),
  });

  useEffect(() => {
    const t = getToken();
    if (!t) { router.push("/login"); return; }
    setToken(t);
  }, [router]);

  const classifyDebounced = useCallback((name: string) => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    if (!name.trim() || name.length < 3 || !token) {
      setDishProfile(null); setClassifying(false); return;
    }
    setClassifying(true);
    classifyTimer.current = setTimeout(async () => {
      try { setDishProfile(await classifyDish(token, name.trim())); }
      catch { setDishProfile(null); }
      finally { setClassifying(false); }
    }, 500);
  }, [token]);

  function patch(code: LocaleCode, p: Partial<LocaleState>) {
    setLocales((prev) => ({ ...prev, [code]: { ...prev[code], ...p } }));
  }

  function patchField(code: LocaleCode, field: SeoField, value: string) {
    setLocales((prev) => ({ ...prev, [code]: { ...prev[code], [field]: value, dirty: true } }));
  }

  function buildReq(locale: LocaleCode): GenerateComboRequest {
    return {
      ingredients: selectedIngredients.map((i) => i.slug),
      locale,
      ...(dishName    && { dish_name:    dishName }),
      ...(goal        && { goal }),
      ...(mealType    && { meal_type:    mealType }),
      ...(diet        && { diet }),
      ...(cookingTime && { cooking_time: cookingTime }),
      ...(budget      && { budget }),
      ...(cuisine     && { cuisine }),
      model,
    };
  }

  /** Animate a single pipeline stage to "active" → then "done" after delay */
  function advanceStage(code: LocaleCode, stage: PipelineStage) {
    setLocales((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        stages: { ...prev[code].stages, [stage]: "active" as StageStatus },
      },
    }));
  }
  function completeStage(code: LocaleCode, stage: PipelineStage) {
    setLocales((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        stages: { ...prev[code].stages, [stage]: "done" as StageStatus },
      },
    }));
  }

  /** Progressively reveal fields one by one after generation completes */
  function revealFieldsSequentially(code: LocaleCode) {
    const fields: (keyof RevealState)[] = ["nutrition", "title", "description", "h1", "intro", "why_it_works", "steps"];
    fields.forEach((field, i) => {
      setTimeout(() => {
        setLocales((prev) => ({
          ...prev,
          [code]: {
            ...prev[code],
            revealed: { ...prev[code].revealed, [field]: true },
          },
        }));
      }, i * 300);
    });
  }

  async function handleGenerate(code: LocaleCode) {
    if (!token) return;
    if (selectedIngredients.length === 0) { toast.error("Добавьте хотя бы 1 ингредиент"); return; }

    // Reset state and start generating
    patch(code, {
      generating: true, error: "",
      stages: emptyStages(),
      revealed: { ...EMPTY_REVEAL },
    });

    // Animate pipeline stages on timed intervals (visual only)
    // The real work happens in one API call — these are approximate time markers
    const stageKeys: PipelineStage[] = ["classify", "nutrition", "seo", "ai", "validate"];
    // Approximate timing: classify ~1s, nutrition ~1s, seo ~2s, ai ~15-25s, validate ~2s
    const stageDelays = [0, 1500, 3000, 5000, 8000]; // when each starts
    const stageDone   = [1400, 2900, 4900, 7900, 10000]; // when each "done" tick

    const stageTimers: ReturnType<typeof setTimeout>[] = [];

    stageKeys.forEach((stage, i) => {
      stageTimers.push(setTimeout(() => advanceStage(code, stage), stageDelays[i]));
      stageTimers.push(setTimeout(() => completeStage(code, stage), stageDone[i]));
    });

    try {
      const page = await generateCombo(token, buildReq(code));

      // Clear timers and mark all stages done
      stageTimers.forEach(clearTimeout);
      const allDone: Record<PipelineStage, StageStatus> = Object.fromEntries(stageKeys.map((k) => [k, "done"])) as never;

      patch(code, {
        generating: false, page, dirty: false, error: "",
        title: page.title, description: page.description,
        h1: page.h1, intro: page.intro, why_it_works: page.why_it_works,
        stages: allDone,
        revealed: { ...EMPTY_REVEAL },
      });

      // Start sequential reveal
      revealFieldsSequentially(code);

      toast.success(`${code.toUpperCase()} готов!`, { description: page.title });

      // Poll once more after 3s to catch any late AI enrichment updates
      setTimeout(async () => {
        try {
          if (!token) return;
          const refreshed = await getCombo(token, page.id);
          // Only update if content actually changed
          if (refreshed.title !== page.title || refreshed.why_it_works !== page.why_it_works) {
            patch(code, {
              page: refreshed,
              title: refreshed.title,
              description: refreshed.description,
              h1: refreshed.h1,
              intro: refreshed.intro,
              why_it_works: refreshed.why_it_works,
              dirty: false,
            });
            toast.info(`${code.toUpperCase()} обновлён AI`, { description: "Данные обогащены" });
          }
        } catch { /* ignore poll error */ }
      }, 3000);

    } catch (err: unknown) {
      stageTimers.forEach(clearTimeout);
      const msg = err instanceof Error ? err.message : String(err);
      patch(code, { generating: false, error: msg, stages: emptyStages() });
      toast.error(`Ошибка ${code.toUpperCase()}`, { description: msg });
    }
  }

  async function handleRegenerate(code: LocaleCode) {
    if (!token) return;
    const existing = locales[code].page;
    if (existing) {
      try { await deleteCombo(token, existing.id); } catch { /* ignore */ }
      patch(code, empty());
    }
    await handleGenerate(code);
  }

  async function handleSave(code: LocaleCode) {
    if (!token) return;
    const ls = locales[code];
    if (!ls.page) return;
    patch(code, { saving: true });
    try {
      const updated = await updateCombo(token, ls.page.id, {
        title: ls.title, description: ls.description,
        h1: ls.h1, intro: ls.intro, why_it_works: ls.why_it_works,
      });
      patch(code, { saving: false, page: updated, dirty: false });
      toast.success(`${code.toUpperCase()} сохранён`);
    } catch (err: unknown) {
      patch(code, { saving: false });
      toast.error("Ошибка сохранения", { description: String(err) });
    }
  }

  async function handlePublish(code: LocaleCode) {
    if (!token) return;
    const page = locales[code].page;
    if (!page) return;
    patch(code, { publishing: true });
    try {
      const updated = await publishCombo(token, page.id);
      patch(code, { publishing: false, page: updated });
      toast.success(`${code.toUpperCase()} опубликован! 🎉`);
    } catch (err: unknown) {
      patch(code, { publishing: false });
      toast.error("Ошибка публикации", { description: String(err) });
    }
  }

  async function handleDelete(code: LocaleCode) {
    if (!token) return;
    const page = locales[code].page;
    if (!page) return;
    patch(code, { deleting: true });
    try {
      await deleteCombo(token, page.id);
      patch(code, empty());
      toast.success(`${code.toUpperCase()} удалён`);
    } catch (err: unknown) {
      patch(code, { deleting: false });
      toast.error("Ошибка удаления", { description: String(err) });
    }
  }

  async function handleGenerateAll() {
    for (const { code } of LOCALES) {
      if (!locales[code as LocaleCode].page) {
        await handleGenerate(code as LocaleCode);
      }
    }
  }

  const generatedCount = LOCALES.filter(({ code }) => locales[code as LocaleCode].page).length;
  const publishedCount = LOCALES.filter(({ code }) => locales[code as LocaleCode].page?.status === "published").length;
  const anyGenerating  = LOCALES.some(({ code }) => locales[code as LocaleCode].generating);

  return (
    <div className="container mx-auto p-6 max-w-[1200px]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push("/lab-combos")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />Lab Combos
        </Button>
        <span>/</span>
        <span>Новый рецепт</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Создать SEO-страницы
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Параметры → генерация по локали → редактирование → публикация
          </p>
        </div>
        {generatedCount > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline">{generatedCount}/4 создано</Badge>
            {publishedCount > 0 && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                {publishedCount} опубликовано
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">

        {/* SETTINGS BLOCK — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Col 1: Dish name */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-primary" />
                Название блюда
              </CardTitle>
              <CardDescription className="text-xs">Определяет технику и AI-промпт</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <input
                  type="text"
                  value={dishName}
                  onChange={(e) => { setDishName(e.target.value); classifyDebounced(e.target.value); }}
                  placeholder='"Potato Draniki"'
                  className="w-full h-10 rounded-lg border bg-background px-3 pr-10 text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {classifying && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                {!classifying && dishProfile && (
                  <span className="absolute right-3 top-2 text-lg">{DISH_TYPE_EMOJI[dishProfile.dish_type] || "🍽️"}</span>
                )}
              </div>
              {dishProfile && (
                <div className="mt-2 p-2 rounded-lg border border-primary/20 bg-background text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{dishProfile.type_label}</span>
                    <span className="text-muted-foreground">· мин {dishProfile.min_steps} шагов</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dishProfile.requires_forming && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">✋ Формовка</Badge>}
                    {dishProfile.requires_liquid  && <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-600">💧 Жидкость</Badge>}
                    {dishProfile.requires_oven    && <Badge variant="outline" className="text-[10px] border-red-400 text-red-600">🔥 Духовка</Badge>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Col 2: Ingredients */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Ингредиенты
                {selectedIngredients.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">{selectedIngredients.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {token && (
                <IngredientPicker
                  token={token}
                  selected={selectedIngredients}
                  onChange={setSelectedIngredients}
                  maxItems={8}
                />
              )}
            </CardContent>
          </Card>

          {/* Col 3: Parameters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Параметры
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Цель</Label>
                <div className="grid grid-cols-2 gap-1">
                  {GOALS.map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setGoal(goal === g.value ? "" : g.value)}
                      className={`px-2 py-1.5 rounded-md border text-xs text-left transition-all ${goal === g.value ? "border-primary bg-primary/10 font-semibold" : "border-muted hover:border-primary/40"}`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Приём пищи</Label>
                <div className="grid grid-cols-2 gap-1">
                  {MEAL_TYPES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMealType(mealType === m.value ? "" : m.value)}
                      className={`px-2 py-1.5 rounded-md border text-xs text-center transition-all ${mealType === m.value ? "border-primary bg-primary/10 font-semibold" : "border-muted hover:border-primary/40"}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Диета</Label>
                  <Select value={diet || "__none__"} onValueChange={(v) => setDiet(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Любая" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Любая</SelectItem>
                      {DIETS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Время</Label>
                  <Select value={cookingTime || "__none__"} onValueChange={(v) => setCookingTime(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Любое" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Любое</SelectItem>
                      {COOKING_TIMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Бюджет</Label>
                  <Select value={budget || "__none__"} onValueChange={(v) => setBudget(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Любой" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Любой</SelectItem>
                      {BUDGETS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Кухня</Label>
                  <Select value={cuisine || "__none__"} onValueChange={(v) => setCuisine(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Любая" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Любая</SelectItem>
                      {CUISINES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Bot className="h-3 w-3" /> AI Модель
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {AI_MODELS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setModel(m.value)}
                      className={`px-3 py-2 rounded-md border text-left transition-all ${model === m.value ? "border-primary bg-primary/10" : "border-muted hover:border-primary/40"}`}
                    >
                      <span className="text-xs font-bold block">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>{/* /SETTINGS BLOCK grid */}

        {/* GENERATE ALL button */}
        <div className="flex items-center gap-3">
          <Button
            className="gap-2 flex-1 sm:flex-none sm:w-64"
            size="lg"
            onClick={handleGenerateAll}
            disabled={selectedIngredients.length === 0 || anyGenerating}
          >
            {anyGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            Генерировать все 4 языка
          </Button>

          {selectedIngredients.length === 0 && (
            <p className="text-xs text-muted-foreground/60">Добавьте ингредиенты чтобы начать</p>
          )}

          {generatedCount > 0 && (
            <div className="flex gap-2">
              {LOCALES.map(({ code, flag }) => {
                const ls = locales[code as LocaleCode];
                return (
                  <div key={code} className="flex flex-col items-center">
                    <span className="text-base">
                      {ls.page?.status === "published" ? "✅" : ls.page ? "📝" : "⬜"}
                    </span>
                    <p className="text-[10px] font-bold text-muted-foreground">{flag}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOCALE BLOCKS — vertical */}
        <div className="space-y-4">
          {generatedCount === 0 && (
            <Card className="border-dashed bg-muted/10">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-sm">Заполните параметры и нажмите «Генерировать»</p>
                <p className="text-xs mt-1 opacity-60">Каждый язык генерируется отдельно или все сразу</p>
                <div className="flex justify-center gap-2 mt-4">
                  {LOCALES.map(({ flag }) => (
                    <Badge key={flag} variant="outline" className="opacity-30 text-xs">{flag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {LOCALES.map((locale) => (
            <LocaleBlock
              key={locale.code}
              locale={locale}
              state={locales[locale.code as LocaleCode]}
              onGenerate={() => handleGenerate(locale.code as LocaleCode)}
              onSave={() => handleSave(locale.code as LocaleCode)}
              onPublish={() => handlePublish(locale.code as LocaleCode)}
              onDelete={() => handleDelete(locale.code as LocaleCode)}
              onRegenerate={() => handleRegenerate(locale.code as LocaleCode)}
              onChange={(field, value) => patchField(locale.code as LocaleCode, field, value)}
            />
          ))}

          {publishedCount === 4 && (
            <Card className="bg-emerald-500/5 border-emerald-500/30">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-3">
                  <Check className="h-6 w-6" />
                </div>
                <p className="font-black text-lg">Все 4 языка опубликованы! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">/{locales.en.page?.slug}</p>
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => router.push("/lab-combos")}>
                  <ArrowLeft className="h-3.5 w-3.5" />К списку
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Button variant="ghost" size="sm" className="opacity-60" onClick={() => router.push("/lab-combos")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />К списку
        </Button>

      </div>
    </div>
  );
}
