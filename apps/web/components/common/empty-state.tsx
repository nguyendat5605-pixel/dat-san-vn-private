import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: Readonly<{
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}>) {
  return (
    <div className="surface-panel flex flex-col items-center rounded-[32px] border border-dashed border-slate-200 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <SearchX className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-600">{description}</p>
      <Button asChild variant="secondary" className="mt-5">
        <a href={actionHref}>{actionLabel}</a>
      </Button>
    </div>
  );
}
