# 第4课：useQuery 基础与 queryOptions

## 4.1 回顾与概述

在第3课中，我们学习了 SSR 的脱水与水合机制，理解了数据如何在服务端和客户端之间传递。

本节课我们将学习 TanStack Query 最核心的 API：**useQuery**，这是获取数据的主要方式。

## 4.2 useQuery 基本用法

### 4.2.1 基础语法

```typescript
import { useQuery } from '@tanstack/react-query';

const { data, isLoading, isError, error, isSuccess } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});
```

### 4.2.2 参数解析

| 参数 | 必填 | 说明 |
|------|------|------|
| queryKey | ✅ | 查询的唯一标识 |
| queryFn | ✅ | 获取数据的函数 |
| enabled | ❌ | 是否自动执行 |
| staleTime | ❌ | 数据新鲜时间 |
| retry | ❌ | 失败重试次数 |

### 4.2.3 返回值

```typescript
const result = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

// 常用属性
result.data        // 请求返回的数据
result.isLoading   // 是否正在加载
result.isError     // 是否出错
result.isSuccess   // 是否成功
result.error       // 错误对象
result.refetch     // 手动刷新函数
result.isFetching  // 是否正在后台请求
```

## 4.3 queryKey 的重要性

### 4.3.1 什么是 queryKey？

queryKey 是 Query 的**唯一标识**，用于：
- 缓存数据
- 识别相同的请求
- 触发数据刷新

```typescript
// 基础 key
queryKey: ['users']

// 带参数
queryKey: ['user', '123']           // 获取 ID 为 123 的用户
queryKey: ['users', { status }]    // 带筛选条件
```

### 4.3.2 queryKey 决定缓存

```typescript
// 两个相同的 queryKey 共享缓存
const query1 = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
const query2 = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
// query1 和 query2 使用同一份缓存
```

### 4.3.3 项目中的 queryKey

```typescript
// 项目中通过 tRPC 自动生成 queryKey
trpc.voices.getAll.queryKey()

// 实际生成的 key 类似：
// ['trpc', 'voices.getAll', { input: {...} }]
```

## 4.4 queryOptions 辅助函数

### 4.4.1 为什么需要 queryOptions？

queryOptions 帮助我们：
1. 统一 Query 的配置格式
2. 方便在 SSR 中预取数据
3. 类型安全

### 4.4.2 基础用法

```typescript
import { queryOptions } from '@tanstack/react-query';

// 定义 Query 选项
const userQueryOptions = queryOptions({
  queryKey: ['user', '123'],
  queryFn: () => fetchUser('123'),
});

// 在组件中使用
const { data } = useQuery(userQueryOptions);
```

### 4.4.3 项目中的用法

```typescript
// src/features/billing/components/usage-container.tsx
const { data } = useQuery(trpc.billing.getStatus.queryOptions());

// trpc.billing.getStatus.queryOptions() 返回：
// {
//   queryKey: ['trpc', 'billing.getStatus'],
//   queryFn: () => trpc.billing.getStatus.query(),
// }
```

### 4.4.4 带参数的 queryOptions

```typescript
// 带输入参数
trpc.voices.getAll.queryOptions({ query: 'search' })

// 相当于
queryOptions({
  queryKey: ['trpc', 'voices.getAll', { query: 'search' }],
  queryFn: () => trpc.voices.getAll.query({ query: 'search' }),
})
```

## 4.5 useQuery 的状态管理

### 4.5.1 请求状态

```typescript
const { isLoading, isError, isSuccess, error } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// 渲染逻辑
if (isLoading) return <Loading />;
if (isError) return <Error message={error.message} />;
return <UserList data={data} />;
```

### 4.5.2 状态转换流程

```
┌────────────┐
│  isPending  │  ← 初始状态（第一次请求）
└──────┬─────┘
       │
       ↓
  ┌────┴────┐
  │         │
 ↓          ↓
isError   isSuccess
  │         │
  └────┬────┘
       │
       ↓
   后续请求：isFetching (后台请求中)
```

### 4.5.3 isPending vs isLoading

| 状态 | 含义 | 使用场景 |
|------|------|----------|
| isPending | 首次加载/没有缓存 | 首次渲染 |
| isFetching | 任何请求（包括缓存） | 刷新加载 |

```typescript
// 首次加载时显示骨架屏
{isPending ? (
  <Skeleton />
) : isError ? (
  <Error />
) : (
  <List data={data} />
)}

// 刷新时显示加载状态
{isFetching && !isPending ? (
  <RefreshIndicator />
) : null}
```

## 4.6 useSuspenseQuery

### 4.6.1 什么是 Suspense？

Suspense 是 React 的** suspense** 特性，配合 TanStack Query 可以：
- 使用 React 的 error boundary 处理错误
- 使用 `<Suspense>` 组件处理加载状态

### 4.6.2 useSuspenseQuery vs useQuery

```typescript
// useQuery - 手动处理状态
const { data, isPending, isError } = useQuery(options);

// useSuspenseQuery - 信任数据一定存在
const { data } = useSuspenseQuery(options);
// - 不会返回 isPending（假设数据已存在）
// - 错误会抛出给 error boundary
```

### 4.6.3 项目中的用法

```typescript
// src/features/text-to-speech/views/text-to-speech-view.tsx
const { data: voices } = useSuspenseQuery(trpc.voices.getAll.queryOptions());

// 使用场景：数据已经在 SSR 阶段预取并脱水
// 不需要处理 loading 状态
```

### 4.6.4 何时使用？

| 场景 | 推荐 |
|------|------|
| SSR 预取数据 | useSuspenseQuery |
| 需要手动处理 loading | useQuery |
| 数据可能不存在 | useQuery |

## 4.7 项目中的实际案例

### 4.7.1 案例1：账单状态查询

```typescript
// src/features/billing/components/usage-container.tsx
export function UsageContainer() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.billing.getStatus.queryOptions());

  return (
    <div>
      {data?.hasActiveSubscription ? (
        <UsageCard estimatedCostCents={data.estimatedCostCents} />
      ) : (
        <UpgradeCard />
      )}
    </div>
  );
}
```

**解析**：
- 使用 `queryOptions()` 获取配置
- 数据来自 SSR 预取，所以用 useQuery
- 直接使用 `data`，不需要处理 loading

### 4.7.2 案例2：voices 列表查询

```typescript
// src/app/(dashboard)/voices/page.tsx
export default async function VoicesPage({ searchParams }) {
  const { query } = await voicesSearchParamsCache.parse(searchParams);

  // 预取数据
  prefetch(trpc.voices.getAll.queryOptions({ query }));

  return (
    <HydrateClient>
      <VoicesView />
    </HydrateClient>
  );
}

// src/features/voices/views/voices-view.tsx
export function VoicesView() {
  const trpc = useTRPC();
  const { query } = useQueryState('query');

  const { data, isLoading } = useSuspenseQuery(
    trpc.voices.getAll.queryOptions({ query })
  );

  // useQueryState 用于 URL 参数同步
}
```

**流程解析**：
1. 服务端 `prefetch` 预取数据
2. `HydrateClient` 脱水传给客户端
3. `useSuspenseQuery` 水合获取数据

## 4.8 本课小结

本节课我们学习了：

1. **useQuery 基础** - 基本用法和返回值
2. **queryKey 的重要性** - 缓存的核心
3. **queryOptions 辅助函数** - 统一配置格式
4. **状态管理** - isPending、isLoading、isError、isSuccess
5. **useSuspenseQuery** - SSR 场景的使用
6. **项目中的实际案例**

## 4.9 思考题

1. queryKey 相同但 queryFn 不同会发生什么？
2. useSuspenseQuery 适用于什么场景？
3. 如何实现带参数的搜索查询？

## 4.10 下节课预告

下一节课我们将学习：
- useMutation 基本用法
- mutationFn 执行函数
- onSuccess/onError 回调
- 数据失效与刷新
