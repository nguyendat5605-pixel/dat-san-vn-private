"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { FieldSize, VenueSummary } from "@dat-san-vn/types";
import { ArrowUpRight, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, getVenueImageSrc, shouldUnoptimizeImage } from "@/lib/utils";
import { venueDetails } from "@/lib/mock-data";

const sizeLabel: Record<FieldSize, string> = {
  FIELD_5: "Sân 5",
  FIELD_7: "Sân 7",
  FIELD_11: "Sân 11",
  OTHER: "Khác",
};

export function VenueCard({
  venue,
  compact = false,
}: Readonly<{
  venue: VenueSummary;
  compact?: boolean;
}>) {
  const detail = venueDetails.find((item) => item.id === venue.id);
  const selectedImageSrc = useMemo(() => getVenueImageSrc(venue), [venue]);
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const imageSrc =
    selectedImageSrc && selectedImageSrc !== failedImageSrc
      ? selectedImageSrc
      : null;

  return (
    <Card className="group overflow-hidden rounded-[24px] border border-white/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(16,34,22,0.14)] sm:rounded-[32px]">
      <div className={compact ? "grid gap-4 p-4 sm:grid-cols-[180px_1fr]" : ""}>
        <div
          className={
            compact
              ? "relative aspect-[4/3] min-h-[180px] overflow-hidden rounded-[24px]"
              : "relative aspect-[4/3] overflow-hidden rounded-t-[inherit]"
          }
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={venue.name}
              fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes={
                compact
                  ? "(max-width: 768px) 100vw, 180px"
                  : "(max-width: 768px) 100vw, 33vw"
              }
              unoptimized={shouldUnoptimizeImage(imageSrc)}
              onError={() => setFailedImageSrc(imageSrc)}
            />
          ) : (
            <VenueBannerFallback venueName={venue.name} />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/70 to-transparent px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-current text-amber-300" />
              <span>{detail?.rating.toFixed(1) ?? "4.7"}</span>
            </div>
            <Badge className="bg-white/14 text-white hover:bg-white/14">
              {detail?.categoryLabel ?? "Nổi bật"}
            </Badge>
          </div>
        </div>

        <CardContent className={compact ? "p-0 pt-1" : "p-5"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold text-slate-950">
                {venue.name}
              </h3>
              <p className="mt-2 flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                {venue.address}, {venue.district}
              </p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-slate-400 transition group-hover:text-emerald-700" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {venue.fields.slice(0, 3).map((field) => (
              <Badge key={field.id} variant="outline" className="bg-slate-50">
                {sizeLabel[field.size]}
              </Badge>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:flex sm:items-end sm:justify-between sm:gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Giá từ
              </div>
              <div className="text-lg font-semibold text-slate-950">
                {(() => {
                  const rawPrice = Number(
                    venue.pricePerHour ?? detail?.minPrice ?? 0,
                  );
                  return Number.isFinite(rawPrice) && rawPrice > 0
                    ? `${rawPrice.toLocaleString("vi-VN")} đ`
                    : "Liên hệ";
                })()}
              </div>
            </div>
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/venues/${venue.id}`}>Xem chi tiết</Link>
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function VenueBannerFallback({ venueName }: Readonly<{ venueName: string }>) {
  const initials = venueName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,#064e3b_0%,#047857_48%,#0f766e_100%)] text-white">
      <div
        className={cn(
          "absolute inset-0 opacity-25",
          "bg-[linear-gradient(rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.24)_1px,transparent_1px)] bg-[size:34px_34px]",
        )}
      />
      <div className="absolute left-1/2 top-1/2 h-[74%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/25" />
      <div className="absolute inset-5 rounded-[18px] border border-white/20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.2),transparent_28%),linear-gradient(to_top,rgba(2,6,23,0.28),transparent_56%)]" />
      <div className="relative flex h-full items-center justify-center">
        <div className="grid place-items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/25 bg-white/15 shadow-lg shadow-emerald-950/20 backdrop-blur">
            <span className="text-lg font-semibold tracking-normal">
              {initials || "DV"}
            </span>
          </div>
          <div className="text-sm font-semibold tracking-normal text-white/95">
            DatSanVN
          </div>
        </div>
      </div>
    </div>
  );
}
