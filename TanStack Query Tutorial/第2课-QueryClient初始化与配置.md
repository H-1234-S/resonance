# 第2课：QueryClient 初始化与配置

## 2.1 回顾与概述

在第1课中，我们认识了 TanStack Query 的核心概念：Query、Mutation、Cache、queryKey。

本节课我们将学习如何初始化 QueryClient，以及各个配置项的作用。

## 2.2 QueryClient 是什么？

QueryClient 是 TanStack Query 的**核心管理器**，负责：
- 管理所有 Query 的缓存
- 处理请求的发送与响应
- 维护请求状态

```typescript
// 创建一个 QueryClient
const queryClient = new QueryClient();
```

## 2.3 项目中的 makeQueryClient

让我们看看项目中的实际实现：

```typescript
// src/trpc/query-client.ts
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from '@tanstack/react-query';
import superjson from 'superjson';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
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

## 2.4 defaultOptions 默认配置

defaultOptions 用于设置 Query 和 Mutation 的**默认行为**：

```typescript
defaultOptions: {
  queries: { ... },   // Query 的默认配置
  mutations: { ... }, // Mutation 的默认配置
  dehydrate: { ... }, // SSR 脱水配置
  hydrate: { ... },   // SSR 水合配置
}
```

## 2.5 staleTime 数据新鲜时间

### 什么是 staleTime？

staleTime 定义数据被认为"新鲜"的时间长度。在这段时间内，数据不会发起新的请求。

```typescript
queries: {
  staleTime: 30 * 1000,  // 30秒
},
```

### 工作原理

```
时间轴：
T=0:     用户进入页面 → 发起请求 → 获取数据 → 存入缓存
T=0-30s: 用户切换页面 → 直接使用缓存（不发起请求）
T=30s+:  用户再次进入 → 发起新请求（数据已过期）
```

### 为什么要设置 staleTime？

| 场景 | 不设置 | 设置 30s |
|------|--------|----------|
| 用户快速切换页面 | 每次都请求 | 用缓存，不请求 |
| 服务器压力 | 高 | 低 |
| 用户体验 | 可能闪烁 | 流畅 |

### 项目中的配置

```typescript
queries: {
  staleTime: 30 * 1000,  // 30秒内数据是"新鲜"的
},
```

**建议：** 根据实际场景调整：
- 静态数据：可以设置较长（如 5 分钟）
- 频繁变化数据：设置较短或 0

## 2.6 其他常用 Query 配置

### 2.6.1 retry 失败重试

```typescript
queries: {
  retry: 3,  // 请求失败后重试3次
  // 或者用函数
  retry: (failureCount, error) => failureCount < 3,
},
```

### 2.6.2 refetchOnWindowFocus 窗口聚焦刷新

```typescript
queries: {
  refetchOnWindowFocus: true,  // 用户切回页面时刷新
},
```

### 2.6.3 enabled 手动控制请求

```typescript
const { data } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
  enabled: !!id,  // 只有 id 存在时才请求
});
```

### 2.6.4 refetchInterval 定时刷新

```typescript
const { data } = useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchInterval: 60000,  // 每60秒刷新一次
});
```

## 2.7 完整配置示例

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,           // 30秒新鲜
      retry: 3,                       // 失败重试3次
      refetchOnWindowFocus: true,     // 窗口聚焦刷新
      refetchOnReconnect: true,       // 网络重连刷新
    },
    mutations: {
      retry: 1,                       // Mutation 失败重试1次
    },
  },
});
```

## 2.8 本课小结

本节课我们学习了：

1. **QueryClient** - TanStack Query 的核心管理器
2. **defaultOptions** - 默认配置
3. **staleTime** - 数据新鲜时间，理解缓存机制
4. **其他常用配置** - retry、refetchOnWindowFocus 等
5. **项目中的实际配置** - makeQueryClient 实现

## 2.9 思考题

1. staleTime 设置为 0 和 Infinity 有什么区别？
2. 如果请求需要用户手动触发，应该怎么配置？
3. refetchOnWindowFocus 什么时候需要关闭？

## 2.10 下节课预告

下一节课我们将学习：
- SSR 脱水（dehydrate）与水合（hydrate）
- superjson 处理特殊数据类型
- shouldDehydrateQuery 策略
- 为什么需要序列化
