"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface IngredientSuggestion {
  slug: string;
  name: string;        // localised
  name_en: string;     // english (used as entity_a)
  image_url?: string | null;
  category?: string | null;
}

interface Props {
  value: string;
  onChange: (value: string, suggestion?: IngredientSuggestion) => void;
  lang?: string;        // search language: en / ru / pl / uk
  placeholder?: string;
  disabled?: boolean;
}

export function IngredientAutocomplete({ value, onChange, lang = "en", placeholder, disabled }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value → local query
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced search
  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.trim().length < 2) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `${API_URL}/public/ingredients/autocomplete?q=${encodeURIComponent(q)}&lang=${lang}&limit=10`
          );
          if (!res.ok) throw new Error("Search failed");
          const data: IngredientSuggestion[] = await res.json();
          setSuggestions(data);
          setOpen(data.length > 0);
          setHighlighted(-1);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [lang]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    search(v);
  };

  const handleSelect = (item: IngredientSuggestion) => {
    // Pass name_en as the entity value (used for generation)
    setQuery(item.name_en);
    onChange(item.name_en, item);
    setOpen(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {loading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        )}
        <Input
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "напр. salmon, almonds, avocado..."}
          disabled={disabled}
          className="pl-9 pr-8"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-xl shadow-lg overflow-hidden max-h-[280px] overflow-y-auto">
          {suggestions.map((item, i) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => handleSelect(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors ${
                i === highlighted ? "bg-accent" : ""
              }`}
            >
              {/* Image or emoji placeholder */}
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base">🌿</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.name}</div>
                {item.category && (
                  <div className="text-xs text-muted-foreground truncate">{item.category}</div>
                )}
              </div>

              {/* English name hint (used for generation) */}
              {item.name !== item.name_en && (
                <div className="text-xs text-muted-foreground flex-shrink-0">{item.name_en}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
