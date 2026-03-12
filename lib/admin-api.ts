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
  calories_per_100g: number | null;
  protein_per_100g: string | null; // Decimal приходит как string
  fat_per_100g: string | null;
  carbs_per_100g: string | null;
  density_g_per_ml: string | null;
  seasons: string[];
  allergens: string[];
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
  calories_per_100g?: number;
  protein_per_100g?: number;
  fat_per_100g?: number;
  carbs_per_100g?: number;
  density_g_per_ml?: number;
  seasons?: string[];
  allergens?: string[];
  auto_translate?: boolean;
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
