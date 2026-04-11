# 第三课：定义 Router 与 Procedure

## 3.1 回顾与概述

在第二课中，我们学习了服务端的初始化和中间件设计。我们知道了如何创建 Context、如何配置 superjson、如何设计认证中间件。

本节课我们将学习如何定义具体的 Router 和 Procedure，包括：
- 如何使用 Zod 进行输入验证
- 如何实现 query 和 mutation
- 实际业务逻辑的实现

## 3.2 Router 的层次结构

在 tRPC 中，Router 可以嵌套使用，形成层次结构：

```typescript
// 主应用 Router - 聚合所有子 Router
export const appRouter = createTRPCRouter({
  voices: voicesRouter,        // 声音管理
  generations: generationsRouter, // 语音生成
  billing: billingRouter,      // 账单管理
});

// 调用时：
// trpc.voices.getAll
// trpc.generations.create
// trpc.billing.getStatus
```

这种设计让 API 结构清晰，便于管理。

## 3.3 Zod 输入验证

在 tRPC 中，我们使用 Zod 来验证输入。Zod 是一个 TypeScript 优先的验证库。

### 3.3.1 简单类型验证

```typescript
import { z } from "zod";

// 验证字符串
z.string()

// 验证数字
z.number()

// 验证布尔值
z.boolean()
```

### 3.3.2 基础对象验证

```typescript
// 验证简单对象
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
});

// 验证通过后
userSchema.parse({ id: "123", name: "Tom", age: 20 });
// { id: "123", name: "Tom", age: 20 }
```

### 3.3.3 可选和默认值

```typescript
// 可选字段
const schema = z.object({
  name: z.string(),
  // age 是可选的
  age: z.number().optional(),
});

// 带默认值的字段
const schema = z.object({
  // 如果没有提供 temperature，默认值是 0.8
  temperature: z.number().min(0).max(2).default(0.8),
});
```

### 3.3.4 项目中的实际示例

让我们看看项目中实际使用的验证：

```typescript
// voices.ts - 查询参数
.input(
  z
    .object({
      query: z.string().trim().optional(),
    })
    .optional(),
)

// generations.ts - 创建参数
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
```

**验证规则说明：**

| 规则 | 作用 |
|------|------|
| `.min(1)` | 最小长度/值 |
| `.max(10000)` | 最大长度/值 |
| `.trim()` | 去除首尾空格 |
| `.optional()` | 可选字段 |
| `.default(0.8)` | 默认值 |

## 3.4 Query 的实现

Query 用于获取数据，不会修改服务器状态。

### 3.4.1 简单的 Query

```typescript
// 获取所有用户
getAll: orgProcedure.query(async ({ ctx }) => {
  const users = await prisma.user.findMany({
    where: { orgId: ctx.orgId },
  });
  return users;
}),
```

**结构解析：**

```
orgProcedure           - 使用组织权限中间件
  .query()             - 声明这是一个查询操作
  async ({ ctx }) => { - ctx 包含 userId 和 orgId
    // 业务逻辑
    return data;
  }
```

### 3.4.2 带输入参数的 Query

```typescript
// 根据 ID 获取单个生成记录
getById: orgProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    // input: { id: "xxx" }
    // ctx: { userId, orgId }
    
    const generation = await prisma.generation.findUnique({
      where: { id: input.id, orgId: ctx.orgId },
      omit: { orgId: true, r2ObjectKey: true },
    });

    if (!generation) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    return {
      ...generation,
      audioUrl: `/api/audio/${generation.id}`,
    };
  }),
```

**流程图：**

```
输入验证 → 检查权限 → 查询数据库 → 返回结果
  ↓           ↓           ↓
Zod验证    orgProcedure   Prisma
```

### 3.4.3 带搜索条件的 Query

```typescript
getAll: orgProcedure
  .input(
    z.object({
      query: z.string().trim().optional(),
    }).optional(),
  )
  .query(async ({ ctx, input }) => {
    // 构建搜索过滤条件
    const searchFilter = input?.query
      ? {
          OR: [
            { 
              name: { 
                contains: input.query, 
                mode: "insensitive" as const 
              } 
            },
            {
              description: {
                contains: input.query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};

    // 查询数据
    const voices = await prisma.voice.findMany({
      where: {
        orgId: ctx.orgId,
        ...searchFilter,
      },
    });

    return voices;
  }),
```

### 3.4.4 FAQ：Prisma where 参数

**Q：where 里可以接收的参数有哪些？**

A：Prisma `findMany` 的 `where` 支持以下参数：

```typescript
where: {
  // 1. 字段精确匹配
  id: "xxx",
  id: { not: "xxx" },
  id: { in: ["a", "b"] },
  id: { notIn: ["a", "b"] },

  // 2. 比较运算符
  age: { gt: 18, gte: 21, lt: 65, lte: 64 },

  // 3. 模糊匹配
  name: { contains: "abc" },
  name: { startsWith: "pre", endsWith: "suf" },
  name: { mode: "insensitive" },  // 大小写不敏感

  // 4. 逻辑操作
  AND: [{ condition1 }, { condition2 }],
  // AND 要求数组中的所有条件必须同时满足，记录才会被返回。
  OR: [{ condition1 }, { condition2 }],
  // OR 要求数组中的只要有一个条件满足，记录就会被返回。
  NOT: [{ condition }],
  // NOT 用来排除满足特定条件的记录。

  // 5. 关系查询
  owner: { id: "xxx" },
  owner: { is: { id: "xxx" } },      // 关系存在
  owner: { isNot: { id: "xxx" } },   // 关系不存在
}
```

**示例解析（你的代码）：**

```typescript
where: {
  orgId: ctx.orgId,           // 精确匹配组织
  ...searchFilter,            // 展开搜索条件
}
```

其中 `searchFilter` 是：

```typescript
{
  OR: [
    { name: { contains: "搜索词", mode: "insensitive" } },
    { description: { contains: "搜索词", mode: "insensitive" } }
  ]
}
```

这表示：在当前组织内，搜索名字或描述包含关键词的记录。

## 3.5 Mutation 的实现

Mutation 用于修改数据，会创建、更新或删除资源。

### 3.5.1 简单的 Mutation

```typescript
// 删除声音
delete: orgProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. 验证资源存在且属于当前组织
    const voice = await prisma.voice.findUnique({
      where: {
        id: input.id,
        variant: "CUSTOM",  // 只能删除自定义声音
        orgId: ctx.orgId,   // 只能删除自己组织的
      },
      select: { id: true, r2ObjectKey: true },
    });

    if (!voice) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Voice not found",
      });
    }

    // 2. 删除数据库记录
    await prisma.voice.delete({ where: { id: voice.id } });

    // 3. 删除关联的存储对象（可选）
    if (voice.r2ObjectKey) {
      await deleteAudio(voice.r2ObjectKey).catch(() => {});
    }

    return { success: true };
  }),
```

**关键点说明：**

1. **权限验证** - 确保只能删除自己组织的资源
2. **删除前查询** - 先查询确认存在
3. **级联删除** - 删除关联的存储对象
4. **静默失败** - 使用 `.catch(() => {})` 避免存储删除失败影响主流程

### 3.5.2 复杂的 Mutation（创建语音生成）

这是项目中最复杂的 mutation，包含了完整的业务逻辑：

```typescript
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
    // ============ 第1步：检查订阅状态 ============
    try {
      const customerState = await polar.customers.getStateExternal({
        externalId: ctx.orgId,
      });
      const hasActiveSubscription =
        (customerState.activeSubscriptions ?? []).length > 0;
      
      if (!hasActiveSubscription) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "SUBSCRIPTION_REQUIRED",
        });
      }
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "SUBSCRIPTION_REQUIRED",
      });
    }

    // ============ 第2步：验证声音存在 ============
    const voice = await prisma.voice.findUnique({
      where: {
        id: input.voiceId,
        OR: [
          { variant: "SYSTEM" },  // 系统声音
          { variant: "CUSTOM", orgId: ctx.orgId },  // 或自定义声音
        ],
      },
      select: {
        id: true,
        name: true,
        r2ObjectKey: true,
      },
    });

    if (!voice) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Voice not found",
      });
    }

    if (!voice.r2ObjectKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Voice audio not available",
      });
    }

    // ============ 第3步：调用外部 API 生成音频 ============
    const { data, error } = await chatterbox.POST("/generate", {
      body: {
        prompt: input.text,
        voice_key: voice.r2ObjectKey,
        temperature: input.temperature,
        top_p: input.topP,
        top_k: input.topK,
        repetition_penalty: input.repetitionPenalty,
        norm_loudness: true,
      },
      parseAs: "arrayBuffer",
    });

    if (error || !(data instanceof ArrayBuffer)) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate audio",
      });
    }

    // ============ 第4步：保存到数据库 ============
    const buffer = Buffer.from(data);
    const generation = await prisma.generation.create({
      data: {
        orgId: ctx.orgId,
        text: input.text,
        voiceName: voice.name,
        voiceId: voice.id,
        temperature: input.temperature,
        topP: input.topP,
        topK: input.topK,
        repetitionPenalty: input.repetitionPenalty,
      },
      select: { id: true },
    });

    // ============ 第5步：上传到存储 ============
    const r2ObjectKey = `generations/orgs/${ctx.orgId}/${generation.id}`;
    await uploadAudio({ buffer, key: r2ObjectKey });

    // 更新存储路径
    await prisma.generation.update({
      where: { id: generation.id },
      data: { r2ObjectKey },
    });

    // ============ 第6步：上报用量事件 ============
    polar.events
      .ingest({
        events: [
          {
            name: env.POLAR_METER_TTS_GENERATION,
            externalCustomerId: ctx.orgId,
            metadata: { [env.POLAR_METER_TTS_PROPERTY]: input.text.length },
            timestamp: new Date(),
          },
        ],
      })
      .catch(() => {});

    return { id: generation.id };
  }),
```

**这个 mutation 的执行流程：**

```
输入验证 ──┬──> 检查订阅 ──> 验证声音 ──> 调用外部API ──> 保存数据 ──> 上传存储 ──> 上报用量 ──> 返回
           │        │           │             │            │           │           │
           │        ▼           ▼             ▼            ▼           ▼           ▼
           │    权限检查      数据库         服务         Prisma       R2         Polar
```

## 3.6 错误处理模式

在项目中，我们看到几种常见的错误处理模式：

### 3.6.1 资源不存在

```typescript
if (!resource) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Resource not found",
  });
}
```

### 3.6.2 权限不足

```typescript
if (!hasPermission) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Permission denied",
  });
}
```

### 3.6.3 前置条件不满足

```typescript
if (!resource.ready) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Resource not ready",
  });
}
```

### 3.6.4 静默失败（可选操作）

```typescript
// 尝试删除，失败不抛出错误
await deleteAudio(key).catch(() => {});

// 尝试上报，失败不抛出错误
polar.events.ingest(...).catch(() => {});
```

## 3.7 本课小结

本节课我们学习了：

1. **Router 层次结构** - 如何组织多个子 Router
2. **Zod 输入验证** - 验证规则的定义和使用
3. **Query 实现** - 如何定义获取数据的 API
4. **Mutation 实现** - 如何定义修改数据的 API
5. **复杂业务逻辑** - 完整的语音生成流程
6. **错误处理** - 各种错误场景的处理方式

## 3.8 思考题

1. 在 `create` mutation 中，为什么要先检查订阅状态？
2. 如果没有 `variant: "CUSTOM"` 的检查，会出现什么问题？
  用户只能删除自己创建的声音，不能删除系统声音
3. 为什么要使用 `.catch(() => {})` 处理存储删除失败？

## 3.9 下节课预告

下一节课我们将学习客户端如何调用这些 API，包括：
- 如何配置客户端 Provider
- 如何在组件中使用 hooks 调用 API
- 如何实现服务端渲染的数据预取