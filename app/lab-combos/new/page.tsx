"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import {
  generateComboAllLocales,
  type GenerateComboRequest,
  type LabComboPage,
} from "@/lib/lab-combos-api";

import IngredientPicker, {
  type SelectedIngredient,
  getRole,
} from "@/components/ingredient-picker";

import {
  FlaskConical,
  Loader2,
  Sparkles,
  ArrowLeft,
  Check,
  ChefHat,
  Globe,
  Target,
  UtensilsCrossed,
  Timer,
  Wallet,
  MapPin,
  Bot,
  Flame,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────

const GOALS = [
  { value: "high_protein", label: "💪 High Protein", desc: "Высокобелковый рецепт" },
  { value: "low_carb", label: "🥦 Low Carb", desc: "Низкоуглеводный" },
  { value: "keto", label: "🥑 Keto", desc: "Кетогенная диета" },
  { value: "weight_loss", label: "⚖️ Weight Loss", desc: "Для похудения" },
  { value: "muscle_gain", label: "🏋️ Muscle Gain", desc: "Набор массы" },
  { value: "energy_boost", label: "⚡ Energy Boost", desc: "Энергия" },
  { value: "balanced", label: "🍽️ Balanced", desc: "Сбалансированный" },
];

const MEAL_TYPES = [
  { value: "breakfast", label: "🌅 Завтрак" },
  { value: "lunch", label: "☀️ Обед" },
  { value: "dinner", label: "🌙 Ужин" },
  { value: "snack", label: "🍿 Перекус" },
];

const DIETS = [
  { value: "vegetarian", label: "🥕 Вегетарианская" },
  { value: "vegan", label: "🌱 Веганская" },
  { value: "gluten_free", label: "🌾 Без глютена" },
];

const COOKING_TIMES = [
  { value: "quick", label: "⚡ Быстро (до 20 мин)" },
  { value: "medium", label: "⏱️ Средне (20-45 мин)" },
  { value: "long", label: "🍲 Долго (45+ мин)" },
];

const BUDGETS = [
  { value: "cheap", label: "💰 Бюджетный" },
  { value: "premium", label: "💎 Премиум" },
];

const CUISINES = [
  { value: "italian", label: "🇮🇹 Итальянская" },
  { value: "asian", label: "🥢 Азиатская" },
  { value: "mexican", label: "🌮 Мексиканская" },
];

const AI_MODELS = [
  { value: "flash", label: "⚡ Flash", desc: "Быстрый, для тестов" },
  { value: "pro", label: "🧠 Pro", desc: "Точные числа, лучшие SEO-тексты" },
];

// ── Step Indicator ───────────────────────────────────────────────────

const STEPS = ["Ингредиенты", "Параметры", "Генерация", "Готово"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                i < current
                  ? "bg-green-500 border-green-500 text-white"
                  : i === current
                  ? "bg-primary border-primary text-white"
                  : "bg-muted border-muted-foreground/30 text-muted-foreground"
              }`}
            >
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                i === current ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-1 mb-4 transition-all ${
                i < current ? "bg-green-500" : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Dish Structure Analysis ──────────────────────────────────────────

function DishAnalysis({ ingredients }: { ingredients: SelectedIngredient[] }) {
  // Group by role
  const groups: Record<string, SelectedIngredient[]> = {};
  for (const ing of ingredients) {
    const role = getRole(ing.product_type);
    if (!groups[role]) groups[role] = [];
    groups[role].push(ing);
  }

  const totalCal = ingredients.reduce(
    (acc, ing) => acc + (ing.calories_per_100g ?? 0) * (ing.grams / 100),
    0,
  );
  const totalPro = ingredients.reduce(
    (acc, ing) => acc + (ing.protein_per_100g ?? 0) * (ing.grams / 100),
    0,
  );
  const totalFat = ingredients.reduce(
    (acc, ing) => acc + (ing.fat_per_100g ?? 0) * (ing.grams / 100),
    0,
  );
  const totalCarb = ingredients.reduce(
    (acc, ing) => acc + (ing.carbs_per_100g ?? 0) * (ing.grams / 100),
    0,
  );

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          Структура блюда
        </CardTitle>
        <CardDescription className="text-xs">
          Автоматический анализ — роли ингредиентов и нутриенты из каталога
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Roles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(groups).map(([role, items]) => (
            <div key={role} className="p-2.5 rounded-lg border bg-background/50">
              <p className="text-xs font-semibold">{role}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {items.map((ing) => (
                  <Badge
                    key={ing.id}
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {ing.name_ru || ing.name_en} · {ing.grams}г
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Macros bar */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <p className="text-lg font-black text-orange-600">{Math.round(totalCal)}</p>
            <p className="text-[10px] text-muted-foreground uppercase">kcal</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10">
            <p className="text-lg font-black text-blue-600">{totalPro.toFixed(0)}г</p>
            <p className="text-[10px] text-muted-foreground uppercase">Белки</p>
          </div>
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <p className="text-lg font-black text-yellow-600">{totalFat.toFixed(0)}г</p>
            <p className="text-[10px] text-muted-foreground uppercase">Жиры</p>
          </div>
          <div className="p-2 rounded-lg bg-green-500/10">
            <p className="text-lg font-black text-green-600">{totalCarb.toFixed(0)}г</p>
            <p className="text-[10px] text-muted-foreground uppercase">Углеводы</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export default function NewLabComboPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  // Step control
  const [step, setStep] = useState(0);

  // Step 0: Ingredients (from catalog)
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);

  // Step 1: Parameters
  const [dishName, setDishName] = useState("");
  const [goal, setGoal] = useState("");
  const [mealType, setMealType] = useState("");
  const [diet, setDiet] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [budget, setBudget] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [model, setModel] = useState("pro");

  // Step 2: Generation
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Step 3: Result
  const [result, setResult] = useState<LabComboPage[]>([]);

  // Auth
  useEffect(() => {
    const t = getToken();
    if (!t) {
      router.push("/login");
      return;
    }
    setToken(t);
  }, [router]);

  // Slug list for backend
  const ingredientSlugs = selectedIngredients.map((i) => i.slug);

  // ── Step 0 → 1 ────────────────────────────────────────────────────

  function handleIngredientsNext() {
    if (selectedIngredients.length === 0) {
      setError("Добавьте хотя бы 1 ингредиент из каталога");
      return;
    }
    setError("");
    setStep(1);
  }

  // ── Step 1 → 2: Generate ──────────────────────────────────────────

  async function handleGenerate() {
    if (!token) return;
    setStep(2);
    setGenerating(true);
    setError("");

    try {
      const req: GenerateComboRequest = {
        ingredients: ingredientSlugs,
        locale: "en", // ignored — backend generates all 4
        ...(dishName && { dish_name: dishName }),
        ...(goal && { goal }),
        ...(mealType && { meal_type: mealType }),
        ...(diet && { diet }),
        ...(cookingTime && { cooking_time: cookingTime }),
        ...(budget && { budget }),
        ...(cuisine && { cuisine }),
        model,
      };

      const pages = await generateComboAllLocales(token, req);
      setResult(pages);
      setStep(3);
      toast.success(`Combo создан на ${pages.length} языках!`, {
        description: `${pages[0]?.slug}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStep(1);
    } finally {
      setGenerating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button
          variant="link"
          className="p-0 h-auto font-normal"
          onClick={() => router.push("/lab-combos")}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Lab Combos
        </Button>
        <span>/</span>
        <span>Новый рецепт</span>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FlaskConical className="h-7 w-7 text-primary" />
          Собрать блюдо
        </h1>
        <p className="text-muted-foreground mt-1">
          Выберите ингредиенты из каталога → система соберёт рецепт с реальными данными
        </p>
      </div>

      <StepBar current={step} />

      {/* ═══ STEP 0: Ingredient Picker ═════════════════════════════════ */}
      {step === 0 && token && (
        <div className="space-y-4">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ChefHat className="h-5 w-5 text-primary" />
                Какие ингредиенты?
              </CardTitle>
              <CardDescription>
                Ищите в каталоге по названию на любом языке — <strong>salmon</strong>, <strong>лосось</strong>, <strong>ryż</strong>.
                <br />
                Система подтянет калории, БЖУ и фото из базы данных.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IngredientPicker
                token={token}
                selected={selectedIngredients}
                onChange={setSelectedIngredients}
                maxItems={8}
              />
            </CardContent>
          </Card>

          {/* ── Dish structure analysis (appears when 2+ ingredients) ── */}
          {selectedIngredients.length >= 2 && (
            <DishAnalysis ingredients={selectedIngredients} />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleIngredientsNext}
              disabled={selectedIngredients.length === 0}
              size="lg"
              className="gap-2 px-8"
            >
              Далее — параметры
              <ChefHat className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 1: Parameters ════════════════════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Ingredients summary — structured */}
          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">
                    Блюдо из {selectedIngredients.length} ингредиентов
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                  Изменить
                </Button>
              </div>
              <div className="space-y-1">
                {selectedIngredients.map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2 text-sm">
                    {ing.image_url ? (
                      <img src={ing.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs">
                        {ing.product_type?.charAt(0)?.toUpperCase() || "?"}
                      </span>
                    )}
                    <span className="font-medium">{ing.name_ru || ing.name_en}</span>
                    <span className="text-muted-foreground">— {ing.grams}г</span>
                    {ing.calories_per_100g !== null && (
                      <span className="text-muted-foreground text-xs">
                        ({Math.round(ing.calories_per_100g * ing.grams / 100)} kcal)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Locale info */}
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Генерация на 4 языках автоматически</p>
                <div className="flex gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">EN</Badge>
                  <Badge variant="outline" className="text-[10px]">PL</Badge>
                  <Badge variant="outline" className="text-[10px]">RU</Badge>
                  <Badge variant="outline" className="text-[10px]">UK</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 🧠 Dish Name — PRIMARY LOGIC DRIVER */}
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ChefHat className="h-4 w-4 text-primary" />
                🧠 Название блюда
                <Badge variant="default" className="text-[10px] ml-auto">
                  Определяет способ приготовления
                </Badge>
              </CardTitle>
              <CardDescription>
                Название = логика приготовления. «Жареный рис» → wok/pan + high heat.
                «Боул с лососем» → сборка без готовки. «Запечённая курица» → духовка.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="text"
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder='Например: "Жареный рис с лососем в азиатском стиле"'
                className="w-full h-11 rounded-lg border bg-background px-4 text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[10px] text-muted-foreground mt-2 space-y-0.5">
                <span className="block">💡 <strong>Название определяет:</strong> технику приготовления, последовательность действий, стиль блюда</span>
                <span className="block">✅ Хорошо: «Жареный рис с лососем», «Средиземноморский салат с тунцом», «Овсянка с бананом и орехами»</span>
                <span className="block">❌ Плохо: пустое поле — AI не поймёт КАК готовить, только ИЗ ЧЕГО</span>
              </p>
            </CardContent>
          </Card>

          {/* Goal */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                Цель рецепта
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setGoal("")}
                  className={`p-3 rounded-lg border text-left text-sm transition-all ${
                    !goal
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "hover:border-primary/40"
                  }`}
                >
                  <span className="font-medium">🎲 Любая</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Без цели</p>
                </button>
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoal(goal === g.value ? "" : g.value)}
                    className={`p-3 rounded-lg border text-left text-sm transition-all ${
                      goal === g.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "hover:border-primary/40"
                    }`}
                  >
                    <span className="font-medium">{g.label}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{g.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Meal Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                Приём пищи
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  onClick={() => setMealType("")}
                  className={`p-3 rounded-lg border text-center text-sm transition-all ${
                    !mealType
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "hover:border-primary/40"
                  }`}
                >
                  Любой
                </button>
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMealType(mealType === m.value ? "" : m.value)}
                    className={`p-3 rounded-lg border text-center text-sm transition-all ${
                      mealType === m.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "hover:border-primary/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Diet, Time, Budget, Cuisine — compact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  Диета
                </Label>
                <Select value={diet || "__none__"} onValueChange={(v) => setDiet(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Без ограничений" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без ограничений</SelectItem>
                    {DIETS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Timer className="h-3.5 w-3.5" />
                  Время готовки
                </Label>
                <Select value={cookingTime || "__none__"} onValueChange={(v) => setCookingTime(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Любое" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любое</SelectItem>
                    {COOKING_TIMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Wallet className="h-3.5 w-3.5" />
                  Бюджет
                </Label>
                <Select value={budget || "__none__"} onValueChange={(v) => setBudget(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Любой" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любой</SelectItem>
                    {BUDGETS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5" />
                  Кухня
                </Label>
                <Select value={cuisine || "__none__"} onValueChange={(v) => setCuisine(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Любая" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Любая</SelectItem>
                    {CUISINES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* AI Model */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                AI Модель
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {AI_MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setModel(m.value)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      model === m.value
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "hover:border-primary/40"
                    }`}
                  >
                    <span className="font-bold text-sm">{m.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(0)} size="lg">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <Button onClick={handleGenerate} size="lg" className="gap-2 px-8">
              <Sparkles className="h-4 w-4" />
              Собрать рецепт ×4 языка
            </Button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Generating ════════════════════════════════════════ */}
      {step === 2 && (
        <Card className="border-primary/20">
          <CardContent className="py-20 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-semibold">AI собирает рецепт…</p>
            <p className="text-sm text-muted-foreground mt-2">
              Ингредиенты из каталога → AI генерирует только текст (шаги, название, описание)
            </p>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              {selectedIngredients.map((ing) => (
                <Badge key={ing.id} variant="secondary" className="gap-1">
                  {ing.image_url && (
                    <img src={ing.image_url} alt="" className="w-4 h-4 rounded object-cover" />
                  )}
                  {ing.name_en} · {ing.grams}г
                </Badge>
              ))}
            </div>
            {goal && <Badge className="mt-2">🎯 {goal.replace(/_/g, " ")}</Badge>}
            {mealType && <Badge className="mt-2 ml-1">🍽️ {mealType}</Badge>}
            {dishName && (
              <p className="text-sm font-semibold text-primary mt-3">
                🧠 «{dishName}»
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-6">
              Обычно 15-30 секунд на модели Pro
            </p>
          </CardContent>
        </Card>
      )}

      {/* ═══ STEP 3: Result ════════════════════════════════════════════ */}
      {step === 3 && result.length > 0 && (
        <div className="space-y-4">
          {/* Success banner */}
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white mb-3">
                <Check className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold">Рецепт собран!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Сгенерировано {result.length} страниц(ы) — данные из каталога, текст от AI
              </p>
              <p className="font-mono text-xs mt-2 text-primary">/{result[0].slug}</p>
            </CardContent>
          </Card>

          {/* Ingredient recap (real data) */}
          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                📊 Нутриенты из каталога (на 1 порцию)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {selectedIngredients.map((ing) => {
                  const cal = ing.calories_per_100g
                    ? Math.round(ing.calories_per_100g * ing.grams / 100)
                    : null;
                  const pro = ing.protein_per_100g
                    ? (ing.protein_per_100g * ing.grams / 100).toFixed(1)
                    : null;
                  return (
                    <div key={ing.id} className="flex items-center gap-2 text-sm">
                      {ing.image_url ? (
                        <img src={ing.image_url} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <span className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs">
                          {ing.product_type?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      )}
                      <span className="font-medium flex-1">
                        {ing.name_ru || ing.name_en}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {ing.grams}г
                      </span>
                      {cal !== null && (
                        <span className="text-orange-600 font-mono text-xs">{cal} kcal</span>
                      )}
                      {pro !== null && (
                        <span className="text-blue-600 font-mono text-xs">Б {pro}г</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Generated pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.map((page) => (
              <Card
                key={page.id}
                className="hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/lab-combos/${page.id}`)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs font-bold">
                      {page.locale.toUpperCase()}
                    </Badge>
                    <Badge className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                      {page.status}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Score: {page.quality_score}/5
                    </Badge>
                  </div>
                  <p className="font-semibold text-sm">{page.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{page.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {page.ingredients.map((ing) => (
                      <span
                        key={ing}
                        className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => router.push("/lab-combos")} size="lg">
              <ArrowLeft className="h-4 w-4 mr-1" />
              К списку
            </Button>
            <Button
              onClick={() => {
                setStep(0);
                setSelectedIngredients([]);
                setGoal("");
                setMealType("");
                setDiet("");
                setCookingTime("");
                setBudget("");
                setCuisine("");
                setModel("pro");
                setResult([]);
                setError("");
              }}
              size="lg"
              className="gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              Собрать ещё
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
