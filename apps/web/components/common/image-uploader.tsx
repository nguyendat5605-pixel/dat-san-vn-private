"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, Check, ImagePlus, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiOrigin } from "@/lib/api-base-url";
import {
  cn,
  getOptionalSafeImageUrl,
  shouldUnoptimizeImage,
} from "@/lib/utils";

const UPLOAD_URL = `${getApiOrigin()}/api/upload`;

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  getToken: () => Promise<string | null>;
  maxImages?: number;
  disabled?: boolean;
  selectedBannerImage?: string | null;
  onSelectBannerImage?: (url: string) => void;
}

export function ImageUploader({
  value,
  onChange,
  getToken,
  maxImages = 10,
  disabled = false,
  selectedBannerImage = null,
  onSelectBannerImage,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const token = await getToken();
      if (!token) {
        setError("Vui lòng đăng nhập lại để upload ảnh.");
        return;
      }

      const remaining = maxImages - value.length;
      if (remaining <= 0) {
        setError(`Tối đa ${maxImages} ảnh.`);
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remaining);

      setUploading(true);
      setError(null);

      const uploadedUrls: string[] = [];
      const errors: string[] = [];

      for (const file of filesToUpload) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          errors.push(`${file.name}: Chỉ chấp nhận JPEG, PNG, WebP.`);
          continue;
        }

        if (file.size > 5 * 1024 * 1024) {
          errors.push(`${file.name}: Vượt quá 5MB.`);
          continue;
        }

        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(UPLOAD_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            const msg =
              typeof errBody.message === "string"
                ? errBody.message
                : `Lỗi upload (${response.status})`;
            errors.push(`${file.name}: ${msg}`);
            continue;
          }

          const result = (await response.json()) as {
            url?: string;
            data?: { url?: string };
          };
          const url = result.url ?? result.data?.url;

          if (url) {
            uploadedUrls.push(url);
          } else {
            errors.push(`${file.name}: Không nhận được URL từ server.`);
          }
        } catch (err) {
          errors.push(
            `${file.name}: ${
              err instanceof Error ? err.message : "Upload thất bại."
            }`,
          );
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...value, ...uploadedUrls]);
      }

      if (errors.length > 0) {
        setError(errors.join("\n"));
      }

      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [getToken, maxImages, onChange, value],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [onChange, value],
  );

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40",
          disabled && "pointer-events-none opacity-50",
          uploading && "pointer-events-none",
        )}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">
              Đang tải ảnh lên...
            </span>
          </>
        ) : (
          <>
            <ImagePlus className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">
              Nhấn để chọn ảnh hoặc kéo thả
            </span>
            <span className="px-3 text-center text-xs text-slate-400">
              JPEG, PNG, WebP - tối đa 5MB mỗi ảnh - tối đa {maxImages} ảnh
            </span>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
        />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <pre className="whitespace-pre-wrap font-sans">{error}</pre>
        </div>
      ) : null}

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((url, index) => {
            const isSelectedBanner = url === selectedBannerImage;

            return (
              <div
                key={`${url}-${index}`}
                className={cn(
                  "group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-slate-100 transition",
                  isSelectedBanner
                    ? "border-emerald-500 shadow-lg shadow-emerald-900/10 ring-2 ring-emerald-400/40"
                    : "border-slate-200",
                )}
              >
                <UploaderImagePreview src={url} index={index} />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/45 to-transparent px-2 pb-2 pt-8">
                  {isSelectedBanner ? (
                    <Badge className="w-full justify-center gap-1 rounded-full bg-emerald-500 text-white hover:bg-emerald-500">
                      <Check className="h-3.5 w-3.5" />
                      Đang làm banner
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 w-full rounded-full bg-white/90 px-2 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-white"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBannerImage?.(url);
                      }}
                    >
                      Đặt làm banner
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(index);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function UploaderImagePreview({
  src,
  index,
}: Readonly<{
  src: string;
  index: number;
}>) {
  const [hasError, setHasError] = useState(false);
  const safeUrl = getOptionalSafeImageUrl(src);

  if (!safeUrl || hasError) {
    return (
      <div className="absolute inset-0 overflow-hidden bg-[linear-gradient(135deg,#064e3b_0%,#047857_50%,#0f766e_100%)]">
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.24)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="absolute inset-4 rounded-xl border border-white/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 to-transparent" />
        <div className="relative grid h-full place-items-center text-xs font-semibold text-white/90">
          DatSanVN
        </div>
      </div>
    );
  }

  return (
    <Image
      src={safeUrl}
      alt={`Ảnh sân ${index + 1}`}
      fill
      className="object-cover transition duration-300 group-hover:scale-105"
      sizes="(max-width: 640px) 50vw, 33vw"
      unoptimized={shouldUnoptimizeImage(safeUrl)}
      onError={() => setHasError(true)}
    />
  );
}
