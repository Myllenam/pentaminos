"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function QuantityStepper({
  value,
  min = 3,
  max = 12,
  onChange,
  className,
}: QuantityStepperProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-border bg-card px-2 py-1.5",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="w-auto"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Diminuir quantidade de peças"
      >
        <Minus />
      </Button>

      <span className="font-cousine text-xl font-bold text-foreground">
        {value}
      </span>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="w-auto"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Aumentar quantidade de peças"
      >
        <Plus />
      </Button>
    </div>
  );
}