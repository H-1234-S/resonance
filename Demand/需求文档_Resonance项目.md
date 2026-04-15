# Resonance 项目需求文档

## 1. 项目概述

### 1.1 项目简介

| 项目 | 内容 |
|------|------|
| **项目名称** | Resonance |
| **项目类型** | 开源的 ElevenLabs 替代品 |
| **核心功能** | AI 文本转语音（TTS）和零样本语音克隆 |
| **目标用户** | 需要 TTS 能力的企业和个人开发者 |

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16, React 19, TypeScript |
| 样式方案 | Tailwind CSS, shadcn/ui |
| 状态管理 | tRPC, React Query, TanStack Form |
| 认证系统 | Clerk (多租户支持) |
| 数据库 | PostgreSQL + Prisma ORM |
| 文件存储 | Cloudflare R2 (S3兼容) |
| 订阅计费 | Polar SDK |
| TTS 引擎 | Chatterbox API |
| 监控 | Sentry |

---

## 2. 核心功能

### 2.1 文本转语音 (Text-to-Speech)

用户输入文本，选择语音，生成 AI 音频。

#### 功能参数

| 参数 | 范围 | 说明 |
|------|------|------|
| `temperature` | 0-2 | 创造性/一致性平衡 |
| `topP` | 0-1 | 语音多样性 |
| `topK` | 1-10000 | 表达范围 |
| `repetitionPenalty` | 1-2 | 自然流畅度 |

#### 业务规则

- 最大文本长度: **5000 字符**
- 计费方式: **$0.30/1000 字符**

### 2.2 语音克隆 (Voice Cloning)

用户上传音频样本创建自定义语音。

#### 功能要求

- 最少音频时长: **10 秒**
- 支持录音或文件上传
- 12 种语音分类:
  - AUDIOBOOK, CONVERSATIONAL, CUSTOMER_SERVICE, GENERAL
  - NARRATIVE, CHARACTERS, MEDITATION, MOTIVATIONAL
  - PODCAST, ADVERTISING, VOICEOVER, CORPORATE
- 支持多语言

### 2.3 订阅计费系统

- 使用 Polar SDK 管理订阅
- 支持创建结账会话和客户门户
- 按使用量计费（TTS 生成按字符数）

---

## 3. 业务流程

### 3.1 文本转语音流程

```
用户认证 (Clerk)
    ↓
组织验证 (orgId)
    ↓
1. 选择语音 (SYSTEM 或 CUSTOM)
    ↓
2. 输入文本
    ↓
3. 调整参数 (temperature, topP, topK, repetitionPenalty)
    ↓
4. 调用 generations.create
    ↓
5. Chatterbox API 生成音频
    ↓
6. 上传到 R2: generations/orgs/{orgId}/{generationId}
    ↓
7. 保存数据库记录
    ↓
8. 发送 Polar 使用量事件
    ↓
9. 返回生成结果
```

### 3.2 语音克隆流程

```
用户认证 (Clerk)
    ↓
组织验证 (orgId)
    ↓
1. 上传/录制音频（最少10秒）
    ↓
2. 验证音频格式和时长
    ↓
3. 调用 voices/create API
    ↓
4. 上传到 R2: voices/orgs/{orgId}/{voiceId}
    ↓
5. 保存数据库记录
    ↓
6. 发送 Polar 使用量事件
    ↓
7. 返回创建的语音
```

### 3.3 音频访问流程

```
用户请求音频
    ↓
验证用户认证
    ↓
验证组织权限 (orgId)
    ↓
┌─────────────────────────┐
│ SYSTEM 语音:             │
│   - 公开缓存 24小时       │
│ CUSTOM 语音:             │
│   - 私有缓存 1小时        │
└─────────────────────────┘
    ↓
生成 R2 预签名 URL
    ↓
重定向到音频
```

---

## 4. 数据模型

### 4.1 数据库实体

```prisma
// 语音模型
Voice {
  id            String        @id @default(cuid())
  orgId         String?       // 组织ID（SYSTEM语音为null）
  name          String
  description   String?
  category      VoiceCategory @default(GENERAL)
  language      String        @default("en-US")
  variant       VoiceVariant  // SYSTEM=系统预设, CUSTOM=用户自定义
  r2ObjectKey   String?       // R2存储路径
  generations   Generation[]  // 关联的生成记录
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

// 生成记录模型
Generation {
  id                String   @id @default(cuid())
  orgId             String   // 组织ID
  voiceId           String?  // 关联语音ID
  voice             Voice?   @relation(...)
  text              String   // 输入文本
  voiceName         String   // 语音名称（去规范化快照）
  r2ObjectKey       String?  // R2存储路径
  temperature       Float
  topP              Float
  topK              Int
  repetitionPenalty Float
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

### 4.2 枚举类型

| 枚举 | 值 |
|------|-----|
| **VoiceVariant** | SYSTEM, CUSTOM |
| **VoiceCategory** | AUDIOBOOK, CONVERSATIONAL, CUSTOMER_SERVICE, GENERAL, NARRATIVE, CHARACTERS, MEDITATION, MOTIVATIONAL, PODCAST, ADVERTISING, VOICEOVER, CORPORATE |

### 4.3 模型关系

```
Voice (1) ←──── (N) Generation
  │                  │
  │                  │
  │  orgId?          │  orgId
  │                  │
  └── SYSTEM语音      │
       orgId=null    │
                    Generation.orgId = Voice.orgId (SYSTEM时)
```

---

## 5. API 接口

### 5.1 语音相关

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/voices/create` | POST | 创建自定义语音 |
| `/api/voices/[voiceId]` | GET | 获取语音音频（代理到R2） |

### 5.2 音频相关

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/audio/[generationId]` | GET | 获取生成音频（代理到R2） |

### 5.3 tRPC 接口

#### voices 路由器

| 过程 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `voices.getAll` | `{ query?: string }` | `{ custom: Voice[], system: Voice[] }` | 获取所有语音 |
| `voices.delete` | `{ id: string }` | `Voice` | 删除自定义语音 |

#### generations 路由器

| 过程 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `generations.getById` | `{ id: string }` | `Generation` | 获取单个生成记录 |
| `generations.getAll` | - | `Generation[]` | 获取所有生成记录 |
| `generations.create` | 创建参数 | `Generation` | 创建新生成 |

#### billing 路由器

| 过程 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `billing.createCheckout` | - | `{ url: string }` | 创建 Polar 结账会话 |
| `billing.createPortalSession` | - | `{ url: string }` | 创建客户门户会话 |
| `billing.getStatus` | - | 订阅状态和预估费用 | 获取订阅状态 |

---

## 6. 页面结构

### 6.1 路由结构

```
src/app/
├── (dashboard)/
│   ├── layout.tsx               # Dashboard 布局（侧边栏）
│   ├── page.tsx                 # 首页/Dashboard
│   ├── text-to-speech/
│   │   ├── page.tsx            # TTS 主页面
│   │   ├── layout.tsx
│   │   ├── [generationId]/    # 生成详情页
│   │   └── loading.tsx
│   ├── voices/
│   │   ├── page.tsx            # 语音库页面
│   │   └── layout.tsx
│   └── settings/
│       ├── page.tsx            # 设置页面
│       └── settings-view.tsx
├── sign-in/[[...sign-in]]/     # 登录
├── sign-up/[[...sign-up]]/     # 注册
└── org-selection/             # 组织选择
```

### 6.2 页面功能

| 页面 | 路由 | 功能 |
|------|------|------|
| Dashboard 首页 | `/` | 快速操作、使用量统计 |
| 文本转语音 | `/text-to-speech` | TTS 生成核心页面 |
| 生成详情 | `/text-to-speech/[id]` | 查看/重新生成音频 |
| 语音库 | `/voices` | 管理语音（系统/自定义） |
| 设置 | `/settings` | 用户和组织设置 |

### 6.3 TTS 页面布局

```
┌─────────────────────────────────────────┐
│  Text-to-Speech                        │
├─────────────────────────────────────────┤
│  ┌─────────────────┐ ┌────────────────┐ │
│  │  文本输入面板   │ │  语音选择器     │ │
│  │                 │ │                │ │
│  │  [文本输入]     │ │  ○ 系统语音     │ │
│  │                 │ │  ○ 自定义语音   │ │
│  │                 │ │                │ │
│  └─────────────────┘ └────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ │
│  │  参数设置面板   │ │  历史记录抽屉   │ │
│  │                 │ │                │ │
│  │  temperature    │ │  - 生成1       │ │
│  │  topP           │ │  - 生成2       │ │
│  │  topK           │ │  ...           │ │
│  │  repetition     │ │                │ │
│  └─────────────────┘ └────────────────┘ │
│              [ Generate ]              │
└─────────────────────────────────────────┘
```

---

## 7. 存储结构

### 7.1 R2 存储路径

| 类型 | 路径格式 | 访问权限 |
|------|----------|----------|
| 语音文件 | `voices/orgs/{orgId}/{voiceId}` | CUSTOM: 私有, SYSTEM: 公开 |
| 生成音频 | `generations/orgs/{orgId}/{generationId}` | 私有 |

### 7.2 缓存策略

| 类型 | 缓存时间 | 说明 |
|------|----------|------|
| SYSTEM 语音 | 24小时 | 公开可访问 |
| CUSTOM 语音 | 1小时 | 需要认证 |
| 生成音频 | 1小时 | 需要认证 |

---

## 8. 计费规则

### 8.1 使用量计费

| 功能 | 计费方式 | 单价 |
|------|----------|------|
| 文本转语音 | 按字符数 | $0.30/1000 字符 |
| 语音克隆 | 按次 | 免费（限订阅用户） |

### 8.2 订阅流程

```
1. 用户创建 Polar 结账会话
2. 完成订阅支付
3. 激活订阅状态
4. 允许使用 TTS 和语音克隆功能
5. 按实际使用量记录计费事件
```

---

## 9. 安全机制

### 9.1 认证与授权

1. **Clerk 认证**: 所有 API 和页面需要有效 session
2. **组织隔离**: 通过 `orgId` 过滤数据访问
3. **订阅验证**: 关键操作前检查订阅状态

### 9.2 权限控制

| 操作 | 权限要求 |
|------|----------|
| 查看系统语音 | 已登录 |
| 查看/操作自定义语音 | 同组织成员 |
| 创建 TTS | 有效订阅 |
| 创建自定义语音 | 有效订阅 |

---

## 10. 功能优先级

### 10.1 MVP 核心功能

1. **P0 - 必须**
   - 用户注册/登录 (Clerk)
   - 文本转语音生成
   - 系统预设语音使用
   - 音频文件访问

2. **P1 - 重要**
   - 自定义语音克隆
   - 订阅管理
   - 使用量统计

3. **P2 - 增强**
   - 历史记录管理
   - 语音搜索
   - 参数预设

---

## 附录

### A. 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `CLERK_PUBLISHABLE_KEY` | Clerk 公钥 |
| `CLERK_SECRET_KEY` | Clerk 密钥 |
| `R2_ACCOUNT_ID` | Cloudflare R2 账户ID |
| `R2_ACCESS_KEY_ID` | R2 访问密钥 |
| `R2_SECRET_ACCESS_KEY` | R2 密钥 |
| `R2_BUCKET_NAME` | R2 存储桶名称 |
| `CHATTERBOX_API_KEY` | Chatterbox API 密钥 |
| `POLAR_ACCESS_TOKEN` | Polar SDK 访问令牌 |

### B. 第三方服务

| 服务 | 用途 | 文档 |
|------|------|------|
| Clerk | 认证和多租户 | clerk.dev |
| Polar | 订阅管理 | polar.sh |
| Chatterbox | TTS 引擎 | chatterbox.co |
| Cloudflare R2 | 文件存储 | developers.cloudflare.com/r2 |
