// lib/cms.ts — CMS API calls
import type {
  About,
  Expertise,
  Experience,
  Gallery,
  GalleryCategory,
  Article,
  ArticleCategory,
} from './cms-types';

const API = process.env.NEXT_PUBLIC_API_URL!;
const B = '/api/admin/cms';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── ABOUT ─────────────────────────────────────────────────────────────────────
export const getAbout = () => apiFetch<About>(`${B}/about`);

export const updateAbout = (data: Partial<About>) =>
  apiFetch<About>(`${B}/about`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

// ── EXPERTISE ─────────────────────────────────────────────────────────────────
export const listExpertise = () => apiFetch<Expertise[]>(`${B}/expertise`);

export const createExpertise = (
  data: Omit<Expertise, 'id' | 'created_at' | 'updated_at'>,
) =>
  apiFetch<Expertise>(`${B}/expertise`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateExpertise = (id: string, data: Partial<Expertise>) =>
  apiFetch<Expertise>(`${B}/expertise/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteExpertise = (id: string) =>
  apiFetch<void>(`${B}/expertise/${id}`, { method: 'DELETE' });

// ── EXPERIENCE ────────────────────────────────────────────────────────────────
export const listExperience = () => apiFetch<Experience[]>(`${B}/experience`);

export const createExperience = (
  data: Omit<Experience, 'id' | 'created_at' | 'updated_at'>,
) =>
  apiFetch<Experience>(`${B}/experience`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateExperience = (id: string, data: Partial<Experience>) =>
  apiFetch<Experience>(`${B}/experience/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteExperience = (id: string) =>
  apiFetch<void>(`${B}/experience/${id}`, { method: 'DELETE' });

// ── GALLERY ───────────────────────────────────────────────────────────────────
export const listGallery = (category?: string) =>
  apiFetch<Gallery[]>(`${B}/gallery${category ? `?category=${encodeURIComponent(category)}` : ''}`);

export const listGalleryCategories = () =>
  apiFetch<GalleryCategory[]>(`${B}/gallery-categories`);

export const createGallery = (
  data: Omit<Gallery, 'id' | 'created_at' | 'updated_at'>,
) =>
  apiFetch<Gallery>(`${B}/gallery`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateGallery = (id: string, data: Partial<Gallery>) =>
  apiFetch<Gallery>(`${B}/gallery/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteGallery = (id: string) =>
  apiFetch<void>(`${B}/gallery/${id}`, { method: 'DELETE' });

// ── ARTICLES ──────────────────────────────────────────────────────────────────
export const listArticles = () => apiFetch<Article[]>(`${B}/articles`);

export const getArticle = (id: string) =>
  apiFetch<Article>(`${B}/articles/${id}`);

export const createArticle = (
  data: Omit<Article, 'id' | 'created_at' | 'updated_at'>,
) =>
  apiFetch<Article>(`${B}/articles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateArticle = (id: string, data: Partial<Article>) =>
  apiFetch<Article>(`${B}/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteArticle = (id: string) =>
  apiFetch<void>(`${B}/articles/${id}`, { method: 'DELETE' });

// ── CATEGORIES ────────────────────────────────────────────────────────────────
export const listCategories = () =>
  apiFetch<ArticleCategory[]>(`${B}/article-categories`);

// ── IMAGE UPLOAD ──────────────────────────────────────────────────────────────
interface UploadUrlResponse {
  upload_url: string;
  url: string;
}

export async function getUploadUrl(
  folder: 'gallery' | 'articles' | 'about' | 'general',
  contentType = 'image/webp'
): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>(
    `${B}/upload-url?folder=${folder}&content_type=${encodeURIComponent(contentType)}`
  );
}

export async function uploadImage(
  file: File,
  folder: 'gallery' | 'articles' | 'about' | 'general',
): Promise<string> {
  const { upload_url, url } = await getUploadUrl(folder, file.type);

  // PUT файл напрямую в Cloudflare R2 (presigned URL, без авторизации)
  const res = await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error('Upload to R2 failed');

  return url;
}
