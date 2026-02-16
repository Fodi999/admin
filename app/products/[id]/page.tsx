"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { getProduct, updateProduct, uploadProductImage, deleteProductImage, type Product, type CreateProductRequest } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2, ArrowLeft, Upload, Trash2, Save } from "lucide-react";

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
  }, []);

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
        description: data.description || "",
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
      
      setProduct(prev => prev ? { ...prev, image_url: result.image_url } : null);
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
                    <img
                      src={product.image_url}
                      alt={product.name_ru || product.name_en}
                      className="w-full h-full object-cover"
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
                  {/* English Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name_en" className="text-sm font-medium">English Name *</Label>
                    <Input
                      id="name_en"
                      value={formData.name_en || ""}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      disabled={saving}
                      placeholder="Product name in English"
                    />
                    <p className="text-xs text-muted-foreground">
                      Оригинал: {product?.name_en}
                    </p>
                  </div>

                  {/* Polish Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name_pl" className="text-sm font-medium">
                      🇵🇱 Polski {formData.name_pl !== product?.name_pl && <span className="text-orange-600">• Изменено</span>}
                    </Label>
                    <Input
                      id="name_pl"
                      value={formData.name_pl || ""}
                      onChange={(e) => setFormData({ ...formData, name_pl: e.target.value })}
                      disabled={saving}
                      placeholder="Будет переведено автоматически"
                    />
                    <p className="text-xs text-muted-foreground">
                      Оригинал: {product?.name_pl}
                    </p>
                  </div>

                  {/* Ukrainian Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name_uk" className="text-sm font-medium">
                      🇺🇦 Українська {formData.name_uk !== product?.name_uk && <span className="text-orange-600">• Изменено</span>}
                    </Label>
                    <Input
                      id="name_uk"
                      value={formData.name_uk || ""}
                      onChange={(e) => setFormData({ ...formData, name_uk: e.target.value })}
                      disabled={saving}
                      placeholder="Будет переведено автоматически"
                    />
                    <p className="text-xs text-muted-foreground">
                      Оригинал: {product?.name_uk}
                    </p>
                  </div>

                  {/* Russian Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name_ru" className="text-sm font-medium">
                      🇷🇺 Русский {formData.name_ru !== product?.name_ru && <span className="text-orange-600">• Изменено</span>}
                    </Label>
                    <Input
                      id="name_ru"
                      value={formData.name_ru || ""}
                      onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                      disabled={saving}
                      placeholder="Будет переведено автоматически"
                    />
                    <p className="text-xs text-muted-foreground">
                      Оригинал: {product?.name_ru}
                    </p>
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
                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <span className="font-semibold">English:</span>
                    <span>{product?.name_en}</span>
                  </div>
                  
                  {product?.name_pl && (
                    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                      <span className="font-semibold">Polski:</span>
                      <span>{product.name_pl}</span>
                    </div>
                  )}
                  
                  {product?.name_uk && (
                    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                      <span className="font-semibold">Українська:</span>
                      <span>{product.name_uk}</span>
                    </div>
                  )}
                  
                  {product?.name_ru && (
                    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                      <span className="font-semibold">Русский:</span>
                      <span>{product.name_ru}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <span className="font-semibold">Единица:</span>
                    <Badge variant="secondary">{translateUnit(product?.unit || "")}</Badge>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <span className="font-semibold">ID категории:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">{product?.category_id}</code>
                  </div>

                  {product?.description && (
                    <div className="grid grid-cols-[120px_1fr] items-start gap-2">
                      <span className="font-semibold">Описание:</span>
                      <span className="text-muted-foreground">{product.description}</span>
                    </div>
                  )}
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
