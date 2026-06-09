"use client";

import { io, type Socket } from "socket.io-client";
import { getApiOrigin } from "@/lib/api-base-url";

function getRealtimeUrl() {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_REALTIME_URL;
  }

  if (process.env.NEXT_PUBLIC_API_ORIGIN) {
    return `${process.env.NEXT_PUBLIC_API_ORIGIN.replace(/\/+$/, "")}/realtime`;
  }

  return `${getApiOrigin()}/realtime`;
}

export type BookingRealtimeEvent = {
  bookingId: string;
  venueId?: string;
  fieldId?: string | null;
  userId?: string | null;
  ownerIds?: string[];
  status: string;
  totalPrice?: number;
  expiresAt?: string | null;
  updatedAt?: string;
};

export type SlotRealtimeEvent = {
  bookingId?: string;
  venueId?: string;
  fieldId?: string | null;
  userId?: string | null;
  ownerIds?: string[];
  slotId: string;
  status: string;
  updatedAt?: string;
};

export type PaymentRealtimeEvent = {
  bookingId: string;
  paymentId: string;
  attemptId?: string;
  venueId?: string;
  userId?: string | null;
  ownerIds?: string[];
  status: string;
  provider: string;
  paidAt?: string | null;
  updatedAt?: string;
};

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(getRealtimeUrl(), {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: true,
    });
  }

  return socket;
}

export function joinVenueRoom(venueId: string) {
  getRealtimeSocket().emit("joinVenue", { venueId });
}

export function joinFieldRoom(fieldId: string) {
  getRealtimeSocket().emit("joinField", { fieldId });
}

export function joinUserRoom(userId: string) {
  getRealtimeSocket().emit("joinUser", { userId });
}

export function joinOwnerRoom(ownerId: string) {
  getRealtimeSocket().emit("joinOwner", { ownerId });
}
