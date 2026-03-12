'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProducts, getCategories, nutritionGetProduct, type Product, type Category } from '@/lib/admin-api';
import { getToken, clearToken } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Pencil, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

// Что считаем "заполненным" для базовых данных из catalog
interface ProductScore {
  product: Product;
  catName: string;
  score: number; // 0–100
  checks: Check[];
}

interface Check {
  label: string;
  group: 'basic' | 'nutrition' | 'allergens' | 'vitamins' | 'culinary';
  ok: boolean;
}

function calcScore(p: Product): Check[] {
  return [
    // Basic
    { label: 'Фото', group: 'basic', ok: !!p.image_url },
    { label: 'Название RU', group: 'basic', ok: !!p.name_ru },
    { label: 'Название EN', group: 'basic', ok: !!p.name_en },
    { label: 'Описание RU', group: 'basic', ok: !!p.description_ru },
    { label: 'Описание EN', group: 'basic', ok: !!p.description_en },
    { label: 'Категория', group: 'basic', ok: !!p.category_id },
    { label: 'Тип продукта', group: 'basic', ok: !!p.product_type },
    { label: 'Slug', group: 'basic', ok: !!p.slug },
    // Nutrition (from catalog fields)
    { label: 'Калории', group: 'nutrition', ok: p.calories_per_100g != null },
    { label: 'Белки', group: 'nutrition', ok: p.protein_per_100g != null },
    { label: 'Жиры', group: 'nutrition', ok: p.fat_per_100g != null },
    { label: 'Углеводы', group: 'nutrition', ok: p.carbs_per_100g != null },
    { label: 'Клетчатка', group: 'nutrition', ok: p.fiber_per_100g != null },
    // Seasonality
    { label: 'Сезонность', group: 'culinary', ok: !!(p.seasons?.length) || !!(p.availability_months?.some(Boolean)) },
  ];
}

const GROUP_LABELS: Record<string, string> = {
  basic: '📦 Основное',
  nutrition: '🥗 Нутриенты',
  allergens: '⚠️ Аллергены',
  vitamins: '💊 Витамины',
  culinary: '👨‍🍳 Кулинария',
};

const GROUP_COLOR: Record<string, string> = {
  basic: 'bg-blue-500',
  nutrition: 'bg-green-500',
  allergens: 'bg-red-500',
  vitamins: 'bg-purple-500',
  culinary: 'bg-orange-500',
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
        {score}%
      </span>
    </div>
  );
}

export default function AuditPage() {
  const router = useRouter();
  const [scores, setScores] = useState<ProductScore[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<'all' | 'ok' | 'warn' | 'bad'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    Promise.all([getProducts(token), getCategories(token)])
      .then(([prods, cats]) => {
        setCategories(cats);
        const catMap: Record<string, string> = {};
        cats.forEach((c) => { catMap[c.id] = c.name_ru || c.name_en; });
        const scored: ProductScore[] = prods.map((p) => {
          const checks = calcScore(p);
          const ok = checks.filter((c) => c.ok).length;
          const score = Math.round((ok / checks.length) * 100);
          return { product: p, catName: catMap[p.category_id] ?? '—', score, checks };
        });
        setScores(scored);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          clearToken(); router.push('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = scores
    .filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || [s.product.name_ru, s.product.name_en, s.product.slug]
        .filter(Boolean).some((n) => n!.toLowerCase().includes(q));
      const matchGroup =
        filterGroup === 'all' ||
        (filterGroup === 'ok' && s.score >= 80) ||
        (filterGroup === 'warn' && s.score >= 50 && s.score < 80) ||
        (filterGroup === 'bad' && s.score < 50);
      return matchSearch && matchGroup;
    })
    .sort((a, b) =>
      sortBy === 'score'
        ? a.score - b.score
        : (a.product.name_ru || a.product.name_en).localeCompare(b.product.name_ru || b.product.name_en)
    );

  const total = scores.length;
  const countOk = scores.filter((s) => s.score >= 80).length;
  const countWarn = scores.filter((s) => s.score >= 50 && s.score < 80).length;
  const countBad = scores.filter((s) => s.score < 50).length;
  const avgScore = total ? Math.round(scores.reduce((a, s) => a + s.score, 0) / total) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Анализ каталога...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">🔍 AI Audit</h1>
        <p className="text-muted-foreground mt-1">Полнота данных по каталогу продуктов</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Всего продуктов</p>
          <p className="text-2xl font-bold">{total}</p>
          <ScoreBar score={avgScore} />
          <p className="text-xs text-muted-foreground">Средний балл</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-green-500/40 transition-all"
          onClick={() => setFilterGroup(filterGroup === 'ok' ? 'all' : 'ok')}
        >
          <p className="text-xs text-muted-foreground">✅ Заполнены хорошо</p>
          <p className="text-2xl font-bold text-green-600">{countOk}</p>
          <p className="text-xs text-muted-foreground">≥ 80%</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-yellow-500/40 transition-all"
          onClick={() => setFilterGroup(filterGroup === 'warn' ? 'all' : 'warn')}
        >
          <p className="text-xs text-muted-foreground">⚠️ Частично</p>
          <p className="text-2xl font-bold text-yellow-600">{countWarn}</p>
          <p className="text-xs text-muted-foreground">50–79%</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-red-500/40 transition-all"
          onClick={() => setFilterGroup(filterGroup === 'bad' ? 'all' : 'bad')}
        >
          <p className="text-xs text-muted-foreground">❌ Мало данных</p>
          <p className="text-2xl font-bold text-red-500">{countBad}</p>
          <p className="text-xs text-muted-foreground">&lt; 50%</p>
        </div>
      </div>

      {/* Missing fields heatmap */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📊 Незаполненные поля (топ проблем)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['Фото', 'Описание RU', 'Описание EN', 'Клетчатка', 'Тип продукта', 'Сезонность', 'Slug', 'Калории'] as const).map((label) => {
            const missing = scores.filter((s) => s.checks.find((c) => c.label === label && !c.ok)).length;
            const pct = total ? Math.round((missing / total) * 100) : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={pct > 50 ? 'text-red-500 font-bold' : pct > 20 ? 'text-yellow-600' : 'text-green-600'}>
                    {missing} прод.
                  </span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct > 50 ? 'bg-red-500' : pct > 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск продукта..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button
          variant={sortBy === 'score' ? 'default' : 'outline'}
          size="sm"
          className="rounded-xl"
          onClick={() => setSortBy('score')}
        >
          По баллу
        </Button>
        <Button
          variant={sortBy === 'name' ? 'default' : 'outline'}
          size="sm"
          className="rounded-xl"
          onClick={() => setSortBy('name')}
        >
          По имени
        </Button>
      </div>

      {/* Product list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
            Ничего не найдено
          </div>
        )}
        {filtered.map(({ product: p, catName, score, checks }) => {
          const isExpanded = expandedId === p.id;
          const missing = checks.filter((c) => !c.ok);
          return (
            <div key={p.id} className="glass rounded-2xl overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
              >
                {/* Image */}
                {p.image_url ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border/30 shrink-0">
                    <Image src={p.image_url} alt={p.name_ru || p.name_en} fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 text-lg">
                    🛒
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.name_ru || p.name_en}</div>
                  <div className="text-xs text-muted-foreground truncate">{catName}{p.product_type ? ` · ${p.product_type}` : ''}</div>
                </div>

                {/* Missing badges */}
                <div className="hidden md:flex flex-wrap gap-1 max-w-xs">
                  {missing.slice(0, 3).map((c) => (
                    <span key={c.label} className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded">
                      {c.label}
                    </span>
                  ))}
                  {missing.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{missing.length - 3}</span>
                  )}
                  {missing.length === 0 && (
                    <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Всё заполнено
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="w-24 shrink-0">
                  <ScoreBar score={score} />
                </div>

                {/* Actions */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg shrink-0"
                  onClick={(e) => { e.stopPropagation(); router.push(`/products/${p.id}`); }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border/40 p-4 bg-muted/5 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]).map((group) => {
                      const groupChecks = checks.filter((c) => c.group === group);
                      if (groupChecks.length === 0) return null;
                      const groupOk = groupChecks.filter((c) => c.ok).length;
                      return (
                        <div key={group} className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${GROUP_COLOR[group]}`} />
                            <span className="text-xs font-semibold">{GROUP_LABELS[group]}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{groupOk}/{groupChecks.length}</span>
                          </div>
                          <div className="space-y-1">
                            {groupChecks.map((c) => (
                              <div key={c.label} className="flex items-center gap-1.5">
                                {c.ok ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                )}
                                <span className={`text-xs ${c.ok ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                                  {c.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {p.calories_per_100g != null && <span>🔥 {p.calories_per_100g} ккал</span>}
                      {p.protein_per_100g && <span>Б: {parseFloat(p.protein_per_100g).toFixed(1)}г</span>}
                      {p.fat_per_100g && <span>Ж: {parseFloat(p.fat_per_100g).toFixed(1)}г</span>}
                      {p.carbs_per_100g && <span>У: {parseFloat(p.carbs_per_100g).toFixed(1)}г</span>}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 px-4 rounded-xl text-xs"
                      onClick={() => router.push(`/products/${p.id}`)}
                    >
                      <Pencil className="h-3 w-3 mr-1.5" />
                      Редактировать
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground/40 text-center">
        {filtered.length} из {total} продуктов
      </div>
    </div>
  );
}
