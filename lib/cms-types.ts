// lib/cms-types.ts — CMS TypeScript types

export interface About {
  id: string;
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  content_en: string;
  content_pl: string;
  content_ru: string;
  content_uk: string;
  image_url?: string;
  updated_at: string;
}

export interface Expertise {
  id: string;
  icon: string;
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  restaurant: string;
  country: string;
  position: string;
  start_year?: number;
  end_year?: number; // null = "по сей день"
  description_en: string;
  description_pl: string;
  description_ru: string;
  description_uk: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Gallery {
  id: string;
  image_url: string;
  slug: string;
  status: string;
  category_id?: string | null;
  category_slug?: string | null;   // из JOIN, только для чтения
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  description_en: string;
  description_pl: string;
  description_ru: string;
  description_uk: string;
  alt_en: string;
  alt_pl: string;
  alt_ru: string;
  alt_uk: string;
  order_index: number;
  instagram_url?: string | null;
  pinterest_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  website_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GalleryCategory {
  id: string;
  slug: string;
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  slug: string;
  category: string;
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  content_en: string;
  content_pl: string;
  content_ru: string;
  content_uk: string;
  image_url?: string;
  seo_title: string;
  seo_description: string;
  published: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleCategory {
  id: string;
  slug: string;
  title_en: string;
  title_pl: string;
  title_ru: string;
  title_uk: string;
  order_index: number;
  created_at: string;
}
