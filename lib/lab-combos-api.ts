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
  smart_response: Record<string, unknown>;
  faq: { question: string; answer: string }[];
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
