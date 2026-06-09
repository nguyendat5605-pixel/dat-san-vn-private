"use client";

import { useEffect, useState } from "react";
import { Activity, Building2, CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { StatsCard } from "@/components/owner/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OwnerBooking } from "@/lib/owner-api";
import { getMockOwnerBookings, getMockOwnerStats } from "@/lib/mock-owner-bookings";
import { venueDetails } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export function OwnerDashboardMockClient() {
  const [recentBookings, setRecentBookings] = useState<OwnerBooking[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const all = getMockOwnerBookings("ALL");
    setRecentBookings(all.slice(0, 5));
    setStats(getMockOwnerStats());
  }, []);

  const activeVenueCount = venueDetails.filter((v) => v.isActive).length;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Tổng booking"
          value={stats.total}
          description="Tất cả booking mock trong hệ thống."
          icon={CalendarDays}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <StatsCard
          title="Đang chờ xác nhận"
          value={stats.pending}
          description="Booking PENDING cần owner xử lý."
          icon={Clock3}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <StatsCard
          title="Sân trong hệ thống"
          value={activeVenueCount}
          description="Venue đang hiển thị trên DatSanVN."
          icon={Building2}
          iconClassName="bg-sky-50 text-sky-700"
        />
      </div>

      <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
        <CardContent className="p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  Recent Bookings
                </div>
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] px-1.5 py-0">
                  Mock
                </Badge>
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {recentBookings.length > 0
                  ? `${recentBookings.length} booking mới nhất`
                  : "Chưa có booking nào"}
              </h2>
            </div>
            <Button asChild variant="secondary">
              <Link href="/owner/bookings">Mở trang Bookings</Link>
            </Button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
              Chưa có booking nào. Hãy thử đặt sân ở trang người chơi trước!
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className={`flex flex-col gap-4 rounded-[28px] border p-5 lg:flex-row lg:items-center lg:justify-between ${
                    booking.status === "PENDING"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {booking.customerName}
                      </h3>
                      <BookingStatusBadge status={booking.status} />
                      {booking.status === "PENDING" && (
                        <Badge className="animate-pulse bg-amber-50 text-amber-800 hover:bg-amber-50">
                          <Activity className="mr-1 h-3.5 w-3.5" />
                          Ưu tiên xử lý
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {booking.venueName} &bull; {booking.fieldName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {booking.bookingDate} &bull; {booking.bookingTime}
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <div className="text-lg font-semibold text-slate-950">
                      {formatCurrency(booking.totalPrice)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {booking.customerEmail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
