// API helper functions
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export interface LoginResponse {
  token: string;
  expires_in: number;
}

export interface Product {
  id: string;
  name_en: string;
  name_pl?: string;
  name_uk?: string;
  name_ru?: string;
  category_id: string;
  price: string;
  unit: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProductRequest {
  // Universal input - NEW unified API format
  name_input?: string;
  
  // Optional legacy format fields
  name_en?: string;
  name_pl?: string;
  name_uk?: string;
  name_ru?: string;
  category_id?: string;
  unit?: "gram" | "kilogram" | "liter" | "milliliter" | "piece" | "bunch" | "can" | "bottle" | "package";
  description?: string;
  image_url?: string; // Added for image support
}

export interface Category {
  id: string;
  name: string;
  name_en?: string;
  name_pl?: string;
  name_uk?: string;
  name_ru?: string;
  sort_order?: number;
  icon?: string;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  restaurant_name: string;
  language: string;
  created_at: string;
}

export interface UsersListResponse {
  total: number;
  users: User[];
}

export interface AdminStats {
  total_users: number;
  total_restaurants: number;
}

// Auth
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

// Products
export async function getProducts(token: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/admin/products`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export async function getProduct(id: string, token: string): Promise<Product> {
  const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch product");
  return res.json();
}

export async function createProduct(
  token: string,
  data: CreateProductRequest
): Promise<Product> {
  // Support both new unified format and legacy format
  let cleanData: any = {};
  
  if (data.name_input) {
    // New unified API format
    cleanData = {
      name_input: data.name_input,
      description: data.description && data.description.trim() ? data.description : null,
      image_url: data.image_url || null,
    };
  } else {
    // Legacy format (for backward compatibility)
    cleanData = {
      name_en: data.name_en,
      category_id: data.category_id,
      unit: data.unit,
      name_pl: data.name_pl && data.name_pl.trim() ? data.name_pl : null,
      name_uk: data.name_uk && data.name_uk.trim() ? data.name_uk : null,
      name_ru: data.name_ru && data.name_ru.trim() ? data.name_ru : null,
      description: data.description && data.description.trim() ? data.description : null,
      image_url: data.image_url || null,
    };
  }

  const res = await fetch(`${API_URL}/api/admin/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanData),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create product: ${error}`);
  }
  return res.json();
}

export async function updateProduct(
  token: string,
  id: string,
  data: Partial<CreateProductRequest>
): Promise<Product> {
  const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) throw new Error("Failed to update product");
  return res.json();
}

export async function deleteProduct(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) throw new Error("Failed to delete product");
}

export async function uploadProductImage(
  token: string,
  productId: string,
  file: File
): Promise<{ image_url: string }> {
  console.log("🔍 Upload Image Debug:");
  console.log("  File name:", file.name);
  console.log("  File size:", file.size, "bytes", `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  console.log("  File type:", file.type);
  console.log("  Product ID:", productId);
  console.log("  Token:", token.substring(0, 20) + "...");
  
  const formData = new FormData();
  formData.append("image", file);  // Backend expects 'image' field (confirmed by curl test)
  
  console.log("  FormData keys:", Array.from(formData.keys()));
  console.log("  URL:", `${API_URL}/api/admin/products/${productId}/image`);
  
  const res = await fetch(`${API_URL}/api/admin/products/${productId}/image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  
  console.log("  Response status:", res.status, res.statusText);
  console.log("  Response headers:", Object.fromEntries(res.headers.entries()));
  
  if (!res.ok) {
    const error = await res.text();
    console.error("❌ Upload failed:", error);
    throw new Error(`Failed to upload image: ${error}`);
  }
  
  const result = await res.json();
  console.log("✅ Upload success:", result);
  return result;
}

export async function deleteProductImage(token: string, productId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/products/${productId}/image`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) throw new Error("Failed to delete image");
}

// Categories
export async function getCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/admin/categories`, {
    headers: { 
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data: CategoriesResponse = await res.json();
  return data.categories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// Users
export async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${API_URL}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function getUsers(token: string): Promise<UsersListResponse> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete user: ${error}`);
  }
}
