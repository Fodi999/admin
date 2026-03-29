"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  getIntentPage,
  updateIntentPage,
  publishIntentPage,
  unpublishIntentPage,
  regenerateIntentPage,
  archiveIntentPage,
  deleteIntentPage,
  uploadImageToR2,
  type IntentPage,
  type ContentBlock,
} from "@/lib/intent-pages-api";
import { IngredientAutocomplete } from "@/components/ingredient-autocomplete";

import {
  ArrowLeft,
  Loader2,
  Rocket,
  RefreshCw,
  Save,
  Globe,
  Archive,
  Trash2,
  ImageIcon,
  Upload,
  Eye,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ── Helpers ──────────────────────────────────────────────────────

const IMAGE_KEY_LABELS: Record<string, string> = {
  hero: "🖼 Hero — главное фото",
  benefits: "💚 Benefits — польза",
  nutrition: "📊 Nutrition — калории",
  cooking: "🍳 Cooking — приготовление",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  queued: { label: "В очереди", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  published: { label: "Опубликовано", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  archived: { label: "Архив", className: "bg-slate-100 text-slate-500 dark:bg-slate-800" },
};

type TabKey = "meta" | "content" | "photos" | "preview";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "meta", label: "SEO Мета", icon: "🔍" },
  { key: "content", label: "Контент", icon: "📝" },
  { key: "photos", label: "Фото", icon: "📸" },
  { key: "preview", label: "Превью", icon: "👁" },
];

function qualityScore(page: IntentPage): { score: number; checks: { label: string; ok: boolean }[] } {
  const checks = [
    { label: `Заголовок ≤60 (${page.title?.length ?? 0})`, ok: (page.title?.length ?? 0) > 0 && (page.title?.length ?? 0) <= 60 },
    { label: `Описание 80–155 (${page.description?.length ?? 0})`, ok: (page.description?.length ?? 0) >= 80 && (page.description?.length ?? 0) <= 155 },
    { label: `Ответ ≥200 (${page.answer?.length ?? 0})`, ok: (page.answer?.length ?? 0) >= 200 },
    { label: `FAQ ≥3 (${page.faq?.length ?? 0})`, ok: (page.faq?.length ?? 0) >= 3 },
    {
      label: `Блоки ≥10 + фото (${page.content_blocks?.length ?? 0})`,
      ok: (page.content_blocks?.length ?? 0) >= 10 &&
        (page.content_blocks as ContentBlock[]).some((b) => b.type === "image" && "src" in b && b.src),
    },
  ];
  return { score: checks.filter((c) => c.ok).length, checks };
}

// ── Image Upload Slot ─────────────────────────────────────────────

function ImageUploadSlot({
  pageId, imageKey, src, alt, token, onUploaded,
}: {
  pageId: string; imageKey: string; src?: string; alt: string;
  token: string; onUploaded: (updated: IntentPage) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(src || null);

  useEffect(() => { setPreview(src || null); }, [src]);

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
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

export default function SeoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pageId = params.id as string;

  const [token, setToken] = useState<string | null>(null);
  const [page, setPage] = useState<IntentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("meta");

  // ── Editable fields ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [answer, setAnswer] = useState("");
  const [slug, setSlug] = useState("");
  const [editableBlocks, setEditableBlocks] = useState<ContentBlock[]>([]);

  // ── Actions loading ──
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // ── Ensure token & load ──
  const ensureToken = useCallback(async () => {
    if (token) return token;
    const t = await getToken();
    if (!t) { router.push("/login"); return null; }
    setToken(t);
    return t;
  }, [token, router]);

  const loadPage = useCallback(async (t: string) => {
    try {
      const p = await getIntentPage(t, pageId);
      setPage(p);
      setTitle(p.title);
      setDescription(p.description);
      setAnswer(p.answer);
      setSlug(p.slug);
      setEditableBlocks(Array.isArray(p.content_blocks) ? p.content_blocks : []);
    } catch {
      toast.error("Страница не найдена");
      router.push("/seo");
    } finally {
      setLoading(false);
    }
  }, [pageId, router]);

  useEffect(() => {
    ensureToken().then((t) => { if (t) loadPage(t); });
  }, [ensureToken, loadPage]);

  const updateBlock = (index: number, changes: Partial<ContentBlock>) => {
    setEditableBlocks((prev) =>
      prev.map((b, i) => (i === index ? ({ ...b, ...changes } as ContentBlock) : b))
    );
  };

  // ── Save ──
  const handleSave = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    setSaving(true);
    try {
      const updated = await updateIntentPage(t, page.id, {
        title, description, answer, slug, content_blocks: editableBlocks,
      });
      setPage(updated);
      toast.success("Сохранено ✅");
    } catch (err) {
      toast.error("Ошибка сохранения: " + String(err));
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
      await handleSave();
      const updated = await publishIntentPage(t, page.id);
      setPage(updated);
      toast.success("Опубликовано! 🚀");
    } catch (err) {
      toast.error("Ошибка публикации: " + String(err));
    } finally {
      setPublishing(false);
    }
  };

  // ── Unpublish ──
  const handleUnpublish = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    try {
      const updated = await unpublishIntentPage(t, page.id);
      setPage(updated);
      toast.success("Снято с публикации");
    } catch (err) {
      toast.error(String(err));
    }
  };

  // ── Regenerate ──
  const handleRegenerate = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    setRegenerating(true);
    try {
      const updated = await regenerateIntentPage(t, page.id);
      setPage(updated);
      setTitle(updated.title);
      setDescription(updated.description);
      setAnswer(updated.answer);
      setSlug(updated.slug);
      setEditableBlocks(Array.isArray(updated.content_blocks) ? updated.content_blocks : []);
      toast.success("Перегенерировано через AI ✨");
    } catch (err) {
      toast.error("Ошибка регенерации: " + String(err));
    } finally {
      setRegenerating(false);
    }
  };

  // ── Archive ──
  const handleArchive = async () => {
    if (!page) return;
    const t = await ensureToken();
    if (!t) return;
    try {
      await archiveIntentPage(t, page.id);
      toast.success("Отправлено в архив");
      router.push("/seo");
    } catch (err) {
      toast.error(String(err));
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!page) return;
    if (!confirm(`Удалить «${page.title}»? Это действие нельзя отменить.`)) return;
    const t = await ensureToken();
    if (!t) return;
    try {
      await deleteIntentPage(t, page.id);
      toast.success("Страница удалена");
      router.push("/seo");
    } catch (err) {
      toast.error(String(err));
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
            (u): u is ContentBlock & { type: "image" } => u.type === "image" && u.key === (b as { key: string }).key
          );
          return fresh ? { ...b, src: (fresh as { src?: string }).src } : b;
        })
      );
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!page) return null;

  const statusInfo = STATUS_BADGE[page.status] ?? STATUS_BADGE.draft;
  const { score, checks } = qualityScore(page);
  const imageBlocks = editableBlocks.filter(
    (b): b is ContentBlock & { type: "image" } => b.type === "image"
  );
  const uploadedCount = imageBlocks.filter((b) => "src" in b && b.src).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push("/seo")} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" /> Назад
        </Button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate max-w-xs md:max-w-md">
              {title || page.slug}
            </h1>
            <Badge className={`text-xs rounded-full px-2.5 py-0.5 ${statusInfo.className}`}>
              {statusInfo.label}
            </Badge>
            <Badge variant="outline" className="text-xs rounded-full">
              {page.locale.toUpperCase()}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
            /{page.locale}/chef-tools/seo/{page.slug}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-xl"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Перегенерировать</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">Сохранить</span>
          </Button>

          {page.status === "published" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUnpublish}
              className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
            >
              <Globe className="h-4 w-4 mr-1.5" /> Снять
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || score < 3}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50"
              title={score < 3 ? `Нужно ≥3/5 очков (сейчас ${score}/5)` : ""}
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Rocket className="h-4 w-4 mr-1.5" />
              )}
              Опубликовать
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-xl px-2">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => window.open(`https://dima-fomin.pl/${page.locale}/chef-tools/seo/${page.slug}`, "_blank")}
              >
                <Eye className="w-4 h-4 mr-2" /> Открыть на сайте
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" /> В архив
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quality score alert */}
      {score < 3 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Качество {score}/5 — нужно ≥3 для публикации. Перегенерируйте или добавьте фото.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.key === "photos" && (
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 ml-0.5 ${
                  uploadedCount === imageBlocks.length && imageBlocks.length > 0
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {uploadedCount}/{imageBlocks.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
         TAB: META
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "meta" && (
        <div className="space-y-4">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">SEO мета-данные</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Заголовок (title)
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
                  Описание (meta description)
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

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Информация о странице</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Тип интента</div>
                <div className="font-medium capitalize">{page.intent_type}</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Язык</div>
                <div className="font-medium">{page.locale.toUpperCase()}</div>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Сущность A</div>
                <div className="font-medium">{page.entity_a}</div>
              </div>
              {page.entity_b && (
                <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Сущность B</div>
                  <div className="font-medium">{page.entity_b}</div>
                </div>
              )}
              <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Создано</div>
                <div className="font-medium text-xs">{new Date(page.created_at).toLocaleString("ru-RU")}</div>
              </div>
              {page.published_at && (
                <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Опубликовано</div>
                  <div className="font-medium text-xs">{new Date(page.published_at).toLocaleString("ru-RU")}</div>
                </div>
              )}
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить изменения
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         TAB: CONTENT
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <div className="space-y-4">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Ответ на вопрос
            </h2>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2">
                Текст ответа
                <span className={
                  answer.length >= 400 ? "text-emerald-600 text-xs" :
                  answer.length >= 200 ? "text-amber-600 text-xs" : "text-red-500 text-xs"
                }>
                  ({answer.length} симв, нужно ≥200)
                </span>
              </Label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="w-full text-sm bg-muted/30 rounded-xl p-3 min-h-[140px] max-h-[300px] border resize-y"
              />
            </div>
          </section>

          {/* Content blocks */}
          {editableBlocks.length > 0 && (
            <section className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  Блоки контента
                </h2>
                <Badge variant="secondary" className="text-[10px]">{editableBlocks.length}</Badge>
              </div>
              <div className="space-y-3 text-sm">
                {editableBlocks.map((block, i) => {
                  if (block.type === "heading") return (
                    <div key={i} className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        H{block.level}
                      </span>
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
                      {"src" in block && block.src ? (
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

          {/* FAQ */}
          {page.faq && page.faq.length > 0 && (
            <section className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">FAQ</h2>
                <Badge variant="secondary" className="text-[10px]">{page.faq.length}</Badge>
              </div>
              <div className="space-y-2">
                {page.faq.map((f, i) => (
                  <div key={i} className="bg-muted/30 rounded-xl p-3 text-sm">
                    <div className="font-medium">{f.question}</div>
                    <div className="text-muted-foreground mt-1 text-xs leading-relaxed">{f.answer}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Сохранить изменения
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         TAB: PHOTOS
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "photos" && (
        <div className="space-y-4">
          <section className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Фото для статьи</h2>
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
                    src={"src" in block ? block.src : undefined}
                    alt={block.alt}
                    token={token}
                    onUploaded={handleImageUploaded}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-muted/30 rounded-xl p-8 text-center text-muted-foreground text-sm">
                <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Нет блоков с фото.</p>
                <p className="text-xs mt-1">Нажмите «Перегенерировать» чтобы обновить контент.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
         TAB: PREVIEW
      ══════════════════════════════════════════════════════════ */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          {/* SERP Preview */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Предпросмотр в Google (SERP)</h2>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border shadow-sm space-y-0.5 max-w-xl">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <img
                  src={`https://www.google.com/s2/favicons?domain=dima-fomin.pl&sz=16`}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
                <span>dima-fomin.pl</span>
                <span className="text-zinc-400">›</span>
                <span>{page.locale}</span>
                <span className="text-zinc-400">›</span>
                <span className="truncate font-mono text-[10px]">{slug}</span>
              </div>
              <h3 className="text-[#1a0dab] dark:text-blue-400 text-lg font-normal leading-snug">
                {title}
              </h3>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
                {description}
              </p>
            </div>
          </section>

          {/* Quality gate */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Quality Gate</h2>
              <Badge
                className={`text-xs ${
                  score >= 4 ? "bg-emerald-500/15 text-emerald-600" :
                  score >= 3 ? "bg-amber-500/15 text-amber-700" :
                  "bg-red-500/15 text-red-600"
                }`}
              >
                {score}/5
              </Badge>
              {score >= 3 ? (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Готово к публикации
                </span>
              ) : (
                <span className="text-xs text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Нужно ≥3 очков
                </span>
              )}
            </div>
            <div className="space-y-2">
              {checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={check.ok ? "text-emerald-500" : "text-zinc-400"}>
                    {check.ok ? "✅" : "⬜"}
                  </span>
                  <span className={check.ok ? "text-foreground" : "text-muted-foreground"}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Stats */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Статистика</h2>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xl font-bold">{editableBlocks.length}</div>
                <div className="text-xs text-muted-foreground">Блоков</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xl font-bold">{uploadedCount}/{imageBlocks.length}</div>
                <div className="text-xs text-muted-foreground">Фото</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xl font-bold">{page.faq?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">FAQ</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3">
                <div className="text-xl font-bold">{answer.length}</div>
                <div className="text-xs text-muted-foreground">Симв. ответа</div>
              </div>
            </div>
          </section>

          {/* Publish action */}
          <div className="flex justify-end gap-3">
            {page.status === "published" ? (
              <Button
                variant="outline"
                onClick={handleUnpublish}
                className="rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400"
              >
                <Globe className="h-4 w-4 mr-1.5" /> Снять с публикации
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={publishing || score < 3}
                className="rounded-xl h-11 px-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50"
                title={score < 3 ? `Нужно ≥3/5 очков (сейчас ${score}/5)` : ""}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Rocket className="h-4 w-4 mr-1.5" />
                )}
                Опубликовать
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
