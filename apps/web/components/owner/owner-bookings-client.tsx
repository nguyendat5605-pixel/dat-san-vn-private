"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "@/hooks/use-toast";
import {
  cancelOwnerBooking,
  confirmManualMomoPayment,
  confirmOwnerBooking,
  getCurrentUserProfile,
  getOwnerBookings,
  type OwnerBooking,
  type OwnerBookingStatusFilter,
} from "@/lib/owner-api";
import { getRealtimeSocket, joinOwnerRoom } from "@/lib/realtime-client";
import { BookingFilterTabs } from "@/components/owner/booking-filter-tabs";
import { BookingTable } from "@/components/owner/booking-table";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

export function OwnerBookingsClient({
  initialBookings,
}: Readonly<{
  initialBookings: OwnerBooking[];
}>) {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState(initialBookings);
  const [filter, setFilter] = useState<OwnerBookingStatusFilter>("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);

  async function refreshBookings(
    nextFilter: OwnerBookingStatusFilter,
    silent = false,
  ) {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description:
          "Không thể tải danh sách booking khi chưa có access token.",
      });
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }

    try {
      const nextBookings = await getOwnerBookings(token, {
        status: nextFilter,
      });
      setBookings(nextBookings);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Tải booking thất bại",
        description:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách booking.",
      });
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshBookings(filter);

    const interval = window.setInterval(() => {
      void refreshBookings(filter, true);
    }, 15_000);

    let cancelled = false;
    const socket = getRealtimeSocket();
    const refreshSilently = (payload: unknown) => {
      console.log("[OwnerBookingsRealtime] event", payload);
      void refreshBookings(filter, true);
    };

    socket.on("booking.created", refreshSilently);
    socket.on("payment.paid", refreshSilently);
    socket.on("booking.confirmed", refreshSilently);
    socket.on("booking.cancelled", refreshSilently);
    socket.on("slot.booked", refreshSilently);
    socket.on("slot.released", refreshSilently);

    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      try {
        const profile = await getCurrentUserProfile(token);
        if (!cancelled && profile?.id) {
          joinOwnerRoom(profile.id);
        }
      } catch {
        // Keep REST polling as the fallback when profile lookup is unavailable.
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      socket.off("booking.created", refreshSilently);
      socket.off("payment.paid", refreshSilently);
      socket.off("booking.confirmed", refreshSilently);
      socket.off("booking.cancelled", refreshSilently);
      socket.off("slot.booked", refreshSilently);
      socket.off("slot.released", refreshSilently);
    };
  }, [filter, getToken]);

  async function runBookingAction(
    bookingId: string,
    action: (token: string, targetBookingId: string) => Promise<unknown>,
    successMessage: string,
  ) {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để thực hiện thao tác này.",
      });
      return;
    }

    setActionBookingId(bookingId);

    try {
      await action(token, bookingId);
      toast({
        title: "Cập nhật thành công",
        description: successMessage,
      });
      await refreshBookings(filter, true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Thao tác thất bại",
        description:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật booking.",
      });
    } finally {
      setActionBookingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <BookingFilterTabs value={filter} onValueChange={setFilter} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Danh sách tự làm mới mỗi 15 giây để chủ sân không bỏ sót booking
            mới.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => refreshBookings(filter)}
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </div>

      <BookingTable
        bookings={bookings}
        isLoading={isLoading}
        actionBookingId={actionBookingId}
        onConfirm={(bookingId) =>
          runBookingAction(
            bookingId,
            confirmOwnerBooking,
            "Booking đã được xác nhận và danh sách đã làm mới.",
          )
        }
        onConfirmManualPayment={(bookingId) =>
          runBookingAction(
            bookingId,
            confirmManualMomoPayment,
            "Đã xác nhận thanh toán MoMo và booking đã được xác nhận.",
          )
        }
        onReject={(bookingId) =>
          runBookingAction(
            bookingId,
            cancelOwnerBooking,
            "Booking đã bị từ chối.",
          )
        }
        onCancel={(bookingId) =>
          runBookingAction(
            bookingId,
            cancelOwnerBooking,
            "Booking đã được huỷ.",
          )
        }
      />
    </div>
  );
}
