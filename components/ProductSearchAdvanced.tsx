"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Search } from "lucide-react";
import { type Product, type Category } from "@/lib/api";

interface ProductSearchProps {
  products: Product[];
  categories?: Category[];
  units?: string[];
  initialCategory?: string;
  onResultsChange?: (results: Product[], filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  category: string;
  unit: string;
  sortBy: "name" | "newest" | "used";
}

const UNIT_TRANSLATIONS: Record<string, string> = {
  "gram": "Грамм",
  "kilogram": "Килограмм",
  "liter": "Литр",
  "milliliter": "Миллилитр",
  "piece": "Штука",
  "bunch": "Пучок",
  "can": "Банка",
  "bottle": "Бутылка",
  "package": "Пакет",
};

// Нормализация текста для поиска (игнорирует диакритику, регистр, раскладку)
const normalize = (text: string | null | undefined = ""): string =>
  (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export default function ProductSearch({
  products,
  categories = [],
  units = [],
  initialCategory = "all",
  onResultsChange,
}: ProductSearchProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    category: initialCategory,
    unit: "all",
    sortBy: "name",
  });

  // Sync initialCategory from props
  useEffect(() => {
    if (initialCategory !== filters.category) {
      setFilters(prev => ({ ...prev, category: initialCategory }));
    }
  }, [initialCategory]);

  // Debounced версия поиска (для плавного UX)
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  // Debounce: обновляем debounced значение с задержкой 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.search]);

  // ✅ Чистая функция: только вычисление результатов
  const filteredProducts = useMemo(() => {
    let results = [...products];

    // 1. Поиск по всем языкам (с нормализацией)
    if (debouncedSearch.trim()) {
      const query = normalize(debouncedSearch);
      results = results.filter((product) => {
        const category = categories.find(c => c.id === product.category_id);
        const categoryName = category ? (category.name_ru || category.name_en || category.name) : "";
        
        return (
          normalize(product.name_en).includes(query) ||
          normalize(product.name_ru).includes(query) ||
          normalize(product.name_pl).includes(query) ||
          normalize(product.name_uk).includes(query) ||
          normalize(product.description).includes(query) ||
          normalize(categoryName).includes(query)
        );
      });
    }

    // 2. Фильтр по категории
    if (filters.category !== "all") {
      results = results.filter((p) => p.category_id === filters.category);
    }

    // 3. Фильтр по единице
    if (filters.unit !== "all") {
      results = results.filter((p) => p.unit === filters.unit);
    }

    // 4. Сортировка
    switch (filters.sortBy) {
      case "name":
        results.sort((a, b) => (a.name_en || "").localeCompare(b.name_en || ""));
        break;
      case "newest":
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "used":
        // Можно добавить поле usage_count в Product
        break;
    }

    return results;
  }, [products, debouncedSearch, filters.category, filters.unit, filters.sortBy]);

  // ✅ Побочные эффекты в useEffect
  useEffect(() => {
    console.log("🔍 Filtered products:", filteredProducts.length, "Filters:", filters);
    onResultsChange?.(filteredProducts, filters);
  }, [filteredProducts, filters, onResultsChange]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  };

  const handleClear = () => {
    setFilters({
      search: "",
      category: "all",
      unit: "all",
      sortBy: "name",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.category !== "all" ||
    filters.unit !== "all" ||
    filters.sortBy !== "name";

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 w-full">
      {/* Search Input - Ultra Modern */}
      <div className="relative flex-1 w-full group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors duration-300" />
        </div>
        <Input
          type="text"
          value={filters.search}
          onChange={handleSearchChange}
          placeholder="Поиск по названию, описанию или категории..."
          className="pl-12 h-14 bg-white/5 border-border/40 focus-visible:ring-2 focus-visible:ring-primary/20 transition-all rounded-[1.25rem] text-base font-medium placeholder:text-muted-foreground/40 shadow-inner"
        />
        {filters.search && (
          <button 
            onClick={() => setFilters(prev => ({ ...prev, search: "" }))}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 transition-colors"
          >
            <Filter className="h-4 w-4 text-muted-foreground/40" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        {/* Sort - Elegant Select */}
        <Select value={filters.sortBy} onValueChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value as FilterState["sortBy"] }))}>
          <SelectTrigger className="h-14 min-w-[180px] bg-white/5 border-border/40 rounded-[1.25rem] focus:ring-2 focus:ring-primary/20 transition-all hover:bg-white/10 shadow-inner">
            <div className="flex items-center gap-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Сортировка</span>
              <div className="font-bold text-sm text-foreground/90">
                <SelectValue placeholder="Сортировка" />
              </div>
            </div>
          </SelectTrigger>
          <SelectContent align="end" className="rounded-2xl border-border/40 shadow-2xl bg-card/90 backdrop-blur-xl ring-1 ring-white/10">
            <SelectItem value="name" className="rounded-xl font-bold text-sm py-3 focus:bg-primary/10">По алфавиту [A-Z]</SelectItem>
            <SelectItem value="newest" className="rounded-xl font-bold text-sm py-3 focus:bg-primary/10">Сначала новые</SelectItem>
            <SelectItem value="used" className="rounded-xl font-bold text-sm py-3 focus:bg-primary/10">По пулярности</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={handleClear}
            className="h-14 px-6 rounded-[1.25rem] bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all duration-300 font-bold text-xs uppercase tracking-widest border border-destructive/10"
          >
            Сброс
          </Button>
        )}
      </div>
    </div>
  );
}
