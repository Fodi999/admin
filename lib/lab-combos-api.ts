// ══════════════════════════════════════════════════════════════════════
// Lab Combo SEO Pages — Admin API Client
// ══════════════════════════════════════════════════════════════════════

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://ministerial-yetta-fodi999-c58d8823.koyeb.app';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ── Types ────────────────────────────────────────────────────────────

export interface LabComboPage {
  id: string;
  slug: string;
  locale: string;
  ingredients: string[];
  goal: string | null;
  meal_type: string | null;
  diet: string | null;
  cooking_time: string | null;
  budget: string | null;
  cuisine: string | null;
  title: string;
  description: string;
  h1: string;
  intro: string;
  why_it_works: string;
  how_to_cook: { step: number; text: string; time_minutes?: number }[];
  optimization_tips: { icon: string; action: string; ingredient: string; tip: string }[];
  image_url: string | null;
  process_image_url: string | null;
  detail_image_url: string | null;
  smart_response: Record<string, unknown>;
  faq: { question: string; answer: string }[];
  // Pre-calculated nutrition
  total_weight_g: number;
  servings_count: number;
  calories_total: number;
  protein_total: number;
  fat_total: number;
  carbs_total: number;
  fiber_total: number;
  calories_per_serving: number;
  protein_per_serving: number;
  fat_per_serving: number;
  carbs_per_serving: number;
  fiber_per_serving: number;
  // Structured ingredients (DB data, not AI)
  structured_ingredients: {
    slug: string;
    name: string;
    grams: number;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    image_url: string | null;
    product_type: string | null;
  }[];
  status: 'draft' | 'published' | 'archived';
  quality_score: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerateComboRequest {
  ingredients: string[];
  locale: string;
  goal?: string;
  meal_type?: string;
  diet?: string;
  cooking_time?: string;
  budget?: string;
  cuisine?: string;
  /** AI model: "flash" (fast, default) or "pro" (smart, better SEO quality) */
  model?: string;
}

export interface GeneratePopularRequest {
  locale: string;
  limit?: number;
}

export interface GeneratePopularResult {
  generated: number;
  details: string[];
}

export interface UpdateComboRequest {
  title?: string;
  description?: string;
  h1?: string;
  intro?: string;
  why_it_works?: string;
  image_url?: string;
}

// ── API Functions ────────────────────────────────────────────────────

/** GET /api/admin/lab-combos?status=...&locale=...&limit=...&offset=... */
export async function getLabCombos(
  token: string,
  params?: { status?: string; locale?: string; limit?: number; offset?: number },
): Promise<LabComboPage[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.locale) qs.set('locale', params.locale);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const url = `${API_BASE}/api/admin/lab-combos?${qs.toString()}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to list lab combos: ${res.status}`);
  return res.json();
}

/** POST /api/admin/lab-combos/generate */
export async function generateCombo(
  token: string,
  req: GenerateComboRequest,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/generate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to generate combo: ${res.status}`);
  }
  return res.json();
}

/** POST /api/admin/lab-combos/generate-all-locales
 *  One call → generates pages for all 4 locales (en, pl, ru, uk) */
export async function generateComboAllLocales(
  token: string,
  req: GenerateComboRequest,
): Promise<LabComboPage[]> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/generate-all-locales`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to generate combo (all locales): ${res.status}`);
  }
  return res.json();
}

/** POST /api/admin/lab-combos/generate-popular */
export async function generatePopularCombos(
  token: string,
  req: GeneratePopularRequest,
): Promise<GeneratePopularResult> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/generate-popular`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to generate popular combos: ${res.status}`);
  }
  return res.json();
}

/** POST /api/admin/lab-combos/:id/publish */
export async function publishCombo(
  token: string,
  id: string,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to publish: ${res.status}`);
  return res.json();
}

/** POST /api/admin/lab-combos/:id/archive */
export async function archiveCombo(
  token: string,
  id: string,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to archive: ${res.status}`);
  return res.json();
}

/** DELETE /api/admin/lab-combos/:id */
export async function deleteCombo(
  token: string,
  id: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
}

/** PATCH /api/admin/lab-combos/:id */
export async function updateCombo(
  token: string,
  id: string,
  req: UpdateComboRequest,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to update combo: ${res.status}`);
  }
  return res.json();
}

/** GET /api/admin/lab-combos/:id/image-upload-url — presigned R2 upload URL */
export async function getComboImageUploadUrl(
  token: string,
  id: string,
  contentType = 'image/webp',
): Promise<{ upload_url: string; public_url: string }> {
  const res = await fetch(
    `${API_BASE}/api/admin/lab-combos/${id}/image-upload-url?content_type=${encodeURIComponent(contentType)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to get upload URL: ${res.status}`);
  return res.json();
}

/** PUT /api/admin/lab-combos/:id/image-url — save public URL after R2 upload */
export async function saveComboImageUrl(
  token: string,
  id: string,
  imageUrl: string,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}/image-url`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) throw new Error(`Failed to save image URL: ${res.status}`);
  return res.json();
}

/** GET /api/admin/lab-combos/:id/image-upload-url/:kind — presigned R2 upload URL for typed image */
export async function getTypedImageUploadUrl(
  token: string,
  id: string,
  kind: 'hero' | 'process' | 'detail',
  contentType = 'image/webp',
): Promise<{ upload_url: string; public_url: string }> {
  const res = await fetch(
    `${API_BASE}/api/admin/lab-combos/${id}/image-upload-url/${kind}?content_type=${encodeURIComponent(contentType)}`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw new Error(`Failed to get typed upload URL: ${res.status}`);
  return res.json();
}

/** PUT /api/admin/lab-combos/:id/image-url/:kind — save typed image URL after R2 upload */
export async function saveTypedImageUrl(
  token: string,
  id: string,
  kind: 'hero' | 'process' | 'detail',
  imageUrl: string,
): Promise<LabComboPage> {
  const res = await fetch(`${API_BASE}/api/admin/lab-combos/${id}/image-url/${kind}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) throw new Error(`Failed to save typed image URL: ${res.status}`);
  return res.json();
}
