"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  type Category 
} from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Plus, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Loader2, 
  Layers,
  ChevronUp,
  ChevronDown,
  Globe
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<Partial<Category>>({
    name_en: "",
    name_pl: "",
    name_uk: "",
    name_ru: "",
    sort_order: 0,
    icon: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const data = await getCategories(token);
      setCategories(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        toast.error("Не удалось загрузить категории");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const token = getToken();
    if (!token) return;

    try {
      setSubmitting(true);
      await createCategory(token, formData);
      toast.success("Категория создана");
      setIsCreateOpen(false);
      resetForm();
      loadCategories();
    } catch (err) {
      toast.error("Ошибка при создании категории");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    if (!selectedCategory) return;
    const token = getToken();
    if (!token) return;

    try {
      setSubmitting(true);
      await updateCategory(token, selectedCategory.id, formData);
      toast.success("Категория обновлена");
      setIsEditOpen(false);
      resetForm();
      loadCategories();
    } catch (err) {
      toast.error("Ошибка при обновлении категории");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;
    const token = getToken();
    if (!token) return;

    try {
      setSubmitting(true);
      await deleteCategory(token, selectedCategory.id);
      toast.success("Категория удалена");
      setIsDeleteOpen(false);
      loadCategories();
    } catch (err) {
      toast.error("Ошибка при удалении категории");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormData({
      name_en: "",
      name_pl: "",
      name_uk: "",
      name_ru: "",
      sort_order: 0,
      icon: ""
    });
    setSelectedCategory(null);
  }

  function openEdit(category: Category) {
    setSelectedCategory(category);
    setFormData({
      name_en: category.name_en || "",
      name_pl: category.name_pl || "",
      name_uk: category.name_uk || "",
      name_ru: category.name_ru || "",
      sort_order: category.sort_order || 0,
      icon: category.icon || ""
    });
    setIsEditOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Категории</h1>
          <p className="text-muted-foreground text-sm">
            Управление категориями товаров в каталоге
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="lg" className="h-12 px-6 shadow-sm">
              <Plus className="mr-2 h-5 w-5" />
              Добавить категорию
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Новая категория</DialogTitle>
              <DialogDescription>
                Создайте новую категорию для товаров. Названия на всех языках обязательны.
              </DialogDescription>
            </DialogHeader>
            <CategoryForm 
              formData={formData} 
              setFormData={setFormData}
              submitting={submitting}
              onSubmit={handleCreate}
              resetForm={resetForm}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground animate-pulse text-lg">Загрузка категорий...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Layers className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-semibold mb-2">Нет категорий</h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                Вы еще не создали ни одной категории. Добавьте первую категорию, чтобы начать наполнение каталога.
              </p>
              <Button size="lg" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-5 w-5" />
                Создать первую категорию
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="w-[80px] font-bold">Иконка</TableHead>
                    <TableHead className="font-bold">Название (RU • UK • PL • EN)</TableHead>
                    <TableHead className="w-[100px] font-bold text-center">Вес / №</TableHead>
                    <TableHead className="w-[80px] text-right font-bold"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} className="group transition-colors h-16">
                      <TableCell>
                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-xl border border-primary/10 shadow-sm">
                          {category.icon || "📦"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <p className="font-bold text-sm leading-tight mb-1">
                            {category.name_ru || category.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            <span>{category.name_uk || "—"}</span>
                            <span className="text-muted-foreground/30 text-[8px]">•</span>
                            <span>{category.name_pl || "—"}</span>
                            <span className="text-muted-foreground/30 text-[8px]">•</span>
                            <span>{category.name_en || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {category.sort_order || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openEdit(category)} className="cursor-pointer">
                              <Pencil className="mr-2 h-4 w-4" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => {
                                setSelectedCategory(category);
                                setIsDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактирование категории</DialogTitle>
            <DialogDescription>
              Измените информацию о категории. Все поля обязательны.
            </DialogDescription>
          </DialogHeader>
          <CategoryForm 
            formData={formData} 
            setFormData={setFormData}
            submitting={submitting}
            onSubmit={handleUpdate}
            resetForm={resetForm}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Подтвердите удаление
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Вы уверены, что хотите удалить категорию <strong className="text-foreground">"{selectedCategory?.name_ru || selectedCategory?.name}"</strong>? 
              <br /><br />
              Внимание: Товары в этой категории останутся без категории или будут скрыты из каталога.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={submitting}
              className="px-6"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              className="px-6 shadow-sm shadow-destructive/20"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Удалить категорию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ 
  formData, 
  setFormData, 
  submitting, 
  onSubmit, 
  resetForm,
  isEdit = false 
}: { 
  formData: Partial<Category>, 
  setFormData: (data: Partial<Category>) => void,
  submitting: boolean,
  onSubmit: () => void,
  resetForm: () => void,
  isEdit?: boolean
}) {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-2">
          <Label htmlFor="name_ru" className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded border">RU</span>
            Название (Русский)
          </Label>
          <Input
            id="name_ru"
            value={formData.name_ru}
            onChange={(e) => setFormData({ ...formData, name_ru: e.target.value })}
            placeholder="Овощи"
            disabled={submitting}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_uk" className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded border border-yellow-200">UK</span>
            Назва (Українська)
          </Label>
          <Input
            id="name_uk"
            value={formData.name_uk}
            onChange={(e) => setFormData({ ...formData, name_uk: e.target.value })}
            placeholder="Овочі"
            disabled={submitting}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_pl" className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded border border-red-200">PL</span>
            Nazwa (Polski)
          </Label>
          <Input
            id="name_pl"
            value={formData.name_pl}
            onChange={(e) => setFormData({ ...formData, name_pl: e.target.value })}
            placeholder="Warzywa"
            disabled={submitting}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name_en" className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200">EN</span>
            Name (English)
          </Label>
          <Input
            id="name_en"
            value={formData.name_en}
            onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            placeholder="Vegetables"
            disabled={submitting}
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-2">
        <div className="space-y-2">
          <Label htmlFor="icon">Иконка (Emoji)</Label>
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="🥦"
            disabled={submitting}
            className="h-10 text-xl text-center w-24"
          />
          <p className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded">
            Используйте стандартные Emoji или Lucide иконки (только текст)
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sort_order">Порядок сортировки</Label>
          <Input
            id="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
            disabled={submitting}
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded">
            Чем меньше число, тем выше категория в списке
          </p>
        </div>
      </div>

      <DialogFooter className="pt-6 border-t">
        <Button variant="ghost" onClick={() => resetForm()} disabled={submitting}>
          Очистить
        </Button>
        <Button onClick={onSubmit} disabled={submitting} size="lg" className="px-8 shadow-sm">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {isEdit ? "Сохранить изменения" : "Создать категорию"}
        </Button>
      </DialogFooter>
    </div>
  );
}


