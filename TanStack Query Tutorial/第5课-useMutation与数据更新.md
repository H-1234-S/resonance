# 第5课：useMutation 与数据更新

## 5.1 回顾与概述

在第4课中，我们学习了 useQuery 的用法，这是用于**获取数据**的钩子。

本节课我们将学习 **useMutation**，这是用于**修改数据**的钩子，用于创建、更新、删除操作。

## 5.2 什么是 Mutation？

Mutation 是"变更"操作，用于：
- 创建数据（CREATE）
- 更新数据（UPDATE）
- 删除数据（DELETE）

类似于 REST 中的 POST、PUT、DELETE 请求。

## 5.3 useMutation 基本用法

### 5.3.1 基础语法

```typescript
import { useMutation } from '@tanstack/react-query';

const mutation = useMutation({
  mutationFn: createUser,
});
```

### 5.3.2 调用方式

```typescript
// 方式1：mutate - 不等待结果
mutation.mutate({ name: 'Tom' });

// 方式2：mutateAsync - 等待结果
await mutation.mutateAsync({ name: 'Tom' });
```

### 5.3.3 返回值

```typescript
const mutation = useMutation({ mutationFn: createUser });

mutation.mutate({ name: 'Tom' });

// 常用属性
mutation.isPending    // 是否正在执行
mutation.isSuccess    // 是否成功
mutation.isError      // 是否出错
mutation.error        // 错误对象
mutation.data        // 返回的数据
mutation.reset       // 重置状态
```

## 5.4 mutationFn 执行函数

### 5.4.1 基础用法

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },
});
```

### 5.4.2 项目中的用法

```typescript
// src/features/text-to-speech/components/text-to-speech-form.tsx
const createMutation = useMutation(
  trpc.generations.create.mutationOptions({}),
);

// 调用
const data = await createMutation.mutateAsync({
  text: value.text.trim(),
  voiceId: value.voiceId,
  temperature: value.temperature,
  // ...
});
```

### 5.4.3 mutationOptions

```typescript
// 基础写法
const mutation = useMutation({
  mutationFn: createUser,
});

// 使用 mutationOptions（项目中常用）
const mutation = useMutation(
  trpc.generations.create.mutationOptions({
    onSuccess: () => { ... },
    onError: () => { ... },
  }),
);
```

## 5.5 回调函数

useMutation 提供多个回调函数，用于处理不同阶段：

### 5.5.1 onSuccess - 成功回调

```typescript
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: (data) => {
    console.log('创建成功:', data);
  },
});
```

### 5.5.2 onError - 错误回调

```typescript
const mutation = useMutation({
  mutationFn: createUser,
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### 5.5.3 onSettled - 完成回调

```typescript
const mutation = useMutation({
  mutationFn: createUser,
  onSettled: () => {
    // 无论成功还是失败都会执行
    console.log('请求完成');
  },
});
```

### 5.5.4 回调参数

```typescript
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: (data, variables, context) => {
    // data:     返回的数据
    // variables: 传入的参数
    // context:  上下文（如果设置了）
  },
  onError: (error, variables, context) => {
    // error:    错误对象
    // variables: 传入的参数
    // context:  如果设置了，可以在 onMutate 中设置
  },
});
```

## 5.6 项目中的实际案例

### 5.6.1 案例1：删除声音

```typescript
// src/features/voices/components/voice-card.tsx
const deleteMutation = useMutation(
  trpc.voices.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Voice deleted successfully");
      queryClient.invalidateQueries({
        queryKey: trpc.voices.getAll.queryKey(),
      });
    },
    onError: (error) => {
      toast.error(error.message ?? "Failed to delete voice");
    },
  }),
);

// 调用
<Button
  onClick={() => deleteMutation.mutate({ id: voice.id })}
  disabled={deleteMutation.isPending}
>
  删除
</Button>
```

**要点解析**：
1. 使用 `mutationOptions` 配置回调
2. `onSuccess` 中调用 `invalidateQueries` 刷新列表
3. `onError` 中显示错误提示

### 5.6.2 案例2：生成语音

```typescript
// src/features/text-to-speech/components/text-to-speech-form.tsx
const createMutation = useMutation(
  trpc.generations.create.mutationOptions({}),
);

// 在表单提交中调用
const form = useAppForm({
  onSubmit: async ({ value }) => {
    try {
      const data = await createMutation.mutateAsync({
        text: value.text.trim(),
        voiceId: value.voiceId,
        temperature: value.temperature,
        topP: value.topP,
        topK: value.topK,
        repetitionPenalty: value.repetitionPenalty,
      });

      toast.success("Audio generated successfully!");
      // 处理返回结果...
    } catch (error) {
      // 错误处理
      toast.error(error.message);
    }
  },
});
```

### 5.6.3 案例3：打开支付门户

```typescript
// src/features/billing/components/usage-container.tsx
const portalMutation = useMutation(
  trpc.billing.createPortalSession.mutationOptions({}),
);

const openPortal = useCallback(() => {
  portalMutation.mutate(undefined, {
    onSuccess: (data) => {
      window.open(data.portalUrl, "_blank");
    },
  });
}, [portalMutation]);

// 使用
<Button
  onClick={openPortal}
  disabled={portalMutation.isPending}
>
  {portalMutation.isPending ? "Redirecting..." : "Manage Subscription"}
</Button>
```

## 5.7 Mutation 状态管理

### 5.7.1 状态判断

```typescript
// 是否正在提交
{meleteMutation.isPending && <Spinner />}

// 是否成功（通常用 onSuccess 处理，不在这里判断）
{mutation.isSuccess && "操作成功"}

// 是否出错
{mutation.isError && <Error message={mutation.error.message} />}
```

### 5.7.2 防止重复提交

```typescript
<Button
  onClick={() => mutation.mutate(data)}
  disabled={mutation.isPending}
/>
```

### 5.7.3 重置状态

```typescript
// 如果需要重置 mutation 状态
mutation.reset();
// 会清除 data、error、isSuccess、isError
```

## 5.8 Mutation 与 Query 的区别

| 特性 | Query | Mutation |
|------|-------|----------|
| 用途 | 获取数据 | 修改数据 |
| 自动执行 | ✅ 立即执行 | ❌ 手动触发 |
| 缓存 | ✅ 自动缓存 | ❌ 不缓存 |
| 刷新 | invalidateQueries | 直接调用 |
| 状态 | isLoading | isPending |

## 5.9 本课小结

本节课我们学习了：

1. **Mutation 概念** - 什么是变更操作
2. **useMutation 基本用法** - mutate 和 mutateAsync
3. **mutationFn** - 执行函数
4. **回调函数** - onSuccess、onError、onSettled
5. **项目中的实际案例** - 删除、创建、打开门户
6. **状态管理** - isPending、防重复提交

## 5.10 思考题

1. useQuery 和 useMutation 的主要区别是什么？
2. 为什么不使用 onSuccess 刷新列表，而是用 invalidateQueries？
3. 如何实现乐观更新（Optimistic Update）？

## 5.11 下节课预告

下一节课我们将学习：
- invalidateQueries 数据失效
- queryKey 精确匹配
- 数据同步策略
- 项目中的刷新使用
