"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProducts, getCategories, deleteProduct, type Product, type Category } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, LogOut, Package, Search, Camera, Loader2, Users } from "lucide-react";
import ProductSearchAdvanced from "@/components/ProductSearchAdvanced";
import { ModeToggle } from "@/components/mode-toggle";
import ProductGrid from "@/components/ProductGrid";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const router = useRouter();

  // Calculate product counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach(p => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const handleSearchResults = useCallback((results: Product[]) => {
    setSearchResults(results);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const token = getToken();
    
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const [productsData, categoriesData] = await Promise.all([
        getProducts(token),
        getCategories(token)
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setError("");
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const token = getToken(); 
    if (!token) return;

    try {
      await deleteProduct(token, id);
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  // Get category name by ID
  function getCategoryName(categoryId: string) {
    const category = categories.find(c => c.id === categoryId);
    return category?.name_ru || category?.name_en || category?.name || "Unknown Category";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Каталог
          </h1>
          <p className="text-muted-foreground text-base max-w-md">
            Интеллектуальное управление вашим ассортиментом в реальном времени.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={() => router.push("/products/new")} 
            className="h-12 px-8 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02] active:scale-[0.98] font-bold text-base bg-primary text-primary-foreground border-none"
          >
            <Plus className="mr-2 h-5 w-5 stroke-[3]" />
            Новый продукт
          </Button>
        </div>
      </div>

      <div className="glass rounded-[2rem] p-6 md:p-8 space-y-8 ring-1 ring-white/10 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <ProductSearchAdvanced 
              products={products}
              categories={categories} 
              initialCategory={selectedCategory}
              onResultsChange={handleSearchResults}
            />
          </div>
        </div>

        <div className="w-full">
          <div className="pb-4 border-b border-border/40">
            <div className="relative">
              <div className="flex items-center overflow-x-auto custom-scrollbar scroll-smooth pb-4">
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                  <TabsList className="bg-transparent h-auto p-0 flex gap-3 w-max">
                    <TabsTrigger 
                      value="all" 
                      className="group flex items-center gap-2.5 px-6 py-2.5 h-11 rounded-2xl border border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all text-sm font-bold bg-muted/30 hover:bg-muted/50"
                    >
                      <span>Все товары</span>
                      <Badge variant="secondary" className="px-2 py-0.5 h-5 min-w-[22px] justify-center text-[10px] font-black rounded-lg border-none bg-muted group-data-[state=active]:bg-white group-data-[state=active]:text-primary">
                        {categoryCounts.all}
                      </Badge>
                    </TabsTrigger>
                    
                    <div className="w-px h-6 bg-border/40 mx-2 self-center" />

                    {categories.map(cat => (
                      <TabsTrigger 
                        key={cat.id} 
                        value={cat.id} 
                        className="group flex items-center gap-2.5 px-6 py-2.5 h-11 rounded-2xl border border-transparent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 transition-all text-sm font-bold bg-muted/30 hover:bg-muted/50"
                      >
                        {cat.icon && <span className="text-lg leading-none transition-transform group-hover:scale-125">{cat.icon}</span>}
                        <span className="whitespace-nowrap">
                          {cat.name_ru || cat.name_en || cat.name}
                        </span>
                        <Badge variant="secondary" className="px-2 py-0.5 h-5 min-w-[22px] justify-center text-[10px] font-black rounded-lg border-none bg-muted group-data-[state=active]:bg-white group-data-[state=active]:text-primary transition-colors">
                          {categoryCounts[cat.id] || 0}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </div>

          <div className="pt-4 min-h-[400px]">
            {error && (
              <Alert variant="destructive" className="mb-6 rounded-2xl bg-destructive/10 border-destructive/20 text-destructive">
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <ProductGrid
              products={searchResults}
              categories={categories}
              loading={loading}
              onEdit={(p) => router.push(`/products/${p.id}`)}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
