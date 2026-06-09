"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  RefreshCcw,
  RotateCcw,
  Ticket,
  XCircle,
} from "lucide-react";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { BookingFilterTabs } from "@/components/owner/booking-filter-tabs";
import { StatsCard } from "@/components/owner/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import type { OwnerBooking, OwnerBookingStatusFilter } from "@/lib/owner-api";
import {
  cancelMockBooking,
  confirmMockBooking,
  getMockOwnerBookings,
  getMockOwnerStats,
} from "@/lib/mock-owner-bookings";
import { formatCurrency } from "@/lib/utils";

export function OwnerBookingsMockClient() {
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [filter, setFilter] = useState<OwnerBookingStatusFilter>("ALL");
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, totalRevenue: 0 });

  const refresh = useCallback(() => {
    setBookings(getMockOwnerBookings(filter));
    setStats(getMockOwnerStats());
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleConfirm(bookingId: string) {
    setActionBookingId(bookingId);
    try {
      confirmMockBooking(bookingId);
      toast({
        title: "Đã xác nhận",
        description: "Booking đã chuyển sang trạng thái CONFIRMED.",
      });
      refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể xác nhận booking này.",
      });
    } finally {
      setActionBookingId(null);
    }
  }

  function handleReject(bookingId: string) {
    if (!window.confirm("Bạn có chắc muốn từ chối booking này?")) return;
    setActionBookingId(bookingId);
    try {
      cancelMockBooking(bookingId);
      toast({
        title: "Đã từ chối",
        description: "Booking đã bị từ chối và chuyển sang CANCELLED.",
      });
      refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể từ chối booking này.",
      });
    } finally {
      setActionBookingId(null);
    }
  }

  function handleCancel(bookingId: string) {
    if (!window.confirm("Bạn có chắc muốn huỷ booking đã xác nhận này?")) return;
    setActionBookingId(bookingId);
    try {
      cancelMockBooking(bookingId);
      toast({
        title: "Đã huỷ",
        description: "Booking đã xác nhận đã bị huỷ.",
      });
      refresh();
    } catch {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể huỷ booking này.",
      });
    } finally {
      setActionBookingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatsCard
          title="Tổng booking"
          value={stats.total}
          description="Tất cả booking thuộc sân của bạn."
          icon={Ticket}
          iconClassName="bg-slate-100 text-slate-700"
        />
        <StatsCard
          title="Chờ xác nhận"
          value={stats.pending}
          description="Booking PENDING cần xử lý ngay."
          icon={Clock3}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatsCard
          title="Đã xác nhận"
          value={stats.confirmed}
          description="Booking đã được chủ sân duyệt."
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatsCard
          title="Hoàn thành"
          value={stats.completed}
          description="Lượt đá đã hoàn thành."
          icon={CalendarDays}
          iconClassName="bg-sky-50 text-sky-700"
        />
        <StatsCard
          title="Đã huỷ"
          value={stats.cancelled}
          description="Booking bị huỷ hoặc từ chối."
          icon={XCircle}
          iconClassName="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Revenue Banner */}
      {stats.totalRevenue > 0 && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Tổng doanh thu (Confirmed + Completed)
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">
                {formatCurrency(stats.totalRevenue)}
              </div>
            </div>
            <Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              Mock Data
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Filter + Refresh */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <BookingFilterTabs value={filter} onValueChange={setFilter} />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refresh()}
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Làm mới
        </Button>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
          <CardContent className="px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Ticket className="h-6 w-6" />
            </div>
            <p className="text-base font-medium text-slate-950">
              Chưa có booking nào khớp bộ lọc hiện tại
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Thử chọn &ldquo;Tất cả&rdquo; để xem toàn bộ booking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const isPendingAction = actionBookingId === booking.id;

            return (
              <Card
                key={booking.id}
                className={`overflow-hidden border-white/70 transition-all duration-200 ${
                  booking.status === "PENDING"
                    ? "border-l-4 border-l-amber-400 bg-gradient-to-r from-amber-50/50 to-white/92"
                    : "bg-white/92"
                } shadow-[0_12px_40px_rgba(16,34,22,0.06)] hover:shadow-[0_18px_60px_rgba(16,34,22,0.1)]`}
              >
                <CardContent className="p-0">
                  <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                    {/* Left: Booking Info */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-950">
                          {booking.customerName}
                        </h3>
                        <BookingStatusBadge status={booking.status} />
                        {booking.status === "PENDING" && (
                          <Badge className="animate-pulse bg-amber-50 text-amber-800 hover:bg-amber-50">
                            <Activity className="mr-1 h-3.5 w-3.5" />
                            Cần xử lý
                          </Badge>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {booking.venueName} &bull; {booking.fieldName}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-emerald-700" />
                          {booking.bookingDate} &middot; {booking.bookingTime}
                        </span>
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-700" />
                          {booking.venueAddress}
                        </span>
                        {booking.customerPhone && (
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-emerald-700" />
                            {booking.customerPhone}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-xs text-slate-400">
                        Email: {booking.customerEmail} &middot; ID: {booking.id}
                      </p>
                    </div>

                    {/* Right: Price + Actions */}
                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <div className="text-xl font-bold text-slate-950">
                        {formatCurrency(booking.totalPrice)}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {booking.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={isPendingAction}
                              onClick={() => handleConfirm(booking.id)}
                            >
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              Xác nhận
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="bg-red-50 text-red-700 hover:bg-red-100"
                              disabled={isPendingAction}
                              onClick={() => handleReject(booking.id)}
                            >
                              <XCircle className="mr-1.5 h-4 w-4" />
                              Từ chối
                            </Button>
                          </>
                        )}

                        {booking.status === "CONFIRMED" && booking.canOwnerCancel && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={isPendingAction}
                            onClick={() => handleCancel(booking.id)}
                          >
                            <RotateCcw className="mr-1.5 h-4 w-4" />
                            Huỷ booking
                          </Button>
                        )}

                        {booking.status === "CONFIRMED" && !booking.canOwnerCancel && (
                          <span className="text-xs text-slate-500">
                            Còn dưới 24h — không thể huỷ
                          </span>
                        )}

                        {booking.status !== "PENDING" && booking.status !== "CONFIRMED" && (
                          <span className="text-xs text-slate-500">
                            Không có thao tác
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
