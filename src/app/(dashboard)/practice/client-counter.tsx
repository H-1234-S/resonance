"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClientCounterProps {
  initialValue: number;
}

export default function ClientCounter({ initialValue }: ClientCounterProps) {
  const [count, setCount] = useState(initialValue);
  const [inputValue, setInputValue] = useState("");

  const handleIncrement = () => {
    setCount(count + 1);
  };

  const handleDecrement = () => {
    setCount(count - 1);
  };

  const handleSetValue = () => {
    const num = parseInt(inputValue);
    if (!isNaN(num)) {
      setCount(num);
      setInputValue("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button onClick={handleDecrement} variant="outline" size="lg">
          -
        </Button>

        <div className="text-center">
          <div className="text-4xl font-bold">{count}</div>
          <div className="text-sm text-muted-foreground">当前值</div>
        </div>

        <Button onClick={handleIncrement} variant="outline" size="lg">
          +
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="设置新值"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleSetValue}>设置</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>这是一个客户端组件，因为：</p>
        <ul className="list-disc pl-5 mt-1">
          <li>使用了 `useState` Hook 管理状态</li>
          <li>包含事件处理函数（onClick）</li>
          <li>需要浏览器环境才能运行</li>
          <li>顶部有 `"use client"` 指令</li>
        </ul>
      </div>
    </div>
  );
}