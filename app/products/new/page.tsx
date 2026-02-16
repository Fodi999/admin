"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createProduct, uploadProductImage, type CreateProductRequest, type Product } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Lightbulb, CheckCircle2, Upload, X } from "lucide-react";

export default function NewProductPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    name_input: "",
    description: "",
  });

  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    // Categories are no longer needed in simple mode
  }, []);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа (компрессия сама уменьшит размер)
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Поддерживаются только JPEG, PNG и WebP.");
      return;
    }

    setImageFile(file);
    setError("");

    // Создаем preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function uploadImage(token: string, productId: string, file: File): Promise<void> {
    try {
      // Настройки компрессии
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg'
      };

      // Компрессия
      console.log("🎨 Сжимаю изображение...");
      const compressedFile = await imageCompression(file, options);
      console.log(`✅ Сжато: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

      // Загружаем через правильный API endpoint
      console.log(`📤 Загружаю в продукт ${productId}...`);
      await uploadProductImage(token, productId, compressedFile);
      console.log("✅ Загрузка завершена");
    } catch (err) {
      console.error("❌ Ошибка загрузки:", err);
      throw err;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    // Validate required fields
    if (!formData.name_input?.trim()) {
      setError("Введите название продукта");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // 1️⃣ Создаем продукт БЕЗ изображения
      console.log("📝 Создаю продукт...");
      const product: Product = await createProduct(token, {
        name_input: formData.name_input,
        description: formData.description || "",
        // Не передаем image_url - загружаем после создания
      } as any);
      
      console.log("✅ Продукт создан:", product.id);

      // 2️⃣ Загружаем изображение если оно выбрано
      if (imageFile) {
        setUploading(true);
        console.log("🖼️ Загружаю изображение...");
        await uploadImage(token, product.id, imageFile);
        setUploading(false);
        console.log("✅ Изображение загружено");
      }
      
      setSuccessMessage("✓ Продукт успешно создан!");
      
      // Redirect after 1 second
      setTimeout(() => {
        router.push("/products");
      }, 1000);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else if (err instanceof Error && err.message.includes("409")) {
        setError("Продукт с таким названием уже существует. Проверьте название.");
      } else if (err instanceof Error && err.message.includes("CONFLICT")) {
        setError("Продукт с таким названием уже существует. Проверьте название.");
      } else if (err instanceof Error && err.message.includes("VALIDATION_ERROR")) {
        setError(`Ошибка валидации: Проверьте все обязательные поля.`);
      } else {
        setError(err instanceof Error ? err.message : "Ошибка при создании продукта");
      }
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => router.push("/products")}
        >
          Продукты
        </Button>
        <span>/</span>
        <span>Новый продукт</span>
      </div>

      <div className="mb-6">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Создать новый продукт</h1>
        <p className="text-muted-foreground">
          Добавьте новый продукт в каталог
        </p>
      </div>

      <Alert className="mb-6">
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <strong>💡 Совет:</strong> Введите название на любом языке. AI автоматически определит категорию, единицы и создаст переводы.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Информация о продукте</CardTitle>
            <CardDescription>
              Введите название и описание
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Universal Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name_input" className="flex items-center gap-2">
                Название продукта <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name_input"
                type="text"
                value={formData.name_input}
                onChange={(e) => setFormData({ ...formData, name_input: e.target.value })}
                required
                disabled={loading}
                placeholder="Например: Молоко, Помидоры, Fresh Milk"
              />
              <p className="text-xs text-muted-foreground">
                Можно ввести на любом языке (русский, английский, польский, украинский)
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание (необязательно)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={loading}
                placeholder="Дополнительная информация о продукте"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Image Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Фото продукта</CardTitle>
            <CardDescription>
              JPEG, PNG или WebP (автоматическое сжатие до 1MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imagePreview ? (
              <div className="space-y-3">
                <div className="relative w-full h-48 rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageChange}
                    disabled={loading || uploading}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {imageFile && (
                  <p className="text-xs text-muted-foreground">
                    ✓ {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Input
                  id="image"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageChange}
                  disabled={loading || uploading}
                  className="hidden"
                />
                <Label
                  htmlFor="image"
                  className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Нажмите чтобы загрузить фото или перетащите его сюда
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Поддерживаются JPEG, PNG, WebP (автоматическое сжатие)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/products")}
            disabled={loading || uploading}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={loading || uploading}
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загрузка фото...
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание...
              </>
            ) : (
              "Создать продукт"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
