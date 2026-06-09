"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { getCurrentUserProfile } from "@/lib/owner-api";
import { getRealtimeSocket, joinOwnerRoom } from "@/lib/realtime-client";

type OwnerRealtimeEvent =
  | "booking.created"
  | "payment.paid"
  | "booking.confirmed"
  | "booking.cancelled"
  | "slot.booked"
  | "slot.released";

const OWNER_EVENTS: OwnerRealtimeEvent[] = [
  "booking.created",
  "payment.paid",
  "booking.confirmed",
  "booking.cancelled",
  "slot.booked",
  "slot.released",
];

export function OwnerRealtimeRefresh({
  ownerId,
}: Readonly<{
  ownerId?: string | null;
}>) {
  const router = useRouter();
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;
    console.log("[OwnerRealtime] connecting");

    const socket = getRealtimeSocket();
    const handleConnect = () => {
      console.log("[OwnerRealtime] connected", socket.id);
    };
    const refresh = (eventName: OwnerRealtimeEvent) => (payload: unknown) => {
      console.log(`[OwnerRealtime] ${eventName}`, payload);
      router.refresh();
    };
    const handlers = OWNER_EVENTS.map((eventName) => {
      const handler = refresh(eventName);
      socket.on(eventName, handler);
      return { eventName, handler };
    });

    socket.on("connect", handleConnect);
    if (socket.connected) {
      handleConnect();
    }

    void (async () => {
      let resolvedOwnerId = ownerId ?? null;

      if (!resolvedOwnerId) {
        const token = await getToken();
        if (!token || cancelled) return;

        try {
          const profile = await getCurrentUserProfile(token);
          resolvedOwnerId = profile?.id ?? null;
        } catch {
          return;
        }
      }

      if (!cancelled && resolvedOwnerId) {
        console.log("[OwnerRealtime] joinOwner", resolvedOwnerId);
        joinOwnerRoom(resolvedOwnerId);
      }
    })();

    return () => {
      cancelled = true;
      socket.off("connect", handleConnect);
      for (const { eventName, handler } of handlers) {
        socket.off(eventName, handler);
      }
    };
  }, [getToken, ownerId, router]);

  return null;
}
