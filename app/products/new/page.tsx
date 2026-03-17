"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import {
  createProduct,
  uploadProductImage,
  getCategories,
  type CreateProductRequest,
  type Product,
  type Category,
} from "@/lib/api";
import {
  aiCreateProductDraft,
  type ProductDraft,
  type DraftField,
  type FieldConfidence,
  type QualityWarning,
  type DraftCorrection,
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
  Lightbulb,
  CheckCircle2,
  Upload,
  X,
  Globe,
  Sparkles,
  Eye,
  Shield,
  Info,
  Wrench,
} from "lucide-react";

// ── Badge component for field confidence ──
function ConfidenceBadge({ confidence }: { confidence: FieldConfidence }) {
  const config = {
    high: { label: "AI ✓", className: "bg-green-100 text-green-700 border-green-200" },
    medium: { label: "AI ~", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "AI ?", className: "bg-red-100 text-red-700 border-red-200" },
    not_applicable: { label: "н/п", className: "bg-gray-100 text-gray-500 border-gray-200" },
  }[confidence];

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}

// ── Draft field display with badge ──
function DraftInput({
  label,
  field,
  langBadge,
  onChange,
}: {
  label: string;
  field: DraftField<string>;
  langBadge?: { code: string; className: string };
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-2 text-sm">
        {langBadge && (
          <span className={`text-[10px] font-bold px-1 rounded ${langBadge.className}`}>
            {langBadge.code}
          </span>
        )}
        {label}
        <ConfidenceBadge confidence={field.confidence} />
      </Label>
      <Input
        value={field.value || ""}
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
        <Label className="flex items-center gap-2 text-sm">
          {label} <ConfidenceBadge confidence="not_applicable" />
        </Label>
        <div className="h-9 flex items-center px-3 rounded-md bg-gray-50 text-gray-400 text-sm border">
          Не применимо
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-2 text-sm">
        {label} {suffix && <span className="text-muted-foreground text-xs">({suffix})</span>}
        <ConfidenceBadge confidence={field.confidence} />
      </Label>
      <Input
        type="number"
        step="any"
        value={field.value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className={
          field.value == null
            ? "border-red-300 bg-red-50/30"
            : field.confidence === "low"
            ? "border-yellow-300 bg-yellow-50/30"
            : ""
        }
      />
    </div>
  );
}

export default function NewProductPage() {
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiMode, setIsAiMode] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const router = useRouter();

  // ── AI Draft state ──
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftCached, setDraftCached] = useState(false);
  const [draftModel, setDraftModel] = useState("");
  const [corrections, setCorrections] = useState<DraftCorrection[]>([]);

  // ── Manual mode form ──
  const [formData, setFormData] = useState<CreateProductRequest>({
    name_en: "",
    name_pl: "",
    name_uk: "",
    name_ru: "",
    category_id: "",
    unit: "кг",
    description: "",
  });

  useEffect(() => {
    async function loadCategories() {
      const token = getToken();
      if (!token) return;
      try {
        const data = await getCategories(token);
        setCategories(data);
        if (data.length > 0 && !formData.category_id) {
          setFormData((prev) => ({ ...prev, category_id: data[0].id }));
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    loadCategories();
  }, []);

  // ── Image handling ──
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Поддерживаются только JPEG, PNG и WebP.");
      return;
    }
    setImageFile(file);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(token: string, productId: string, file: File) {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/jpeg" as const,
    };
    const compressedFile = await imageCompression(file, options);
    await uploadProductImage(token, productId, compressedFile);
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: AI generates draft (no save!)
  // ═══════════════════════════════════════════════════════════════════
  async function handleGenerateDraft() {
    const token = getToken();
    if (!token) { router.push("/login"); return; }
    if (!nameInput.trim()) { setError("Введите название продукта"); return; }

    setAiLoading(true);
    setError("");
    setDraft(null);
    setCorrections([]);

    try {
      const res = await aiCreateProductDraft(token, nameInput.trim());
      setDraft(res.draft);
      setDraftCached(res.cached);
      setDraftModel(res.model);
      setCorrections(res.corrections ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI ошибка");
    } finally {
      setAiLoading(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Save product (from draft or manual form)
  // ═══════════════════════════════════════════════════════════════════
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) { router.push("/login"); return; }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      let requestData: CreateProductRequest;

      if (isAiMode && draft) {
        // Build request from draft fields — user may have edited them
        // �� product_type from AI draft → backend enforce_category() validates
        const productType = draft.product_type?.value || undefined;
        if (productType === "other" || !productType) {
          setError("⚠️ Тип продукта не определён. Укажите product_type перед сохранением.");
          setLoading(false);
          return;
        }

        requestData = {
          name_input: nameInput,
          name_en: draft.names.en.value || "",
          name_pl: draft.names.pl.value || "",
          name_uk: draft.names.uk.value || "",
          name_ru: draft.names.ru.value || "",
          description: draft.description_en.value || "",
          product_type: productType,
        };
      } else {
        if (
          !formData.name_en?.trim() ||
          !formData.name_pl?.trim() ||
          !formData.name_uk?.trim() ||
          !formData.name_ru?.trim()
        ) {
          setError("Введите названия на всех 4 языках");
          setLoading(false);
          return;
        }
        requestData = formData;
      }

      const product = await createProduct(token, requestData);

      // Upload image if selected
      if (imageFile) {
        setUploading(true);
        await uploadImage(token, product.id, imageFile);
        setUploading(false);
      }

      setSuccessMessage("✓ Продукт успешно создан!");
      setTimeout(() => router.push("/products"), 1000);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else if (err instanceof Error && (err.message.includes("409") || err.message.includes("CONFLICT"))) {
        setError("Продукт с таким названием уже существует.");
      } else {
        setError(err instanceof Error ? err.message : "Ошибка при создании");
      }
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  // ── Helpers for draft field updates ──
  function updateDraftName(lang: "en" | "ru" | "pl" | "uk", val: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      names: {
        ...draft.names,
        [lang]: { ...draft.names[lang], value: val, source: "ai_corrected" as const },
      },
    });
  }

  function updateDraftNutrition(field: keyof ProductDraft["nutrition"], val: number | null) {
    if (!draft) return;
    setDraft({
      ...draft,
      nutrition: {
        ...draft.nutrition,
        [field]: { ...draft.nutrition[field], value: val, source: "ai_corrected" as const },
      },
    });
  }

  function updateDraftDescription(lang: string, val: string) {
    if (!draft) return;
    const key = `description_${lang}` as keyof ProductDraft;
    setDraft({
      ...draft,
      [key]: { ...(draft[key] as DraftField<string>), value: val, source: "ai_corrected" as const },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Button variant="link" className="p-0 h-auto font-normal" onClick={() => router.push("/products")}>
          Продукты
        </Button>
        <span>/</span>
        <span>Новый продукт</span>
      </div>

      <div className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Создать продукт</h1>
        <p className="text-muted-foreground">
          {isAiMode ? "AI подготовит данные → вы проверите → сохраните" : "Ручной ввод всех данных"}
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={isAiMode ? "default" : "outline"}
          size="sm"
          onClick={() => { setIsAiMode(true); setDraft(null); setCorrections([]); }}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" /> Быстро (AI)
        </Button>
        <Button
          variant={!isAiMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsAiMode(false)}
          className="gap-2"
        >
          <Shield className="h-4 w-4" /> Полный контроль
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* ═══════════ AI MODE ═══════════ */}
        {isAiMode && (
          <>
            {/* Step 1: Input */}
            <Card className="border-primary/50 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" style={{ animationDelay: "75ms" }} />
                  <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" style={{ animationDelay: "150ms" }} />
                </div>
              </div>
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Шаг 1 — Опишите продукт
                </CardTitle>
                <CardDescription>
                  Введите на любом языке. AI переведёт, классифицирует и заполнит данные.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Например: Свежее молоко 3.2% 1л"
                    className="text-lg py-6 border-2 border-primary/20 focus-visible:border-primary/50"
                    autoFocus
                    disabled={aiLoading}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGenerateDraft(); }}}
                  />
                  <Button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={aiLoading || !nameInput.trim()}
                    size="lg"
                    className="gap-2 whitespace-nowrap"
                  >
                    {aiLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Генерация...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Создать черновик</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI создаст черновик — вы проверите и отредактируете перед сохранением
                </p>
              </CardContent>
            </Card>

            {/* Step 2: Draft Review */}
            {draft && (
              <>
                {/* Confidence Header */}
                <Card className={draft.confidence >= 0.85 ? "border-green-300 bg-green-50/30" : draft.confidence >= 0.6 ? "border-yellow-300 bg-yellow-50/30" : "border-red-300 bg-red-50/30"}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Eye className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            Шаг 2 — Проверьте черновик
                            {draftCached && <span className="text-xs text-muted-foreground ml-2">(из кеша)</span>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Отредактируйте поля если нужно, затем нажмите «Сохранить»
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

                {/* Quality Warnings */}
                {draft.quality_warnings.length > 0 && (
                  <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      <p className="font-medium mb-1">⚠️ AI не уверен в некоторых полях:</p>
                      <ul className="text-sm space-y-1">
                        {draft.quality_warnings.map((w) => (
                          <li key={w.field} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${w.severity === "critical" ? "bg-red-500" : "bg-yellow-500"}`} />
                            <strong>{w.label_ru}</strong>: {w.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Validation Layer Corrections */}
                {corrections.length > 0 && (
                  <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                    <Wrench className="h-4 w-4 text-blue-600" />
                    <AlertDescription>
                      <p className="font-medium mb-1">🔧 Validation Layer автоматически исправил:</p>
                      <ul className="text-sm space-y-1">
                        {corrections.map((c, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <strong>{c.field}</strong>:
                            <span className="line-through text-red-600/70">{c.original_value}</span>
                            <span>→</span>
                            <span className="font-medium text-green-700">{c.corrected_to}</span>
                            <span className="text-muted-foreground">({c.reason})</span>
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Names */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">🌍 Названия (4 языка)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DraftInput
                        label="English"
                        field={draft.names.en}
                        langBadge={{ code: "EN", className: "bg-blue-100 text-blue-700" }}
                        onChange={(v) => updateDraftName("en", v)}
                      />
                      <DraftInput
                        label="Русский"
                        field={draft.names.ru}
                        langBadge={{ code: "RU", className: "bg-gray-100 text-gray-700" }}
                        onChange={(v) => updateDraftName("ru", v)}
                      />
                      <DraftInput
                        label="Polski"
                        field={draft.names.pl}
                        langBadge={{ code: "PL", className: "bg-red-100 text-red-700" }}
                        onChange={(v) => updateDraftName("pl", v)}
                      />
                      <DraftInput
                        label="Українська"
                        field={draft.names.uk}
                        langBadge={{ code: "UK", className: "bg-yellow-100 text-yellow-700" }}
                        onChange={(v) => updateDraftName("uk", v)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Classification */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">📂 Классификация</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-sm">
                          Тип продукта <ConfidenceBadge confidence={draft.product_type.confidence} />
                        </Label>
                        <Input value={draft.product_type.value || ""} readOnly className="bg-muted/50" />
                      </div>
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-sm">
                          Единица <ConfidenceBadge confidence={draft.unit.confidence} />
                        </Label>
                        <Input value={draft.unit.value || ""} readOnly className="bg-muted/50" />
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
                      <DraftNumberInput label="Калории" field={draft.nutrition.calories_per_100g} suffix="ккал" onChange={(v) => updateDraftNutrition("calories_per_100g", v)} />
                      <DraftNumberInput label="Белки" field={draft.nutrition.protein_per_100g} suffix="г" onChange={(v) => updateDraftNutrition("protein_per_100g", v)} />
                      <DraftNumberInput label="Жиры" field={draft.nutrition.fat_per_100g} suffix="г" onChange={(v) => updateDraftNutrition("fat_per_100g", v)} />
                      <DraftNumberInput label="Углеводы" field={draft.nutrition.carbs_per_100g} suffix="г" onChange={(v) => updateDraftNutrition("carbs_per_100g", v)} />
                      <DraftNumberInput label="Клетчатка" field={draft.nutrition.fiber_per_100g} suffix="г" onChange={(v) => updateDraftNutrition("fiber_per_100g", v)} />
                      <DraftNumberInput label="Сахар" field={draft.nutrition.sugar_per_100g} suffix="г" onChange={(v) => updateDraftNutrition("sugar_per_100g", v)} />
                      <DraftNumberInput label="Плотность" field={draft.nutrition.density_g_per_ml} suffix="г/мл" onChange={(v) => updateDraftNutrition("density_g_per_ml", v)} />
                      <DraftNumberInput label="Порция" field={draft.nutrition.typical_portion_g} suffix="г" onChange={(v) => updateDraftNutrition("typical_portion_g", v)} />
                      <DraftNumberInput label="Срок годн." field={draft.nutrition.shelf_life_days} suffix="дней" onChange={(v) => updateDraftNutrition("shelf_life_days", v)} />
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
                      const labels = { en: "English", ru: "Русский", pl: "Polski", uk: "Українська" };
                      return (
                        <div key={lang} className="space-y-1">
                          <Label className="flex items-center gap-2 text-sm">
                            {labels[lang]} <ConfidenceBadge confidence={field.confidence} />
                          </Label>
                          <Textarea
                            value={field.value || ""}
                            onChange={(e) => updateDraftDescription(lang, e.target.value)}
                            rows={2}
                            className={!field.value ? "border-red-300 bg-red-50/30" : ""}
                          />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* SEO */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">�� SEO</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm">
                        Title <ConfidenceBadge confidence={draft.seo.seo_title.confidence} />
                      </Label>
                      <Input value={draft.seo.seo_title.value || ""} readOnly className="bg-muted/50" />
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm">
                        Description <ConfidenceBadge confidence={draft.seo.seo_description.confidence} />
                      </Label>
                      <Textarea value={draft.seo.seo_description.value || ""} readOnly rows={2} className="bg-muted/50" />
                    </div>
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-sm">
                        H1 <ConfidenceBadge confidence={draft.seo.seo_h1.confidence} />
                      </Label>
                      <Input value={draft.seo.seo_h1.value || ""} readOnly className="bg-muted/50" />
                    </div>
                  </CardContent>
                </Card>

                {/* Seasons */}
                {draft.seasons.value && draft.seasons.value.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">📅 Сезонность</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {draft.seasons.value.map((s) => (
                          <span key={s} className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700 border border-green-200">
                            {s === "AllYear" ? "🗓 Весь год" : s === "Spring" ? "🌱 Весна" : s === "Summer" ? "☀️ Лето" : s === "Autumn" ? "🍂 Осень" : "❄️ Зима"}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ MANUAL MODE ═══════════ */}
        {!isAiMode && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Ручное заполнение</CardTitle>
              <CardDescription>
                Введите все названия и детали продукта вручную
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { id: "name_en", label: "English", code: "EN", cls: "bg-blue-100 text-blue-700" },
                  { id: "name_pl", label: "Polski", code: "PL", cls: "bg-red-100 text-red-700" },
                  { id: "name_uk", label: "Українська", code: "UK", cls: "bg-yellow-100 text-yellow-700" },
                  { id: "name_ru", label: "Русский", code: "RU", cls: "bg-gray-100 text-gray-700" },
                ] as const).map(({ id, label, code, cls }) => (
                  <div key={id} className="space-y-2">
                    <Label htmlFor={id} className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1 rounded ${cls}`}>{code}</span>
                      {label} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={id}
                      value={(formData as Record<string, string>)[id] || ""}
                      onChange={(e) => setFormData({ ...formData, [id]: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Категория <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                    disabled={loading || categories.length === 0}
                  >
                    <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name_ru || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Единица измерения <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    disabled={loading}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="кг">кг (Килограмм)</SelectItem>
                      <SelectItem value="л">л (Литр)</SelectItem>
                      <SelectItem value="шт">шт (Штука)</SelectItem>
                      <SelectItem value="уп">уп (Упаковка)</SelectItem>
                      <SelectItem value="г">г (Грамм)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Описание</Label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={loading}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════ IMAGE UPLOAD (shared) ═══════════ */}
        <Card>
          <CardHeader>
            <CardTitle>Фото продукта</CardTitle>
            <CardDescription>JPEG, PNG или WebP (автоматическое сжатие до 1MB)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imagePreview ? (
              <div className="space-y-3">
                <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                    disabled={loading || uploading}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Input id="image" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} disabled={loading || uploading} className="hidden" />
                <Label htmlFor="image" className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  Нажмите чтобы загрузить фото
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════ ERRORS / SUCCESS ═══════════ */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* ═══════════ SAVE BUTTON ═══════════ */}
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/products")} disabled={loading || uploading}>
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={loading || uploading || (isAiMode && !draft)}
            size="lg"
            className="gap-2"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Загрузка фото...</>
            ) : loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Сохранение...</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> Сохранить продукт</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
