# Generation 表（完整字段）

## 字段定义

| 字段名 | 类型 | 可空 | 默认值 | 索引/约束 | 说明 |
|---|---|---|---|---|---|
| `id` | `String` | 否 | `cuid()` | 主键（PK） | 生成记录唯一标识 |
| `orgId` | `String` | 否 | - | 普通索引（`@@index([orgId])`） | 组织 ID（多租户隔离） |
| `voiceId` | `String` | 是 | `NULL` | 普通索引（`@@index([voiceId])`），外键 | 关联 `Voice.id`；删除语音时置空（`onDelete: SetNull`） |
| `text` | `String` | 否 | - | - | 生成时输入文本 |
| `voiceName` | `String` | 否 | - | - | 生成时语音名快照 |
| `r2ObjectKey` | `String` | 是 | `NULL` | - | 生成音频在对象存储中的键 |
| `temperature` | `Float` | 否 | - | - | 采样温度参数 |
| `topP` | `Float` | 否 | - | - | Top-p 参数 |
| `topK` | `Int` | 否 | - | - | Top-k 参数 |
| `repetitionPenalty` | `Float` | 否 | - | - | 重复惩罚参数 |
| `createdAt` | `DateTime` | 否 | `now()` | - | 创建时间 |
| `updatedAt` | `DateTime` | 否 | 自动更新（`@updatedAt`） | - | 更新时间 |

## 示例数据

| id | orgId | voiceId | text | voiceName | r2ObjectKey | temperature | topP | topK | repetitionPenalty | createdAt | updatedAt |
|---|---|---|---|---|---|---:|---:|---:|---:|---|---|
| `cm1gen001` | `org_acme` | `cm1voice002` | `欢迎使用 VoxClone。` | `Alice Custom` | `generations/org_acme/cm1gen001.mp3` | 0.7 | 0.9 | 40 | 1.1 | `2026-04-16T08:30:00Z` | `2026-04-16T08:30:00Z` |
| `cm1gen002` | `org_acme` | `NULL` | `本条历史在语音删除后仍可查看。` | `Alice Custom` | `generations/org_acme/cm1gen002.mp3` | 0.6 | 0.85 | 32 | 1.05 | `2026-04-16T09:10:00Z` | `2026-04-16T09:10:00Z` |
