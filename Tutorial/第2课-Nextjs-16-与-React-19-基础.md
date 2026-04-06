# 第2课：Next.js 16 与 React 19 基础

## 学习目标
- 掌握 Next.js App Router 的目录结构和核心概念
- 理解 React 19 的新特性及其应用场景
- 区分服务端组件和客户端组件的使用场景
- 掌握流式渲染和 Suspense 的工作原理
- 通过实践任务巩固对 Next.js 和 React 的理解

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

## Next.js App Router 深度解析

### App Router vs Pages Router
Next.js 从版本 13 开始引入了 App Router，这是对传统 Pages Router 的重大升级：

| 特性 | App Router | Pages Router |
|------|------------|--------------|
| 路由系统 | 基于文件系统（文件夹） | 基于文件系统（文件） |
| 布局 | 嵌套布局，可共享 | 每页独立，不易共享 |
| 数据获取 | 服务端组件异步获取 | `getServerSideProps` 等 |
| 流式渲染 | 原生支持 | 有限支持 |
| 默认渲染 | 服务端组件 | 客户端组件 |

### App Router 目录结构
让我们深入分析 Resonance 项目的 `src/app` 目录结构：

```
src/app/
├── layout.tsx                    # 根布局（应用级布局）
├── page.tsx                      # 首页（已移至 dashboard）
├── (dashboard)/                  # 路由组（组织相关路由）
│   ├── layout.tsx                # 仪表板布局（需要认证）
│   ├── page.tsx                  # 仪表板首页
│   ├── text-to-speech/           # 文本转语音功能
│   │   ├── layout.tsx            # TTS 布局
│   │   ├── page.tsx              # TTS 主页面
│   │   ├── loading.tsx           # 加载状态组件
│   │   └── [generationId]/       # 动态路由
│   │       └── page.tsx          # 生成详情页面
│   └── voices/                   # 语音管理
│       ├── layout.tsx            # 语音布局
│       └── page.tsx              # 语音列表页面
├── api/                          # API 路由
│   ├── trpc/[trpc]/              # tRPC API
│   ├── audio/[generationId]/     # 音频文件服务
│   └── voices/                   # 语音相关 API
├── sign-in/                      # 登录页面
│   └── [[...sign-in]]/           # Catch-all 路由
│       └── page.tsx
├── sign-up/                      # 注册页面
│   └── [[...sign-up]]/
│       └── page.tsx
└── org-selection/                # 组织选择页面
    └── page.tsx
```

### 路由组（Route Groups）
路由组使用 `(folderName)` 语法创建，用于：
1. **组织路由**：将相关路由分组
2. **共享布局**：组内路由共享相同的布局
3. **避免影响URL路径**：括号内的文件夹名不会出现在URL中

在 Resonance 项目中，`(dashboard)` 路由组包含所有需要用户认证的路由。

### 动态路由（Dynamic Routes）
使用 `[paramName]` 语法创建动态路由：
- `text-to-speech/[generationId]/page.tsx` → `/text-to-speech/abc123`
- 通过 `params` 属性访问参数：`params.generationId`

### Catch-all 路由
使用 `[[...slug]]` 语法匹配多个路径段：
- `sign-in/[[...sign-in]]/page.tsx` → `/sign-in`, `/sign-in/clerk`, `/sign-in/clerk/error`

## 核心组件类型

### 1. 布局组件（Layout）
布局组件定义页面的共享结构，可以嵌套使用。

**根布局示例** (`src/app/layout.tsx`)：
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";

export const metadata: Metadata = {
  title: "Resonance",
  description: "AI-powered text-to-speech and voice cloning platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <TRPCReactProvider>
        <html lang="en">
          <body>
            {children}
          </body>
        </html>
      </TRPCReactProvider>
    </ClerkProvider>
  );
}
```

**仪表板布局示例** (`src/app/(dashboard)/layout.tsx`)：
```tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/features/dashboard/components/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 服务端组件可以异步获取数据
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
      <DashboardSidebar />
      <main className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </SidebarProvider>
  );
}
```

### 2. 页面组件（Page）
页面组件是路由的入口点，每个路由对应一个 `page.tsx` 文件。

**仪表板页面示例** (`src/app/(dashboard)/page.tsx`)：
```tsx
import { DashboardView } from "@/features/dashboard/views/dashboard-view";

export default function DashboardPage() {
  return <DashboardView />;
}
```

### 3. 加载组件（Loading）
当页面或组件加载时显示加载状态。

**TTS 加载组件示例** (`src/app/(dashboard)/text-to-speech/loading.tsx`)：
```tsx
export default function TextToSpeechLoading() {
  return (
    <div className="flex h-[calc(100svh-4rem)] items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">
          Loading text-to-speech...
        </p>
      </div>
    </div>
  );
}
```

### 4. 错误组件（Error）
处理页面或组件渲染错误。

**全局错误组件示例** (`src/app/global-error.tsx`)：
```tsx
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

## React 19 新特性详解

### 1. Actions（服务器动作）
Actions 允许在客户端调用服务器函数，简化数据变更操作。

```tsx
// 服务端 Action（需要在服务端组件中定义）
async function createPost(formData: FormData) {
  'use server';

  const title = formData.get('title');
  const content = formData.get('content');

  // 直接访问数据库
  await db.post.create({
    data: { title, content }
  });

  revalidatePath('/posts');
}

// 客户端组件
function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" />
      <textarea name="content" />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

### 2. useOptimistic Hook
实现乐观更新，在等待服务器响应时立即更新UI。

```tsx
"use client";

import { useOptimistic } from 'react';

function MessageList({ messages }: { messages: Message[] }) {
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, newMessage: string) => [
      ...state,
      { id: Math.random(), text: newMessage, sending: true }
    ]
  );

  async function sendMessage(formData: FormData) {
    const message = formData.get('message') as string;

    addOptimisticMessage(message);

    await sendMessageToServer(message);

    // 服务器响应后会触发重新渲染
  }

  return (
    <>
      {optimisticMessages.map((msg) => (
        <div key={msg.id} className={msg.sending ? 'opacity-50' : ''}>
          {msg.text}
          {msg.sending && <span> (Sending...)</span>}
        </div>
      ))}

      <form action={sendMessage}>
        <input name="message" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

### 3. useFormStatus Hook
获取表单提交状态，无需手动管理 loading 状态。

```tsx
"use client";

import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
    </button>
  );
}

function ContactForm() {
  async function submitContact(formData: FormData) {
    'use server';
    // 处理表单提交
  }

  return (
    <form action={submitContact}>
      <input name="name" />
      <input name="email" />
      <SubmitButton />
    </form>
  );
}
```

## 服务端组件 vs 客户端组件

### 服务端组件（Server Components）
- **默认渲染**：Next.js App Router 中所有组件默认都是服务端组件
- **运行环境**：在服务器上渲染，HTML 发送到客户端
- **可以访问**：文件系统、数据库、环境变量、API 密钥
- **不能使用**：浏览器 API、事件处理、状态、Effect
- **优势**：更小的包大小、更好的性能、直接访问后端资源

**服务端组件示例**：
```tsx
import { db } from "@/lib/db";

export default async function UserProfile({ userId }: { userId: string }) {
  // 直接在服务端访问数据库
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { posts: true }
  });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <h2>Posts ({user.posts.length})</h2>
      <ul>
        {user.posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 客户端组件（Client Components）
- **需要指令**：必须在文件顶部添加 `"use client"`
- **运行环境**：在浏览器中渲染和运行
- **可以访问**：浏览器 API、事件处理、状态、Effect
- **不能使用**：服务端资源（除非通过 API）
- **优势**：交互性、状态管理、实时更新

**客户端组件示例**：
```tsx
"use client";

import { useState, useEffect } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // 访问浏览器 API
    document.title = `Count: ${count}`;
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

### 如何选择？
| 场景 | 推荐组件类型 | 原因 |
|------|-------------|------|
| 静态内容展示 | 服务端组件 | 无交互，性能更好 |
| 数据获取 | 服务端组件 | 直接访问数据库，更安全 |
| 表单处理 | 客户端组件 | 需要状态管理和事件处理 |
| 实时交互 | 客户端组件 | 需要状态和Effect |
| 浏览器API | 客户端组件 | 必须运行在浏览器中 |

## 流式渲染与 Suspense

### 什么是流式渲染？
流式渲染允许将页面分割成多个块，逐步发送到客户端，而不是等待整个页面渲染完成。

### Suspense 组件
Suspense 包裹异步组件，在加载时显示 fallback UI。

```tsx
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      <Suspense fallback={<Skeleton className="h-32 w-full" />}>
        <UserStats />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}

async function UserStats() {
  // 模拟慢速数据获取
  await new Promise(resolve => setTimeout(resolve, 2000));
  const stats = await getUserStats();

  return (
    <div>
      <p>Total Users: {stats.totalUsers}</p>
      <p>Active Today: {stats.activeToday}</p>
    </div>
  );
}

async function RecentActivity() {
  // 另一个慢速数据获取
  await new Promise(resolve => setTimeout(resolve, 3000));
  const activities = await getRecentActivity();

  return (
    <ul>
      {activities.map((activity) => (
        <li key={activity.id}>{activity.description}</li>
      ))}
    </ul>
  );
}
```

### 流式 SSR（服务器端渲染）
Next.js 16 支持流式 SSR，可以逐步发送 HTML 到客户端：

```tsx
// app/page.tsx
export default async function HomePage() {
  return (
    <div>
      <Header />

      <Suspense fallback={<Loading />}>
        <SlowComponent />
      </Suspense>

      <Footer />
    </div>
  );
}
```

## 项目中的 App Router 实践

### 1. 认证路由保护
Resonance 使用路由组和布局实现认证保护：

```tsx
// src/app/(dashboard)/layout.tsx
// 这个布局保护所有子路由，需要认证才能访问
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clerk 中间件会自动重定向未认证用户
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <main>{children}</main>
    </SidebarProvider>
  );
}
```

### 2. 动态元数据
根据页面内容动态设置元数据：

```tsx
// src/app/(dashboard)/text-to-speech/[generationId]/page.tsx
import type { Metadata } from "next";

type Props = {
  params: { generationId: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const generation = await getGeneration(params.generationId);

  return {
    title: `TTS: ${generation.text.substring(0, 50)}...`,
    description: `Text-to-speech generation by ${generation.voice.name}`,
  };
}

export default function GenerationDetailPage({ params }: Props) {
  // 页面内容...
}
```

### 3. 并行数据获取
使用 Promise.all 并行获取数据：

```tsx
export default async function DashboardPage() {
  // 并行获取数据，减少加载时间
  const [userStats, recentActivity, topVoices] = await Promise.all([
    getUserStats(),
    getRecentActivity(),
    getTopVoices(),
  ]);

  return (
    <div>
      <DashboardHeader stats={userStats} />
      <RecentActivityList activities={recentActivity} />
      <TopVoices voices={topVoices} />
    </div>
  );
}
```

## 实践任务

### 任务目标
创建一个简单的服务端组件和客户端组件，理解数据流和组件交互。

### 具体步骤

#### 步骤 1：创建服务端组件
在 `src/app/(dashboard)/practice/` 目录下创建以下文件：

**`src/app/(dashboard)/practice/page.tsx`**：
```tsx
import { db } from "@/lib/db";
import ClientCounter from "./client-counter";

export default async function PracticePage() {
  // 服务端：直接访问数据库（模拟）
  const mockData = {
    totalUsers: 1234,
    totalGenerations: 5678,
    totalCharacters: 987654,
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">实践练习：组件交互</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总用户数</h2>
          <p className="text-2xl">{mockData.totalUsers}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总生成次数</h2>
          <p className="text-2xl">{mockData.totalGenerations}</p>
        </div>
        <div className="p-4 border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">总字符数</h2>
          <p className="text-2xl">{mockData.totalCharacters}</p>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">客户端计数器</h2>
        <p className="text-muted-foreground mb-4">
          这是一个客户端组件，包含交互状态。
        </p>

        {/* 客户端组件 */}
        <ClientCounter initialValue={10} />
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">学习要点：</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>服务端组件可以直接访问数据库和API</li>
          <li>客户端组件可以处理用户交互和状态</li>
          <li>数据从服务端流向客户端</li>
          <li>交互在客户端处理，结果可以传回服务端</li>
        </ul>
      </div>
    </div>
  );
}
```

#### 步骤 2：创建客户端组件
**`src/app/(dashboard)/practice/client-counter.tsx`**：
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClientCounterProps {
  initialValue: number;
}

export default function ClientCounter({ initialValue }: ClientCounterProps) {
  const [count, setCount] = useState(initialValue);
  const [inputValue, setInputValue] = useState("");

  const handleIncrement = () => {
    setCount(count + 1);
  };

  const handleDecrement = () => {
    setCount(count - 1);
  };

  const handleSetValue = () => {
    const num = parseInt(inputValue);
    if (!isNaN(num)) {
      setCount(num);
      setInputValue("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={handleDecrement} variant="outline" size="lg">
          -
        </Button>

        <div className="text-center">
          <div className="text-4xl font-bold">{count}</div>
          <div className="text-sm text-muted-foreground">当前值</div>
        </div>

        <Button onClick={handleIncrement} variant="outline" size="lg">
          +
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="设置新值"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSetValue}>设置</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>这是一个客户端组件，因为：</p>
        <ul className="list-disc pl-5 mt-1">
          <li>使用了 `useState` Hook 管理状态</li>
          <li>包含事件处理函数（onClick）</li>
          <li>需要浏览器环境才能运行</li>
          <li>顶部有 `"use client"` 指令</li>
        </ul>
      </div>
    </div>
  );
}
```

#### 步骤 3：测试组件
1. 访问 `http://localhost:3000/dashboard/practice`
2. 观察服务端组件渲染的静态数据
3. 与客户端计数器交互（增减数值）
4. 理解两种组件的区别

### 成功标准
- ✅ 页面正常显示，无错误
- ✅ 服务端组件正确显示静态数据
- ✅ 客户端计数器可以交互
- ✅ 理解服务端组件和客户端组件的区别
- ✅ 掌握 `"use client"` 指令的使用场景

## 常见问题 FAQ

### Q: 什么时候应该使用服务端组件？
A: 当组件不需要交互、不需要浏览器API、需要直接访问数据库或敏感数据时。

### Q: 服务端组件能使用 React Hook 吗？
A: 不能。服务端组件不能使用 `useState`、`useEffect`、`useContext` 等 Hook。

### Q: 如何将数据从服务端传递到客户端组件？
A: 通过 props 传递。服务端组件获取数据后，作为 props 传递给客户端组件。

### Q: `"use client"` 指令的作用是什么？
A: 标记该文件及其导入的所有组件为客户端组件，告诉 Next.js 应该在客户端渲染。

### Q: 服务端组件和 API 路由有什么区别？
A: 服务端组件渲染 HTML，API 路由处理 HTTP 请求返回 JSON。服务端组件用于 UI 渲染，API 路由用于数据操作。

## 下一步准备

完成本课程后，你已经：
- ✅ 掌握 Next.js App Router 的核心概念
- ✅ 理解 React 19 的新特性
- ✅ 能够区分服务端组件和客户端组件
- ✅ 了解流式渲染和 Suspense 的工作原理
- ✅ 完成实践任务，创建了交互式组件

在下一课中，我们将深入学习样式与组件库（Tailwind CSS + shadcn/ui），掌握现代 Web 应用的样式设计和组件开发。

## 扩展阅读

1. [Next.js App Router 官方文档](https://nextjs.org/docs/app)
2. [React 19 新特性详解](https://react.dev/blog/2024/04/25/react-19)
3. [服务端组件 vs 客户端组件](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
4. [流式渲染与 Suspense](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

## 作业与思考

1. 在 Resonance 项目中找到 3 个服务端组件和 3 个客户端组件，分析它们为什么选择这种类型
2. 尝试修改实践任务中的计数器，添加重置按钮和最大值限制
3. 思考：如果要在服务端组件中处理表单提交，应该怎么做？（提示：使用 React 19 Actions）
4. 调研 Next.js 16 的其他新特性，如 Partial Prerendering

---

**恭喜完成第2课！** 你已经掌握了 Next.js 16 和 React 19 的核心概念，为后续的技术栈学习打下了坚实基础。如果有任何问题，请参考项目 GitHub 讨论区或相关技术社区。

> 下一课：[第3课：样式与组件库（Tailwind CSS + shadcn/ui）](../Tutorial/第3课-样式与组件库-Tailwind-CSS-shadcn-ui.md)