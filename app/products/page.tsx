'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getProducts,
  getCategories,
  deleteProduct,
  type Product,
  type Category,
} from '@/lib/admin-api';
import { getToken, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, Pencil, Trash2, Search } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        getProducts(token),
        getCategories(token),
      ]);
      setProducts(prods);
      setCategories(cats);
      setError('');
    } catch (err) {
      if (err instanceof Error && err.message.includes('401')) {
        clearToken(); router.push('/login');
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки');
      }
    } finally {
      setLoading(false);
    }
  }

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    return counts;
  }, [products]);

  const catName = useCallback(
    (id: string) =>
      categories.find((c) => c.id === id)?.name_ru ||
      categories.find((c) => c.id === id)?.name_en ||
      '—',
    [categories],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        [p.name_en, p.name_ru, p.name_pl, p.slug]
          .filter(Boolean)
          .some((n) => n!.toLowerCase().includes(q));
      const matchCat = filterCat === 'all' || p.category_id === filterCat;
      return matchSearch && matchCat;
    });
  }, [products, search, filterCat]);

  async function handleDelete() {
    if (!deleteId) return;
    const token = getToken();
    if (!token) return;
    try {
      await deleteProduct(token, deleteId);
      setProducts((prev) => prev.filter((p) => p.id !== deleteId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    } finally {
      setDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка каталога...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Каталог продуктов
          </h1>
          <p className="text-muted-foreground">
            {products.length} продуктов · {categories.length} категорий
          </p>
        </div>
        <Button
          onClick={() => router.push('/products/new')}
          className="h-12 px-8 rounded-2xl shadow-xl shadow-primary/20 font-bold text-base"
        >
          <Plus className="mr-2 h-5 w-5 stroke-[3]" />
          Новый продукт
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="glass rounded-2xl p-4 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="md:hidden">
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="rounded-xl w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ru || c.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category tabs (desktop) */}
        <div className="hidden md:block overflow-x-auto">
          <Tabs value={filterCat} onValueChange={setFilterCat}>
            <TabsList className="bg-transparent h-auto p-0 flex gap-2 w-max">
              <TabsTrigger
                value="all"
                className="flex items-center gap-2 px-5 py-2 h-10 rounded-xl border border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold bg-muted/30 hover:bg-muted/50 text-sm"
              >
                Все
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-md">
                  {categoryCounts.all}
                </Badge>
              </TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex items-center gap-2 px-5 py-2 h-10 rounded-xl border border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold bg-muted/30 hover:bg-muted/50 text-sm whitespace-nowrap"
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name_ru || cat.name_en}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-md">
                    {categoryCounts[cat.id] || 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3 pl-4">Фото</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Название</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Категория</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Ккал</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Б / Ж / У</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3">Ед.</th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider p-3 pr-4">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-16 text-sm">
                    {search || filterCat !== 'all' ? 'Ничего не найдено' : 'Продукты не загружены'}
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                >
                  <td className="p-3 pl-4">
                    {p.image_url ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden ring-1 ring-border/30">
                        <Image
                          src={p.image_url}
                          alt={p.name_ru || p.name_en}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                        🛒
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="font-semibold text-sm leading-tight">
                      {p.name_ru || p.name_en}
                    </div>
                    {p.name_en && p.name_ru && (
                      <div className="text-xs text-muted-foreground">{p.name_en}</div>
                    )}
                    {p.slug && (
                      <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                        {p.slug}
                      </div>
                    )}
                  </td>

                  <td className="p-3">
                    <Badge variant="outline" className="text-xs rounded-lg">
                      {catName(p.category_id)}
                    </Badge>
                  </td>

                  <td className="p-3">
                    <span className="text-sm font-medium tabular-nums">
                      {p.calories_per_100g ?? <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {p.protein_per_100g ? parseFloat(p.protein_per_100g).toFixed(1) : '—'}
                      {' / '}
                      {p.fat_per_100g ? parseFloat(p.fat_per_100g).toFixed(1) : '—'}
                      {' / '}
                      {p.carbs_per_100g ? parseFloat(p.carbs_per_100g).toFixed(1) : '—'}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                  </td>

                  <td className="p-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg"
                        onClick={() => router.push(`/products/${p.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
            Показано {filtered.length} из {products.length}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить продукт?</DialogTitle>
            <DialogDescription>
              Это действие необратимо. Продукт будет удалён из каталога.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
