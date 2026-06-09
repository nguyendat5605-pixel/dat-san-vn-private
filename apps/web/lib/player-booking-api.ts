import type {
  ApiResponse,
  BookingStatus,
  FieldSize,
  SportType,
} from "@dat-san-vn/types";
import {
  combineDateAndTime,
  formatDateLabel,
  formatTimeRange,
  isMoreThanHoursAway,
  toNumber,
} from "@/lib/utils";
import { getPaymentHoldExpiresAt } from "@/lib/payment-hold";
import { getApiBaseUrl } from "@/lib/api-base-url";

const API_BASE_URL = getApiBaseUrl();

type ApiEnvelope<T> = ApiResponse<T> | T;

interface RawPlayerBooking {
  id: string;
  status: BookingStatus;
  totalPrice: number | string;
  refundAmount?: number | string | null;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  venue: {
    id: string;
    name: string;
    address: string;
  };
  bookingSlots: Array<{
    venueSlot: {
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      field?: {
        id?: string;
        name: string;
        sportType?: SportType;
        size?: FieldSize;
      } | null;
    };
  }>;
}

export interface PlayerBooking {
  id: string;
  venueId: string;
  venueName: string;
  venueAddress: string;
  fieldName: string;
  bookingDate: string;
  bookingTime: string;
  startsAt: string | null;
  status: BookingStatus;
  totalPrice: number;
  refundAmount: number;
  refundPercent: 0 | 50 | 100;
  canCancel: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  expiresAt: string | null;
}

interface RequestApiOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
}

export interface CreatePlayerBookingInput {
  fieldId: string;
  timeSlotId: string;
  note?: string;
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

async function requestApi<T>(
  path: string,
  { token, body, headers, ...init }: RequestApiOptions = {},
) {
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
      const errorPayload = (await response.json()) as {
        message?: string | string[];
      };
      if (Array.isArray(errorPayload.message)) {
        message = errorPayload.message.join(", ");
      } else if (typeof errorPayload.message === "string") {
        message = errorPayload.message;
      }
    } catch {
      // Use status fallback when the API does not return JSON.
    }

    throw new Error(message);
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch (e) {
    throw new Error(`API returned invalid JSON (${response.status})`);
  }
  return unwrapApiResponse(payload);
}

function getRefundPercent(startsAt: string | null): 0 | 50 | 100 {
  if (!startsAt) return 0;
  if (isMoreThanHoursAway(startsAt, 12)) return 100;
  if (isMoreThanHoursAway(startsAt, 6)) return 50;
  return 0;
}

function mapPlayerBooking(booking: RawPlayerBooking): PlayerBooking {
  const firstSlot = [...booking.bookingSlots]
    .map((bookingSlot) => bookingSlot.venueSlot)
    .sort((a, b) => {
      const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.startTime.localeCompare(b.startTime);
    })[0];
  const startsAt = firstSlot
    ? combineDateAndTime(firstSlot.date, firstSlot.startTime)
    : null;

  return {
    id: booking.id,
    venueId: booking.venue.id,
    venueName: booking.venue.name,
    venueAddress: booking.venue.address,
    fieldName: firstSlot?.field?.name ?? "Chưa có sân con",
    bookingDate: firstSlot ? formatDateLabel(firstSlot.date) : "Chưa có ngày",
    bookingTime: firstSlot
      ? formatTimeRange(firstSlot.startTime, firstSlot.endTime)
      : "Chưa có giờ",
    startsAt,
    status: booking.status,
    totalPrice: toNumber(booking.totalPrice),
    refundAmount: toNumber(booking.refundAmount),
    refundPercent: getRefundPercent(startsAt),
    canCancel: ["PENDING", "CONFIRMED"].includes(booking.status),
    cancelledAt: booking.cancelledAt ?? null,
    cancelReason: booking.cancelReason ?? null,
    expiresAt: booking.expiresAt ?? null,
  };
}

export async function getPlayerBookings(token: string) {
  const bookings = await requestApi<RawPlayerBooking[]>("/bookings/me", {
    token,
  });
  return bookings.map(mapPlayerBooking);
}

export async function createPlayerBooking(
  token: string,
  data: CreatePlayerBookingInput,
  options: { idempotencyKey?: string } = {},
) {
  // Bỏ qua gọi API nếu đang dùng mock data (ID có dạng rs-field-1, v.v.)
  if (data.fieldId.includes("-field-")) {
    return new Promise<RawPlayerBooking>((resolve) => {
      setTimeout(() => {
        resolve({
          id: `MOCK-${Math.floor(Math.random() * 10000)}`,
          status: "PENDING",
          totalPrice: 450000,
          createdAt: new Date().toISOString(),
          expiresAt: getPaymentHoldExpiresAt(),
          venue: {
            id: "mock-venue",
            name: "Mock Venue",
            address: "Mock Address",
          },
          bookingSlots: [],
        } as unknown as RawPlayerBooking);
      }, 1000);
    });
  }

  return requestApi<RawPlayerBooking>("/bookings", {
    token,
    method: "POST",
    body: data,
    headers: options.idempotencyKey
      ? { "Idempotency-Key": options.idempotencyKey }
      : undefined,
  });
}

export function cancelPlayerBooking(
  token: string,
  bookingId: string,
  reason?: string,
) {
  if (bookingId.startsWith("MOCK-") || bookingId.startsWith("BK-")) {
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  return requestApi("/bookings/cancel", {
    token,
    method: "POST",
    body: {
      bookingId,
      ...(reason?.trim() ? { reason: reason.trim() } : {}),
    },
  });
}
