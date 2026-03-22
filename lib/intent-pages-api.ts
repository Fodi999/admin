// ══════════════════════════════════════════════════════════════════════
// Intent Pages (pSEO) — Admin API Client
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

export type ContentBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'text'; content: string }
  | { type: 'image'; key: string; alt: string; src?: string };

export interface IntentPage {
  id: string;
  intent_type: string;
  entity_a: string;
  entity_b: string | null;
  locale: string;
  title: string;
  description: string;
  answer: string;
  faq: { question: string; answer: string }[];
  slug: string;
  content_blocks: ContentBlock[];
  status: 'draft' | 'queued' | 'published' | 'archived';
  priority: number;
  published_at: string | null;
  queued_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntentPageStats {
  total: number;
  draft: number;
  queued: number;
  published: number;
  archived: number;
  queued_high: number;
  queued_normal: number;
  queued_low: number;
  published_today: number;
  remaining_today: number;
  publish_limit_per_day: number;
  // Site-wide SEO breakdown
  seo: {
    active_ingredients: number;
    nutrition: number;
    ingredient_profiles: number;
    how_many: number;
    states: number;
    diet: number;
    ranking: number;
    fish_season: number;
    static_pages: number;
    intent_pages: number;
    intent_today: number;
    intent_this_week: number;
    system_total: number;
    google_discovered: number;
    coverage_pct: number;
    untracked: number;
    not_yet_indexed: number;
  };
}

export interface IntentPageSettings {
  publish_limit_per_day: number;
}

export interface GenerateRequest {
  intent_type: string;
  entity_a: string;
  entity_b?: string;
  locale: string;
  sub_intent?: string;
}

export interface BatchGenerateRequest {
  intent_type: string;
  entity_a: string;
  entity_b?: string;
  locale: string;
  auto_publish?: boolean;
}

export interface BatchResult {
  total: number;
  generated: number;
  skipped: number;
  errors: number;
  results: {
    sub_intent: string;
    status: string;
    page?: IntentPage;
    error?: string;
  }[];
}

export interface SchedulerResult {
  limit: number;
  published: number;
  published_today: number;
  errors?: number;
  reason?: string;
}

export interface DuplicateEntry {
  id: string;
  slug: string;
  title: string;
  status: string;
  is_canonical: boolean;
}

export interface DuplicateGroup {
  entity_a: string;
  locale: string;
  canonical_slug: string;
  pages: DuplicateEntry[];
}

// ── API Functions ────────────────────────────────────────────────────

const IP = `${API_BASE}/api/admin/intent-pages`;

/** GET /api/admin/intent-pages */
export async function getIntentPages(token: string): Promise<IntentPage[]> {
  const res = await fetch(IP, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch intent pages');
  const data = await res.json();
  return Array.isArray(data) ? data : (data.pages ?? []);
}

/** GET /api/admin/intent-pages/stats */
export async function getIntentPageStats(token: string): Promise<IntentPageStats> {
  const res = await fetch(`${IP}/stats`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

/** GET /api/admin/intent-pages/settings */
export async function getIntentPageSettings(token: string): Promise<IntentPageSettings> {
  const res = await fetch(`${IP}/settings`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

/** PUT /api/admin/intent-pages/settings */
export async function updateIntentPageSettings(
  token: string,
  settings: IntentPageSettings,
): Promise<IntentPageSettings> {
  const res = await fetch(`${IP}/settings`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

/** GET /api/admin/intent-pages/:id */
export async function getIntentPage(token: string, id: string): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Intent page not found');
  return res.json();
}

/** POST /api/admin/intent-pages/generate */
export async function generateIntentPage(
  token: string,
  req: GenerateRequest,
): Promise<IntentPage> {
  const res = await fetch(`${IP}/generate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Generate failed: ${text}`);
  }
  return res.json();
}

/** POST /api/admin/intent-pages/generate-batch */
export async function generateBatch(
  token: string,
  req: BatchGenerateRequest,
): Promise<BatchResult> {
  const res = await fetch(`${IP}/generate-batch`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Batch generate failed: ${text}`);
  }
  return res.json();
}

/** PUT /api/admin/intent-pages/:id */
export async function updateIntentPage(
  token: string,
  id: string,
  data: Partial<Pick<IntentPage, 'title' | 'description' | 'answer' | 'slug'>> & { priority?: number },
): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update intent page');
  return res.json();
}

/** POST /api/admin/intent-pages/:id/publish */
export async function publishIntentPage(token: string, id: string): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Publish failed: ${text}`);
  }
  return res.json();
}

/** POST /api/admin/intent-pages/:id/unpublish */
export async function unpublishIntentPage(token: string, id: string): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}/unpublish`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Unpublish failed');
  return res.json();
}

/** POST /api/admin/intent-pages/:id/enqueue */
export async function enqueueIntentPage(token: string, id: string): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}/enqueue`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Enqueue failed');
  return res.json();
}

/** POST /api/admin/intent-pages/:id/archive */
export async function archiveIntentPage(token: string, id: string): Promise<IntentPage> {
  const res = await fetch(`${IP}/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Archive failed');
  return res.json();
}

/** POST /api/admin/intent-pages/enqueue-bulk */
export async function enqueueBulk(
  token: string,
  ids: string[],
  priority?: number,
): Promise<{ queued: number; skipped: number }> {
  const res = await fetch(`${IP}/enqueue-bulk`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids, priority }),
  });
  if (!res.ok) throw new Error('Bulk enqueue failed');
  return res.json();
}

/** POST /api/admin/intent-pages/scheduler/run */
export async function runScheduler(token: string): Promise<SchedulerResult> {
  const res = await fetch(`${IP}/scheduler/run`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Scheduler run failed');
  return res.json();
}

/** DELETE /api/admin/intent-pages/:id */
export async function deleteIntentPage(token: string, id: string): Promise<void> {
  const res = await fetch(`${IP}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete intent page');
}

/** POST /api/admin/intent-pages/publish-bulk */
export async function publishBulk(
  token: string,
  ids: string[],
): Promise<{ published: number; skipped: number }> {
  const res = await fetch(`${IP}/publish-bulk`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Bulk publish failed');
  return res.json();
}

/** POST /api/admin/intent-pages/archive-bulk */
export async function archiveBulk(
  token: string,
  ids: string[],
): Promise<{ archived: number; skipped: number }> {
  const res = await fetch(`${IP}/archive-bulk`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Bulk archive failed');
  return res.json();
}

/** POST /api/admin/intent-pages/delete-bulk */
export async function deleteBulk(
  token: string,
  ids: string[],
): Promise<{ deleted: number; skipped: number }> {
  const res = await fetch(`${IP}/delete-bulk`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Bulk delete failed');
  return res.json();
}

/** GET /api/admin/intent-pages/duplicates */
export async function findDuplicates(
  token: string,
): Promise<DuplicateGroup[]> {
  const res = await fetch(`${IP}/duplicates`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch duplicates');
  return res.json();
}

/** POST /api/admin/intent-pages/cleanup-slugs */
export async function cleanupSlugs(
  token: string,
): Promise<{ groups: number; deleted: number; kept: number }> {
  const res = await fetch(`${IP}/cleanup-slugs`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Cleanup slugs failed');
  return res.json();
}

/** PUT /api/admin/intent-pages/google-discovered
 * Update the Google Search Console baseline (e.g. 7192).
 */
export async function setGoogleDiscovered(
  token: string,
  count: number,
): Promise<{ google_discovered_pages: number }> {
  const res = await fetch(`${IP}/google-discovered`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error('Failed to update google discovered pages');
  return res.json();
}

// ── Image Upload ─────────────────────────────────────────────────

export interface ImageUploadResponse {
  upload_url: string;
  public_url: string;
}

/** GET /api/admin/intent-pages/:id/images/:key/upload-url?content_type=... */
export async function getImageUploadUrl(
  token: string,
  pageId: string,
  key: string,
  contentType: string = 'image/webp',
): Promise<ImageUploadResponse> {
  const res = await fetch(
    `${IP}/${pageId}/images/${key}/upload-url?content_type=${encodeURIComponent(contentType)}`,
    { headers: authHeaders(token), cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Failed to get upload URL');
  return res.json();
}

/** POST /api/admin/intent-pages/:id/images/:key  body: { image_url } */
export async function saveImageUrl(
  token: string,
  pageId: string,
  key: string,
  imageUrl: string,
): Promise<IntentPage> {
  const res = await fetch(`${IP}/${pageId}/images/${key}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) throw new Error('Failed to save image URL');
  return res.json();
}

/** Upload a file to R2 via presigned URL, then save the public URL. */
export async function uploadImageToR2(
  token: string,
  pageId: string,
  key: string,
  file: File,
): Promise<IntentPage> {
  const { upload_url, public_url } = await getImageUploadUrl(
    token,
    pageId,
    key,
    file.type || 'image/webp',
  );
  // PUT the file directly to R2
  const putRes = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/webp' },
    body: file,
  });
  if (!putRes.ok) throw new Error('Failed to upload image to R2');
  // Save the public URL in DB
  return saveImageUrl(token, pageId, key, public_url);
}
