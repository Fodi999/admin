"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  createProduct,
  uploadProductImage,
  type CreateProductRequest,
} from "@/lib/api";
import {
  aiSuggestProducts,
  aiCreateProductDraft,
  updateProduct,
  type UpdateProductRequest,
  type ProductSuggestion,
  type ProductDraft,
  type DraftField,
  type FieldConfidence,
  type DraftCorrection,
  type QualityWarning,
} from "@/lib/admin-api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Wrench,
  Eye,
  Check,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: FieldConfidence }) {
  const config =
    ({
      high: { label: "✓", className: "bg-green-100 text-green-700 border-green-200" },
      medium: { label: "~", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
      low: { label: "?", className: "bg-red-100 text-red-700 border-red-200" },
      not_applicable: { label: "—", className: "bg-gray-100 text-gray-500 border-gray-200" },
    } as Record<string, { label: string; className: string }>)[confidence] ?? {
      label: "?",
      className: "bg-gray-100 text-gray-500 border-gray-200",
    };

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.className}`}
    >
      AI {config.label}
    </span>
  );
}

function DraftInput({
  label,
  field,
  langCode,
  langColor,
  onChange,
}: {
  label: string;
  field: DraftField<string>;
  langCode: string;
  langColor: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-2 text-sm">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${langColor}`}>{langCode}</span>
        {label}
        <ConfidenceBadge confidence={field.confidence} />
      </Label>
      <Input
        value={field.value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={
          !field.value
            ? "border-red-300 bg-red-50/30"
            : field.confidence === "low"
            ? "border-yellow-300 bg-yellow-50/30"
            : ""
        }
      />
    </div>
  );
}

function DraftNumberInput({
  label,
  field,
  suffix,
  onChange,
}: {
  label: string;
  field: DraftField<number>;
  suffix?: string;
  onChange: (val: number | null) => void;
}) {
  if (field.confidence === "not_applicable") {
    return (
      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 text-gray-400 text-sm border">
          н/п
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-2 text-sm">
        {label}
        {suffix && <span className="text-muted-foreground text-xs">({suffix})</span>}
        <ConfidenceBadge confidence={field.confidence} />
      </Label>
      <Input
        type="number"
        step="any"
        value={field.value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className={!field.value && field.value !== 0 ? "border-red-300 bg-red-50/30" : ""}
      />
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ["Запрос", "Выбор", "Черновик", "Готово"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                i < current
                  ? "bg-green-500 border-green-500 text-white"
                  : i === current
                  ? "bg-primary border-primary text-white"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                i === current ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-1 mb-4 transition-all ${
                i < current ? "bg-green-500" : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewProductPage() {
  const router = useRouter();

  // ── Step control (0=query, 1=pick, 2=review, 3=done) ──
  const [step, setStep] = useState(0);

  // ── Step 0 ──
  const [query, setQuery] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [suggestAttempts, setSuggestAttempts] = useState(0);
  const [suggestCached, setSuggestCached] = useState(false);

  // ── Step 1 ──
  const [picked, setPicked] = useState<ProductSuggestion | null>(null);

  // ── Step 2 ──
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftCached, setDraftCached] = useState(false);
  const [corrections, setCorrections] = useState<DraftCorrection[]>([]);

  // ── Step 3 ──
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // ── Shared ──
  const [error, setError] = useState("");

  // ════════════════════════════════════════════════════════════════════
  // STEP 0 → 1: AI suggests products
  // ════════════════════════════════════════════════════════════════════
  async function handleSuggest() {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    if (!query.trim()) { setError("Введите запрос"); return; }

    setSuggestLoading(true);
    setError("");
    setSuggestions([]);

    try {
      const res = await aiSuggestProducts(token, query.trim());
      setSuggestions(res.suggestions);
      setSuggestAttempts(res.attempts);
      setSuggestCached(res.cached);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка AI");
    } finally {
      setSuggestLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STEP 1 → 2: Pick → generate full draft
  // ════════════════════════════════════════════════════════════════════
  async function handlePick(s: ProductSuggestion) {
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setPicked(s);
    setStep(2);
    setDraftLoading(true);
    setError("");
    setDraft(null);

    try {
      const res = await aiCreateProductDraft(token, s.name_en);
      setDraft(res.draft);
      setDraftCached(res.cached);
      setCorrections(res.corrections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка генерации черновика");
      setStep(1);
    } finally {
      setDraftLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STEP 2 → 3: Save product
  // ════════════════════════════════════════════════════════════════════
  async function handleSave() {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    if (!draft) return;

    const productType = draft.product_type?.value;
    if (!productType) {
      setError("⚠️ Выберите тип продукта");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const requestData: CreateProductRequest = {
        name_input: query,
        name_en: draft.names.en.value || "",
        name_pl: draft.names.pl.value || "",
        name_uk: draft.names.uk.value || "",
        name_ru: draft.names.ru.value || "",
        description: draft.description_en.value || "",
        product_type: productType,
      };

      const product = await createProduct(token, requestData);

      // Save multilingual descriptions (not supported in createProduct — patch separately)
      const descUpdate: UpdateProductRequest = {};
      if (draft.description_ru?.value) descUpdate.description_ru = draft.description_ru.value;
      if (draft.description_pl?.value) descUpdate.description_pl = draft.description_pl.value;
      if (draft.description_uk?.value) descUpdate.description_uk = draft.description_uk.value;
      if (Object.keys(descUpdate).length > 0) {
        await updateProduct(token, product.id, descUpdate);
      }

      if (imageFile) {
        setUploading(true);
        const opts = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: "image/jpeg" as const,
        };
        const compressed = await imageCompression(imageFile, opts);
        await uploadProductImage(token, product.id, compressed);
        setUploading(false);
      }

      setSuccessMessage("✓ Продукт создан!");
      setStep(3);
    } catch (e) {
      if (e instanceof Error && e.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else if (e instanceof Error && e.message.includes("409")) {
        setError("Продукт с таким названием уже существует");
      } else {
        setError(e instanceof Error ? e.message : "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  // ── Draft field helpers ──
  function updateName(lang: "en" | "ru" | "pl" | "uk", val: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      names: {
        ...draft.names,
        [lang]: { ...draft.names[lang], value: val, source: "ai_corrected" as const },
      },
    });
  }
  function updateNutrition(field: keyof ProductDraft["nutrition"], val: number | null) {
    if (!draft) return;
    setDraft({
      ...draft,
      nutrition: {
        ...draft.nutrition,
        [field]: { ...draft.nutrition[field], value: val, source: "ai_corrected" as const },
      },
    });
  }
  function updateDescription(lang: string, val: string) {
    if (!draft) return;
    const key = `description_${lang}` as keyof ProductDraft;
    setDraft({
      ...draft,
      [key]: { ...(draft[key] as DraftField<string>), value: val, source: "ai_corrected" as const },
    });
  }
  function updateProductType(val: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      product_type: { ...draft.product_type, value: val, source: "manual" as const },
    });
  }
  function updateUnit(val: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      unit: { ...draft.unit, value: val, source: "manual" as const },
    });
  }

  // ── Image ──
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Поддерживаются JPEG, PNG, WebP");
      return;
    }
    setImageFile(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => router.push("/products")}
        >
          Продукты
        </Button>
        <span>/</span>
        <span>Новый продукт</span>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Добавить продукт в каталог</h1>
        <p className="text-muted-foreground mt-1">
          AI предложит варианты → вы выберете → AI заполнит данные → проверите и опубликуете
        </p>
      </div>

      <StepBar current={step} />

      {/* ─── STEP 0: Query ─────────────────────────────────────────── */}
      {step === 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Что хотите добавить?
            </CardTitle>
            <CardDescription>
              Опишите на любом языке — категорию, тип продукта или конкретный ингредиент.
              <br />
              <span className="text-muted-foreground/70">
                Например: суперфуды, экзотические орехи, протеиновые продукты, семена для ЗОЖ
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Например: суперфуды, семена чиа, ореховые масла..."
                className="text-base py-6 border-2 border-primary/20 focus-visible:border-primary/50"
                autoFocus
                disabled={suggestLoading}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSuggest();
                  }
                }}
              />
              <Button
                onClick={handleSuggest}
                disabled={suggestLoading || !query.trim()}
                size="lg"
                className="gap-2 whitespace-nowrap px-8"
              >
                {suggestLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Думаю...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Найти варианты
                  </>
                )}
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 1: Pick suggestion ───────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(0)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Изменить запрос
            </Button>
            <span className="text-sm text-muted-foreground">
              AI нашёл <strong>{suggestions.length}</strong> вариантов для:{" "}
              <em>«{query}»</em>
            </span>
            {suggestCached ? (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                📦 из кеша
              </span>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                ✨ {suggestAttempts} {suggestAttempts === 1 ? "попытка" : "попытки"} · все новые
              </span>
            )}
          </div>

          <p className="text-sm font-medium text-muted-foreground">
            Выберите продукт для добавления в каталог:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handlePick(s)}
                className="text-left p-4 rounded-xl border-2 border-transparent bg-card hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-3xl">{s.emoji}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                </div>
                <p className="font-semibold text-base">{s.name_ru}</p>
                <p className="text-sm text-muted-foreground">{s.name_en}</p>
                {s.calories_hint && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    ≈ {s.calories_hint} ккал/100г
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                  {s.why_add}
                </p>
                <div className="mt-2">
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">
                    {s.product_type}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* ─── STEP 2: Draft review + save ──────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(1)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Назад к выбору
            </Button>
            {picked && (
              <span className="text-sm text-muted-foreground">
                {picked.emoji} <strong>{picked.name_ru}</strong> ({picked.name_en})
              </span>
            )}
          </div>

          {/* Loading */}
          {draftLoading && (
            <Card className="border-primary/30">
              <CardContent className="py-12 text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <p className="font-medium">AI заполняет данные...</p>
                <p className="text-sm text-muted-foreground">
                  Нутришн, описания на 4 языках, SEO — занимает ~20 сек
                </p>
              </CardContent>
            </Card>
          )}

          {/* Draft ready */}
          {!draftLoading && draft && (
            <>
              {/* Summary banner */}
              <Card
                className={
                  draft.confidence >= 0.85
                    ? "border-green-300 bg-green-50/20"
                    : "border-yellow-300 bg-yellow-50/20"
                }
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Eye className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Шаг 3 — Проверьте и отредактируйте</p>
                        <p className="text-sm text-muted-foreground">
                          Все поля заполнены AI — исправьте если нужно, затем сохраните
                          {draftCached && (
                            <span className="ml-1 text-xs">(из кеша)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {Math.round(draft.confidence * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">уверенность AI</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warnings */}
              {draft.quality_warnings.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Требует внимания:</p>
                    <ul className="text-sm space-y-1">
                      {draft.quality_warnings.map((w: QualityWarning) => (
                        <li key={w.field} className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              w.severity === "critical" ? "bg-red-500" : "bg-yellow-500"
                            }`}
                          />
                          <strong>{w.label_ru}</strong>: {w.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Corrections */}
              {corrections.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200 text-blue-900">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <p className="font-medium mb-1">Автоисправлено:</p>
                    <ul className="text-sm space-y-1">
                      {corrections.map((c, i) => (
                        <li key={i} className="flex items-center gap-2 flex-wrap">
                          <strong>{c.field}</strong>:
                          <span className="line-through text-red-600/70">{c.original_value}</span>
                          →{" "}
                          <span className="font-medium text-green-700">{c.corrected_to}</span>
                          <span className="text-muted-foreground text-xs">({c.reason})</span>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Names */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🌍 Названия</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DraftInput
                      label="English"
                      field={draft.names.en}
                      langCode="EN"
                      langColor="bg-blue-100 text-blue-700"
                      onChange={(v) => updateName("en", v)}
                    />
                    <DraftInput
                      label="Русский"
                      field={draft.names.ru}
                      langCode="RU"
                      langColor="bg-gray-100 text-gray-700"
                      onChange={(v) => updateName("ru", v)}
                    />
                    <DraftInput
                      label="Polski"
                      field={draft.names.pl}
                      langCode="PL"
                      langColor="bg-red-100 text-red-700"
                      onChange={(v) => updateName("pl", v)}
                    />
                    <DraftInput
                      label="Українська"
                      field={draft.names.uk}
                      langCode="UK"
                      langColor="bg-yellow-100 text-yellow-700"
                      onChange={(v) => updateName("uk", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Classification */}
              <Card className={!draft.product_type.value ? "border-red-300" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📂 Классификация</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm">
                        Тип продукта
                        <ConfidenceBadge confidence={draft.product_type.confidence} />
                        {!draft.product_type.value && (
                          <span className="text-xs text-red-600 font-medium">⚠ обязательно</span>
                        )}
                      </Label>
                      <Select
                        value={draft.product_type.value || ""}
                        onValueChange={updateProductType}
                      >
                        <SelectTrigger
                          className={
                            !draft.product_type.value ? "border-red-300 bg-red-50/30" : ""
                          }
                        >
                          <SelectValue placeholder="Выберите тип..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vegetable">🥦 Овощи</SelectItem>
                          <SelectItem value="fruit">🍎 Фрукты</SelectItem>
                          <SelectItem value="grain">🌾 Злаки / крупы</SelectItem>
                          <SelectItem value="legume">🫘 Бобовые</SelectItem>
                          <SelectItem value="meat">🥩 Мясо</SelectItem>
                          <SelectItem value="poultry">🍗 Птица</SelectItem>
                          <SelectItem value="fish">🐟 Рыба</SelectItem>
                          <SelectItem value="seafood">🦐 Морепродукты</SelectItem>
                          <SelectItem value="dairy">🥛 Молочные</SelectItem>
                          <SelectItem value="egg">🥚 Яйца</SelectItem>
                          <SelectItem value="fat_oil">🫙 Жиры / масла</SelectItem>
                          <SelectItem value="nut_seed">🌰 Орехи / семена</SelectItem>
                          <SelectItem value="herb_spice">🌿 Зелень / специи</SelectItem>
                          <SelectItem value="mushroom">🍄 Грибы</SelectItem>
                          <SelectItem value="beverage">🧃 Напитки</SelectItem>
                          <SelectItem value="sweetener">🍯 Подсластители</SelectItem>
                          <SelectItem value="condiment">🧴 Соусы / приправы</SelectItem>
                          <SelectItem value="bakery">🍞 Выпечка</SelectItem>
                          <SelectItem value="supplement">💊 Добавки / суперфуды</SelectItem>
                          <SelectItem value="other">❓ Другое</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm">
                        Единица измерения
                        <ConfidenceBadge confidence={draft.unit.confidence} />
                      </Label>
                      <Select value={draft.unit.value || ""} onValueChange={updateUnit}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">кг</SelectItem>
                          <SelectItem value="g">г</SelectItem>
                          <SelectItem value="l">л</SelectItem>
                          <SelectItem value="ml">мл</SelectItem>
                          <SelectItem value="piece">шт</SelectItem>
                          <SelectItem value="bunch">пучок</SelectItem>
                          <SelectItem value="pack">уп</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🥗 Пищевая ценность (на 100г)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <DraftNumberInput
                      label="Калории"
                      field={draft.nutrition.calories_per_100g}
                      suffix="ккал"
                      onChange={(v) => updateNutrition("calories_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Белки"
                      field={draft.nutrition.protein_per_100g}
                      suffix="г"
                      onChange={(v) => updateNutrition("protein_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Жиры"
                      field={draft.nutrition.fat_per_100g}
                      suffix="г"
                      onChange={(v) => updateNutrition("fat_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Углеводы"
                      field={draft.nutrition.carbs_per_100g}
                      suffix="г"
                      onChange={(v) => updateNutrition("carbs_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Клетчатка"
                      field={draft.nutrition.fiber_per_100g}
                      suffix="г"
                      onChange={(v) => updateNutrition("fiber_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Сахар"
                      field={draft.nutrition.sugar_per_100g}
                      suffix="г"
                      onChange={(v) => updateNutrition("sugar_per_100g", v)}
                    />
                    <DraftNumberInput
                      label="Плотность"
                      field={draft.nutrition.density_g_per_ml}
                      suffix="г/мл"
                      onChange={(v) => updateNutrition("density_g_per_ml", v)}
                    />
                    <DraftNumberInput
                      label="Порция"
                      field={draft.nutrition.typical_portion_g}
                      suffix="г"
                      onChange={(v) => updateNutrition("typical_portion_g", v)}
                    />
                    <DraftNumberInput
                      label="Срок годн."
                      field={draft.nutrition.shelf_life_days}
                      suffix="дней"
                      onChange={(v) => updateNutrition("shelf_life_days", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Descriptions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📝 Описания</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(["en", "ru", "pl", "uk"] as const).map((lang) => {
                    const key = `description_${lang}` as keyof ProductDraft;
                    const field = draft[key] as DraftField<string>;
                    const labels: Record<string, string> = {
                      en: "English",
                      ru: "Русский",
                      pl: "Polski",
                      uk: "Українська",
                    };
                    const colors: Record<string, string> = {
                      en: "bg-blue-100 text-blue-700",
                      ru: "bg-gray-100 text-gray-700",
                      pl: "bg-red-100 text-red-700",
                      uk: "bg-yellow-100 text-yellow-700",
                    };
                    return (
                      <div key={lang} className="space-y-1">
                        <Label className="flex items-center gap-2 text-sm">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[lang]}`}
                          >
                            {lang.toUpperCase()}
                          </span>
                          {labels[lang]}
                          <ConfidenceBadge confidence={field.confidence} />
                        </Label>
                        <Textarea
                          value={field.value || ""}
                          onChange={(e) => updateDescription(lang, e.target.value)}
                          rows={2}
                          className={!field.value ? "border-red-300 bg-red-50/30" : ""}
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* SEO */}
              {draft.seo?.seo_title?.value && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">🔍 SEO (сгенерировано AI)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Title: </span>
                      {draft.seo.seo_title.value}
                    </div>
                    <div>
                      <span className="text-muted-foreground">H1: </span>
                      {draft.seo.seo_h1.value}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {draft.seo.seo_description.value}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Image */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📷 Фото продукта</CardTitle>
                  <CardDescription>JPEG, PNG или WebP (сожмётся до 1 МБ)</CardDescription>
                </CardHeader>
                <CardContent>
                  {imagePreview ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-muted">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="img"
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleImageChange}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <Input
                        id="img"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="img"
                        className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        Нажмите чтобы загрузить фото
                      </Label>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Save buttons */}
              <div className="flex gap-3 justify-end pb-8">
                <Button
                  variant="outline"
                  onClick={() => router.push("/products")}
                  disabled={saving || uploading}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || uploading || !draft.product_type.value}
                  size="lg"
                  className="gap-2 min-w-[160px]"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Загрузка фото...
                    </>
                  ) : saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Сохранение...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Сохранить продукт
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Error when draft failed */}
          {error && !draftLoading && !draft && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* ─── STEP 3: Success ───────────────────────────────────────── */}
      {step === 3 && (
        <Card className="border-green-300 bg-green-50/30">
          <CardContent className="py-16 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-800">
              {successMessage || "Продукт создан!"}
            </h2>
            {picked && (
              <p className="text-muted-foreground">
                {picked.emoji} <strong>{picked.name_ru}</strong> добавлен в каталог
              </p>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(0);
                  setQuery("");
                  setSuggestions([]);
                  setSuggestAttempts(0);
                  setSuggestCached(false);
                  setPicked(null);
                  setDraft(null);
                  setImageFile(null);
                  setImagePreview(null);
                  setSuccessMessage("");
                  setError("");
                }}
              >
                Добавить ещё
              </Button>
              <Button onClick={() => router.push("/products")}>К списку продуктов</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
