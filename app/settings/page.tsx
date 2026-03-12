'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getToken, clearToken } from '@/lib/auth';
import {
  Bell,
  Lock,
  Globe,
  Shield,
  Save,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Palette,
  Check,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

// ── Settings stored in localStorage ──────────────────────────────────────────
interface AppSettings {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  twoFactor: boolean;
  notifyErrors: boolean;
  notifyNewUsers: boolean;
  notifyBackups: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  platformName: 'Nexus Admin',
  supportEmail: 'support@fodi.app',
  maintenanceMode: false,
  twoFactor: false,
  notifyErrors: true,
  notifyNewUsers: false,
  notifyBackups: true,
};

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem('admin_settings');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem('admin_settings', JSON.stringify(s));
}

type Msg = { type: 'ok' | 'err'; text: string } | null;

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);

  // Security tab
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    setSettings(loadSettings());
  }, [router]);

  function handleChange<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSaveGeneral() {
    setSaving(true);
    setMsg(null);
    setTimeout(() => {
      saveSettings(settings);
      setMsg({ type: 'ok', text: '✅ Общие настройки сохранены!' });
      setSaving(false);
    }, 400);
  }

  function handleSaveNotifications() {
    setSaving(true);
    setMsg(null);
    setTimeout(() => {
      saveSettings(settings);
      setMsg({ type: 'ok', text: '✅ Предпочтения уведомлений сохранены!' });
      setSaving(false);
    }, 400);
  }

  function handleSaveSecurity() {
    setMsg(null);
    if (!newPassword) {
      setMsg({ type: 'err', text: '❌ Введите новый пароль' });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: 'err', text: '❌ Пароль должен быть не менее 6 символов' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'err', text: '❌ Пароли не совпадают' });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      saveSettings(settings);
      setNewPassword('');
      setConfirmPassword('');
      setMsg({ type: 'ok', text: '✅ Безопасность обновлена!' });
      setSaving(false);
    }, 400);
  }

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  const THEMES = [
    { key: 'light', label: 'Светлая', icon: Sun, desc: 'Белый фон, тёмный текст' },
    { key: 'dark', label: 'Тёмная', icon: Moon, desc: 'Тёмный фон, светлый текст' },
    { key: 'system', label: 'Системная', icon: Monitor, desc: 'Следует настройке macOS' },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="h-1 w-8 bg-primary rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Конфигурация</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter">Настройки</h1>
            <p className="text-muted-foreground max-w-xl">
              Управление конфигурацией платформы, оформлением и безопасностью.
            </p>
          </div>
          <Button variant="destructive" className="rounded-xl gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Выйти
          </Button>
        </div>
      </div>

      {msg && (
        <Alert
          variant={msg.type === 'err' ? 'destructive' : 'default'}
          className={msg.type === 'ok' ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/20 dark:text-green-400' : ''}
        >
          <AlertDescription>{msg.text}</AlertDescription>
        </Alert>
      )}

      {/* ── Theme Selector ─────────────────────────────────────────────────── */}
      <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-5">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Оформление</h2>
        </div>
        <p className="text-sm text-muted-foreground">Выберите тему оформления панели</p>

        {mounted && (
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map(({ key, label, icon: Icon, desc }) => {
              const isActive = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`group relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                      : 'border-border/40 hover:border-primary/40 hover:bg-muted/30'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-primary'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-semibold ${isActive ? 'text-primary' : ''}`}>{label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {mounted && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${resolvedTheme === 'dark' ? 'bg-indigo-400' : 'bg-amber-400'}`} />
            Текущая тема: <span className="font-semibold text-foreground">{resolvedTheme === 'dark' ? 'Тёмная' : 'Светлая'}</span>
          </div>
        )}
      </section>

      {/* ── Tabs: General / Security / Notifications ───────────────────────── */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="glass rounded-xl p-1">
          <TabsTrigger value="general" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Globe className="h-4 w-4" /> Глобальные
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Lock className="h-4 w-4" /> Безопасность
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Bell className="h-4 w-4" /> Уведомления
          </TabsTrigger>
        </TabsList>

        {/* ── General ──────────────────────────────────────────────────────── */}
        <TabsContent value="general">
          <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-bold">Общие настройки</h3>
              <p className="text-sm text-muted-foreground">Настройка основных параметров системы</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Название платформы
                </Label>
                <Input
                  value={settings.platformName}
                  onChange={(e) => handleChange('platformName', e.target.value)}
                  className="rounded-xl"
                  placeholder="Nexus Admin"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Контактный email поддержки
                </Label>
                <Input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="rounded-xl"
                  placeholder="support@example.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/30 bg-muted/10">
              <div className="space-y-0.5">
                <Label className="font-semibold">Режим обслуживания</Label>
                <p className="text-sm text-muted-foreground">
                  Закрыть доступ к системе для всех, кроме администраторов
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(v) => handleChange('maintenanceMode', v)}
              />
            </div>

            {settings.maintenanceMode && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>
                  ⚠️ Режим обслуживания активен — обычные пользователи не смогут войти.
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={handleSaveGeneral} disabled={saving} className="h-11 px-8 rounded-xl font-semibold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
          </section>
        </TabsContent>

        {/* ── Security ─────────────────────────────────────────────────────── */}
        <TabsContent value="security">
          <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-bold">Безопасность</h3>
              <p className="text-sm text-muted-foreground">Управление паролями и доступами</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Новый пароль
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl pl-10 pr-10"
                    placeholder="Минимум 6 символов"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Подтверждение пароля
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl pl-10"
                    placeholder="Повторите пароль"
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Пароли не совпадают</p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Пароли совпадают
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-border/30 bg-muted/10">
              <div className="space-y-0.5">
                <Label className="font-semibold">Двухфакторная аутентификация</Label>
                <p className="text-sm text-muted-foreground">Повысьте безопасность вашего аккаунта</p>
              </div>
              <Switch
                checked={settings.twoFactor}
                onCheckedChange={(v) => handleChange('twoFactor', v)}
              />
            </div>

            <Button onClick={handleSaveSecurity} disabled={saving} className="h-11 px-8 rounded-xl font-semibold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {saving ? 'Сохранение...' : 'Обновить безопасность'}
            </Button>
          </section>
        </TabsContent>

        {/* ── Notifications ────────────────────────────────────────────────── */}
        <TabsContent value="notifications">
          <section className="glass rounded-2xl p-6 ring-1 ring-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-bold">Уведомления</h3>
              <p className="text-sm text-muted-foreground">Настройка системных оповещений</p>
            </div>

            <div className="space-y-1">
              {([
                { key: 'notifyErrors' as const, label: 'Email об ошибках системы', desc: 'Получайте уведомления о критических ошибках сервера' },
                { key: 'notifyNewUsers' as const, label: 'Отчёты о новых пользователях', desc: 'Уведомление при регистрации нового пользователя' },
                { key: 'notifyBackups' as const, label: 'Автоматические бэкапы', desc: 'Уведомления о статусе автоматических бэкапов' },
              ]).map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-0.5">
                    <Label className="font-semibold">{label}</Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(v) => handleChange(key, v)}
                  />
                </div>
              ))}
            </div>

            <Button onClick={handleSaveNotifications} disabled={saving} className="h-11 px-8 rounded-xl font-semibold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Сохранение...' : 'Сохранить предпочтения'}
            </Button>
          </section>
        </TabsContent>
      </Tabs>

      {/* ── App Info ───────────────────────────────────────────────────────── */}
      <section className="glass rounded-2xl p-5 ring-1 ring-white/10">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Nexus Admin <Badge variant="outline" className="text-[10px] ml-1">v1.0.0</Badge></span>
            <span>Next.js 16</span>
            <span>Tailwind CSS 4</span>
          </div>
          <span>© {new Date().getFullYear()} Fodi</span>
        </div>
      </section>
    </div>
  );
}
