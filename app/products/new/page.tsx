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
import { Loader2, AlertTriangle, CheckCircle2, ArrowLeft, Plus } from "lucide-react";

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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

    setSaving(true);
    setError("");

    try {
      // Отправляем name_input как name_en тоже + product_type
      // чтобы бэкенд НЕ вызывал AI при создании.
      // AI autofill доступен потом через редактирование.
      const data: CreateProductRequest = {
        name_input: trimmed,
        name_en: trimmed,
        name_pl: trimmed,
        name_ru: trimmed,
        name_uk: trimmed,
        product_type: "other",
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
            Введите название на любом языке — бэкенд автоматически переведёт и
            классифицирует. Остальные поля заполните через редактирование.
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
              disabled={saving || !name.trim() || success}
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
