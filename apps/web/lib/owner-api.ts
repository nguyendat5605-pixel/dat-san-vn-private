import type {
  ApiResponse,
  BookingStatus,
  CreateFieldPayload,
  CreateVenuePayload,
  FieldSize,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  SportType,
  UpdateFieldPayload,
  UpdateVenuePayload,
  UserRole,
  VenueOwnerStatus,
} from "@dat-san-vn/types";
import {
  combineDateAndTime,
  formatDateLabel,
  formatTimeRange,
  getOptionalSafeImageUrl,
  isMoreThanHoursAway,
  toNumber,
} from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api-base-url";

const API_BASE_URL = getApiBaseUrl();

type ApiEnvelope<T> = ApiResponse<T> | T;

interface CurrentUserProfileResponse {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface RawManagedBooking {
  id: string;
  status: BookingStatus;
  totalPrice: number | string;
  createdAt: string;
  user?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  venue: {
    id: string;
    name: string;
    address: string;
    isActive?: boolean;
  };
  bookingSlots: Array<{
    venueSlot: {
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      pricePerSlot?: number | string;
      field?: {
        id: string;
        name: string;
        sportType: SportType;
        size: FieldSize;
      } | null;
    };
  }>;
  payment?: {
    status: PaymentStatus;
    provider: PaymentProvider | null;
    attempts?: Array<{
      provider: PaymentProvider;
      status: PaymentAttemptStatus;
    }>;
  } | null;
}

interface RawOwnerVenue {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  district: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  images?: string[];
  heroImage?: string | null;
  thumbnailUrl?: string | null;
  coverImage?: string | null;
  imageUrl?: string | null;
  gallery?: string[];
  amenities?: string[];
  pricePerHour?: number | string | null;
  fields: Array<{
    id: string;
    name: string;
    sportType: SportType;
    size: FieldSize;
    isActive?: boolean;
  }>;
  owners?: Array<{
    status: VenueOwnerStatus;
  }>;
  _count?: {
    fields?: number;
    bookings?: number;
  };
}

interface RawOwnerField {
  id: string;
  venueId: string;
  name: string;
  sportType: SportType;
  size: FieldSize;
  isActive: boolean;
  _count?: {
    slots?: number;
  };
}

export type OwnerBookingStatusFilter = "ALL" | BookingStatus;

export interface CurrentUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface OwnerBooking {
  id: string;
  status: BookingStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldId: string | null;
  fieldName: string;
  sportType: SportType | null;
  size: FieldSize | null;
  bookingDate: string;
  bookingTime: string;
  createdAt: string;
  totalPrice: number;
  startsAt: string | null;
  canOwnerCancel: boolean;
  paymentProvider?: PaymentProvider | null;
  paymentStatus?: PaymentStatus | null;
  latestPaymentAttemptStatus?: PaymentAttemptStatus | null;
  isManualMomoPending?: boolean;
}

export interface OwnerVenue {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  district: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  pricePerHour: number | null;
  images: string[];
  heroImage: string | null;
  thumbnailUrl: string | null;
  coverImage: string | null;
  imageUrl: string | null;
  gallery: string[];
  amenities: string[];
  ownerStatus: VenueOwnerStatus;
  fields: Array<{
    id: string;
    name: string;
    sportType: SportType;
    size: FieldSize;
  }>;
  fieldCount: number;
  bookingCount: number;
}

export interface OwnerField {
  id: string;
  venueId: string;
  name: string;
  sportType: SportType;
  size: FieldSize;
  isActive: boolean;
  slotCount: number;
}

interface RequestApiOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
}

function unwrapApiResponse<T>(payload: ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "statusCode" in payload
  ) {
    return payload.data as T;
  }

  return payload as T;
}

async function requestApi<T>(path: string, { token, body, headers, ...init }: RequestApiOptions = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;

    try {
      const errorPayload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(errorPayload.message)) {
        message = errorPayload.message.join(", ");
      } else if (typeof errorPayload.message === "string") {
        message = errorPayload.message;
      }
    } catch {
      // Ignore JSON parsing errors and use the fallback status message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch (e) {
    throw new Error(`API returned invalid JSON (${response.status})`);
  }
  return unwrapApiResponse(payload);
}

function mapManagedBooking(booking: RawManagedBooking): OwnerBooking {
  const firstSlot = booking.bookingSlots[0]?.venueSlot;
  const startsAt = firstSlot ? combineDateAndTime(firstSlot.date, firstSlot.startTime) : null;

  return {
    id: booking.id,
    status: booking.status,
    customerName: booking.user?.fullName?.trim() || booking.user?.email || "Khách chưa xác định",
    customerEmail: booking.user?.email ?? "Không có email",
    customerPhone: booking.user?.phone ?? null,
    venueId: booking.venue.id,
    venueName: booking.venue.name,
    venueAddress: booking.venue.address,
    fieldId: firstSlot?.field?.id ?? null,
    fieldName: firstSlot?.field?.name ?? "Chưa có sân con",
    sportType: firstSlot?.field?.sportType ?? null,
    size: firstSlot?.field?.size ?? null,
    bookingDate: firstSlot ? formatDateLabel(firstSlot.date) : "Chưa có ngày",
    bookingTime: firstSlot ? formatTimeRange(firstSlot.startTime, firstSlot.endTime) : "Chưa có giờ",
    createdAt: booking.createdAt,
    totalPrice: toNumber(booking.totalPrice),
    startsAt,
    canOwnerCancel: booking.status === "CONFIRMED" && startsAt ? isMoreThanHoursAway(startsAt, 24) : false,
    paymentProvider: booking.payment?.provider ?? null,
    paymentStatus: booking.payment?.status ?? null,
    latestPaymentAttemptStatus: booking.payment?.attempts?.[0]?.status ?? null,
    isManualMomoPending:
      booking.status === "PENDING" &&
      booking.payment?.provider === "MOMO_MANUAL" &&
      booking.payment.status === "PENDING" &&
      booking.payment.attempts?.[0]?.status === "PENDING",
  };
}

function mapOwnerVenue(venue: RawOwnerVenue): OwnerVenue {
  const images = (Array.isArray(venue.images) ? venue.images : [])
    .map(getOptionalSafeImageUrl)
    .filter((image): image is string => Boolean(image));
  const heroImage =
    getOptionalSafeImageUrl(venue.heroImage) || images[0] || null;

  return {
    id: venue.id,
    name: venue.name,
    description: venue.description ?? null,
    address: venue.address,
    district: venue.district,
    city: venue.city,
    latitude: venue.latitude ?? null,
    longitude: venue.longitude ?? null,
    isActive: venue.isActive,
    pricePerHour: venue.pricePerHour != null ? Number(venue.pricePerHour) : null,
    images,
    heroImage,
    thumbnailUrl: getOptionalSafeImageUrl(venue.thumbnailUrl),
    coverImage: getOptionalSafeImageUrl(venue.coverImage),
    imageUrl: getOptionalSafeImageUrl(venue.imageUrl),
    gallery: Array.isArray(venue.gallery)
      ? venue.gallery
          .map(getOptionalSafeImageUrl)
          .filter((image): image is string => Boolean(image))
      : heroImage
        ? images.filter((image) => image !== heroImage)
        : [],
    amenities: Array.isArray(venue.amenities) ? venue.amenities : [],
    ownerStatus: venue.owners?.[0]?.status ?? "PENDING",
    fields: venue.fields.map((field) => ({
      id: field.id,
      name: field.name,
      sportType: field.sportType,
      size: field.size,
    })),
    fieldCount: venue._count?.fields ?? venue.fields.length,
    bookingCount: venue._count?.bookings ?? 0,
  };
}

function mapOwnerField(field: RawOwnerField): OwnerField {
  return {
    id: field.id,
    venueId: field.venueId,
    name: field.name,
    sportType: field.sportType,
    size: field.size,
    isActive: field.isActive,
    slotCount: field._count?.slots ?? 0,
  };
}

export async function getCurrentUserProfile(token: string, retries = 3): Promise<CurrentUserProfile | null> {
  try {
    const profile = await requestApi<CurrentUserProfileResponse>("/users/me", { token });
    return {
      id: profile.id,
      fullName: profile.fullName,
      email: profile.email,
      role: profile.role,
    } satisfies CurrentUserProfile;
  } catch (error: any) {
    // Nếu lỗi là do chưa sync kịp user từ Clerk sang DB (Race condition)
    if (error.message?.includes("User not found") && retries > 0) {
      console.log(`[Auth] User not found in DB, retrying in 2s... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return getCurrentUserProfile(token, retries - 1);
    }

    // Nếu hết lượt retry hoặc lỗi khác, ném lỗi ra ngoài
    if (retries === 0 && error.message?.includes("User not found")) {
      console.warn("[Auth] User still not found after retries. Webhook sync might be delayed.");
      return null;
    }

    throw error;
  }
}

export async function getOwnerBookings(
  token: string,
  filters: {
    status?: OwnerBookingStatusFilter;
    date?: string;
  } = {},
) {
  const searchParams = new URLSearchParams();

  if (filters.status && filters.status !== "ALL") {
    searchParams.set("status", filters.status);
  }

  if (filters.date) {
    searchParams.set("date", filters.date);
  }

  const query = searchParams.toString();
  const bookings = await requestApi<RawManagedBooking[]>(`/bookings${query ? `?${query}` : ""}`, { token });
  return bookings.map(mapManagedBooking);
}

export function confirmOwnerBooking(token: string, bookingId: string) {
  return requestApi(`/bookings/${bookingId}/confirm`, {
    token,
    method: "PATCH",
  });
}

export function cancelOwnerBooking(token: string, bookingId: string) {
  return requestApi(`/bookings/${bookingId}/cancel`, {
    token,
    method: "PATCH",
  });
}

export function confirmManualMomoPayment(token: string, bookingId: string) {
  return requestApi(`/bookings/${bookingId}/confirm-manual-payment`, {
    token,
    method: "PATCH",
  });
}

export async function getOwnerVenues(token: string) {
  const venues = await requestApi<RawOwnerVenue[]>("/venues/my", { token });
  return venues.map(mapOwnerVenue);
}

export function createOwnerVenue(token: string, payload: CreateVenuePayload) {
  return requestApi("/venues", {
    token,
    method: "POST",
    body: payload,
  });
}

export function updateOwnerVenue(token: string, venueId: string, payload: UpdateVenuePayload) {
  return requestApi(`/venues/${venueId}`, {
    token,
    method: "PATCH",
    body: payload,
  });
}

export async function getVenueFields(token: string, venueId: string) {
  const fields = await requestApi<RawOwnerField[]>(`/venues/${venueId}/fields`, { token });
  return fields.map(mapOwnerField);
}

export function createVenueField(token: string, venueId: string, payload: CreateFieldPayload) {
  return requestApi(`/venues/${venueId}/fields`, {
    token,
    method: "POST",
    body: payload,
  });
}

export function updateVenueField(token: string, fieldId: string, payload: UpdateFieldPayload) {
  return requestApi(`/fields/${fieldId}`, {
    token,
    method: "PATCH",
    body: payload,
  });
}

export function deleteVenueField(token: string, fieldId: string) {
  return requestApi(`/fields/${fieldId}`, {
    token,
    method: "DELETE",
  });
}

export function deleteOwnerVenue(token: string, venueId: string) {
  return requestApi(`/venues/${venueId}`, {
    token,
    method: "DELETE",
  });
}
