# 第四课：客户端实现与 API 调用

## 4.1 回顾与概述

在前三节课中，我们学习了 tRPC 的服务端实现，包括初始化、中间件、Router 和 Procedure。

本节课我们将学习客户端的实现，理解：
- 如何配置客户端 Provider
- 如何在组件中调用 API
- 如何实现服务端渲染的数据预取

## 4.2 整体架构

在开始具体代码之前，让我们先理解客户端的整体架构：

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                  TRPCReactProvider                  │  │
│   │  ┌───────────────────────────────────────────────┐  │  │
│   │  │           QueryClientProvider                │  │  │
│   │  │  ┌─────────────────────────────────────────┐  │  │  │
│   │  │  │              React 组件树                │  │  │  │
│   │  │  │  ┌─────────────────────────────────┐    │  │  │  │
│   │  │  │  │  useTRPC() / useSuspenseQuery   │    │  │  │  │
│   │  │  │  └─────────────────────────────────┘    │  │  │  │
│   │  │  └─────────────────────────────────────────┘  │  │  │
│   │  └───────────────────────────────────────────────┘  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   使用 @tanstack/react-query 管理请求状态和缓存              │
│   使用 @trpc/client 发送 HTTP 请求                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4.3 Query Client 配置

首先，我们需要配置 React Query 的客户端。让我看看 `src/trpc/query-client.ts`：

```typescript
import { 
  defaultShouldDehydrateQuery, 
  QueryClient, 
} from '@tanstack/react-query';
import superjson from 'superjson';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // 查询的默认配置
      queries: {
        staleTime: 30 * 1000,  // 数据30秒内被视为"新鲜"
      },
      // 服务端渲染时的序列化配置
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
      },
      // 客户端水合时的反序列化配置
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
```

### 4.3.1 关键配置解析

**staleTime（数据新鲜时间）**

```typescript
staleTime: 30 * 1000,  // 30秒
```

这意味着：如果数据在 30 秒内，再次请求不会触发新的 API 调用，而是直接使用缓存。

```
时间线：
T=0:     发起请求 → 获取新数据 → 缓存
T=0-30s: 再次请求 → 直接使用缓存（不发起网络请求）
T=30s+:  再次请求 → 发起新的 API 调用
```

**dehydrate（脱水）**

这是为服务端渲染准备的。当在服务端预取了数据后，需要"脱水"（序列化）传给客户端。

```typescript
dehydrate: {
  serializeData: superjson.serialize,  // 序列化
  shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) ||
    query.state.status === 'pending',  // 也序列化 pending 状态
},
```

**hydrate（水合）**

客户端收到服务端的数据后，需要"水合"（反序列化）来使用。

```typescript
hydrate: {
  deserializeData: superjson.deserialize,  // 反序列化
},
```

## 4.4 客户端 Provider 实现

现在让我们看看 `src/trpc/client.tsx`：

```typescript
'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import { makeQueryClient } from './query-client';
import type { AppRouter } from './routers/_app';
import superjson from "superjson";

// 创建 tRPC Context（包含 Provider 和 useTRPC hook）
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
```

### 4.4.1 Query Client 管理

```typescript
// 服务端和浏览器的 Query Client 管理策略不同
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // 服务端：每次都创建新的 client
    return makeQueryClient();
  }
  
  // 浏览器：使用单例 client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
```

**为什么这样做？**

1. **服务端**：每次请求都是独立的，需要独立的 Query Client
2. **浏览器**：整个应用共享一个 Query Client，避免重复创建

### 4.4.2 API URL 解析

```typescript
function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return '';      // 浏览器：相对路径
    if (process.env.APP_URL) return process.env.APP_URL;  // 生产环境
    return 'http://localhost:3000';                    // 本地开发
  })();
  return `${base}/api/trpc`;
}
```

### 4.4.3 tRPC Client 配置

```typescript
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
```

**httpBatchLink 的作用：**

这个 Link 会自动批量处理请求：

```
多个请求：
  trpc.voices.getAll.query()
  trpc.generations.getAll.query()

自动合并为单个 HTTP 请求：
  POST /api/trpc/voices.getAll,generations.getAll

响应返回后再拆分给各个调用
```

**好处：** 减少网络请求数量，提升性能。

### 4.4.4 Provider 组件

```typescript
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({ ... })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

**组件层级：**

```
QueryClientProvider
  └── TRPCProvider
        └── {props.children}  ← 你的应用组件
```

## 4.5 在组件中使用 tRPC

### 4.5.1 获取 useTRPC Hook

```typescript
import { useTRPC } from "@/trpc/client";

// 在组件内部
const trpc = useTRPC();
```

### 4.5.2 调用 Query

**基础用法**

```typescript
import { useSuspenseQuery } from '@tanstack/react-query';

// 获取所有声音
const { data } = useSuspenseQuery(trpc.voices.getAll.queryOptions());

// data 的类型自动推断为：
// { custom: Voice[], system: Voice[] }
```

**带参数的 Query**

```typescript
// 获取单个生成记录
const { data } = useSuspenseQuery(
  trpc.generations.getById.queryOptions({ id: generationId })
);
```

**带搜索条件的 Query**

```typescript
const { data } = useSuspenseQuery(
  trpc.voices.getAll.queryOptions({ query: searchText })
);
```

### 4.5.3 调用 Mutation

```typescript
import { useMutation } from '@tanstack/react-query';

// 创建删除 mutation
const deleteMutation = useMutation(
  trpc.voices.delete.mutationOptions({
    onSuccess: (data) => {
      console.log('删除成功', data);
      // 可选：刷新列表
      utils.voices.getAll.invalidate();
    },
    onError: (error) => {
      console.error('删除失败', error.message);
    },
  })
);

// 调用删除
deleteMutation.mutate({ id: 'voice-123' });
```

### 4.5.4 完整示例：声音列表组件

```typescript
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from '@tanstack/react-query';

export function VoicesView() {
  const trpc = useTRPC();
  
  // 查询数据
  const { data } = useSuspenseQuery(trpc.voices.getAll.queryOptions());

  return (
    <div>
      <h2>自定义声音</h2>
      {data.custom.map(voice => (
        <VoiceCard key={voice.id} voice={voice} />
      ))}
      
      <h2>系统声音</h2>
      {data.system.map(voice => (
        <VoiceCard key={voice.id} voice={voice} />
      ))}
    </div>
  );
}
```

### 4.5.5 完整示例：删除功能

```typescript
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function VoiceCard({ voice }: { voice: Voice }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.voices.delete.mutationOptions({
      onSuccess: () => {
        // 刷新列表
        queryClient.invalidateQueries({
          queryKey: trpc.voices.getAll.queryKey(),
        });
      },
    })
  );

  const handleDelete = () => {
    deleteMutation.mutate({ id: voice.id });
  };

  return (
    <div>
      <h3>{voice.name}</h3>
      <button onClick={handleDelete} disabled={deleteMutation.isPending}>
        {deleteMutation.isPending ? '删除中...' : '删除'}
      </button>
    </div>
  );
}
```

## 4.6 服务端渲染支持

现在让我们看看 `src/trpc/server.tsx`，这是实现服务端渲染数据预取的关键：

```typescript
import 'server-only';  // 确保这个文件只能在服务端导入

import { 
  createTRPCOptionsProxy, 
  TRPCQueryOptions 
} from '@tanstack/react-query';
import { cache } from 'react';
import { createTRPCContext } from './init';
import { makeQueryClient } from './query-client';
import { appRouter } from './routers/_app';
import { 
  dehydrate, 
  HydrationBoundary 
} from '@tanstack/react-query';

// 使用 cache 确保同一请求中只有一个 Query Client
export const getQueryClient = cache(makeQueryClient);

// 创建 tRPC 代理对象
export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});
```

### 4.6.1 createTRPCOptionsProxy

这个函数创建了一个代理对象，让我们可以在服务端"调用" Procedure：

```typescript
// 服务端可以直接调用
const data = await trpc.voices.getAll.query();

// 而不是
const data = await fetch('/api/trpc/voices.getAll');
```

**类型安全**：返回的数据类型完全 TypeScript 已知。

### 4.6.2 预取数据

```typescript
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
```

**使用方法：**

```typescript
// 在 Next.js Page 组件中
import { trpc, prefetch } from "@/trpc/server";

export default async function VoicesPage() {
  // 预取数据
  prefetch(trpc.voices.getAll.queryOptions({ query }));
  
  // ...
}
```

### 4.6.3 HydrateClient 组件

```typescript
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
```

**工作流程：**

```
1. 服务端 prefetch() 预取数据
2. 数据存入 Query Client
3. dehydrate() 将数据序列化
4. HTML 中包含序列化数据
5. 客户端 HydrateClient 接收数据
6. hydrate() 反序列化数据
7. 组件直接使用缓存，无需加载
```

## 4.7 实际使用示例

### 4.7.1 页面中的服务端预取

文件：`src/app/(dashboard)/voices/page.tsx`

```typescript
import { prefetch, trpc, HydrateClient } from "@/trpc/server";
import { VoicesView } from "@/features/voices/views/voices-view";

export default async function VoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query } = await searchParams;
  
  // 预取数据
  prefetch(trpc.voices.getAll.queryOptions({ query }));

  return (
    <HydrateClient>
      <VoicesView />
    </HydrateClient>
  );
}
```

### 4.7.2 组件中的数据使用

文件：`src/features/voices/views/voices-view.tsx`

```typescript
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export function VoicesView() {
  const trpc = useTRPC();
  
  // 直接使用数据，无需处理 loading 状态
  const { data } = useSuspenseQuery(trpc.voices.getAll.queryOptions());

  return (
    <div>
      {data.custom.map(voice => (
        <VoiceCard key={voice.id} voice={voice} />
      ))}
    </div>
  );
}
```

## 4.8 本课小结

本节课我们学习了：

1. **Query Client 配置** - React Query 的配置和 superjson 序列化
2. **客户端 Provider** - TRPCReactProvider 的实现和请求批量处理
3. **组件中使用 API** - useTRPC、useSuspenseQuery、useMutation 的使用
4. **服务端渲染** - prefetch 和 HydrateClient 实现数据预取

## 4.9 思考题

1. 为什么浏览器端使用单例 Query Client，而服务端每次创建新的？
2. httpBatchLink 批量处理请求有什么好处？
3. useSuspenseQuery 和普通的 useQuery 有什么区别？

## 4.10 下节课预告

下一节课我们将学习 tRPC 的进阶特性，包括：
- 错误处理最佳实践
- 缓存策略
- 调试技巧