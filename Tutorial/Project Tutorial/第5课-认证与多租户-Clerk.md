# 第5课：认证与多租户（Clerk）

## 学习目标
- 掌握 Clerk 用户认证功能
- 理解 Clerk 与 Next.js 的集成方式
- 学会保护路由和获取用户会话
- 掌握组织（Organizations）管理
- 实现数据隔离的多租户架构

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

---

## 一、Clerk 简介

### 什么是 Clerk？

Clerk 是一个现代化的用户认证和用户管理平台，提供：

| 功能 | 描述 |
|------|------|
| **用户认证** | 登录、注册、密码重置、社交登录 |
| **用户管理** | 用户资料、会话管理、安全设置 |
| **组织管理** | 多租户团队、成员邀请、角色权限 |
| **Webhooks** | 用户和组织事件同步 |
| **UI 组件** | 预构建的登录、注册、用户按钮组件 |

### 为什么选择 Clerk？

VoxClone 项目选择 Clerk 的原因：

1. **开箱即用的 UI**：无需手写登录注册页面
2. **组织功能**：原生支持多租户架构
3. **Next.js 集成**：官方提供 Next.js SDK
4. **安全性**：处理 JWT、会话、CSRF 等安全问题
5. **免费额度**：对小型项目友好

### Clerk 与传统认证的对比

| 特性 | Clerk | 传统自建认证 |
|------|-------|--------------|
| 开发时间 | 几小时 | 几周 |
| UI 组件 | 内置 | 需自建 |
| 组织功能 | 原生支持 | 需自行设计 |
| 安全性 | 专业团队维护 | 需自行处理 |
| 定制性 | 有限制 | 完全自由 |

---

## 二、Clerk 配置与安装

### 安装依赖

```bash
npm install @clerk/nextjs
```

项目当前版本：`@clerk/nextjs: ^6.38.1`

### 环境变量配置

**`.env.example`**：
```env
# Clerk 公开密钥（前端可访问）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# Clerk 私密密钥（仅服务端）
CLERK_SECRET_KEY=sk_test_xxx

# 登录页面路径
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

# 注册页面路径
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# 登录后跳转路径
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/

# 注册后跳转路径
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### 获取 Clerk 密钥

1. 访问 [Clerk Dashboard](https://dashboard.clerk.com/)
2. 创建新应用或选择现有应用
3. 在 **API Keys** 页面复制密钥

---

## 三、ClerkProvider 配置

### 根布局集成

**`src/app/layout.tsx`**：
```typescript
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCReactProvider } from "@/trpc/client";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <TRPCReactProvider>
        <html lang="en">
          <body>
            {children}
          </body>
        </html>
      </TRPCReactProvider>
    </ClerkProvider>
  );
}
```

### ClerkProvider 的作用

- 为整个应用提供认证上下文
- 自动处理会话状态
- 提供 `useAuth`、`useUser` 等钩子
- 同步客户端和服务端会话

---

## 四、中间件配置

### 认证中间件

**`src/proxy.ts`**（Clerk 的 middleware 配置文件）：
```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// 定义公开路由（无需认证）
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

// 定义组织选择路由
const isOrgSelectionRoute = createRouteMatcher(["/org-selection(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId } = await auth();

  // 1. 允许公开路由
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. 保护非公开路由
  if (!userId) {
    await auth.protect(); // 自动重定向到登录页
  }

  // 3. 允许组织选择页面
  if (isOrgSelectionRoute(req)) {
    return NextResponse.next();
  }

  // 4. 确保用户已选择组织
  if (userId && !orgId) {
    const orgSelection = new URL("/org-selection", req.url);
    return NextResponse.redirect(orgSelection);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // 跳过 Next.js 内部资源和静态文件
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终对 API 路由运行
    '/(api|trpc)(.*)',
  ],
};
```

### 中间件执行流程

```
请求进入
    ↓
检查是否为公开路由？
    ├── 是 → 放行
    └── 否 → 检查用户是否登录？
                ├── 否 → 重定向到登录页
                └── 是 → 检查是否选择组织？
                            ├── 否 → 重定向到组织选择页
                            └── 是 → 放行
```

### 路由匹配器说明

```typescript
// createRouteMatcher 参数说明
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",      // 匹配 /sign-in 及其子路径
  "/sign-up(.*)",      // 匹配 /sign-up 及其子路径
  "/api/webhooks(.*)", // 匹配 webhook 路由
]);

// matcher 配置说明
matcher: [
  // 排除静态资源和 _next 目录
  '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  // 包含所有 API 和 tRPC 路由
  '/(api|trpc)(.*)',
]
```

---

## 五、登录与注册页面

### 登录页面

**`src/app/sign-in/[[...sign-in]]/page.tsx`**：
```typescript
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
```

### 注册页面

**`src/app/sign-up/[[...sign-up]]/page.tsx`**：
```typescript
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
```

### Catch-all 路由说明

`[[...sign-in]]` 是 Next.js 的可选 catch-all 路由：

- `[[...sign-in]]` 可选匹配：`/sign-in`、`/sign-in/anything`
- `[...sign-in]` 必须匹配：`/sign-in/`、`/sign-in/anything`

Clerk 使用这种方式处理 OAuth 回调等子路径。

### SignIn/SignUp 组件属性

```typescript
<SignIn
  // 登录成功后的跳转路径
  forceRedirectUrl="/dashboard"

  // 外观定制
  appearance={{
    elements: {
      rootBox: "mx-auto",           // 根容器样式
      card: "shadow-lg",            // 卡片样式
      headerTitle: "text-2xl",      // 标题样式
      formButtonPrimary: "bg-primary", // 主按钮样式
    },
  }}

  // 显示的登录方式
  signUpForceRedirectUrl="/sign-up"
/>
```

---

## 六、获取用户会话

### 服务端获取会话

**使用 `auth()` 函数**：

```typescript
import { auth } from "@clerk/nextjs/server";

// 在 Server Component 中
export default async function ServerPage() {
  const { userId, orgId, sessionId } = await auth();

  if (!userId) {
    return <div>请先登录</div>;
  }

  return (
    <div>
      <p>用户 ID: {userId}</p>
      <p>组织 ID: {orgId}</p>
      <p>会话 ID: {sessionId}</p>
    </div>
  );
}
```

**在 API Route 中使用**：

```typescript
// src/app/api/audio/[generationId]/route.ts
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  const { userId, orgId } = await auth();

  // 认证检查
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { generationId } = await params;

  // 使用 orgId 进行数据隔离
  const generation = await prisma.generation.findUnique({
    where: { id: generationId, orgId },  // 关键：使用 orgId 过滤
  });

  if (!generation) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(generation);
}
```

### 客户端获取会话

**使用 `useAuth` 钩子**：

```typescript
"use client";

import { useAuth } from "@clerk/nextjs";

export function AuthStatus() {
  const { isLoaded, isSignedIn, userId, orgId } = useAuth();

  if (!isLoaded) {
    return <div>加载中...</div>;
  }

  if (!isSignedIn) {
    return <div>未登录</div>;
  }

  return (
    <div>
      <p>已登录用户: {userId}</p>
      <p>当前组织: {orgId}</p>
    </div>
  );
}
```

**使用 `useUser` 钩子获取用户信息**：

```typescript
"use client";

import { useUser } from "@clerk/nextjs";

export function UserProfile() {
  const { isLoaded, user } = useUser();

  if (!isLoaded) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <p>姓名: {user?.fullName}</p>
      <p>邮箱: {user?.primaryEmailAddress?.emailAddress}</p>
      <p>头像: {user?.imageUrl}</p>
    </div>
  );
}
```

### auth() 返回值详解

```typescript
const {
  // 用户相关
  userId,        // 用户唯一标识符
  sessionId,     // 当前会话 ID
  sessionClaims, // JWT claims

  // 组织相关
  orgId,         // 当前组织 ID
  orgSlug,       // 当前组织 slug
  orgRole,       // 用户在组织中的角色

  // 状态
  getToken,      // 获取 JWT token 的方法
  has,           // 检查权限的方法
} = await auth();
```

---

## 七、组织管理（Organizations）

### 组织选择页面

**`src/app/org-selection/page.tsx`**：
```typescript
import { OrganizationList } from "@clerk/nextjs";

export default function OrgSelectionPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <OrganizationList
        hidePersonal              // 隐藏个人账户选项
        afterCreateOrganizationUrl="/"  // 创建组织后跳转
        afterSelectOrganizationUrl="/"  // 选择组织后跳转
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
    </div>
  );
}
```

### OrganizationList 组件

```typescript
<OrganizationList
  // 隐藏个人账户（本项目要求必须选择组织）
  hidePersonal={true}

  // 创建组织后的跳转 URL
  afterCreateOrganizationUrl="/"

  // 选择组织后的跳转 URL
  afterSelectOrganizationUrl="/"

  // 外观定制
  appearance={{
    elements: {
      rootBox: "w-full max-w-md",
      card: "shadow-xl",
    },
  }}
/>
```

### 侧边栏组织切换

**`src/features/dashboard/components/dashboard-sidebar.tsx`**：
```typescript
"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        {/* 组织切换器 */}
        <OrganizationSwitcher
          hidePersonal  // 隐藏个人账户
          fallback={
            <Skeleton className="h-8 w-full rounded-md" />
          }
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger: "w-full justify-between bg-white border",
            },
          }}
        />
      </SidebarHeader>

      {/* 用户按钮 */}
      <SidebarFooter>
        <UserButton
          showName
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger: "w-full justify-between",
            },
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
```

### 组织相关组件

| 组件 | 用途 |
|------|------|
| `OrganizationList` | 组织列表和创建 |
| `OrganizationSwitcher` | 组织切换下拉框 |
| `OrganizationProfile` | 组织设置页面 |
| `CreateOrganization` | 创建组织表单 |

---

## 八、多租户数据隔离

### tRPC 中间件实现数据隔离

**`src/trpc/init.ts`**：
```typescript
import { auth } from '@clerk/nextjs/server';
import { initTRPC, TRPCError } from '@trpc/server';

const t = initTRPC.create();

// 基础过程
export const baseProcedure = t.procedure;

// 需要用户认证的过程
export const authProcedure = baseProcedure.use(async ({ next }) => {
  const { userId } = await auth();

  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx: { userId } });
});

// 需要组织的过程（多租户核心）
export const orgProcedure = baseProcedure.use(async ({ next }) => {
  const { userId, orgId } = await auth();

  // 1. 检查用户是否登录
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // 2. 检查用户是否选择了组织
  if (!orgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization required",
    });
  }

  // 3. 将 orgId 注入上下文
  return next({ ctx: { userId, orgId } });
});
```

### 在 Router 中使用 orgProcedure

**`src/trpc/routers/generations.ts`**（示例）：
```typescript
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createTRPCRouter, orgProcedure } from "../init";

export const generationsRouter = createTRPCRouter({
  // 获取当前组织的所有生成记录
  getAll: orgProcedure.query(async ({ ctx }) => {
    // ctx.orgId 自动包含当前组织 ID
    const generations = await prisma.generation.findMany({
      where: { orgId: ctx.orgId },  // 数据隔离！
      orderBy: { createdAt: "desc" },
    });
    return generations;
  }),

  // 创建生成记录（自动绑定组织）
  create: orgProcedure
    .input(
      z.object({
        text: z.string(),
        voiceId: z.string(),
        temperature: z.number(),
        topP: z.number(),
        topK: z.number(),
        repetitionPenalty: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const generation = await prisma.generation.create({
        data: {
          orgId: ctx.orgId,  // 自动绑定组织
          ...input,
        },
      });
      return generation;
    }),

  // 获取单条记录（验证组织归属）
  getById: orgProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const generation = await prisma.generation.findUnique({
        where: {
          id: input.id,
          orgId: ctx.orgId,  // 确保属于当前组织
        },
      });

      if (!generation) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return generation;
    }),
});
```

### 数据隔离流程图

```
用户请求
    ↓
Clerk Middleware 验证用户登录和组织选择
    ↓
tRPC orgProcedure 获取 userId 和 orgId
    ↓
Prisma 查询使用 orgId 过滤
    ↓
返回该组织的数据
```

---

## 九、Clerk UI 组件详解

### UserButton 组件

```typescript
import { UserButton } from "@clerk/nextjs";

<UserButton
  showName              // 显示用户名
  afterSignOutUrl="/"   // 登出后跳转

  appearance={{
    elements: {
      rootBox: "w-full",
      userButtonTrigger: "w-full justify-between bg-white",
      userButtonAvatarBox: "size-6",
    },
  }}
/>
```

### UserButton 功能

- 显示用户头像和名称
- 用户资料管理
- 切换组织
- 登出

### OrganizationSwitcher 组件

```typescript
import { OrganizationSwitcher } from "@clerk/nextjs";

<OrganizationSwitcher
  hidePersonal          // 隐藏个人账户选项
  afterCreateOrganizationUrl="/"  // 创建组织后跳转
  afterSelectOrganizationUrl="/"  // 选择组织后跳转

  // 加载状态占位符
  fallback={<Skeleton className="h-8 w-full" />}

  appearance={{
    elements: {
      rootBox: "w-full",
      organizationSwitcherTrigger: "w-full justify-between",
    },
  }}
/>
```

### 自定义外观

Clerk 组件支持深度自定义：

```typescript
<SignIn
  appearance={{
    // 全局变量
    variables: {
      colorPrimary: "#6366f1",
      colorBackground: "#ffffff",
      colorText: "#1f2937",
      borderRadius: "0.5rem",
    },
    // 元素样式
    elements: {
      rootBox: "mx-auto",
      card: "shadow-xl border",
      headerTitle: "text-2xl font-bold",
      formButtonPrimary: "bg-indigo-500 hover:bg-indigo-600",
      footerActionLink: "text-indigo-500",
    },
  }}
/>
```

---

## 十、项目认证流程分析

### 完整认证流程

```
1. 用户访问 /text-to-speech
         ↓
2. Middleware 检查 isPublicRoute → false
         ↓
3. Middleware 调用 auth() 获取 userId
         ↓
4. userId 不存在 → auth.protect() 重定向到 /sign-in
         ↓
5. 用户在 /sign-in 页面登录
         ↓
6. 登录成功，Clerk 设置会话 Cookie
         ↓
7. 重定向到 / (AFTER_SIGN_IN_URL)
         ↓
8. Middleware 再次检查
         ↓
9. userId 存在，检查 orgId
         ↓
10. orgId 不存在 → 重定向到 /org-selection
         ↓
11. 用户选择或创建组织
         ↓
12. 组织选中，Clerk 设置 orgId
         ↓
13. 重定向到 /
         ↓
14. Middleware 检查通过 → 渲染 Dashboard
```

### 目录结构

```
src/app/
├── layout.tsx           # ClerkProvider 包裹
├── sign-in/
│   └── [[...sign-in]]/
│       └── page.tsx     # 登录页面
├── sign-up/
│   └── [[...sign-up]]/
│       └── page.tsx     # 注册页面
├── org-selection/
│   └── page.tsx         # 组织选择页面
└── (dashboard)/
    ├── layout.tsx       # Dashboard 布局
    └── page.tsx         # Dashboard 首页
```

---

## 实践任务

### 任务目标
创建一个需要认证的用户资料页面，展示当前用户信息和组织信息。

### 具体步骤

#### 步骤 1：创建用户资料页面

创建 `src/app/(dashboard)/profile/page.tsx`：

```typescript
import { auth, currentUser } from "@clerk/nextjs/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  // 获取认证信息
  const { userId, orgId, orgRole } = await auth();

  // 获取完整用户信息
  const user = await currentUser();

  if (!userId || !user) {
    return <div>请先登录</div>;
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">用户资料</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 用户信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>用户信息</CardTitle>
            <CardDescription>您的账户基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={user.imageUrl}
                alt={user.fullName || "Avatar"}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <p className="font-medium">{user.fullName}</p>
                <p className="text-sm text-muted-foreground">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">用户 ID：</span>{userId}</p>
              <p><span className="font-medium">创建时间：</span>
                {user.createdAt?.toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 组织信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>组织信息</CardTitle>
            <CardDescription>当前所在组织</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgId ? (
              <>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">组织 ID：</span>{orgId}</p>
                  <p><span className="font-medium">角色：</span>{orgRole || "成员"}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">未选择组织</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

#### 步骤 2：添加客户端组件交互

创建 `src/app/(dashboard)/profile/client-actions.tsx`：

```typescript
"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function ClientActions() {
  const { isSignedIn, userId, orgId } = useAuth();
  const { openUserProfile, openOrganizationProfile } = useClerk();

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex gap-4 mt-6">
      <Button variant="outline" onClick={() => openUserProfile()}>
        编辑个人资料
      </Button>
      <Button variant="outline" onClick={() => openOrganizationProfile()}>
        组织设置
      </Button>
    </div>
  );
}
```

#### 步骤 3：更新页面使用客户端组件

```typescript
// 在 page.tsx 中导入并使用
import { ClientActions } from "./client-actions";

// 在组件末尾添加
<ClientActions />
```

#### 步骤 4：测试

1. 启动开发服务器：`npm run dev`
2. 访问 http://localhost:3000/profile
3. 验证：
   - 未登录时自动跳转到登录页
   - 登录后显示用户信息
   - 组织信息正确显示
   - 编辑按钮正常工作

### 成功标准
- ✅ 页面受认证保护
- ✅ 正确显示用户信息
- ✅ 正确显示组织信息
- ✅ 客户端交互正常工作

---

## 常见问题 FAQ

### Q: 如何添加社交登录？

A: 在 Clerk Dashboard 中启用 OAuth 提供商：
1. 进入 **Configure** → **SSO Connections**
2. 选择提供商（Google、GitHub 等）
3. 配置 OAuth 凭证
4. 登录页面会自动显示社交登录按钮

### Q: 如何自定义登录页面？

A: Clerk 提供两种方式：
1. **使用预构建组件 + CSS 定制**（推荐）
2. **完全自定义 UI**：使用 `useAuth` 钩子自行构建

### Q: 如何实现角色权限？

A: Clerk 支持组织级别的角色：
```typescript
const { has } = await auth();

// 检查用户是否为管理员
const isAdmin = has({ role: "org:admin" });

// 检查特定权限
const canDelete = has({ permission: "org:voices:delete" });
```

### Q: 用户登出后如何处理？

A: 使用 `signOut` 方法：
```typescript
import { useClerk } from "@clerk/nextjs";

function SignOutButton() {
  const { signOut } = useClerk();

  return (
    <button onClick={() => signOut({ redirectUrl: "/" })}>
      登出
    </button>
  );
}
```

### Q: 如何处理 Webhook 同步？

A: 创建 Webhook 端点同步用户/组织数据：
```typescript
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_signature = headerPayload.get("svix-signature");
  const svix_timestamp = headerPayload.get("svix-timestamp");

  // 验证 webhook 签名...
  // 处理事件：user.created, organization.created 等
}
```

---

## 下一步准备

完成本课程后，你已经：
- ✅ 掌握 Clerk 认证集成
- ✅ 理解中间件路由保护
- ✅ 学会获取用户会话信息
- ✅ 掌握组织管理功能
- ✅ 实现多租户数据隔离

在下一课中，我们将深入学习 tRPC 和 React Query，构建类型安全的 API 层。

---

## 扩展阅读

1. [Clerk 官方文档](https://clerk.com/docs)
2. [Clerk Next.js 集成](https://clerk.com/docs/quickstarts/nextjs)
3. [Clerk Organizations](https://clerk.com/docs/organizations/overview)
4. [Clerk Middleware](https://clerk.com/docs/references/nextjs/overview)

## 作业与思考

1. 尝试添加 Google 社交登录
2. 实现基于角色的权限控制（管理员可删除语音）
3. 创建 Webhook 端点同步用户数据到数据库
4. 思考：如何实现用户邀请功能？

---

**恭喜完成第5课！** 你已经掌握了用户认证和多租户架构的核心概念，为后续的 API 开发学习打下了坚实基础。

> 下一课：[第6课：后端架构（tRPC + React Query）](../Tutorial/第6课-后端架构-tRPC-React-Query.md)
