"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  CalendarDays,
  MapPin,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { PaymentCountdown } from "@/components/booking/payment-countdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  cancelPlayerBooking,
  getPlayerBookings,
  type PlayerBooking,
} from "@/lib/player-booking-api";
import { formatCurrency, safeJsonParse } from "@/lib/utils";

export function PlayerBookingsClient({
  initialBookings,
}: Readonly<{
  initialBookings: PlayerBooking[];
}>) {
  const { getToken } = useAuth();
  const [bookings, setBookings] = useState(initialBookings);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const mockStr = localStorage.getItem("mock_bookings");
      if (mockStr) {
        const mockBookings: PlayerBooking[] = safeJsonParse(mockStr, []);
        setBookings((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const newMocks = mockBookings.filter((mb) => !existingIds.has(mb.id));
          return [...newMocks, ...prev];
        });
      }
    } catch {}
  }, []);

  async function refreshBookings(silent = false) {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để xem lịch sử booking.",
      });
      return;
    }

    if (!silent) setIsRefreshing(true);

    try {
      const realBookings = await getPlayerBookings(token);
      let nextBookings = realBookings;
      try {
        const mockStr = localStorage.getItem("mock_bookings");
        if (mockStr) {
          const mockBookings: PlayerBooking[] = safeJsonParse(mockStr, []);
          const existingIds = new Set(realBookings.map((b) => b.id));
          const newMocks = mockBookings.filter((mb) => !existingIds.has(mb.id));
          nextBookings = [...newMocks, ...realBookings];
        }
      } catch {}
      setBookings(nextBookings);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Tải booking thất bại",
        description:
          error instanceof Error
            ? error.message
            : "Không thể tải lịch sử booking.",
      });
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }

  async function handleCancel(booking: PlayerBooking) {
    const reason = window.prompt(
      `Xác nhận hủy booking này? Chính sách hiện tại: hoàn ${booking.refundPercent}%. Nhập lý do nếu cần.`,
      "",
    );

    if (reason === null) return;

    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để hủy booking.",
      });
      return;
    }

    setActionBookingId(booking.id);

    try {
      await cancelPlayerBooking(token, booking.id, reason);

      if (booking.id.startsWith("MOCK-") || booking.id.startsWith("BK-")) {
        try {
          const mockStr = localStorage.getItem("mock_bookings");
          if (mockStr) {
            const mockBookings: PlayerBooking[] = safeJsonParse(mockStr, []);
            const updated = mockBookings.map((b) =>
              b.id === booking.id
                ? {
                    ...b,
                    status: "CANCELLED" as const,
                    canCancel: false,
                    refundAmount: b.totalPrice * (b.refundPercent / 100),
                  }
                : b,
            );
            localStorage.setItem("mock_bookings", JSON.stringify(updated));
          }
        } catch {}
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id
              ? {
                  ...b,
                  status: "CANCELLED" as const,
                  canCancel: false,
                  refundAmount: b.totalPrice * (b.refundPercent / 100),
                }
              : b,
          ),
        );
      } else {
        await refreshBookings(true);
      }

      toast({
        title: "Hủy booking thành công",
        description: `Chính sách hoàn tiền áp dụng: ${booking.refundPercent}%.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Hủy booking thất bại",
        description:
          error instanceof Error ? error.message : "Không thể hủy booking này.",
      });
    } finally {
      setActionBookingId(null);
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center">
        <p className="text-base font-medium text-slate-950">
          Chưa có booking nào
        </p>
        <Button asChild className="mt-5 w-full sm:w-auto">
          <Link href="/search">Tìm sân để đặt</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Hoàn 100% trước 12 giờ, 50% trước 6 giờ, 0% trong 6 giờ cuối.
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 w-full sm:w-auto"
          onClick={() => refreshBookings()}
          disabled={isRefreshing}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id} className="border-white/70">
            <CardContent className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold text-slate-950">
                    {booking.venueName}
                  </h3>
                  <BookingStatusBadge status={booking.status} />
                  {booking.status === "PENDING" && booking.expiresAt && (
                    <PaymentCountdown
                      expiresAt={booking.expiresAt}
                      onExpired={() => refreshBookings(true)}
                    />
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {booking.fieldName}
                </p>
                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:flex sm:flex-wrap sm:gap-4">
                  <span className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    {booking.bookingDate} · {booking.bookingTime}
                  </span>
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    {booking.venueAddress}
                  </span>
                </div>
                {booking.status === "CANCELLED" && booking.refundAmount > 0 ? (
                  <p className="mt-4 text-sm font-medium text-emerald-700">
                    Đã hoàn {formatCurrency(booking.refundAmount)}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-stretch gap-3 sm:items-start lg:items-end">
                <div className="text-xl font-semibold text-slate-950">
                  {formatCurrency(booking.totalPrice)}
                </div>
                {booking.canCancel ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full bg-rose-600 text-white ring-0 hover:bg-rose-700 sm:w-auto"
                    onClick={() => handleCancel(booking)}
                    disabled={actionBookingId === booking.id}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Hủy booking
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    <Link href={`/venues/${booking.venueId}`}>Xem lại sân</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
