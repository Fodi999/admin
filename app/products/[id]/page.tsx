'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import {
  getProduct,
  updateProduct,
  uploadProductImage,
  getCategories,
  type Product,
  type Category,
  type UpdateProductRequest,
} from '@/lib/admin-api';
import { getToken, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Loader2, ArrowLeft, Upload, Save, Sparkles } from 'lucide-react';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter', 'AllYear'];

const ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'TreeNuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame', 'Celery', 'Mustard', 'Sulfites', 'Lupin', 'Molluscs',
];

const UNITS = [
  'gram', 'kilogram', 'liter', 'milliliter',
  'piece', 'bunch', 'can', 'bottle', 'package',
];

const SEASON_ICONS: Record<string, string> = {
  Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄️', AllYear: '🔄',
};

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<UpdateProductRequest>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    Promise.all([getProduct(token, id), getCategories(token)])
      .then(([p, cats]) => {
        setProduct(p);
        setCategories(cats);
        resetForm(p);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          clearToken(); router.push('/login');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  function resetForm(p: Product) {
    setForm({
      name_en: p.name_en,
      name_ru: p.name_ru ?? '',
      name_pl: p.name_pl ?? '',
      name_uk: p.name_uk ?? '',
      category_id: p.category_id,
      unit: p.unit,
      description_en: p.description_en ?? '',
      description_ru: p.description_ru ?? '',
      description_pl: p.description_pl ?? '',
      description_uk: p.description_uk ?? '',
      calories_per_100g: p.calories_per_100g ?? undefined,
      protein_per_100g: p.protein_per_100g ? parseFloat(p.protein_per_100g) : undefined,
      fat_per_100g: p.fat_per_100g ? parseFloat(p.fat_per_100g) : undefined,
      carbs_per_100g: p.carbs_per_100g ? parseFloat(p.carbs_per_100g) : undefined,
      density_g_per_ml: p.density_g_per_ml ? parseFloat(p.density_g_per_ml) : undefined,
      seasons: p.seasons ?? [],
      allergens: p.allergens ?? [],
    });
  }

  function set<K extends keyof UpdateProductRequest>(key: K, value: UpdateProductRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArray(key: 'seasons' | 'allergens', value: string) {
    const arr = (form[key] ?? []) as string[];
    set(key, arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  async function handleSave() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProduct(token, id, form);
      setProduct(updated);
      resetForm(updated);
      setMessage({ type: 'ok', text: '✅ Сохранено!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWithAutoTranslate() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProduct(token, id, { ...form, auto_translate: true });
      setProduct(updated);
      resetForm(updated);
      setMessage({ type: 'ok', text: '✅ Сохранено + автоперевод применён!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    setUploading(true);
    setMessage(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      const imageUrl = await uploadProductImage(token, id, compressed as File);
      setProduct((prev) => prev ? { ...prev, image_url: imageUrl } : prev);
      setMessage({ type: 'ok', text: '✅ Фото загружено!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка загрузки'}` });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка продукта...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Продукт не найден</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {product.name_ru || product.name_uk || product.name_pl || product.name_en}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {product.name_en && product.name_en !== (product.name_ru || product.name_uk || product.name_pl) && (
              <span className="text-xs text-muted-foreground">{product.name_en}</span>
            )}
            {product.slug && (
              <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 rounded">
                slug: {product.slug}
              </span>
            )}
          </div>
        </div>
      </div>

      {message && (
        <Alert
          variant={message.type === 'err' ? 'destructive' : 'default'}
          className={message.type === 'ok' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20' : ''}
        >
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Photo */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📷 Фото</h2>
        <div className="flex items-start gap-6">
          {product.image_url ? (
            <div className="relative w-32 h-32 rounded-xl overflow-hidden ring-1 ring-border/30 shrink-0">
              <Image src={product.image_url} alt={product.name_ru || product.name_en} fill className="object-cover" sizes="128px" />
            </div>
          ) : (
            <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center text-4xl shrink-0">
              <Camera className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              Загрузите новое фото. Автоматическое сжатие до 1 МБ JPEG.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="flex-1 rounded-xl"
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </label>
            {uploading && (
              <p className="text-xs text-muted-foreground animate-pulse">Сжатие и загрузка...</p>
            )}
          </div>
        </div>
      </section>

      {/* Names */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🌍 Названия</h2>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ['name_en', 'EN', 'bg-blue-100 text-blue-700'],
              ['name_ru', 'RU', 'bg-gray-100 text-gray-700'],
              ['name_pl', 'PL', 'bg-red-100 text-red-700'],
              ['name_uk', 'UK', 'bg-yellow-100 text-yellow-700'],
            ] as const
          ).map(([key, lang, cls]) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{lang}</span>
              </Label>
              <Input
                value={(form[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                className="rounded-xl"
                placeholder={`Название (${lang})`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Category + Unit */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚙️ Параметры</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Категория</Label>
            <Select value={form.category_id} onValueChange={(v) => set('category_id', v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ru || c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Единица измерения</Label>
            <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Единица" />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Nutrients */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🥗 Нутриенты (на 100г)</h2>
        <div className="grid grid-cols-5 gap-3">
          {(
            [
              ['calories_per_100g', 'Ккал'],
              ['protein_per_100g', 'Белки'],
              ['fat_per_100g', 'Жиры'],
              ['carbs_per_100g', 'Углеводы'],
              ['density_g_per_ml', 'Плотность'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                className="rounded-xl tabular-nums"
                value={(form as Record<string, unknown>)[key] as number ?? ''}
                onChange={(e) =>
                  set(key, e.target.value ? parseFloat(e.target.value) : undefined)
                }
                placeholder="—"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Descriptions */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📝 Описания</h2>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              ['description_en', 'EN', 'bg-blue-100 text-blue-700'],
              ['description_ru', 'RU', 'bg-gray-100 text-gray-700'],
              ['description_pl', 'PL', 'bg-red-100 text-red-700'],
              ['description_uk', 'UK', 'bg-yellow-100 text-yellow-700'],
            ] as const
          ).map(([key, lang, cls]) => (
            <div key={key} className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{lang}</span>
              </Label>
              <Textarea
                rows={3}
                value={(form[key] as string) ?? ''}
                onChange={(e) => set(key, e.target.value)}
                className="rounded-xl resize-none"
                placeholder={`Описание (${lang})`}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Seasons */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🗓 Сезоны</h2>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => {
            const active = form.seasons?.includes(s) ?? false;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleArray('seasons', s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                    : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                }`}
              >
                <span>{SEASON_ICONS[s]}</span>
                {s}
              </button>
            );
          })}
        </div>
        {(form.seasons?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {form.seasons!.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {SEASON_ICONS[s]} {s}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Allergens */}
      <section className="glass rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚠️ Аллергены</h2>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => {
            const active = form.allergens?.includes(a) ?? false;
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleArray('allergens', a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  active
                    ? 'bg-destructive/90 text-destructive-foreground border-destructive shadow-sm'
                    : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
        {(form.allergens?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {form.allergens!.map((a) => (
              <Badge key={a} variant="destructive" className="text-xs">
                {a}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Save buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving || uploading}
          className="h-11 px-8 rounded-xl font-semibold"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Сохранить
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleSaveWithAutoTranslate}
          disabled={saving || uploading}
          className="h-11 px-8 rounded-xl font-semibold"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Сохранить + AI перевод
        </Button>

        <Button
          variant="ghost"
          onClick={() => product && resetForm(product)}
          disabled={saving}
          className="h-11 rounded-xl"
        >
          Сбросить
        </Button>
      </div>

      {/* Meta */}
      <div className="text-[10px] font-mono text-muted-foreground/40 select-all">
        ID: {product.id}
      </div>
    </div>
  );
}
