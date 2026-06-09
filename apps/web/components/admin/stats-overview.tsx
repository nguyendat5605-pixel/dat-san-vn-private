"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function AdminStatsCard({
  title,
  value,
  description,
  icon,
  iconClassName,
  highlight,
}: Readonly<{
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  iconClassName?: string;
  highlight?: boolean;
}>) {
  return (
    <Card
      className={`border-white/70 shadow-[0_18px_60px_rgba(16,34,22,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_80px_rgba(16,34,22,0.12)] ${
        highlight ? "bg-gradient-to-br from-red-50/80 to-white/92 ring-1 ring-red-200/60" : "bg-white/92"
      }`}
    >
      <CardContent className="p-6">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName ?? "bg-indigo-50 text-indigo-600"}`}
        >
          {icon}
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</div>
        <div className={`mt-2 text-3xl font-semibold ${highlight ? "text-red-600" : "text-slate-950"}`}>{value}</div>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
