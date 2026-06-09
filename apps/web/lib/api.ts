import type { ApiResponse } from "@dat-san-vn/types";
import { getOptionalSafeImageUrl, safeArray } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  bookingItems,
  featuredVenues,
  filterVenues,
  type VenueDetail,
  type VenueSearchFilters,
  toVenueSummary,
  venueDetails,
} from "@/lib/mock-data";

const API_BASE_URL = getApiBaseUrl();
const USE_MOCK_API_FALLBACK =
  process.env.NEXT_PUBLIC_USE_MOCK_API_FALLBACK === "true";

function normalizeVenueImages<T extends { images?: unknown; heroImage?: unknown; gallery?: unknown }>(
  venue: T,
) {
  const images = safeArray(venue.images)
    .map(getOptionalSafeImageUrl)
    .filter((image): image is string => Boolean(image));
  const gallery = safeArray(venue.gallery)
    .map(getOptionalSafeImageUrl)
    .filter((image): image is string => Boolean(image));
  const heroImage =
    typeof venue.heroImage === "string" && venue.heroImage.trim()
      ? venue.heroImage.trim()
      : (images[0] ?? "");

  return {
    ...venue,
    images,
    heroImage,
    gallery:
      gallery.length > 0
        ? gallery
        : heroImage
          ? images.filter((image) => image !== heroImage)
          : [],
  };
}

type ApiErrorPayload = {
  error?: string;
  message?: string | string[];
  statusCode?: number;
};

function getErrorMessage(status: number, payload?: ApiErrorPayload) {
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;
  return `API request failed with status ${status}`;
}

async function fetchApi<T>(
  path: string,
  fallbackData: T,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: init?.cache ?? "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let errorPayload: ApiErrorPayload | undefined;

      try {
        errorPayload = (await response.json()) as ApiErrorPayload;
      } catch {
        // Use the status-based fallback below when the API returns non-JSON.
      }

      throw new Error(getErrorMessage(response.status, errorPayload));
    }

    return (await response.json()) as ApiResponse<T>;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown API error";

    if (!USE_MOCK_API_FALLBACK) {
      if (process.env.NODE_ENV === "development") {
        console.error(`[API] ${path} failed: ${message}`);
      }

      throw error;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[API] ${path} failed, using explicit mock fallback: ${message}`,
      );
    }

    return {
      data: fallbackData,
      message: "Using explicit mock fallback data.",
      statusCode: 200,
    };
  }
}

export async function getFeaturedVenues() {
  const response = await fetchApi(
    "/venues/featured",
    featuredVenues.map(toVenueSummary),
  );
  const data = response.data as any;
  const venues = Array.isArray(data) ? data : (data?.items ?? data ?? []);
  return venues.map(normalizeVenueImages);
}

export async function searchVenues(filters: VenueSearchFilters) {
  const params = new URLSearchParams();

  if (filters.q) params.set("q", filters.q);
  if (filters.district && filters.district !== "ALL")
    params.set("district", filters.district);
  if (filters.size && filters.size !== "ALL") params.set("size", filters.size);
  if (filters.priceMax) params.set("priceMax", String(filters.priceMax));
  if (filters.startTime) params.set("startTime", filters.startTime);

  const fallback = filterVenues(filters).map(toVenueSummary);
  const query = params.toString();
  const response = await fetchApi(
    `/venues${query ? `?${query}` : ""}`,
    fallback,
  );
  const data = response.data as any;
  const venues = Array.isArray(data) ? data : (data?.items ?? []);
  return venues.map(normalizeVenueImages);
}

export async function getVenueDetail(id: string): Promise<VenueDetail | null> {
  const fallback = venueDetails.find((venue) => venue.id === id) ?? null;
  const response = await fetchApi<VenueDetail | null>(
    `/venues/${id}`,
    fallback,
  );
  const venue = response.data;

  if (!venue) return null;

  return {
    ...normalizeVenueImages(venue),
    amenities: safeArray(venue.amenities),
  };
}

export async function getFieldAvailableSlots(fieldId: string, date: string) {
  const response = await fetchApi(`/fields/${fieldId}/slots?date=${date}`, []);
  const data = response.data as
    | Array<{
        id: string;
        startTime: string;
        endTime: string;
        pricePerSlot: number | string;
      }>
    | {
        slots?: Array<{
          id: string;
          startTime: string;
          endTime: string;
          pricePerSlot: number | string;
        }>;
        nextAvailableSlot?: {
          id: string;
          date?: string;
          startTime: string;
          endTime: string;
          pricePerSlot: number | string;
        } | null;
      };

  if (Array.isArray(data)) {
    return { slots: data, nextAvailableSlot: null };
  }

  return {
    slots: Array.isArray(data?.slots) ? data.slots : [],
    nextAvailableSlot: data?.nextAvailableSlot ?? null,
  };
}

export type FieldAvailableSlotsResult = Awaited<
  ReturnType<typeof getFieldAvailableSlots>
>;

export type FieldAvailableSlot = FieldAvailableSlotsResult["slots"][number];

export type NextAvailableSlot = NonNullable<
  FieldAvailableSlotsResult["nextAvailableSlot"]
>;

export async function getMyBookings() {
  const response = await fetchApi("/bookings/me", bookingItems);
  return response.data;
}
