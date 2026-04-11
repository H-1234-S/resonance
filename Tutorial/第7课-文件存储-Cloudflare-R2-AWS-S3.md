# 第7课：文件存储（Cloudflare R2 / AWS S3）

## 学习目标
- 了解对象存储服务及其应用场景
- 掌握 Cloudflare R2 与 AWS S3 的关系
- 学会使用 AWS SDK v3 操作 R2（上传、下载、删除）
- 理解预签名 URL 的工作原理和安全优势
- 掌握音频文件的完整存储流程
- 学会设计安全的 API 路由访问私有文件

## 课程时长
预计 1.5-2 小时（包括理论学习与实践操作）

---

## 一、对象存储简介

### 什么是对象存储？

对象存储（Object Storage）是一种将数据作为"对象"存储的架构，每个对象包含：

```
┌──────────────────────────────────────────┐
│                 对象 (Object)             │
├──────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │  数据   │  │  元数据  │  │  全局   │  │
│  │ (音频文件)│  │(Content │  │  唯一   │  │
│  │         │  │ Type等) │  │  标识符  │  │
│  └─────────┘  └─────────┘  │  (Key)  │  │
│                             └─────────┘  │
└──────────────────────────────────────────┘
```

### 主流对象存储服务对比

| 服务 | 提供商 | 特点 | 价格 |
|------|--------|------|------|
| **S3** | AWS | 行业标准，生态最成熟 | 中等 |
| **R2** | Cloudflare | **零出口流量费**，兼容 S3 API | 低 |
| **GCS** | Google Cloud | 与 GCP 生态集成好 | 中等 |
| **Blob Storage** | Azure | 与 Azure 生态集成好 | 中等 |

### 为什么项目选择 R2？

Resonance 项目选择 Cloudflare R2 而非 AWS S3 的原因：

1. **零出口流量费（Egress Fee）**：S3 收取 $0.09/GB 的流出费用，R2 完全免费
2. **S3 API 兼容**：可以直接使用 AWS SDK，无需学习新 API
3. **全球 CDN 集成**：R2 自带 Cloudflare CDN 加速
4. **成本优势**：对于音频流媒体应用，流量费用通常远高于存储费用

### R2 vs S3 成本对比（1000 用户，每人每月 100MB 音频）

```
S3 成本:
  存储: 100GB × $0.023/GB = $2.30
  出口流量: 100GB × $0.09/GB = $9.00
  总计: $11.30/月

R2 成本:
  存储: 100GB × $0.015/GB = $1.50
  出口流量: $0.00 (免费!)
  总计: $1.50/月

节省: 87%
```

---

## 二、项目 R2 配置

### 目录结构

```
src/lib/
├── r2.ts          # R2 客户端（上传、下载、删除）
├── env.ts         # 环境变量验证
```

### 环境变量

**`.env.example`**：
```env
R2_ACCOUNT_ID=          # Cloudflare 账户 ID
R2_ACCESS_KEY_ID=       # R2 访问密钥 ID
R2_SECRET_ACCESS_KEY=   # R2 密钥
R2_BUCKET_NAME=         # 存储桶名称
R2_TOKEN=               # (可选) R2 令牌
```

**`src/lib/env.ts`**（验证部分）：
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    // ... 其他变量
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET_NAME: z.string().min(1),
    // ...
  },
});
```

### 如何创建 R2 存储桶

1. 登录 Cloudflare Dashboard → R2 Storage
2. 创建新存储桶（Bucket）
3. 创建 R2 API Token（读写权限）
4. 记录 Account ID、Access Key ID、Secret Access Key
5. 将凭据填入 `.env` 文件

---

## 三、R2 客户端实现

### S3 Client 初始化

**`src/lib/r2.ts`**：

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const r2 = new S3Client({
  region: "auto",           // R2 不需要 region，填 auto 即可
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});
```

### 关键点解析

| 配置项 | 说明 |
|--------|------|
| `region: "auto"` | R2 自动路由，不需要指定具体 region |
| `endpoint` | R2 的 S3 兼容端点，格式固定 |
| `credentials` | 与 AWS 完全相同的认证格式 |

### 文件 Key 命名约定

项目中使用分层路径作为文件 Key：

```
存储桶 (Bucket)
├── voices/                    # 语音样本
│   └── orgs/
│       └── {orgId}/
│           └── {voiceId}     # 每个语音一个文件
└── generations/               # 生成结果
    └── orgs/
        └── {orgId}/
            └── {generationId} # 每次生成一个文件
```

这种结构的优点：
- **按组织隔离**：每个 org 只能访问自己的数据
- **易于清理**：可以按 org 批量删除
- **避免冲突**：使用唯一 ID 作为文件名

---

## 四、文件上传

### 上传音频函数

**`src/lib/r2.ts`**：

```typescript
type UploadAudioOptions = {
  buffer: Buffer;
  key: string;
  contentType?: string;
};

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

### 上传流程

```
用户操作（录音/上传文件）
         ↓
前端发送音频数据（POST /api/voices/create）
         ↓
API Route 接收文件（request.arrayBuffer()）
         ↓
验证音频格式和时长（music-metadata）
         ↓
创建数据库记录（prisma.voice.create）
         ↓
uploadAudio() → R2 PutObjectCommand
         ↓
更新数据库 r2ObjectKey
         ↓
返回成功
```

### 完整的语音上传 API Route

**`src/app/api/voices/create/route.ts`**：

```typescript
import { auth } from "@clerk/nextjs/server";
import { parseBuffer } from "music-metadata";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { uploadAudio } from "@/lib/r2";

const createVoiceSchema = z.object({
  name: z.string().min(1, "Voice name is required"),
  category: z.enum(VOICE_CATEGORIES as [VoiceCategory, ...VoiceCategory[]]),
  language: z.string().min(1, "Language is required"),
  description: z.string().nullish(),
});

const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const MIN_AUDIO_DURATION_SECONDS = 10;

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. 验证元数据（从 URL 查询参数获取）
  const url = new URL(request.url);
  const validation = createVoiceSchema.safeParse({
    name: url.searchParams.get("name"),
    category: url.searchParams.get("category"),
    language: url.searchParams.get("language"),
    description: url.searchParams.get("description"),
  });

  if (!validation.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  // 2. 接收文件
  const fileBuffer = await request.arrayBuffer();
  if (!fileBuffer.byteLength) {
    return Response.json({ error: "Please upload an audio file" }, { status: 400 });
  }
  if (fileBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    return Response.json({ error: "File too large (max 20MB)" }, { status: 413 });
  }

  // 3. 验证音频格式和时长
  const contentType = request.headers.get("content-type");
  const normalizedContentType = contentType?.split(";")[0]?.trim() || "audio/wav";

  let duration: number;
  try {
    const metadata = await parseBuffer(
      new Uint8Array(fileBuffer),
      { mimeType: normalizedContentType },
      { duration: true },
    );
    duration = metadata.format.duration ?? 0;
  } catch {
    return Response.json({ error: "Not a valid audio file" }, { status: 422 });
  }

  if (duration < MIN_AUDIO_DURATION_SECONDS) {
    return Response.json(
      { error: `Audio too short (${duration.toFixed(1)}s). Min ${MIN_AUDIO_DURATION_SECONDS}s.` },
      { status: 422 },
    );
  }

  // 4. 创建数据库记录 + 上传文件 + 更新 Key
  let createdVoiceId: string | null = null;
  try {
    const voice = await prisma.voice.create({
      data: {
        name: validation.data.name,
        variant: "CUSTOM",
        orgId,
        category: validation.data.category,
        language: validation.data.language,
        description: validation.data.description,
      },
      select: { id: true },
    });

    createdVoiceId = voice.id;
    const r2ObjectKey = `voices/orgs/${orgId}/${voice.id}`;

    // 上传到 R2
    await uploadAudio({
      buffer: Buffer.from(fileBuffer),
      key: r2ObjectKey,
      contentType: normalizedContentType,
    });

    // 更新数据库中的 r2ObjectKey
    await prisma.voice.update({
      where: { id: voice.id },
      data: { r2ObjectKey },
    });
  } catch {
    // 上传失败时回滚数据库记录
    if (createdVoiceId) {
      await prisma.voice.delete({ where: { id: createdVoiceId } }).catch(() => {});
    }
    return Response.json({ error: "Failed to create voice" }, { status: 500 });
  }

  return Response.json({ message: "Voice created" }, { status: 201 });
}
```

### 错误回滚机制

```
成功路径:
  Create DB Record → Upload to R2 → Update r2ObjectKey ✓

失败路径:
  Create DB Record → Upload to R2 ✗
  → Catch Error → Delete DB Record → Return 500

这确保了数据库和存储之间的一致性
```

---

## 五、文件删除

### 删除音频函数

**`src/lib/r2.ts`**：

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

### 在 tRPC 中调用删除

**`src/trpc/routers/voices.ts`**（delete 过程）：

```typescript
delete: orgProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const voice = await prisma.voice.findUnique({
      where: { id: input.id, variant: "CUSTOM", orgId: ctx.orgId },
      select: { id: true, r2ObjectKey: true },
    });

    if (!voice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Voice not found" });
    }

    // 先删数据库记录
    await prisma.voice.delete({ where: { id: voice.id } });

    // 再删 R2 文件（失败不影响用户操作）
    if (voice.r2ObjectKey) {
      await deleteAudio(voice.r2ObjectKey).catch(() => {});
    }

    return { success: true };
  }),
```

### 为什么删除 R2 文件失败不抛错？

```
删除顺序:
  1. prisma.voice.delete()  →  删除数据库记录（必须成功）
  2. deleteAudio(r2ObjectKey) →  删除 R2 文件（失败可接受）

原因:
  - 用户最关心的是"语音已删除"（数据库层面）
  - 残留的 R2 文件不影响功能（无法被引用）
  - 可以通过定期清理任务处理孤儿文件
  - 避免因为网络问题导致用户体验受损
```

---

## 六、预签名 URL

### 什么是预签名 URL？

预签名 URL（Presigned URL）是一种临时授权链接，允许用户在限定时间内访问私有对象，**无需后端代理**。

```
┌─────────────────────────────────────────────────────────────┐
│                    预签名 URL 工作原理                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  后端 (可信)                客户端                R2 存储    │
│      │                      │                      │        │
│      │  生成签名 URL         │                      │        │
│      │─────────────────────>│                      │        │
│      │  (有效期 1 小时)      │                      │        │
│      │                      │  GET 签名 URL         │        │
│      │                      │──────────────────────>│        │
│      │                      │         R2 验证签名    │        │
│      │                      │<──────────────────────│        │
│      │                      │      返回文件内容      │        │
│      │                      │                      │        │
└─────────────────────────────────────────────────────────────┘
```

### 生成预签名 URL

**`src/lib/r2.ts`**：

```typescript
export async function getSignedAudioUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 小时
}
```

### 预签名 URL vs 直接暴露 URL

| 方式 | 安全性 | 适用场景 |
|------|--------|----------|
| **直接暴露 URL** | 低 - 任何人可永久访问 | 公开资源（头像、公开文档）|
| **预签名 URL** | 高 - 临时授权，自动过期 | 私有资源（生成音频、付费内容）|
| **后端代理** | 最高 - 每次请求都验证 | 最敏感数据，需细粒度控制 |

---

## 七、安全音频访问（后端代理模式）

### 为什么需要后端代理？

虽然预签名 URL 是安全的，但直接暴露给前端仍有风险：
1. 链接有效时间长（1 小时），可能被泄露
2. 每次获取新链接都要调用后端
3. 无法精细控制访问权限

项目采用 **后端代理模式**：

```
浏览器 GET /api/audio/{generationId}
         ↓
验证用户身份（auth()）
         ↓
查询数据库（确认属于当前组织）
         ↓
生成预签名 URL（有效期 1 小时）
         ↓
后端用预签名 URL 从 R2 获取文件
         ↓
直接流式返回给浏览器
```

### 生成记录音频访问

**`src/app/api/audio/[generationId]/route.ts`**：

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getSignedAudioUrl } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> },
) {
  // 1. 验证身份
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. 获取参数
  const { generationId } = await params;

  // 3. 查询数据库（包含 orgId 过滤，确保数据隔离）
  const generation = await prisma.generation.findUnique({
    where: { id: generationId, orgId },
  });

  if (!generation) {
    return new Response("Not found", { status: 404 });
  }

  if (!generation.r2ObjectKey) {
    return new Response("Audio is not available yet", { status: 409 });
  }

  // 4. 通过预签名 URL 获取音频并流式返回
  const signedUrl = await getSignedAudioUrl(generation.r2ObjectKey);
  const audioResponse = await fetch(signedUrl);

  if (!audioResponse.ok) {
    return new Response("Failed to fetch audio", { status: 502 });
  }

  return new Response(audioResponse.body, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

### 语音样本音频访问

**`src/app/api/voices/[voiceId]/route.ts`**：

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { getSignedAudioUrl } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ voiceId: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { voiceId } = await params;

  // 查询语音信息
  const voice = await prisma.voice.findUnique({
    where: { id: voiceId },
    select: { variant: true, orgId: true, r2ObjectKey: true },
  });

  if (!voice) {
    return new Response("Not found", { status: 404 });
  }

  // 自定义语音只能被同组织访问
  if (voice.variant === "CUSTOM" && voice.orgId !== orgId) {
    return new Response("Not found", { status: 404 });
  }

  if (!voice.r2ObjectKey) {
    return new Response("Voice audio not available yet", { status: 409 });
  }

  // 获取音频并返回
  const signedUrl = await getSignedAudioUrl(voice.r2ObjectKey);
  const audioResponse = await fetch(signedUrl);

  if (!audioResponse.ok) {
    return new Response("Failed to fetch voice audio", { status: 502 });
  }

  const contentType = audioResponse.headers.get("content-type") || "audio/wav";

  // 系统语音使用 public 缓存，自定义语音使用 private 缓存
  return new Response(audioResponse.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control":
        voice.variant === "SYSTEM"
          ? "public, max-age=86400"   // 24 小时公共缓存
          : "private, max-age=3600",  // 1 小时私有缓存
    },
  });
}
```

### 缓存策略

| 资源类型 | Cache-Control | 说明 |
|----------|---------------|------|
| **系统语音** | `public, max-age=86400` | 所有用户共享，可被 CDN 缓存 24 小时 |
| **生成音频** | `private, max-age=3600` | 每个用户独有，只能浏览器缓存 1 小时 |
| **自定义语音** | `private, max-age=3600` | 组织私有，只能浏览器缓存 1 小时 |

---

## 八、TTS 生成流程中的文件存储

### 完整流程图

```
用户点击「生成」
         ↓
tRPC mutations.create()
         ↓
┌────────────────────────────────────────────┐
│  1. 检查订阅状态                              │
│  2. 查询语音信息（获取 r2ObjectKey）           │
│  3. 调用 Chatterbox TTS API 生成音频         │
│  4. 接收 ArrayBuffer 响应                   │
└────────────────────┬───────────────────────┘
                     ↓
┌────────────────────────────────────────────┐
│  5. 创建 Generation 记录（不含 r2ObjectKey）  │
│  6. 定义 Key: generations/orgs/{orgId}/{id}  │
│  7. uploadAudio() 上传到 R2                  │
│  8. 更新 Generation.r2ObjectKey              │
└────────────────────┬───────────────────────┘
                     ↓
┌────────────────────────────────────────────┐
│  9. 上报用量到 Polar                        │
│  10. 返回 { id: generationId }               │
└────────────────────────────────────────────┘
```

### 生成代码中的存储部分

**`src/trpc/routers/generations.ts`**（create mutation 中的存储部分）：

```typescript
const buffer = Buffer.from(data);
let generationId: string | null = null;
let r2ObjectKey: string | null = null;

try {
  // Step 1: 创建数据库记录
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

  generationId = generation.id;
  r2ObjectKey = `generations/orgs/${ctx.orgId}/${generation.id}`;

  // Step 2: 上传到 R2
  await uploadAudio({ buffer, key: r2ObjectKey });

  // Step 3: 更新数据库中的 Key
  await prisma.generation.update({
    where: { id: generation.id },
    data: { r2ObjectKey },
  });
} catch {
  // 上传失败时回滚
  if (generationId) {
    await prisma.generation.delete({ where: { id: generationId } }).catch(() => {});
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to store generated audio",
  });
}
```

### 为什么要分两步（先创建记录再更新 Key）？

```
方案 A（项目采用）:
  1. Create Generation (r2ObjectKey = null)
  2. Upload to R2
  3. Update r2ObjectKey

  优点: 即使上传失败，也有记录可追踪
  缺点: 多一次数据库操作

方案 B:
  1. Upload to R2
  2. Create Generation (r2ObjectKey = key)

  优点: 少一次数据库操作
  缺点: 上传失败时没有任何记录，难以调试

项目选择方案 A，因为它更易于调试和监控
```

---

## 九、安全最佳实践

### 1. 最小权限原则

R2 API Token 应只授予必要的权限：

```
存储桶权限:
  读取 ✓   → GetObject
  写入 ✓   → PutObject
  删除 ✓   → DeleteObject
  列出 ✗   → ListObjects (不需要)
  管理 ✗   → 存储桶配置修改 (不需要)
```

### 2. 不暴露敏感字段

tRPC 查询中使用 `omit` 排除敏感字段：

```typescript
getAll: orgProcedure.query(async ({ ctx }) => {
  return prisma.generation.findMany({
    where: { orgId: ctx.orgId },
    omit: {
      orgId: true,       // 不返回组织 ID
      r2ObjectKey: true, // 不返回存储 Key（防止直接访问）
    },
  });
});
```

### 3. 始终在服务端验证权限

```typescript
// 错误示例 - 直接使用传入的 ID 查询
const generation = await prisma.generation.findUnique({
  where: { id: input.id }, // 任何用户都可以访问任何记录！
});

// 正确示例 - 用 orgId 过滤
const generation = await prisma.generation.findUnique({
  where: { id: input.id, orgId: ctx.orgId }, // 只返回本组织的数据
});
```

### 4. 使用预签名 URL 而不是直连

```
❌ 不推荐: 在数据库中存储公共 URL
  const publicUrl = `https://bucket.r2.dev/${key}`;

✅ 推荐: 使用预签名 URL
  const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

✅ 最佳: 后端代理模式
  return new Response(audioResponse.body, {
    headers: { "Content-Type": "audio/wav" },
  });
```

---

## 十、常见问题与调试

### 调试 R2 连接问题

```typescript
// 临时测试脚本
import { r2 } from "./r2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const result = await r2.send(
  new ListObjectsV2Command({ Bucket: "your-bucket-name", MaxKeys: 10 })
);
console.log("R2 objects:", result.Contents);
```

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `AccessDenied` | API Token 权限不足 | 检查 R2 Token 权限 |
| `NoSuchBucket` | 存储桶名称错误 | 检查 `R2_BUCKET_NAME` |
| `NoSuchKey` | 文件不存在 | 检查 Key 路径是否正确 |
| `InvalidAccessKeyId` | 凭据错误 | 检查 Access Key 是否正确 |

### 上传大文件的优化建议

对于更大的文件（超过 50MB），建议使用分块上传（Multipart Upload）：

```typescript
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";

// 伪代码示例
const multipart = await r2.send(new CreateMultipartUploadCommand({ Bucket, Key }));
const parts = [];
for (let i = 0; i < chunks.length; i++) {
  const result = await r2.send(new UploadPartCommand({
    Bucket, Key, UploadId: multipart.UploadId, PartNumber: i + 1, Body: chunks[i]
  }));
  parts.push({ PartNumber: i + 1, ETag: result.ETag });
}
await r2.send(new CompleteMultipartUploadCommand({
  Bucket, Key, UploadId: multipart.UploadId, MultipartUpload: { Parts: parts }
}));
```

---

## 实践任务

### 任务目标
实现一个简单的文件上传功能：用户上传文本文件到 R2，并可以下载查看。

### 具体步骤

#### 步骤 1：创建存储工具函数

在 `src/lib/r2.ts` 中添加文本上传和预签名下载函数：

```typescript
// 上传文本文件
export async function uploadText({
  content,
  key,
}: {
  content: string;
  key: string;
}): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: "text/plain",
    }),
  );
}

// 生成预签名下载 URL
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: 'attachment; filename="download.txt"',
  });
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}
```

#### 步骤 2：创建 API Route

创建 `src/app/api/text-files/route.ts`：

```typescript
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { uploadText } from "@/lib/r2";

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, filename } = await request.json();

  if (!content || !filename) {
    return Response.json({ error: "Missing content or filename" }, { status: 400 });
  }

  const key = `texts/orgs/${orgId}/${Date.now()}-${filename}`;
  await uploadText({ content, key });

  // 保存记录到数据库（可自行设计 TextFile 模型）
  console.log(`File uploaded: ${key}`);

  return Response.json({ key, message: "File uploaded successfully" }, { status: 201 });
}
```

#### 步骤 3：创建前端上传页面

创建 `src/app/(dashboard)/file-upload/page.tsx`：

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function FileUploadPage() {
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("my-file.txt");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!content.trim()) {
      toast.error("请输入内容");
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/text-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success("上传成功");
      setContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container py-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">文件上传练习</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">文件名</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="my-file.txt"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 border rounded h-48"
            placeholder="输入要上传的文本内容..."
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          {uploading ? "上传中..." : "上传到 R2"}
        </button>
      </div>
    </div>
  );
}
```

#### 步骤 4：测试

1. 确保 `.env` 中 R2 相关变量已正确配置
2. 启动开发服务器：`npm run dev`
3. 访问 http://localhost:3000/file-upload
4. 输入内容并上传
5. 登录 Cloudflare Dashboard → R2 查看上传的文件

### 成功标准
- ✅ R2 客户端正确初始化
- ✅ 文件可以上传到 R2
- ✅ 数据库记录与 R2 文件保持一致
- ✅ 错误回滚机制正常工作
- ✅ 权限验证正确（需要登录）

---

## 常见问题 FAQ

### Q: 为什么不直接从前端上传到 R2？

A: 两种方式各有利弊：

| 方式 | 优点 | 缺点 |
|------|------|------|
| **后端代理上传** | 可验证、处理元数据、保证一致性 | 占用服务器带宽 |
| **前端直传（预签名 URL）** | 不占用服务器带宽 | 无法处理元数据、需要 CORS 配置 |

项目选择后端代理上传，因为音频文件不大，且需要服务端验证和处理。

### Q: R2 和 S3 代码有什么区别？

A: 几乎零区别！只需改 endpoint 和 credentials：
```typescript
// S3
endpoint: "https://s3.us-east-1.amazonaws.com"

// R2
endpoint: `https://${accountId}.r2.cloudflarestorage.com`
```

### Q: 如何实现文件列表？

A: 使用 `ListObjectsV2Command`：
```typescript
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const result = await r2.send(
  new ListObjectsV2Command({
    Bucket: env.R2_BUCKET_NAME,
    Prefix: `generations/orgs/${orgId}/`, // 只列出该组织的文件
    MaxKeys: 100,
  })
);

console.log(result.Contents?.map(obj => obj.Key));
```

### Q: 如何实现 CORS 配置？

A: 在 Cloudflare Dashboard 中配置 R2 存储桶的 CORS 策略：
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 下一步准备

完成本课程后，你已经：
- ✅ 理解对象存储的基本概念
- ✅ 掌握 R2 服务的配置和使用
- ✅ 学会使用 AWS SDK v3 操作 R2
- ✅ 理解预签名 URL 的工作原理
- ✅ 掌握安全的音频文件访问模式
- ✅ 了解数据一致性和错误回滚机制

在下一课中，我们将学习 TTS 模型部署，使用 Modal 平台部署 GPU 推理服务，集成 Chatterbox TTS 模型实现语音生成。

---

## 扩展阅读

1. [Cloudflare R2 文档](https://developers.cloudflare.com/r2/)
2. [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
3. [S3 预签名 URL 文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)
4. [R2 S3 兼容性文档](https://developers.cloudflare.com/r2/api/s3/)

## 作业与思考

1. 修改语音上传 API，支持多种音频格式（MP3、OGG、WAV）
2. 实现一个文件清理函数，删除指定组织的所有 R2 文件
3. 思考：如果需要支持断点续传，应该使用什么技术？
4. 思考：R2 零出口流量费的优势在什么场景下最为明显？

---

**恭喜完成第7课！** 你已经掌握了对象存储服务的使用，理解了安全文件访问的架构，为后续的 TTS 生成功能打下了坚实基础。

> 下一课：[第8课：TTS 模型部署（Modal + Chatterbox）](./第8课-TTS-模型部署-Modal-Chatterbox.md)
