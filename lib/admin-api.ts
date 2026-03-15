const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ministerial-yetta-fodi999-c58d8823.koyeb.app';

// ── Авторизация ──────────────────────────────────────────────────────────────
export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json() as Promise<{ token: string; expires_in: number }>;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ── Типы ──────────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  slug: string | null;
  name_en: string;
  name_pl: string | null;
  name_uk: string | null;
  name_ru: string | null;
  category_id: string;
  unit: string;
  description: string | null;
  image_url: string | null;
  description_en: string | null;
  description_pl: string | null;
  description_ru: string | null;
  description_uk: string | null;
  // Legacy catalog macros (приходят как строки из Decimal)
  calories_per_100g: number | null;
  protein_per_100g: string | null;
  fat_per_100g: string | null;
  carbs_per_100g: string | null;
  fiber_per_100g: string | null;
  sugar_per_100g: string | null;
  salt_per_100g: string | null;
  density_g_per_ml: string | null;
  // Seasons & allergens (старый формат — массивы строк)
  seasons: string[];
  allergens: string[];
  availability_months: boolean[] | null;
  availability_model: string | null;
  // Product metadata
  product_type: string | null;
  shelf_life_days: number | null;
  edible_yield_percent: number | null;
  typical_portion_g: number | null;
  substitution_group: string | null;
  water_type: string | null;
  wild_farmed: string | null;
  sushi_grade: boolean | null;
  // SEO fields
  seo_title: string | null;
  seo_description: string | null;
  seo_h1: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
}

export interface Category {
  id: string;
  name_en: string;
  name_pl: string;
  name_ru: string;
  name_uk: string;
  sort_order: number;
  icon?: string;
}

export interface UpdateProductRequest {
  name_en?: string;
  name_pl?: string;
  name_uk?: string;
  name_ru?: string;
  category_id?: string;
  unit?: string;
  description_en?: string;
  description_pl?: string;
  description_ru?: string;
  description_uk?: string;
  // Legacy catalog macros
  calories_per_100g?: number;
  protein_per_100g?: number;
  fat_per_100g?: number;
  carbs_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  salt_per_100g?: number;
  density_g_per_ml?: number;
  // Seasons & allergens (старый формат)
  seasons?: string[];
  allergens?: string[];
  // Product metadata
  product_type?: string;
  auto_translate?: boolean;
  // SEO fields
  seo_title?: string;
  seo_description?: string;
  seo_h1?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
}

// ── Продукты ──────────────────────────────────────────────────────────────────
export async function getProducts(token: string): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch products');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.products ?? []);
}

export async function getProduct(token: string, id: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Product not found');
  const data = await res.json();
  return data.product ?? data;
}

export async function updateProduct(
  token: string,
  id: string,
  data: UpdateProductRequest,
): Promise<Product> {
  // Strip empty strings so we don't overwrite existing values with ""
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== '' && v !== undefined),
  ) as UpdateProductRequest;

  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(clean),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to update product: ${text}`);
  }
  return res.json();
}

export async function deleteProduct(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete product');
}

// ── Загрузка фото через multipart (обходит CORS R2) ──────────────────────────
export async function uploadProductImage(
  token: string,
  productId: string,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(
    `${API_BASE}/api/admin/catalog/products/${productId}/image`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // НЕ ставить Content-Type — браузер сам поставит multipart boundary
      body: formData,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to upload image: ${text}`);
  }
  const { image_url } = await res.json();
  return image_url as string;
}

// ── Категории ────────────────────────────────────────────────────────────────
export async function getCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/categories`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  const list: Category[] = Array.isArray(data) ? data : (data.categories ?? []);
  return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

// ══════════════════════════════════════════════════════════════════════════
// NUTRITION EDITOR API
// ══════════════════════════════════════════════════════════════════════════

export interface NutritionProductRow {
  id: string;
  slug: string;
  name_en: string | null;
  name_ru: string | null;
  name_pl: string | null;
  name_uk: string | null;
  product_type: string | null;
  unit: string | null;
  image_url: string | null;
}

export interface NutritionProductsResponse {
  total: number;
  page: number;
  limit: number;
  products: NutritionProductRow[];
}

export interface MacrosDto {
  calories_kcal?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  starch_g?: number | null;
  water_g?: number | null;
  alcohol_g?: number | null;
}

export interface VitaminsDto {
  vitamin_a?: number | null;
  vitamin_c?: number | null;
  vitamin_d?: number | null;
  vitamin_e?: number | null;
  vitamin_k?: number | null;
  vitamin_b1?: number | null;
  vitamin_b2?: number | null;
  vitamin_b3?: number | null;
  vitamin_b5?: number | null;
  vitamin_b6?: number | null;
  vitamin_b7?: number | null;
  vitamin_b9?: number | null;
  vitamin_b12?: number | null;
}

export interface MineralsDto {
  calcium?: number | null;
  iron?: number | null;
  magnesium?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  sodium?: number | null;
  zinc?: number | null;
  copper?: number | null;
  manganese?: number | null;
  selenium?: number | null;
}

export interface FattyAcidsDto {
  saturated_fat?: number | null;
  monounsaturated_fat?: number | null;
  polyunsaturated_fat?: number | null;
  omega3?: number | null;
  omega6?: number | null;
  epa?: number | null;
  dha?: number | null;
}

export interface DietFlagsDto {
  vegan?: boolean | null;
  vegetarian?: boolean | null;
  keto?: boolean | null;
  paleo?: boolean | null;
  gluten_free?: boolean | null;
  mediterranean?: boolean | null;
  low_carb?: boolean | null;
}

export interface AllergensDto {
  milk?: boolean | null;
  fish?: boolean | null;
  shellfish?: boolean | null;
  nuts?: boolean | null;
  soy?: boolean | null;
  gluten?: boolean | null;
  eggs?: boolean | null;
  peanuts?: boolean | null;
  sesame?: boolean | null;
  celery?: boolean | null;
  mustard?: boolean | null;
  sulfites?: boolean | null;
  lupin?: boolean | null;
  molluscs?: boolean | null;
}

export interface FoodPropertiesDto {
  glycemic_index?: number | null;
  glycemic_load?: number | null;
  ph?: number | null;
  smoke_point?: number | null;
  water_activity?: number | null;
}

export interface CulinaryDto {
  sweetness?: number | null;
  acidity?: number | null;
  bitterness?: number | null;
  umami?: number | null;
  aroma?: number | null;
  texture?: string | null;
}

export interface NutritionBasicRequest {
  name_en?: string;
  name_ru?: string;
  name_pl?: string;
  name_uk?: string;
  product_type?: string;
  unit?: string;
  image_url?: string;
  description_en?: string;
  description_ru?: string;
  description_pl?: string;
  description_uk?: string;
  density_g_per_ml?: number | null;
  typical_portion_g?: number | null;
  edible_yield_percent?: number | null;
  shelf_life_days?: number | null;
  wild_farmed?: string | null;
  water_type?: string | null;
  sushi_grade?: boolean | null;
  substitution_group?: string | null;
  availability_months?: boolean[];
}

export interface NutritionProductDetail {
  id: string;
  slug: string;
  name_en: string | null;
  name_ru: string | null;
  name_pl: string | null;
  name_uk: string | null;
  product_type: string | null;
  unit: string | null;
  image_url: string | null;
  description_en: string | null;
  description_ru: string | null;
  description_pl: string | null;
  description_uk: string | null;
  density_g_per_ml: number | null;
  typical_portion_g: number | null;
  edible_yield_percent: number | null;
  shelf_life_days: number | null;
  wild_farmed: string | null;
  water_type: string | null;
  sushi_grade: boolean | null;
  substitution_group: string | null;
  availability_months: boolean[] | null;
  macros: MacrosDto | null;
  vitamins: VitaminsDto | null;
  minerals: MineralsDto | null;
  fatty_acids: FattyAcidsDto | null;
  diet_flags: DietFlagsDto | null;
  allergens: AllergensDto | null;
  food_properties: FoodPropertiesDto | null;
  culinary: CulinaryDto | null;
}

const N = `${API_BASE}/api/admin/nutrition`;

export async function nutritionListProducts(
  token: string,
  page = 1,
  limit = 30,
  product_type?: string,
  search?: string,
): Promise<NutritionProductsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (product_type) params.set('type', product_type);
  if (search) params.set('search', search);
  const res = await fetch(`${N}/products?${params}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch nutrition products');
  const raw = await res.json();
  // Нормализуем ответ — бэкенд может вернуть массив или объект с разными ключами
  if (Array.isArray(raw)) {
    return { total: raw.length, page, limit, products: raw };
  }
  return {
    total: raw.total ?? raw.count ?? 0,
    page: raw.page ?? page,
    limit: raw.limit ?? limit,
    products: raw.products ?? raw.items ?? raw.data ?? [],
  };
}

export async function nutritionGetProduct(
  token: string,
  id: string,
): Promise<NutritionProductDetail | null> {
  const res = await fetch(`${N}/products/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch nutrition product');
  return res.json();
}

export async function nutritionUpdateBasic(
  token: string,
  id: string,
  data: NutritionBasicRequest,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/basic`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update basic');
}

export async function nutritionUpdateMacros(
  token: string,
  id: string,
  data: MacrosDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/macros`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update macros');
}

export async function nutritionUpdateVitamins(
  token: string,
  id: string,
  data: VitaminsDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/vitamins`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update vitamins');
}

export async function nutritionUpdateMinerals(
  token: string,
  id: string,
  data: MineralsDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/minerals`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update minerals');
}

export async function nutritionUpdateFattyAcids(
  token: string,
  id: string,
  data: FattyAcidsDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/fatty-acids`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update fatty acids');
}

export async function nutritionUpdateDietFlags(
  token: string,
  id: string,
  data: DietFlagsDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/diet-flags`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update diet flags');
}

export async function nutritionUpdateAllergens(
  token: string,
  id: string,
  data: AllergensDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/allergens`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update allergens');
}

export async function nutritionUpdateFoodProperties(
  token: string,
  id: string,
  data: FoodPropertiesDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/food-props`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update food properties');
}

export async function nutritionUpdateCulinary(
  token: string,
  id: string,
  data: CulinaryDto,
): Promise<void> {
  const res = await fetch(`${N}/products/${id}/culinary`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update culinary');
}

// ── AI Autofill ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aiAutofillProduct(token: string, id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}/ai-autofill`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI autofill failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── AI SEO Generation ─────────────────────────────────────────────────────────
export interface SeoData {
  seo_title: string;
  seo_description: string;
  seo_h1: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
}

export async function aiGenerateSeo(token: string, id: string): Promise<SeoData> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}/ai-seo`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI SEO generation failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── AI Audit ────────────────────────────────────────────────────────────
export interface AuditSummary {
  total_products: number;
  fully_complete: number;
  needs_attention: number;
  ai_data_warnings: number;
  audit_date: string;
}

export interface AuditProduct {
  id: string;
  name_en: string;
  slug: string;
  product_type: string | null;
  completeness_percent: number;
  missing: string[];
  warnings: string[];
}

export interface AuditUsdaWarning {
  product: string;
  field: string;
  our_value: number;
  usda_value: number;
  deviation_percent: number;
  severity: 'high' | 'medium' | 'low';
  comment: string;
}

export interface AuditReport {
  summary: AuditSummary;
  products_needing_attention: AuditProduct[];
  ai_usda_warnings: AuditUsdaWarning[];
}

export async function auditCatalog(token: string): Promise<AuditReport> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/audit`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Audit failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Food Pairing ──────────────────────────────────────────────────────────────
export interface PairingItem {
  id: string;
  paired_product_id: string;
  slug: string | null;
  name_en: string | null;
  name_ru: string | null;
  image_url: string | null;
  pair_score: number | null;
  flavor_score: number | null;
  nutrition_score: number | null;
  culinary_score: number | null;
}

export interface PairingsResponse {
  product_id: string;
  total: number;
  primary: PairingItem[];
  secondary: PairingItem[];
  experimental: PairingItem[];
  avoid: PairingItem[];
}

export async function getPairings(token: string, id: string): Promise<PairingsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}/pairings`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch pairings');
  return res.json();
}

export async function addPairing(
  token: string,
  productId: string,
  pairedProductId: string,
  pairingType: string,
  strength: number,
): Promise<PairingsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${productId}/pairings`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      paired_product_id: pairedProductId,
      pairing_type: pairingType,
      strength,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to add pairing: ${text}`);
  }
  return res.json();
}

export async function deletePairing(
  token: string,
  productId: string,
  pairingId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/catalog/products/${productId}/pairings/${pairingId}`,
    { method: 'DELETE', headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error('Failed to delete pairing');
}

export interface AiPairingsResult {
  inserted: number;
  not_found_in_catalog: string[];
  pairings: PairingsResponse;
}

export async function aiGeneratePairings(
  token: string,
  id: string,
): Promise<AiPairingsResult> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/products/${id}/ai-pairings`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI pairings failed: ${res.status} ${text}`);
  }
  return res.json();
}

export interface SearchProductResult {
  id: string;
  slug: string | null;
  name_en: string;
  name_ru: string | null;
  image_url: string | null;
  product_type: string | null;
}

export async function searchProducts(
  token: string,
  query: string,
): Promise<SearchProductResult[]> {
  const res = await fetch(
    `${API_BASE}/api/admin/catalog/products/search?q=${encodeURIComponent(query)}`,
    { headers: authHeaders(token), cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// ── Processing States API ───────────────────────────────────────────────

export interface IngredientState {
  state: string;
  calories_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
  carbs_per_100g: number | null;
  fiber_per_100g: number | null;
  water_percent: number | null;
  shelf_life_hours: number | null;
  storage_temp_c: number | null;
  texture: string | null;
  weight_change_percent: number | null;
  state_type: string | null;
  oil_absorption_g: number | null;
  water_loss_percent: number | null;
  name_suffix_en: string | null;
  name_suffix_pl: string | null;
  name_suffix_ru: string | null;
  name_suffix_uk: string | null;
  notes_en: string | null;
  notes_pl: string | null;
  notes_ru: string | null;
  notes_uk: string | null;
  data_score: number | null;
}

export interface IngredientStatesResponse {
  slug: string;
  ingredient_id: string;
  name_en: string;
  name_pl: string;
  name_ru: string;
  name_uk: string;
  image_url: string | null;
  states_count: number;
  states: IngredientState[];
}

export interface StatesAuditResponse {
  ok: boolean;
  total_ingredients: number;
  ingredients_with_all_states: number;
  ingredients_missing_states: number;
  total_state_records: number;
  expected_state_records: number;
}

export interface GenerateStatesResult {
  ok: boolean;
  ingredient_id: string;
  name_en: string;
  states_created: string[];
  states_total: number;
}

export interface BulkGenerateResult {
  ok: boolean;
  total_ingredients: number;
  ingredients_processed: number;
  states_created: number;
  errors: string[];
}

/** Get all processing states for a product (via public API using slug) */
export async function getProductStates(
  slug: string,
): Promise<IngredientStatesResponse> {
  const res = await fetch(`${API_BASE}/public/ingredients/${slug}/states`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch states');
  return res.json();
}

/** Generate states for one ingredient (admin) */
export async function generateStates(
  token: string,
  ingredientId: string,
): Promise<GenerateStatesResult> {
  const res = await fetch(
    `${API_BASE}/api/admin/catalog/states/generate/${ingredientId}`,
    { method: 'POST', headers: authHeaders(token) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Generate states failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Generate states for ALL ingredients (admin) */
export async function generateAllStates(
  token: string,
): Promise<BulkGenerateResult> {
  const res = await fetch(
    `${API_BASE}/api/admin/catalog/states/generate-all`,
    { method: 'POST', headers: authHeaders(token) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bulk generate failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Delete all states for an ingredient (allows re-generation) */
export async function deleteProductStates(
  token: string,
  ingredientId: string,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/admin/catalog/states/products/${ingredientId}`,
    { method: 'DELETE', headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error('Failed to delete states');
}

/** Get states audit (admin) */
export async function getStatesAudit(
  token: string,
): Promise<StatesAuditResponse> {
  const res = await fetch(`${API_BASE}/api/admin/catalog/states/audit`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch audit');
  return res.json();
}
