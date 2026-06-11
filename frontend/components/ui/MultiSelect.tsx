import React, { useState, useEffect, useRef } from "react";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Select options..." }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleSelectOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((val) => val !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const handleRemoveValue = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((val) => val !== option));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={cn(
          "min-h-10 w-full rounded-lg border border-border-default bg-neutral-900/40 px-3 py-1.5 text-[13px] text-text-primary flex items-center justify-between cursor-pointer focus-within:border-accent-purple focus-within:ring-1 focus-within:ring-accent-purple transition-all gap-2 flex-wrap",
          isOpen && "border-accent-purple ring-1 ring-accent-purple"
        )}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1">
          {value.length === 0 ? (
            <span className="text-text-tertiary">{placeholder}</span>
          ) : (
            value.map((val) => (
              <span
                key={val}
                className="flex items-center gap-1 bg-bg-tertiary border border-border-default text-text-secondary rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:text-text-primary"
              >
                <span>{val}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveValue(val, e)}
                  className="hover:text-accent-red focus:outline-none transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-text-secondary transition-transform duration-200", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-lg border border-border-strong bg-bg-secondary p-1.5 shadow-xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = value.includes(option);
              return (
                <div
                  key={option}
                  onClick={() => handleSelectOption(option)}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all",
                    isSelected && "text-text-primary bg-bg-highlight/30"
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className="h-3.5 w-3.5 rounded border-border-default bg-neutral-900 text-accent-purple focus:ring-0 cursor-pointer"
                  />
                  <span className="font-medium">{option}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
