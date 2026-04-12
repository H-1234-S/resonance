# nuqs 基础与基本用法

## 什么是 nuqs？

nuqs（发音 "knucks"）是一个**类型安全的 URL 查询参数状态管理器**，专为 React 框架设计。它的核心思想是将 React 应用的状态存储在 URL 查询字符串中，实现"URL 即状态"。

### 核心特性

- **类型安全**：端到端的 TypeScript 类型支持
- **框架无关**：支持 Next.js、React Router、Remix、TanStack Router 等
- **内置解析器**：提供常见类型的解析器（integer、float、boolean、Date 等）
- **SSR 支持**：通过适配器支持服务器端渲染
- **历史记录**：支持浏览器历史导航（时间旅行）

## 为什么需要 nuqs？

### 传统方式的痛点

```tsx
// 传统方式：手动解析 URL 参数
function TraditionalComponent() {
  const searchParams = new URLSearchParams(window.location.search);
  const [status, setStatus] = useState(
    searchParams.get('status') ?? 'open'
  );

  // 手动同步状态到 URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (status) {
      params.set('status', status);
    } else {
      params.delete('status');
    }
    window.history.replaceState(null, '', `?${params}`);
  }, [status]);

  // 处理类型需要手动转换
  const [page, setPage] = useState(
    parseInt(searchParams.get('page') ?? '1', 10)
  );
}
```

问题：
1. 字符串操作繁琐
2. 需要手动同步状态和 URL
3. 类型不安全，容易出错
4. null 值处理麻烦

### nuqs 方式

```tsx
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';

function NuqsComponent() {
  const [status, setStatus] = useQueryState(
    'status',
    parseAsString.withDefault('open')
  );
  const [page, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1)
  );

  return (
    <select value={status} onChange={e => setStatus(e.target.value)}>
      <option value="open">Open</option>
      <option value="closed">Closed</option>
    </select>
  );
}
```

## 安装

```bash
npm install nuqs
```

根据使用的框架，还需要安装对应的适配器：

```bash
# Next.js App Router
npm install nuqs

# Next.js Pages Router
npm install nuqs @nuqs/next-pages

# React Router / Remix
npm install nuqs @nuqs/react-router

# TanStack Router
npm install nuqs @nuqs/tanstack-router
```

## 基础用法

### useQueryState 基本使用

```tsx
import { useQueryState } from 'nuqs';

export function Demo() {
  const [name, setName] = useQueryState('name');

  return (
    <>
      <input
        value={name ?? ''}
        onChange={e => setName(e.target.value)}
      />
      <button onClick={() => setName(null)}>Clear</button>
      <p>Hello, {name ?? 'anonymous'}!</p>
    </>
  );
}
```

返回值的含义：
- URL 为 `/` 时：`name` 为 `null`
- URL 为 `/?name=` 时：`name` 为 `''`
- URL 为 `/?name=foo` 时：`name` 为 `'foo'`

### 默认值

```tsx
import { useQueryState, parseAsInteger } from 'nuqs';

// 方式一：通过第二个参数对象
const [search, setSearch] = useQueryState('search', {
  defaultValue: ''
});

// 方式二：通过解析器的 withDefault
const [count, setCount] = useQueryState(
  'count',
  parseAsInteger.withDefault(0)
);

// 带默认值的状态更新更方便
const increment = () => setCount(c => c + 1); // c 类型是 number，而非 number | null
```

**注意**：默认值仅在 React 内部使用，不会写入 URL，除非显式设置。

## 解析器 (Parsers)

nuqs 提供内置解析器处理常见类型：

```tsx
import {
  parseAsString,
  parseAsInteger,
  parseAsFloat,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsArrayOf,
  parseAsJson,
  parseAsStringEnum
} from 'nuqs';

// 整数
const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

// 浮点数
const [price, setPrice] = useQueryState('price', parseAsFloat);

// 布尔值
const [darkMode, setDarkMode] = useQueryState(
  'dark',
  parseAsBoolean.withDefault(false)
);

// 日期
const [date, setDate] = useQueryState(
  'since',
  parseAsIsoDateTime
);

// 数组
const [tags, setTags] = useQueryState(
  'tags',
  parseAsArrayOf(parseAsString)
);

// JSON
const [filters, setFilters] = useQueryState(
  'filters',
  parseAsJson
);

// 字符串枚举
const [status, setStatus] = useQueryState(
  'status',
  parseAsStringEnum(['open', 'closed', 'pending']).withDefault('open')
);
```

## 批量更新 (useQueryStates)

当需要同时管理多个搜索参数时，可以使用 `useQueryStates`：

```tsx
import { useQueryStates, parseAsFloat, parseAsInteger } from 'nuqs';

function MapComponent() {
  const [coords, setCoords] = useQueryStates({
    lat: parseAsFloat.withDefault(45.18),
    lng: parseAsFloat.withDefault(5.72),
    zoom: parseAsInteger.withDefault(10)
  });

  // 批量更新所有参数
  const updateAll = () => {
    setCoords({ lat: 40.71, lng: -74.01, zoom: 12 });
  };

  return (
    <div>
      <p>Lat: {coords.lat}</p>
      <p>Lng: {coords.lng}</p>
      <p>Zoom: {coords.zoom}</p>
    </div>
  );
}
```

## 选项配置 (Options)

### history 历史模式

```tsx
// 默认：replace（替换当前历史记录）
useQueryState('query', parseAsString);

// push（添加新历史记录，可使用浏览器后退按钮）
useQueryState('query', {
  ...parseAsString,
  history: 'push'
});
```

### shallow 浅层路由

```tsx
// 默认 true：不触发服务端渲染
useQueryState('query', parseAsString);

// false：触发服务端重新渲染（RSC）
useQueryState('query', {
  ...parseAsString,
  shallow: false
});
```

### scroll 滚动

```tsx
// 默认 false：不滚动到顶部
useQueryState('page', parseAsInteger);

// true：滚动到页面顶部
useQueryState('page', {
  ...parseAsInteger,
  scroll: true
});
```

### clearOnDefault 清除默认值

```tsx
// 默认 true：值为默认值时从 URL 中移除参数
useQueryState('search', {
  defaultValue: '',
  clearOnDefault: true
});

// false：保留 URL 参数
useQueryState('search', {
  defaultValue: '',
  clearOnDefault: false
});
```

### throttle / debounce 节流防抖

```tsx
import { throttle, debounce } from 'nuqs';

// 节流：立即更新，后续每 500ms 更新一次
useQueryState('page', {
  ...parseAsInteger,
  limitUrlUpdates: throttle(500)
});

// 防抖：等待 500ms 无操作后再更新
useQueryState('search', {
  ...parseAsString,
  limitUrlUpdates: debounce(500)
});
```

### 局部覆盖选项

在调用 setter 时可以局部覆盖选项：

```tsx
const [query, setQuery] = useQueryState('query', parseAsString);

// 这次更新添加历史记录，其他使用默认的 replace
setQuery('new value', { history: 'push' });
```

## 在本项目中的实际用法

参考项目中的 voices 模块：

### 1. 定义解析器（服务端）

```tsx
// src/features/voices/lib/params.ts
import { createSearchParamsCache, parseAsString } from 'nuqs/server';

export const voicesSearchParams = {
  query: parseAsString.withDefault(''),
};

export const voicesSearchParamsCache =
  createSearchParamsCache(voicesSearchParams);
```

**为什么要用 `createSearchParamsCache`？**

`createSearchParamsCache` 是用于**服务端**的 API，它创建一个缓存对象，包含两个核心方法：

| 方法 | 作用 |
|------|------|
| `.parse()` | 解析 URL 参数对象，转换为带类型的值 |
| `.serialize()` | 将值序列化回 URL 参数字符串 |

```tsx
// 1. parse：解析 URL 参数（用于服务端读取）
const { query } = await voicesSearchParamsCache.parse(searchParams);
// searchParams 是 Next.js 传入的 Promise<SearchParams>
// 返回 { query: "用户输入的搜索词" }

// 2. serialize：构建 URL（用于链接跳转）
const url = `/voices?${voicesSearchParamsCache.serialize({ query: "hello" })}`;
// 返回 "query=hello"
```

这个缓存对象的目的是：
- **在服务端 Server Component 中预取 URL 参数**，用于数据预加载（prefetch）
- **在客户端构建跳转链接**时复用解析器逻辑，保证类型一致
- **避免在每个组件中重复定义解析器**

### 2. 服务端预取（Server Component）

在 Next.js App Router 中，页面组件是 Server Component，可以通过 `nuqs/server` 导出的类型和函数来解析 URL 参数。

**SearchParams 类型**：
```tsx
import type { SearchParams } from 'nuqs/server';

// Next.js App Router 的 searchParams 是 Promise<SearchParams>
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  // params.get('key') 返回 string | null
}
```

```tsx
// src/app/(dashboard)/voices/page.tsx
import type { SearchParams } from 'nuqs/server';
import { prefetch, trpc, HydrateClient } from '@/trpc/server';
import { VoicesView } from '@/features/voices/views/voices-view';
import { voicesSearchParamsCache } from '@/features/voices/lib/params';

export default async function VoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { query } = await voicesSearchParamsCache.parse(searchParams);

  prefetch(trpc.voices.getAll.queryOptions({ query }));

  return (
    <HydrateClient>
      <VoicesView />
    </HydrateClient>
  );
}
```

### 3. 客户端使用

```tsx
// src/features/voices/components/voices-toolbar.tsx
import { useQueryState } from 'nuqs';
import { useDebouncedCallback } from 'use-debounce';
import { voicesSearchParams } from '@/features/voices/lib/params';

export function VoicesToolbar() {
  const [query, setQuery] = useQueryState(
    'query',
    voicesSearchParams.query
  );
  const [localQuery, setLocalQuery] = useState(query);

  // 防抖处理
  const debouncedSetQuery = useDebouncedCallback(
    (value: string) => setQuery(value),
    300
  );

  return (
    <input
      value={localQuery}
      onChange={e => {
        setLocalQuery(e.target.value);
        debouncedSetQuery(e.target.value);
      }}
    />
  );
}
```

```tsx
// src/features/voices/views/voices-view.tsx
import { useQueryState } from 'nuqs';
import { useSuspenseQuery } from '@tanstack/react-query';
import { voicesSearchParams } from '../lib/params';

function VoicesContent() {
  const [query] = useQueryState(
    'query',
    voicesSearchParams.query
  );
  const { data } = useSuspenseQuery(
    trpc.voices.getAll.queryOptions({ query })
  );

  return <VoicesList data={data} />;
}
```

## 配置 Adapter

需要在应用的根布局中包裹 NuqsAdapter：

```tsx
// src/app/layout.tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <NuqsAdapter>
          {children}
        </NuqsAdapter>
      </body>
    </html>
  );
}
```

### Adapter Props（全局配置）

`<NuqsAdapter>` 支持一些全局配置：

```tsx
import { NuqsAdapter, throttle } from 'nuqs';

<NuqsAdapter
  defaultOptions={{
    shallow: false,         // 默认浅层路由
    scroll: true,          // 默认滚动到顶部
    clearOnDefault: false,  // 默认不清除
    limitUrlUpdates: throttle(250)  // 全局节流
  }}
  // 处理 URL 参数的中间件
  processUrlSearchParams={(search) => {
    // 字母排序
    search.sort();
    // 添加时间戳
    search.set('ts', Date.now().toString());
    return search;
  }}
>
  {children}
</NuqsAdapter>
```

| Prop | 说明 |
|------|------|
| `defaultOptions` | 全局默认选项 |
| `processUrlSearchParams` | URL 更新前的处理函数 |

## nuqs/server 服务端 API

`nuqs/server` 专门用于服务端环境，导出以下内容：

| 导出 | 用途 |
|------|------|
| `SearchParams` | 类型，Next.js 传入的 URL 参数对象 |
| `createSearchParamsCache` | 创建参数缓存，用于解析/序列化 |
| `parseAsString` | 字符串解析器 |
| `parseAsInteger` | 整数解析器 |
| `parseAsFloat` | 浮点数解析器 |
| `parseAsBoolean` | 布尔解析器 |

## useQueryStates vs useQueryState

项目中只使用了 `useQueryState`，但 `useQueryStates` 管理多个参数更高效：

```tsx
// 项目中的用法：多个 useQueryState
const [query] = useQueryState('query', parseAsString);
const [page] = useQueryState('page', parseAsInteger);

// 推荐的用法：useQueryStates 批量管理
const [{ query, page }, setParams] = useQueryStates({
  query: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1)
});
```

## 优缺点总结

### 优点
- URL 状态可分享、可收藏、可历史导航
- 类型安全，减少运行时错误
- API 简洁，与 useState 使用方式一致
- 支持 SSR，数据脱水/水合

### 缺点
- URL 长度有限制（约 2000 字符）
- 不适合存储大量数据
- 每次更新都会触发浏览器历史记录