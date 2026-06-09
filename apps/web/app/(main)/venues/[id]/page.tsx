import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { getFieldAvailableSlots, getVenueDetail } from "@/lib/api";
import VenueReviewsSection from "@/components/review/venue-reviews-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiveBookingPanel } from "@/components/venue/live-booking-panel";
import { VenueGallery } from "@/components/venue/venue-gallery";
import { VenueMap } from "@/components/venue/venue-map";
import {
  formatCurrency,
  formatTimeRange,
  formatVietnamDateParam,
  toNumber,
} from "@/lib/utils";

type VenueDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type BookableSlot = {
  id?: string;
  startTime?: string;
  endTime?: string;
  pricePerSlot?: number | string;
};

type BookableField = typeof firstFieldFallback & {
  slots?: BookableSlot[];
  availableSlots?: Array<string | BookableSlot>;
};

const firstFieldFallback = {
  id: "",
  name: "Chưa có sân con",
  pricePerSlot: 0,
  availableSlots: [] as Array<string | BookableSlot>,
};

function getSlotLabel(slot?: string | BookableSlot) {
  if (!slot) return "Chưa có slot khả dụng";
  if (typeof slot === "string") return slot;
  if (slot.startTime && slot.endTime)
    return formatTimeRange(slot.startTime, slot.endTime);
  return slot.startTime ?? "Chưa có slot khả dụng";
}

export default async function VenueDetailPage({
  params,
}: VenueDetailPageProps) {
  const { id } = await params;
  const venue = await getVenueDetail(id);

  if (!venue) {
    notFound();
  }

  const rawPrice = Number(venue.pricePerHour ?? 0);
  const priceLabel =
    Number.isFinite(rawPrice) && rawPrice > 0
      ? `${rawPrice.toLocaleString("vi-VN")} đ`
      : "Liên hệ";

  const firstField = (venue.fields[0] ?? firstFieldFallback) as BookableField;
  const today = formatVietnamDateParam();
  const liveSlots = firstField.id
    ? await getFieldAvailableSlots(firstField.id, today)
    : { slots: [], nextAvailableSlot: null };
  const bookingPrice = toNumber(firstField.pricePerSlot);

  return (
    <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{venue.categoryLabel}</Badge>
          <Badge variant="outline">{venue.districtLabel}</Badge>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-5xl">
              {venue.name}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base whitespace-pre-wrap">
              {venue.description || "Chưa có mô tả chi tiết cho sân này."}
            </p>

            <div className="mt-6 grid gap-3 text-sm text-slate-600 sm:flex sm:flex-wrap sm:gap-5">
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                {venue.address}, {venue.districtLabel}
              </span>
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-current text-amber-400" />
                {venue.rating.toFixed(1)} · {venue.reviewCount} đánh giá
              </span>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 pr-0 lg:pr-8">
              <div className="rounded-[24px] bg-emerald-50/50 p-5 border border-emerald-100">
                <div className="text-sm font-semibold text-emerald-900">
                  Thông tin nổi bật
                </div>
                <ul className="mt-3 text-sm text-emerald-800 space-y-2 list-disc list-inside">
                  <li>
                    {venue.highlight || "Chất lượng sân tốt, ánh sáng đảm bảo"}
                  </li>
                  <li>Mặt cỏ nhân tạo đạt chuẩn</li>
                  <li>Khu vực an ninh, có chỗ để xe rộng</li>
                </ul>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-5 border border-slate-100">
                <div className="text-sm font-semibold text-slate-900">
                  Giờ mở cửa
                </div>
                <div className="mt-3 text-sm text-slate-600 space-y-2">
                  <p className="grid gap-1 sm:flex sm:justify-between">
                    <span className="font-medium">Thứ 2 - Thứ 6:</span>
                    <span>05:00 - 23:00</span>
                  </p>
                  <p className="grid gap-1 border-t border-slate-200 pt-2 sm:flex sm:justify-between">
                    <span className="font-medium">Thứ 7 - CN:</span>
                    <span>{venue.openingHours || "06:00 - 23:30"}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card className="border-white/70 lg:sticky lg:top-28 lg:self-start">
            <CardContent className="grid gap-4 p-6">
              <div className="grid gap-4 sm:flex sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Giá từ
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    {priceLabel}
                  </div>
                </div>
                <LiveBookingPanel
                  venueId={venue.id}
                  venueName={venue.name}
                  fieldId={firstField.id}
                  fieldName={firstField.name}
                  bookingDate={today}
                  pricePerSlot={bookingPrice}
                  initialSlots={liveSlots.slots}
                  nextAvailableSlot={liveSlots.nextAvailableSlot}
                  venueAddress={`${venue.address}, ${venue.districtLabel}`}
                  venueImage={venue.heroImage || venue.images[0]}
                />
              </div>
              <div className="grid gap-3 rounded-[28px] bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-emerald-700" />
                  {venue.openingHours}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-700" />
                  {venue.phone}
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  {venue.highlight}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-12 mb-4">
          {(() => {
            const galleryImages = Array.isArray(venue.gallery)
              ? venue.gallery
              : [];
            return (
              <VenueGallery
                name={venue.name}
                images={[venue.heroImage, ...galleryImages].filter(Boolean)}
              />
            );
          })()}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            {venue.fields.map((field) => (
              <Card key={field.id} className="border-white/70">
                <CardContent className="grid gap-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-950">
                        {field.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        {(
                          (field as BookableField & { features?: string[] })
                            .features ?? []
                        ).join(" · ")}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {(() => {
                        const fieldPrice = toNumber(
                          (field as BookableField).pricePerSlot,
                        );
                        return fieldPrice > 0
                          ? `${fieldPrice.toLocaleString("vi-VN")} đ`
                          : priceLabel;
                      })()}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {((field as BookableField).availableSlots ?? []).map(
                      (slot) => (
                        <Badge
                          key={
                            typeof slot === "string"
                              ? slot
                              : (slot.id ?? getSlotLabel(slot))
                          }
                          variant="secondary"
                        >
                          {getSlotLabel(slot)}
                        </Badge>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6">
            <VenueMap
              districtLabel={venue.districtLabel}
              address={venue.address}
              latitude={venue.latitude}
              longitude={venue.longitude}
            />
            <Card className="border-white/70">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-slate-950">
                  Tiện ích
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {venue.amenities && venue.amenities.length > 0 ? (
                    venue.amenities.map((item) => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="bg-slate-50"
                      >
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500 italic">
                      Chưa có tiện ích
                    </span>
                  )}
                </div>
                <Button asChild variant="secondary" className="mt-6 w-full">
                  <Link href="/search">Quay lại tìm sân</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <VenueReviewsSection venueId={id} />
      </div>
    </div>
  );
}
