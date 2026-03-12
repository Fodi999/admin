'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  listCategories as listArticleCategories,
  uploadImage,
} from '@/lib/cms';
import type { Article, ArticleCategory } from '@/lib/cms-types';
import { getToken } from '@/lib/auth';
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
  FileText,
  Search,
  Calendar,
  ImageIcon,
  Eye,
  EyeOff,
  ChevronLeft,
} from 'lucide-react';

const LANGS = [
  { key: 'ru', label: 'RU', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'en', label: 'EN', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'pl', label: 'PL', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'uk', label: 'UK', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
] as const;

function LangBadge({ lang }: { lang: string }) {
  const l = LANGS.find((l) => l.key === lang);
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${l?.cls}`}>{l?.label}</span>;
}

export default function ArticlesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<Partial<Article>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    loadData();
  }, [router]);

  async function loadData() {
    setLoading(true);
    try {
      const [artList, catList] = await Promise.all([listArticles(), listArticleCategories()]);
      setArticles(artList || []);
      setCategories(catList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredArticles = articles.filter(
    (a) =>
      a.title_ru?.toLowerCase().includes(search.toLowerCase()) ||
      a.title_en?.toLowerCase().includes(search.toLowerCase()) ||
      a.slug?.toLowerCase().includes(search.toLowerCase())
  );

  function startNew() {
    setCurrentArticle({
      published: false,
      order_index: articles.length,
    });
    setIsEditing(true);
    setMsg(null);
  }

  function edit(article: Article) {
    setCurrentArticle(article);
    setIsEditing(true);
    setMsg(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Использование исправленной функции uploadImage из инструкции
      const url = await uploadImage(file, 'articles');
      setCurrentArticle((prev) => ({ ...prev, image_url: url }));
    } catch (err) {
      setMsg({ type: 'err', text: 'Ошибка загрузки изображения' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      if (currentArticle.id) {
        const updated = await updateArticle(currentArticle.id, currentArticle);
        setArticles(articles.map((a) => (a.id === updated.id ? updated : a)));
        setMsg({ type: 'ok', text: 'Статья обновлена' });
      } else {
        const created = await createArticle(currentArticle as Omit<Article, 'id' | 'created_at' | 'updated_at'>);
        setArticles([...articles, created]);
        setMsg({ type: 'ok', text: 'Статья создана' });
      }
      setTimeout(() => setIsEditing(false), 800);
    } catch (err) {
      setMsg({ type: 'err', text: 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteArticle(deleteId);
      setArticles(articles.filter((a) => a.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      setMsg({ type: 'err', text: 'Ошибка удаления' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl">
            <ChevronLeft className="mr-2 h-4 w-4" /> Список статей
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={currentArticle.published ? 'default' : 'secondary'} className="rounded-lg">
              {currentArticle.published ? 'Опубликовано' : 'Черновик'}
            </Badge>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl px-6">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Сохранить
            </Button>
          </div>
        </div>

        {msg && (
          <Alert variant={msg.type === 'err' ? 'destructive' : 'default'} className="rounded-2xl border-primary/20 bg-primary/5">
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
              <Label className="text-xs font-black uppercase tracking-widest text-primary/60">Обложка</Label>
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-border/20 group">
                {currentArticle.image_url ? (
                  <Image src={currentArticle.image_url} alt="Cover" fill className="object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                    <span className="text-xs font-bold">Нет фото</span>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Input type="file" className="hidden" onChange={handleUpload} accept="image/*" disabled={uploading} />
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Plus className="h-8 w-8 text-white" />}
                </label>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Slug (URL)</Label>
                  <Input
                    value={currentArticle.slug || ''}
                    onChange={(e) => setCurrentArticle((p) => ({ ...p, slug: e.target.value }))}
                    className="rounded-xl font-mono text-xs"
                    placeholder="post-url-slug"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Категория</Label>
                  <Select
                    value={currentArticle.category || ''}
                    onValueChange={(val) => setCurrentArticle((p) => ({ ...p, category: val }))}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Выберите категорию..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.title_ru || cat.title_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/10">
                  <Label className="text-sm font-semibold">Опубликовано</Label>
                  <Button
                    size="sm"
                    variant={currentArticle.published ? 'default' : 'outline'}
                    onClick={() => setCurrentArticle((p) => ({ ...p, published: !p.published }))}
                    className="h-8 rounded-lg"
                  >
                    {currentArticle.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </section>

            <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-4">
              <Label className="text-xs font-black uppercase tracking-widest text-primary/60">SEO</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">SEO Title</Label>
                  <Input
                    value={currentArticle.seo_title || ''}
                    onChange={(e) => setCurrentArticle((p) => ({ ...p, seo_title: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">SEO Description</Label>
                  <Textarea
                    value={currentArticle.seo_description || ''}
                    onChange={(e) => setCurrentArticle((p) => ({ ...p, seo_description: e.target.value }))}
                    rows={3}
                    className="rounded-xl resize-none"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="md:col-span-2 space-y-8">
            {LANGS.map((lang) => (
              <section key={lang.key} className="glass rounded-2xl p-8 ring-1 ring-white/10 space-y-6">
                <div className="flex items-center gap-3 border-b border-border/10 pb-4">
                  <LangBadge lang={lang.key} />
                  <h2 className="text-sm font-black uppercase tracking-widest opacity-60">Статья ({lang.label})</h2>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Заголовок</Label>
                    <Input
                      value={(currentArticle as any)[`title_${lang.key}`] || ''}
                      onChange={(e) => setCurrentArticle({ ...currentArticle, [`title_${lang.key}`]: e.target.value })}
                      className="rounded-xl text-lg font-bold h-12 border-none bg-muted/20 focus:bg-muted/40 transition-colors"
                      placeholder={`Заголовок на ${lang.label}...`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Содержимое</Label>
                    <Textarea
                      value={(currentArticle as any)[`content_${lang.key}`] || ''}
                      onChange={(e) => setCurrentArticle({ ...currentArticle, [`content_${lang.key}`]: e.target.value })}
                      rows={12}
                      className="rounded-xl leading-relaxed border-none bg-muted/20 focus:bg-muted/40 transition-colors resize-none"
                      placeholder={`Текст статьи на ${lang.label}...`}
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16 animate-in fade-in duration-700">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-1 w-8 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">CMS Management</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter">Статьи</h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Написание и публикация материалов для блога.
          </p>
        </div>
        <Button onClick={startNew} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] gap-3 glow">
          <Plus className="h-5 w-5" /> Новая статья
        </Button>
      </div>

      <div className="flex items-center gap-4 p-2 bg-muted/30 rounded-3xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 pl-12 border-none bg-transparent focus-visible:ring-0 text-base"
            placeholder="Поиск статей..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArticles.map((article) => (
          <div
            key={article.id}
            onClick={() => edit(article)}
            className="group glass rounded-[2.5rem] p-6 ring-1 ring-white/10 hover:ring-primary/40 transition-all duration-500 cursor-pointer flex flex-col h-full overflow-hidden"
          >
            <div className="relative aspect-[16/10] rounded-[1.8rem] overflow-hidden mb-6 bg-muted border border-border/20">
              {article.image_url ? (
                <Image
                  src={article.image_url}
                  alt={article.title_ru}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="flex items-center justify-center h-full opacity-20">
                  <FileText className="h-12 w-12" />
                </div>
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                {!article.published && (
                  <Badge variant="destructive" className="text-[10px] rounded-lg">Черновик</Badge>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex gap-1.5 flex-wrap">
                {LANGS.map(l => (article as any)[`title_${l.key}`] && <LangBadge key={l.key} lang={l.key} />)}
              </div>
              <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
                {article.title_ru || article.title_en}
              </h3>
              <p className="text-xs font-mono text-muted-foreground truncate opacity-60">/{article.slug}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-border/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {new Date(article.created_at).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 rounded-xl text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(article.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-3xl border-destructive/20 bg-background/80 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle>Удалить статью?</DialogTitle>
            <DialogDescription>
              Это действие необратимо. Статья будет полностью удалена.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="rounded-xl">Отмена</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl px-8">Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
