# 第3课：样式与组件库（Tailwind CSS + shadcn/ui）

## 学习目标
- 掌握 Tailwind CSS v4 的新特性和配置方式
- 理解 CSS 变量与主题定制的工作原理
- 掌握 shadcn/ui 组件库的安装、配置和使用
- 学会常用组件（Button、Card、Form 等）的定制与组合
- 掌握响应式设计与移动端适配技巧
- 理解项目中的样式体系架构

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

## Tailwind CSS v4 深度解析

### Tailwind CSS v4 新特性
Tailwind CSS v4 带来了革命性的变化，采用了全新的引擎和语法：

#### 1. 基于 Rust 的 Oxide 引擎
- **极速编译**：使用 Rust 编写的新引擎，编译速度提升 10 倍以上
- **即时热更新**：开发时几乎没有延迟
- **更小的输出**：优化后的 CSS 输出更精简

#### 2. CSS-first 配置
Tailwind v4 采用了 CSS-first 的配置方式，不再需要 `tailwind.config.js`：

**传统 v3 配置** (`tailwind.config.js`)：
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
      }
    }
  }
}
```

**v4 配置** (`globals.css`)：
```css
@import "tailwindcss";

@theme inline {
  --color-primary: #3b82f6;
  --font-sans: var(--font-inter);
}
```

#### 3. 新的 @theme 指令
使用 `@theme` 定义设计令牌：

```css
@theme inline {
  /* 颜色 */
  --color-primary: oklch(0.5 0.2 250);
  --color-secondary: oklch(0.7 0.15 180);

  /* 字体 */
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);

  /* 圆角 */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

#### 4. @custom-variant 自定义变体
创建自定义变体更加简洁：

```css
/* 暗色模式变体 */
@custom-variant dark (&:is(.dark *));

/* 自定义交互变体 */
@custom-variant hover-active (&:hover:active);
```

### 项目中的 Tailwind 配置解析

Resonance 项目使用 Tailwind CSS v4，配置在 `src/app/globals.css` 中：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --font-sans: var(--font-inter);
    --font-mono: var(--font-geist-mono);

    /* 组件颜色 */
    --color-card: var(--card);
    --color-popover: var(--popover);
    --color-primary: var(--primary);
    --color-secondary: var(--secondary);
    --color-muted: var(--muted);
    --color-accent: var(--accent);
    --color-destructive: var(--destructive);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-ring: var(--ring);

    /* 圆角系统 */
    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
}
```

### @layer 基础层
Tailwind v4 的 `@layer base` 定义全局基础样式：

```css
@layer base {
    * {
        @apply border-border outline-ring/50;
    }
    body {
        @apply bg-background text-foreground;
    }
    button:not(:disabled),
    [role="button"]:not(:disabled) {
        cursor: pointer;
    }
}
```

## CSS 变量与主题定制

### oklch 颜色空间
Resonance 项目使用 `oklch` 颜色空间定义颜色，这是现代 CSS 的最佳实践：

**为什么选择 oklch？**
1. **感知均匀**：颜色变化更符合人眼感知
2. **更好的渐变**：渐变过渡更自然
3. **一致性**：亮度和色度分离，便于主题变体

### 亮色主题变量

```css
:root {
    --radius: 0.75rem;

    /* 基础颜色 */
    --background: oklch(1 0 0);        /* 纯白 */
    --foreground: oklch(0.165 0 0);    /* 深灰 */

    /* 卡片和弹出层 */
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.165 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.165 0 0);

    /* 主要操作色 */
    --primary: oklch(0.165 0 0);       /* 黑色按钮 */
    --primary-foreground: oklch(1 0 0); /* 白色文字 */

    /* 次要元素 */
    --secondary: oklch(0.882 0 0);
    --secondary-foreground: oklch(0.165 0 0);

    /* 静音/禁用状态 */
    --muted: oklch(0.962 0 0);
    --muted-foreground: oklch(0.601 0 0);

    /* 强调/悬停 */
    --accent: oklch(0.962 0 0);
    --accent-foreground: oklch(0.165 0 0);

    /* 危险操作 */
    --destructive: oklch(0.502 0.176 26); /* 红色 */

    /* 边框和输入框 */
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.686 0 0);
}
```

### 暗色主题变量

```css
.dark {
    --background: oklch(0.145 0 0);    /* 深灰背景 */
    --foreground: oklch(0.985 0 0);    /* 白色文字 */

    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);

    --primary: oklch(0.922 0 0);       /* 浅色按钮 */
    --primary-foreground: oklch(0.205 0 0);

    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);      /* 半透明白色 */
    --input: oklch(1 0 0 / 15%);
}
```

### 主题切换实现

使用 `next-themes` 实现主题切换：

```tsx
// 提供者组件
import { ThemeProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}

// 切换按钮
import { useTheme } from "next-themes";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
```

## shadcn/ui 组件库深度解析

### 什么是 shadcn/ui？
shadcn/ui 不是一个传统的 npm 包，而是一个**组件集合**：
- **复制粘贴**：组件代码直接复制到项目中
- **完全可定制**：代码在你手中，随意修改
- **基于 Radix UI**：无障碍访问和键盘导航
- **Tailwind CSS**：样式使用 Tailwind 类名

### 项目配置（components.json）

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",           // 样式风格
  "rsc": true,                   // 支持 React Server Components
  "tsx": true,                   // 使用 TypeScript
  "tailwind": {
    "config": "",                // Tailwind 配置文件（v4 不需要）
    "css": "src/app/globals.css", // CSS 文件路径
    "baseColor": "neutral",      // 基础颜色
    "cssVariables": true         // 使用 CSS 变量
  },
  "iconLibrary": "lucide",       // 图标库
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 核心工具函数

**`cn` 函数** (`src/lib/utils.ts`)：
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**工作原理**：
1. `clsx`：条件性地拼接类名
2. `twMerge`：智能合并 Tailwind 类名，处理冲突

**使用示例**：
```tsx
// 条件类名
cn("base-class", condition && "conditional-class")

// 类名冲突处理
cn("p-4", "p-8")  // 结果: "p-8"（后者覆盖前者）

// 复杂组合
cn(
  "flex items-center gap-2",
  isActive && "bg-accent",
  className
)
```

## 常用组件详解

### 1. Button 组件

**源码分析** (`src/components/ui/button.tsx`)：
```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // 基础样式
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background shadow-xs hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

**使用示例**：
```tsx
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// 基础按钮
<Button>Click me</Button>

// 变体
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>

// 尺寸
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Plus /></Button>

// 组合使用
<Button variant="outline" size="lg" className="w-full">
  Large Outline Button
</Button>

// asChild 模式（渲染为其他元素）
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>
```

### 2. Card 组件

**使用示例**：
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
    <CardAction>
      <Button variant="ghost" size="icon">
        <MoreVertical />
      </Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### 3. Form 组件

**配合 React Hook Form 和 Zod 使用**：
```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
});

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter username" {...field} />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### 4. Dialog 组件

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button variant="outline">Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      <p>Dialog content here</p>
    </div>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## 响应式设计与移动端适配

### Tailwind 响应式断点

| 断点 | 最小宽度 | 常见设备 |
|------|---------|---------|
| `sm` | 640px | 大手机 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 笔记本 |
| `xl` | 1280px | 桌面显示器 |
| `2xl` | 1536px | 大显示器 |

### 移动优先设计

```tsx
// 从小屏幕开始设计，逐步添加大屏幕样式
<div className="
  flex flex-col          // 移动端：垂直布局
  md:flex-row            // 平板及以上：水平布局
  lg:items-center        // 笔记本：居中对齐
  xl:gap-8               // 桌面：更大间距
">
  <div className="
    text-sm              // 移动端：小字体
    lg:text-base         // 笔记本：正常字体
    xl:text-lg           // 桌面：大字体
  ">
    Responsive Text
  </div>
</div>
```

### 项目中的响应式示例

**Dashboard Header**：
```tsx
<div className="flex items-start justify-between">
  <div className="space-y-1">
    <h1 className="text-2xl lg:text-3xl font-semibold">
      Welcome back
    </h1>
  </div>

  {/* 移动端隐藏，桌面端显示 */}
  <div className="lg:flex items-center gap-3 hidden">
    <Button variant="outline" size="sm">
      <ThumbsUp />
      <span className="hidden lg:block">Feedback</span>
    </Button>
  </div>
</div>
```

### 移动端适配技巧

#### 1. 使用 Sheet 组件代替 Dialog
```tsx
// 桌面端使用 Dialog，移动端使用 Sheet
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="lg:hidden">
      <Menu />
    </Button>
  </SheetTrigger>
  <SheetContent side="left">
    {/* 移动端菜单内容 */}
  </SheetContent>
</Sheet>
```

#### 2. 响应式网格布局
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id}>
      {/* 卡片内容 */}
    </Card>
  ))}
</div>
```

#### 3. 触摸友好间距
```tsx
// 确保触摸目标至少 44x44px
<Button size="icon" className="size-11">
  <Plus className="size-5" />
</Button>
```

## 项目样式体系分析

### 样式架构总览

```
src/
├── app/
│   └── globals.css           # 全局样式、主题变量
├── components/
│   └── ui/                   # shadcn/ui 组件
│       ├── button.tsx
│       ├── card.tsx
│       ├── form.tsx
│       └── ...
├── lib/
│   └── utils.ts              # cn() 工具函数
└── features/
    └── [feature]/
        └── components/       # 功能特定组件样式
```

### 样式复用模式

**1. 使用 cn() 组合样式**：
```tsx
function CustomCard({ className, ...props }) {
  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-shadow",
        className
      )}
      {...props}
    />
  );
}
```

**2. 使用 Tailwind 的 @apply**：
```css
.custom-button {
  @apply inline-flex items-center justify-center rounded-md px-4 py-2;
  @apply bg-primary text-primary-foreground;
  @apply hover:bg-primary/90;
}
```

**3. 使用 CSS 变量**：
```tsx
<div style={{ "--custom-color": "oklch(0.5 0.2 250)" }}>
  <button className="bg-[var(--custom-color)]">
    Custom Color Button
  </button>
</div>
```

## 实践任务

### 任务目标
使用 shadcn/ui 组件构建一个用户设置表单页面，包含主题切换、个人信息编辑和通知设置。

### 具体步骤

#### 步骤 1：创建设置页面目录
```bash
mkdir -p src/app/\(dashboard\)/settings
```

#### 步骤 2：创建设置页面组件
**`src/app/(dashboard)/settings/page.tsx`**：
```tsx
import { SettingsView } from "./settings-view";

export default function SettingsPage() {
  return <SettingsView />;
}
```

#### 步骤 3：创建设置视图组件
**`src/app/(dashboard)/settings/settings-view.tsx`**：
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export function SettingsView() {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    marketing: false,
  });

  const handleSave = () => {
    console.log({ name, email, notifications, theme });
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      {/* 主题设置 */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose your preferred color theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              onClick={() => setTheme("system")}
            >
              <Monitor className="mr-2 h-4 w-4" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 个人信息 */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your personal details here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose what notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email about your account activity.
              </p>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, email: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications on your device.
              </p>
            </div>
            <Switch
              checked={notifications.push}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, push: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive emails about new features and updates.
              </p>
            </div>
            <Switch
              checked={notifications.marketing}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, marketing: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSave}>Save Changes</Button>
      </div>
    </div>
  );
}
```

#### 步骤 4：添加导航链接
在 `src/features/dashboard/components/dashboard-sidebar.tsx` 中添加设置页面链接：

```tsx
const menuItems: MenuItem[] = [
  // ... 其他菜单项
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];
```

#### 步骤 5：测试功能
1. 访问 `http://localhost:3000/settings`
2. 测试主题切换功能
3. 填写表单并验证输入
4. 切换通知开关
5. 在不同屏幕尺寸下测试响应式布局

### 成功标准
- ✅ 页面正常显示，无错误
- ✅ 主题切换功能正常工作
- ✅ 表单输入可以正常填写
- ✅ Switch 组件可以正常切换
- ✅ 响应式布局在不同屏幕尺寸下正常
- ✅ 理解 shadcn/ui 组件的使用方式

## 常见问题 FAQ

### Q: 如何添加新的 shadcn/ui 组件？
A: 使用 CLI 命令：`npx shadcn@latest add [component-name]`

### Q: 如何自定义组件样式？
A: 直接修改 `src/components/ui/` 中的组件文件，或使用 `className` prop 覆盖样式。

### Q: Tailwind 类名冲突怎么办？
A: 使用 `cn()` 函数，它会智能合并类名，后者覆盖前者。

### Q: 如何添加自定义颜色？
A: 在 `globals.css` 的 `@theme` 中添加颜色变量，然后在组件中使用 `text-custom-color`。

### Q: 为什么暗色模式不工作？
A: 确保：
1. 根元素有 `<ThemeProvider>`
2. `next-themes` 已安装
3. CSS 中 `.dark` 类定义正确

## 下一步准备

完成本课程后，你已经：
- ✅ 掌握 Tailwind CSS v4 的新特性和配置
- ✅ 理解 CSS 变量和主题定制
- ✅ 掌握 shadcn/ui 组件的使用和定制
- ✅ 学会响应式设计和移动端适配
- ✅ 完成实践任务，创建了设置页面

在下一课中，我们将深入学习数据库设计与 Prisma ORM，理解数据建模和数据库操作。

## 扩展阅读

1. [Tailwind CSS v4 文档](https://tailwindcss.com/docs)
2. [shadcn/ui 官方网站](https://ui.shadcn.com)
3. [Radix UI 文档](https://www.radix-ui.com/docs)
4. [oklch 颜色空间](https://oklch.com)
5. [next-themes 文档](https://github.com/pacocoursey/next-themes)

## 作业与思考

1. 在实践任务的基础上，添加头像上传功能
2. 尝试创建一个自定义 Button 变体，添加渐变背景
3. 思考：如何实现组件级别的主题定制？
4. 调研 Tailwind CSS v4 的其他新特性，如容器查询

---

**恭喜完成第3课！** 你已经掌握了现代 Web 应用的样式设计和组件开发技能。如果有任何问题，请参考项目 GitHub 讨论区或相关技术社区。

> 下一课：[第4课：数据库设计与 Prisma ORM](../Tutorial/第4课-数据库设计与-Prisma-ORM.md)