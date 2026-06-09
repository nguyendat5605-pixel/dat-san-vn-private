import { auth } from "@clerk/nextjs/server";
import { Activity, Building2, CalendarDays, Clock3 } from "lucide-react";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { SectionHeading } from "@/components/common/section-heading";
import { OwnerDashboardMockClient } from "@/components/owner/owner-dashboard-mock-client";
import { StatsCard } from "@/components/owner/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOwnerBookings, getOwnerVenues } from "@/lib/owner-api";
import { formatCurrency } from "@/lib/utils";

function prioritizeRecentBookings<T extends { status: string; createdAt: string }>(bookings: T[]) {
  return [...bookings].sort((left, right) => {
    if (left.status === "PENDING" && right.status !== "PENDING") return -1;
    if (left.status !== "PENDING" && right.status === "PENDING") return 1;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export default async function OwnerDashboardPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  // Try real API, fallback to mock mode
  let useMock = false;

  try {
    const [todayBookings, allBookings, venues] = await Promise.all([
      getOwnerBookings(token, { date: "today" }),
      getOwnerBookings(token),
      getOwnerVenues(token),
    ]);

    // If API returns data, show the real dashboard
    if (allBookings.length > 0 || venues.length > 0) {
      const pendingCount = allBookings.filter((booking) => booking.status === "PENDING").length;
      const activeVenueCount = venues.filter((venue) => venue.isActive).length;
      const recentBookings = prioritizeRecentBookings(allBookings).slice(0, 5);

      return (
        <div className="space-y-8">
          <SectionHeading
            eyebrow="Owner Dashboard"
            title="Toàn cảnh vận hành sân của bạn"
            description="Theo dõi booking trong ngày, các yêu cầu đang chờ xử lý và truy cập nhanh sang khu vực quản lý sân."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <StatsCard
              title="Booking hôm nay"
              value={todayBookings.length}
              description="Tổng số booking bắt đầu trong hôm nay."
              icon={CalendarDays}
              iconClassName="bg-emerald-50 text-emerald-700"
            />
            <StatsCard
              title="Đang chờ xác nhận"
              value={pendingCount}
              description="Những booking PENDING cần owner phản hồi."
              icon={Clock3}
              iconClassName="bg-amber-50 text-amber-700"
            />
            <StatsCard
              title="Sân đang active"
              value={activeVenueCount}
              description="Venue đã được duyệt và đang mở nhận booking."
              icon={Building2}
              iconClassName="bg-sky-50 text-sky-700"
            />
          </div>

          <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
            <CardContent className="p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Recent Bookings</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">5 booking mới nhất</h2>
                </div>
                <Button asChild variant="secondary">
                  <Link href="/owner/bookings">Mở trang Bookings</Link>
                </Button>
              </div>

              {recentBookings.length === 0 ? (
                <div className="mt-8 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                  Chưa có booking nào thuộc sân của bạn.
                </div>
              ) : (
                <div className="mt-6 grid gap-4">
                  {recentBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-slate-950">{booking.customerName}</h3>
                          <BookingStatusBadge status={booking.status} />
                          {booking.status === "PENDING" ? (
                            <Badge className="bg-amber-50 text-amber-800 hover:bg-amber-50">
                              <Activity className="mr-1 h-3.5 w-3.5" />
                              Ưu tiên xử lý
                            </Badge>
                          ) : null}
                          {booking.isManualMomoPending ? (
                            <Badge
                              variant="outline"
                              className="border-pink-200 bg-pink-50 text-pink-700"
                            >
                              Chờ xác nhận MoMo
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {booking.venueName} • {booking.fieldName}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {booking.bookingDate} • {booking.bookingTime}
                        </p>
                      </div>

                      <div className="text-left lg:text-right">
                        <div className="text-lg font-semibold text-slate-950">{formatCurrency(booking.totalPrice)}</div>
                        <div className="mt-1 text-sm text-slate-500">{booking.customerEmail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    // API returned empty data — fallback to mock
    useMock = true;
  } catch {
    // Backend unreachable — use mock mode
    useMock = true;
  }

  if (useMock) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Owner Dashboard"
          title="Toàn cảnh vận hành sân của bạn"
          description="Đang hiển thị dữ liệu mẫu. Theo dõi booking, xác nhận và quản lý sân ngay trên trang Bookings."
        />
        <OwnerDashboardMockClient />
      </div>
    );
  }

  return null;
}
