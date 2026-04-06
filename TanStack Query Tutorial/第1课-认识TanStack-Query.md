# 第1课：认识 TanStack Query

## 1.1 什么是 TanStack Query？

TanStack Query（原名 React Query）是 React 中最强大的**数据请求与管理库**。

```
官方定义：TanStack Query 是一个为 React 应用提供数据获取、缓存、更新功能的库
```

它能帮你解决：
- 请求状态管理（loading、error、success）
- 数据缓存与更新
- 后台数据刷新
- 请求去重与防抖

## 1.2 为什么需要数据请求库？

在传统 React 开发中，数据请求通常这样写：

```typescript
// 传统方式：手动管理状态
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetch('/api/users')
    .then(res => res.json())
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

if (loading) return <Loading />;
if (error) return <Error />;
return <UserList data={data} />;
```

**问题：**
1. 代码重复 - 每个组件都要写类似的逻辑
2. 状态混乱 - loading、error、data 需要分别管理
3. 缓存难做 - 切换页面后数据丢失
4. 刷新困难 - 需要手动实现后台刷新
5. 竞态条件 - 快速切换时请求顺序混乱

## 1.3 TanStack Query 的解决方案

用 TanStack Query 后：

```typescript
// 使用 TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(res => res.json()),
});

if (isLoading) return <Loading />;
if (error) return <Error />;
return <UserList data={data} />;
```

**优势：**
- 状态自动管理（isLoading、isError、isSuccess）
- 自动缓存（切换页面不丢失）
- 自动后台刷新（数据不过时）
- 请求去重（相同请求不重复发）

## 1.4 核心概念

### 1.4.1 Query（查询）

Query 是"获取数据"的操作，类似 GET 请求：

```typescript
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});
```

**Query 的生命周期：**
```
loading（首次加载） → success（成功） / error（失败）
                      ↓
              stale（数据过期）
                      ↓
              background refetch（后台刷新）
```

### 1.4.2 Mutation（变更）

Mutation 是"修改数据"的操作，类似 POST/DELETE 请求：

```typescript
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: () => {
    // 成功后刷新列表
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});

// 调用
mutation.mutate({ name: 'Tom' });
```

### 1.4.3 Cache（缓存）

TanStack Query 自动缓存请求结果：

```
用户A 请求 /api/users → 缓存到内存
用户B 请求 /api/users → 直接从缓存读取（不发请求）
页面切换 → 缓存仍然存在
```

### 1.4.4 queryKey（查询键）

queryKey 是 Query 的**唯一标识**：

```typescript
// 基础用法
queryKey: ['users']

// 带参数
queryKey: ['users', 'active']           // 获取活跃用户
queryKey: ['user', id]                  // 获取单个用户
queryKey: ['users', { status, page }]   // 带筛选条件
```

**重要原则：** queryKey 决定缓存，相同的 key 共享同一份数据。

## 1.5 项目中的实际使用

让我们看看项目中是如何使用 TanStack Query 的：

### 案例1：查询数据（useQuery）

```typescript
// src/features/billing/components/usage-container.tsx
const { data } = useQuery(trpc.billing.getStatus.queryOptions());
```

### 案例2：创建数据（useMutation）

```typescript
// src/features/text-to-speech/components/text-to-speech-form.tsx
const createMutation = useMutation(
  trpc.generations.create.mutationOptions({}),
);

// 调用
const data = await createMutation.mutateAsync(values);
```

### 案例3：删除后刷新

```typescript
// src/features/voices/components/voice-card.tsx
const deleteMutation = useMutation(
  trpc.voices.delete.mutationOptions({
    onSuccess: () => {
      // 删除成功后刷新列表
      queryClient.invalidateQueries({
        queryKey: trpc.voices.getAll.queryKey(),
      });
    },
  }),
);
```

## 1.6 本课小结

本节课我们学习了：

1. **TanStack Query 是什么** - 数据请求与管理库
2. **为什么需要它** - 解决传统 fetch 的各种痛点
3. **核心概念**：
   - Query：获取数据
   - Mutation：修改数据
   - Cache：自动缓存
   - queryKey：缓存标识
4. **项目中的实际用法**

## 1.7 思考题

1. TanStack Query 和传统的 fetch 相比，主要优势是什么？
2. queryKey 的作用是什么？为什么很重要？
3. Query 和 Mutation 有什么区别？

## 1.8 下节课预告

下一节课我们将学习：
- QueryClient 的创建与配置
- defaultOptions 默认选项
- staleTime 数据新鲜时间
- 项目中的 makeQueryClient 实现
