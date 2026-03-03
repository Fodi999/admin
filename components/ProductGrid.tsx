"use client";

import { useState } from "react";
import Image from "next/image";
import { type Product, type Category } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  categories?: Category[];
  loading?: boolean;
  onEdit?: (product: Product) => void;
  onDelete?: (productId: string) => void;
  emptyMessage?: string;
  variant?: "grid" | "table";
}

export default function ProductGrid({
  products,
  categories = [],
  loading = false,
  onEdit,
  onDelete,
  emptyMessage = "Продукты не найдены",
  variant = "table", // Default to table for admin
}: ProductGridProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Get category name by ID
  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return "Без категории";
    return category.name_ru || category.name_en || category.name;
  };

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
      <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-[2.5rem] overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md shadow-2xl ring-1 ring-white/5">
          <div className="overflow-x-auto custom-scrollbar w-full">
            <Table className="w-full">
              <TableHeader className="bg-muted/10 border-b border-border/40">
                <TableRow className="hover:bg-transparent h-16 transition-none">
                  <TableHead className="w-[80px] px-6 text-center text-[11px] uppercase tracking-widest font-black text-muted-foreground/60">Фото</TableHead>
                  <TableHead className="min-w-[240px] px-6 text-[11px] uppercase tracking-widest font-black text-muted-foreground/60">Продукт</TableHead>
                  <TableHead className="w-[140px] px-6 text-[11px] uppercase tracking-widest font-black text-muted-foreground/60">Категория</TableHead>
                  <TableHead className="w-[100px] px-6 text-[11px] uppercase tracking-widest font-black text-muted-foreground/60 text-right">Цена</TableHead>
                  <TableHead className="w-[80px] px-6 text-[11px] uppercase tracking-widest font-black text-muted-foreground/60 text-center">Ед.</TableHead>
                  <TableHead className="w-[120px] px-6 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-primary/[0.03] transition-all group h-20 border-b border-border/20 last:border-0">
                    <TableCell className="px-6 py-4">
                      <div className="h-14 w-14 rounded-2xl overflow-hidden bg-muted/50 relative border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name_ru || product.name_en}
                            fill
                            className="object-cover"
                            sizes="56px"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full bg-primary/5">
                            <AlertCircle className="h-6 w-6 text-primary/20" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="font-bold text-[15px] tracking-tight text-foreground group-hover:text-primary transition-colors">
                          {product.name_ru || product.name_en}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0 h-4 border-muted-foreground/20 text-muted-foreground/80 rounded-[4px]">
                            {product.name_en}
                          </Badge>
                          {product.name_pl && (
                            <span className="text-[10px] text-muted-foreground/40 font-bold hidden md:inline">{product.name_pl}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="px-3 py-1.5 rounded-xl bg-secondary/30 text-secondary-foreground text-[12px] font-bold inline-flex items-center gap-1.5 border border-white/5">
                         {getCategoryName(product.category_id)}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="font-mono font-black text-[15px] text-primary">
                        {product.price ? `${product.price}` : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                       <div className="text-center">
                        <span className="text-[11px] font-black uppercase text-muted-foreground/70 bg-muted/40 px-2 py-1 rounded-lg">
                          {product.unit}
                        </span>
                       </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 rounded-xl shadow-lg hover:bg-primary hover:text-white transition-all hover:scale-110 active:scale-90"
                          onClick={() => onEdit?.(product)}
                        >
                          <Edit className="h-4.5 w-4.5" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-10 w-10 rounded-xl shadow-lg border-destructive/20 text-destructive hover:bg-destructive hover:text-white transition-all hover:scale-110 active:scale-90"
                          onClick={() => handleDeleteClick(product)}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Удалить продукт?</DialogTitle>
              <DialogDescription>
                Удалить "{productToDelete?.name_ru || productToDelete?.name_en}"? Это действие невозможно отменить.
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
      </div>
    );
  }

  // Grid variant
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden group hover:shadow-md transition-shadow">
            <div className="aspect-square relative bg-muted overflow-hidden">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name_ru || product.name_en}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, (max-width: 1920px) 20vw, 16vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <AlertCircle className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="absolute top-2 left-2 flex gap-1 transition-opacity">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] px-1.5 h-6">
                  {getCategoryName(product.category_id)}
                </Badge>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                  onClick={() => onEdit?.(product)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDeleteClick(product)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardContent className="p-4">
              <h3 className="font-semibold text-lg line-clamp-1">
                {product.name_ru || product.name_en}
              </h3>
              {product.name_uk && (
                <p className="text-xs text-muted-foreground line-clamp-1 italic">
                  UK: {product.name_uk}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xl font-bold">{product.price}</span>
                <span className="text-sm text-muted-foreground">{product.unit}</span>
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
              Удалить "{productToDelete?.name_ru || productToDelete?.name_en}"? Это действие невозможно отменить.
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
    </div>
  );
}
