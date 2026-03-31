"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  searchProducts,
  getProduct,
  type SearchProductResult,
  type Product,
} from "@/lib/admin-api";
import { Search, X, Loader2, Plus, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Types ────────────────────────────────────────────────────────────

export type IngredientUnit = "g" | "pcs" | "ml";

export interface SelectedIngredient {
  id: string;
  slug: string;
  name_en: string;
  name_ru: string | null;
  image_url: string | null;
  product_type: string | null;
  grams: number; // always stored in grams (source of truth for macros)
  unit: IngredientUnit; // display unit
  unitAmount: number; // amount in display unit (e.g. 2 for "2 шт")
  // Macros (loaded async from full Product)
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
}

/** Unit labels */
const UNIT_LABELS: Record<IngredientUnit, string> = {
  g: "г",
  pcs: "шт",
  ml: "мл",
};

/** Detect if an ingredient is actually eggs (DB may store as "dairy") */
function isEgg(productType: string | null, slug: string): boolean {
  if (productType?.toLowerCase() === "egg") return true;
  // chicken-eggs, quail-eggs, etc. stored as "dairy" in DB
  return /egg/i.test(slug) && !/eggplant/i.test(slug);
}

/** Which units are available for a product type */
function availableUnits(productType: string | null, slug = ""): IngredientUnit[] {
  if (isEgg(productType, slug)) return ["pcs", "g"];
  switch (productType?.toLowerCase()) {
    case "oil":
    case "sauce":
    case "beverage":
      return ["ml", "g"];
    case "fruit":
      return ["pcs", "g"];
    default:
      return ["g"];
  }
}

/** Default unit for a product type */
function defaultUnit(productType: string | null, slug = ""): IngredientUnit {
  if (isEgg(productType, slug)) return "pcs";
  switch (productType?.toLowerCase()) {
    case "oil":
    case "sauce":
    case "beverage":
      return "ml";
    default:
      return "g";
  }
}

/** Grams per 1 unit (for pcs/ml conversion) */
function gramsPerUnit(productType: string | null, unit: IngredientUnit, slug = ""): number {
  if (unit === "g") return 1;
  if (unit === "ml") {
    switch (productType?.toLowerCase()) {
      case "oil": return 0.92;
      default: return 1;
    }
  }
  // pcs
  if (isEgg(productType, slug)) return 60; // 1 egg ≈ 60g
  switch (productType?.toLowerCase()) {
    case "fruit": return 150; // 1 medium fruit ≈ 150g
    default: return 100;
  }
}

/** Default amount in the default unit */
function defaultUnitAmount(productType: string | null, slug = ""): number {
  const unit = defaultUnit(productType, slug);
  if (unit === "pcs") {
    if (isEgg(productType, slug)) return 2;
    switch (productType?.toLowerCase()) {
      case "fruit": return 1;
      default: return 1;
    }
  }
  // For g or ml, return the portion grams
  return defaultGrams(productType);
}

/** Map product_type → default grams for 1 portion */
function defaultGrams(productType: string | null): number {
  switch (productType?.toLowerCase()) {
    case "seafood":
    case "meat":
    case "poultry":
      return 150;
    case "dairy":
      return 100;
    case "egg":
      return 60;
    case "grain":
    case "bread":
    case "legume":
      return 80;
    case "vegetable":
      return 120;
    case "fruit":
      return 100;
    case "nut":
      return 30;
    case "oil":
      return 15;
    case "spice":
    case "condiment":
    case "sauce":
      return 10;
    default:
      return 100;
  }
}

/** product_type → culinary role */
export function getRole(productType: string | null): string {
  switch (productType?.toLowerCase()) {
    case "seafood":
    case "meat":
    case "poultry":
      return "🥩 Белок";
    case "dairy":
    case "egg":
      return "🥚 Молочные/Яйца";
    case "grain":
    case "bread":
    case "legume":
      return "🍚 База";
    case "vegetable":
      return "🥦 Овощи";
    case "fruit":
      return "🍎 Фрукты";
    case "nut":
      return "🥜 Орехи";
    case "oil":
      return "🫒 Жиры";
    case "spice":
    case "condiment":
    case "sauce":
      return "🧂 Специи";
    case "mushroom":
      return "🍄 Грибы";
    default:
      return "🍽️ Прочее";
  }
}

/** Type → emoji for compact display */
function typeEmoji(productType: string | null): string {
  switch (productType?.toLowerCase()) {
    case "seafood": return "🐟";
    case "meat": return "🥩";
    case "poultry": return "🍗";
    case "dairy": return "🧀";
    case "egg": return "🥚";
    case "grain": return "🍚";
    case "bread": return "🍞";
    case "legume": return "🫘";
    case "vegetable": return "🥦";
    case "fruit": return "🍎";
    case "nut": return "🥜";
    case "oil": return "🫒";
    case "spice": return "🧂";
    case "condiment": return "🫙";
    case "sauce": return "🍶";
    case "mushroom": return "🍄";
    case "sweetener": return "🍯";
    case "beverage": return "🥤";
    default: return "🍽️";
  }
}

// ── Component ────────────────────────────────────────────────────────

interface IngredientPickerProps {
  token: string;
  selected: SelectedIngredient[];
  onChange: (items: SelectedIngredient[]) => void;
  maxItems?: number;
}

export default function IngredientPicker({
  token,
  selected,
  onChange,
  maxItems = 8,
}: IngredientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Search with debounce ──────────────────────────────────────────

  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const hits = await searchProducts(token, q.trim());
        // Filter out already selected
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(hits.filter((h) => !selectedIds.has(h.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [token, selected],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // ── Add ingredient ────────────────────────────────────────────────

  const addIngredient = async (hit: SearchProductResult) => {
    if (selected.length >= maxItems) return;

    const slug = hit.slug || hit.name_en.toLowerCase().replace(/\s+/g, "-");
    const unit = defaultUnit(hit.product_type, slug);
    const unitAmt = defaultUnitAmount(hit.product_type, slug);
    const grams = unit === "g"
      ? unitAmt
      : Math.round(unitAmt * gramsPerUnit(hit.product_type, unit, slug));

    // Build initial item with default grams
    const item: SelectedIngredient = {
      id: hit.id,
      slug,
      name_en: hit.name_en,
      name_ru: hit.name_ru,
      image_url: hit.image_url,
      product_type: hit.product_type,
      grams,
      unit,
      unitAmount: unitAmt,
      calories_per_100g: null,
      protein_per_100g: null,
      fat_per_100g: null,
      carbs_per_100g: null,
    };

    onChange([...selected, item]);
    setQuery("");
    setResults([]);
    inputRef.current?.focus();

    // Load full macros async
    try {
      const full: Product = await getProduct(token, hit.id);
      const cal = full.calories_per_100g ?? null;
      const pro = full.protein_per_100g ? parseFloat(String(full.protein_per_100g)) : null;
      const fat = full.fat_per_100g ? parseFloat(String(full.fat_per_100g)) : null;
      const carb = full.carbs_per_100g ? parseFloat(String(full.carbs_per_100g)) : null;

      // We need to build the updated list explicitly since onChange takes a value, not updater
      const updatedItem: SelectedIngredient = {
        ...item,
        calories_per_100g: cal,
        protein_per_100g: pro,
        fat_per_100g: fat,
        carbs_per_100g: carb,
      };
      // Replace the item in the current selected + new item list
      onChange([...selected, updatedItem]);
    } catch {
      // Macros stay null — no big deal
    }
  };

  // ── Remove ────────────────────────────────────────────────────────

  const removeIngredient = (id: string) => {
    onChange(selected.filter((s) => s.id !== id));
  };

  // ── Update amount (in current unit) ────────────────────────────────

  const updateAmount = (id: string, unitAmount: number) => {
    onChange(
      selected.map((s) => {
        if (s.id !== id) return s;
        const grams = s.unit === "g"
          ? unitAmount
          : Math.round(unitAmount * gramsPerUnit(s.product_type, s.unit, s.slug));
        return { ...s, unitAmount, grams };
      }),
    );
  };

  // ── Switch unit ───────────────────────────────────────────────────

  const switchUnit = (id: string, newUnit: IngredientUnit) => {
    onChange(
      selected.map((s) => {
        if (s.id !== id) return s;
        // Convert current grams back to the new unit
        const gPerUnit = gramsPerUnit(s.product_type, newUnit, s.slug);
        const newUnitAmount = newUnit === "g"
          ? s.grams
          : Math.max(1, Math.round(s.grams / gPerUnit));
        const newGrams = newUnit === "g"
          ? newUnitAmount
          : Math.round(newUnitAmount * gPerUnit);
        return { ...s, unit: newUnit, unitAmount: newUnitAmount, grams: newGrams };
      }),
    );
  };

  // ── Totals ────────────────────────────────────────────────────────

  const totals = selected.reduce(
    (acc, ing) => {
      const factor = ing.grams / 100;
      return {
        grams: acc.grams + ing.grams,
        cal: acc.cal + (ing.calories_per_100g ?? 0) * factor,
        pro: acc.pro + (ing.protein_per_100g ?? 0) * factor,
        fat: acc.fat + (ing.fat_per_100g ?? 0) * factor,
        carb: acc.carb + (ing.carbs_per_100g ?? 0) * factor,
      };
    },
    { grams: 0, cal: 0, pro: 0, fat: 0, carb: 0 },
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Search bar ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder="Поиск ингредиента: salmon, лосось, łosoś..."
          className="pl-9 pr-10 h-11 text-base border-2 border-primary/20 focus-visible:border-primary/50"
          disabled={selected.length >= maxItems}
          autoFocus
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {/* ── Dropdown results ── */}
        {focused && results.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-xl shadow-xl max-h-64 overflow-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-accent transition-colors text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addIngredient(r);
                }}
              >
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm shrink-0">
                    {typeEmoji(r.product_type)}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.name_en}</p>
                  {r.name_ru && (
                    <p className="text-xs text-muted-foreground truncate">
                      {r.name_ru}
                    </p>
                  )}
                </div>
                {r.product_type && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {r.product_type}
                  </Badge>
                )}
                <Plus className="h-4 w-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}

        {focused && query.trim().length >= 2 && results.length === 0 && !searching && (
          <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-xl shadow-xl p-4 text-center text-sm text-muted-foreground">
            Ничего не найдено. Попробуйте другой запрос.
          </div>
        )}
      </div>

      {/* ── Selected ingredients list ── */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Ингредиенты ({selected.length}/{maxItems})
            </p>
            <p className="text-xs text-muted-foreground">
              на 1 порцию
            </p>
          </div>

          <div className="divide-y rounded-xl border bg-card overflow-hidden">
            {selected.map((ing) => {
              const cal = ing.calories_per_100g ? Math.round(ing.calories_per_100g * ing.grams / 100) : null;
              return (
                <div
                  key={ing.id}
                  className="flex items-center gap-3 px-3 py-2.5 group hover:bg-accent/30 transition-colors"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 cursor-grab" />

                  {/* Image / emoji */}
                  {ing.image_url ? (
                    <img
                      src={ing.image_url}
                      alt=""
                      className="w-9 h-9 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-lg shrink-0">
                      {typeEmoji(ing.product_type)}
                    </span>
                  )}

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {ing.name_ru || ing.name_en}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {getRole(ing.product_type)}
                      {cal !== null && <span className="ml-2">· {cal} kcal</span>}
                      {ing.protein_per_100g !== null && (
                        <span className="ml-1">
                          · Б {((ing.protein_per_100g * ing.grams) / 100).toFixed(0)}г
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Amount input + unit selector */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      value={ing.unitAmount}
                      onChange={(e) =>
                        updateAmount(ing.id, Math.max(ing.unit === "pcs" ? 1 : 1, parseFloat(e.target.value) || 1))
                      }
                      step={ing.unit === "pcs" ? 1 : ing.unit === "ml" ? 5 : 10}
                      className="w-16 h-8 text-center text-sm font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                      min={ing.unit === "pcs" ? 1 : 1}
                      max={ing.unit === "pcs" ? 50 : 2000}
                    />
                    {/* Unit selector — shown only if multiple units available */}
                    {(() => {
                      const units = availableUnits(ing.product_type, ing.slug);
                      if (units.length <= 1) {
                        return <span className="text-xs text-muted-foreground w-6">{UNIT_LABELS[ing.unit]}</span>;
                      }
                      return (
                        <select
                          value={ing.unit}
                          onChange={(e) => switchUnit(ing.id, e.target.value as IngredientUnit)}
                          className="h-8 text-xs font-medium rounded-lg border bg-background px-1 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>{UNIT_LABELS[u]}</option>
                          ))}
                        </select>
                      );
                    })()}
                    {/* Show equivalent grams when not in grams */}
                    {ing.unit !== "g" && (
                      <span className="text-[10px] text-muted-foreground/60 w-10 text-right">
                        ≈{ing.grams}г
                      </span>
                    )}
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeIngredient(ing.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10 shrink-0"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Totals bar ── */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 text-xs font-medium">
            <span className="text-muted-foreground">Итого на порцию:</span>
            <div className="flex gap-3">
              <span>{totals.grams}г</span>
              <span className="text-orange-600">{Math.round(totals.cal)} kcal</span>
              <span className="text-blue-600">Б {totals.pro.toFixed(0)}г</span>
              <span className="text-yellow-600">Ж {totals.fat.toFixed(0)}г</span>
              <span className="text-green-600">У {totals.carb.toFixed(0)}г</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hint ── */}
      {selected.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Начните вводить название ингредиента — например <strong>salmon</strong>, <strong>лосось</strong>, <strong>рис</strong>
        </p>
      )}
    </div>
  );
}
