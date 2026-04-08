// TTSVoicesContext.tsx
// 这个文件定义了一个 React 上下文，用于在文本转语音功能中管理和提供可用的语音列表（包括自定义语音和系统语音）。它包含一个上下文提供者组件（TTSVoicesProvider）和一个自定义钩子（useTTSVoices）来访问上下文中的数据。
"use client";

import { createContext, useContext } from "react";
import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

// 定义 TTSVoiceItem 类型，表示一个文本转语音的声音项，包含 id、name 和 category 等属性。
// 这些属性来自于 trpc 的 voices.getAll 查询的输出类型中的 custom 语音列表的元素类型。

// inferRouterOutputs 用于从 trpc 的路由定义中推断出查询的输出类型
// 这样我们就可以确保 TTSVoiceItem 的类型与后端返回的数据结构保持一致。
type TTSVoiceItem =
  inferRouterOutputs<AppRouter>["voices"]["getAll"]["custom"][number];

interface TTSVoicesContextValue {
  customVoices: TTSVoiceItem[];
  systemVoices: TTSVoiceItem[];
  allVoices: TTSVoiceItem[];
};

const TTSVoicesContext = createContext<TTSVoicesContextValue | null>(null);

export function TTSVoicesProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: TTSVoicesContextValue;
}) {
  return (
    <TTSVoicesContext.Provider value={value}>
      {children}
    </TTSVoicesContext.Provider>
  );
};

export function useTTSVoices() {
  const context = useContext(TTSVoicesContext);

  if (!context) {
    throw new Error("useTTSVoices must be used within a TTSVoicesProvider");
  }

  return context;
};
