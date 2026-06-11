import React from "react";
import { cn } from "@/lib/utils";

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  className?: string;
}

export function StreamingText({ text, isStreaming, className }: StreamingTextProps) {
  return (
    <span className={cn("relative break-words leading-relaxed whitespace-pre-wrap", isStreaming ? "font-mono text-text-secondary" : "font-sans text-text-primary", className)}>
      {text}
      {isStreaming && (
        <>
          <span className="inline-block text-accent-purple ml-0.5 font-bold cursor-blink">|</span>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes cursorBlink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
            .cursor-blink {
              animation: cursorBlink 0.8s step-end infinite;
            }
          `}} />
        </>
      )}
    </span>
  );
}
