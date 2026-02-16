"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUsers, getAdminStats, deleteUser, type User, type UsersListResponse, type AdminStats } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Users, Building2, ArrowLeft, Search, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const token = getToken();
    
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        getUsers(token),
        getAdminStats(token)
      ]);
      setUsers(usersData.users);
      setStats(statsData);
      setError("");
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy, HH:mm", { locale: ru });
    } catch {
      return dateString;
    }
  };

  const getLanguageFlag = (lang: string) => {
    const flags: Record<string, string> = {
      'ru': '🇷🇺',
      'en': '🇬🇧',
      'pl': '🇵🇱',
      'uk': '🇺🇦'
    };
    return flags[lang] || '🌐';
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.restaurant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
    setError("");
    setSuccessMessage("");
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await deleteUser(token, userToDelete.id);
      
      // Update local state
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
      
      // Update statistics
      if (stats) {
        setStats({
          ...stats,
          total_users: stats.total_users - 1,
        });
      }
      
      setSuccessMessage(`Пользователь ${userToDelete.email} успешно удален`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        clearToken();
        router.push("/login");
      } else {
        setError(err instanceof Error ? err.message : "Не удалось удалить пользователя");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Пользователи</h1>
          <p className="text-muted-foreground mt-2">
            Управление зарегистрированными пользователями
          </p>
        </div>
        <Link href="/products">
          <Button variant="outline" size="lg">
            <ArrowLeft className="mr-2 h-5 w-5" />
            К продуктам
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="mb-6 border-green-500 text-green-700 bg-green-50">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Всего пользователей
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_users}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Зарегистрированных аккаунтов
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Всего ресторанов
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_restaurants}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Активных заведений
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск по email, имени или ресторану..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Список пользователей</CardTitle>
          <CardDescription>
            Всего найдено: {filteredUsers.length} из {users.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Имя</th>
                  <th className="pb-3 font-semibold">Ресторан</th>
                  <th className="pb-3 font-semibold">Язык</th>
                  <th className="pb-3 font-semibold">Дата регистрации</th>
                  <th className="pb-3 font-semibold text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {searchTerm ? "Ничего не найдено" : "Нет пользователей"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-4 font-medium">{user.email}</td>
                      <td className="py-4">
                        {user.name || <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="py-4">{user.restaurant_name}</td>
                      <td className="py-4">
                        <Badge variant="secondary" className="font-mono">
                          {getLanguageFlag(user.language)} {user.language.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-4 text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(user)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Подтверждение удаления
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-4">
                <p className="font-semibold text-foreground">
                  Вы действительно хотите удалить пользователя?
                </p>
                {userToDelete && (
                  <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                    <p><strong>Email:</strong> {userToDelete.email}</p>
                    <p><strong>Ресторан:</strong> {userToDelete.restaurant_name}</p>
                    {userToDelete.name && <p><strong>Имя:</strong> {userToDelete.name}</p>}
                  </div>
                )}
                <p className="text-destructive font-medium">
                  ⚠️ Внимание! Это действие необратимо!
                </p>
                <p className="text-sm">
                  Будут удалены все данные пользователя:
                </p>
                <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Продукты и рецепты</li>
                  <li>Блюда и статистика продаж</li>
                  <li>История ассистента</li>
                  <li>Все связанные данные</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить пользователя
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
