# 第6课：后端架构（tRPC + React Query）

## 学习目标
- 理解 tRPC 类型安全的 API 架构
- 掌握路由器（Router）和过程（Procedure）的定义
- 学会查询（Query）和变更（Mutation）的使用
- 理解 React Query 的缓存和状态管理
- 掌握中间件实现认证和数据隔离
- 学会使用 Zod 进行输入验证

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

---

## 一、tRPC 简介

### 什么是 tRPC？

tRPC（TypeScript Remote Procedure Call）是一个用于构建类型安全 API 的框架：

| 特性 | 描述 |
|------|------|
| **端到端类型安全** | 前后端共享类型定义，无需手写 API 类型 |
| **零代码生成** | 无需运行代码生成工具，类型自动推导 |
| **自动补全** | IDE 中自动提示 API 路径和参数 |
| **轻量级** | 无需定义 Schema，直接使用 TypeScript |
| **框架无关** | 支持多种前端框架（React、Vue、Svelte 等）|

### tRPC vs 传统 REST API

| 对比项 | tRPC | REST API |
|--------|------|----------|
| 类型安全 | 自动端到端 | 需手动维护或使用 OpenAPI |
| 开发效率 | 高（自动补全）| 中（需查阅文档）|
| 学习曲线 | 较低 | 较低 |
| 生态系统 | 较新 | 成熟 |
| 跨语言支持 | 仅 TypeScript | 通用 |

### tRPC 核心概念

```
┌─────────────────────────────────────────────────────┐
│                    App Router                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐                 │
│  │  Server     │    │  Client     │                 │
│  │  Component  │    │  Component  │                 │
│  └──────┬──────┘    └──────┬──────┘                 │
│         │                  │                        │
│         ▼                  ▼                        │
│  ┌──────────────────────────────────────────────┐   │
│  │              tRPC Layer                       │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │   │
│  │  │ Router  │  │Procedure│  │Middleware│      │   │
│  │  └─────────┘  └─────────┘  └─────────┘       │   │
│  └──────────────────────────────────────────────┘   │
│         │                                           │
│         ▼                                           │
│  ┌──────────────────────────────────────────────┐   │
│  │              Data Layer                       │   │
│  │         Prisma / Database / APIs              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 二、项目 tRPC 架构

### 目录结构

```
src/trpc/
├── init.ts              # tRPC 初始化和中间件
├── query-client.ts      # React Query 客户端配置
├── client.tsx           # 客户端 Provider
├── server.tsx           # 服务端工具函数
└── routers/
    ├── _app.ts          # 主路由器（合并所有子路由）
    ├── voices.ts        # 语音相关 API
    ├── generations.ts   # 生成记录相关 API
    └── billing.ts       # 计费相关 API
```

### API 路由入口

**`src/app/api/trpc/[trpc]/route.ts`**：
```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',      // API 端点路径
    req,                         // 请求对象
    router: appRouter,           // 路由器
    createContext: createTRPCContext,  // 上下文创建函数
  });

export { handler as GET, handler as POST };
```

### 请求处理流程

```
客户端调用 trpc.voices.getAll()
         ↓
POST /api/trpc/voices.getAll
         ↓
fetchRequestHandler 接收请求
         ↓
createTRPCContext 创建上下文
         ↓
中间件链执行（认证、日志等）
         ↓
voices.getAll 过程执行
         ↓
返回结果（自动序列化）
```

---

## 三、tRPC 初始化

### 基础初始化

**`src/trpc/init.ts`**：
```typescript
import * as Sentry from "@sentry/node";
import { auth } from '@clerk/nextjs/server';
import { initTRPC, TRPCError } from '@trpc/server';
import { cache } from 'react';
import superjson from "superjson";

// 创建上下文（可扩展添加更多信息）
export const createTRPCContext = cache(async () => {
  return {};
});

// 初始化 tRPC
const t = initTRPC.create({
  // 数据转换器（支持 Date、Map、Set 等类型）
  transformer: superjson,
});

// Sentry 中间件（错误追踪）
const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: true,
  }),
);

// 导出基础工具
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure.use(sentryMiddleware);
```

### superjson 转换器

superjson 允许在 JSON 中传输复杂数据类型：

```typescript
// 不使用 superjson：Date 会变成字符串
const data = { createdAt: "2024-01-01T00:00:00.000Z" };

// 使用 superjson：Date 自动还原
const data = { createdAt: Date object };
```

支持的数据类型：
- `Date` - 日期对象
- `Map` / `Set` - 集合类型
- `BigInt` - 大整数
- `undefined` - 未定义值

---

## 四、中间件与过程类型

### 三种过程类型

**`src/trpc/init.ts`**（续）：

```typescript
// 1. 基础过程 - 无认证要求
export const baseProcedure = t.procedure.use(sentryMiddleware);

// 2. 认证过程 - 需要用户登录
export const authProcedure = baseProcedure.use(async ({ next }) => {
  const { userId } = await auth();

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // 将 userId 注入上下文
  return next({
    ctx: { userId },
  });
});

// 3. 组织过程 - 需要用户登录且选择组织（多租户核心）
export const orgProcedure = baseProcedure.use(async ({ next }) => {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization required",
    });
  }

  // 将 userId 和 orgId 注入上下文
  return next({ ctx: { userId, orgId } });
});
```

### 中间件执行顺序

```
请求进入
    ↓
sentryMiddleware（日志记录）
    ↓
认证中间件（authProcedure / orgProcedure）
    ↓
过程处理函数
    ↓
返回结果
    ↓
sentryMiddleware（记录完成）
```

### 过程类型选择

| 过程类型 | 使用场景 | 上下文 |
|----------|----------|--------|
| `baseProcedure` | 公开 API、健康检查 | `{}` |
| `authProcedure` | 用户个人数据 | `{ userId }` |
| `orgProcedure` | 组织数据（多租户）| `{ userId, orgId }` |

---

## 五、路由器定义

### 主路由器

**`src/trpc/routers/_app.ts`**：
```typescript
import { createTRPCRouter } from '../init';
import { billingRouter } from './billing';
import { generationsRouter } from './generations';
import { voicesRouter } from './voices';

export const appRouter = createTRPCRouter({
  voices: voicesRouter,
  generations: generationsRouter,
  billing: billingRouter,
});

// 导出类型供客户端使用
export type AppRouter = typeof appRouter;
```

### 语音路由器示例

**`src/trpc/routers/voices.ts`**：
```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { createTRPCRouter, orgProcedure } from "../init";

export const voicesRouter = createTRPCRouter({
  // 查询：获取所有语音
  getAll: orgProcedure
    .input(
      z.object({
        query: z.string().trim().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const searchFilter = input?.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { description: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {};

      const [custom, system] = await Promise.all([
        prisma.voice.findMany({
          where: { variant: "CUSTOM", orgId: ctx.orgId, ...searchFilter },
          orderBy: { createdAt: "desc" },
        }),
        prisma.voice.findMany({
          where: { variant: "SYSTEM", ...searchFilter },
          orderBy: { name: "asc" },
        }),
      ]);

      return { custom, system };
    }),

  // 变更：删除语音
  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const voice = await prisma.voice.findUnique({
        where: { id: input.id, variant: "CUSTOM", orgId: ctx.orgId },
      });

      if (!voice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Voice not found" });
      }

      await prisma.voice.delete({ where: { id: voice.id } });

      return { success: true };
    }),
});
```

### Query vs Mutation

| 类型 | 用途 | HTTP 方法 | 缓存行为 |
|------|------|-----------|----------|
| `query()` | 获取数据 | GET | 可缓存 |
| `mutation()` | 修改数据 | POST | 不缓存 |

---

## 六、输入验证（Zod）

### Zod 基础

Zod 是一个 TypeScript-first 的 Schema 声明和验证库：

```typescript
import { z } from "zod";

// 基础类型
z.string()      // 字符串
z.number()      // 数字
z.boolean()     // 布尔值
z.date()        // 日期
z.null()        // null
z.undefined()   // undefined
z.any()         // 任意类型
z.unknown()     // 未知类型

// 字符串验证
z.string().min(1, "不能为空")
z.string().max(100, "最多100字符")
z.string().email("邮箱格式不正确")
z.string().url("URL格式不正确")
z.string().regex(/^[a-z]+$/, "只能包含小写字母")

// 数字验证
z.number().min(0, "不能小于0")
z.number().max(100, "不能大于100")
z.number().int("必须是整数")
z.number().positive("必须是正数")

// 可选和默认值
z.string().optional()      // string | undefined
z.string().nullable()      // string | null
z.string().default("默认值")
```

### 项目中的验证示例

**`src/trpc/routers/generations.ts`**：
```typescript
create: orgProcedure
  .input(
    z.object({
      text: z.string().min(1).max(TEXT_MAX_LENGTH),  // 文本长度限制
      voiceId: z.string().min(1),                     // 必填
      temperature: z.number().min(0).max(2).default(0.8),
      topP: z.number().min(0).max(1).default(0.95),
      topK: z.number().min(1).max(10000).default(1000),
      repetitionPenalty: z.number().min(1).max(2).default(1.2),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // input 类型自动推导
    // input.text: string
    // input.voiceId: string
    // input.temperature: number (默认 0.8)
    // ...
  })
```

### 复杂验证示例

```typescript
// 嵌套对象
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string().regex(/^\d{5}$/),
});

// 数组
z.array(z.string()).min(1).max(10)  // 1-10个字符串
z.array(z.number())                  // 数字数组

// 联合类型
z.union([z.string(), z.number()])    // string | number
z.string().or(z.number())            // 同上

// 枚举
z.enum(["active", "pending", "deleted"])

// 自定义验证
z.string().refine(
  (val) => val.startsWith("https://"),
  { message: "必须以 https:// 开头" }
)
```

---

## 七、客户端集成

### Provider 配置

**`src/trpc/client.tsx`**：
```typescript
'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';
import superjson from "superjson";

// 创建 tRPC React 上下文
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

// 获取 QueryClient（服务端每次新建，客户端复用）
function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();  // 服务端：每次创建新的
  }
  // 客户端：复用同一个实例
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// 获取 API URL
function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return '';  // 客户端：相对路径
    if (process.env.APP_URL) return process.env.APP_URL;
    return 'http://localhost:3000';
  })();
  return `${base}/api/trpc`;
}

// Provider 组件
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

### 在根布局中使用

**`src/app/layout.tsx`**：
```typescript
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <TRPCReactProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
      </TRPCReactProvider>
    </ClerkProvider>
  );
}
```

---

## 八、前端调用 tRPC

### 使用 useTRPC Hook

**查询（Query）示例**：
```typescript
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function VoicesList() {
  const trpc = useTRPC();

  // 使用 useSuspenseQuery 获取数据
  const { data } = useSuspenseQuery(
    trpc.voices.getAll.queryOptions()
  );

  return (
    <div>
      <h2>自定义语音 ({data.custom.length})</h2>
      {data.custom.map(voice => (
        <div key={voice.id}>{voice.name}</div>
      ))}

      <h2>系统语音 ({data.system.length})</h2>
      {data.system.map(voice => (
        <div key={voice.id}>{voice.name}</div>
      ))}
    </div>
  );
}
```

### 变更（Mutation）示例

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";

export function DeleteVoiceButton({ voiceId }: { voiceId: string }) {
  const trpc = useTRPC();

  const deleteMutation = useMutation(
    trpc.voices.delete.mutationOptions({})
  );

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: voiceId });
      toast.success("语音已删除");
    } catch (error) {
      toast.error("删除失败");
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleteMutation.isPending}
    >
      {deleteMutation.isPending ? "删除中..." : "删除"}
    </button>
  );
}
```

### 带参数的查询

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function SearchVoices({ query }: { query: string }) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.voices.getAll.queryOptions({ query })
  );

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      搜索结果: {data?.custom.length ?? 0} 个自定义语音
    </div>
  );
}
```

---

## 九、服务端预取

### 为什么需要预取？

```
┌─────────────────────────────────────────────────────────┐
│                     无预取                               │
├─────────────────────────────────────────────────────────┤
│  服务端渲染 HTML → 客户端加载 JS → 发起请求 → 等待数据    │
│  总耗时: HTML渲染 + JS加载 + API请求                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     有预取                               │
├─────────────────────────────────────────────────────────┤
│  服务端预取数据 → 渲染 HTML（含数据） → 客户端直接使用    │
│  总耗时: HTML渲染 + JS加载（数据已在其中）               │
└─────────────────────────────────────────────────────────┘
```

### 服务端工具函数

**`src/trpc/server.tsx`**：
```typescript
import 'server-only';  // 确保只在服务端使用
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { cache } from 'react';
import { createTRPCContext } from './init';
import { makeQueryClient } from './query-client';
import { appRouter } from './routers/_app';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

// 获取 QueryClient（同一请求内缓存）
export const getQueryClient = cache(makeQueryClient);

// 创建 tRPC 服务端代理
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

// 数据注入组件
export function HydrateClient({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}

// 预取函数
export function prefetch(queryOptions: any) {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(queryOptions);
}
```

### 在页面中使用预取

**`src/app/(dashboard)/text-to-speech/page.tsx`**：
```typescript
import { TextToSpeechView } from "@/features/text-to-speech/views/text-to-speech-view";
import { trpc, HydrateClient, prefetch } from "@/trpc/server";

export default async function TextToSpeechPage() {
  // 预取数据
  prefetch(trpc.voices.getAll.queryOptions());
  prefetch(trpc.generations.getAll.queryOptions());

  return (
    <HydrateClient>
      <TextToSpeechView />
    </HydrateClient>
  );
}
```

### 预取流程图

```
服务端组件（Server Component）
         ↓
    prefetch(data)    ← 预取数据
         ↓
    HydrateClient     ← 将数据注入到 HTML
         ↓
    渲染 HTML
         ↓
客户端加载 HTML
         ↓
    React Query 从缓存读取数据
         ↓
    无需再次请求
```

---

## 十、React Query 集成

### QueryClient 配置

**`src/trpc/query-client.ts`**：
```typescript
import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,  // 30秒内数据视为新鲜
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',  // 包含 pending 状态
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
```

### 缓存策略

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `staleTime` | 数据新鲜时间 | 0（立即过期）|
| `gcTime` | 缓存保留时间 | 5分钟 |
| `refetchOnWindowFocus` | 窗口聚焦时重新获取 | true |
| `refetchOnMount` | 组件挂载时重新获取 | true |
| `retry` | 失败重试次数 | 3 |

### 缓存失效

```typescript
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function DeleteVoiceButton({ voiceId }: { voiceId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    ...trpc.voices.delete.mutationOptions({}),
    onSuccess: () => {
      // 删除成功后，使 voices 缓存失效
      queryClient.invalidateQueries({
        queryKey: trpc.voices.getAll.queryKey()
      });
    },
  });

  return <button onClick={() => deleteMutation.mutate({ id: voiceId })}>删除</button>;
}
```

---

## 十一、错误处理

### TRPCError 类型

```typescript
import { TRPCError } from "@trpc/server";

// 错误代码
type TRPCErrorCode =
  | "PARSE_ERROR"           // 解析错误
  | "BAD_REQUEST"           // 请求错误
  | "UNAUTHORIZED"          // 未认证
  | "FORBIDDEN"             // 禁止访问
  | "NOT_FOUND"             // 未找到
  | "METHOD_NOT_SUPPORTED"  // 方法不支持
  | "TIMEOUT"               // 超时
  | "CONFLICT"              // 冲突
  | "PRECONDITION_FAILED"   // 前置条件失败
  | "PAYLOAD_TOO_LARGE"     // 请求体过大
  | "INTERNAL_SERVER_ERROR" // 内部服务器错误;
}
```

### 服务端错误处理

```typescript
// 在过程内抛出错误
getById: orgProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    const generation = await prisma.generation.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
    });

    if (!generation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Generation not found",
      });
    }

    return generation;
  }),
```

### 客户端错误处理

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

export function GenerateButton() {
  const trpc = useTRPC();

  const createMutation = useMutation(
    trpc.generations.create.mutationOptions({})
  );

  const handleGenerate = async () => {
    try {
      const result = await createMutation.mutateAsync({ /* ... */ });
      toast.success("生成成功");
    } catch (error) {
      // 类型安全的错误处理
      if (error instanceof TRPCClientError) {
        if (error.message === "SUBSCRIPTION_REQUIRED") {
          toast.error("需要订阅", { action: { label: "订阅", onClick: () => {} } });
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("未知错误");
      }
    }
  };

  return <button onClick={handleGenerate}>生成</button>;
}
```

---

## 十二、完整示例分析

### generations 路由器完整分析

**`src/trpc/routers/generations.ts`**：

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { createTRPCRouter, orgProcedure } from "../init";

export const generationsRouter = createTRPCRouter({
  // 1. 获取单条记录
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // 使用 ctx.orgId 确保数据隔离
      const generation = await prisma.generation.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
        omit: {
          orgId: true,        // 不返回敏感字段
          r2ObjectKey: true,
        },
      });

      if (!generation) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        ...generation,
        audioUrl: `/api/audio/${generation.id}`,  // 音频访问 URL
      };
    }),

  // 2. 获取所有记录
  getAll: orgProcedure.query(async ({ ctx }) => {
    return prisma.generation.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
      omit: { orgId: true, r2ObjectKey: true },
    });
  }),

  // 3. 创建记录
  create: orgProcedure
    .input(
      z.object({
        text: z.string().min(1).max(TEXT_MAX_LENGTH),
        voiceId: z.string().min(1),
        temperature: z.number().min(0).max(2).default(0.8),
        topP: z.number().min(0).max(1).default(0.95),
        topK: z.number().min(1).max(10000).default(1000),
        repetitionPenalty: z.number().min(1).max(2).default(1.2),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 业务逻辑：检查订阅
      // 业务逻辑：验证语音
      // 业务逻辑：调用 AI 服务
      // 业务逻辑：存储音频
      // 业务逻辑：上报用量

      return { id: generationId };
    }),
});
```

### 数据流完整链路

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端                                  │
├─────────────────────────────────────────────────────────────┤
│  createMutation.mutateAsync({                               │
│    text: "Hello world",                                     │
│    voiceId: "voice_123",                                    │
│    temperature: 0.8                                         │
│  })                                                         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      tRPC Client                             │
├─────────────────────────────────────────────────────────────┤
│  POST /api/trpc/generations.create                          │
│  Body: { text: "Hello world", ... }                         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      Middleware                              │
├─────────────────────────────────────────────────────────────┤
│  1. SentryMiddleware (日志)                                  │
│  2. orgProcedure (认证 + 组织检查)                           │
│     - auth() 获取 userId, orgId                              │
│     - 注入 ctx: { userId, orgId }                            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      Zod 验证                                │
├─────────────────────────────────────────────────────────────┤
│  验证 input 符合 Schema                                      │
│  应用默认值                                                   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      Mutation 处理函数                       │
├─────────────────────────────────────────────────────────────┤
│  1. 检查订阅状态                                             │
│  2. 查询语音信息                                             │
│  3. 调用 AI 生成音频                                         │
│  4. 存储到数据库                                             │
│  5. 上传到 R2                                                │
│  6. 上报用量到 Polar                                         │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      返回结果                                │
├─────────────────────────────────────────────────────────────┤
│  { id: "gen_123" }                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 实践任务

### 任务目标
创建一个简单的 tRPC 路由器，实现笔记（Note）的增删改查功能。

### 具体步骤

#### 步骤 1：创建笔记数据模型

在 `prisma/schema.prisma` 中添加：

```prisma
model Note {
  id          String   @id @default(cuid())
  title       String
  content     String
  orgId       String
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([orgId])
}
```

然后运行迁移：
```bash
npx prisma migrate dev --name add_notes
```

#### 步骤 2：创建笔记路由器

创建 `src/trpc/routers/notes.ts`：

```typescript
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@/lib/db";
import { createTRPCRouter, orgProcedure } from "../init";

export const notesRouter = createTRPCRouter({
  // 获取所有笔记
  getAll: orgProcedure.query(async ({ ctx }) => {
    return prisma.note.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { updatedAt: "desc" },
    });
  }),

  // 获取单条笔记
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const note = await prisma.note.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
      });

      if (!note) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      return note;
    }),

  // 创建笔记
  create: orgProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        content: z.string().max(10000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return prisma.note.create({
        data: {
          ...input,
          orgId: ctx.orgId,
          userId: ctx.userId,
        },
      });
    }),

  // 更新笔记
  update: orgProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(100).optional(),
        content: z.string().max(10000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const existing = await prisma.note.findUnique({
        where: { id, orgId: ctx.orgId },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      return prisma.note.update({
        where: { id },
        data,
      });
    }),

  // 删除笔记
  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.note.findUnique({
        where: { id: input.id, orgId: ctx.orgId },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      await prisma.note.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
```

#### 步骤 3：注册路由器

更新 `src/trpc/routers/_app.ts`：

```typescript
import { createTRPCRouter } from '../init';
import { billingRouter } from './billing';
import { generationsRouter } from './generations';
import { voicesRouter } from './voices';
import { notesRouter } from './notes';  // 新增

export const appRouter = createTRPCRouter({
  voices: voicesRouter,
  generations: generationsRouter,
  billing: billingRouter,
  notes: notesRouter,  // 新增
});

export type AppRouter = typeof appRouter;
```

#### 步骤 4：创建笔记列表页面

创建 `src/app/(dashboard)/notes/page.tsx`：

```typescript
import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import { NotesView } from "@/features/notes/views/notes-view";

export default async function NotesPage() {
  prefetch(trpc.notes.getAll.queryOptions());

  return (
    <HydrateClient>
      <NotesView />
    </HydrateClient>
  );
}
```

#### 步骤 5：创建笔记视图组件

创建 `src/features/notes/views/notes-view.tsx`：

```typescript
"use client";

import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";

export function NotesView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { data: notes } = useSuspenseQuery(trpc.notes.getAll.queryOptions());

  const createMutation = useMutation({
    ...trpc.notes.create.mutationOptions({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.notes.getAll.queryKey() });
      setTitle("");
      setContent("");
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createMutation.mutate({ title: title.trim(), content: content.trim() });
  };

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">笔记</h1>

      {/* 创建表单 */}
      <div className="mb-8 p-4 border rounded-lg">
        <input
          type="text"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
        />
        <textarea
          placeholder="内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full mb-2 p-2 border rounded h-24"
        />
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="px-4 py-2 bg-primary text-white rounded"
        >
          {createMutation.isPending ? "创建中..." : "创建笔记"}
        </button>
      </div>

      {/* 笔记列表 */}
      <div className="space-y-4">
        {notes.map((note) => (
          <div key={note.id} className="p-4 border rounded-lg">
            <h3 className="font-medium">{note.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(note.createdAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 步骤 6：测试

1. 启动开发服务器：`npm run dev`
2. 访问 http://localhost:3000/notes
3. 测试：
   - 创建新笔记
   - 查看笔记列表
   - 验证数据隔离（切换组织后数据不同）

### 成功标准
- ✅ tRPC 路由器定义正确
- ✅ 前端可以调用 API
- ✅ 数据隔离正确（基于 orgId）
- ✅ 缓存失效正常工作

---

## 常见问题 FAQ

### Q: tRPC 和 GraphQL 如何选择？

A:
| 场景 | 推荐 |
|------|------|
| TypeScript 全栈项目 | tRPC |
| 多语言客户端 | GraphQL |
| 需要复杂查询能力 | GraphQL |
| 追求开发效率 | tRPC |
| 已有 REST API 迁移 | GraphQL（增量迁移）|

### Q: 如何处理文件上传？

A: tRPC 不适合处理大文件上传，推荐：
1. 使用独立的 API Route 处理上传
2. 或使用预签名 URL 直接上传到 S3/R2

### Q: 如何实现分页？

A: 使用 infinite query：
```typescript
// 后端
getAll: orgProcedure
  .input(z.object({
    cursor: z.string().optional(),
    limit: z.number().default(10),
  }))
  .query(async ({ input, ctx }) => {
    const items = await prisma.note.findMany({
      where: { orgId: ctx.orgId },
      take: input.limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });

    let nextCursor: string | undefined;
    if (items.length > input.limit) {
      items.pop();
      nextCursor = items[items.length - 1].id;
    }

    return { items, nextCursor };
  }),

// 前端
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
  trpc.notes.getAll.infiniteQueryOptions({
    limit: 10,
  }, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
);
```

### Q: 如何调试 tRPC？

A:
1. 使用 tRPC DevTools（开发工具扩展）
2. 查看网络请求（浏览器开发者工具）
3. 添加日志中间件：
```typescript
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  console.log(`[${type}] ${path}`);
  const result = await next();
  console.log(`[${type}] ${path} →`, result);
  return result;
});
```

---

## 下一步准备

完成本课程后，你已经：
- ✅ 理解 tRPC 类型安全架构
- ✅ 掌握路由器和过程的定义
- ✅ 学会查询和变更的使用
- ✅ 理解中间件认证机制
- ✅ 掌握 React Query 缓存管理
- ✅ 学会服务端数据预取

在下一课中，我们将学习文件存储，集成 Cloudflare R2 实现音频文件的上传和管理。

---

## 扩展阅读

1. [tRPC 官方文档](https://trpc.io/docs)
2. [tRPC Next.js 集成](https://trpc.io/docs/client/nextjs)
3. [React Query 官方文档](https://tanstack.com/query/latest)
4. [Zod 官方文档](https://zod.dev/)

## 作业与思考

1. 为笔记添加更新功能（乐观更新）
2. 实现笔记搜索功能
3. 添加分页支持
4. 思考：如何实现实时更新（WebSocket）？

---

**恭喜完成第6课！** 你已经掌握了类型安全的 API 架构，为后续的文件存储和 AI 功能集成打下了坚实基础。

> 下一课：[第7课：文件存储（Cloudflare R2 / AWS S3）](../Tutorial/第7课-文件存储-Cloudflare-R2-AWS-S3.md)
