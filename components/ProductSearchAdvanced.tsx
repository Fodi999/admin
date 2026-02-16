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
import { Filter } from "lucide-react";
import { type Product, type Category } from "@/lib/api";

interface ProductSearchProps {
  products: Product[];
  categories?: Category[];
  units?: string[];
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
  onResultsChange,
}: ProductSearchProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    category: "all",
    unit: "all",
    sortBy: "name",
  });
  
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
        return (
          normalize(product.name_en).includes(query) ||
          normalize(product.name_ru).includes(query) ||
          normalize(product.name_pl).includes(query) ||
          normalize(product.name_uk).includes(query) ||
          normalize(product.description).includes(query)
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
    <div className="space-y-4">
      {/* Search Input - shadcn Input */}
      <Input
        type="text"
        value={filters.search}
        onChange={handleSearchChange}
        placeholder="Найти продукт..."
      />
      
      <p className="text-xs text-muted-foreground">
        Поддерживает русский, английский, польский и украинский языки
      </p>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2">
        {/* Category Filter */}
        <Select value={filters.category} onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}>
          <SelectTrigger className="h-10 min-w-[180px] bg-popover border border-border shadow-sm hover:bg-accent">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent className="z-50 min-w-[180px] rounded-md bg-popover border border-border shadow-md backdrop-blur-0">
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Unit Filter */}
        <Select value={filters.unit} onValueChange={(value) => setFilters((prev) => ({ ...prev, unit: value }))}>
          <SelectTrigger className="h-10 min-w-[180px] bg-popover border border-border shadow-sm hover:bg-accent">
            <SelectValue placeholder="Единица" />
          </SelectTrigger>
          <SelectContent className="z-50 min-w-[180px] rounded-md bg-popover border border-border shadow-md backdrop-blur-0">
            <SelectItem value="all">Все единицы</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {UNIT_TRANSLATIONS[unit] || unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={filters.sortBy} onValueChange={(value) => setFilters((prev) => ({ ...prev, sortBy: value as FilterState["sortBy"] }))}>
          <SelectTrigger className="h-10 min-w-[180px] bg-popover border border-border shadow-sm hover:bg-accent">
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent className="z-50 min-w-[180px] rounded-md bg-popover border border-border shadow-md backdrop-blur-0">
            <SelectItem value="name">A → Z</SelectItem>
            <SelectItem value="newest">Новые</SelectItem>
            <SelectItem value="used">Популярные</SelectItem>
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-10"
          >
            <Filter className="h-4 w-4 mr-2" />
            Очистить
          </Button>
        )}
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground pt-2">
        Найдено: <span className="font-semibold text-foreground">{filteredProducts.length}</span> продуктов
      </div>
    </div>
  );
}
