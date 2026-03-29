"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  generateIntentPage,
  updateIntentPage,
  publishIntentPage,
  uploadImageToR2,
  type IntentPage,
  type ContentBlock,
} from "@/lib/intent-pages-api";
import { IngredientAutocomplete } from "@/components/ingredient-autocomplete";

import {
  ArrowLeft,
  Zap,
  Loader2,
  FileText,
  Rocket,
  CheckCircle2,
  ImageIcon,
  Upload,
  ChevronDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// ── Image labels ──
const IMAGE_KEY_LABELS: Record<string, string> = {
  hero: "🖼 Hero — главное фото",
  benefits: "💚 Benefits — польза",
  nutrition: "📊 Nutrition — калории",
  cooking: "🍳 Cooking — приготовление",
};

// ── Image Upload Slot ──
function ImageUploadSlot({
  pageId, imageKey, src, alt, token, onUploaded,
}: {
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

// ══════════════════════════════════════════════════════════════════
// STEP TYPES
// ══════════════════════════════════════════════════════════════════
type CreateStep = "setup" | "preview" | "saved";

const STEPS = [
  { key: "setup", label: "Настройка", icon: "⚙️" },
  { key: "preview", label: "Проверка + Фото", icon: "👁" },
  { key: "saved", label: "Публикация", icon: "🚀" },
] as const;

// ══════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function NewSeoPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // ── Step ──
  const [step, setStep] = useState<CreateStep>("setup");

  // ── Step 1: setup ──
  const [locale, setLocale] = useState("pl");
  const [intentType, setIntentType] = useState("question");
  const [entityA, setEntityA] = useState("");
  const [entityB, setEntityB] = useState("");
  const [generating, setGenerating] = useState(false);

  // ── Step 2: preview / edit ──
  const [page, setPage] = useState<IntentPage | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [answer, setAnswer] = useState("");
  const [slug, setSlug] = useState("");
  const [editableBlocks, setEditableBlocks] = useState<ContentBlock[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const imageBlocks = editableBlocks.filter(
    (b): b is ContentBlock & { type: "image" } => b.type === "image"
  );
  const uploadedCount = imageBlocks.filter((b) => "src" in b && b.src).length;

  const updateBlock = (index: number, changes: Partial<ContentBlock>) => {
    setEditableBlocks((prev) =>
      prev.map((b, i) => (i === index ? ({ ...b, ...changes } as ContentBlock) : b))
    );
  };

  // ── Auth ──
  const ensureToken = useCallback(async () => {
    if (token) return token;
    const t = await getToken();
    if (!t) { router.push("/login"); return null; }
    setToken(t);
    return t;
  }, [token, router]);

  // ── Generate ──
  const handleGenerate = async () => {
    if (!entityA.trim()) { toast.error("Укажите ингредиент / продукт"); return; }
    const t = await ensureToken();
    if (!t) return;
    setGenerating(true);
    setMessage(null);
    try {
      const created = await generateIntentPage(t, {
        intent_type: intentType,
        entity_a: entityA.trim().toLowerCase(),
        entity_b: intentType === "comparison" && entityB.trim() ? entityB.trim().toLowerCase() : undefined,
        locale,
      });
      setPage(created);
      setTitle(created.title);
      setDescription(created.description);
      setAnswer(created.answer);
      setSlug(created.slug);
      setEditableBlocks(Array.isArray(created.content_blocks) ? created.content_blocks : []);
      setStep("preview");
      setMessage({ type: "ok", text: "Страница сгенерирована! Проверьте контент и добавьте фото." });
    } catch (err) {
      setMessage({ type: "err", text: "Ошибка генерации: " + String(err) });
    } finally {
      setGenerating(false);
    }
  };

  // ── Save draft ──
  const handleSaveDraft = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    setSaving(true);
    try {
      const updated = await updateIntentPage(t, page.id, {
        title, description, answer, slug, content_blocks: editableBlocks,
      });
      setPage(updated);
      setStep("saved");
      setMessage({ type: "ok", text: "Сохранено в черновик ✅" });
    } catch (err) {
      setMessage({ type: "err", text: "Ошибка сохранения: " + String(err) });
    } finally {
      setSaving(false);
    }
  };

  // ── Publish ──
  const handlePublish = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    setPublishing(true);
    try {
      await updateIntentPage(t, page.id, {
        title, description, answer, slug, content_blocks: editableBlocks,
      });
      await publishIntentPage(t, page.id);
      toast.success("Опубликовано! 🚀 Страница доступна на сайте.");
      router.push("/seo");
    } catch (err) {
      setMessage({ type: "err", text: "Ошибка публикации: " + String(err) });
    } finally {
      setPublishing(false);
    }
  };

  // ── Image uploaded ──
  const handleImageUploaded = (updated: IntentPage) => {
    setPage(updated);
    if (Array.isArray(updated.content_blocks)) {
      setEditableBlocks((prev) =>
        prev.map((b) => {
          if (b.type !== "image") return b;
          const fresh = (updated.content_blocks as ContentBlock[]).find(
            (u): u is ContentBlock & { type: "image" } => u.type === "image" && u.key === b.key
          );
          return fresh ? { ...b, src: fresh.src } : b;
        })
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/seo")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">
            {step === "setup" && "Создать SEO-страницу"}
            {step === "preview" && "Проверка и фото"}
            {step === "saved" && "Черновик сохранён"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Шаг за шагом: настройка → генерация AI → фото → публикация
          </p>
        </div>
        {step === "preview" && (
          <Button
            size="sm"
            onClick={handleSaveDraft}
            disabled={saving}
            className="rounded-xl"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <FileText className="h-4 w-4 mr-1.5" />}
            Сохранить черновик
          </Button>
        )}
        {step === "saved" && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Rocket className="h-4 w-4 mr-1.5" />}
            Опубликовать
          </Button>
        )}
      </div>

      {/* ── Message ── */}
      {message && (
        <Alert
          variant={message.type === "err" ? "destructive" : "default"}
          className={message.type === "ok" ? "border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20" : ""}
        >
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* ── Step indicator (tabs style) ── */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl overflow-x-auto scrollbar-none">
        {STEPS.map((s, i) => {
          const isActive = step === s.key;
          const isPast =
            (step === "preview" && s.key === "setup") ||
            (step === "saved" && s.key !== "saved");
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                if (isPast) setStep(s.key as CreateStep);
              }}
              disabled={!isPast && !isActive}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : isPast
                    ? "text-emerald-600 hover:bg-muted/30 cursor-pointer"
                    : "text-muted-foreground"
              }`}
            >
              <span className="text-base leading-none">{isPast ? "✅" : s.icon}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════
         STEP 1: SETUP
      ══════════════════════════════════════════════════════════ */}
      {step === "setup" && (
        <div className="space-y-5">
          {/* Язык */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🌐 Язык</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: "pl", flag: "🇵🇱", label: "Polski" },
                { value: "en", flag: "🇬🇧", label: "English" },
                { value: "ru", flag: "🇷🇺", label: "Русский" },
                { value: "uk", flag: "🇺🇦", label: "Українська" },
              ].map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLocale(l.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    locale === l.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl">{l.flag}</span>
                  <span className="text-xs font-medium">{l.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Тип интента */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📝 Тип страницы</h2>
            <div className="grid grid-cols-4 gap-3">
              {[
                { value: "question", icon: "❓", label: "Вопрос", desc: "Полезен ли лосось?" },
                { value: "goal", icon: "🎯", label: "Цель", desc: "Лучшее для диеты" },
                { value: "comparison", icon: "⚖️", label: "Сравнение", desc: "Лосось vs тунец" },
                { value: "measure", icon: "📏", label: "Мера", desc: "Ложка муки в граммах" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setIntentType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center ${
                    intentType === t.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl">{t.icon}</span>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Ингредиент */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🥑 Продукт / Ингредиент</h2>
            <p className="text-xs text-muted-foreground">
              Введите 2+ буквы — появится список из базы ({locale.toUpperCase()})
            </p>
            <IngredientAutocomplete
              value={entityA}
              lang={locale}
              onChange={(v) => setEntityA(v)}
              placeholder="напр. salmon, almonds, авокадо..."
              disabled={generating}
            />
          </section>

          {/* Сравнить с */}
          {intentType === "comparison" && (
            <section className="glass rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚖️ Сравнить с</h2>
              <IngredientAutocomplete
                value={entityB}
                lang={locale}
                onChange={(v) => setEntityB(v)}
                placeholder="напр. cashews, tuna, масло оливы..."
                disabled={generating}
              />
            </section>
          )}

          {/* Кнопка генерации */}
          <Button
            className="w-full rounded-xl h-12 text-base"
            onClick={handleGenerate}
            disabled={generating || !entityA.trim()}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                AI генерирует страницу…
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Сгенерировать страницу
              </>
            )}
          </Button>
          {generating && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">
              ⏳ Gemini создаёт контент: заголовок, описание, 16 блоков, 4 FAQ…
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         STEP 2: PREVIEW + EDIT + PHOTOS
      ══════════════════════════════════════════════════════════ */}
      {step === "preview" && page && (
        <div className="space-y-5">
          {/* SEO мета */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🔍 SEO Мета</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Заголовок
                  <span className={
                    title.length >= 50 && title.length <= 60 ? "text-emerald-600 text-xs" :
                    title.length >= 40 ? "text-amber-600 text-xs" : "text-red-500 text-xs"
                  }>
                    ({title.length}/60)
                  </span>
                </Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Описание
                  <span className={
                    description.length >= 120 && description.length <= 155 ? "text-emerald-600 text-xs" :
                    description.length >= 80 ? "text-amber-600 text-xs" : "text-red-500 text-xs"
                  }>
                    ({description.length}/155)
                  </span>
                </Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm rounded-xl" />
              </div>
            </div>
          </section>

          {/* Контент */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📝 Контент</h2>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Ответ
                <span className={
                  answer.length >= 400 && answer.length <= 800 ? "text-emerald-600 text-xs" :
                  answer.length >= 200 ? "text-amber-600 text-xs" : "text-red-500 text-xs"
                }>
                  ({answer.length} симв)
                </span>
              </Label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full text-sm bg-muted/30 rounded-xl p-3 min-h-[100px] max-h-[200px] border resize-y"
              />
            </div>
          </section>

          {/* Фото */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📸 Фото для статьи</h2>
              <Badge
                variant="secondary"
                className={
                  uploadedCount === imageBlocks.length && imageBlocks.length > 0
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-amber-500/15 text-amber-600"
                }
              >
                {uploadedCount}/{imageBlocks.length}
              </Badge>
            </div>
            {imageBlocks.length > 0 && token ? (
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
              <div className="bg-muted/30 rounded-xl p-6 text-center text-muted-foreground text-sm">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                AI не создал блоки с фото. Сохраните и перегенерируйте.
              </div>
            )}
          </section>

          {/* Превью блоков */}
          {editableBlocks.length > 0 && (
            <section className="glass rounded-2xl p-5 space-y-4">
              <details className="group">
                <summary className="cursor-pointer font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  📄 Превью статьи ({editableBlocks.length} блоков)
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-3 text-sm">
                  {editableBlocks.map((block, i) => {
                    if (block.type === "heading") return (
                      <div key={i} className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">H{block.level}</span>
                        <input
                          value={block.text}
                          onChange={(e) => updateBlock(i, { text: e.target.value })}
                          className={`w-full bg-background border rounded-xl px-3 py-1.5 ${block.level === 1 ? "text-base font-bold" : "text-sm font-semibold"}`}
                        />
                      </div>
                    );
                    if (block.type === "text") return (
                      <div key={i} className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Текст</span>
                        <textarea
                          value={block.content}
                          onChange={(e) => updateBlock(i, { content: e.target.value })}
                          rows={Math.max(2, Math.ceil(block.content.length / 80))}
                          className="w-full bg-background border rounded-xl px-3 py-1.5 text-sm text-muted-foreground leading-relaxed resize-y"
                        />
                      </div>
                    );
                    if (block.type === "image") return (
                      <div key={i} className="flex items-center gap-2 py-1.5 text-xs text-muted-foreground border border-dashed rounded-xl px-3">
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
              </details>
            </section>
          )}

          {/* FAQ */}
          {page.faq && page.faq.length > 0 && (
            <section className="glass rounded-2xl p-5 space-y-4">
              <details className="group">
                <summary className="cursor-pointer font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  💬 FAQ ({page.faq.length})
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-2">
                  {page.faq.map((f, i) => (
                    <div key={i} className="bg-muted/30 rounded-xl p-3 text-sm">
                      <div className="font-medium">{f.question}</div>
                      <div className="text-muted-foreground mt-1 text-xs">{f.answer}</div>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}

          {/* Кнопки */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setStep("setup")}
            >
              ← Настройки
            </Button>
            <div className="flex-1" />
            <Button
              className="rounded-xl h-11 px-6"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Сохранить в черновик
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         STEP 3: SAVED — можно опубликовать
      ══════════════════════════════════════════════════════════ */}
      {step === "saved" && page && (
        <div className="space-y-5">
          {/* Успех */}
          <section className="glass rounded-2xl p-5">
            <div className="text-center py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold">Черновик сохранён!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Страница «{title}» сохранена как черновик. Вы можете опубликовать её сейчас или позже.
              </p>
            </div>
          </section>

          {/* SERP превью */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🔍 Предпросмотр в Google</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border shadow-sm space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <img
                  src="https://www.google.com/s2/favicons?domain=dima-fomin.pl&sz=16"
                  alt="" className="w-4 h-4 rounded-full"
                />
                <span>dima-fomin.pl</span>
                <span className="text-zinc-400">›</span>
                <span>{locale}</span>
                <span className="text-zinc-400">›</span>
                <span className="truncate">{slug}</span>
              </div>
              <h3 className="text-[#1a0dab] dark:text-blue-400 text-lg font-normal leading-snug">
                {title}
              </h3>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                {description}
              </p>
            </div>
          </section>

          {/* Статистика */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📊 Статистика</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-lg font-bold">{editableBlocks.length}</div>
                <div className="text-xs text-muted-foreground">Блоков</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-lg font-bold">{uploadedCount}/{imageBlocks.length}</div>
                <div className="text-xs text-muted-foreground">Фото</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-lg font-bold">{page.faq?.length || 0}</div>
                <div className="text-xs text-muted-foreground">FAQ</div>
              </div>
            </div>
          </section>

          {/* Кнопки */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setStep("preview")}
            >
              ← Редактировать
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => router.push("/seo")}
            >
              Оставить черновик
            </Button>
            <Button
              className="rounded-xl h-11 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
              Опубликовать
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
