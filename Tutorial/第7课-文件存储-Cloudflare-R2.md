# 第7课：文件存储（Cloudflare R2）

> 本课程详细讲解 Resonance 项目中的 Cloudflare R2 对象存储实现。

## 目录

1. [Cloudflare R2 简介](#1-cloudflare-r2-简介)
2. [项目环境变量配置](#2-项目环境变量配置)
3. [R2 客户端核心实现](#3-r2-客户端核心实现)
4. [数据库模型设计](#4-数据库模型设计)
5. [文件上传流程](#5-文件上传流程)
6. [预签名 URL 访问](#6-预签名-url-访问)
7. [文件删除流程](#7-文件删除流程)
8. [访问控制策略](#8-访问控制策略)
9. [实践任务](#9-实践任务)

---

## 1. Cloudflare R2 简介

### 什么是 Cloudflare R2？

Cloudflare R2 是一种对象存储服务，与 Amazon S3 API 兼容，但**不收取 egress 带宽费用**。对于音频/视频等大文件存储场景，R2 比 S3 更经济。

**R2 vs S3 对比**：

| 特性 | Cloudflare R2 | Amazon S3 |
|------|--------------|----------|
| Egress 费用 | 免费 | 按流量收费 |
| API 兼容性 | S3 兼容 | 原生 S3 |
| 全球 CDN | 内置 | 需额外配置 |
| 定价 | 存储量计费 | 存储 + 流量 |

### 项目中的使用场景

Resonance 项目使用 R2 存储：

- **用户上传的语音样本**（语音克隆功能）
- **TTS 生成的音频文件**
- **系统预置语音文件**

---

## 2. 项目环境变量配置

### 2.1 环境变量定义

`src/lib/env.ts` 中定义了 R2 相关配置：

```typescript
R2_ACCOUNT_ID: z.string().min(1),
R2_ACCESS_KEY_ID: z.string().min(1),
R2_SECRET_ACCESS_KEY: z.string().min(1),
R2_BUCKET_NAME: z.string().min(1),
```

### 2.2 环境变量示例

`.env.example` 中的配置：

```env
# Cloudflare R2 配置
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=resonance-audio
R2_TOKEN=your-api-token  # 可选
```

### 2.3 获取 R2 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2** 服务
3. 创建存储桶（Bucket）
4. 在 **Manage R2 API Tokens** 创建 API Token
5. 复制 Account ID 和凭证

---

## 3. R2 客户端核心实现

### 3.1 核心文件结构

```
src/lib/
├── r2.ts      # R2 客户端配置和核心函数
└── env.ts    # 环境变量定义
```

### 3.2 R2 客户端初始化

`src/lib/r2.ts` 使用 AWS SDK v3：

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",  // R2 使用 "auto" 区域
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
```

**关键配置点**：

- `region: "auto"` - R2 使用特殊的 auto 区域
- `endpoint` - R2 的自定义端点格式

### 3.3 上传音频函数

```typescript
interface UploadAudioOptions {
  buffer: Buffer;
  key: string;  // R2 中的路径
  contentType?: string;
}

export async function uploadAudio({
  buffer,
  key,
  contentType = "audio/wav",
}: UploadAudioOptions): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}
```

### 3.4 删除音频函数

```typescript
export async function deleteAudio(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}
```

### 3.5 生成预签名 URL

```typescript
export async function getSignedAudioUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  // 签名URL有效期 1 小时
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}
```

**预签名 URL 原理**：

```
用户请求 → 服务器验证权限 → 生成签名URL（含时效） → 重定向到R2
```

---

## 4. 数据库模型设计

### 4.1 Prisma Schema

两个模型使用 `r2ObjectKey` 字段：

```prisma
model Voice {
  id           String       @id @default(cuid())
  orgId        String?      // 组织 ID（null 表示系统语音）
  name         String
  description  String?
  category     VoiceCategory @default(GENERAL)
  language     String       @default("en-US")
  variant      VoiceVariant // CUSTOM 或 SYSTEM
  r2ObjectKey  String?      // R2 存储路径
  // ...
}

model Generation {
  id                 String   @id @default(cuid())
  orgId              String   // 组织 ID
  voiceId            String?
  voice              Voice?   @relation(...)
  text               String   // 原始文本
  voiceName          String
  r2ObjectKey         String?  // R2 存储路径
  // ...
}
```

### 4.2 存储路径命名规范

| 类型 | 路径格式 | 示例 |
|------|---------|------|
| 用户语音 | `voices/orgs/${orgId}/${voiceId}` | `voices/orgs/org_abc/voice_xyz` |
| 系统语音 | `voices/system/${voiceId}` | `voices/system/voice_sys_001` |
| TTS 生成 | `generations/orgs/${orgId}/${generationId}` | `generations/orgs/org_abc/gen_xyz` |

---

## 5. 文件上传流程

### 5.1 语音文件上传

**API 路由**：`src/app/api/voices/create/route.ts`

```typescript
export async function POST(request: Request) {
  const { userId, orgId } = await auth();

  // 1. 验证订阅状态
  const subscription = await ctx.POLAR.subscriptions.active();
  if (!subscription) {
    return new Response("Subscription required", { status: 403 });
  }

  // 2. 解析表单数据
  const formData = await request.formData();
  const file = formData.get("file") as File;

  // 3. 验证文件
  if (file.size > 20 * 1024 * 1024) {  // 20MB 限制
    return new Response("File too large", { status: 400 });
  }

  // 4. 读取文件内容
  const fileBuffer = await file.arrayBuffer();

  // 5. 解析音频元数据（可选）
  const metadata = await parseAudioMetadata(fileBuffer);

  // 6. 创建数据库记录
  const voice = await prisma.voice.create({
    data: {
      name: metadata.name,
      orgId,
      variant: "CUSTOM",
      // ...
    },
  });

  // 7. 上传到 R2
  const r2ObjectKey = `voices/orgs/${orgId}/${voice.id}`;
  await uploadAudio({
    buffer: Buffer.from(fileBuffer),
    key: r2ObjectKey,
    contentType: file.type,
  });

  // 8. 更新数据库记录的 r2ObjectKey
  await prisma.voice.update({
    where: { id: voice.id },
    data: { r2ObjectKey },
  });

  return Response.json({ voice });
}
```

**上传流程图**：

```
客户端 → API 路由 → 验证认证和订阅
                    ↓
              解析文件数据
                    ↓
              创建数据库记录
                    ↓
              上传到 R2 存储桶
                    ↓
              更新 r2ObjectKey
                    ↓
              返回成功响应
```

### 5.2 TTS 语音生成上传

**tRPC Mutation**：`src/trpc/routers/generations.ts`

```typescript
create: orgProcedure
  .input(createGenerationSchema)
  .mutation(async ({ input, ctx }) => {
    // 1. 验证订阅状态
    const status = await ctx.POLAR.subscriptions.active();
    if (!status) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Active subscription required",
      });
    }

    // 2. 调用外部 TTS API 生成音频
    const response = await fetch(TTS_API_URL, {
      method: "POST",
      body: JSON.stringify({ text: input.text, voiceId: input.voiceId }),
    });

    if (!response.ok) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    }

    const audioBuffer = await response.arrayBuffer();

    // 3. 创建数据库记录
    const generation = await prisma.generation.create({
      data: {
        organizationId: ctx.orgId,
        text: input.text,
        voiceId: input.voiceId,
        // ...
      },
    });

    // 4. 上传到 R2
    const r2ObjectKey = `generations/orgs/${ctx.orgId}/${generation.id}`;
    await uploadAudio({
      buffer: Buffer.from(audioBuffer),
      key: r2ObjectKey,
      contentType: "audio/wav",
    });

    // 5. 更新 r2ObjectKey
    await prisma.generation.update({
      where: { id: generation.id },
      data: { r2ObjectKey },
    });

    // 6. 发送用量事件（计费用）
    await ctx.POLAR.events.capture("text_generated", {
      quantity: input.text.length,
    });

    return generation;
  }),
```

---

## 6. 预签名 URL 访问

### 6.1 语音音频访问

**API 路由**：`src/app/api/voices/[voiceId]/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  const { userId, orgId } = await auth();
  const { voiceId } = await params;

  // 1. 查询语音信息
  const voice = await prisma.voice.findUnique({
    where: { id: voiceId },
    select: {
      variant: true,
      orgId: true,
      r2ObjectKey: true,
    },
  });

  if (!voice || !voice.r2ObjectKey) {
    return new Response("Not found", { status: 404 });
  }

  // 2. 访问控制检查
  // CUSTOM 语音需要验证组织归属
  if (voice.variant === "CUSTOM" && voice.orgId !== orgId) {
    return new Response("Not found", { status: 404 });
  }

  // 3. 生成预签名 URL
  const signedUrl = await getSignedAudioUrl(voice.r2ObjectKey);

  // 4. 获取音频内容
  const audioResponse = await fetch(signedUrl);

  // 5. 返回音频流
  return new Response(audioResponse.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": voice.variant === "SYSTEM"
        ? "public, max-age=86400"   // 系统语音公开缓存 24 小时
        : "private, max-age=3600",  // 用户语音私有缓存 1 小时
    },
  });
}
```

### 6.2 生成音频访问

**API 路由**：`src/app/api/audio/[generationId]/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { userId, orgId } = await auth();
  const { generationId } = await params;

  // 1. 查询生成记录（带组织隔离）
  const generation = await prisma.generation.findUnique({
    where: { id: generationId, organizationId: orgId },
  });

  if (!generation || !generation.r2ObjectKey) {
    return new Response("Not found", { status: 404 });
  }

  // 2. 生成预签名 URL
  const signedUrl = await getSignedAudioUrl(generation.r2ObjectKey);

  // 3. 获取音频并返回
  const audioResponse = await fetch(signedUrl);

  return new Response(audioResponse.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

### 6.3 为什么要用预签名 URL？

**直接暴露 R2 URL 的问题**：

```
R2 URL: https://xxx.r2.cloudflarestorage.com/bucket/key
❌ 任何知道 URL 的人都可以访问
❌ 无法控制访问权限
❌ 无法设置过期时间
```

**使用预签名 URL 的优势**：

```
预签名 URL: https://xxx.r2.cloudflarestorage.com/bucket/key?signature=xxx&expires=1234567890
✓ 签名验证身份
✓ 可设置过期时间
✓ 可撤销访问权限
```

---

## 7. 文件删除流程

### 7.1 删除语音

**tRPC Mutation**：`src/trpc/routers/voices.ts`

```typescript
delete: orgProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. 查询语音（验证所有权）
    const voice = await prisma.voice.findUnique({
      where: {
        id: input.id,
        variant: "CUSTOM",     // 只能删除自定义语音
        orgId: ctx.orgId,       // 验证组织归属
      },
      select: { id: true, r2ObjectKey: true },
    });

    if (!voice) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // 2. 删除数据库记录
    await prisma.voice.delete({ where: { id: voice.id } });

    // 3. 删除 R2 文件（失败时静默忽略）
    if (voice.r2ObjectKey) {
      await deleteAudio(voice.r2ObjectKey).catch(() => {
        // 生产环境应该记录日志并使用后台任务重试
      });
    }

    return { success: true };
  }),
```

### 7.2 删除注意事项

**为什么静默忽略删除失败？**

```typescript
// 避免用户请求长时间等待
await deleteAudio(voice.r2ObjectKey).catch(() => {});

// 生产环境推荐做法：
// 1. 将删除任务加入队列
// 2. 后台任务异步处理
// 3. 失败时重试
// 4. 记录日志
```

**正确的生产环境做法**：

```typescript
// 使用消息队列处理删除
await addToDeleteQueue({
  key: voice.r2ObjectKey,
  scheduledAt: Date.now() + 60000,  // 60秒后删除（给用户确认时间）
});
```

---

## 8. 访问控制策略

### 8.1 三种访问级别

| 类型 | 访问方式 | 缓存策略 |
|------|---------|----------|
| **系统语音 (SYSTEM)** | 公开访问，无需认证 | 公开缓存 24 小时 |
| **用户语音 (CUSTOM)** | 需验证组织归属 | 私有缓存 1 小时 |
| **生成音频** | 需验证组织归属 | 私有缓存 1 小时 |

### 8.2 访问控制流程

```typescript
// 语音访问流程
function handleVoiceAccess(voice, orgId) {
  // 1. 查询语音
  const voice = await prisma.voice.findUnique({ where: { id } });

  // 2. 系统语音：直接返回
  if (voice.variant === "SYSTEM") {
    return { access: "public", cache: "24h" };
  }

  // 3. 用户语音：验证组织
  if (voice.orgId === orgId) {
    return { access: "private", cache: "1h" };
  }

  // 4. 不匹配：返回 404（隐藏资源存在）
  return { access: "denied", cache: "none" };
}
```

### 8.3 缓存策略选择

**公开缓存（系统语音）**：

```typescript
"Cache-Control": "public, max-age=86400"
// ✓ 减少 R2 请求
// ✓ 用户访问更快
// ✗ 可能返回过期内容（对系统语音可接受）
```

**私有缓存（用户数据）**：

```typescript
"Cache-Control": "private, max-age=3600"
// ✓ 仅浏览器缓存，代理服务器不缓存
// ✓ 数据新鲜度优先
```

---

## 9. 实践任务

### 任务目标

实现一个用户头像上传功能，类似于语音文件上传。

### 具体步骤

#### 步骤 1：更新 Prisma Schema

在 `prisma/schema.prisma` 的 `User` 或 `Organization` 模型中添加头像字段：

```prisma
model Organization {
  id String @id @default(cuid())
  // ... 其他字段
  avatarR2ObjectKey String?
  // ...
}
```

然后执行迁移：

```bash
npx prisma migrate dev --name add_org_avatar
```

#### 步骤 2：创建 R2 上传函数

在 `src/lib/r2.ts` 中添加头像上传函数：

```typescript
interface UploadAvatarOptions {
  buffer: Buffer;
  key: string;
}

export async function uploadAvatar({
  buffer,
  key,
}: UploadAvatarOptions): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/png",  // 限制为 PNG 格式
    }),
  );
}

export async function deleteAvatar(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}
```

#### 步骤 3：创建 API 上传路由

创建 `src/app/api/organizations/[orgId]/avatar/route.ts`：

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadAvatar, deleteAvatar } from "@/lib/r2";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { userId, orgId: currentOrgId } = await auth();
  const { orgId } = await params;

  if (!userId || !currentOrgId || currentOrgId !== orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 解析表单数据
  const formData = await request.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return new Response("No file", { status: 400 });
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return new Response("File too large", { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // 获取现有头像 key（用于后续删除）
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { avatarR2ObjectKey: true },
  });

  // 上传新头像
  const newKey = `avatars/orgs/${orgId}/avatar.png`;
  await uploadAvatar({
    buffer: Buffer.from(buffer),
    key: newKey,
  });

  // 更新数据库
  await prisma.organization.update({
    where: { id: orgId },
    data: { avatarR2ObjectKey: newKey },
  });

  // 删除旧头像（异步，不阻塞响应）
  if (org?.avatarR2ObjectKey) {
    deleteAvatar(org.avatarR2ObjectKey).catch(() => {});
  }

  return Response.json({ success: true });
}
```

#### 步骤 4：创建头像访问路由

创建 `src/app/api/organizations/[orgId]/avatar/route.ts` 的 GET 方法：

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { avatarR2ObjectKey: true },
  });

  if (!org?.avatarR2ObjectKey) {
    // 返回默认头像
    return Response.redirect("/default-avatar.png");
  }

  const signedUrl = await getSignedAvatarUrl(org.avatarR2ObjectKey);
  const avatarResponse = await fetch(signedUrl);

  return new Response(avatarResponse.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
```

#### 步骤 5：添加 getSignedAvatarUrl 函数

在 `src/lib/r2.ts` 中添加：

```typescript
export async function getSignedAvatarUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}
```

### 验证步骤

1. 启动开发服务器：`npm run dev`
2. 使用 Postman 或 curl 上传头像：
   ```bash
   curl -X POST http://localhost:3000/api/organizations/org_xxx/avatar \
     -H "Cookie: ..." \
     -F "file=@avatar.png"
   ```
3. 访问头像 URL 验证显示
4. 检查 R2 存储桶中是否有对应文件

### 成功标准

- ✅ 能够上传头像文件
- ✅ 旧头像被正确删除
- ✅ 头像 URL 受签名保护
- ✅ 超过大小限制返回错误

---

## 常见问题 FAQ

### Q: 为什么使用 API 路由代理访问而不是直接返回预签名 URL？

A: 有几个原因：
1. **隐藏 R2 结构**：用户不知道存储桶名称和路径结构
2. **统一访问控制**：可以在 API 层统一处理认证和授权
3. **灵活控制**：可以添加水印、格式转换等处理
4. **日志记录**：可以记录访问日志

### Q: 如何设置更长的预签名 URL 有效期？

```typescript
// 默认 1 小时
getSignedUrl(r2, command, { expiresIn: 3600 });

// 自定义有效期
getSignedUrl(r2, command, { expiresIn: 86400 }); // 24 小时
```

### Q: R2 存储的文件可以设置公开访问吗？

A: 可以，但项目选择不这样做：

```typescript
// 上传时设置 ACL
await r2.send(new PutObjectCommand({
  Bucket: env.R2_BUCKET_NAME,
  Key: key,
  Body: buffer,
  ACL: "public-read",  // 公开读取
}));

// 但仍然建议使用预签名 URL 以获得更好的控制
```

---

## 总结

本课程我们学习了：

1. **Cloudflare R2 简介**：与 S3 兼容的零 egress 费用对象存储
2. **环境变量配置**：Account ID、Access Key、Bucket Name
3. **R2 客户端实现**：使用 AWS SDK v3 的 S3 兼容 API
4. **上传流程**：文件验证 → 数据库创建 → R2 上传 → 更新记录
5. **预签名 URL**：安全、时效的访问控制机制
6. **删除流程**：数据库删除 + R2 文件删除
7. **访问控制**：系统语音公开、用户数据私有

---

## 下一步

完成实践任务后，继续学习：

- [第8课：TTS 模型部署（Modal + Chatterbox）](./第8课-TTS-模型部署-Modal-Chatterbox.md) - 学习 GPU 推理服务部署

---

## 作业与思考

### 基础作业

1. **完善头像上传功能**
   - 添加头像格式验证（仅允许 PNG、JPG、WebP）
   - 添加图片尺寸验证（最小 100x100）
   - 实现头像删除功能

2. **实现文件批量删除**
   - 在删除组织时，删除所有相关的 R2 文件
   - 使用事务确保数据库和存储的一致性

### 进阶思考

3. **缓存策略设计**
   - 预签名 URL 有效期 1 小时是否合适？
   - 如果要实现"永久"访问，应该怎么做？
   - 如何在缓存和数据新鲜度之间取得平衡？

4. **删除失败处理**
   - 为什么静默忽略删除失败？
   - 如何设计一个可靠的后台删除任务系统？
   - 如何处理 R2 费用和存储清理的平衡？

5. **访问控制优化**
   - 为什么要返回 404 而不是 403？
   - 直接返回 R2 URL 有什么安全风险？
   - 是否有更好的访问控制方案？

---

**恭喜完成第7课！**

返回：[第6课：后端架构（tRPC + React Query）](./第6课-后端架构-tRPC-React-Query.md)
