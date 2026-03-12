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
  // Global names required for the catalog (Manual Mode)
  name_en?: string;
  name_pl?: string;
  name_uk?: string;
  name_ru?: string;
  
  // Magical Input (AI-First Mode)
  name_input?: string;
  
  category_id?: string;
  unit?: string;
  description?: string;
  image_url?: string;
  
  // Seasonal and allergens (optional)
  is_seasonal?: boolean;
  allergens?: string[];
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

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/admin/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Products
export async function getProducts(token: string): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch products");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.products || []);
}

export async function getProduct(id: string, token: string): Promise<Product> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch product");
  const data = await res.json();
  return data.product || data;
}

export async function createProduct(
  token: string,
  data: CreateProductRequest
): Promise<Product> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
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
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${id}`, {
    method: "PATCH",
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
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) throw new Error("Failed to delete product");
}

export async function uploadProductImage(
  token: string,
  productId: string,
  file: File | Blob
): Promise<{ image_url: string }> {
  try {
    // 1. Get presigned URL
    // Ensure we have a filename even if it's a blob
    const fileName = (file as File).name || `image-${Date.now()}.jpg`;
    const fileType = file.type || "image/jpeg";

    console.log("🔍 Getting presigned URL for:", { fileName, fileType });
    const data = await getProductImagePresignedUrl(
      token,
      productId,
      fileName,
      fileType
    );

    const { upload_url, public_url } = data;

    if (!upload_url) {
      console.error("❌ Backend response missing upload_url:", data);
      throw new Error("Invalid response from server: upload_url is missing");
    }

    // 2. Upload directly to storage (R2) from front
    console.log("🎨 Uploading to R2 storage...", { 
      originalType: fileType, 
      size: `${(file.size / 1024).toFixed(2)} KB`
    });

    // Smart Content-Type detection from Presigned URL
    // If signature expects webp (common for optimized backends), we must match it
    let effectiveContentType = fileType;
    if (upload_url.includes(".webp")) effectiveContentType = "image/webp";
    else if (upload_url.includes(".png")) effectiveContentType = "image/png";
    else if (upload_url.includes(".jpg") || upload_url.includes(".jpeg")) effectiveContentType = "image/jpeg";
    
    console.log("📝 Using Content-Type for signature:", effectiveContentType);

    // Wrap file in a Blob with the correct type so the browser sends it
    // without triggering a CORS preflight (avoids OPTIONS → R2 rejection)
    const uploadBlob = new Blob([file], { type: effectiveContentType });

    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      body: uploadBlob,
      // No explicit Content-Type header — the Blob type is used automatically
      // This prevents a CORS preflight that R2 presigned URLs don't support
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text().catch(() => "Could not read error body");
      console.error("❌ R2 Upload failed:", uploadRes.status, errorText);
      throw new Error(`Storage upload failed with status ${uploadRes.status}`);
    }

    // 3. Save URL to backend
    console.log("🔗 Saving image URL to backend:", public_url);
    await updateProduct(token, productId, { image_url: public_url });

    return { image_url: public_url };
  } catch (error) {
    console.error("❌ Professional upload flow failed:", error);
    throw error;
  }
}

export async function deleteProductImage(token: string, productId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${productId}/image`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) throw new Error("Failed to delete image");
}

export async function getProductImagePresignedUrl(
  token: string,
  productId: string,
  fileName: string,
  fileType: string
): Promise<{ upload_url: string; public_url: string }> {
  const res = await fetch(`${API_URL}/api/admin/catalog/products/${productId}/image-url?filename=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(fileType)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) throw new Error("Failed to get presigned URL");
  return res.json();
}

// Categories
export async function getCategories(token: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/admin/catalog/categories`, {
    headers: { 
      "Authorization": `Bearer ${token}`
    },
    cache: "no-store",
  });
  
  if (!res.ok) throw new Error("Failed to fetch categories");
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.categories || []);
  return list.sort((a: Category, b: Category) => (a.sort_order || 0) - (b.sort_order || 0));
}

export async function createCategory(token: string, category: Partial<Category>): Promise<Category> {
  const res = await fetch(`${API_URL}/api/admin/catalog/categories`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });

  if (!res.ok) throw new Error("Failed to create category");
  return res.json();
}

export async function updateCategory(token: string, id: string, category: Partial<Category>): Promise<Category> {
  const res = await fetch(`${API_URL}/api/admin/catalog/categories/${id}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });

  if (!res.ok) throw new Error("Failed to update category");
  return res.json();
}

export async function deleteCategory(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/catalog/categories/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) throw new Error("Failed to delete category");
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
  const data = await res.json();
  if (Array.isArray(data)) {
    return { users: data, total: data.length };
  }
  return {
    users: data.users || [],
    total: data.total || (data.users?.length || 0)
  };
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
