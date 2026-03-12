'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';
import {
  getProduct,
  updateProduct,
  uploadProductImage,
  getCategories,
  nutritionGetProduct,
  nutritionUpdateMacros,
  nutritionUpdateVitamins,
  nutritionUpdateMinerals,
  nutritionUpdateAllergens,
  nutritionUpdateFattyAcids,
  nutritionUpdateDietFlags,
  nutritionUpdateCulinary,
  nutritionUpdateBasic,
  nutritionUpdateFoodProperties,
  aiAutofillProduct,
  aiGenerateSeo,
  getPairings,
  addPairing,
  deletePairing,
  aiGeneratePairings,
  searchProducts,
  type Product,
  type Category,
  type UpdateProductRequest,
  type NutritionProductDetail,
  type MacrosDto,
  type VitaminsDto,
  type MineralsDto,
  type AllergensDto,
  type FattyAcidsDto,
  type DietFlagsDto,
  type CulinaryDto,
  type FoodPropertiesDto,
  type NutritionBasicRequest,
  type PairingsResponse,
  type PairingItem,
  type SearchProductResult,
} from '@/lib/admin-api';
import { getToken, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Loader2, ArrowLeft, Save, Sparkles, Search, Globe, X, Plus } from 'lucide-react';

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter', 'AllYear'];
const SEASON_MONTHS: Record<string, number[]> = {
  Spring: [2, 3, 4], Summer: [5, 6, 7], Autumn: [8, 9, 10], Winter: [11, 0, 1], AllYear: [],
};

const ALLERGENS = [
  'Milk', 'Eggs', 'Fish', 'Shellfish', 'TreeNuts', 'Peanuts',
  'Wheat', 'Soybeans', 'Sesame', 'Celery', 'Mustard', 'Sulfites', 'Lupin', 'Molluscs',
];

// Mapping between old string-array allergens and new AllergensDto keys
const ALLERGEN_KEY_MAP: Record<string, keyof AllergensDto> = {
  Milk: 'milk', Eggs: 'eggs', Fish: 'fish', Shellfish: 'shellfish',
  TreeNuts: 'nuts', Peanuts: 'peanuts', Wheat: 'gluten', Soybeans: 'soy',
  Sesame: 'sesame', Celery: 'celery', Mustard: 'mustard', Sulfites: 'sulfites',
  Lupin: 'lupin', Molluscs: 'molluscs',
};

const UNITS = [
  'gram', 'kilogram', 'liter', 'milliliter',
  'piece', 'bunch', 'can', 'bottle', 'package',
];

const SEASON_ICONS: Record<string, string> = {
  Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄️', AllYear: '🔄',
};

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

type Tab = 'basic' | 'nutrition' | 'allergens' | 'culinary' | 'seasonality' | 'vitamins' | 'foodprops' | 'seo' | 'pairing';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'basic', label: 'Основное', icon: '📦' },
  { id: 'nutrition', label: 'Нутриенты', icon: '🥗' },
  { id: 'vitamins', label: 'Витамины', icon: '💊' },
  { id: 'allergens', label: 'Аллергены', icon: '⚠️' },
  { id: 'culinary', label: 'Кулинария', icon: '👨‍🍳' },
  { id: 'foodprops', label: 'Свойства', icon: '�' },
  { id: 'seasonality', label: 'Сезонность', icon: '�' },
  { id: 'seo', label: 'SEO', icon: '🔍' },
  { id: 'pairing', label: 'Pairing', icon: '🧬' },
];

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [nutrition, setNutrition] = useState<NutritionProductDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<UpdateProductRequest>({});
  const [macros, setMacros] = useState<MacrosDto>({});
  const [vitamins, setVitamins] = useState<VitaminsDto>({});
  const [minerals, setMinerals] = useState<MineralsDto>({});
  const [allergens, setAllergens] = useState<AllergensDto>({});
  const [fattyAcids, setFattyAcids] = useState<FattyAcidsDto>({});
  const [dietFlags, setDietFlags] = useState<DietFlagsDto>({});
  const [culinary, setCulinary] = useState<CulinaryDto>({});
  const [foodProps, setFoodProps] = useState<FoodPropertiesDto>({});
  const [nutritionBasic, setNutritionBasic] = useState<NutritionBasicRequest>({});
  const [seo, setSeo] = useState({
    seo_title: '',
    seo_description: '',
    seo_h1: '',
    canonical_url: '',
    og_title: '',
    og_description: '',
    og_image: '',
  });
  const [seoLoading, setSeoLoading] = useState(false);
  // Pairing state
  const [pairings, setPairings] = useState<PairingsResponse | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingSearch, setPairingSearch] = useState('');
  const [pairingSearchResults, setPairingSearchResults] = useState<SearchProductResult[]>([]);
  const [pairingSearching, setPairingSearching] = useState(false);
  const [addPairingType, setAddPairingType] = useState<string>('primary');
  const [addPairingStrength, setAddPairingStrength] = useState<number>(8);
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    Promise.all([getProduct(token, id), getCategories(token), nutritionGetProduct(token, id).catch(() => null)])
      .then(([p, cats, nutr]) => {
        setProduct(p);
        setCategories(cats);
        resetForm(p);
        if (nutr) {
          setNutrition(nutr);
          resetNutritionForms(nutr);
        }
        // Load pairings in parallel (non-blocking)
        getPairings(token, id).then(setPairings).catch(() => {});
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          clearToken(); router.push('/login');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  function resetForm(p: Product) {
    setForm({
      name_en: p.name_en,
      name_ru: p.name_ru ?? '',
      name_pl: p.name_pl ?? '',
      name_uk: p.name_uk ?? '',
      category_id: p.category_id,
      unit: p.unit,
      description_en: p.description_en ?? '',
      description_ru: p.description_ru ?? '',
      description_pl: p.description_pl ?? '',
      description_uk: p.description_uk ?? '',
    });
    // Reset SEO state from product
    setSeo({
      seo_title: p.seo_title ?? '',
      seo_description: p.seo_description ?? '',
      seo_h1: p.seo_h1 ?? '',
      canonical_url: p.canonical_url ?? '',
      og_title: p.og_title ?? '',
      og_description: p.og_description ?? '',
      og_image: p.og_image ?? '',
    });
  }

  function resetNutritionForms(n: NutritionProductDetail) {
    setMacros(n.macros ?? {});
    setVitamins(n.vitamins ?? {});
    setMinerals(n.minerals ?? {});
    setAllergens(n.allergens ?? {});
    setFattyAcids(n.fatty_acids ?? {});
    setDietFlags(n.diet_flags ?? {});
    setCulinary(n.culinary ?? {});
    setFoodProps(n.food_properties ?? {});
    setNutritionBasic({
      product_type: n.product_type ?? undefined,
      density_g_per_ml: n.density_g_per_ml ?? undefined,
      typical_portion_g: n.typical_portion_g ?? undefined,
      edible_yield_percent: n.edible_yield_percent ?? undefined,
      shelf_life_days: n.shelf_life_days ?? undefined,
      wild_farmed: n.wild_farmed ?? undefined,
      water_type: n.water_type ?? undefined,
      sushi_grade: n.sushi_grade ?? undefined,
      availability_months: n.availability_months ?? undefined,
    });
  }

  function set<K extends keyof UpdateProductRequest>(key: K, value: UpdateProductRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSeason(season: string) {
    const months = SEASON_MONTHS[season];
    const current = nutritionBasic.availability_months ?? Array(12).fill(false);
    let next: boolean[];
    if (season === 'AllYear') {
      const allOn = current.every(Boolean);
      next = Array(12).fill(!allOn);
    } else {
      next = [...current];
      const allActive = months.every((m) => current[m]);
      months.forEach((m) => { next[m] = !allActive; });
    }
    setNutritionBasic((prev) => ({ ...prev, availability_months: next }));
  }

  function toggleAllergen(name: string) {
    const key = ALLERGEN_KEY_MAP[name];
    if (!key) return;
    setAllergens((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSaveBasic() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      const updated = await updateProduct(token, id, form);
      setProduct(updated);
      resetForm(updated);
      setMessage({ type: 'ok', text: '✅ Основные данные сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveWithAutoTranslate() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      const updated = await updateProduct(token, id, { ...form, auto_translate: true });
      setProduct(updated);
      resetForm(updated);
      setMessage({ type: 'ok', text: '✅ Сохранено + автоперевод применён!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveMacros() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await nutritionUpdateMacros(token, id, macros);
      setMessage({ type: 'ok', text: '✅ Нутриенты сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveAllergens() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await Promise.all([
        nutritionUpdateAllergens(token, id, allergens),
        nutritionUpdateDietFlags(token, id, dietFlags),
      ]);
      setMessage({ type: 'ok', text: '✅ Аллергены и диет-флаги сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveCulinary() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await Promise.all([
        nutritionUpdateCulinary(token, id, culinary),
        nutritionUpdateBasic(token, id, nutritionBasic),
      ]);
      setMessage({ type: 'ok', text: '✅ Кулинарные данные сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveSeasonality() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await nutritionUpdateBasic(token, id, { availability_months: nutritionBasic.availability_months });
      setMessage({ type: 'ok', text: '✅ Сезонность сохранена!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveVitamins() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await Promise.all([
        nutritionUpdateVitamins(token, id, vitamins),
        nutritionUpdateMinerals(token, id, minerals),
        nutritionUpdateFattyAcids(token, id, fattyAcids),
      ]);
      setMessage({ type: 'ok', text: '✅ Витамины и минералы сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveFoodProps() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      await nutritionUpdateFoodProperties(token, id, foodProps);
      setMessage({ type: 'ok', text: '✅ Физические свойства сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleSaveSeo() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      // Save SEO fields via updateProduct
      const seoData: Record<string, string | undefined> = {};
      if (seo.seo_title) seoData.seo_title = seo.seo_title;
      if (seo.seo_description) seoData.seo_description = seo.seo_description;
      if (seo.seo_h1) seoData.seo_h1 = seo.seo_h1;
      if (seo.canonical_url) seoData.canonical_url = seo.canonical_url;
      if (seo.og_title) seoData.og_title = seo.og_title;
      if (seo.og_description) seoData.og_description = seo.og_description;
      if (seo.og_image) seoData.og_image = seo.og_image;
      const updated = await updateProduct(token, id, seoData as UpdateProductRequest);
      setProduct(updated);
      setMessage({ type: 'ok', text: '✅ SEO данные сохранены!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleGenerateSeo() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSeoLoading(true); setMessage(null);
    try {
      const ai = await aiGenerateSeo(token, id);
      setSeo((prev) => ({
        ...prev,
        seo_title: ai.seo_title || prev.seo_title,
        seo_description: ai.seo_description || prev.seo_description,
        seo_h1: ai.seo_h1 || prev.seo_h1,
        canonical_url: ai.canonical_url || prev.canonical_url,
        og_title: ai.og_title || prev.og_title,
        og_description: ai.og_description || prev.og_description,
      }));
      setMessage({ type: 'ok', text: '🤖 AI сгенерировал SEO — проверьте и нажмите Сохранить!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ AI SEO: ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSeoLoading(false); }
  }

  // ── Pairing handlers ────────────────────────────────────────────
  async function handleLoadPairings() {
    const token = getToken();
    if (!token) return;
    const data = await getPairings(token, id).catch(() => null);
    if (data) setPairings(data);
  }

  async function handleAddPairing(pairedId: string) {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setSaving(true); setMessage(null);
    try {
      const updated = await addPairing(token, id, pairedId, addPairingType, addPairingStrength);
      setPairings(updated);
      setPairingSearch('');
      setPairingSearchResults([]);
      setMessage({ type: 'ok', text: '✅ Pairing добавлен!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setSaving(false); }
  }

  async function handleDeletePairing(pairingId: string) {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      await deletePairing(token, id, pairingId);
      await handleLoadPairings();
      setMessage({ type: 'ok', text: '✅ Pairing удалён!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка'}` });
    }
  }

  async function handleAiPairings() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setPairingLoading(true); setMessage(null);
    try {
      const result = await aiGeneratePairings(token, id);
      setPairings(result.pairings);
      const msg = result.not_found_in_catalog.length > 0
        ? `🤖 AI добавил ${result.inserted} pairings! Не найдены: ${result.not_found_in_catalog.join(', ')}`
        : `🤖 AI добавил ${result.inserted} pairings!`;
      setMessage({ type: 'ok', text: msg });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ AI: ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setPairingLoading(false); }
  }

  // Debounced ingredient search for pairing
  useEffect(() => {
    if (pairingSearch.length < 2) { setPairingSearchResults([]); return; }
    const token = getToken();
    if (!token) return;
    setPairingSearching(true);
    const timeout = setTimeout(() => {
      searchProducts(token, pairingSearch)
        .then((results) => setPairingSearchResults(results.filter((r) => r.id !== id)))
        .catch(() => setPairingSearchResults([]))
        .finally(() => setPairingSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [pairingSearch, id]);

  // ── AI Autofill ──────────────────────────────────────────────────
  async function handleAiAutofill() {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    setAiLoading(true); setMessage(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ai: any = await aiAutofillProduct(token, id);

      // ── Fill basic form (descriptions) ──
      setForm((prev) => ({
        ...prev,
        description_en: ai.description_en ?? prev.description_en,
        description_ru: ai.description_ru ?? prev.description_ru,
        description_pl: ai.description_pl ?? prev.description_pl,
        description_uk: ai.description_uk ?? prev.description_uk,
      }));

      // ── Macros ──
      if (ai.macros) {
        setMacros((prev) => ({
          ...prev,
          calories_kcal: ai.macros.calories_kcal ?? prev.calories_kcal,
          protein_g: ai.macros.protein_g ?? prev.protein_g,
          fat_g: ai.macros.fat_g ?? prev.fat_g,
          carbs_g: ai.macros.carbs_g ?? prev.carbs_g,
          fiber_g: ai.macros.fiber_g ?? prev.fiber_g,
          sugar_g: ai.macros.sugar_g ?? prev.sugar_g,
          starch_g: ai.macros.starch_g ?? prev.starch_g,
          water_g: ai.macros.water_g ?? prev.water_g,
        }));
      }

      // ── Vitamins ──
      if (ai.vitamins) {
        setVitamins((prev) => ({ ...prev, ...filterNulls(ai.vitamins) }));
      }

      // ── Minerals ──
      if (ai.minerals) {
        setMinerals((prev) => ({ ...prev, ...filterNulls(ai.minerals) }));
      }

      // ── Fatty acids ──
      if (ai.fatty_acids) {
        setFattyAcids((prev) => ({ ...prev, ...filterNulls(ai.fatty_acids) }));
      }

      // ── Allergens ──
      if (ai.allergens) {
        setAllergens((prev) => ({ ...prev, ...ai.allergens }));
      }

      // ── Diet flags ──
      if (ai.diet_flags) {
        setDietFlags((prev) => ({ ...prev, ...ai.diet_flags }));
      }

      // ── Culinary ──
      if (ai.culinary) {
        setCulinary((prev) => ({ ...prev, ...filterNulls(ai.culinary) }));
      }

      // ── Food properties ──
      if (ai.food_properties) {
        setFoodProps((prev) => ({ ...prev, ...filterNulls(ai.food_properties) }));
      }

      // ── Nutrition basic (product_type, shelf_life, density, etc.) ──
      setNutritionBasic((prev) => ({
        ...prev,
        product_type: ai.product_type ?? prev.product_type,
        shelf_life_days: ai.shelf_life_days ?? prev.shelf_life_days,
        density_g_per_ml: ai.density_g_per_ml ?? prev.density_g_per_ml,
        typical_portion_g: ai.typical_portion_g ?? prev.typical_portion_g,
      }));

      // ── Seasons → availability_months ──
      if (ai.seasons && Array.isArray(ai.seasons)) {
        const months = Array(12).fill(false);
        for (const s of ai.seasons) {
          if (s === 'AllYear') { months.fill(true); break; }
          const idxs = SEASON_MONTHS[s];
          if (idxs) idxs.forEach((m: number) => { months[m] = true; });
        }
        setNutritionBasic((prev) => ({ ...prev, availability_months: months }));
      }

      setMessage({ type: 'ok', text: '🤖 AI заполнил пустые поля — проверьте и нажмите Сохранить!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ AI: ${err instanceof Error ? err.message : 'Ошибка'}` });
    } finally { setAiLoading(false); }
  }

  /** Filter out null values from an object (keep only real AI suggestions) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function filterNulls(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && v !== undefined) out[k] = v;
    }
    return out;
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    if (!token) { router.push('/login'); return; }

    setUploading(true);
    setMessage(null);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/jpeg',
      });
      const imageUrl = await uploadProductImage(token, id, compressed as File);
      setProduct((prev) => prev ? { ...prev, image_url: imageUrl } : prev);
      setMessage({ type: 'ok', text: '✅ Фото загружено!' });
    } catch (err) {
      setMessage({ type: 'err', text: `❌ ${err instanceof Error ? err.message : 'Ошибка загрузки'}` });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка продукта...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>Продукт не найден</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── Helpers for save button per tab ──────────────────────────────────────
  const saveHandlers: Record<Tab, () => void> = {
    basic: handleSaveBasic,
    nutrition: handleSaveMacros,
    allergens: handleSaveAllergens,
    culinary: handleSaveCulinary,
    seasonality: handleSaveSeasonality,
    vitamins: handleSaveVitamins,
    foodprops: handleSaveFoodProps,
    seo: handleSaveSeo,
    pairing: handleLoadPairings,
  };

  const availMonths = nutritionBasic.availability_months ?? Array(12).fill(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')} className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">
            {product.name_ru || product.name_uk || product.name_pl || product.name_en}
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {product.name_en && product.name_en !== (product.name_ru || product.name_uk || product.name_pl) && (
              <span className="text-xs text-muted-foreground">{product.name_en}</span>
            )}
            {product.slug && (
              <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/40 px-1.5 py-0.5 rounded">
                {product.slug}
              </span>
            )}
            {nutrition?.product_type && (
              <Badge variant="outline" className="text-[10px] h-5">{nutrition.product_type}</Badge>
            )}
          </div>
        </div>
        {/* AI Autofill button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleAiAutofill}
          disabled={aiLoading || saving}
          className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 border-violet-200 text-violet-700 dark:from-violet-950/30 dark:to-purple-950/30 dark:text-violet-300 dark:border-violet-800 shrink-0"
        >
          {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
          {aiLoading ? 'AI думает...' : '🤖 AI Заполнить'}
        </Button>
        {/* Product image thumbnail in header */}
        {product.image_url && (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden ring-1 ring-border/30 shrink-0">
            <Image src={product.image_url} alt={product.name_en} fill className="object-cover" sizes="48px" />
          </div>
        )}
      </div>

      {message && (
        <Alert
          variant={message.type === 'err' ? 'destructive' : 'default'}
          className={message.type === 'ok' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20' : ''}
        >
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Nutrition not found banner */}
      {!nutrition && activeTab !== 'basic' && (
        <Alert className="border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <AlertDescription className="text-sm">
            ℹ️ Nutrition-данные для этого продукта ещё не созданы на сервере. Заполните любое поле и нажмите «Сохранить» — запись создастся автоматически.
          </AlertDescription>
        </Alert>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setMessage(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB: BASIC ──────────────────────────────────────────────── */}
      {activeTab === 'basic' && (
        <div className="space-y-5">
          {/* Photo */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📷 Фото</h2>
            <div className="flex items-start gap-6">
              {product.image_url ? (
                <div className="relative w-32 h-32 rounded-xl overflow-hidden ring-1 ring-border/30 shrink-0">
                  <Image src={product.image_url} alt={product.name_ru || product.name_en} fill className="object-cover" sizes="128px" />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Camera className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">Автоматическое сжатие до 1 МБ JPEG.</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="flex-1 rounded-xl" />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </label>
                {uploading && <p className="text-xs text-muted-foreground animate-pulse">Сжатие и загрузка...</p>}
              </div>
            </div>
          </section>

          {/* Names */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🌍 Названия</h2>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['name_en', 'EN', 'bg-blue-100 text-blue-700'],
                  ['name_ru', 'RU', 'bg-gray-100 text-gray-700'],
                  ['name_pl', 'PL', 'bg-red-100 text-red-700'],
                  ['name_uk', 'UK', 'bg-yellow-100 text-yellow-700'],
                ] as const
              ).map(([key, lang, cls]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{lang}</span>
                  </Label>
                  <Input
                    value={(form[key] as string) ?? ''}
                    onChange={(e) => set(key, e.target.value)}
                    className="rounded-xl"
                    placeholder={`Название (${lang})`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Category + Unit */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚙️ Параметры</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Категория</Label>
                <Select value={form.category_id} onValueChange={(v) => set('category_id', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Выберите категорию" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name_ru || c.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Единица измерения</Label>
                <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Единица" /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Descriptions */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">📝 Описания</h2>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  ['description_en', 'EN', 'bg-blue-100 text-blue-700'],
                  ['description_ru', 'RU', 'bg-gray-100 text-gray-700'],
                  ['description_pl', 'PL', 'bg-red-100 text-red-700'],
                  ['description_uk', 'UK', 'bg-yellow-100 text-yellow-700'],
                ] as const
              ).map(([key, lang, cls]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{lang}</span>
                  </Label>
                  <Textarea
                    rows={3}
                    value={(form[key] as string) ?? ''}
                    onChange={(e) => set(key, e.target.value)}
                    className="rounded-xl resize-none"
                    placeholder={`Описание (${lang})`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveBasic} disabled={saving || uploading} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить</>}
            </Button>
            <Button variant="outline" onClick={handleSaveWithAutoTranslate} disabled={saving || uploading} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Сохранить + AI перевод
            </Button>
            <Button variant="ghost" onClick={() => product && resetForm(product)} disabled={saving} className="h-11 rounded-xl">
              Сбросить
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: NUTRITION ──────────────────────────────────────────── */}
      {activeTab === 'nutrition' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🔥 Макронутриенты (на 100г)</h2>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['calories_kcal', 'Калории, ккал'],
                  ['protein_g', 'Белки, г'],
                  ['fat_g', 'Жиры, г'],
                  ['carbs_g', 'Углеводы, г'],
                  ['fiber_g', 'Клетчатка, г'],
                  ['sugar_g', 'Сахар, г'],
                  ['starch_g', 'Крахмал, г'],
                  ['water_g', 'Вода, г'],
                  ['alcohol_g', 'Алкоголь, г'],
                ] as [keyof MacrosDto, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number" step="0.1" min="0" className="rounded-xl tabular-nums"
                    value={macros[key] ?? ''}
                    onChange={(e) => setMacros((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚖️ Физические свойства</h2>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['density_g_per_ml', 'Плотность, г/мл'],
                  ['typical_portion_g', 'Порция, г'],
                  ['edible_yield_percent', 'Съедобная часть, %'],
                  ['shelf_life_days', 'Срок хранения, дней'],
                ] as [keyof NutritionBasicRequest, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number" step="0.1" min="0" className="rounded-xl tabular-nums"
                    value={(nutritionBasic[key] as number | undefined) ?? ''}
                    onChange={(e) => setNutritionBasic((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveMacros} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить нутриенты</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: ALLERGENS ──────────────────────────────────────────── */}
      {activeTab === 'allergens' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⚠️ Аллергены (14 групп ЕС)</h2>
            <p className="text-xs text-muted-foreground">Нажмите на аллерген, чтобы отметить его присутствие в продукте</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const key = ALLERGEN_KEY_MAP[a];
                const active = key ? !!allergens[key] : false;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      active
                        ? 'bg-destructive/90 text-destructive-foreground border-destructive shadow-sm'
                        : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                    }`}
                  >
                    {active ? '✓ ' : ''}{a}
                  </button>
                );
              })}
            </div>
            {Object.entries(allergens).some(([, v]) => v) && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(allergens)
                  .filter(([, v]) => v)
                  .map(([k]) => {
                    const name = Object.entries(ALLERGEN_KEY_MAP).find(([, v]) => v === k)?.[0] ?? k;
                    return <Badge key={k} variant="destructive" className="text-xs">{name}</Badge>;
                  })}
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🥗 Диетические флаги</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['vegan', '🌱 Веган'],
                  ['vegetarian', '🥬 Вегетарианец'],
                  ['gluten_free', '🌾 Без глютена'],
                  ['keto', '🥩 Кето'],
                  ['paleo', '🦴 Палео'],
                  ['mediterranean', '🫒 Средиземноморская'],
                  ['low_carb', '📉 Низкоугл.'],
                ] as [keyof DietFlagsDto, string][]
              ).map(([key, label]) => {
                const active = !!dietFlags[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDietFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      active
                        ? 'bg-green-600/90 text-white border-green-600 shadow-sm'
                        : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveAllergens} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить аллергены и диеты</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: CULINARY ───────────────────────────────────────────── */}
      {activeTab === 'culinary' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🐟 Тип продукта</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Тип продукта</Label>
                <Select
                  value={nutritionBasic.product_type ?? '__none__'}
                  onValueChange={(v) => setNutritionBasic((prev) => ({ ...prev, product_type: v === '__none__' ? undefined : v }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Выберите тип" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не выбрано —</SelectItem>
                    {['fish', 'seafood', 'meat', 'vegetable', 'fruit', 'dairy', 'grain', 'spice', 'oil', 'beverage', 'other'].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Дикий / Фермерский</Label>
                <Select
                  value={nutritionBasic.wild_farmed ?? '__none__'}
                  onValueChange={(v) => setNutritionBasic((prev) => ({ ...prev, wild_farmed: v === '__none__' ? null : v }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не указано —</SelectItem>
                    <SelectItem value="wild">🌊 Дикий</SelectItem>
                    <SelectItem value="farmed">🏭 Фермерский</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Тип воды</Label>
                <Select
                  value={nutritionBasic.water_type ?? '__none__'}
                  onValueChange={(v) => setNutritionBasic((prev) => ({ ...prev, water_type: v === '__none__' ? null : v }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не указано —</SelectItem>
                    <SelectItem value="freshwater">💧 Пресная</SelectItem>
                    <SelectItem value="saltwater">🌊 Морская</SelectItem>
                    <SelectItem value="brackish">🏞 Солоноватая</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Суши-класс</Label>
                <Select
                  value={nutritionBasic.sushi_grade === true ? 'true' : nutritionBasic.sushi_grade === false ? 'false' : '__none__'}
                  onValueChange={(v) => setNutritionBasic((prev) => ({ ...prev, sushi_grade: v === '__none__' ? null : v === 'true' }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— не указано —</SelectItem>
                    <SelectItem value="true">✅ Да</SelectItem>
                    <SelectItem value="false">❌ Нет</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">👅 Органолептические свойства (1–10)</h2>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['sweetness', '🍯 Сладость'],
                  ['acidity', '🍋 Кислотность'],
                  ['bitterness', '☕ Горечь'],
                  ['umami', '🍜 Умами'],
                  ['aroma', '👃 Аромат'],
                ] as [keyof CulinaryDto, string][]
              ).filter(([key]) => key !== 'texture').map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number" step="1" min="1" max="10" className="rounded-xl tabular-nums"
                    value={(culinary[key] as number | null | undefined) ?? ''}
                    onChange={(e) => setCulinary((prev) => ({ ...prev, [key]: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">🍱 Текстура</Label>
                <Input
                  value={culinary.texture ?? ''}
                  onChange={(e) => setCulinary((prev) => ({ ...prev, texture: e.target.value || null }))}
                  className="rounded-xl"
                  placeholder="crispy, tender..."
                />
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveCulinary} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить кулинарию</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: FOOD PROPERTIES ────────────────────────────────────── */}
      {activeTab === 'foodprops' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🔬 Физические и гликемические свойства</h2>
            <p className="text-xs text-muted-foreground">Гликемический индекс, pH, температура дымления — на 100г продукта</p>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['glycemic_index', 'Гликемический индекс (GI)', '0.1', '0', ''],
                  ['glycemic_load', 'Гликемическая нагрузка (GL)', '0.1', '0', ''],
                  ['ph', 'pH', '0.01', '0', '14'],
                  ['smoke_point', 'Температура дымления, °C', '1', '0', ''],
                  ['water_activity', 'Активность воды (aw)', '0.001', '0', '1'],
                ] as [keyof FoodPropertiesDto, string, string, string, string][]
              ).map(([key, label, step, min, max]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    step={step}
                    min={min}
                    max={max || undefined}
                    className="rounded-xl tabular-nums"
                    value={foodProps[key] ?? ''}
                    onChange={(e) => setFoodProps((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveFoodProps} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить свойства</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: SEASONALITY ────────────────────────────────────────── */}
      {activeTab === 'seasonality' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🗓 Сезонность по месяцам</h2>
            <p className="text-xs text-muted-foreground">Отметьте месяцы, когда продукт доступен</p>

            {/* Quick season buttons */}
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => {
                const months = s === 'AllYear' ? Array.from({ length: 12 }, (_, i) => i) : SEASON_MONTHS[s];
                const active = months.length === 0
                  ? availMonths.every(Boolean)
                  : months.every((m) => availMonths[m]);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSeason(s)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-md'
                        : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50'
                    }`}
                  >
                    <span>{SEASON_ICONS[s]}</span>{s}
                  </button>
                );
              })}
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-6 gap-2">
              {MONTH_NAMES.map((name, i) => {
                const active = availMonths[i] ?? false;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const next = [...availMonths] as boolean[];
                      next[i] = !next[i];
                      setNutritionBasic((prev) => ({ ...prev, availability_months: next }));
                    }}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Active months summary */}
            <div className="flex flex-wrap gap-1">
              {MONTH_NAMES.map((name, i) =>
                availMonths[i] ? (
                  <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                ) : null
              )}
              {!availMonths.some(Boolean) && (
                <span className="text-xs text-muted-foreground italic">Месяцы не выбраны</span>
              )}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveSeasonality} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить сезонность</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: VITAMINS ───────────────────────────────────────────── */}
      {activeTab === 'vitamins' && (
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">💊 Витамины (мг на 100г)</h2>
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ['vitamin_a', 'A'], ['vitamin_c', 'C'], ['vitamin_d', 'D'], ['vitamin_e', 'E'],
                  ['vitamin_k', 'K'], ['vitamin_b1', 'B1'], ['vitamin_b2', 'B2'], ['vitamin_b3', 'B3'],
                  ['vitamin_b5', 'B5'], ['vitamin_b6', 'B6'], ['vitamin_b7', 'B7 (биотин)'],
                  ['vitamin_b9', 'B9 (фолат)'], ['vitamin_b12', 'B12'],
                ] as [keyof VitaminsDto, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Вит. {label}</Label>
                  <Input
                    type="number" step="0.001" min="0" className="rounded-xl tabular-nums"
                    value={vitamins[key] ?? ''}
                    onChange={(e) => setVitamins((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">⛏ Минералы (мг на 100г)</h2>
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ['calcium', 'Кальций'], ['iron', 'Железо'], ['magnesium', 'Магний'],
                  ['phosphorus', 'Фосфор'], ['potassium', 'Калий'], ['sodium', 'Натрий'],
                  ['zinc', 'Цинк'], ['copper', 'Медь'], ['manganese', 'Марганец'], ['selenium', 'Селен'],
                ] as [keyof MineralsDto, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number" step="0.001" min="0" className="rounded-xl tabular-nums"
                    value={minerals[key] ?? ''}
                    onChange={(e) => setMinerals((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🫀 Жирные кислоты (г на 100г)</h2>
            <div className="grid grid-cols-4 gap-3">
              {(
                [
                  ['saturated_fat', 'Насыщенные'], ['monounsaturated_fat', 'Моно'],
                  ['polyunsaturated_fat', 'Поли'], ['omega3', 'Омега-3'],
                  ['omega6', 'Омега-6'], ['epa', 'EPA'], ['dha', 'DHA'],
                ] as [keyof FattyAcidsDto, string][]
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number" step="0.001" min="0" className="rounded-xl tabular-nums"
                    value={fattyAcids[key] ?? ''}
                    onChange={(e) => setFattyAcids((prev) => ({ ...prev, [key]: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveVitamins} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить витамины</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: SEO ────────────────────────────────────────────────── */}
      {activeTab === 'seo' && (
        <div className="space-y-5">
          {/* AI Generate button */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleGenerateSeo}
              disabled={seoLoading || saving}
              className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 border-violet-200 text-violet-700 dark:from-violet-950/30 dark:to-purple-950/30 dark:text-violet-300 dark:border-violet-800"
            >
              {seoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {seoLoading ? 'AI генерирует...' : '🤖 Сгенерировать SEO с AI'}
            </Button>
            <span className="text-xs text-muted-foreground">AI сгенерирует title, description, h1 и Open Graph</span>
          </div>

          {/* Google Preview */}
          <section className="glass rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Search className="h-4 w-4" />
              Предпросмотр в Google
            </h2>
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-border/50 max-w-xl">
              <div className="text-xs text-green-700 dark:text-green-400 font-normal mb-0.5 truncate">
                {seo.canonical_url || `https://dima-fomin.pl/ingredients/${product.slug || 'slug'}`}
              </div>
              <div className="text-blue-700 dark:text-blue-400 text-lg font-medium leading-snug mb-1 line-clamp-1 hover:underline cursor-pointer">
                {seo.seo_title || `${product.name_en} — Nutrition | dima-fomin.pl`}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                {seo.seo_description || 'Meta description will appear here...'}
              </div>
            </div>
          </section>

          {/* SEO Fields */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">🏷️ Meta Tags</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>SEO Title</span>
                  <span className={`text-xs tabular-nums ${(seo.seo_title?.length || 0) > 60 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                    {seo.seo_title?.length || 0}/60
                  </span>
                </Label>
                <Input
                  value={seo.seo_title}
                  onChange={(e) => setSeo((prev) => ({ ...prev, seo_title: e.target.value }))}
                  className="rounded-xl"
                  placeholder="Product Name — Nutrition, Vitamins | dima-fomin.pl"
                  maxLength={80}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>SEO Description</span>
                  <span className={`text-xs tabular-nums ${(seo.seo_description?.length || 0) > 155 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                    {seo.seo_description?.length || 0}/155
                  </span>
                </Label>
                <Textarea
                  value={seo.seo_description}
                  onChange={(e) => setSeo((prev) => ({ ...prev, seo_description: e.target.value }))}
                  className="rounded-xl resize-none"
                  rows={3}
                  placeholder="Compelling meta description with nutrition keywords..."
                  maxLength={200}
                />
              </div>

              <div className="space-y-1.5">
                <Label>SEO H1</Label>
                <Input
                  value={seo.seo_h1}
                  onChange={(e) => setSeo((prev) => ({ ...prev, seo_h1: e.target.value }))}
                  className="rounded-xl"
                  placeholder="Product Name — Nutrition & Culinary Profile"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Canonical URL</Label>
                <Input
                  value={seo.canonical_url}
                  onChange={(e) => setSeo((prev) => ({ ...prev, canonical_url: e.target.value }))}
                  className="rounded-xl"
                  placeholder="https://dima-fomin.pl/ingredients/product-slug"
                />
              </div>
            </div>
          </section>

          {/* Open Graph */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Open Graph (соц. сети)
            </h2>

            {/* OG Preview */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-border/50 overflow-hidden max-w-md">
              {(seo.og_image || product.image_url) && (
                <div className="relative w-full h-40 bg-muted">
                  <Image
                    src={seo.og_image || product.image_url || ''}
                    alt="OG Preview"
                    fill
                    className="object-cover"
                    sizes="400px"
                  />
                </div>
              )}
              <div className="p-3 space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">dima-fomin.pl</div>
                <div className="text-sm font-semibold line-clamp-2">
                  {seo.og_title || seo.seo_title || product.name_en}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {seo.og_description || seo.seo_description || ''}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>OG Title</span>
                  <span className={`text-xs tabular-nums ${(seo.og_title?.length || 0) > 65 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                    {seo.og_title?.length || 0}/65
                  </span>
                </Label>
                <Input
                  value={seo.og_title}
                  onChange={(e) => setSeo((prev) => ({ ...prev, og_title: e.target.value }))}
                  className="rounded-xl"
                  placeholder="Engaging social media title"
                  maxLength={80}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center justify-between">
                  <span>OG Description</span>
                  <span className={`text-xs tabular-nums ${(seo.og_description?.length || 0) > 200 ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                    {seo.og_description?.length || 0}/200
                  </span>
                </Label>
                <Textarea
                  value={seo.og_description}
                  onChange={(e) => setSeo((prev) => ({ ...prev, og_description: e.target.value }))}
                  className="rounded-xl resize-none"
                  rows={2}
                  placeholder="Social-friendly description..."
                  maxLength={250}
                />
              </div>

              <div className="space-y-1.5">
                <Label>OG Image URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={seo.og_image}
                    onChange={(e) => setSeo((prev) => ({ ...prev, og_image: e.target.value }))}
                    className="rounded-xl flex-1"
                    placeholder="https://..."
                  />
                  {product.image_url && !seo.og_image && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl shrink-0"
                      onClick={() => setSeo((prev) => ({ ...prev, og_image: product.image_url || '' }))}
                    >
                      Из фото
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveSeo} disabled={saving} className="h-11 px-8 rounded-xl font-semibold">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Save className="mr-2 h-4 w-4" />Сохранить SEO</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: PAIRING ───────────────────────────────────────────── */}
      {activeTab === 'pairing' && (
        <div className="space-y-5">
          {/* AI Generate + Add controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={handleAiPairings}
              disabled={pairingLoading || saving}
              className="rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100 border-violet-200 text-violet-700 dark:from-violet-950/30 dark:to-purple-950/30 dark:text-violet-300 dark:border-violet-800"
            >
              {pairingLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {pairingLoading ? 'AI генерирует...' : '🤖 AI Generate Pairings'}
            </Button>
            <span className="text-xs text-muted-foreground">
              AI подберёт сочетания из каталога
            </span>
          </div>

          {/* Add pairing search */}
          <section className="glass rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Добавить pairing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Поиск ингредиента</Label>
                <div className="relative">
                  <Input
                    value={pairingSearch}
                    onChange={(e) => setPairingSearch(e.target.value)}
                    className="rounded-xl"
                    placeholder="Введите название..."
                  />
                  {pairingSearching && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {/* Search results dropdown */}
                {pairingSearchResults.length > 0 && (
                  <div className="border border-border/50 rounded-xl bg-background shadow-lg max-h-48 overflow-y-auto">
                    {pairingSearchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleAddPairing(r.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      >
                        {r.image_url ? (
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0">
                            <Image src={r.image_url} alt="" fill className="object-cover" sizes="32px" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.name_en}</div>
                          {r.name_ru && <div className="text-xs text-muted-foreground truncate">{r.name_ru}</div>}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{r.product_type || '—'}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Тип</Label>
                <select
                  value={addPairingType}
                  onChange={(e) => setAddPairingType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm"
                >
                  <option value="primary">🟢 Primary</option>
                  <option value="secondary">🔵 Secondary</option>
                  <option value="experimental">🟡 Experimental</option>
                  <option value="avoid">🔴 Avoid</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Сила (1-10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={addPairingStrength}
                  onChange={(e) => setAddPairingStrength(parseFloat(e.target.value) || 8)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </section>

          {/* Pairing lists by type */}
          {(['primary', 'secondary', 'experimental', 'avoid'] as const).map((ptype) => {
            const items: PairingItem[] = pairings?.[ptype] ?? [];
            const config = {
              primary: { emoji: '🟢', label: 'Primary — классические сочетания', color: 'border-green-200 bg-green-50/30 dark:bg-green-950/10' },
              secondary: { emoji: '🔵', label: 'Secondary — хорошие сочетания', color: 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/10' },
              experimental: { emoji: '🟡', label: 'Experimental — креативные', color: 'border-yellow-200 bg-yellow-50/30 dark:bg-yellow-950/10' },
              avoid: { emoji: '🔴', label: 'Avoid — не сочетается', color: 'border-red-200 bg-red-50/30 dark:bg-red-950/10' },
            }[ptype];

            if (items.length === 0 && ptype !== 'primary') return null;

            return (
              <section key={ptype} className={`glass rounded-2xl p-5 space-y-3 border ${config.color}`}>
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                  {config.emoji} {config.label} ({items.length})
                </h2>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Нет pairings — нажмите AI Generate или добавьте вручную</p>
                ) : (
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-xl bg-background/60 border border-border/30 hover:border-border/60 transition-colors"
                      >
                        {item.image_url ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            <Image src={item.image_url} alt="" fill className="object-cover" sizes="40px" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                            🥗
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.name_en}</div>
                          {item.name_ru && <div className="text-xs text-muted-foreground truncate">{item.name_ru}</div>}
                        </div>
                        {item.pair_score != null && (
                          <Badge variant="secondary" className="tabular-nums text-xs shrink-0">
                            {item.pair_score.toFixed(1)}
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => item.id && handleDeletePairing(item.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                          title="Удалить"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Summary */}
          {pairings && (
            <div className="text-xs text-muted-foreground">
              Всего: {pairings.total} pairings ({pairings.primary.length} primary, {pairings.secondary.length} secondary, {pairings.experimental.length} experimental, {pairings.avoid.length} avoid)
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="text-[10px] font-mono text-muted-foreground/40 select-all pt-2">
        ID: {product.id} {nutrition ? '· nutrition ✓' : '· nutrition —'}
      </div>
    </div>
  );
}
