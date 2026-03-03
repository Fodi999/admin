"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { getProduct, updateProduct, uploadProductImage, deleteProductImage, getCategories, type Product, type CreateProductRequest, type Category } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2, ArrowLeft, Upload, Trash2, Save, Globe } from "lucide-react";

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

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<CreateProductRequest>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProduct();
    loadCategories();
  }, []);

  async function loadCategories() {
    const token = getToken();
    if (!token) return;
    try {
      const data = await getCategories(token);
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  async function loadProduct() {
    const token = getToken();
    
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const data = await getProduct(resolvedParams.id, token);
      setProduct(data);
      setFormData({
        name_en: data.name_en,
        name_pl: data.name_pl || "",
        name_uk: data.name_uk || "",
        name_ru: data.name_ru || "",
        category_id: data.category_id,
        unit: data.unit,
        description: data.description || "",
        image_url: data.image_url || "",
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load product");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) {
      return;
    }

    console.log("📤 Starting image upload with compression...");
    console.log(`📦 Original file: ${file.name}, ${(file.size / 1024 / 1024).toFixed(2)} MB, ${file.type}`);

    const token = getToken();
    if (!token) {
      console.error("❌ No token found");
      router.push("/login");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Настройки компрессии
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      // Компрессия
      console.log("🎨 Compressing image...");
      const compressedFile = await imageCompression(file, options);
      console.log(`✅ Compressed: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

      // Загрузка
      const result = await uploadProductImage(token, resolvedParams.id, compressedFile);
      console.log("✅ Upload completed successfully:", result);
      
      const updatedUrl = result.image_url;
      setProduct(prev => prev ? { ...prev, image_url: updatedUrl } : null);
      setFormData(prev => ({ ...prev, image_url: updatedUrl }));
      setFile(null);
    } catch (err) {
      console.error("❌ Upload error:", err);
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage() {
    const token = getToken();
    if (!token) return;

    try {
      await deleteProductImage(token, resolvedParams.id);
      setProduct(prev => prev ? { ...prev, image_url: undefined } : null);
      setDeleteDialogOpen(false);
      setSuccessMessage("Изображение удалено успешно");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete image");
    }
  }

  async function handleSaveChanges() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const updatedProduct = await updateProduct(token, resolvedParams.id, formData);
      setProduct(updatedProduct);
      setEditMode(false);
      setSuccessMessage("Продукт успешно обновлен");
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Failed to update product");
      }
    } finally {
      setSaving(false);
    }
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

  if (!product) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Alert variant="destructive">
          <AlertDescription>Продукт не найден</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="container mx-auto p-6 max-w-7xl flex-1 flex flex-col">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={() => router.push("/products")}
          >
            Продукты
          </Button>
          <span>/</span>
          <span>Редактирование: {product.name_ru || product.name_en}</span>
        </div>

        {/* Header */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            {product.name_ru || product.name_en}
          </h1>
          <p className="text-muted-foreground text-sm">
            Редактирование информации о продукте
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="mb-4 border-green-500 text-green-700 bg-green-50">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
          {/* LEFT: Image Upload */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Изображение продукта</CardTitle>
              <CardDescription>
                Автоматическое сжатие до &lt;1МБ JPEG
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {product.image_url ? (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="relative flex-1 rounded-lg overflow-hidden border bg-muted">
                    <Image
                      src={product.image_url}
                      alt={product.name_ru || product.name_en}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        disabled={uploading}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleUpload}
                        disabled={uploading || !file}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Загрузка...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Заменить
                          </>
                        )}
                      </Button>
                    </div>
                    {file && (
                      <Alert>
                        <AlertDescription className="text-xs">
                          ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} МБ)
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button 
                      variant="destructive"
                      className="w-full"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Удалить изображение
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4">
                  <div className="flex-1 border-2 border-dashed rounded-lg flex items-center justify-center text-center">
                    <div>
                      <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">Изображение ещё не загружено</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={uploading}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUpload}
                      disabled={uploading || !file}
                      size="lg"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-5 w-5" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  </div>
                  {file && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} МБ)
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Product Details */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Детали продукта</CardTitle>
              <CardDescription>
                {editMode ? "Редактирование информации о продукте" : "Информация о продукте"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* English Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name_en" className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1 bg-blue-100 text-blue-700 rounded">EN</span>
                        English Name *
                      </Label>
                      <Input
                        id="name_en"
                        value={formData.name_en || ""}
                        onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                        disabled={saving}
                        placeholder="Product name in English"
                      />
                    </div>

                    {/* Polish Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name_pl" className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1 bg-red-100 text-red-700 rounded">PL</span>
                        Polski Name *
                      </Label>
                      <Input
                        id="name_pl"
                        value={formData.name_pl || ""}
                        onChange={(e) => setFormData({ ...formData, name_pl: e.target.value })}
                        disabled={saving}
                        placeholder="Nazwa po polsku"
                      />
                    </div>

                    {/* Ukrainian Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name_uk" className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1 bg-yellow-100 text-yellow-700 rounded">UK</span>
                        Українська назва *
                      </Label>
                      <Input
                        id="name_uk"
                        value={formData.name_uk || ""}
                        onChange={(e) => setFormData({ ...formData, name_uk: e.target.value })}
                        disabled={saving}
                        placeholder="Назва українською"
                      />
                    </div>

                    {/* Russian Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name_ru" className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1 bg-gray-100 text-gray-700 rounded">RU</span>
                        Русское название *
                      </Label>
                      <Input
                        id="name_ru"
                        value={formData.name_ru || ""}
                        onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                        disabled={saving}
                        placeholder="Название на русском"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-2">
                      <Label>Категория *</Label>
                      <Select
                        value={formData.category_id}
                        onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                        disabled={saving || categories.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите категорию" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name_ru || cat.name_en || cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Unit */}
                    <div className="space-y-2">
                      <Label>Единица измерения *</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData({ ...formData, unit: value })}
                        disabled={saving}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите ед. изм." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="кг">кг (Килограмм)</SelectItem>
                          <SelectItem value="л">л (Литр)</SelectItem>
                          <SelectItem value="шт">шт (Штука)</SelectItem>
                          <SelectItem value="уп">уп (Упаковка)</SelectItem>
                          <SelectItem value="г">г (Грамм)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">Описание</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ""}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      disabled={saving}
                      placeholder="Описание продукта"
                      rows={4}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* View Mode Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">ENGLISH</span>
                      <p className="font-medium">{product?.name_en}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">POLSKI</span>
                      <p className="font-medium">{product?.name_pl || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">УКРАЇНСЬКА</span>
                      <p className="font-medium">{product?.name_uk || "—"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">РУССКИЙ</span>
                      <p className="font-medium">{product?.name_ru || "—"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-b pb-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">КАТЕГОРИЯ</span>
                      <p className="font-medium">
                        {categories.find(c => c.id === product?.category_id)?.name_ru || product?.category_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block mb-1">ЕДИНИЦА</span>
                      <Badge variant="secondary" className="mt-1">
                        {product?.unit}
                      </Badge>
                    </div>
                  </div>

                  {product?.description && (
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">ОПИСАНИЕ</span>
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-[10px] text-muted-foreground uppercase">ID продукта:</span>
                    <p className="text-[10px] font-mono select-all">{product?.id}</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4 border-t">
              {editMode ? (
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditMode(false);
                      setError("");
                      setSuccessMessage("");
                      // Reset form
                      if (product) {
                        setFormData({
                          name_en: product.name_en,
                          name_pl: product.name_pl || "",
                          name_uk: product.name_uk || "",
                          name_ru: product.name_ru || "",
                          category_id: product.category_id,
                          unit: product.unit,
                          description: product.description || "",
                        });
                      }
                    }}
                    disabled={saving}
                  >
                    Отмена
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSaveChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Сохранить
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => router.push("/products")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Назад
                  </Button>
                  
                  <Button
                    className="flex-1"
                    onClick={() => setEditMode(true)}
                  >
                    Редактировать
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Delete Image Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить изображение?</DialogTitle>
            <DialogDescription>
              Изображение продукта будет удалено безвозвратно.
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
              onClick={handleDeleteImage}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
