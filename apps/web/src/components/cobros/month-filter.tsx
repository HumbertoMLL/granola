"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@granola/ui";

import { monthLabel } from "./format";

export function MonthFilter({
  months,
  value,
}: {
  months: string[];
  value: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", next);
    startTransition(() =>
      router.push(`/app/cobros?${sp.toString()}`, { scroll: false }),
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="payment-month">Mes de los cobros</Label>
      <Select value={value} onValueChange={onChange} disabled={pending}>
        <SelectTrigger
          id="payment-month"
          className="h-9 w-fit min-w-44 text-sm"
          aria-label="Mes"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {monthLabel(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
