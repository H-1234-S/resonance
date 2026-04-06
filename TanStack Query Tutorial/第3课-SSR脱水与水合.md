# 第3课：SSR 脱水与水合（Dehydrate/Hydrate）

## 3.1 回顾与概述

在第2课中，我们学习了 QueryClient 的初始化与配置，包括 staleTime、retry 等常用选项。

本节课我们将深入学习 SSR（服务端渲染）中的**脱水（Dehydrate）**与**水合（Hydrate）**机制，这是 Next.js 中实现数据预获取的关键。

## 3.2 什么是 SSR 数据传递？

在 Next.js 中，页面渲染有两种方式：

### 3.2.1 服务端渲染（Server Components）

```typescript
// app/page.tsx - Server Component
async function Page() {
  const data = await fetchData();  // 在服务端获取数据
  
  return <PageClient data={data} />;  // 通过 props 传给客户端
}
```

**问题**：这种方式的缺点是什么？
- 数据只能在父子组件间传递
- 切换页面需要重新请求
- 客户端无法独立刷新数据

### 3.2.2 TanStack Query 的方式

```typescript
// app/page.tsx - Server Component
async function Page() {
  const queryClient = makeQueryClient();
  
  // 1. 预取数据
  await queryClient.prefetchQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });
  
  // 2. 脱水
  const dehydratedState = dehydrate(queryClient);
  
  // 3. 传给客户端
  return (
    <HydrationBoundary state={dehydratedState}>
      <UserList />
    </HydrationBoundary>
  );
}

// components/UserList.tsx - Client Component
function UserList() {
  const { data } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });  // 数据从脱水状态恢复，不需要重新请求
}
```

**优势**：
- 客户端可以独立刷新数据
- 页面切换使用缓存
- 状态管理更灵活

## 3.3 脱水（Dehydrate）

### 3.3.1 概念

"脱水"是把服务端获取的**数据状态**序列化，准备传给客户端的过程。

```
服务端：Query 状态（包括 data、loading、error 等）
     ↓ 脱水
序列化后的 JSON
     ↓
传给客户端
```

### 3.3.2 dehydrate 函数

```typescript
import { dehydrate } from '@tanstack/react-query';

const queryClient = makeQueryClient();

// 预取数据
await queryClient.prefetchQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// 脱水
const dehydratedState = dehydrate(queryClient);

// dehydratedState 包含所有 Query 的状态
```

### 3.3.3 脱水的内容

```
脱水的 Query 状态：
{
  queries: [
    {
      queryKey: ['users'],
      queryHash: '["users"]',
      data: [...],           // 实际数据
      status: 'success',     // 请求状态
      error: null,
      fetchStatus: 'idle',
    }
  ],
  mutations: [],
}
```

### 3.3.4 shouldDehydrateQuery

决定哪些 Query 需要脱水：

```typescript
const dehydrateOptions = {
  // 序列化函数
  serializeData: superjson.serialize,
  
  // 判断哪些 Query 需要脱水
  shouldDehydrateQuery: (query) =>
    defaultShouldDehydrateQuery(query) ||    // 默认规则
    query.state.status === 'pending',        // pending 也要脱水
};
```

**defaultShouldDehydrateQuery 默认规则**：

| 状态 | 是否脱水 |
|------|----------|
| success | ✅ 脱水 |
| error | ✅ 脱水 |
| pending | ❌ 不脱水（默认） |
| idle | ❌ 不脱水 |

**项目中的配置**：

```typescript
shouldDehydrateQuery: (query) =>
  defaultShouldDehydrateQuery(query) ||
  query.state.status === 'pending',  // 额外脱水 pending 状态
```

**为什么要脱水 pending 状态？**
- 避免页面闪烁
- 让客户端继续显示加载状态
- 避免服务端长时间等待

## 3.4 水合（Hydrate）

### 3.4.1 概念

"水合"是把服务端传来的序列化数据**反序列化**，恢复到可用状态的过程。

```
客户端：接收 JSON
     ↓ 水合
Query 状态恢复
     ↓
组件可以使用数据
```

### 3.4.2 HydrationBoundary

```typescript
import { HydrationBoundary, hydrate } from '@tanstack/react-query';

// 服务端脱水
const dehydratedState = dehydrate(queryClient);

// 传给客户端
<HydrationBoundary state={dehydratedState}>
  <UserList />
</HydrationBoundary>
```

### 3.4.3 反序列化

```typescript
const hydrateOptions = {
  deserializeData: superjson.deserialize,
};
```

**作用**：把 `{"createdAt": "2024-01-01T00:00:00.000Z"}` 还原成 `{createdAt: new Date()}`。

## 3.5 superjson 的作用

### 3.5.1 普通 JSON 的问题

```javascript
// 原始数据
const data = {
  name: 'Tom',
  createdAt: new Date(),    // Date 对象
  bigInt: BigInt(123456),   // BigInt
  undefined: undefined,     // undefined
  set: new Set([1, 2, 3]),  // Set
};

// JSON.stringify 的结果
JSON.stringify(data);
// '{"name":"Tom","bigInt":{},"set":{}}'
// Date 变成字符串，BigInt、Set 丢失
```

### 3.5.2 superjson 的解决方案

```typescript
import superjson from 'superjson';

// 序列化
const serialized = superjson.serialize(data);
// {
//   json: { name: 'Tom', createdAt: '2024-01-01T00:00:00.000Z', bigInt: '123456' },
//   meta: { types: ['Date', 'BigInt'] }
// }

// 反序列化
const deserialized = superjson.deserialize(serialized);
// { name: 'Tom', createdAt: Date, bigInt: BigInt }
```

### 3.5.3 项目中的配置

```typescript
// query-client.ts
dehydrate: {
  serializeData: superjson.serialize,
},
hydrate: {
  deserializeData: superjson.deserialize,
},
```

## 3.6 项目中的完整流程

### 3.6.1 服务端代码

```typescript
// src/trpc/server.tsx
export const getQueryClient = cache(makeQueryClient);

export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}
```

### 3.6.2 prefetch 预取数据

```typescript
// src/trpc/server.tsx
export function prefetch(queryOptions) {
  const queryClient = getQueryClient();
  if (queryOptions.queryKey[1]?.type === 'infinite') {
    void queryClient.prefetchInfiniteQuery(queryOptions);
  } else {
    void queryClient.prefetchQuery(queryOptions);
  }
}
```

### 3.6.3 页面中使用

```typescript
// app/voices/page.tsx
import { prefetch, trpc } from '@/trpc/server';

async function VoicesPage() {
  // 预取数据
  await prefetch(trpc.voices.getAll.queryOptions());

  return <VoicesView />;
}
```

## 3.7 流程图解

```
┌─────────────────────────────────────────────────────────────────┐
│                        服务端                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  makeQueryClient()                                              │
│        ↓                                                        │
│  queryClient.prefetchQuery(...)  预取数据                       │
│        ↓                                                        │
│  dehydrate(queryClient)     脱水（序列化）                        │
│        ↓                                                        │
│  <HydrationBoundary state={...}>  传给客户端                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                         HTML 传输
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        客户端                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  <HydrationBoundary>  接收脱水状态                               │
│        ↓                                                        │
│  hydrate(...)           水合（反序列化）                        │
│        ↓                                                        │
│  useQuery(...)          从缓存读取数据，无需请求                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 3.8 本课小结

本节课我们学习了：

1. **SSR 数据传递** - 传统方式 vs TanStack Query 方式
2. **脱水（Dehydrate）** - 服务端将数据状态序列化
3. **水合（Hydrate）** - 客户端将数据状态反序列化
4. **superjson** - 处理 Date、BigInt 等特殊类型
5. **shouldDehydrateQuery** - 决定哪些状态需要脱水
6. **项目中的完整流程** - prefetch → dehydrate → HydrationBoundary

## 3.9 思考题

1. 如果不使用 HydrationBoundary，数据会丢失吗？
2. 什么情况下 pending 状态不需要脱水？
3. superjson 和普通 JSON 有什么区别？

## 3.10 下节课预告

下一节课我们将学习：
- useQuery 基本用法
- queryKey 的重要性
- queryOptions 辅助函数
- 数据状态管理（isLoading、isError、isSuccess）
