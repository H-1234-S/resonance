# Voice 表（完整字段）

## 字段定义

| 字段名 | 类型 | 可空 | 默认值 | 索引/约束 | 说明 |
|---|---|---|---|---|---|
| `id` | `String` | 否 | `cuid()` | 主键（PK） | 语音唯一标识 |
| `orgId` | `String` | 是 | `NULL` | 普通索引（`@@index([orgId])`） | 组织 ID；系统语音通常为空 |
| `name` | `String` | 否 | - | - | 语音名称 |
| `description` | `String` | 是 | `NULL` | - | 语音描述 |
| `category` | `VoiceCategory` | 否 | `GENERAL` | - | 语音分类（如 `AUDIOBOOK`、`PODCAST`） |
| `language` | `String` | 否 | `"en-US"` | - | 语音语言 |
| `variant` | `VoiceVariant` | 否 | - | 普通索引（`@@index([variant])`） | 语音类型：`SYSTEM` 或 `CUSTOM` |
| `r2ObjectKey` | `String` | 是 | `NULL` | - | 对象存储中的音频键 |
| `createdAt` | `DateTime` | 否 | `now()` | - | 创建时间 |
| `updatedAt` | `DateTime` | 否 | 自动更新（`@updatedAt`） | - | 更新时间 |

## 示例数据

| id | orgId | name | description | category | language | variant | r2ObjectKey | createdAt | updatedAt |
|---|---|---|---|---|---|---|---|---|---|
| `cm1voice001` | `NULL` | `Default Male` | `System default male voice` | `GENERAL` | `en-US` | `SYSTEM` | `NULL` | `2026-04-01T09:00:00Z` | `2026-04-01T09:00:00Z` |
| `cm1voice002` | `org_acme` | `Alice Custom` | `Warm and friendly support tone` | `CUSTOMER_SERVICE` | `en-US` | `CUSTOM` | `voices/org_acme/alice-custom.wav` | `2026-04-15T11:20:00Z` | `2026-04-15T11:25:00Z` |
