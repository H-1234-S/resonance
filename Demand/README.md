# Resonance 项目学习索引

这是一个基于代码逆向工程生成的微型需求分解，每个需求都是独立可实现的模块，适合作为学习练习。

---

## 📋 微型需求列表

### [需求 1] 用户认证与组织选择
**核心功能**：实现用户登录、注册和组织切换
**技术栈**：Clerk, Next.js App Router
**关键文件**：
- `src/app/layout.tsx` - ClerkProvider 集成
- `src/app/sign-in/[[...sign-in]]/page.tsx` - 登录页面
- `src/app/sign-up/[[...sign-up]]/page.tsx` - 注册页面
- `src/app/org-selection/page.tsx` - 组织选择页面

---

### [需求 2] 语音克隆 - 创建自定义语音
**核心功能**：允许用户上传或录制音频，创建可复用的自定义语音
**技术栈**：react-dropzone, recordrtc, music-metadata, Prisma
**关键文件**：
- `src/features/voices/components/voice-create-form.tsx` - 语音创建表单
- `src/features/voices/components/voice-recorder.tsx` - 音频录制组件
- `src/app/api/voices/create/route.ts` - 语音创建 API
- `src/trpc/routers/voices.ts` - 语音查询接口
- `src/lib/r2.ts` - R2 存储上传

---

### [需求 3] 文本转语音 - 语音生成
**核心功能**：输入文本，选择语音，生成并播放音频
**技术栈**：tRPC, React Query, Chatterbox API, wavesurfer.js
**关键文件**：
- `src/features/text-to-speech/components/text-to-speech-form.tsx` - TTS 表单
- `src/features/text-to-speech/views/text-to-speech-view.tsx` - TTS 视图
- `src/trpc/routers/generations.ts` - 生成接口（create 方法）
- `src/lib/chatterbox-client.ts` - Chatterbox API 客户端
- `src/features/text-to-speech/hooks/use-wavesurfer.ts` - 音频波形

---

### [需求 4] 语音浏览与管理
**核心功能**：展示系统预设语音和团队自定义语音，支持试听和删除
**技术栈**：tRPC, React Query, React Context
**关键文件**：
- `src/features/voices/views/voices-view.tsx` - 语音列表视图
- `src/features/voices/components/voice-card.tsx` - 语音卡片组件
- `src/features/voices/components/voices-list.tsx` - 语音列表
- `src/features/voices/components/voices-toolbar.tsx` - 搜索工具栏
- `src/trpc/routers/voices.ts` - getAll 和 delete 方法

---

### [需求 5] 订阅与计费管理
**核心功能**：显示使用量、检查订阅状态、升级订阅
**技术栈**：Polar SDK, React Query
**关键文件**：
- `src/features/billing/components/usage-container.tsx` - 使用量展示
- `src/features/billing/hooks/use-checkout.ts` - 订阅跳转
- `src/trpc/routers/billing.ts` - 订阅相关 API
- `src/lib/polar.ts` - Polar SDK 客户端

---

### [需求 6] 生成历史管理
**核心功能**：查看所有生成记录，重新生成相同配置的音频
**技术栈**：tRPC, React Query, Next.js App Router
**关键文件**：
- `src/features/text-to-speech/components/settings-panel-history.tsx` - 历史面板
- `src/features/text-to-speech/views/text-to-speech-detail-view.tsx` - 详情视图
- `src/app/(dashboard)/text-to-speech/[generationId]/page.tsx` - 详情页面
- `src/trpc/routers/generations.ts` - getById 和 getAll 方法

---

### [需求 7] 音频播放与预览
**核心功能**：实时播放语音、显示波形图、音频预览
**技术栈**：wavesurfer.js, React Hooks, Web Audio API
**关键文件**：
- `src/features/text-to-speech/components/voice-preview-panel.tsx` - 波形预览面板
- `src/features/text-to-speech/components/voice-preview-mobile.tsx` - 移动端预览
- `src/features/text-to-speech/hooks/use-wavesurfer.ts` - Wavesurfer 封装
- `src/features/voices/components/voice-card.tsx` - 语音卡片播放按钮
- `src/hooks/use-audio-playback.ts` - 音频播放逻辑

---

## 🔧 共享基础设施

以下文件被多个需求共用：

### 数据库与存储
- `prisma/schema.prisma` - 数据库模型（Voice, Generation）
- `src/lib/db.ts` - Prisma 客户端
- `src/lib/r2.ts` - Cloudflare R2 存储

### API 客户端
- `src/lib/chatterbox-client.ts` - Chatterbox TTS API
- `src/lib/polar.ts` - Polar 订阅管理 API

### tRPC 架构
- `src/trpc/init.ts` - tRPC 初始化（baseProcedure, authProcedure, orgProcedure）
- `src/trpc/routers/_app.ts` - API 路由聚合
- `src/trpc/server.tsx` - 服务器端 tRPC 配置
- `src/trpc/client.tsx` - 客户端 tRPC 配置

### 工具函数
- `src/lib/env.ts` - 环境变量管理
- `src/lib/utils.ts` - 通用工具函数

---

## 🎯 学习路径建议

### 初级（组件层面）
1. 需求 4：语音浏览与管理（纯前端组件）
2. 需求 7：音频播放与预览（Hooks 和第三方库）

### 中级（前后端交互）
3. 需求 2：语音克隆（文件上传、表单验证）
4. 需求 3：文本转语音（API 调用、参数配置）
5. 需求 6：生成历史管理（路由参数、数据展示）

### 高级（完整业务流程）
6. 需求 1：用户认证与组织选择（第三方集成）
7. 需求 5：订阅与计费管理（支付流程、外部 API）

---

## 📚 技术栈映射

| 技术 | 应用场景 | 相关需求 |
|------|---------|---------|
| Clerk | 用户认证、组织管理 | 需求 1 |
| tRPC | API 通信、类型安全 | 需求 2, 3, 4, 5, 6 |
| React Query | 数据获取、缓存 | 需求 2, 3, 4, 5, 6 |
| Prisma | 数据库操作 | 需求 2, 3, 4, 6 |
| Cloudflare R2 | 音频文件存储 | 需求 2, 3 |
| Chatterbox | TTS 语音生成 | 需求 3 |
| Polar | 订阅管理、计费 | 需求 5 |
| react-dropzone | 文件上传 | 需求 2 |
| recordrtc | 音频录制 | 需求 2 |
| wavesurfer.js | 音频波形可视化 | 需求 3, 7 |

---

## 🚀 实践建议

1. **逐个实现**：每个需求独立实现，完成后测试
2. **先读再写**：仔细阅读关键文件的实现逻辑
3. **类型优先**：利用 TypeScript 和 Zod 进行类型验证
4. **API Mock**：在没有后端服务时，使用 Mock 数据测试前端
5. **逐步扩展**：从最小功能开始，逐步添加特性

---

**生成日期**：2026-04-11
**项目版本**：0.1.0
