"use client";

import { useEffect, useState } from "react";
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

// Перевод категорий на русский
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  "Dairy & Eggs": "Молочные продукты и яйца",
  "Meat & Poultry": "Мясо и птица",
  "Fish & Seafood": "Рыба и морепродукты",
  "Vegetables": "Овощи",
  "Fruits": "Фрукты",
  "Grains & Pasta": "Крупы и макароны",
  "Oils & Fats": "Масла и жиры",
  "Spices & Herbs": "Специи и травы",
  "Condiments & Sauces": "Приправы и соусы",
  "Beverages": "Напитки",
  "Nuts & Seeds": "Орехи и семена",
  "Legumes": "Бобовые",
  "Sweets & Baking": "Сладости и выпечка",
  "Canned & Preserved": "Консервы",
  "Frozen": "Замороженные продукты"
};

function translateCategory(englishName: string): string {
  return CATEGORY_TRANSLATIONS[englishName] || englishName;
}

// Перевод единиц измерения на русский
const UNIT_TRANSLATIONS: Record<string, string> = {
  "gram": "грамм",
  "kilogram": "килограмм",
  "liter": "литр",
  "milliliter": "миллилитр",
  "piece": "штука",
  "bunch": "пучок",
  "can": "банка",
  "bottle": "бутылка",
  "package": "упаковка"
};

function translateUnit(englishUnit: string): string {
  return UNIT_TRANSLATIONS[englishUnit] || englishUnit;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const router = useRouter();

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
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  // Get filtered products based on selected category and search
  function getFilteredProducts() {
    let filtered = products;

    // Apply category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(p => p.category_id === selectedCategory);
    }

    // Apply search filter (if search results exist, use them)
    if (searchResults.length > 0) {
      filtered = filtered.filter(p => searchResults.some(sr => sr.id === p.id));
    }

    return filtered;
  }

  // Get category name by ID
  function getCategoryName(categoryId: string) {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || "Unknown Category";
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

  const filteredProducts = getFilteredProducts();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Продукты</h1>
          <p className="text-muted-foreground mt-2">
            Управление каталогом продуктов
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/users">
            <Button variant="secondary" size="lg">
              <Users className="mr-2 h-5 w-5" />
              Пользователи
            </Button>
          </Link>
          <Link href="/products/new">
            <Button size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Добавить продукт
            </Button>
          </Link>
          <Button 
            variant="outline"
            size="lg"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-5 w-5" />
            Выйти
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search Component */}
      <div className="mb-6">
        <ProductSearchAdvanced 
          products={products}
          categories={categories}
          units={[...new Set(products.map(p => p.unit).filter(Boolean))]}
          onResultsChange={(results) => {
            setSearchResults(results);
          }}
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="all" className="flex-shrink-0">
            Все ({products.length})
          </TabsTrigger>
          {categories.map((category) => {
            const count = products.filter(p => p.category_id === category.id).length;
            return (
              <TabsTrigger 
                key={category.id} 
                value={category.id}
                className="flex-shrink-0"
              >
                {translateCategory(category.name)} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Products Grid */}
      {products.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Нет продуктов</h2>
            <p className="text-muted-foreground mb-6">
              Создайте первый продукт, чтобы начать!
            </p>
            <Link href="/products/new">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Создать первый продукт
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Нет продуктов в этой категории</h2>
            <p className="text-muted-foreground">
              Выберите другую категорию или добавьте новый продукт.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow duration-300 p-0">
              <div className="relative w-full aspect-square">
                {product.image_url ? (
                  <>
                    <img
                      src={product.image_url}
                      alt={product.name_ru || product.name_en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {/* Gradient overlay - убирается при hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent group-hover:opacity-0 transition-opacity duration-300" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <div className="text-center text-muted-foreground">
                      <Camera className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">Нет изображения</p>
                    </div>
                  </div>
                )}
                
                {/* Content overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  {/* Text content - скрывается при hover */}
                  <div className="transition-all duration-300 transform translate-y-0 group-hover:translate-y-full group-hover:opacity-0 mb-3">
                    <div className="bg-black/60 backdrop-blur-sm p-3 rounded-lg">
                      <h3 className="text-white font-bold text-lg line-clamp-2 mb-1">
                        {product.name_ru || product.name_en}
                      </h3>
                      <p className="text-white/80 text-sm mb-1">
                        Единица: {translateUnit(product.unit)}
                      </p>
                      {product.description && (
                        <p className="text-white/70 text-xs line-clamp-2">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Buttons - остаются полупрозрачными */}
                  <div className="flex gap-2 transition-all duration-300 group-hover:opacity-40">
                    <Link href={`/products/${product.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full group-hover:text-black transition-colors duration-300" size="sm">
                        Редактировать
                      </Button>
                    </Link>
                    <Button 
                      variant="destructive"
                      size="sm"
                      className="flex-1 group-hover:text-black transition-colors duration-300"
                      onClick={(e) => {
                      e.preventDefault();
                      setProductToDelete(product.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    Удалить
                  </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить продукт?</DialogTitle>
            <DialogDescription>
              Это действие нельзя отменить. Продукт будет удален безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setProductToDelete(null);
              }}
            >
              Отмена
            </Button>
            <Button 
              variant="destructive"
              onClick={() => productToDelete && handleDelete(productToDelete)}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
