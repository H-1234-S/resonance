# 第9课：计费系统（Polar）

## 学习目标
- 理解 Polar 订阅和计费平台
- 掌握用量计量（Metering）机制
- 学会集成 Polar Checkout 和客户门户
- 理解 Webhook 事件处理
- 掌握订阅状态验证

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

---

## 一、Polar 简介

### 什么是 Polar？
Polar 是一个现代化的开源订阅和计费平台，专为开发者设计：

| 特性 | 描述 |
|------|------|
| **用量计量（Metering）** | 基于用量的定价（按字符数、请求数等计费） |
| **订阅管理** | 自动处理订阅周期、续订、取消 |
| **仪表板** | 可视化收入、客户、用量数据 |
| **API 驱动** | 完全通过 API 控制计费流程 |
| **开源** | 代码透明，可自托管 |

### Polar 核心概念

```
┌─────────────────────────────────────────────────────────┐
│                    Polar 计费流程                        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐      ┌─────────────┐      ┌──────────┐ │
│  │   客户      │      │   Polar     │      │  Stripe  │ │
│  │  (用户)     │      │             │      │ (支付)   │ │
│  └──────┬──────┘      └──────┬──────┘      └────┬─────┘ │
│         │                    │                   │      │
│         │ 1. Checkout        │                   │      │
│         ├───────────────────>│                   │      │
│         │                    │                   │      │
│         │ 2. 支付页面        │                   │      │
│         │<───────────────────┤                   │      │
│         │                    │                   │      │
│         │ 3. 支付            │                   │      │
│         ├──────────────────────────────────────>│      │
│         │                    │                   │      │
│         │ 4. 支付成功        │                   │      │
│         │<──────────────────────────────────────┤      │
│         │                    │                   │      │
│         │ 5. 激活订阅        │                   │      │
│         │<───────────────────┤                   │      │
│         │                    │                   │      │
│         │ 6. 上报用量        │                   │      │
│         ├───────────────────>│                   │      │
│         │                    │                   │      │
│         │ 7. 生成账单        │                   │      │
│         │<───────────────────┤                   │      │
│         │                    │                   │      │
│         │ 8. 收取费用        │                   │      │
│         ├──────────────────────────────────────>│      │
│         │                    │                   │      │
│         │ 9. 通知            │                   │      │
│         │<───────────────────┤                   │      │
│  └──────┴────────────────────┴───────────────────┴──────┘ │
└─────────────────────────────────────────────────────────┘
```

### 计费模式对比

| 计费模式 | 描述 | 适用场景 |
|----------|------|----------|
| **一次性费用** | 一次性付费购买 | 简单应用、小项目 |
| **订阅制** | 按月/年固定费用 | SaaS、会员制 |
| **用量计费** | 按使用量计费（字符数、请求数等）| AI服务、API平台 |
| **混合模式** | 订阅+用量（基础费用+超出用量）| 企业级服务 |

**Resonance 使用模式**：用量计费（$0.30 / 1000 字符）

---

## 二、Polar 集成

### 1. 创建 Polar 账户

访问 [polar.sh](https://polar.sh) 或部署 [自托管版本](https://github.com/polarsource/polar)

### 2. 创建产品（Product）

在 Polar 仪表板中：

```
产品名称: Resonance TTS
计费模式: Usage-based（基于用量）
定价:
  - 语音创建: $0.50 / 次
  - TTS 生成: $0.30 / 1000 字符
```

### 3. 创建用量计量器（Meters）

在 Polar 中定义计量器：

| 计量器名称 | 描述 | 定价 |
|-----------|------|------|
| `voice_creation` | 语音创建次数 | $0.50 / 次 |
| `tts_generation` | TTS 生成次数 | $0.10 / 次 |
| `characters` | 生成字符数 | $0.30 / 1000 字符 |

**环境变量配置**：

```env
POLAR_ACCESS_TOKEN=api_key_xxx
POLAR_SERVER=sandbox  # 生产环境用 production
POLAR_PRODUCT_ID=prod_xxx
POLAR_METER_VOICE_CREATION=voice_creation
POLAR_METER_TTS_GENERATION=tts_generation
POLAR_METER_TTS_PROPERTY=characters
```

### 4. SDK 初始化

**`src/lib/polar.ts`**：

```typescript
import { Polar } from "@polar-sh/sdk";
import { env } from "./env";

export const polar = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: env.POLAR_SERVER,  // "sandbox" 或 "production"
});
```

**`src/lib/env.ts`**：

```typescript
export const env = createEnv({
  server: {
    POLAR_ACCESS_TOKEN: z.string().min(1),
    POLAR_SERVER: z.enum(["sandbox", "production"]).default("sandbox"),
    POLAR_PRODUCT_ID: z.string().min(1),
    POLAR_METER_VOICE_CREATION: z.string().min(1),
    POLAR_METER_TTS_GENERATION: z.string().min(1),
    POLAR_METER_TTS_PROPERTY: z.string().min(1),
    // ... 其他环境变量
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

---

## 三、计费路由器（Billing Router）

### 完整代码分析

**`src/trpc/routers/billing.ts`**：

```typescript
import { TRPCError } from "@trpc/server";
import { polar } from "@/lib/polar";
import { env } from "@/lib/env";
import { createTRPCRouter, orgProcedure } from "../init";

export const billingRouter = createTRPCRouter({
  // 1. 创建结账会话
  createCheckout: orgProcedure.mutation(async ({ ctx }) => {
    const result = await polar.checkouts.create({
      products: [env.POLAR_PRODUCT_ID],  // Polar 产品ID
      externalCustomerId: ctx.orgId,      // 外部客户标识（组织ID）
      successUrl: process.env.APP_URL,    // 支付成功后跳转的 URL
    });

    if (!result.url) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create checkout session",
      });
    }

    return { checkoutUrl: result.url };  // 返回支付页面链接
  }),

  // 2. 创建客户门户会话
  createPortalSession: orgProcedure.mutation(async ({ ctx }) => {
    const result = await polar.customerSessions.create({
      externalCustomerId: ctx.orgId,  // 外部客户标识
    });

    if (!result.customerPortalUrl) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create customer portal session",
      });
    }

    return { portalUrl: result.customerPortalUrl };  // 返回客户门户链接
  }),

  // 3. 获取订阅状态
  getStatus: orgProcedure.query(async ({ ctx }) => {
    try {
      const customerState = await polar.customers.getStateExternal({
        externalId: ctx.orgId,  // 外部客户标识
      });

      const hasActiveSubscription =
        (customerState.activeSubscriptions ?? []).length > 0;

      // 计算所有计量器的预估费用
      let estimatedCostCents = 0;
      for (const sub of customerState.activeSubscriptions ?? []) {
        for (const meter of sub.meters ?? []) {
          estimatedCostCents += meter.amount ?? 0;
        }
      }

      return {
        hasActiveSubscription,
        customerId: customerState.id,        // Polar 客户ID
        estimatedCostCents,                  // 预估费用（美分）
      };
    } catch {
      // 客户在 Polar 中不存在（未订阅）
      return {
        hasActiveSubscription: false,
        customerId: null,
        estimatedCostCents: 0,
      };
    }
  }),
});
```

### API 流程图

```
┌─────────────────────────────────────────────────────────┐
│                    前端调用流程                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. 点击"升级"按钮                                        │
│     ↓                                                     │
│  2. trpc.billing.createCheckout.mutation()                │
│     ↓                                                     │
│  3. POST /api/trpc/billing.createCheckout                 │
│     ↓                                                     │
│  4. polar.checkouts.create()                              │
│     ↓                                                     │
│  5. 返回 { checkoutUrl }                                  │
│     ↓                                                     │
│  6. window.location.href = checkoutUrl                    │
│     ↓                                                     │
│  7. 跳转到 Polar 支付页面                                 │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 四、前端组件

### 1. 使用量容器（Usage Container）

**`src/features/billing/components/usage-container.tsx`**：

```typescript
import { useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCheckout } from "@/features/billing/hooks/use-checkout";
import { useTRPC } from "@/trpc/client";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

// 升级卡片（未订阅时显示）
function UpgradeCard() {
  const { checkout, isPending: isCheckoutPending } = useCheckout();

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Pay as you go
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Generate speech starting at $0.30 per 1,000 characters
        </p>
      </div>
      <Button
        variant="outline"
        className="w-full text-xs"
        size="sm"
        disabled={isCheckoutPending}
        onClick={checkout}
      >
        {isCheckoutPending ? (
          <>
            <Spinner className="size-3" />
            Redirecting...
          </>
        ) : (
          "Upgrade"
        )}
      </Button>
    </div>
  );
}

// 使用量卡片（已订阅时显示）
function UsageCard({
  estimatedCostCents
}: {
  estimatedCostCents: number
}) {
  const trpc = useTRPC();
  const portalMutation = useMutation(
    trpc.billing.createPortalSession.mutationOptions({}),
  );

  const openPortal = useCallback(() => {
    portalMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.open(data.portalUrl, "_blank");  // 新窗口打开客户门户
      },
    });
  }, [portalMutation]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Current usage
        </p>
        <p className="text-xl font-bold tracking-tight text-foreground mt-1">
          {formatCurrency(estimatedCostCents)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Estimated this period
        </p>
      </div>
      <Button
        variant="outline"
        className="w-full text-xs"
        size="sm"
        disabled={portalMutation.isPending}
        onClick={openPortal}
      >
        {portalMutation.isPending ? (
          <>
            <Spinner className="size-3" />
            Redirecting...
          </>
        ) : (
          "Manage Subscription"
        )}
      </Button>
    </div>
  );
}

// 主容器组件
export function UsageContainer() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.billing.getStatus.queryOptions());

  return (
    <div className="group-data-[collapsible=icon]:hidden bg-background border border-border rounded-lg p-3">
      {data?.hasActiveSubscription ? (
        <UsageCard estimatedCostCents={data.estimatedCostCents} />
      ) : (
        <UpgradeCard />
      )}
    </div>
  );
}
```

### 2. Checkout Hook

**`src/features/billing/hooks/use-checkout.ts`**：

```typescript
import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useCheckout() {
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.billing.createCheckout.mutationOptions({})
  );

  const checkout = useCallback(() => {
    mutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.checkoutUrl;  // 跳转到支付页面
      },
    });
  }, [mutation]);

  return { checkout, isPending: mutation.isPending };
}
```

### 使用示例

```typescript
"use client";

import { UsageContainer } from "@/features/billing/components/usage-container";

export default function Sidebar() {
  return (
    <aside className="w-64">
      {/* ... 其他菜单项 */}

      <UsageContainer />
    </aside>
  );
}
```

---

## 五、用量上报（Metering）

### 1. 语音创建上报

**`src/trpc/routers/voices.ts`**：

```typescript
import { polar } from "@/lib/polar";
import { env } from "@/lib/env";

create: orgProcedure
  .input(z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    // ... 其他字段
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. 创建语音
    const voice = await prisma.voice.create({
      data: {
        ...input,
        orgId: ctx.orgId,
        variant: "CUSTOM",
      },
    });

    // 2. 上报用量到 Polar
    try {
      await polar.meters.create({
        meterName: env.POLAR_METER_VOICE_CREATION,  // "voice_creation"
        externalCustomerId: ctx.orgId,
        value: 1,  // 创建1次
      });
    } catch (error) {
      console.error("Failed to report metering to Polar:", error);
      // 不阻断语音创建流程
    }

    return voice;
  }),
```

### 2. TTS 生成上报

**`src/trpc/routers/generations.ts`**：

```typescript
import { polar } from "@/lib/polar";
import { env } from "@/lib/env";

create: orgProcedure
  .input(z.object({
    text: z.string().min(1).max(2000),
    voiceId: z.string(),
    // ... 其他字段
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. 检查订阅状态
    const billingStatus = await trpc.billing.getStatus.query();
    if (!billingStatus.hasActiveSubscription) {
      throw new TRPCError({
        code: "PAYMENT_REQUIRED",
        message: "SUBSCRIPTION_REQUIRED",
      });
    }

    // 2. 调用 TTS API 生成音频
    const audioUrl = await generateTTS(input.text, input.voiceId);

    // 3. 创建生成记录
    const generation = await prisma.generation.create({
      data: {
        text: input.text,
        orgId: ctx.orgId,
        voiceId: input.voiceId,
        // ... 其他字段
      },
    });

    // 4. 上报用量到 Polar
    const characterCount = input.text.length;

    try {
      // 上报生成次数
      await polar.meters.create({
        meterName: env.POLAR_METER_TTS_GENERATION,  // "tts_generation"
        externalCustomerId: ctx.orgId,
        value: 1,
      });

      // 上报字符数
      await polar.meters.create({
        meterName: env.POLAR_METER_TTS_PROPERTY,  // "characters"
        externalCustomerId: ctx.orgId,
        value: characterCount,  // 实际字符数
      });
    } catch (error) {
      console.error("Failed to report metering to Polar:", error);
      // 不阻断生成流程
    }

    return {
      id: generation.id,
      audioUrl,
    };
  }),
```

### 用量上报流程

```
┌─────────────────────────────────────────────────────────┐
│                    用量上报流程                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  1. 用户发起 TTS 生成                                     │
│     ↓                                                     │
│  2. 检查订阅状态                                          │
│     ↓                                                     │
│  3. 生成音频文件                                          │
│     ↓                                                     │
│  4. 保存生成记录到数据库                                  │
│     ↓                                                     │
│  5. 计算字符数                                            │
│     ↓                                                     │
│  6. 调用 polar.meters.create({                           │
│        meterName: "characters",                           │
│        externalCustomerId: orgId,                         │
│        value: characterCount                              │
│     })                                                    │
│     ↓                                                     │
│  7. Polar 记录用量                                        │
│     ↓                                                     │
│  8. 周期结束时生成账单                                    │
│     ↓                                                     │
│  9. 自动从 Stripe 收费                                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 六、Webhook 事件处理

### 1. Webhook 验证

使用 `standardwebhooks` 验证 Polar Webhook 签名：

```bash
npm install standardwebhooks
```

### 2. 创建 Webhook 端点

**`src/app/api/webhooks/polar/route.ts`**：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { standardWebhook } from "standardwebhooks";
import { polar } from "@/lib/polar";

const webhookSecret = process.env.POLAR_WEBHOOK_SECRET!;

// 创建 webhook 验证器
const webhook = new standardWebhook({
  secret: webhookSecret,
});

export async function POST(req: NextRequest) {
  try {
    // 1. 验证签名
    const body = await req.text();
    const signature = req.headers.get("polar-signature");

    const event = webhook.verify(body, signature!);

    // 2. 处理事件
    await handleEvent(event);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Polar webhook error:", error);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }
}

async function handleEvent(event: any) {
  switch (event.type) {
    // 订阅事件
    case "subscription.created":
      await handleSubscriptionCreated(event.data);
      break;

    case "subscription.updated":
      await handleSubscriptionUpdated(event.data);
      break;

    case "subscription.deleted":
      await handleSubscriptionDeleted(event.data);
      break;

    // 订阅状态变更
    case "subscription.active":
      await handleSubscriptionActive(event.data);
      break;

    case "subscription.canceled":
      await handleSubscriptionCanceled(event.data);
      break;

    // 用量事件
    case "metered.usage_recorded":
      await handleUsageRecorded(event.data);
      break;

    default:
      console.log("Unhandled Polar event type:", event.type);
  }
}

// 订阅创建
async function handleSubscriptionCreated(subscription: any) {
  const orgId = subscription.customer.external_id;
  console.log(`Subscription created for org: ${orgId}`);

  // 可以在这里更新数据库中的订阅状态
}

// 订阅激活
async function handleSubscriptionActive(subscription: any) {
  const orgId = subscription.customer.external_id;
  console.log(`Subscription activated for org: ${orgId}`);

  // 更新组织订阅状态为"已激活"
  // 可以发送欢迎邮件等
}

// 订阅取消
async function handleSubscriptionCanceled(subscription: any) {
  const orgId = subscription.customer.external_id;
  console.log(`Subscription canceled for org: ${orgId}`);

  // 更新组织订阅状态为"已取消"
  // 可以发送提醒邮件
}

// 用量记录
async function handleUsageRecorded(usage: any) {
  const orgId = usage.subscription.customer.external_id;
  const meterName = usage.meter.name;
  const amount = usage.amount;

  console.log(`Usage recorded for org ${orgId}: ${meterName} = ${amount}`);

  // 可以在这里记录日志或发送通知
}
```

### 3. 环境变量

```env
POLAR_WEBHOOK_SECRET=whsec_xxx
```

### 4. Polar Webhook 配置

在 Polar 仪表板中配置 Webhook：

```
URL: https://your-domain.com/api/webhooks/polar
事件:
  - subscription.created
  - subscription.updated
  - subscription.deleted
  - subscription.active
  - subscription.canceled
  - metered.usage_recorded
```

### 5. 使用 Ngrok 本地测试

```bash
# 安装 ngrok
npm install -g ngrok

# 启动隧道
ngrok http 3000

# 配置 Polar Webhook URL 为:
# https://xxx.ngrok.io/api/webhooks/polar
```

---

## 七、订阅状态验证

### 1. 中间件验证

创建订阅验证中间件：

**`src/trpc/init.ts`**（扩展）：

```typescript
import { polar } from "@/lib/polar";

// 订阅验证中间件
export const subscriptionRequiredProcedure = orgProcedure.use(
  async ({ ctx, next }) => {
    try {
      const customerState = await polar.customers.getStateExternal({
        externalId: ctx.orgId,
      });

      const hasActiveSubscription =
        (customerState.activeSubscriptions ?? []).length > 0;

      if (!hasActiveSubscription) {
        throw new TRPCError({
          code: "PAYMENT_REQUIRED",
          message: "SUBSCRIPTION_REQUIRED",
        });
      }

      // 注入订阅信息
      return next({
        ctx: {
          ...ctx,
          subscription: customerState.activeSubscriptions?.[0],
        },
      });
    } catch {
      throw new TRPCError({
        code: "PAYMENT_REQUIRED",
        message: "SUBSCRIPTION_REQUIRED",
      });
    }
  }
);
```

### 2. 在路由器中使用

```typescript
// 需要订阅的 API
create: subscriptionRequiredProcedure
  .input(z.object({
    text: z.string().min(1),
  }))
  .mutation(async ({ input, ctx }) => {
    // ctx.subscription 可用
    // 执行 TTS 生成逻辑
  }),

// 无需订阅的 API
getPublicVoices: baseProcedure.query(async () => {
  // 返回公开语音
}),
```

### 3. 前端错误处理

```typescript
"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

export function GenerateButton() {
  const trpc = useTRPC();

  const createMutation = useMutation(
    trpc.generations.create.mutationOptions({})
  );

  const handleGenerate = async () => {
    try {
      await createMutation.mutateAsync({ text: "Hello world" });
      toast.success("生成成功");
    } catch (error) {
      if (error instanceof TRPCClientError) {
        if (error.message === "SUBSCRIPTION_REQUIRED") {
          toast.error("需要订阅才能使用此功能", {
            action: {
              label: "升级",
              onClick: () => {
                // 跳转到升级页面
              },
            },
          });
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error("未知错误");
      }
    }
  };

  return <button onClick={handleGenerate}>生成</button>;
}
```

---

## 八、用量限制与配额

### 1. 免费配额

在数据库中添加用量跟踪：

```prisma
model Organization {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique

  // 用量限制
  usageLimit   Int      @default(1000)  // 免费配额：1000 字符
  usageCount   Int      @default(0)     // 已使用字符数

  // 订阅信息
  hasSubscription Boolean @default(false)
  subscriptionExpiry DateTime?         // 订阅过期时间

  @@map("organizations")
}
```

### 2. 检查配额

**`src/lib/usage.ts`**：

```typescript
import { prisma } from "./db";

export async function checkUsageLimit(orgId: string, additionalChars: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { usageLimit: true, usageCount: true, hasSubscription: true },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  // 已订阅用户无限制
  if (org.hasSubscription) {
    return { allowed: true, remaining: Infinity };
  }

  // 检查免费配额
  const newCount = org.usageCount + additionalChars;
  const remaining = org.usageLimit - org.usageCount;

  if (newCount > org.usageLimit) {
    return {
      allowed: false,
      remaining: 0,
      message: `已达到免费配额限制（${org.usageLimit}字符）`
    };
  }

  return { allowed: true, remaining };
}

export async function recordUsage(orgId: string, chars: number) {
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      usageCount: {
        increment: chars,
      },
    },
  });
}
```

### 3. 在 API 中使用

```typescript
create: baseProcedure
  .input(z.object({
    text: z.string().min(1),
  }))
  .mutation(async ({ input, ctx }) => {
    // 1. 检查用量限制
    const usageCheck = await checkUsageLimit(ctx.orgId, input.text.length);
    if (!usageCheck.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: usageCheck.message || "Usage limit exceeded",
      });
    }

    // 2. 生成音频...

    // 3. 记录用量
    await recordUsage(ctx.orgId, input.text.length);

    return result;
  }),
```

---

## 九、仪表板集成

### 1. 使用量图表

使用 `@tremor` 或 `recharts` 创建用量图表：

```typescript
"use client";

import { Card, Metric, Text, AreaChart } from "@tremor/react";

export function UsageChart({ usageData }: { usageData: any[] }) {
  return (
    <Card>
      <Text>本月使用量</Text>
      <Metric>{usageData.reduce((sum, d) => sum + d.value, 0)} 次</Metric>
      <AreaChart
        className="mt-4 h-80"
        data={usageData}
        index="date"
        categories={["value"]}
        colors={["blue"]}
      />
    </Card>
  );
}
```

### 2. 订阅状态展示

```typescript
"use client";

import { Badge } from "@/components/ui/badge";

export function SubscriptionStatusBadge({
  hasActiveSubscription
}: {
  hasActiveSubscription: boolean
}) {
  return hasActiveSubscription ? (
    <Badge variant="outline" className="bg-green-100 text-green-800">
      已订阅
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-gray-100 text-gray-800">
      免费版
    </Badge>
  );
}
```

---

## 十、测试与调试

### 1. 测试结账流程

```typescript
// 在本地环境中测试
const testCheckout = async () => {
  const result = await polar.checkouts.create({
    products: ["prod_test_xxx"],
    externalCustomerId: "test-org-123",
    successUrl: "http://localhost:3000",
  });

  console.log("Checkout URL:", result.url);
};
```

### 2. 测试用量上报

```typescript
const testMetering = async () => {
  await polar.meters.create({
    meterName: "test_meter",
    externalCustomerId: "test-org-123",
    value: 100,
  });

  console.log("Metering reported successfully");
};
```

### 3. Polar CLI 工具

```bash
# 安装 Polar CLI
npm install -g @polar-sh/cli

# 查看客户状态
polar customers list

# 查看用量
polar meters list

# 创建测试订阅
polar subscriptions create --customer test-org-123 --product prod_xxx
```

---

## 实践任务

### 任务目标
创建一个简单的计费系统演示页面，展示订阅状态、用量和升级流程。

### 具体步骤

#### 步骤 1：创建计费页面

创建 `src/app/(dashboard)/billing/page.tsx`：

```typescript
import { trpc, HydrateClient, prefetch } from "@/trpc/server";
import { BillingDashboard } from "@/features/billing/views/billing-dashboard";

export default async function BillingPage() {
  prefetch(trpc.billing.getStatus.queryOptions());

  return (
    <HydrateClient>
      <BillingDashboard />
    </HydrateClient>
  );
}
```

#### 步骤 2：创建仪表板组件

创建 `src/features/billing/views/billing-dashboard.tsx`：

```typescript
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "./utils";

export function BillingDashboard() {
  const trpc = useTRPC();
  const { data: billingStatus } = useSuspenseQuery(
    trpc.billing.getStatus.queryOptions()
  );

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">订阅管理</h1>

      {/* 订阅状态卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>订阅状态</CardTitle>
          <CardDescription>
            当前账户的订阅和用量信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">状态</p>
              {billingStatus.hasActiveSubscription ? (
                <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">
                  已订阅
                </Badge>
              ) : (
                <Badge className="mt-1 bg-gray-100 text-gray-800 hover:bg-gray-100">
                  免费版
                </Badge>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground">本月用量</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(billingStatus.estimatedCostCents)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">客户 ID</p>
              <p className="font-mono text-sm mt-1">
                {billingStatus.customerId || "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* 行动卡片 */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>升级到付费版</CardTitle>
            <CardDescription>
              按使用量计费，$0.30 / 1000 字符
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-4">
              <li>✓ 无用量限制</li>
              <li>✓ 优先支持</li>
              <li>✓ 高级语音模型</li>
              <li>✓ 批量生成</li>
            </ul>
            <Button className="w-full" size="lg" onClick={() => {
              // 触发升级流程
              window.location.href = "/checkout";
            }}>
              立即升级
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>管理订阅</CardTitle>
            <CardDescription>
              查看账单、更新支付方式或取消订阅
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => {
                // 打开客户门户
                window.open("https://polar.sh/portal", "_blank");
              }}
            >
              访问客户门户
            </Button>

            <div className="mt-4 text-sm text-muted-foreground">
              <p>在客户门户中可以：</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>查看历史账单</li>
                <li>更新支付方式</li>
                <li>升级或降级计划</li>
                <li>取消订阅</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

#### 步骤 3：创建工具函数

创建 `src/features/billing/views/utils.ts`：

```typescript
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
```

#### 步骤 4：添加路由

更新 `src/app/(dashboard)/layout.tsx`：

```typescript
import { SidebarNav } from "./components/sidebar-nav";

const sidebarNavItems = [
  { title: "文本转语音", href: "/text-to-speech" },
  { title: "语音管理", href: "/voices" },
  { title: "订阅管理", href: "/billing" },  // 新增
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav items={sidebarNavItems} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

#### 步骤 5：测试

1. 启动开发服务器：`npm run dev`
2. 访问 http://localhost:3000/billing
3. 测试：
   - 查看订阅状态
   - 点击"立即升级"
   - 访问客户门户
   - 切换组织查看数据隔离

### 成功标准
- ✅ 计费页面正常显示
- ✅ 订阅状态正确更新
- ✅ 升级流程正常工作
- ✅ 数据隔离正确（基于 orgId）

---

## 常见问题 FAQ

### Q: Polar 和 Stripe 有什么区别？

A:
| 对比项 | Polar | Stripe |
|--------|-------|--------|
| **定位** | 用量计费、订阅管理 | 支付处理 |
| **功能** | 用量计量、订阅周期管理 | 支付、退款、争议处理 |
| **集成** | 需要配合 Stripe 使用 | 独立支付系统 |
| **定价** | 免费开源 | 按交易收费 |

**Polar 使用 Stripe 处理支付，但提供了更高级的订阅管理功能**。

### Q: 如何处理订阅过期？

A: Polar 会通过 Webhook 通知订阅状态变化：

```typescript
case "subscription.expired":
  // 更新数据库中的订阅状态
  await prisma.organization.update({
    where: { id: orgId },
    data: { hasSubscription: false },
  });

  // 发送邮件通知用户
  await sendEmail({
    to: user.email,
    subject: "Your subscription has expired",
    body: "Please renew your subscription...",
  });
```

### Q: 如何实现试用期？

A: 在 Polar 产品设置中配置试用期，或在 Webhook 中处理：

```typescript
case "subscription.trial_started":
  // 设置试用期结束时间
  await prisma.organization.update({
    where: { id: orgId },
    data: { trialExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
```

### Q: 用量上报失败怎么办？

A: 用量上报不应阻断核心业务流程：

```typescript
try {
  await polar.meters.create({
    meterName: "characters",
    externalCustomerId: orgId,
    value: characterCount,
  });
} catch (error) {
  console.error("Metering failed:", error);
  // 记录到数据库，稍后重试
  await prisma.failedMetering.create({
    data: { orgId, meterName: "characters", value: characterCount },
  });
}
```

可以创建后台任务定期重试失败的上报。

### Q: 如何测试计费流程？

A: 使用 Polar Sandbox 模式：

1. 设置 `POLAR_SERVER=sandbox`
2. 使用测试信用卡号（如 4242 4242 4242 4242）
3. 不会产生真实费用
4. 所有功能与生产环境相同

---

## 下一步准备

完成本课程后，你已经：
- ✅ 理解 Polar 计费系统
- ✅ 掌握用量计量机制
- ✅ 学会集成 Checkout 和客户门户
- ✅ 掌握 Webhook 事件处理
- ✅ 学会订阅状态验证

在下一课中，我们将学习错误追踪与监控，使用 Sentry 实现应用性能监控和错误报告。

---

## 扩展阅读

1. [Polar 官方文档](https://docs.polar.sh)
2. [Polar GitHub](https://github.com/polarsource/polar)
3. [Stripe 定价](https://stripe.com/pricing)
4. [Webhook 安全最佳实践](https://webhooks.fyi/security/best-practices)

## 作业与思考

1. 为免费用户添加每日使用限制（10次/天）
2. 实现用量预警（使用80%时发送通知）
3. 添加订阅历史记录页面
4. 思考：如何实现多货币支持？

---

**恭喜完成第9课！** 你已经掌握了现代化的计费系统实现，为商业化的 SaaS 产品打下了坚实基础。

> 下一课：[第10课：错误追踪与监控（Sentry）](../Tutorial/第10课-错误追踪与监控-Sentry.md)
