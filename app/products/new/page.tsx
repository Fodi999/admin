"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProduct, type CreateProductRequest } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeft, Plus } from "lucide-react";

const PRODUCT_TYPES = [
  { value: "vegetable", label: "🥦 Овощи" },
  { value: "fruit", label: "🍎 Фрукты" },
  { value: "meat", label: "🥩 Мясо и птица" },
  { value: "seafood", label: "🐟 Рыба и морепродукты" },
  { value: "dairy", label: "🥛 Молочные и яйца" },
  { value: "grain", label: "🌾 Крупы и макароны" },
  { value: "legume", label: "🫘 Бобовые" },
  { value: "nut", label: "🌰 Орехи и семена" },
  { value: "spice", label: "🌿 Специи и травы" },
  { value: "oil", label: "🫙 Масла и жиры" },
  { value: "beverage", label: "🧃 Напитки" },
  { value: "condiment", label: "🧴 Соусы и приправы" },
  { value: "bakery", label: "🍞 Выпечка и сладости" },
  { value: "supplement", label: "💊 Добавки" },
] as const;

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [productType, setProductType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleCreate() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите название продукта");
      return;
    }
    if (!productType) {
      setError("Выберите тип продукта");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Отправляем только name_input + product_type
      // Бэкенд вызовет AI для перевода на 4 языка и классификации
      const data: CreateProductRequest = {
        name_input: trimmed,
        product_type: productType,
      };

      const product = await createProduct(token, data);
      setSuccess(true);

      // Redirect to edit page after short delay
      setTimeout(() => {
        router.push(`/products/${product.id}`);
      }, 800);
    } catch (e) {
      if (e instanceof Error && e.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else if (e instanceof Error && (e.message.includes("409") || e.message.includes("CONFLICT"))) {
        setError("Продукт с таким названием уже существует в каталоге");
      } else {
        setError(e instanceof Error ? e.message : "Ошибка создания продукта");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/products")}
        className="gap-1 mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к каталогу
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="h-5 w-5 text-primary" />
            Добавить продукт
          </CardTitle>
          <CardDescription>
            Введите название и выберите тип — продукт появится в каталоге.
            Остальные данные заполните через AI autofill в редактировании.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название продукта</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Например: свекла, beetroot, burak..."
              className="text-base py-5"
              autoFocus
              disabled={saving || success}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Поддерживается: English, Русский, Polski, Українська
            </p>
          </div>

          <div className="space-y-2">
            <Label>Тип продукта</Label>
            <Select
              value={productType}
              onValueChange={(v) => {
                setProductType(v);
                setError("");
              }}
              disabled={saving || success}
            >
              <SelectTrigger className="text-base py-5">
                <SelectValue placeholder="Выберите тип..." />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Продукт создан! Переход к редактированию...
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => router.push("/products")}
              disabled={saving}
            >
              Отмена
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !name.trim() || !productType || success}
              className="gap-2 flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Создаю...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Создать
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
