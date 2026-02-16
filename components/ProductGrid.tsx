"use client";

import { useState } from "react";
import Image from "next/image";
import { type Product } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  emptyMessage?: string;
  variant?: "grid" | "table";
}

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

export default function ProductGrid({
  products,
  loading = false,
  onEdit,
  onDelete,
  emptyMessage = "Продукты не найдены",
  variant = "grid",
}: ProductGridProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (productToDelete) {
      onDelete?.(productToDelete.id);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-lg mb-2">{emptyMessage}</p>
        <p className="text-xs text-muted-foreground">Попробуйте изменить поисковый запрос</p>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Фото</th>
                  <th className="px-4 py-3 text-left font-medium">English</th>
                  <th className="px-4 py-3 text-left font-medium">Русский</th>
                  <th className="px-4 py-3 text-left font-medium">Категория</th>
                  <th className="px-4 py-3 text-left font-medium">Единица</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      {product.image_url ? (
                        <div className="relative w-10 h-10 rounded overflow-hidden">
                          <Image
                            src={product.image_url}
                            alt={product.name_en}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{product.name_en}</td>
                    <td className="px-4 py-3 text-muted-foreground">{product.name_ru || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {product.category_id}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.unit}</td>
                    <td className="px-4 py-3 flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit?.(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(product)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Удалить продукт?</DialogTitle>
              <DialogDescription>
                Удалить "{productToDelete?.name_en}"? Это действие невозможно отменить.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
              >
                Удалить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Grid variant
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              {/* Image */}
              {product.image_url ? (
                <div className="relative w-full h-40 bg-muted">
                  <Image
                    src={product.image_url}
                    alt={product.name_en}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* English name */}
                <div>
                  <h3 className="font-semibold text-base text-foreground">
                    {product.name_en}
                  </h3>
                  {product.name_ru && (
                    <p className="text-sm text-muted-foreground">
                      {product.name_ru}
                    </p>
                  )}
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {product.category_id}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {product.unit}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => onEdit?.(product)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Редактировать
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(product)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить продукт?</DialogTitle>
            <DialogDescription>
              Удалить "{productToDelete?.name_en}"? Это действие невозможно отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
