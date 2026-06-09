"use client";

import { useEffect, useState } from "react";
import type { CreateVenuePayload } from "@dat-san-vn/types";
import { useForm } from "react-hook-form";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/common/image-uploader";
import type { OwnerVenue } from "@/lib/owner-api";
import { formatCurrency, getVenueImageSrc } from "@/lib/utils";

interface VenueFormValues {
  name: string;
  description: string;
  address: string;
  district: string;
  city: string;
  latitude: string;
  longitude: string;
  pricePerHour: string;
  amenities: string;
}

const defaultValues: VenueFormValues = {
  name: "",
  description: "",
  address: "",
  district: "",
  city: "",
  latitude: "",
  longitude: "",
  pricePerHour: "",
  amenities: "",
};

function toMultiValueList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueImageUrls(urls: string[]) {
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
}

function getSelectedHeroImage(venue: OwnerVenue | null | undefined) {
  if (!venue) return null;
  return getVenueImageSrc(venue) ?? uniqueImageUrls(venue.images)[0] ?? null;
}

function optionalNumber(value: string, fallback: undefined | null) {
  const normalized = value.trim();
  return normalized ? Number(normalized) : fallback;
}

/* ── Shared input styling for focus/transition ─────────────────── */
const inputClassName =
  "transition-all duration-200 focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500 hover:border-slate-300";

export function VenueForm({
  venue,
  submitting = false,
  onSubmit,
  onCancel,
}: Readonly<{
  venue?: OwnerVenue | null;
  submitting?: boolean;
  onSubmit: (payload: CreateVenuePayload) => void | Promise<void>;
  onCancel?: () => void;
}>) {
  const { getToken } = useAuth();
  const form = useForm<VenueFormValues>({
    defaultValues,
  });

  // Manage images state separately (string[]) since it's not a text input anymore
  const [images, setImages] = useState<string[]>([]);
  const [selectedHeroImage, setSelectedHeroImage] = useState<string | null>(
    null,
  );

  // Watch pricePerHour for live preview
  const watchedPrice = form.watch("pricePerHour");
  const pricePreview =
    watchedPrice && Number(watchedPrice) > 0
      ? formatCurrency(Number(watchedPrice))
      : null;

  useEffect(() => {
    form.reset({
      name: venue?.name ?? "",
      description: venue?.description ?? "",
      address: venue?.address ?? "",
      district: venue?.district ?? "",
      city: venue?.city ?? "",
      latitude: venue?.latitude != null ? String(venue.latitude) : "",
      longitude: venue?.longitude != null ? String(venue.longitude) : "",
      pricePerHour: venue?.pricePerHour != null ? String(venue.pricePerHour) : "",
      amenities: venue?.amenities?.join("\n") ?? "",
    });
    const initialImages = uniqueImageUrls(venue?.images ?? []);
    setImages(initialImages);
    setSelectedHeroImage(getSelectedHeroImage(venue) ?? initialImages[0] ?? null);
  }, [form, venue]);

  function handleImagesChange(nextImages: string[]) {
    const uniqueImages = uniqueImageUrls(nextImages);
    setImages(uniqueImages);
    setSelectedHeroImage((currentHero) => {
      if (currentHero && uniqueImages.includes(currentHero)) {
        return currentHero;
      }

      return uniqueImages[0] ?? null;
    });
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const finalImages = uniqueImageUrls(images);
    const finalHeroImage =
      selectedHeroImage && finalImages.includes(selectedHeroImage)
        ? selectedHeroImage
        : (finalImages[0] ?? null);
    const orderedImages = finalHeroImage
      ? [
          finalHeroImage,
          ...finalImages.filter((image) => image !== finalHeroImage),
        ]
      : finalImages;
    const emptyOptionalValue = venue ? null : undefined;
    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || (venue ? "" : undefined),
      address: values.address.trim(),
      district: values.district.trim(),
      city: values.city.trim(),
      latitude: optionalNumber(values.latitude, emptyOptionalValue),
      longitude: optionalNumber(values.longitude, emptyOptionalValue),
      pricePerHour: optionalNumber(values.pricePerHour, emptyOptionalValue),
      images: orderedImages,
      heroImage: finalHeroImage || "",
      gallery: orderedImages.slice(1),
      amenities: toMultiValueList(values.amenities),
    } satisfies CreateVenuePayload;

    await onSubmit(payload);
  });

  return (
    <form className="grid gap-5 animate-in fade-in slide-in-from-right-4 duration-300" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="venue-name">Tên sân</Label>
        <Input
          id="venue-name"
          placeholder="Ví dụ: Sân bóng Thành Công"
          className={inputClassName}
          {...form.register("name", { required: true })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="venue-description">Mô tả</Label>
        <Textarea
          id="venue-description"
          placeholder="Mô tả ngắn về sân, chỗ gửi xe, đèn chiếu sáng..."
          className={inputClassName}
          {...form.register("description")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="venue-address">Địa chỉ</Label>
        <Input
          id="venue-address"
          placeholder="Số nhà, đường, phường/xã"
          className={inputClassName}
          {...form.register("address", { required: true })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="venue-district">Quận/Huyện</Label>
          <Input
            id="venue-district"
            placeholder="Quận 7"
            className={inputClassName}
            {...form.register("district", { required: true })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="venue-city">Tỉnh/Thành phố</Label>
          <Input
            id="venue-city"
            placeholder="TP. Hồ Chí Minh"
            className={inputClassName}
            {...form.register("city", { required: true })}
          />
        </div>
      </div>

      {/* ── Giá thuê / giờ ──────────────────────────────────── */}
      <div className="grid gap-2">
        <Label htmlFor="venue-price">Giá thuê / giờ</Label>
        <div className="relative">
          <Input
            id="venue-price"
            type="number"
            min={0}
            step={1000}
            placeholder="Ví dụ: 200000"
            className={`${inputClassName} pr-14`}
            {...form.register("pricePerHour")}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            VNĐ
          </span>
        </div>
        {pricePreview ? (
          <p className="text-xs text-emerald-600 animate-in fade-in duration-200">
            ≈ {pricePreview}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="venue-latitude">Vĩ độ</Label>
          <Input
            id="venue-latitude"
            type="number"
            step="any"
            placeholder="10.7769"
            className={inputClassName}
            {...form.register("latitude")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="venue-longitude">Kinh độ</Label>
          <Input
            id="venue-longitude"
            type="number"
            step="any"
            placeholder="106.7009"
            className={inputClassName}
            {...form.register("longitude")}
          />
        </div>
      </div>

      {/* Image upload — replaces the old textarea */}
      <div className="grid gap-2">
        <Label>Ảnh sân</Label>
        <ImageUploader
          value={images}
          onChange={handleImagesChange}
          getToken={getToken}
          maxImages={10}
          disabled={submitting}
          selectedBannerImage={selectedHeroImage}
          onSelectBannerImage={setSelectedHeroImage}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="venue-amenities">Tiện ích (mỗi dòng một mục)</Label>
        <Textarea
          id="venue-amenities"
          placeholder={"Bãi giữ xe\nNước uống"}
          className={`min-h-[96px] ${inputClassName}`}
          {...form.register("amenities")}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="transition-all duration-200 hover:scale-[1.02]"
          >
            Đóng
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={submitting}
          className="transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
        >
          {submitting ? "Đang lưu..." : venue ? "Lưu thay đổi" : "Tạo sân"}
        </Button>
      </div>
    </form>
  );
}
