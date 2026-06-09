import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
}>) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}
