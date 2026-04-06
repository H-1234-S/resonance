# 第4课：数据库设计与 Prisma ORM

## 学习目标
- 掌握 PostgreSQL 数据库的基本概念和连接配置
- 学会使用 Prisma Schema 定义数据模型
- 理解关系建模（语音、生成记录等）
- 掌握数据库迁移的生成与应用
- 学会使用 Prisma Client 进行 CRUD 操作
- 理解数据库种子脚本的作用和实现

## 课程时长
预计 2-3 小时（包括理论学习与实践操作）

## PostgreSQL 数据库基础

### 什么是 PostgreSQL？
PostgreSQL 是一个功能强大的开源关系型数据库管理系统：
- **ACID 合规**：支持事务、隔离级别、原子性
- **扩展性强**：支持自定义类型、函数、索引
- **JSON 支持**：原生支持 JSON 和 JSONB 类型
- **全文搜索**：内置全文搜索功能
- **高并发**：支持多版本并发控制（MVCC）

### 为什么选择 PostgreSQL？
Resonance 项目选择 PostgreSQL 的原因：
1. **与 Prisma 完美集成**：Prisma 对 PostgreSQL 支持最完善
2. **数据完整性**：强类型约束确保数据质量
3. **开源免费**：无许可费用，社区活跃
4. **云服务支持**：各大云平台都有托管服务

### 数据库连接配置

**环境变量** (`.env`)：
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/resonance?schema=public"
```

**连接字符串格式**：
```
postgresql://[用户名]:[密码]@[主机]:[端口]/[数据库名]?schema=[模式名]
```

## Prisma ORM 深度解析

### 什么是 Prisma？
Prisma 是下一代 Node.js 和 TypeScript ORM：
- **类型安全**：自动生成 TypeScript 类型
- **直观的 API**：无需手写 SQL
- **迁移管理**：版本化的数据库迁移
- **开发工具**：Prisma Studio 可视化管理

### Prisma 项目结构

```
prisma/
├── schema.prisma        # 数据模型定义
└── migrations/          # 迁移文件
    └── 20260222040408_init/
        └── migration.sql

src/
├── generated/
│   └── prisma/
│       └── client/      # 自动生成的 Prisma Client
└── lib/
    └── db.ts            # Prisma Client 实例
```

### Prisma Schema 配置

**`prisma/schema.prisma`**：
```prisma
// Prisma Client 生成器配置
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"  // 输出到 src 目录
}

// 数据源配置
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // 从环境变量读取
}
```

## 数据模型定义

### 枚举类型（Enum）

定义固定的选项集合：

```prisma
// 语音变体类型
enum VoiceVariant {
  SYSTEM    // 系统内置语音
  CUSTOM    // 用户自定义语音
}

// 语音分类
enum VoiceCategory {
  AUDIOBOOK         // 有声书
  CONVERSATIONAL    // 对话
  CUSTOMER_SERVICE  // 客服
  GENERAL           // 通用
  NARRATIVE         // 叙事
  CHARACTERS        // 角色配音
  MEDITATION        // 冥想
  MOTIVATIONAL      // 激励
  PODCAST           // 播客
  ADVERTISING       // 广告
  VOICEOVER         // 旁白
  CORPORATE         // 企业
}
```

### Voice 模型

语音模型存储系统语音和用户自定义语音：

```prisma
model Voice {
  id String @id @default(cuid())    // 主键，自动生成 CUID

  orgId String?                     // 组织ID（系统语音为 null）

  name        String                // 语音名称
  description String?               // 语音描述
  category    VoiceCategory @default(GENERAL)  // 分类
  language    String        @default("en-US")  // 语言
  variant     VoiceVariant          // 变体类型
  r2ObjectKey String?               // R2 存储键（音频文件）

  generations Generation[]          // 关联的生成记录

  createdAt DateTime @default(now())  // 创建时间
  updatedAt DateTime @updatedAt      // 更新时间

  @@index([variant])  // 变体索引
  @@index([orgId])    // 组织索引
}
```

**字段详解**：
- `@id`：标记为主键
- `@default(cuid())`：默认生成唯一标识符
- `String?`：可选字段（可为 null）
- `@default(value)`：设置默认值
- `@@index([field])`：创建数据库索引

### Generation 模型

生成记录模型存储每次 TTS 生成的信息：

```prisma
model Generation {
  id String @id @default(cuid())

  orgId String                      // 组织ID（必填）

  voiceId String?                   // 语音ID
  voice   Voice?  @relation(fields: [voiceId], references: [id], onDelete: SetNull)

  text              String          // 输入文本
  voiceName         String          // 语音名称（冗余存储）
  r2ObjectKey       String?         // R2 存储键
  temperature       Float           // 温度参数
  topP              Float           // Top-P 参数
  topK              Int             // Top-K 参数
  repetitionPenalty Float           // 重复惩罚

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId])   // 组织索引
  @@index([voiceId]) // 语音索引
}
```

### 关系详解

**一对多关系**：
```prisma
// Voice 模型（一）
model Voice {
  id          String       @id
  generations Generation[] // 一个语音有多个生成记录
}

// Generation 模型（多）
model Generation {
  id      String  @id
  voiceId String?                   // 外键
  voice   Voice?  @relation(
    fields: [voiceId],              // 本表字段
    references: [id],               // 关联表字段
    onDelete: SetNull               // 删除行为：设为 null
  )
}
```

**删除行为选项**：
- `Cascade`：级联删除，删除语音时同时删除关联记录
- `SetNull`：设为 null，删除语音时关联记录的 voiceId 设为 null
- `Restrict`：限制删除，有关联记录时禁止删除
- `NoAction`：无操作，依赖数据库默认行为

## 数据库迁移

### 什么是迁移？
迁移是将 Schema 变更应用到数据库的方式：
- **版本控制**：每次变更都有记录
- **可回滚**：可以撤销变更
- **团队协作**：共享数据库变更历史

### 迁移命令

**创建迁移**：
```bash
npx prisma migrate dev --name init
```

**生成迁移文件** (`prisma/migrations/20260222040408_init/migration.sql`)：
```sql
-- CreateEnum
CREATE TYPE "VoiceVariant" AS ENUM ('SYSTEM', 'CUSTOM');

CREATE TYPE "VoiceCategory" AS ENUM (
  'AUDIOBOOK', 'CONVERSATIONAL', 'CUSTOMER_SERVICE',
  'GENERAL', 'NARRATIVE', 'CHARACTERS',
  'MEDITATION', 'MOTIVATIONAL', 'PODCAST',
  'ADVERTISING', 'VOICEOVER', 'CORPORATE'
);

-- CreateTable
CREATE TABLE "Voice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "VoiceCategory" NOT NULL DEFAULT 'GENERAL',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "variant" "VoiceVariant" NOT NULL,
    "r2ObjectKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "voiceId" TEXT,
    "text" TEXT NOT NULL,
    "voiceName" TEXT NOT NULL,
    "r2ObjectKey" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL,
    "topP" DOUBLE PRECISION NOT NULL,
    "topK" INTEGER NOT NULL,
    "repetitionPenalty" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Voice_variant_idx" ON "Voice"("variant");
CREATE INDEX "Voice_orgId_idx" ON "Voice"("orgId");
CREATE INDEX "Generation_orgId_idx" ON "Generation"("orgId");
CREATE INDEX "Generation_voiceId_idx" ON "Generation"("voiceId");

-- AddForeignKey
ALTER TABLE "Generation"
ADD CONSTRAINT "Generation_voiceId_fkey"
FOREIGN KEY ("voiceId") REFERENCES "Voice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

### 常用迁移命令

```bash
# 开发环境：创建并应用迁移
npx prisma migrate dev --name add_user_table

# 生产环境：应用迁移（不会创建新迁移）
npx prisma migrate deploy

# 重置数据库（删除所有数据）
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status

# 从现有数据库生成 Schema
npx prisma db pull
```

## Prisma Client 使用

### 初始化 Prisma Client

**`src/lib/db.ts`**：
```typescript
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

// 使用 PostgreSQL 适配器
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

// 开发环境单例模式，避免热重载创建多个连接
const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { prisma };
```

### CRUD 操作

#### 创建（Create）

**创建单条记录**：
```typescript
// 创建语音
const voice = await prisma.voice.create({
  data: {
    name: "My Voice",
    variant: "CUSTOM",
    orgId: "org_123",
    description: "A custom voice",
    category: "CONVERSATIONAL",
    language: "en-US",
  },
});

// 创建并选择返回字段
const voice = await prisma.voice.create({
  data: {
    name: "My Voice",
    variant: "CUSTOM",
    orgId: "org_123",
  },
  select: {
    id: true,
    name: true,
  },
});
```

#### 读取（Read）

**查询单条记录**：
```typescript
// 通过 ID 查询
const voice = await prisma.voice.findUnique({
  where: { id: "voice_123" },
});

// 条件查询第一条
const voice = await prisma.voice.findFirst({
  where: {
    variant: "SYSTEM",
    name: "Aaron",
  },
});

// 条件查询并排除字段
const generation = await prisma.generation.findUnique({
  where: { id: input.id, orgId: ctx.orgId },
  omit: {
    orgId: true,
    r2ObjectKey: true,
  },
});
```

**查询多条记录**：
```typescript
// 查询所有
const voices = await prisma.voice.findMany();

// 条件查询
const voices = await prisma.voice.findMany({
  where: {
    variant: "SYSTEM",
    category: "AUDIOBOOK",
  },
});

// 排序
const generations = await prisma.generation.findMany({
  where: { orgId: ctx.orgId },
  orderBy: { createdAt: "desc" },
});

// 模糊搜索
const voices = await prisma.voice.findMany({
  where: {
    name: {
      contains: "John",
      mode: "insensitive", // 不区分大小写
    },
  },
});

// 选择返回字段
const voices = await prisma.voice.findMany({
  select: {
    id: true,
    name: true,
    category: true,
  },
});
```

**复合条件查询**：
```typescript
// OR 条件
const voice = await prisma.voice.findUnique({
  where: {
    id: input.voiceId,
    OR: [
      { variant: "SYSTEM" },
      { variant: "CUSTOM", orgId: ctx.orgId },
    ],
  },
});

// AND 条件
const voices = await prisma.voice.findMany({
  where: {
    variant: "CUSTOM",
    orgId: ctx.orgId,
    AND: [
      { name: { contains: "My" } },
      { category: "CONVERSATIONAL" },
    ],
  },
});
```

#### 更新（Update）

**更新记录**：
```typescript
// 更新单条记录
const voice = await prisma.voice.update({
  where: { id: "voice_123" },
  data: {
    name: "Updated Name",
    description: "New description",
  },
});

// 条件更新
const result = await prisma.voice.updateMany({
  where: { orgId: "org_123" },
  data: { language: "en-GB" },
});

// 更新或创建
const voice = await prisma.voice.upsert({
  where: { id: "voice_123" },
  update: { name: "Updated" },
  create: {
    id: "voice_123",
    name: "New Voice",
    variant: "CUSTOM",
  },
});
```

#### 删除（Delete）

**删除记录**：
```typescript
// 删除单条记录
const voice = await prisma.voice.delete({
  where: { id: "voice_123" },
});

// 条件删除
const result = await prisma.voice.deleteMany({
  where: { orgId: "org_123" },
});
```

### 关联查询

**包含关联数据**：
```typescript
// 查询语音及其生成记录
const voice = await prisma.voice.findUnique({
  where: { id: "voice_123" },
  include: {
    generations: {
      take: 10,
      orderBy: { createdAt: "desc" },
    },
  },
});
```

### 事务操作

**交互式事务**：
```typescript
const result = await prisma.$transaction(async (tx) => {
  // 创建生成记录
  const generation = await tx.generation.create({
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
  });

  // 更新语音记录
  await tx.voice.update({
    where: { id: voice.id },
    data: { lastUsedAt: new Date() },
  });

  return generation;
});
```

**回滚事务**：
```typescript
try {
  const generation = await prisma.generation.create({
    data: { /* ... */ },
  });

  // 上传文件失败，回滚数据库操作
  await uploadAudio();
} catch (error) {
  // 删除已创建的记录
  await prisma.generation.delete({
    where: { id: generation.id },
  });
  throw error;
}
```

## 项目中的 Prisma 实践

### 数据隔离（多租户）

通过 `orgId` 实现数据隔离：

```typescript
// generations router
export const generationsRouter = createTRPCRouter({
  // 获取组织的生成记录
  getAll: orgProcedure.query(async ({ ctx }) => {
    const generations = await prisma.generation.findMany({
      where: { orgId: ctx.orgId },  // 只查询当前组织的数据
      orderBy: { createdAt: "desc" },
    });
    return generations;
  }),

  // 创建生成记录
  create: orgProcedure
    .input(/* ... */)
    .mutation(async ({ input, ctx }) => {
      // 创建时绑定组织ID
      const generation = await prisma.generation.create({
        data: {
          orgId: ctx.orgId,  // 绑定当前组织
          // ... 其他字段
        },
      });
      return generation;
    }),
});
```

### 并行查询优化

使用 `Promise.all` 并行执行多个查询：

```typescript
// voices router
getAll: orgProcedure
  .input(z.object({ query: z.string().optional() }).optional())
  .query(async ({ ctx, input }) => {
    // 并行查询自定义语音和系统语音
    const [custom, system] = await Promise.all([
      prisma.voice.findMany({
        where: { variant: "CUSTOM", orgId: ctx.orgId },
      }),
      prisma.voice.findMany({
        where: { variant: "SYSTEM" },
      }),
    ]);

    return { custom, system };
  }),
```

## 种子脚本

### 什么是种子脚本？
种子脚本用于初始化数据库数据：
- **开发环境**：填充测试数据
- **生产环境**：预置系统数据

### 项目中的种子脚本

**`scripts/seed-system-voices.ts`**：
```typescript
import { PrismaClient, type VoiceCategory } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

// 系统语音元数据
const systemVoiceMetadata: Record<string, VoiceMetadata> = {
  Aaron: {
    description: "Soothing and calm, like a self-help audiobook narrator",
    category: "AUDIOBOOK",
    language: "en-US",
  },
  // ... 更多语音
};

async function seedSystemVoice(name: string) {
  // 检查是否已存在
  const existingSystemVoice = await prisma.voice.findFirst({
    where: { variant: "SYSTEM", name },
  });

  if (existingSystemVoice) {
    // 更新现有语音
    await prisma.voice.update({
      where: { id: existingSystemVoice.id },
      data: {
        description: meta.description,
        category: meta.category,
        language: meta.language,
      },
    });
    return;
  }

  // 创建新语音
  const voice = await prisma.voice.create({
    data: {
      name,
      variant: "SYSTEM",
      orgId: null,  // 系统语音不属于任何组织
      ...meta,
    },
  });
}

async function main() {
  console.log("Seeding system voices...");

  for (const name of CANONICAL_SYSTEM_VOICE_NAMES) {
    await seedSystemVoice(name);
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error("Failed to seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 运行种子脚本

```bash
# 运行种子脚本
npx tsx scripts/seed-system-voices.ts

# 或者在 package.json 中定义脚本
npm run seed
```

## Prisma Studio

Prisma Studio 是一个可视化数据库管理工具：

```bash
# 启动 Prisma Studio
npx prisma studio
```

功能：
- 浏览所有表和数据
- 编辑记录
- 过滤和搜索
- 查看关系

## 实践任务

### 任务目标
设计并实现一个用户反馈（Feedback）数据模型，包括数据库迁移、Prisma 操作和简单的 API。

### 具体步骤

#### 步骤 1：修改 Prisma Schema
在 `prisma/schema.prisma` 中添加 Feedback 模型：

```prisma
model Feedback {
  id String @id @default(cuid())

  orgId String                       // 组织ID

  message    String                  // 反馈内容
  rating     Int                     // 评分 (1-5)
  status     FeedbackStatus @default(PENDING)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orgId])
  @@index([status])
}

enum FeedbackStatus {
  PENDING
  REVIEWED
  RESOLVED
}
```

#### 步骤 2：创建数据库迁移
```bash
npx prisma migrate dev --name add_feedback
```

#### 步骤 3：创建 Feedback Router
创建 `src/trpc/routers/feedback.ts`：

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createTRPCRouter, orgProcedure } from "../init";

export const feedbackRouter = createTRPCRouter({
  // 获取所有反馈
  getAll: orgProcedure.query(async ({ ctx }) => {
    const feedbacks = await prisma.feedback.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: "desc" },
    });
    return feedbacks;
  }),

  // 创建反馈
  create: orgProcedure
    .input(
      z.object({
        message: z.string().min(10),
        rating: z.number().int().min(1).max(5),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const feedback = await prisma.feedback.create({
        data: {
          orgId: ctx.orgId,
          message: input.message,
          rating: input.rating,
        },
      });
      return feedback;
    }),

  // 更新反馈状态
  updateStatus: orgProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "REVIEWED", "RESOLVED"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const feedback = await prisma.feedback.update({
        where: { id: input.id, orgId: ctx.orgId },
        data: { status: input.status },
      });
      return feedback;
    }),
});
```

#### 步骤 4：注册 Router
在 `src/trpc/routers/_app.ts` 中添加：

```typescript
import { feedbackRouter } from "./feedback";

export const appRouter = createTRPCRouter({
  // ... 其他 routers
  feedback: feedbackRouter,
});
```

#### 步骤 5：测试
1. 运行迁移：`npx prisma migrate dev`
2. 启动开发服务器：`npm run dev`
3. 使用 Prisma Studio 查看数据：`npx prisma studio`

### 成功标准
- ✅ 迁移成功创建并应用
- ✅ 数据库表正确创建
- ✅ Prisma Client 可以正常操作数据
- ✅ API 端点可以正常调用
- ✅ 数据隔离正确实现

## 常见问题 FAQ

### Q: Prisma Client 报错 "Cannot find module"？
A: 运行 `npx prisma generate` 重新生成 Client。

### Q: 迁移失败怎么办？
A: 检查数据库连接，查看错误信息，必要时运行 `npx prisma migrate reset`。

### Q: 如何查看生成的 SQL？
A: 使用 `prisma.$queryRaw` 或设置日志级别：
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Q: 如何处理 N+1 查询问题？
A: 使用 `include` 预加载关联数据，避免循环查询。

### Q: 数据库连接池如何配置？
A: 在连接字符串中添加参数：
```
postgresql://user:pass@host:5432/db?connection_limit=10
```

## 下一步准备

完成本课程后，你已经：
- ✅ 掌握 PostgreSQL 数据库基础
- ✅ 学会使用 Prisma 定义数据模型
- ✅ 理解关系建模和索引
- ✅ 掌握数据库迁移操作
- ✅ 学会使用 Prisma Client 进行 CRUD 操作
- ✅ 完成实践任务，创建了反馈模型

在下一课中，我们将深入学习认证与多租户（Clerk），理解用户认证和组织管理。

## 扩展阅读

1. [Prisma 官方文档](https://www.prisma.io/docs)
2. [PostgreSQL 官方文档](https://www.postgresql.org/docs)
3. [Prisma Schema 参考](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
4. [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

## 作业与思考

1. 为 Feedback 模型添加用户关联（与 Clerk 用户 ID 关联）
2. 实现分页查询（使用 skip 和 take）
3. 思考：如何优化大量数据的查询性能？
4. 调研 Prisma 的批量操作（createMany, updateMany）

---

**恭喜完成第4课！** 你已经掌握了数据库设计和 Prisma ORM 的核心概念，为后续的数据操作学习打下了坚实基础。如果有任何问题，请参考项目 GitHub 讨论区或相关技术社区。

> 下一课：[第5课：认证与多租户（Clerk）](../Tutorial/第5课-认证与多租户-Clerk.md)