"use client";

import { useEffect, useState, use } from "react";
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
  type LabComboPage,
} from "@/lib/lab-combos-api";

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
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const BLOG_BASE = "https://dima-fomin.pl";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  published: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

// ── Image Upload Block ────────────────────────────────────────────────

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
            uploading ? "opacity-50 pointer-events-none" : "hover:border-primary hover:text-primary"
          }`}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Загрузка…" : "Загрузить фото"}
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
          нет изображения
        </div>
      )}
    </div>
  );
}

// ── Section Wrapper ───────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
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
          {title}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0 pb-5 px-4 space-y-4">{children}</CardContent>}
    </Card>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────

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

  // Editable fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [h1, setH1] = useState("");
  const [intro, setIntro] = useState("");
  const [whyItWorks, setWhyItWorks] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Save / action states
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Image upload states
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────

  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
  }, [router]);

  // ── Load combo by id ──────────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        // Fetch all combos and find by id (no single-get endpoint yet)
        const all = await getLabCombos(token, { limit: 500 });
        const found = all.find((c) => c.id === id);
        if (!found) {
          toast.error("Combo не найден");
          router.push("/lab-combos");
          return;
        }
        setCombo(found);
        populateFields(found);
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

  // ── Save ──────────────────────────────────────────────────────────

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

  // ── Publish / Archive / Delete ─────────────────────────────────────

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

  // ── Image uploads ─────────────────────────────────────────────────

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

  const handleTypedUpload = async (file: File, kind: "process" | "detail") => {
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
      const updated = await saveTypedImageUrl(token, combo.id, kind, public_url);
      setCombo(updated);
      toast.success(`${kind === "process" ? "Process" : "Detail"} загружен!`);
    } catch (err: unknown) {
      toast.error("Ошибка загрузки", { description: String(err) });
    } finally {
      setUploadingKind(null);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────

  if (loading || !combo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/lab-combos")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <FlaskConical className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-xs text-muted-foreground truncate">
                /{combo.slug}
              </span>
            </div>
          </div>

          {/* Center: status + locale */}
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
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {combo.status === "published" && (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">На сайте</span>
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
              {saved ? "Сохранено!" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Editor + Sidebar ── */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 items-start">
          {/* ────────────────────────────────────────────────────────
              LEFT: Main editor (flex-1)
          ──────────────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* ── Block 1: Images ── */}
            <Section title="📸 Изображения">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ImageBlock
                  label="Hero — готовое блюдо"
                  emoji="🖼️"
                  imageUrl={combo.image_url}
                  uploading={uploadingKind === "hero"}
                  onUpload={handleHeroUpload}
                />
                <ImageBlock
                  label="Process — процесс готовки"
                  emoji="🔥"
                  imageUrl={combo.process_image_url}
                  uploading={uploadingKind === "process"}
                  onUpload={(f) => handleTypedUpload(f, "process")}
                />
                <ImageBlock
                  label="Detail — ингредиенты"
                  emoji="🥑"
                  imageUrl={combo.detail_image_url}
                  uploading={uploadingKind === "detail"}
                  onUpload={(f) => handleTypedUpload(f, "detail")}
                />
              </div>
            </Section>

            {/* ── Block 2: SEO Content ── */}
            <Section title="📝 SEO-контент">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex justify-between">
                  <span>Title</span>
                  <span className={title.length > 60 ? "text-red-500" : "text-muted-foreground"}>
                    {title.length}/60
                  </span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-medium"
                  placeholder="SEO заголовок страницы"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex justify-between">
                  <span>Meta Description</span>
                  <span className={description.length > 155 ? "text-red-500" : "text-muted-foreground"}>
                    {description.length}/155
                  </span>
                </Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Описание для поисковых результатов"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">H1 — заголовок на странице</Label>
                <Input
                  value={h1}
                  onChange={(e) => setH1(e.target.value)}
                  className="text-lg font-bold"
                  placeholder="Главный заголовок страницы"
                />
              </div>
            </Section>

            {/* ── Block 3: Content ── */}
            <Section title="📖 Контент">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Вступление (Intro)</Label>
                <Textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  rows={5}
                  placeholder="Вводный абзац — почему эта комбинация работает..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Почему это работает (Why It Works)</Label>
                <Textarea
                  value={whyItWorks}
                  onChange={(e) => setWhyItWorks(e.target.value)}
                  rows={4}
                  placeholder="Объяснение пользы и синергии ингредиентов..."
                />
              </div>
            </Section>

            {/* ── Block 3.5: Structured Ingredients (from catalog DB) ── */}
            <Section title="🥩 Ингредиенты (из каталога)">
              {Array.isArray(combo.structured_ingredients) && combo.structured_ingredients.length > 0 ? (
                <div className="space-y-2">
                  {combo.structured_ingredients.map((ing: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                      {ing.image_url ? (
                        <img src={ing.image_url as string} alt={ing.name as string} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                          {ing.product_type === "seafood" || ing.product_type === "meat" || ing.product_type === "poultry" ? "🥩" :
                           ing.product_type === "grain" || ing.product_type === "bread" ? "🌾" :
                           ing.product_type === "vegetable" ? "🥬" :
                           ing.product_type === "fruit" ? "🍎" :
                           ing.product_type === "oil" || ing.product_type === "nut" ? "🫒" :
                           ing.product_type === "dairy" || ing.product_type === "egg" ? "🥛" :
                           ing.product_type === "spice" || ing.product_type === "condiment" || ing.product_type === "sauce" ? "🧂" :
                           "🍽️"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ing.name as string}</p>
                        {typeof ing.product_type === "string" && (
                          <p className="text-[10px] text-muted-foreground">{ing.product_type}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{ing.grams as number}г</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ing.kcal as number} kcal · Б{ing.protein as number}
                        </p>
                      </div>
                    </div>
                  ))}
                  {/* Totals */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20 mt-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">📊</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">Итого на порцию</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{Math.round(combo.total_weight_g)}г</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(combo.calories_per_serving)} kcal · Б{Math.round(combo.protein_per_serving)} · Ж{Math.round(combo.fat_per_serving)} · У{Math.round(combo.carbs_per_serving)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">Структурированные ингредиенты отсутствуют.</p>
                  <p className="text-xs mt-1">
                    Этот рецепт создан до добавления поля — нажмите{" "}
                    <strong>«Backfill ингредиенты»</strong> на странице списка.
                  </p>
                </div>
              )}
            </Section>

            {/* ── Block 4: Recipe (read-only view) ── */}
            {Array.isArray(combo.how_to_cook) && combo.how_to_cook.length > 0 && (
              <Section title="👨‍🍳 Рецепт" defaultOpen={false}>
                <div className="space-y-2">
                  {combo.how_to_cook.map((step, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {step.step}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm">{step.text}</p>
                        {step.time_minutes && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {step.time_minutes} мин
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Block 5: Optimization Tips (read-only) ── */}
            {Array.isArray(combo.optimization_tips) && combo.optimization_tips.length > 0 && (
              <Section title="💡 Советы по оптимизации" defaultOpen={false}>
                <div className="space-y-2">
                  {combo.optimization_tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-sm">
                      <span className="text-base">{tip.icon}</span>
                      <div>
                        {tip.ingredient && (
                          <span className="font-semibold text-primary mr-1.5">{tip.ingredient}</span>
                        )}
                        <span className="text-foreground/80">{tip.tip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Block 6: FAQ (read-only) ── */}
            {Array.isArray(combo.faq) && combo.faq.length > 0 && (
              <Section title="❓ FAQ" defaultOpen={false}>
                <div className="space-y-2">
                  {combo.faq.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/10">
                      <p className="font-semibold text-sm">{item.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Block 7: Raw JSON (debug) ── */}
            <Section title="🔧 SmartResponse (JSON)" defaultOpen={false}>
              <pre className="text-[10px] bg-muted/40 rounded-lg p-4 overflow-auto max-h-72 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(combo.smart_response, null, 2)}
              </pre>
            </Section>

          </div>

          {/* ────────────────────────────────────────────────────────
              RIGHT: Sticky sidebar (w-72)
          ──────────────────────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4 sticky top-20">

            {/* Status card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Статус публикации
                </p>
                <div className="flex items-center gap-2">
                  <Badge className={`${STATUS_COLORS[combo.status]}`}>
                    {combo.status === "draft" && "Черновик"}
                    {combo.status === "published" && "✓ Опубликовано"}
                    {combo.status === "archived" && "В архиве"}
                  </Badge>
                </div>

                {combo.published_at && (
                  <p className="text-xs text-muted-foreground">
                    Опубликовано: {new Date(combo.published_at).toLocaleDateString("ru")}
                  </p>
                )}

                <div className="space-y-2 pt-1">
                  {combo.status !== "published" && (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={handlePublish}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowUpCircle className="h-4 w-4 mr-1" />}
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
                      <Archive className="h-4 w-4 mr-1" />
                      В архив
                    </Button>
                  )}
                  {combo.status === "published" && (
                    <Button variant="outline" className="w-full" size="sm" asChild>
                      <a
                        href={`${BLOG_BASE}/${combo.locale}/recipes/${combo.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Открыть на сайте
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
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Metadata card */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Метаданные
                </p>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">Язык:</span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {combo.locale.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    <span className="font-medium">Качество:</span>
                    <span>{combo.quality_score}/5</span>
                  </div>
                </div>

                {/* Ingredients (structured if available, chips fallback) */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Ингредиенты</p>
                  {Array.isArray(combo.structured_ingredients) && combo.structured_ingredients.length > 0 ? (
                    <div className="space-y-1">
                      {combo.structured_ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          {ing.image_url ? (
                            <img src={ing.image_url} alt="" className="w-5 h-5 rounded object-cover shrink-0" />
                          ) : (
                            <span className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-[9px] shrink-0">
                              {ing.product_type?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          )}
                          <span className="font-medium truncate flex-1">{ing.name}</span>
                          <span className="text-muted-foreground font-mono">{ing.grams}г</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {combo.ingredients.map((ing) => (
                        <span
                          key={ing}
                          className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6D Context */}
                {(combo.goal || combo.meal_type || combo.diet || combo.cooking_time || combo.budget || combo.cuisine) && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Контекст</p>
                    <div className="flex flex-wrap gap-1">
                      {combo.goal && <Badge variant="secondary" className="text-[10px]">🎯 {combo.goal.replace(/_/g, " ")}</Badge>}
                      {combo.meal_type && <Badge variant="secondary" className="text-[10px]">🍽️ {combo.meal_type}</Badge>}
                      {combo.diet && <Badge variant="secondary" className="text-[10px]">🥗 {combo.diet.replace(/_/g, " ")}</Badge>}
                      {combo.cooking_time && <Badge variant="secondary" className="text-[10px]">⏱️ {combo.cooking_time}</Badge>}
                      {combo.budget && <Badge variant="secondary" className="text-[10px]">💰 {combo.budget}</Badge>}
                      {combo.cuisine && <Badge variant="secondary" className="text-[10px]">🌍 {combo.cuisine}</Badge>}
                    </div>
                  </div>
                )}

                {/* Slug */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">URL</p>
                  <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono block break-all">
                    /{combo.locale}/recipes/{combo.slug}
                  </code>
                </div>

                {/* Timestamps */}
                <div className="space-y-0.5 text-[10px] text-muted-foreground/60 pt-1 border-t">
                  <p>Создано: {new Date(combo.created_at).toLocaleString("ru")}</p>
                  <p>Обновлено: {new Date(combo.updated_at).toLocaleString("ru")}</p>
                </div>
              </CardContent>
            </Card>

            {/* Save reminder */}
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
