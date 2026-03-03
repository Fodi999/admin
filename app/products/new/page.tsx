"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { createProduct, uploadProductImage, getCategories, type CreateProductRequest, type Product, type Category } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Loader2, AlertTriangle, Lightbulb, CheckCircle2, Upload, X, Globe } from "lucide-react";

export default function NewProductPage() {
  const [loading, setLoading] = useState(false);
  const [isAiMode, setIsAiMode] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const router = useRouter();

  const [formData, setFormData] = useState<CreateProductRequest>({
    name_en: "",
    name_pl: "",
    name_uk: "",
    name_ru: "",
    category_id: "",
    unit: "кг",
    description: "",
  });

  useEffect(() => {
    async function loadCategories() {
      const token = getToken();
      if (!token) return;
      try {
        const data = await getCategories(token);
        setCategories(data);
        if (data.length > 0 && !formData.category_id) {
          setFormData(prev => ({ ...prev, category_id: data[0].id }));
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    loadCategories();
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
    if (isAiMode) {
      if (!nameInput.trim()) {
        setError("Введите название продукта для AI");
        return;
      }
    } else {
      if (!formData.name_en?.trim() || !formData.name_pl?.trim() || !formData.name_uk?.trim() || !formData.name_ru?.trim()) {
        setError("Введите названия на всех 4 языках");
        return;
      }
      if (!formData.category_id) {
        setError("Выберите категорию");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      // 1️⃣ Создаем продукт БЕЗ изображения
      console.log(isAiMode ? "🪄 Создаю продукт через AI..." : "📝 Создаю продукт...");
      
      const requestData = isAiMode 
        ? { name_input: nameInput } 
        : formData;

      const product = await createProduct(token, requestData);
      
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
        {isAiMode ? (
          <Card className="border-primary/50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-75" />
                <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-150" />
              </div>
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Магическое AI-Создание
              </CardTitle>
              <CardDescription>
                Просто введите название продукта, и система сделает всё за вас
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai_name" className="text-sm font-medium">
                  Название продукта (Любой язык)
                </Label>
                <div className="relative">
                  <Input
                    id="ai_name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Например: Свежее молоко 3.2% 1л"
                    className="text-lg py-6 pr-10 border-2 border-primary/20 focus-visible:border-primary/50"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                    <CheckCircle2 className="h-5 w-5 opacity-50" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI автоматически переведет на 4 языка, выберет категорию "Молочные" и единицу "Литр"
                </p>
              </div>

              <div className="pt-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsAiMode(false)}
                  className="text-xs text-muted-foreground hover:text-primary p-0 h-auto"
                >
                  Хотите полного контроля? Переключитесь в режим ручного заполнения →
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex justify-between items-center">
                <span>Ручное заполнение</span>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsAiMode(true)}
                  className="gap-2 text-xs"
                >
                  <Globe className="h-3 w-3" /> Вернуться к AI
                </Button>
              </CardTitle>
              <CardDescription>
                Введите все названия и детали продукта вручную
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Multi-language Name Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name_en" className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1 bg-blue-100 text-blue-700 rounded">EN</span>
                    Название (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name_en"
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="Milk"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_pl" className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1 bg-red-100 text-red-700 rounded">PL</span>
                    Nazwa (Polski) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name_pl"
                    value={formData.name_pl}
                    onChange={(e) => setFormData({ ...formData, name_pl: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="Mleko"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_uk" className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1 bg-yellow-100 text-yellow-700 rounded">UK</span>
                    Назва (Українська) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name_uk"
                    value={formData.name_uk}
                    onChange={(e) => setFormData({ ...formData, name_uk: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="Молоко"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name_ru" className="flex items-center gap-2">
                    <span className="text-xs font-bold px-1 bg-gray-100 text-gray-700 rounded">RU</span>
                    Название (Русский) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name_ru"
                    value={formData.name_ru}
                    onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
                    required
                    disabled={loading}
                    placeholder="Молоко"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Категория <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    disabled={loading || categories.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name_ru || cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Unit */}
                <div className="space-y-2">
                  <Label htmlFor="unit">Единица измерения <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    disabled={loading}
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
                <Label htmlFor="description">Описание (необязательно)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={loading}
                  placeholder="Дополнительная информация о продукте"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

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
