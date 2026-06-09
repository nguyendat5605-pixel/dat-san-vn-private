// ============================================================
// DatSanVN — Admin API Client
// Follows the same requestApi pattern from owner-api.ts
// ============================================================

import type {
  ApiResponse,
  BookingStatus,
  UserRole,
  VenueOwnerStatus,
  SportType,
} from "@dat-san-vn/types";
import { getApiBaseUrl } from "@/lib/api-base-url";

const API_BASE_URL = getApiBaseUrl();

type ApiEnvelope<T> = ApiResponse<T> | T;

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

interface RequestApiOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  body?: unknown;
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
      // Ignore JSON parsing errors
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

// ── Types ────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  totalVenues: number;
  totalBookings: number;
  pendingVenues: number;
  todayBookings: number;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminVenueOwner {
  id: string;
  userId: string;
  status: VenueOwnerStatus;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface AdminVenue {
  id: string;
  name: string;
  description: string | null;
  address: string;
  district: string;
  city: string;
  isActive: boolean;
  createdAt: string;
  owners: AdminVenueOwner[];
  _count: {
    fields: number;
    bookings: number;
  };
}

export interface AdminBooking {
  id: string;
  status: BookingStatus;
  totalPrice: number | string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  venue: {
    id: string;
    name: string;
    address: string;
  };
  bookingSlots: Array<{
    venueSlot: {
      date: string;
      startTime: string;
      endTime: string;
      pricePerSlot: number | string;
      field: {
        id: string;
        name: string;
        sportType: SportType;
      } | null;
    };
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── API Functions ────────────────────────────────────────────

export async function getAdminStats(token: string) {
  return requestApi<AdminStats>("/admin/stats", { token });
}

export async function getAdminUsers(token: string, page = 1, limit = 20) {
  return requestApi<PaginatedResponse<AdminUser>>(`/admin/users?page=${page}&limit=${limit}`, { token });
}

export async function updateUserRole(token: string, userId: string, role: UserRole) {
  return requestApi(`/admin/users/${userId}/role`, {
    token,
    method: "PATCH",
    body: { role },
  });
}

export async function deleteUser(token: string, userId: string) {
  return requestApi(`/admin/users/${userId}`, {
    token,
    method: "DELETE",
  });
}

export async function activateUser(token: string, userId: string) {
  return requestApi(`/admin/users/${userId}/activate`, {
    token,
    method: "PATCH",
  });
}

export async function getAdminVenues(token: string, status?: string) {
  const query = status ? `?status=${status}` : "";
  return requestApi<AdminVenue[]>(`/admin/venues${query}`, { token });
}

export async function approveVenue(token: string, venueId: string) {
  return requestApi(`/admin/venues/${venueId}/approve`, {
    token,
    method: "PATCH",
  });
}

export async function rejectVenue(token: string, venueId: string) {
  return requestApi(`/admin/venues/${venueId}/reject`, {
    token,
    method: "PATCH",
  });
}

export async function getAdminBookings(token: string, page = 1, limit = 20) {
  return requestApi<PaginatedResponse<AdminBooking>>(`/admin/bookings?page=${page}&limit=${limit}`, { token });
}

export async function deleteVenue(token: string, venueId: string) {
  return requestApi(`/venues/${venueId}`, {
    token,
    method: "DELETE",
  });
}
