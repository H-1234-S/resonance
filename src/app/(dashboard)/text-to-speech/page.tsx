import type { Metadata } from "next";
import { TextToSpeechView } from "@/features/text-to-speech/views/text-to-speech-view";
import { trpc, HydrateClient, prefetch } from "@/trpc/server";

export const metadata: Metadata = { title: "Text to Speech" };

export default async function TextToSpeechPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; voiceId?: string }>;
}) {
  const { text, voiceId } = await searchParams;

  // 预取语音列表
  prefetch(trpc.voices.getAll.queryOptions());
  // 预取生成记录
  prefetch(trpc.generations.getAll.queryOptions());

  return (
    // HydrateClient 组件用于在服务器端预取数据后，将其注入到客户端的 React Query 中，以便在客户端渲染时能够直接使用这些预取的数据，避免了不必要的加载状态和额外的网络请求。
    <HydrateClient>
      <TextToSpeechView initialValues={{ text, voiceId }} />
    </HydrateClient>
  );
};

