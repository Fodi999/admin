# Admin Dashboard — Integration Guide
# Подключение Admin Panel к Rust API

## Stack: Next.js 14+ (App Router) + TypeScript

---

## 1. Environment Variables

```env
# .env.local
NEXT_PUBLIC_API_URL=https://ministerial-yetta-fodi999-c58d8823.koyeb.app
```

---

## 2. lib/api.ts — Base fetch client

```typescript
// lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL!

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
```

---

## 3. lib/auth.ts — Login / Logout

```typescript
// lib/auth.ts
import { apiFetch } from './api'

interface LoginResponse {
  token: string
  expires_in: number   // секунды
}

// POST /api/admin/auth/login
// Body: { "password": "your_secret" }
export async function adminLogin(password: string): Promise<void> {
  const data = await apiFetch<LoginResponse>('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  localStorage.setItem('admin_token', data.token)
  // expires_in в секундах → ms
  localStorage.setItem(
    'admin_token_exp',
    String(Date.now() + data.expires_in * 1000)
  )
}

export function adminLogout(): void {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_token_exp')
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false
  const token = localStorage.getItem('admin_token')
  const exp   = localStorage.getItem('admin_token_exp')
  if (!token || !exp) return false
  return Date.now() < Number(exp)
}
```

---

## 4. middleware.ts — Route protection

```typescript
// middleware.ts  (корень проекта, рядом с app/)
import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token      = req.cookies.get('admin_token')?.value
  const isLogin    = req.nextUrl.pathname === '/login'

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

> Tip: сохраняй токен и в cookie (при логине) чтобы middleware мог его читать:
> ```typescript
> document.cookie = `admin_token=${data.token}; path=/; max-age=${data.expires_in}`
> ```

---

## 5. lib/cms.ts — All CMS API calls

```typescript
// lib/cms.ts
import { apiFetch } from './api'

const B = '/api/admin/cms'

// ── ABOUT ─────────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/about
export const getAbout = () =>
  apiFetch<About>(`${B}/about`)

// PUT  /api/admin/cms/about
// Body: { title_ru, content_ru, image_url, ... }  — только нужные поля
export const updateAbout = (data: Partial<About>) =>
  apiFetch<About>(`${B}/about`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// ── EXPERTISE ─────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/expertise
export const listExpertise = () =>
  apiFetch<Expertise[]>(`${B}/expertise`)

// POST /api/admin/cms/expertise
// Body: { icon, title_en, title_ru, order_index }
export const createExpertise = (data: Omit<Expertise, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<Expertise>(`${B}/expertise`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// PUT  /api/admin/cms/expertise/:id
export const updateExpertise = (id: string, data: Partial<Expertise>) =>
  apiFetch<Expertise>(`${B}/expertise/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// DELETE /api/admin/cms/expertise/:id
export const deleteExpertise = (id: string) =>
  apiFetch<void>(`${B}/expertise/${id}`, { method: 'DELETE' })

// ── EXPERIENCE ────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/experience
export const listExperience = () =>
  apiFetch<Experience[]>(`${B}/experience`)

// POST /api/admin/cms/experience
// Body: { restaurant, country, position, start_year, end_year, description_ru, ... }
export const createExperience = (data: Omit<Experience, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<Experience>(`${B}/experience`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// PUT  /api/admin/cms/experience/:id
export const updateExperience = (id: string, data: Partial<Experience>) =>
  apiFetch<Experience>(`${B}/experience/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// DELETE /api/admin/cms/experience/:id
export const deleteExperience = (id: string) =>
  apiFetch<void>(`${B}/experience/${id}`, { method: 'DELETE' })

// ── GALLERY ───────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/gallery
export const listGallery = () =>
  apiFetch<Gallery[]>(`${B}/gallery`)

// POST /api/admin/cms/gallery
// Body: { image_url, title_ru, alt_ru, description_ru, order_index, ... }
export const createGallery = (data: Omit<Gallery, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<Gallery>(`${B}/gallery`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// PUT  /api/admin/cms/gallery/:id
export const updateGallery = (id: string, data: Partial<Gallery>) =>
  apiFetch<Gallery>(`${B}/gallery/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// DELETE /api/admin/cms/gallery/:id
export const deleteGallery = (id: string) =>
  apiFetch<void>(`${B}/gallery/${id}`, { method: 'DELETE' })

// ── ARTICLES ──────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/articles   — все статьи включая черновики
export const listArticles = () =>
  apiFetch<Article[]>(`${B}/articles`)

// GET  /api/admin/cms/articles/:id
export const getArticle = (id: string) =>
  apiFetch<Article>(`${B}/articles/${id}`)

// POST /api/admin/cms/articles
// Body: { title_en, slug (optional), content_ru, seo_title, published, ... }
export const createArticle = (data: Omit<Article, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<Article>(`${B}/articles`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// PUT  /api/admin/cms/articles/:id
export const updateArticle = (id: string, data: Partial<Article>) =>
  apiFetch<Article>(`${B}/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

// DELETE /api/admin/cms/articles/:id
export const deleteArticle = (id: string) =>
  apiFetch<void>(`${B}/articles/${id}`, { method: 'DELETE' })

// ── CATEGORIES ────────────────────────────────────────────────────────────────
// GET  /api/admin/cms/article-categories
export const listCategories = () =>
  apiFetch<ArticleCategory[]>(`${B}/article-categories`)

// ── IMAGE UPLOAD ──────────────────────────────────────────────────────────────
// GET  /api/admin/cms/upload-url?folder=gallery&content_type=image/webp
// Returns: { upload_url, url }
// Шаг 1: получить presigned URL
// Шаг 2: PUT файл напрямую в R2 (без сервера)
// Шаг 3: сохранить url в запись

interface UploadUrlResponse {
  upload_url: string   // PUT сюда файл напрямую
  url: string          // финальный публичный URL для сохранения в БД
}

export async function getUploadUrl(
  folder: 'gallery' | 'articles' | 'about' | 'general',
  contentType = 'image/webp'
): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>(
    `${B}/upload-url?folder=${folder}&content_type=${encodeURIComponent(contentType)}`
  )
}

export async function uploadImage(
  file: File,
  folder: 'gallery' | 'articles' | 'about' | 'general'
): Promise<string> {
  const { upload_url, url } = await getUploadUrl(folder, file.type)

  // PUT файл напрямую в Cloudflare R2 (presigned URL, без авторизации)
  const res = await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!res.ok) throw new Error('Upload to R2 failed')

  return url   // сохрани этот URL в gallery.image_url или article.image_url
}
```

---

## 6. lib/cms-types.ts — TypeScript типы

```typescript
// lib/cms-types.ts

export interface About {
  id: string
  title_en: string; title_pl: string; title_ru: string; title_uk: string
  content_en: string; content_pl: string; content_ru: string; content_uk: string
  image_url?: string
  updated_at: string
}

export interface Expertise {
  id: string
  icon: string
  title_en: string; title_pl: string; title_ru: string; title_uk: string
  order_index: number
  created_at: string; updated_at: string
}

export interface Experience {
  id: string
  restaurant: string; country: string; position: string
  start_year?: number
  end_year?: number          // null = "по сей день"
  description_en: string; description_pl: string
  description_ru: string; description_uk: string
  order_index: number
  created_at: string; updated_at: string
}

export interface Gallery {
  id: string
  image_url: string
  title_en: string; title_pl: string; title_ru: string; title_uk: string
  description_en: string; description_pl: string
  description_ru: string; description_uk: string
  alt_en: string; alt_pl: string; alt_ru: string; alt_uk: string
  order_index: number
  created_at: string; updated_at: string
}

export interface Article {
  id: string
  slug: string
  title_en: string; title_pl: string; title_ru: string; title_uk: string
  content_en: string; content_pl: string; content_ru: string; content_uk: string
  image_url?: string
  seo_title: string
  seo_description: string
  published: boolean
  order_index: number
  created_at: string; updated_at: string
}

export interface ArticleCategory {
  id: string
  slug: string
  title_en: string; title_pl: string; title_ru: string; title_uk: string
  order_index: number
  created_at: string
}
```

---

## 7. Примеры использования в компонентах

### About — страница редактирования "О шефе"

```typescript
// app/dashboard/about/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { getAbout, updateAbout, uploadImage } from '@/lib/cms'
import type { About } from '@/lib/cms-types'

export default function AboutPage() {
  const [form, setForm] = useState<Partial<About>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // Загрузить текущие данные при открытии страницы
  useEffect(() => {
    getAbout().then(data => setForm(data))
  }, [])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Загрузка фото шефа в R2
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, 'about')
      setForm(prev => ({ ...prev, image_url: url }))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      // PUT /api/admin/cms/about
      await updateAbout(form)
      setMessage('✅ Сохранено')
    } catch (err: unknown) {
      setMessage(`❌ Ошибка: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 800 }}>
      <h1>О шефе</h1>

      {/* Фото */}
      <section>
        <h2>Фото</h2>
        {form.image_url && (
          <img src={form.image_url} alt="Chef" style={{ width: 200 }} />
        )}
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        {uploading && <span>Загружаем...</span>}
        {form.image_url && (
          <input
            name="image_url"
            value={form.image_url}
            onChange={handleChange}
            placeholder="URL фото (автозаполняется)"
          />
        )}
      </section>

      {/* Заголовки */}
      <section>
        <h2>Заголовок</h2>
        {(['en', 'pl', 'ru', 'uk'] as const).map(lang => (
          <div key={lang}>
            <label>{lang.toUpperCase()}</label>
            <input
              name={`title_${lang}`}
              value={(form as Record<string, string>)[`title_${lang}`] ?? ''}
              onChange={handleChange}
              placeholder={`Заголовок (${lang})`}
            />
          </div>
        ))}
      </section>

      {/* Контент / Биография */}
      <section>
        <h2>Биография</h2>
        {(['en', 'pl', 'ru', 'uk'] as const).map(lang => (
          <div key={lang}>
            <label>{lang.toUpperCase()}</label>
            <textarea
              name={`content_${lang}`}
              value={(form as Record<string, string>)[`content_${lang}`] ?? ''}
              onChange={handleChange}
              rows={6}
              placeholder={`Текст биографии (${lang})`}
            />
          </div>
        ))}
      </section>

      <button type="submit" disabled={saving}>
        {saving ? 'Сохраняем...' : 'Сохранить'}
      </button>
      {message && <p>{message}</p>}
    </form>
  )
}
```

> **API вызовы:**
> - `GET /api/admin/cms/about` — загрузить текущие данные
> - `PUT /api/admin/cms/about` — сохранить изменения
> - `GET /api/admin/cms/upload-url?folder=about&content_type=image/webp` — presigned URL для фото
>
> **Поля которые можно редактировать:**
> ```
> image_url
> title_en / title_pl / title_ru / title_uk
> content_en / content_pl / content_ru / content_uk
> ```

---

### Login page

```typescript
// app/login/page.tsx
'use client'
import { useState } from 'react'
import { adminLogin } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await adminLogin(password)
      // Сохранить токен и в cookie для middleware
      const token = localStorage.getItem('admin_token')!
      document.cookie = `admin_token=${token}; path=/; max-age=86400`
      router.push('/dashboard')
    } catch {
      setError('Неверный пароль')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Admin password"
      />
      <button type="submit">Войти</button>
      {error && <p>{error}</p>}
    </form>
  )
}
```

### Articles list + toggle publish

```typescript
// app/dashboard/articles/page.tsx
import { listArticles, updateArticle, deleteArticle } from '@/lib/cms'

export default async function ArticlesPage() {
  const articles = await listArticles()

  return (
    <ul>
      {articles.map(a => (
        <li key={a.id}>
          <span>{a.title_ru}</span>
          <span>{a.published ? '✅ Published' : '📝 Draft'}</span>
          <button onClick={() => updateArticle(a.id, { published: !a.published })}>
            Toggle
          </button>
          <button onClick={() => deleteArticle(a.id)}>
            Delete
          </button>
        </li>
      ))}
    </ul>
  )
}
```

### Image upload в форме

```typescript
// components/ImageUpload.tsx
'use client'
import { uploadImage } from '@/lib/cms'

export function ImageUpload({ onUpload }: { onUpload: (url: string) => void }) {
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file, 'gallery')
    onUpload(url)   // сохрани url в форму
  }

  return <input type="file" accept="image/*" onChange={handleFile} />
}
```

---

## 8. Все admin маршруты (справочник)

```
POST   /api/admin/auth/login              { password }

GET    /api/admin/cms/about
PUT    /api/admin/cms/about               { title_*, content_*, image_url }

GET    /api/admin/cms/expertise
POST   /api/admin/cms/expertise           { icon, title_*, order_index }
PUT    /api/admin/cms/expertise/:id
DELETE /api/admin/cms/expertise/:id

GET    /api/admin/cms/experience
POST   /api/admin/cms/experience          { restaurant, country, position, start_year, end_year, description_* }
PUT    /api/admin/cms/experience/:id
DELETE /api/admin/cms/experience/:id

GET    /api/admin/cms/gallery
POST   /api/admin/cms/gallery             { image_url, title_*, description_*, alt_*, order_index }
PUT    /api/admin/cms/gallery/:id
DELETE /api/admin/cms/gallery/:id

GET    /api/admin/cms/articles            — все (включая черновики)
GET    /api/admin/cms/articles/:id
POST   /api/admin/cms/articles            { slug?, title_en, content_*, seo_title, published }
PUT    /api/admin/cms/articles/:id
DELETE /api/admin/cms/articles/:id

GET    /api/admin/cms/article-categories
GET    /api/admin/cms/upload-url          ?folder=gallery&content_type=image/webp

GET    /api/admin/catalog/products
POST   /api/admin/catalog/products
PUT    /api/admin/catalog/products/:id
DELETE /api/admin/catalog/products/:id

GET    /api/admin/users
DELETE /api/admin/users/:id
GET    /api/admin/stats
```

---

## 10. Создание статей по категориям

### Категории — константа

```typescript
// lib/article-categories.ts
export const ARTICLE_CATEGORIES = [
  { value: '',            label: { ru: 'Все',          en: 'All' } },
  { value: 'techniques',  label: { ru: 'Техники',      en: 'Techniques' } },
  { value: 'ingredients', label: { ru: 'Ингредиенты',  en: 'Ingredients' } },
  { value: 'fish',        label: { ru: 'Рыба',         en: 'Fish' } },
  { value: 'sushi',       label: { ru: 'Суши',         en: 'Sushi' } },
  { value: 'recipes',     label: { ru: 'Рецепты',      en: 'Recipes' } },
  { value: 'equipment',   label: { ru: 'Оборудование', en: 'Equipment' } },
  { value: 'theory',      label: { ru: 'Теория',       en: 'Theory' } },
] as const

export type ArticleCategory = typeof ARTICLE_CATEGORIES[number]['value']
```

---

### TypeScript интерфейс

```typescript
// types/article.ts
export interface Article {
  id: string
  slug: string
  category: string          // "techniques" | "fish" | "sushi" | ...
  title_en: string
  title_pl: string
  title_ru: string
  title_uk: string
  content_en: string
  content_pl: string
  content_ru: string
  content_uk: string
  image_url: string | null
  seo_title: string
  seo_description: string
  published: boolean
  order_index: number
  created_at: string        // ISO 8601: "2026-03-10T13:33:54Z"
  updated_at: string
}
```

---

### Список статей с фильтром по категориям

```tsx
// app/admin/cms/articles/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { ARTICLE_CATEGORIES } from '@/lib/article-categories'
import type { Article } from '@/types/article'

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filterCategory, setFilterCategory] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(category = '') {
    setLoading(true)
    try {
      const qs = category ? `?category=${category}` : ''
      const data = await apiFetch<{ data: Article[] } | Article[]>(
        `/api/admin/cms/articles${qs}`
      )
      setArticles(Array.isArray(data) ? data : (data as any).data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(filterCategory) }, [filterCategory])

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Удалить "${title}"?`)) return
    await apiFetch(`/api/admin/cms/articles/${id}`, { method: 'DELETE' })
    load(filterCategory)
  }

  async function togglePublish(article: Article) {
    await apiFetch(`/api/admin/cms/articles/${article.id}`, {
      method: 'PUT',
      body: JSON.stringify({ published: !article.published }),
    })
    load(filterCategory)
  }

  const catLabel = (v: string) =>
    ARTICLE_CATEGORIES.find(c => c.value === v)?.label.ru ?? v || '—'

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Статьи</h1>
        <Link
          href="/admin/cms/articles/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Новая статья
        </Link>
      </div>

      {/* Фильтр по категории */}
      <div className="flex gap-2 flex-wrap">
        {ARTICLE_CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setFilterCategory(cat.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterCategory === cat.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label.ru}
          </button>
        ))}
      </div>

      {/* Таблица */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Загрузка...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600">Заголовок</th>
                <th className="text-left px-4 py-3 text-gray-600">Категория</th>
                <th className="text-left px-4 py-3 text-gray-600">Slug</th>
                <th className="text-center px-4 py-3 text-gray-600">Статус</th>
                <th className="text-right px-4 py-3 text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {articles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">Статей нет</td>
                </tr>
              ) : articles.map(article => (
                <tr key={article.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{article.title_ru || article.title_en}</div>
                    <div className="text-xs text-gray-400">{article.title_en}</div>
                  </td>
                  <td className="px-4 py-3">
                    {article.category ? (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        {catLabel(article.category)}
                      </span>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {article.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePublish(article)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        article.published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      {article.published ? '✅ Опубликовано' : '📝 Черновик'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/admin/cms/articles/${article.id}/edit`}
                        className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg"
                      >
                        ✏️ Ред.
                      </Link>
                      <button
                        onClick={() => handleDelete(article.id, article.title_ru || article.title_en)}
                        className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

---

### Форма создания статьи

```tsx
// app/admin/cms/articles/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { ARTICLE_CATEGORIES } from '@/lib/article-categories'

const LANGS = ['en', 'ru', 'pl', 'uk'] as const
type Lang = typeof LANGS[number]
const LANG_FLAGS: Record<Lang, string> = { en: '🇬🇧 EN', ru: '🇷🇺 RU', pl: '🇵🇱 PL', uk: '🇺🇦 UK' }

export default function NewArticlePage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('ru')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    slug: '', category: 'techniques',
    title_en: '', title_pl: '', title_ru: '', title_uk: '',
    content_en: '', content_pl: '', content_ru: '', content_uk: '',
    image_url: '',
    seo_title: '', seo_description: '',
    published: false, order_index: 0,
  })

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.title_en.trim()) { setError('Title EN обязателен'); return }
    setSaving(true); setError('')
    try {
      await apiFetch('/api/admin/cms/articles', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim() || undefined,
          image_url: form.image_url.trim() || null,
        }),
      })
      router.push('/admin/cms/articles')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Новая статья</h1>
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ← Назад
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* ─── Категория + Slug + Порядок ─── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Основные параметры</h2>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Категория</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          >
            {ARTICLE_CATEGORIES.filter(c => c.value !== '').map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.label.ru} ({cat.value})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Slug <span className="text-gray-400 font-normal">— авто из title EN если пусто</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={e => set('slug', e.target.value)}
              placeholder="knife-techniques"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Порядок</label>
            <input
              type="number"
              value={form.order_index}
              onChange={e => set('order_index', Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ─── Заголовок + Контент по языкам ─── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Заголовок и контент</h2>
          <div className="flex gap-1">
            {LANGS.map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  lang === l ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {LANG_FLAGS[l]}
              </button>
            ))}
          </div>
        </div>

        {LANGS.map(l => (
          <div key={l} className={lang === l ? 'block space-y-3' : 'hidden'}>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Заголовок {LANG_FLAGS[l]}
                {l === 'en' && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="text"
                value={(form as any)[`title_${l}`]}
                onChange={e => set(`title_${l}`, e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Контент {LANG_FLAGS[l]}
              </label>
              <textarea
                rows={10}
                value={(form as any)[`content_${l}`]}
                onChange={e => set(`content_${l}`, e.target.value)}
                placeholder="Текст статьи..."
                className="w-full border rounded-lg px-3 py-2 text-sm resize-y font-mono"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ─── SEO ─── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">SEO</h2>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            SEO Title <span className="text-gray-400 font-normal">(≤ 60 символов)</span>
          </label>
          <input
            type="text" maxLength={60}
            value={form.seo_title}
            onChange={e => set('seo_title', e.target.value)}
            placeholder="Japanese Knife Techniques | Chef Guide"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.seo_title.length}/60</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            SEO Description <span className="text-gray-400 font-normal">(≤ 160 символов)</span>
          </label>
          <textarea
            rows={2} maxLength={160}
            value={form.seo_description}
            onChange={e => set('seo_description', e.target.value)}
            placeholder="Master Japanese knife techniques..."
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.seo_description.length}/160</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Фото (URL)</label>
          <input
            type="text"
            value={form.image_url}
            onChange={e => set('image_url', e.target.value)}
            placeholder="https://pub-xxx.r2.dev/cms/articles/photo.jpg"
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      {/* ─── Публикация ─── */}
      <div className="bg-white rounded-xl border p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={form.published}
              onChange={e => set('published', e.target.checked)}
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${
              form.published ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              form.published ? 'translate-x-5' : ''
            }`} />
          </div>
          <span className="font-medium">
            {form.published ? '✅ Опубликовать сразу' : '📝 Сохранить как черновик'}
          </span>
        </label>
      </div>

      {/* ─── Кнопки ─── */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl"
        >
          {saving ? 'Сохранение...' : '💾 Сохранить статью'}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-3 border rounded-xl text-gray-600 hover:bg-gray-50"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}
```

---

### Структура файлов

```
app/admin/cms/articles/
├── page.tsx              ← список с фильтром по категориям
├── new/
│   └── page.tsx          ← форма создания
└── [id]/
    └── edit/
        └── page.tsx      ← форма редактирования (то же что new + useEffect)

lib/
└── article-categories.ts ← ARTICLE_CATEGORIES константа

types/
└── article.ts            ← TypeScript интерфейсы
```

---

### Публичный API — фильтр на фронтенд-блоге

```
GET /public/articles                              — все опубликованные
GET /public/articles?category=techniques          — по категории
GET /public/articles?category=fish                — только рыба
GET /public/articles?search=карп&category=ingredients
GET /public/articles?page=2&limit=10
```