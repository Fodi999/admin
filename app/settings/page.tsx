"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Bell, Lock, Globe, Shield, Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const handleSave = () => {
    toast.success("Настройки успешно сохранены");
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Настройки</h1>
        <p className="text-muted-foreground text-lg">
          Управление конфигурацией платформы и безопасностью
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="general" className="rounded-lg gap-2">
            <Globe className="h-4 w-4" /> Глобальные
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg gap-2">
            <Lock className="h-4 w-4" /> Безопасность
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg gap-2">
            <Bell className="h-4 w-4" /> Уведомления
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Общие настройки</CardTitle>
              <CardDescription>
                Настройка основных параметров системы
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Название платформы</Label>
                <Input defaultValue="Admin Panel" />
              </div>
              <div className="space-y-2">
                <Label>Контактный email поддержки</Label>
                <Input defaultValue="support@example.com" />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Режим обслуживания</Label>
                  <p className="text-sm text-muted-foreground">Закрыть доступ к системе для всех, кроме администраторов</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} className="gap-2">
                <Save className="h-4 w-4" /> Сохранить изменения
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Безопасность</CardTitle>
              <CardDescription>
                Управление паролями и доступами
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Новый пароль администратора</Label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <Label>Подтвердите пароль</Label>
                <Input type="password" />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
                <div className="space-y-0.5">
                  <Label>Двухфакторная аутентификация</Label>
                  <p className="text-sm text-muted-foreground">Повысьте безопасность вашего аккаунта</p>
                </div>
                <Switch />
              </div>
              <Button onClick={handleSave} className="gap-2">
                <Shield className="h-4 w-4" /> Обновить безопасность
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Уведомления</CardTitle>
              <CardDescription>
                Настройка системных оповещений
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <Label>Email об ошибках системы</Label>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Отчеты о новых пользователях</Label>
                <Switch />
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Автоматические бэкапы</Label>
                <Switch defaultChecked />
              </div>
              <Button onClick={handleSave} className="gap-2 mt-4">
                <Save className="h-4 w-4" /> Сохранить предпочтения
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
