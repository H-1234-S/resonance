# 第一课：初识 tRPC - 类型安全的 API 框架

## 1.1 为什么需要 tRPC？

在传统的 Web 开发中，前端和后端通常使用 REST API 进行通信。让我们看看这种方式存在的问题：

### 传统 REST API 的问题

```typescript
// 前端发起请求 - 只能靠文档或猜测
const response = await fetch('/api/users/123');
const user = await response.json();

// 前端不知道返回什么类型，只能靠猜测
// user.name? user.username? user.userName?
// 编译时无法发现错误
```

**问题分析：**
1. 前端不知道后端返回的具体类型
2. 后端修改返回结构，前端只有在运行时才能发现错误
3. API 文档容易过时或不一致

### tRPC 的解决方案

```typescript
// 前端直接调用，类型自动推断
const user = await trpc.users.getById.query({ id: '123' });

// TypeScript 自动知道 user 的类型
// 如果后端改了返回结构，前端编译时就会报错
```

**核心优势：**
1. **端到端类型安全** - 前后端共享类型定义
2. **零 API 层** - 不需要手动编写 API 调用代码
3. **自动类型推断** - 编辑器智能提示

## 1.2 tRPC 核心概念

tRPC 有四个核心概念需要理解：

### 1.2.1 Router（路由）

Router 是 API 的容器，用于组织相关的端点：

```typescript
// 创建一个用户路由
const userRouter = createTRPCRouter({
  getById: ...,
  getAll: ...,
  create: ...,
  update: ...,
  delete: ...,
});

// 创建主应用路由
const appRouter = createTRPCRouter({
  user: userRouter,
  post: postRouter,
});
```

### 1.2.2 Procedure（过程/程序）

Procedure 是具体的 API 端点，有两种类型：

**Query（查询）** - 用于获取数据，类似 GET 请求：

```typescript
const router = createTRPCRouter({
  // 获取用户列表 - 不会修改数据
  getAll: t.procedure.query(() => {
    return db.user.findMany();
  }),
  
  // 获取单个用户 - 不会修改数据
  getById: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return db.user.findUnique({ where: { id: input.id } });
    }),
});
```

**Mutation（变更）** - 用于修改数据，类似 POST/PUT/DELETE：

```typescript
const router = createTRPCRouter({
  // 创建用户 - 会修改数据
  create: t.procedure
    .input(z.object({
      name: z.string(),
      email: z.string(),
    }))
    .mutation(({ input }) => {
      return db.user.create({ data: input });
    }),
  
  // 删除用户 - 会修改数据
  delete: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      return db.user.delete({ where: { id: input.id } });
    }),
});
```

### 1.2.3 Context（上下文）

Context 是在请求生命周期中共享的数据：

```typescript
// 创建 Context
const createContext = async () => {
  // 从请求中获取信息
  const session = await getSession();
  
  return {
    session,
    db: prisma,
  };
};

// 在 Procedure 中使用 Context
const router = createTRPCRouter({
  getProfile: t.procedure.query(({ ctx }) => {
    // ctx 包含 session 和 db
    return ctx.db.user.findUnique({
      where: { id: ctx.session.userId }
    });
  }),
});
```

### 1.2.4 [Middleware（中间件）]((https://trpc.io/docs/server/middlewares))

Middleware 用于在 Procedure 执行前后添加逻辑：

```typescript
// 认证中间件
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session?.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({ ctx });
});

// 创建认证后的 Procedure
export const authProcedure = t.procedure.use(isAuthed);

// 使用认证 Procedure
const router = createTRPCRouter({
  // 只有登录用户才能访问
  getSecretData: authProcedure.query(() => {
    return 'This is secret data';
  }),
});
```

## 1.3 项目中的 tRPC 结构

让我们看看项目中的实际文件结构：

```
src/
├── trpc/
│   ├── init.ts              # 初始化配置
│   ├── query-client.ts      # React Query 配置
│   ├── server.tsx          # 服务端渲染支持
│   ├── client.tsx          # 客户端 Provider
│   └── routers/
│       ├── _app.ts         # 主路由
│       ├── voices.ts       # 声音管理 API
│       ├── generations.ts  # 语音生成 API
│       └── billing.ts      # 账单管理 API
└── app/
    └── api/
        └── trpc/
            └── [trpc]/
                └── route.ts  # API 路由处理
```

## 1.4 tRPC 工作流程

```
┌──────────────────────────────────────────────────────────────┐
│                         请求流程                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   前端                              服务端                    │
│     │                                │                       │
│     │  1. 调用 trpc.xxx.query()     │                       │
│     ├───────────────────────────────►│                       │
│     │                                │                       │
│     │                         2. 验证输入 (Zod)              │
│     │                                │                       │
│     │                         3. 执行 Middleware           │
│     │                                │                       │
│     │                         4. 处理业务逻辑               │
│     │                                │                       │
│     │  5. 返回类型安全的响应         │                       │
│     ◄────────────────────────────────┤                      │
│     │                                │                       │
│     │  6. TypeScript 自动推断类型    │                       │
│     ▼                                ▼                       │
└──────────────────────────────────────────────────────────────┘
```

## 1.5 本课小结

本节课我们学习了：

1. **为什么需要 tRPC** - 解决传统 API 的类型安全问题
2. **四个核心概念**：
   - Router：组织 API 端点的容器
   - Procedure：具体的 API 端点（query/mutation）
   - Context：请求上下文，共享数据
   - Middleware：中间件，添加认证、日志等功能
3. **项目结构** - 了解了项目中 tRPC 的文件组织
4. **工作流程** - 理解了请求的处理流程

## 1.6 思考题

1. tRPC 和传统的 REST API 相比，主要优势是什么？
  实现了端到端的类型安全
2. 什么时候应该使用 query？什么时候应该使用 mutation？
  GET请求用query，其余请求类型用mutation
3. Middleware 可以用来实现哪些功能？
  middleware中间件用来实现验证之类的，例如登录验证，配合auth函数

## 1.7 下节课预告

下一节课我们将深入学习项目的服务端实现，包括：
- 如何初始化 tRPC
- 如何创建认证中间件
- 如何定义具体的 Router 和 Procedure