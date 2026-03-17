'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getProducts,
  getCategories,
  getDataQuality,
  type Product,
  type Category,
  type DataQualityProduct,
  type MissingField,
  type NotApplicableField,
} from '@/lib/admin-api';
import { getToken, clearToken } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Search,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<string, string> = {
  basic: '📦 Основное',
  nutrition: '🥗 Нутриенты',
  seo: '🔍 SEO',
  relations: '🔗 Связи',
};

const GROUP_COLOR: Record<string, string> = {
  basic: 'bg-blue-500',
  nutrition: 'bg-green-500',
  seo: 'bg-purple-500',
  relations: 'bg-orange-500',
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <XCircle className="h-3 w-3 text-red-500 shrink-0" />,
  recommended: <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />,
  optional: <AlertTriangle className="h-3 w-3 text-muted-foreground/50 shrink-0" />,
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  complete: { label: '🟢 Complete', color: 'text-green-600' },
  optional_missing: { label: '🟡 Optional missing', color: 'text-yellow-600' },
  critical_missing: { label: '🔴 Critical missing', color: 'text-red-500' },
};

interface MergedRow {
  product: Product;
  quality: DataQualityProduct;
  catName: string;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={`text-xs font-bold tabular-nums w-8 text-right ${
          score >= 80
            ? 'text-green-600'
            : score >= 50
              ? 'text-yellow-600'
              : 'text-red-500'
        }`}
      >
        {score}%
      </span>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<
    'all' | 'complete' | 'optional' | 'critical'
  >('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [summary, setSummary] = useState({
    total: 0,
    avgScore: 0,
    complete: 0,
    critical: 0,
    optional: 0,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    Promise.all([getProducts(token), getCategories(token), getDataQuality(token)])
      .then(([prods, cats, dq]) => {
        const catMap: Record<string, string> = {};
        cats.forEach((c) => {
          catMap[c.id] = c.name_ru || c.name_en;
        });

        // Merge products with quality data from backend
        const qualityMap = new Map(dq.products.map((q) => [q.id, q]));
        const merged: MergedRow[] = prods.map((p) => ({
          product: p,
          quality: qualityMap.get(p.id) ?? {
            id: p.id,
            name_en: p.name_en,
            product_type: p.product_type ?? 'other',
            score: 0,
            filled: 0,
            total: 1,
            missing_fields: [],
            not_applicable_fields: [],
            status: 'critical_missing' as const,
          },
          catName: catMap[p.category_id] ?? '—',
        }));

        setRows(merged);
        setSummary({
          total: dq.total,
          avgScore: dq.avg_score,
          complete: dq.complete,
          critical: dq.critical_missing,
          optional: dq.optional_missing,
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          clearToken();
          router.push('/login');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows
    .filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        [r.product.name_ru, r.product.name_en, r.product.slug]
          .filter(Boolean)
          .some((n) => n!.toLowerCase().includes(q));
      const matchGroup =
        filterGroup === 'all' ||
        (filterGroup === 'complete' && r.quality.status === 'complete') ||
        (filterGroup === 'optional' && r.quality.status === 'optional_missing') ||
        (filterGroup === 'critical' && r.quality.status === 'critical_missing');
      return matchSearch && matchGroup;
    })
    .sort((a, b) =>
      sortBy === 'score'
        ? a.quality.score - b.quality.score
        : (a.product.name_ru || a.product.name_en).localeCompare(
            b.product.name_ru || b.product.name_en,
          ),
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Анализ каталога (backend)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">🔍 Data Quality</h1>
        <p className="text-muted-foreground mt-1">
          Backend = source of truth · {summary.total} продуктов · {summary.complete}{' '}
          ✅ · {summary.critical} 🔴 · {summary.optional} 🟡
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Всего продуктов</p>
          <p className="text-2xl font-bold">{summary.total}</p>
          <ScoreBar score={summary.avgScore} />
          <p className="text-xs text-muted-foreground">Средний балл</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-green-500/40 transition-all"
          onClick={() =>
            setFilterGroup(filterGroup === 'complete' ? 'all' : 'complete')
          }
        >
          <p className="text-xs text-muted-foreground">🟢 Complete</p>
          <p className="text-2xl font-bold text-green-600">{summary.complete}</p>
          <p className="text-xs text-muted-foreground">100%</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-yellow-500/40 transition-all"
          onClick={() =>
            setFilterGroup(filterGroup === 'optional' ? 'all' : 'optional')
          }
        >
          <p className="text-xs text-muted-foreground">🟡 Optional missing</p>
          <p className="text-2xl font-bold text-yellow-600">{summary.optional}</p>
          <p className="text-xs text-muted-foreground">Рекомендованные</p>
        </div>
        <div
          className="glass rounded-2xl p-4 space-y-1 cursor-pointer hover:ring-1 hover:ring-red-500/40 transition-all"
          onClick={() =>
            setFilterGroup(filterGroup === 'critical' ? 'all' : 'critical')
          }
        >
          <p className="text-xs text-muted-foreground">🔴 Critical missing</p>
          <p className="text-2xl font-bold text-red-500">{summary.critical}</p>
          <p className="text-xs text-muted-foreground">Обязательные</p>
        </div>
      </div>

      {/* Top missing fields heatmap — only counts APPLICABLE products per field */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          📊 Топ незаполненных полей (только релевантные продукты)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            // Count how many products are missing each field — only where applicable
            const fieldCounts: Record<
              string,
              { label: string; count: number; applicable: number; severity: string }
            > = {};

            // Collect not_applicable sets per field
            const naSet: Record<string, Set<string>> = {};
            rows.forEach((r) => {
              (r.quality.not_applicable_fields ?? []).forEach((f) => {
                if (!naSet[f.field]) naSet[f.field] = new Set();
                naSet[f.field].add(r.quality.id);
              });
            });

            rows.forEach((r) => {
              r.quality.missing_fields.forEach((f) => {
                if (!fieldCounts[f.field]) {
                  const naCount = naSet[f.field]?.size ?? 0;
                  fieldCounts[f.field] = {
                    label: f.label_ru,
                    count: 0,
                    applicable: summary.total - naCount,
                    severity: f.severity,
                  };
                }
                fieldCounts[f.field].count++;
              });
            });

            return Object.entries(fieldCounts)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 8)
              .map(([field, { label, count, applicable, severity }]) => {
                const pct = applicable > 0
                  ? Math.round((count / applicable) * 100)
                  : 0;
                return (
                  <div key={field} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {severity === 'critical' ? '🔴' : severity === 'recommended' ? '🟡' : '⚪'}
                        {label}
                      </span>
                      <span
                        className={
                          pct > 50
                            ? 'text-red-500 font-bold'
                            : pct > 20
                              ? 'text-yellow-600'
                              : 'text-green-600'
                        }
                      >
                        {count}/{applicable}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct > 50
                            ? 'bg-red-500'
                            : pct > 20
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              });
          })()}
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
        {filtered.map(({ product: p, quality: q, catName }) => {
          const isExpanded = expandedId === p.id;
          const sb = STATUS_BADGE[q.status] ?? STATUS_BADGE.critical_missing;
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
                    <Image
                      src={p.image_url}
                      alt={p.name_ru || p.name_en}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 text-lg">
                    🛒
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {p.name_ru || p.name_en}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {catName}
                    {p.product_type ? ` · ${p.product_type}` : ''}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`text-[10px] font-bold ${sb.color} hidden md:block`}>
                  {sb.label}
                </span>

                {/* Missing badges (top 3) */}
                <div className="hidden md:flex flex-wrap gap-1 max-w-xs">
                  {q.missing_fields.slice(0, 3).map((f) => (
                    <span
                      key={f.field}
                      className={`text-[10px] border px-1.5 py-0.5 rounded ${
                        f.severity === 'critical'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : f.severity === 'recommended'
                            ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                            : 'bg-muted/30 text-muted-foreground border-border/30'
                      }`}
                    >
                      {f.label_ru}
                    </span>
                  ))}
                  {q.missing_fields.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{q.missing_fields.length - 3}
                    </span>
                  )}
                  {q.missing_fields.length === 0 && (
                    <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Всё заполнено
                    </span>
                  )}
                </div>

                {/* Score */}
                <div className="w-24 shrink-0">
                  <ScoreBar score={q.score} />
                </div>

                {/* Edit */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/products/${p.id}`);
                  }}
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
                  {/* Score summary */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium">
                      {q.filled}/{q.total} полей
                    </span>
                    <span className={`font-bold ${sb.color}`}>{sb.label}</span>
                    {(q.not_applicable_fields ?? []).length > 0 && (
                      <span className="text-xs text-muted-foreground/60">
                        · {q.not_applicable_fields.length} не применимо
                      </span>
                    )}
                  </div>

                  {/* Group by category — missing fields */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(
                      Object.keys(GROUP_LABELS) as (keyof typeof GROUP_LABELS)[]
                    ).map((group) => {
                      const groupMissing = q.missing_fields.filter(
                        (f) => f.group === group,
                      );
                      if (groupMissing.length === 0) return null;
                      return (
                        <div key={group} className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`w-2 h-2 rounded-full ${GROUP_COLOR[group]}`}
                            />
                            <span className="text-xs font-semibold">
                              {GROUP_LABELS[group]}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {groupMissing.map((f) => (
                              <div
                                key={f.field}
                                className="flex items-center gap-1.5"
                              >
                                {SEVERITY_ICON[f.severity]}
                                <span className="text-xs font-medium">
                                  {f.label_ru}
                                </span>
                                <span className="text-[10px] text-muted-foreground/60 ml-auto">
                                  {f.severity === 'critical'
                                    ? 'обяз.'
                                    : f.severity === 'recommended'
                                      ? 'рекоменд.'
                                      : 'опцион.'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {q.missing_fields.length === 0 && (
                      <div className="col-span-full text-center text-green-600 text-sm py-2">
                        <CheckCircle2 className="h-5 w-5 inline mr-1" />
                        Все поля заполнены!
                      </div>
                    )}
                  </div>

                  {/* Not applicable fields — collapsed info row */}
                  {(q.not_applicable_fields ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
                      {q.not_applicable_fields.map((f) => (
                        <span
                          key={f.field}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground/50 border border-border/10 flex items-center gap-1"
                          title={f.reason}
                        >
                          <Info className="h-2.5 w-2.5" />
                          {f.label_ru}
                          <span className="text-muted-foreground/30">· н/п</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {p.calories_per_100g != null && (
                        <span>🔥 {p.calories_per_100g} ккал</span>
                      )}
                      {p.protein_per_100g && (
                        <span>
                          Б: {parseFloat(p.protein_per_100g).toFixed(1)}г
                        </span>
                      )}
                      {p.fat_per_100g && (
                        <span>
                          Ж: {parseFloat(p.fat_per_100g).toFixed(1)}г
                        </span>
                      )}
                      {p.carbs_per_100g && (
                        <span>
                          У: {parseFloat(p.carbs_per_100g).toFixed(1)}г
                        </span>
                      )}
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
        {filtered.length} из {summary.total} продуктов · Field Requirement Level · Backend source of truth
      </div>
    </div>
  );
}
