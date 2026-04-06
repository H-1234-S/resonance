"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { TextInputPanel } from "@/features/text-to-speech/components/text-input-panel";
import { VoicePreviewPlaceholder } from "@/features/text-to-speech/components/voice-preview-placeholder";
import { SettingsPanel } from "@/features/text-to-speech/components/settings-panel";
import {
  TextToSpeechForm,
  defaultTTSValues,
  type TTSFormValues
} from "@/features/text-to-speech/components/text-to-speech-form";
import { TTSVoicesProvider } from "../contexts/tts-voices-context";

export function TextToSpeechView({
  initialValues,
}: {
  initialValues?: Partial<TTSFormValues>;
}) {
  const trpc = useTRPC();
  // 使用 useSuspenseQuery 钩子从 trpc 获取所有可用的语音列表。这个钩子会在数据加载完成之前让组件处于 Suspense 状态，直到数据准备好为止。
  const {
    data: voices,
  } = useSuspenseQuery(trpc.voices.getAll.queryOptions());  // 从缓存中获取语音列表，如果没有缓存则发起网络请求

  const { custom: customVoices, system: systemVoices } = voices;

  // 合并自定义语音和系统语音为一个总的语音列表，方便后续查找和使用
  const allVoices = [...customVoices, ...systemVoices];
  // 兜底
  const fallbackVoiceId = allVoices[0]?.id ?? "";

  //  根据 initialValues 中的 voiceId 来确定最终使用哪个 voiceId。如果 initialValues 中的 voiceId 存在并且在 allVoices 中找得到，就用它；否则就用 fallbackVoiceId 作为默认值。

  const resolvedVoiceId =
    initialValues?.voiceId &&
      // some检测数组中是否“至少有一个”元素满足指定的条件。
      allVoices.some((v) => v.id === initialValues.voiceId)
      ? initialValues.voiceId
      : fallbackVoiceId;

  const defaultValues: TTSFormValues = {
    ...defaultTTSValues,
    ...initialValues,
    voiceId: resolvedVoiceId,
  };

  return (
    // TTSVoicesProvider 组件用于将语音数据通过 React Context 提供给子组件，使得子组件可以方便地访问和使用这些语音数据，而不需要通过 props 一层层传递。
    <TTSVoicesProvider value={{ customVoices, systemVoices, allVoices }}>
      <TextToSpeechForm defaultValues={defaultValues}>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <TextInputPanel />
            <VoicePreviewPlaceholder />
          </div>
          <SettingsPanel />
        </div>
      </TextToSpeechForm>
    </TTSVoicesProvider>
  );
};
