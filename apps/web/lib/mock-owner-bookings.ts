/**
 * Mock data layer for Owner Bookings management.
 *
 * In the real backend, these operations map to:
 *   GET    /bookings         → getOwnerBookings
 *   PATCH  /bookings/:id/confirm → confirmOwnerBooking
 *   PATCH  /bookings/:id/cancel  → cancelOwnerBooking
 *
 * This mock version reads and writes to localStorage so
 * the owner can manage bookings created by the player mock flow
 * without needing the NestJS API to be running.
 */

import type { BookingStatus } from "@dat-san-vn/types";
import type { OwnerBooking, OwnerBookingStatusFilter } from "@/lib/owner-api";
import type { PlayerBooking } from "@/lib/player-booking-api";
import { venueDetails } from "@/lib/mock-data";
import { safeJsonParse } from "@/lib/utils";

const MOCK_STORAGE_KEY = "mock_bookings";
const OWNER_SEED_KEY = "mock_owner_seeded";

/**
 * Pre-seeded bookings that simulate other players having booked
 * the owner's venues. These appear alongside any bookings the
 * current tester creates via the player flow.
 */
const seededOwnerBookings: OwnerBooking[] = [
  {
    id: "OWN-BK-001",
    status: "PENDING",
    customerName: "Phúc Nguyễn",
    customerEmail: "phuc.nguyen@example.com",
    customerPhone: "0901 234 567",
    venueId: "greenfield-stadium",
    venueName: "Greenfield Stadium",
    venueAddress: "61 Đường số 9, Bình Thạnh",
    fieldId: "gf-field-1",
    fieldName: "Sân 7 Prime",
    sportType: "FOOTBALL",
    size: "FIELD_7",
    bookingDate: "03/05/2026",
    bookingTime: "18:30 - 20:00",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    totalPrice: 710000,
    startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    canOwnerCancel: false,
  },
  {
    id: "OWN-BK-002",
    status: "PENDING",
    customerName: "Minh Hoàng",
    customerEmail: "minh.hoang@example.com",
    customerPhone: "0938 888 999",
    venueId: "riverside-arena",
    venueName: "Riverside Arena",
    venueAddress: "12 Bến Vân Đồn, Quận 4",
    fieldId: "rs-field-1",
    fieldName: "Sân 7A",
    sportType: "FOOTBALL",
    size: "FIELD_7",
    bookingDate: "04/05/2026",
    bookingTime: "19:30 - 21:00",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    totalPrice: 680000,
    startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    canOwnerCancel: false,
  },
  {
    id: "OWN-BK-003",
    status: "CONFIRMED",
    customerName: "Linh Trần",
    customerEmail: "linh.tran@example.com",
    customerPhone: "0977 112 889",
    venueId: "city-goal-hub",
    venueName: "City Goal Hub",
    venueAddress: "88 Nguyễn Thị Minh Khai, Quận 3",
    fieldId: "cg-field-1",
    fieldName: "Sân 5 Premium",
    sportType: "FOOTBALL",
    size: "FIELD_5",
    bookingDate: "02/05/2026",
    bookingTime: "17:30 - 19:00",
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    totalPrice: 390000,
    startsAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    canOwnerCancel: true,
  },
  {
    id: "OWN-BK-004",
    status: "COMPLETED",
    customerName: "Đức Anh",
    customerEmail: "ducanh@example.com",
    customerPhone: null,
    venueId: "greenfield-stadium",
    venueName: "Greenfield Stadium",
    venueAddress: "61 Đường số 9, Bình Thạnh",
    fieldId: "gf-field-2",
    fieldName: "Sân 5 Quickplay",
    sportType: "FOOTBALL",
    size: "FIELD_5",
    bookingDate: "28/04/2026",
    bookingTime: "06:00 - 07:30",
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    totalPrice: 450000,
    startsAt: null,
    canOwnerCancel: false,
  },
  {
    id: "OWN-BK-005",
    status: "CANCELLED",
    customerName: "Quốc Bảo",
    customerEmail: "quocbao@example.com",
    customerPhone: "0903 900 115",
    venueId: "saigon-night-arena",
    venueName: "Saigon Night Arena",
    venueAddress: "177 Lê Văn Thọ, Gò Vấp",
    fieldId: "sn-field-1",
    fieldName: "Sân 5 Night Shift",
    sportType: "FOOTBALL",
    size: "FIELD_5",
    bookingDate: "29/04/2026",
    bookingTime: "21:00 - 22:30",
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    totalPrice: 350000,
    startsAt: null,
    canOwnerCancel: false,
  },
];

function convertPlayerToOwnerBooking(pb: PlayerBooking): OwnerBooking {
  const venue = venueDetails.find((v) => v.id === pb.venueId);

  return {
    id: pb.id,
    status: pb.status,
    customerName: "Người chơi (Bạn)",
    customerEmail: "player@test.local",
    customerPhone: null,
    venueId: pb.venueId,
    venueName: pb.venueName,
    venueAddress: pb.venueAddress || venue?.address || "Không rõ địa chỉ",
    fieldId: null,
    fieldName: pb.fieldName,
    sportType: "FOOTBALL",
    size: null,
    bookingDate: pb.bookingDate,
    bookingTime: pb.bookingTime,
    createdAt: new Date().toISOString(),
    totalPrice: pb.totalPrice,
    startsAt: pb.startsAt,
    canOwnerCancel:
      pb.status === "CONFIRMED" && pb.startsAt
        ? new Date(pb.startsAt).getTime() - Date.now() > 24 * 60 * 60 * 1000
        : false,
  };
}

function loadOwnerBookingsFromStorage(): OwnerBooking[] {
  try {
    const raw = localStorage.getItem("mock_owner_bookings");
    if (raw) {
      return safeJsonParse(raw, []) as OwnerBooking[];
    }
  } catch {
    // Ignore parse errors.
  }

  return [];
}

function saveOwnerBookingsToStorage(bookings: OwnerBooking[]) {
  localStorage.setItem("mock_owner_bookings", JSON.stringify(bookings));
}

function ensureSeeded(): void {
  if (localStorage.getItem(OWNER_SEED_KEY)) return;

  const existing = loadOwnerBookingsFromStorage();
  const seededIds = new Set(existing.map((b) => b.id));
  const toAdd = seededOwnerBookings.filter((b) => !seededIds.has(b.id));

  saveOwnerBookingsToStorage([...toAdd, ...existing]);
  localStorage.setItem(OWNER_SEED_KEY, "1");
}

/**
 * Merge owner-specific bookings with any bookings created by
 * the player mock flow (stored under `mock_bookings`).
 */
export function getMockOwnerBookings(
  filter: OwnerBookingStatusFilter = "ALL",
): OwnerBooking[] {
  ensureSeeded();

  const ownerBookings = loadOwnerBookingsFromStorage();

  // Also pull in player-created bookings
  let playerBookings: OwnerBooking[] = [];
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      const playerItems: PlayerBooking[] = safeJsonParse(raw, []);
      playerBookings = playerItems.map(convertPlayerToOwnerBooking);
    }
  } catch {
    // Ignore.
  }

  // Merge, avoiding duplicates (owner store takes priority)
  const ownerIds = new Set(ownerBookings.map((b) => b.id));
  const merged = [
    ...ownerBookings,
    ...playerBookings.filter((pb) => !ownerIds.has(pb.id)),
  ];

  // Apply status filter
  const filtered =
    filter === "ALL"
      ? merged
      : merged.filter((b) => b.status === filter);

  // Sort: PENDING first, then by createdAt descending
  return filtered.sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1;
    if (a.status !== "PENDING" && b.status === "PENDING") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Simulate owner confirming a PENDING booking.
 */
export function confirmMockBooking(bookingId: string): void {
  updateBookingStatus(bookingId, "CONFIRMED");
}

/**
 * Simulate owner rejecting/cancelling a booking.
 */
export function cancelMockBooking(bookingId: string): void {
  updateBookingStatus(bookingId, "CANCELLED");
}

function updateBookingStatus(bookingId: string, nextStatus: BookingStatus): void {
  // First, update in owner bookings store
  const ownerBookings = loadOwnerBookingsFromStorage();
  const ownerIdx = ownerBookings.findIndex((b) => b.id === bookingId);

  if (ownerIdx >= 0) {
    ownerBookings[ownerIdx] = {
      ...ownerBookings[ownerIdx],
      status: nextStatus,
      canOwnerCancel: nextStatus === "CONFIRMED"
        ? (ownerBookings[ownerIdx].startsAt
            ? new Date(ownerBookings[ownerIdx].startsAt!).getTime() - Date.now() > 24 * 60 * 60 * 1000
            : false)
        : false,
    };
    saveOwnerBookingsToStorage(ownerBookings);
  }

  // Also update in player bookings store (so the player sees the change)
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      const playerBookings: PlayerBooking[] = safeJsonParse(raw, []);
      const playerIdx = playerBookings.findIndex((b) => b.id === bookingId);

      if (playerIdx >= 0) {
        playerBookings[playerIdx] = {
          ...playerBookings[playerIdx],
          status: nextStatus,
          canCancel: nextStatus === "PENDING" || nextStatus === "CONFIRMED",
        };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(playerBookings));

        // If not already in owner store, also persist there
        if (ownerIdx < 0) {
          const asOwner = convertPlayerToOwnerBooking(playerBookings[playerIdx]);
          saveOwnerBookingsToStorage([asOwner, ...ownerBookings]);
        }
      }
    }
  } catch {
    // Ignore.
  }
}

export function getMockOwnerStats() {
  const all = getMockOwnerBookings("ALL");
  const pending = all.filter((b) => b.status === "PENDING").length;
  const confirmed = all.filter((b) => b.status === "CONFIRMED").length;
  const completed = all.filter((b) => b.status === "COMPLETED").length;
  const cancelled = all.filter((b) => b.status === "CANCELLED").length;
  const totalRevenue = all
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + b.totalPrice, 0);

  return { total: all.length, pending, confirmed, completed, cancelled, totalRevenue };
}
