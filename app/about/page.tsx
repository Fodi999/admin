'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getAbout,
  updateAbout,
  listExpertise,
  createExpertise,
  updateExpertise,
  deleteExpertise,
  listExperience,
  createExperience,
  updateExperience,
  deleteExperience,
  listGallery,
  listGalleryCategories,
  createGallery,
  updateGallery,
  deleteGallery,
  uploadImage,
  listCategories,
} from '@/lib/cms';
import type { About, Expertise, Experience, Gallery, GalleryCategory, ArticleCategory } from '@/lib/cms-types';
import { getToken, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Upload,
  Camera,
  ChefHat,
  Award,
  Briefcase,
  ImageIcon,
  X,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// ── Language badge component ──────────────────────────────────────────────────
const LANGS = [
  { key: 'en', label: 'EN', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'ru', label: 'RU', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300' },
  { key: 'pl', label: 'PL', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'uk', label: 'UK', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
] as const;

function LangBadge({ lang }: { lang: string }) {
  const l = LANGS.find((l) => l.key === lang);
  if (!l) return null;
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l.cls}`}>{l.label}</span>;
}

// ── Helper: message state ─────────────────────────────────────────────────────
type Msg = { type: 'ok' | 'err'; text: string } | null;

export default function AboutChefPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Msg>(null);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  // About
  const [about, setAbout] = useState<Partial<About>>({});
  const [savingAbout, setSavingAbout] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Expertise
  const [expertiseList, setExpertiseList] = useState<Expertise[]>([]);
  const [expertiseForm, setExpertiseForm] = useState<Partial<Expertise>>({});
  const [expertiseEditId, setExpertiseEditId] = useState<string | null>(null);
  const [savingExpertise, setSavingExpertise] = useState(false);

  // Experience
  const [experienceList, setExperienceList] = useState<Experience[]>([]);
  const [experienceForm, setExperienceForm] = useState<Partial<Experience>>({});
  const [experienceEditId, setExperienceEditId] = useState<string | null>(null);
  const [savingExperience, setSavingExperience] = useState(false);

  // Gallery
  const [galleryList, setGalleryList] = useState<Gallery[]>([]);
  const [galleryForm, setGalleryForm] = useState<Partial<Gallery>>({});
  const [galleryEditId, setGalleryEditId] = useState<string | null>(null);
  const [savingGallery, setSavingGallery] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [galleryCategories, setGalleryCategories] = useState<GalleryCategory[]>([]);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; label: string } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setApiErrors([]);
    const labels = ['About', 'Expertise', 'Experience', 'Gallery'];
    try {
      const results = await Promise.allSettled([
        getAbout(),
        listExpertise(),
        listExperience(),
        listGallery(),
      ]);

      const failed: string[] = [];
      if (results[0].status === 'fulfilled') setAbout(results[0].value); else failed.push(labels[0]);
      if (results[1].status === 'fulfilled') setExpertiseList(results[1].value); else failed.push(labels[1]);
      if (results[2].status === 'fulfilled') setExperienceList(results[2].value); else failed.push(labels[2]);
      if (results[3].status === 'fulfilled') setGalleryList(results[3].value); else failed.push(labels[3]);
      setApiErrors(failed);

      // Загружаем категории отдельно (не влияет на основной флоу)
      listCategories().then(setCategories).catch(() => {});
      listGalleryCategories().then(setGalleryCategories).catch(() => {});
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        clearToken();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── About handlers ────────────────────────────────────────────────────────
  function handleAboutChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setAbout((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleAboutPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setMsg(null);
    try {
      const url = await uploadImage(file, 'about');
      setAbout((prev) => ({ ...prev, image_url: url }));
      setMsg({ type: 'ok', text: '✅ Фото шефа загружено!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка загрузки'}` });
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  async function handleSaveAbout() {
    setSavingAbout(true);
    setMsg(null);
    try {
      const updated = await updateAbout(about);
      setAbout(updated);
      setMsg({ type: 'ok', text: '✅ Данные "О шефе" сохранены!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSavingAbout(false);
    }
  }

  // ── Expertise handlers ────────────────────────────────────────────────────
  function resetExpertiseForm() {
    setExpertiseForm({});
    setExpertiseEditId(null);
  }

  function editExpertise(item: Expertise) {
    setExpertiseEditId(item.id);
    setExpertiseForm({ ...item });
  }

  async function handleSaveExpertise() {
    setSavingExpertise(true);
    setMsg(null);
    try {
      if (expertiseEditId) {
        const updated = await updateExpertise(expertiseEditId, expertiseForm);
        setExpertiseList((prev) => prev.map((e) => (e.id === expertiseEditId ? updated : e)));
      } else {
        const created = await createExpertise(expertiseForm as Omit<Expertise, 'id' | 'created_at' | 'updated_at'>);
        setExpertiseList((prev) => [...prev, created]);
      }
      resetExpertiseForm();
      setMsg({ type: 'ok', text: '✅ Экспертиза сохранена!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSavingExpertise(false);
    }
  }

  // ── Experience handlers ────────────────────────────────────────────────────
  function resetExperienceForm() {
    setExperienceForm({});
    setExperienceEditId(null);
  }

  function editExperience(item: Experience) {
    setExperienceEditId(item.id);
    setExperienceForm({ ...item });
  }

  async function handleSaveExperience() {
    setSavingExperience(true);
    setMsg(null);
    try {
      if (experienceEditId) {
        const updated = await updateExperience(experienceEditId, experienceForm);
        setExperienceList((prev) => prev.map((e) => (e.id === experienceEditId ? updated : e)));
      } else {
        const created = await createExperience(experienceForm as Omit<Experience, 'id' | 'created_at' | 'updated_at'>);
        setExperienceList((prev) => [...prev, created]);
      }
      resetExperienceForm();
      setMsg({ type: 'ok', text: '✅ Опыт работы сохранён!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSavingExperience(false);
    }
  }

  // ── Gallery handlers ────────────────────────────────────────────────────────
  function resetGalleryForm() {
    setGalleryForm({});
    setGalleryEditId(null);
  }

  function editGalleryItem(item: Gallery) {
    setGalleryEditId(item.id);
    setGalleryForm({ ...item });
  }

  async function handleGalleryImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingGallery(true);
    try {
      const url = await uploadImage(file, 'gallery');
      setGalleryForm((prev) => ({ ...prev, image_url: url }));
      setMsg({ type: 'ok', text: '✅ Фото загружено!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setUploadingGallery(false);
      e.target.value = '';
    }
  }

  async function handleSaveGallery() {
    setSavingGallery(true);
    setMsg(null);
    try {
      if (galleryEditId) {
        const updated = await updateGallery(galleryEditId, galleryForm);
        setGalleryList((prev) => prev.map((g) => (g.id === galleryEditId ? updated : g)));
      } else {
        const created = await createGallery(galleryForm as Omit<Gallery, 'id' | 'created_at' | 'updated_at'>);
        setGalleryList((prev) => [...prev, created]);
      }
      resetGalleryForm();
      setMsg({ type: 'ok', text: '✅ Галерея сохранена!' });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSavingGallery(false);
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setMsg(null);
    try {
      if (deleteTarget.type === 'expertise') {
        await deleteExpertise(deleteTarget.id);
        setExpertiseList((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'experience') {
        await deleteExperience(deleteTarget.id);
        setExperienceList((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      } else if (deleteTarget.type === 'gallery') {
        await deleteGallery(deleteTarget.id);
        setGalleryList((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      }
      setMsg({ type: 'ok', text: `✅ ${deleteTarget.label} удалено` });
    } catch (err) {
      setMsg({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setDeleteTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
          <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Загрузка CMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">CMS</span>
        </div>
        <h1 className="text-4xl font-black tracking-tighter">О шефе</h1>
        <p className="text-muted-foreground max-w-xl">
          Управление биографией, экспертизой, опытом работы и галереей шефа.
        </p>
      </div>

      {msg && (
        <Alert
          variant={msg.type === 'err' ? 'destructive' : 'default'}
          className={msg.type === 'ok' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20 dark:text-green-400' : ''}
        >
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {apiErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              CMS API недоступен ({apiErrors.length}/4)
            </p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/60">
              Эндпоинты <span className="font-mono">{apiErrors.join(', ')}</span> вернули ошибку 500.
              Бэкенд CMS ещё не настроен — вы можете заполнить формы, данные сохранятся когда API заработает.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30" onClick={loadAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1: About — Bio & Photo
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Биография шефа</h2>
        </div>

        {/* Photo */}
        <div className="flex items-start gap-6">
          {about.image_url ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden ring-1 ring-border/30 shrink-0">
              <Image src={about.image_url} alt="Chef" fill className="object-cover" sizes="128px" />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Camera className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">Фото шефа для страницы "О нас"</p>
            <Input
              type="file"
              accept="image/*"
              onChange={handleAboutPhotoUpload}
              disabled={uploadingPhoto}
              className="rounded-xl"
            />
            {uploadingPhoto && <p className="text-xs text-muted-foreground animate-pulse">Загрузка...</p>}
          </div>
        </div>

        {/* Titles */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Заголовок</h3>
          <div className="grid grid-cols-2 gap-4">
            {LANGS.map(({ key }) => (
              <div key={`title_${key}`} className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <LangBadge lang={key} />
                </Label>
                <Input
                  name={`title_${key}`}
                  value={(about as Record<string, string>)[`title_${key}`] ?? ''}
                  onChange={handleAboutChange}
                  placeholder={`Заголовок (${key.toUpperCase()})`}
                  className="rounded-xl"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Content / Bio */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Биография</h3>
          <div className="grid grid-cols-2 gap-4">
            {LANGS.map(({ key }) => (
              <div key={`content_${key}`} className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  <LangBadge lang={key} />
                </Label>
                <Textarea
                  name={`content_${key}`}
                  value={(about as Record<string, string>)[`content_${key}`] ?? ''}
                  onChange={handleAboutChange}
                  rows={5}
                  placeholder={`Текст биографии (${key.toUpperCase()})`}
                  className="rounded-xl resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSaveAbout} disabled={savingAbout} className="h-11 px-8 rounded-xl font-semibold">
          {savingAbout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {savingAbout ? 'Сохранение...' : 'Сохранить биографию'}
        </Button>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2: Expertise
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Экспертиза</h2>
            <Badge variant="secondary" className="text-xs">{expertiseList.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              resetExpertiseForm();
              setExpertiseForm({ icon: '🍳', order_index: expertiseList.length });
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>

        {/* Existing items */}
        <div className="space-y-2">
          {expertiseList.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Нет записей экспертизы</p>
          )}
          {expertiseList
            .sort((a, b) => a.order_index - b.order_index)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/20 hover:bg-muted/20 transition-colors"
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.title_ru || item.title_en}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.title_en}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">#{item.order_index}</Badge>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => editExpertise(item)}>
                  ✏️
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ type: 'expertise', id: item.id, label: item.title_ru || item.title_en })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
        </div>

        {/* Add / Edit form */}
        {(expertiseEditId !== null || Object.keys(expertiseForm).length > 0) && (
          <div className="border border-primary/20 rounded-xl p-4 space-y-4 bg-primary/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{expertiseEditId ? 'Редактировать' : 'Новая экспертиза'}</h3>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetExpertiseForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Иконка (эмодзи)</Label>
                <Input
                  value={expertiseForm.icon ?? ''}
                  onChange={(e) => setExpertiseForm((p) => ({ ...p, icon: e.target.value }))}
                  className="rounded-xl text-center text-xl"
                  placeholder="🍳"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Порядок</Label>
                <Input
                  type="number"
                  value={expertiseForm.order_index ?? 0}
                  onChange={(e) => setExpertiseForm((p) => ({ ...p, order_index: parseInt(e.target.value) || 0 }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {LANGS.map(({ key }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-2"><LangBadge lang={key} /></Label>
                  <Input
                    value={(expertiseForm as Record<string, string>)[`title_${key}`] ?? ''}
                    onChange={(e) => setExpertiseForm((p) => ({ ...p, [`title_${key}`]: e.target.value }))}
                    placeholder={`Название (${key.toUpperCase()})`}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveExpertise} disabled={savingExpertise} size="sm" className="rounded-xl">
              {savingExpertise ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              {expertiseEditId ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3: Experience
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Опыт работы</h2>
            <Badge variant="secondary" className="text-xs">{experienceList.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              resetExperienceForm();
              setExperienceForm({ order_index: experienceList.length });
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>

        {/* Existing items */}
        <div className="space-y-2">
          {experienceList.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Нет записей опыта</p>
          )}
          {experienceList
            .sort((a, b) => a.order_index - b.order_index)
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-muted/10 border border-border/20 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.restaurant}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.position} · {item.country} · {item.start_year}–{item.end_year ?? 'по сей день'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">#{item.order_index}</Badge>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => editExperience(item)}>
                  ✏️
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ type: 'experience', id: item.id, label: item.restaurant })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
        </div>

        {/* Add / Edit form */}
        {(experienceEditId !== null || Object.keys(experienceForm).length > 0) && (
          <div className="border border-primary/20 rounded-xl p-4 space-y-4 bg-primary/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{experienceEditId ? 'Редактировать' : 'Новый опыт работы'}</h3>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetExperienceForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Ресторан</Label>
                <Input
                  value={experienceForm.restaurant ?? ''}
                  onChange={(e) => setExperienceForm((p) => ({ ...p, restaurant: e.target.value }))}
                  placeholder="Название ресторана"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Страна</Label>
                <Input
                  value={experienceForm.country ?? ''}
                  onChange={(e) => setExperienceForm((p) => ({ ...p, country: e.target.value }))}
                  placeholder="Польша"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Должность</Label>
                <Input
                  value={experienceForm.position ?? ''}
                  onChange={(e) => setExperienceForm((p) => ({ ...p, position: e.target.value }))}
                  placeholder="Head Chef"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">С года</Label>
                  <Input
                    type="number"
                    value={experienceForm.start_year ?? ''}
                    onChange={(e) => setExperienceForm((p) => ({ ...p, start_year: parseInt(e.target.value) || undefined }))}
                    placeholder="2015"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">По год</Label>
                  <Input
                    type="number"
                    value={experienceForm.end_year ?? ''}
                    onChange={(e) => setExperienceForm((p) => ({ ...p, end_year: parseInt(e.target.value) || undefined }))}
                    placeholder="—"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Порядок</Label>
                  <Input
                    type="number"
                    value={experienceForm.order_index ?? 0}
                    onChange={(e) => setExperienceForm((p) => ({ ...p, order_index: parseInt(e.target.value) || 0 }))}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>
            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-3">
              {LANGS.map(({ key }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-2"><LangBadge lang={key} /> <span className="text-xs">Описание</span></Label>
                  <Textarea
                    value={(experienceForm as Record<string, string>)[`description_${key}`] ?? ''}
                    onChange={(e) => setExperienceForm((p) => ({ ...p, [`description_${key}`]: e.target.value }))}
                    rows={3}
                    placeholder={`Описание (${key.toUpperCase()})`}
                    className="rounded-xl resize-none"
                  />
                </div>
              ))}
            </div>
            <Button onClick={handleSaveExperience} disabled={savingExperience} size="sm" className="rounded-xl">
              {savingExperience ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              {experienceEditId ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4: Gallery
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Галерея</h2>
            <Badge variant="secondary" className="text-xs">{galleryList.length}</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => {
              resetGalleryForm();
              setGalleryForm({ order_index: galleryList.length });
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Добавить
          </Button>
        </div>

        {/* Grid of gallery items — grouped by category */}
        {galleryList.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Галерея пуста</p>
        )}
        {(() => {
          const sorted = [...galleryList].sort((a, b) => a.order_index - b.order_index);
          // Собираем уникальные категории в порядке появления
          const catSlugs = Array.from(new Set(sorted.map((i) => i.category_slug || '__none__')));
          return catSlugs.map((slug) => {
            const items = sorted.filter((i) => (i.category_slug || '__none__') === slug);
            const catLabel =
              slug === '__none__'
                ? 'Без категории'
                : (galleryCategories.find((c) => c.slug === slug)?.title_ru ||
                   galleryCategories.find((c) => c.slug === slug)?.title_en ||
                   slug);
            return (
              <div key={slug} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/30" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                    {catLabel}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                  <div className="h-px flex-1 bg-border/30" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {items.map((item) => (
                    <div key={item.id} className="group relative rounded-xl overflow-hidden border border-border/20 bg-muted/10">
                      {item.image_url ? (
                        <div className="relative aspect-square">
                          <Image src={item.image_url} alt={item.alt_ru || item.title_ru} fill className="object-cover" sizes="300px" />
                        </div>
                      ) : (
                        <div className="aspect-square flex items-center justify-center bg-muted">
                          <Camera className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="p-2">
                        <p className="text-xs font-semibold truncate">{item.title_ru || item.title_en}</p>
                        {item.status && item.status !== 'published' && (
                          <Badge variant="secondary" className="text-[9px] mt-0.5">черновик</Badge>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="secondary" className="h-7 w-7 p-0 rounded-lg shadow-lg" onClick={() => editGalleryItem(item)}>
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 w-7 p-0 rounded-lg shadow-lg"
                          onClick={() => setDeleteTarget({ type: 'gallery', id: item.id, label: item.title_ru || 'Фото' })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          });
        })()}

        {/* Add / Edit form */}
        {(galleryEditId !== null || Object.keys(galleryForm).length > 0) && (
          <div className="border border-primary/20 rounded-xl p-4 space-y-4 bg-primary/5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{galleryEditId ? 'Редактировать' : 'Новое фото'}</h3>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetGalleryForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Image upload */}
            <div className="flex items-center gap-4">
              {galleryForm.image_url ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden ring-1 ring-border/30 shrink-0">
                  <Image src={galleryForm.image_url} alt="" fill className="object-cover" sizes="80px" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Camera className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <Input type="file" accept="image/*" onChange={handleGalleryImageUpload} disabled={uploadingGallery} className="rounded-xl" />
                {uploadingGallery && <p className="text-xs text-muted-foreground animate-pulse">Загрузка...</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label className="text-xs">Порядок</Label>
                <Input
                  type="number"
                  value={galleryForm.order_index ?? 0}
                  onChange={(e) => setGalleryForm((p) => ({ ...p, order_index: parseInt(e.target.value) || 0 }))}
                  className="rounded-xl w-24"
                />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label className="text-xs">Категория</Label>
                <Select
                  value={galleryForm.category_id ?? '__none__'}
                  onValueChange={(val) => setGalleryForm((p) => ({ ...p, category_id: val === '__none__' ? null : val }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Выберите категорию..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Без категории —</SelectItem>
                    {galleryCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.title_ru || cat.title_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label className="text-xs">Статус</Label>
                <Select
                  value={galleryForm.status ?? 'published'}
                  onValueChange={(val) => setGalleryForm((p) => ({ ...p, status: val }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">✅ Опубликовано</SelectItem>
                    <SelectItem value="draft">✏️ Черновик</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Titles */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Названия</h4>
              <div className="grid grid-cols-2 gap-3">
                {LANGS.map(({ key }) => (
                  <div key={`title_${key}`} className="space-y-1.5">
                    <Label className="flex items-center gap-2"><LangBadge lang={key} /></Label>
                    <Input
                      value={(galleryForm as Record<string, string>)[`title_${key}`] ?? ''}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, [`title_${key}`]: e.target.value }))}
                      placeholder={`Название (${key.toUpperCase()})`}
                      className="rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Alt texts */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alt-тексты (SEO)</h4>
              <div className="grid grid-cols-2 gap-3">
                {LANGS.map(({ key }) => (
                  <div key={`alt_${key}`} className="space-y-1.5">
                    <Label className="flex items-center gap-2"><LangBadge lang={key} /></Label>
                    <Input
                      value={(galleryForm as Record<string, string>)[`alt_${key}`] ?? ''}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, [`alt_${key}`]: e.target.value }))}
                      placeholder={`Alt (${key.toUpperCase()})`}
                      className="rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Descriptions */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Описания</h4>
              <div className="grid grid-cols-2 gap-3">
                {LANGS.map(({ key }) => (
                  <div key={`desc_${key}`} className="space-y-1.5">
                    <Label className="flex items-center gap-2"><LangBadge lang={key} /></Label>
                    <Textarea
                      value={(galleryForm as Record<string, string>)[`description_${key}`] ?? ''}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, [`description_${key}`]: e.target.value }))}
                      rows={2}
                      placeholder={`Описание (${key.toUpperCase()})`}
                      className="rounded-xl resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social / External links */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ссылки (социальные сети)</h4>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'instagram_url', label: '📸 Instagram', placeholder: 'https://instagram.com/p/...' },
                  { key: 'pinterest_url', label: '📌 Pinterest', placeholder: 'https://pinterest.com/pin/...' },
                  { key: 'facebook_url',  label: '📘 Facebook',  placeholder: 'https://facebook.com/...' },
                  { key: 'tiktok_url',    label: '🎵 TikTok',    placeholder: 'https://tiktok.com/@...' },
                  { key: 'website_url',   label: '🌐 Website',   placeholder: 'https://...' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <Input
                      value={(galleryForm as Record<string, string>)[key] ?? ''}
                      onChange={(e) => setGalleryForm((p) => ({ ...p, [key]: e.target.value || null }))}
                      placeholder={placeholder}
                      className="rounded-xl text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveGallery} disabled={savingGallery} size="sm" className="rounded-xl">
              {savingGallery ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
              {galleryEditId ? 'Обновить' : 'Создать'}
            </Button>
          </div>
        )}
      </section>

      {/* ── Delete Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить "{deleteTarget?.label}"?</DialogTitle>
            <DialogDescription>Это действие необратимо.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button variant="destructive" onClick={handleDelete}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
