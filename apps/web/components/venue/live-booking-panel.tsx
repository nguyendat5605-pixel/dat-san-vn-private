"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingSheet } from "@/components/booking/booking-sheet";
import {
  getRealtimeSocket,
  joinFieldRoom,
  joinVenueRoom,
  type SlotRealtimeEvent,
} from "@/lib/realtime-client";
import type { NextAvailableSlot } from "@/lib/api";
import { formatTimeRange, toNumber } from "@/lib/utils";

type AvailableSlot = {
  id: string;
  startTime: string;
  endTime: string;
  pricePerSlot: number | string;
};

function getSlotLabel(slot?: AvailableSlot) {
  if (!slot) return "Chưa có slot khả dụng";
  return formatTimeRange(slot.startTime, slot.endTime);
}

export function LiveBookingPanel({
  venueId,
  venueName,
  fieldId,
  fieldName,
  bookingDate,
  pricePerSlot,
  initialSlots,
  nextAvailableSlot,
  venueAddress,
  venueImage,
}: Readonly<{
  venueId: string;
  venueName: string;
  fieldId: string;
  fieldName: string;
  bookingDate: string;
  pricePerSlot: number;
  initialSlots: AvailableSlot[];
  nextAvailableSlot?: NextAvailableSlot | null;
  venueAddress?: string;
  venueImage?: string | null;
}>) {
  const router = useRouter();
  const [slots, setSlots] = useState(initialSlots);
  const firstSlot = useMemo(() => slots[0], [slots]);
  const bookingPrice = toNumber(firstSlot?.pricePerSlot ?? pricePerSlot);

  useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  useEffect(() => {
    if (!venueId || !fieldId) return;

    joinVenueRoom(venueId);
    joinFieldRoom(fieldId);

    const socket = getRealtimeSocket();
    const removeSlot = (event: SlotRealtimeEvent) => {
      if (event.fieldId !== fieldId) return;
      setSlots((current) =>
        current.filter((slot) => slot.id !== event.slotId),
      );
    };
    const refreshReleasedSlot = (event: SlotRealtimeEvent) => {
      if (event.fieldId !== fieldId) return;
      router.refresh();
    };

    socket.on("slot.locked", removeSlot);
    socket.on("slot.booked", removeSlot);
    socket.on("slot.released", refreshReleasedSlot);

    return () => {
      socket.off("slot.locked", removeSlot);
      socket.off("slot.booked", removeSlot);
      socket.off("slot.released", refreshReleasedSlot);
    };
  }, [fieldId, router, venueId]);

  return (
    <BookingSheet
      venueName={venueName}
      fieldId={fieldId}
      fieldName={fieldName}
      timeSlotId={firstSlot?.id}
      bookingDate={bookingDate}
      firstSlot={getSlotLabel(firstSlot)}
      pricePerSlot={bookingPrice}
      availableSlots={slots}
      nextAvailableSlot={nextAvailableSlot}
      venueAddress={venueAddress}
      venueImage={venueImage}
    />
  );
}
