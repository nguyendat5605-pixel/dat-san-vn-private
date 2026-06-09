import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconClassName,
}: Readonly<{
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
}>) {
  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
      <CardContent className="p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconClassName ?? "bg-emerald-50 text-emerald-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</div>
        <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}
