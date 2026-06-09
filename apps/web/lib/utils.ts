import type { FieldSize, SportType } from "@dat-san-vn/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getApiOrigin } from "@/lib/api-base-url";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRating(value: number) {
  return value.toFixed(1);
}

export function capitalizeWords(value: string) {
  return value
    .split(" ")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(" ");
}

export function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDateLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Không xác định";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatVietnamDateParam(value: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format Vietnam date");
  }

  return `${year}-${month}-${day}`;
}

function extractTimeParts(value: string | Date) {
  if (value instanceof Date) {
    return {
      hours: value.getHours(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds(),
    };
  }

  const isoMatch = value.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (isoMatch) {
    return {
      hours: Number(isoMatch[1]),
      minutes: Number(isoMatch[2]),
      seconds: Number(isoMatch[3] ?? 0),
    };
  }

  const timeMatch = value.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    return {
      hours: Number(timeMatch[1]),
      minutes: Number(timeMatch[2]),
      seconds: Number(timeMatch[3] ?? 0),
    };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    hours: parsed.getHours(),
    minutes: parsed.getMinutes(),
    seconds: parsed.getSeconds(),
  };
}

export function formatTimeLabel(value: string | Date) {
  const parts = extractTimeParts(value);
  if (!parts) return "--:--";

  return `${parts.hours.toString().padStart(2, "0")}:${parts.minutes.toString().padStart(2, "0")}`;
}

export function formatTimeRange(start: string | Date, end: string | Date) {
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

export function combineDateAndTime(
  dateValue: string | Date,
  timeValue: string | Date,
) {
  const date =
    dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);
  const time = extractTimeParts(timeValue);

  if (Number.isNaN(date.getTime()) || !time) {
    return null;
  }

  const combined = new Date(date);
  combined.setHours(time.hours, time.minutes, time.seconds ?? 0, 0);
  return combined.toISOString();
}

export function isMoreThanHoursAway(dateTime: string | Date, hours: number) {
  const parsed = dateTime instanceof Date ? dateTime : new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() - Date.now() > hours * 60 * 60 * 1000;
}

const fieldSizeLabels: Record<FieldSize, string> = {
  FIELD_5: "Sân 5",
  FIELD_7: "Sân 7",
  FIELD_11: "Sân 11",
  OTHER: "Khác",
};

export function formatFieldSizeLabel(value: FieldSize) {
  return fieldSizeLabels[value];
}

const sportTypeLabels: Record<SportType, string> = {
  FOOTBALL: "Bóng đá",
  BADMINTON: "Cầu lông",
  TENNIS: "Tennis",
  BASKETBALL: "Bóng rổ",
  VOLLEYBALL: "Bóng chuyền",
  TABLE_TENNIS: "Bóng bàn",
  PICKLEBALL: "Pickleball",
};

export function formatSportTypeLabel(value: SportType) {
  return sportTypeLabels[value];
}

// ── Safe image URL handling ──────────────────────────────────

/**
 * Fallback placeholder image when no valid venue image is available.
 */
export const VENUE_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80";

const INVALID_IMAGE_VALUES = new Set([
  "null",
  "undefined",
  "none",
  "n/a",
  "na",
  "#",
]);

const LOCAL_API_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Sanitize and validate an image URL string without substituting a fallback.
 *
 * Handles common issues like:
 * - BBCode wrappers: `[img]https://abc.webp[/img]`
 * - Whitespace / empty values
 * - Invalid URL schemes (data:, javascript:)
 * - Malformed strings
 *
 * Returns a clean URL or null.
 */
function cleanImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  let cleaned = raw
    .trim()
    .replace(/^\[img\]/i, "")
    .replace(/\[\/img\]$/i, "")
    .trim();

  // Strip any remaining BBCode-like tags
  cleaned = cleaned
    .replace(/^\[.*?\]/g, "")
    .replace(/\[.*?\]$/g, "")
    .trim();

  if (!cleaned || INVALID_IMAGE_VALUES.has(cleaned.toLowerCase())) {
    return null;
  }

  // Reject dangerous or invalid schemes
  if (/^(javascript:|blob:|file:)/i.test(cleaned)) {
    return null;
  }

  if (cleaned.startsWith("data:")) {
    return cleaned;
  }

  if (/^[a-zA-Z]:[\\/]/.test(cleaned)) {
    return null;
  }

  for (const localOrigin of LOCAL_API_ORIGINS) {
    if (cleaned.startsWith(localOrigin)) {
      return `${getApiOrigin()}${cleaned.slice(localOrigin.length)}`;
    }
  }

  if (cleaned.startsWith("/uploads/")) {
    return `${getApiOrigin()}${cleaned}`;
  }

  if (cleaned.startsWith("/")) {
    return cleaned;
  }

  // Validate URL structure
  try {
    const url = new URL(cleaned);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function getOptionalSafeImageUrl(raw: unknown): string | null {
  return cleanImageUrl(raw);
}

/**
 * Sanitize and validate an image URL string.
 *
 * Returns a clean URL or the fallback placeholder.
 */
export function getSafeImageUrl(raw: unknown): string {
  return cleanImageUrl(raw) ?? VENUE_PLACEHOLDER_IMAGE;
}

type VenueImageSource = {
  heroImage?: unknown;
  imageUrl?: unknown;
  thumbnailUrl?: unknown;
  coverImage?: unknown;
  images?: unknown;
  gallery?: unknown;
};

export function getVenueImageSrc(venue: VenueImageSource): string | null {
  const images = Array.isArray(venue.images) ? venue.images : [];
  const gallery = Array.isArray(venue.gallery) ? venue.gallery : [];
  const candidates = [
    venue.heroImage,
    venue.coverImage,
    venue.thumbnailUrl,
    venue.imageUrl,
    images[0],
    gallery[0],
  ];

  for (const candidate of candidates) {
    const imageUrl = getOptionalSafeImageUrl(candidate);
    if (imageUrl) return imageUrl;
  }

  return null;
}

export function shouldUnoptimizeImage(src: string) {
  if (src.startsWith("/uploads/")) return true;

  try {
    const url = new URL(src);
    const isLocalApiHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "192.168.2.33";

    return (
      isLocalApiHost &&
      url.port === "3000" &&
      url.pathname.startsWith("/uploads/")
    );
  } catch {
    return false;
  }
}

/**
 * Safely parse JSON strings or return the value if it's already an array/object.
 */
export function safeJsonParse(value: unknown, fallback: any = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value; // Already an object or array
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Safely convert a value to a string array.
 * Useful for fields like images, amenities, gallery which might be stored as JSON strings or arrays.
 */
export function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    // If it's not JSON but a comma-separated string, we could potentially split it
    // but the requirement is to return [] if it's not a valid JSON array.
    // However, sometimes it's just a plain string if it's a single item.
    if (value.trim()) return [value.trim()];
    return [];
  }
}
