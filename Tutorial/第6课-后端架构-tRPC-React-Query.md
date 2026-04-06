# 第6课：后端架构（tRPC + React Query）

> 本课程详细讲解 Resonance 项目中的 tRPC 类型安全 API 架构和 React Query 状态管理。

## 目录

1. [tRPC 简介与核心概念](#1-trpc-简介与核心概念)
2. [项目 tRPC 文件结构](#2-项目-trpc-文件结构)
3. [服务端初始化与配置](#3-服务端初始化与配置)
4. [中间件与认证流程](#4-中间件与认证流程)
5. [定义路由器与过程](#5-定义路由器与过程)
6. [API 路由处理器](#6-api-路由处理器)
7. [客户端配置与 Provider](#7-客户端配置与-provider)
8. [React Query 集成](#8-react-query-集成)
9. [客户端调用方式](#9-客户端调用方式)
10. [服务端预取与 SSR](#10-服务端预取与-ssr)
11. [输入验证与错误处理](#11-输入验证与错误处理)
12. [实践任务](#12-实践任务)

---

## 1. tRPC 简介与核心概念

### 什么是 tRPC？

tRPC 是一种**类型安全**的 API 框架，它允许前后端共享 TypeScript 类型，实现端到端的类型安全。

**传统 API 调用问题**：

```typescript
// 传统方式：前端不知道后端返回什么类型
const response = await fetch('/api/users/123');
const data = await response.json();
// data 的类型是 any，需要手动定义接口
```

**tRPC 方式**：

```typescript
// 前后端共享类型，编辑器自动补全
const user = await trpc.user.getById.query({ id: '123' });
// user 的类型自动推断，完全类型安全
```

### 核心概念

| 概念 | 说明 |
|------|------|
| **Router** | 路由器，类似 Express 的路由，定义一组相关过程 |
| **Procedure** | 过程，相当于 API 端点，可分为 query（查询）和 mutation（变更） |
| **Context** | 上下文，请求期间的共享数据（如用户信息） |
| **Middleware** | 中间件，在过程执行前后的逻辑（如认证、日志） |
| **Input/Output** | 输入/输出schema，用于验证和序列化 |

### Query vs Mutation

- **Query**：读取数据，GET 语义，可缓存
- **Mutation**：修改数据，POST/PUT/DELETE 语义

---

## 2. 项目 tRPC 文件结构

```
src/trpc/
├── client.tsx           # 客户端 Provider 和 hooks
├── init.ts             # 服务端初始化、中间件、基础 procedure
├── query-client.ts     # TanStack Query Client 配置
├── server.tsx          # 服务端预取和 HydrationBoundary
└── routers/
    ├── _app.ts         # 主路由聚合器
    ├── voices.ts       # voices 路由
    ├── generations.ts  # generations 路由
    └── billing.ts       # billing 路由
```

**API 路由**：

```
src/app/api/trpc/[trpc]/route.ts  # HTTP 请求处理器
```

---

## 3. 服务端初始化与配置

### 3.1 创建基础实例

`src/trpc/init.ts` 是 tRPC 的核心配置文件：

```typescript
import * as Sentry from "@sentry/node";
import { auth } from '@clerk/nextjs/server';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from "superjson";

// 1. 创建上下文函数（目前为空，可扩展）
export const createTRPCContext = cache(async () => {
  return {};
});

// 2. 初始化 tRPC，配置 superjson 序列化
const t = initTRPC.create({
  transformer: superjson,  // 支持 Date、Map 等类型自动序列化
});

// 3. 导出路由创建器和基础 procedure
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
```

**关键点**：
- `cache()` 是 Next.js 的 React 缓存函数，用于缓存上下文
- `superjson` 允许序列化 Date、Set、Map 等特殊类型

### 3.2 配置序列化转换器

`superjson` 的作用是处理 TypeScript 类型到 JSON 的转换：

```typescript
// superjson 可以正确序列化
const data = {
  createdAt: new Date(),      // Date → string
  map: new Map([['key', 1]]), // Map → object
  set: new Set([1, 2, 3]),    // Set → array
};

// 普通 JSON 无法正确序列化这些类型
```

---

## 4. 中间件与认证流程

### 4.1 Sentry 中间件

项目使用 Sentry 进行错误监控：

```typescript
const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: true,
  }),
);

// 将中间件应用到基础 procedure
export const baseProcedure = t.procedure.use(sentryMiddleware);
```

### 4.2 认证 Procedure

`tRPC` 支持创建**自定义 procedure**，在 `baseProcedure` 基础上添加认证逻辑：

```typescript
// 认证 procedure - 验证用户已登录
export const authProcedure = baseProcedure.use(async ({ next }) => {
  const { userId } = await auth();
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { userId } });
});

// 组织 procedure - 验证用户属于某个组织
export const orgProcedure = baseProcedure.use(async ({ next }) => {
  const { userId, orgId } = await auth();
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Organization required" });
  }
  return next({ ctx: { userId, orgId } });
});
```

**中间件执行流程**：

```
请求 → baseProcedure → sentryMiddleware → authProcedure → 业务逻辑
                                              ↓
                                         未认证 → 抛出 UNAUTHORIZED 错误
```

**TRPCError 错误代码**：

| 代码 | 含义 |
|------|------|
| `UNAUTHORIZED` | 未认证（未登录） |
| `FORBIDDEN` | 无权限（已登录但无访问权限） |
| `NOT_FOUND` | 资源不存在 |
| `BAD_REQUEST` | 请求参数错误 |
| `INTERNAL_SERVER_ERROR` | 服务器内部错误 |

---

## 5. 定义路由器与过程

### 5.1 主路由聚合器

`src/trpc/routers/_app.ts` 聚合所有子路由器：

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

// 导出类型，供前端使用（重要！）
export type AppRouter = typeof appRouter;
```

### 5.2 Voices 路由器详解

`src/trpc/routers/voices.ts` 实现了 voices 相关的 API：

```typescript
import { z } from 'zod';
import { createTRPCRouter, orgProcedure } from '../init';
import { PRISMA } from '@/lib/prisma';

export const voicesRouter = createTRPCRouter({
  // Query: 获取所有声音列表
  getAll: orgProcedure
    .input(
      z.object({
        query: z.string().trim().optional(),  // 搜索关键词
      })
    )
    .query(async ({ ctx, input }) => {
      const { orgId } = ctx;  // 从 context 获取组织 ID

      // 查询自定义声音
      const customVoices = await PRISMA.voice.findMany({
        where: {
          organizationId: orgId,
          ...(input.query && {
            name: { contains: input.query, mode: 'insensitive' },
          }),
        },
      });

      // 返回结构化数据
      return {
        custom: customVoices,
        system: [],  // 系统声音（预留）
      };
    }),

  // Mutation: 删除声音
  delete: orgProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { orgId } = ctx;

      // 验证所有权
      const voice = await PRISMA.voice.findFirst({
        where: { id: input.id, organizationId: orgId },
      });

      if (!voice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Voice not found' });
      }

      // 删除数据库记录
      await PRISMA.voice.delete({ where: { id: input.id } });

      // TODO: 同时删除 R2 存储中的文件
      return { success: true };
    }),
});
```

### 5.3 Generations 路由器详解

`src/trpc/routers/generations.ts` 展示了更复杂的 mutation：

```typescript
export const generationsRouter = createTRPCRouter({
  // Query: 获取单个生成记录
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const generation = await PRISMA.generation.findFirst({
        where: { id: input.id, organizationId: ctx.orgId },
      });

      if (!generation) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return generation;
    }),

  // Query: 获取所有生成记录
  getAll: orgProcedure.query(async ({ ctx }) => {
    return PRISMA.generation.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
    });
  }),

  // Mutation: 创建新的语音生成
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
      // 1. 验证订阅状态
      const status = await ctx.POLAR.subscriptions.active();
      if (!status) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Active subscription required',
        });
      }

      // 2. 调用外部 TTS API (Modal/Chatterbox)
      const audioBuffer = await callChatterboxAPI(input);

      // 3. 上传到 R2 存储
      const audioUrl = await uploadToR2(audioBuffer);

      // 4. 记录到数据库
      const generation = await PRISMA.generation.create({
        data: {
          organizationId: ctx.orgId,
          text: input.text,
          voiceId: input.voiceId,
          audioUrl,
          status: 'completed',
          // ... 其他字段
        },
      });

      // 5. 发送使用量事件到 Polar
      await ctx.POLAR.events.capture('text_generated', {
        quantity: input.text.length,
      });

      return generation;
    }),
});
```

---

## 6. API 路由处理器

`src/app/api/trpc/[trpc]/route.ts` 是 Next.js API 路由：

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/trpc/init';
import { appRouter } from '@/trpc/routers/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',           // API 前缀
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

// 导出 GET 和 POST 处理器
export { handler as GET, handler as POST };
```

**请求流程**：

```
浏览器请求 /api/trpc/voices.getAll
        ↓
Next.js Route Handler (route.ts)
        ↓
fetchRequestHandler 处理
        ↓
tRPC 路由器匹配 voices.getAll
        ↓
执行 orgProcedure（认证检查）
        ↓
执行 query 逻辑
        ↓
返回结果（自动序列化）
```

---

## 7. 客户端配置与 Provider

### 7.1 Query Client 配置

`src/trpc/query-client.ts` 配置 TanStack Query：

```typescript
import superjson from 'superjson';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,  // 30秒后数据变为 stale
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
```

### 7.2 TRPC Provider

`src/trpc/client.tsx` 创建客户端 Provider：

```typescript
'use client';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,  // 必须与服务端一致
          url: getUrl(),           // /api/trpc
        }),
      ],
    })
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

### 7.3 Provider 挂载

在 `src/app/layout.tsx` 的根布局中全局挂载：

```typescript
import { TRPCReactProvider } from '@/trpc/client';

export default function RootLayout({ children }) {
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

## 8. React Query 集成

### 8.1 TanStack Query 与 tRPC 集成

项目使用 `@trpc/tanstack-react-query` 将 tRPC 与 TanStack Query 深度集成：

```typescript
// 自动获得类型安全的 queryOptions
const queryOptions = trpc.voices.getAll.queryOptions({ query: 'hello' });

// 在 React Query 中使用
const { data } = useSuspenseQuery(queryOptions);
```

### 8.2 queryOptions vs 直接调用

tRPC 提供了两种调用方式：

```typescript
// 方式 1: queryOptions (推荐)
const queryOptions = trpc.voices.getAll.queryOptions({ query });
const { data } = useSuspenseQuery(queryOptions);

// 方式 2: 直接调用
const { data } = useSuspenseQuery(
  trpc.voices.getAll.query({ query })  // 不推荐
);
```

**queryOptions 优势**：
- 支持 SSR 预取
- 支持乐观更新
- 支持查询键管理

---

## 9. 客户端调用方式

### 9.1 在客户端组件中使用 Query

` VoicesView.tsx` 展示了典型的查询组件：

```typescript
'use client';

import { useTRPC } from '@/trpc/client';
import { useSuspenseQuery } from '@tanstack/react-query';

export function VoicesView() {
  const trpc = useTRPC();

  // 使用 queryOptions 获取数据
  const { data } = useSuspenseQuery(
    trpc.voices.getAll.queryOptions({ query })
  );

  return (
    <div>
      <h1>自定义声音 ({data.custom.length})</h1>
      {/* 渲染声音列表 */}
    </div>
  );
}
```

### 9.2 在客户端组件中使用 Mutation

`text-to-speech-form.tsx` 展示了变更操作：

```typescript
'use client';

import { useTRPC } from '@/trpc/client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export function TextToSpeechForm() {
  const trpc = useTRPC();
  const router = useRouter();

  // 创建 mutation
  const createMutation = useMutation(
    trpc.generations.create.mutationOptions({
      onSuccess: (data) => {
        // 成功后跳转到生成详情页
        router.push(`/text-to-speech/${data.id}`);
      },
      onError: (error) => {
        // 错误处理
        console.error('生成失败:', error.message);
      },
    })
  );

  const handleSubmit = async (values: FormValues) => {
    try {
      const result = await createMutation.mutateAsync({
        text: values.text.trim(),
        voiceId: values.voiceId,
        temperature: values.temperature,
      });
    } catch (error) {
      // 错误已在 onError 中处理
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 表单内容 */}
    </form>
  );
}
```

### 9.3 useTRPC vs 直接导入

项目推荐使用 `useTRPC()` hook 获取客户端：

```typescript
// 正确：使用 hook
const trpc = useTRPC();
const data = useSuspenseQuery(trpc.voices.getAll.queryOptions());

// 错误：直接调用会丢失上下文
import { trpc } from '@/trpc/server';  // 不要这样做！
```

---

## 10. 服务端预取与 SSR

### 10.1 服务端预取工具

`src/trpc/server.tsx` 提供了服务端预取支持：

```typescript
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});

// 预取查询
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(
  queryOptions: T,
) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    void queryClient.prefetchInfiniteQuery(queryOptions as any);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}

// 水合组件
export function HydrateClient({ children }: { children: React.ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
```

### 10.2 在页面中使用预取

`text-to-speech/page.tsx` 展示了服务端预取模式：

```typescript
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function TextToSpeechPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; voiceId?: string }>;
}) {
  const { text, voiceId } = await searchParams;

  // 预取需要的数据
  prefetch(trpc.voices.getAll.queryOptions());
  prefetch(trpc.generations.getAll.queryOptions());

  return (
    <HydrateClient>
      <TextToSpeechView initialValues={{ text, voiceId }} />
    </HydrateClient>
  );
}
```

**工作流程**：

```
服务端:
  prefetch(trpc.voices.getAll.queryOptions())
         ↓
  QueryClient 缓存数据
         ↓
  <HydrationBoundary> 将缓存传递给客户端
         ↓
客户端:
  <HydrateClient>
         ↓
  useSuspenseQuery() 直接从缓存读取，无需请求
```

---

## 11. 输入验证与错误处理

### 11.1 Zod 输入验证

项目使用 Zod 进行运行时输入验证：

```typescript
import { z } from 'zod';

// 定义输入 schema
const createGenerationSchema = z.object({
  text: z.string().min(1).max(5000),      // 必填，1-5000字符
  voiceId: z.string().min(1),            // 必填
  temperature: z.number().min(0).max(2).default(0.8),
  topP: z.number().min(0).max(1).default(0.95),
  topK: z.number().min(1).max(10000).default(1000),
  repetitionPenalty: z.number().min(1).max(2).default(1.2),
});

// 在 procedure 中使用
export const create = orgProcedure
  .input(createGenerationSchema)
  .mutation(async ({ input }) => {
    // input 已经被验证和类型推断
    // input.text 是 string（不是 string | undefined）
  });
```

### 11.2 错误处理

tRPC 的错误通过 `TRPCError` 抛出：

```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'NOT_FOUND',           // 错误代码
  message: 'Voice not found',  // 可读消息
  cause: originalError,        // 原始错误（可选）
});
```

### 11.3 前端错误处理

```typescript
const mutation = useMutation(
  trpc.voices.delete.mutationOptions({
    onError: (error) => {
      if (error.data?.code === 'NOT_FOUND') {
        // 处理特定错误
      }
      if (error.data?.code === 'UNAUTHORIZED') {
        // 未认证，跳转登录
      }
    },
  })
);
```

---

## 12. 实践任务

### 任务：创建一个用户偏好设置 Router

**目标**：创建一个新的 tRPC 路由器，管理用户的偏好设置。

**步骤 1**：创建新的路由文件 `src/trpc/routers/user-settings.ts`

```typescript
import { z } from 'zod';
import { createTRPCRouter, authProcedure } from '../init';
import { PRISMA } from '@/lib/prisma';
import { TRPCError } from '@trpc/server';

export const userSettingsRouter = createTRPCRouter({
  // 获取用户偏好
  get: authProcedure.query(async ({ ctx }) => {
    const settings = await PRISMA.userSettings.findUnique({
      where: { userId: ctx.userId },
    });
    return settings;
  }),

  // 更新用户偏好
  update: authProcedure
    .input(
      z.object({
        defaultVoiceId: z.string().optional(),
        defaultTemperature: z.number().min(0).max(2).optional(),
        theme: z.enum(['light', 'dark', 'system']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await PRISMA.userSettings.upsert({
        where: { userId: ctx.userId },
        update: input,
        create: {
          userId: ctx.userId,
          ...input,
        },
      });
      return settings;
    }),
});
```

**步骤 2**：在主路由器中注册

编辑 `src/trpc/routers/_app.ts`：

```typescript
import { userSettingsRouter } from './user-settings';

export const appRouter = createTRPCRouter({
  // ... 其他路由
  userSettings: userSettingsRouter,
});
```

**步骤 3**：在客户端组件中使用

```typescript
'use client';

import { useTRPC } from '@/trpc/client';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';

function SettingsComponent() {
  const trpc = useTRPC();

  // 获取设置
  const { data: settings } = useSuspenseQuery(
    trpc.userSettings.get.queryOptions()
  );

  // 更新设置
  const updateMutation = useMutation(
    trpc.userSettings.update.mutationOptions({
      onSuccess: () => {
        // 刷新数据或显示成功消息
      },
    })
  );

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateMutation.mutate({ theme });
  };

  return <div>{/* 设置界面 */}</div>;
}
```

**验证**：

1. 访问 `http://localhost:3000/api/trpc` 可以看到 tRPC 调试界面
2. 登录后可以调用 `userSettings.get` 查询当前设置
3. 调用 `userSettings.update` 可以更新设置
4. 打开浏览器 DevTools Network，可以看到 `/api/trpc/userSettings.get` 请求

---

## 总结

本课程我们学习了：

1. **tRPC 核心概念**：Router、Procedure、Context、Middleware
2. **服务端配置**：initTRPC、superjson 序列化、Sentry 中间件
3. **认证流程**：authProcedure、orgProcedure
4. **路由器定义**：Query 和 Mutation、Zod 输入验证
5. **客户端集成**：TRPCProvider、React Query 集成
6. **调用方式**：queryOptions、useSuspenseQuery、useMutation
7. **服务端预取**：prefetch 和 HydrationBoundary

---

## 作业与思考

### 基础作业

1. **扩展 userSettings 路由器**
   - 添加 `delete` mutation，允许用户删除自己的账户
   - 添加 `updatePassword` mutation，允许用户修改密码
   - 为每个 mutation 添加适当的输入验证

2. **实现分页查询**
   - 为 `generations.getAll` 添加分页功能
   - 使用 Zod 定义分页输入 schema（page, pageSize）
   - 返回分页元数据（total、totalPages、hasMore）

3. **添加搜索功能**
   - 在 voices 路由器中添加名称搜索
   - 实现模糊匹配（使用 Prisma 的 contains）
   - 支持大小写不敏感搜索

### 进阶思考

4. **理解中间件链**
   思考以下问题：
   - 如果把 `sentryMiddleware` 放在 `authProcedure` 之后，会发生什么？
   - 如何添加一个记录请求耗时的中间件？
   - 中间件的执行顺序是否可以改变？为什么？

5. **缓存策略设计**
   思考以下场景：
   - 如果数据更新频繁，应该设置多长的 staleTime？
   - 如何实现手动缓存失效（invalidat）？
   - 在 mutation 成功后，如何自动刷新相关查询？

6. **错误处理最佳实践**
   分析以下代码，思考改进方案：
   ```typescript
   // 当前代码
   if (!voice) {
     throw new TRPCError({ code: 'NOT_FOUND' });
   }
   ```
   - 是否应该返回更详细的错误信息？
   - 如何区分"资源不存在"和"无权访问"？
   - 错误信息是否应该包含敏感信息？

7. **类型安全深度理解**
   - 为什么导出 `AppRouter` 类型很重要？
   - 如果不导出类型，前端会失去什么？
   - `typeof appRouter` 和 `AppRouter` 有什么区别？

### 实践挑战

8. **实现乐观更新**
   挑战：为 `voices.delete` mutation 实现乐观更新，即：
   - 用户点击删除后，立即从 UI 移除
   - 如果服务器返回错误，则回滚
   - 参考 React Query 的 `onMutate` 和 `onError` 回调

9. **添加速率限制**
   挑战：为 `generations.create` mutation 添加速率限制：
   - 每个组织每分钟最多创建 10 个生成
   - 使用内存或 Redis 存储计数
   - 超出限制时返回适当的错误

---

## 下一步

完成实践任务和作业后，继续学习：

- [第7课：文件存储（Cloudflare R2）](./第7课-文件存储-Cloudflare-R2.md) - 学习如何存储生成的音频文件

---

**有问题？** 欢迎在项目 GitHub 讨论区提问！

返回：[第5课：认证与多租户（Clerk）](./第5课-认证与多租户-Clerk.md)
