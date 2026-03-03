"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ModeToggle } from "@/components/mode-toggle";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Auto-fill credentials for development
  useEffect(() => {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    
    if (adminEmail && adminPassword) {
      setEmail(adminEmail);
      setPassword(adminPassword);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login(email, password);
      saveToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin() {
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    
    if (!adminEmail || !adminPassword) {
      setError("Quick login not configured");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await login(adminEmail, adminPassword);
      saveToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Вход в админ-панель</CardTitle>
          <CardDescription className="text-center">
            Введите ваши данные для доступа к панели управления
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? "Вход..." : "Войти"}
            </Button>

            {/* Quick Login Button for Development */}
            {process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      или
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleQuickLogin}
                  disabled={loading}
                >
                  🚀 Быстрый вход (Dev)
                </Button>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </form>

          {process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
            <Alert className="mt-4">
              <AlertDescription>
                <strong>💡 Режим разработки:</strong>
                <br />
                Данные для входа заполнены автоматически для быстрого тестирования!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
