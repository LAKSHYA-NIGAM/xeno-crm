import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number; // 0-based index
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full max-w-3xl mx-auto px-4 py-4 border-b border-border-subtle">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isActive = idx === currentStep;

        return (
          <React.Fragment key={step}>
            {/* Step Item */}
            <div className="flex items-center gap-2">
              {/* Indicator */}
              <div className="flex items-center justify-center">
                {isCompleted ? (
                  <div className="h-5 w-5 rounded-full bg-accent-green/20 border border-accent-green flex items-center justify-center text-accent-green">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                ) : isActive ? (
                  <div className="h-5 w-5 rounded-full bg-accent-purple flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-border-default bg-neutral-900/60 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-text-tertiary" />
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-xs font-semibold tracking-wide transition-colors duration-200 whitespace-nowrap",
                  isActive ? "text-text-primary" : "text-text-secondary"
                )}
              >
                {step}
              </span>
            </div>

            {/* Connector Line */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 mx-3 h-[2px] rounded-full transition-all duration-300",
                  isCompleted ? "bg-accent-green/40" : "bg-border-subtle"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
