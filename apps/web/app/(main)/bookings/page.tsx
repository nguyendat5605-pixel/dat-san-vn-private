import { auth } from "@clerk/nextjs/server";
import { CheckCircle2, Clock3, RotateCcw, Ticket } from "lucide-react";
import Link from "next/link";
import { PlayerBookingsClient } from "@/components/booking/player-bookings-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/common/section-heading";
import { getPlayerBookings } from "@/lib/player-booking-api";

export default async function BookingsPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return (
      <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="My Bookings"
            title="Lịch sử đặt sân"
            description="Đăng nhập để xem booking, hủy sân và theo dõi hoàn tiền."
          />
          <Button asChild className="mt-8 w-full sm:w-auto">
            <Link href="/sign-in">Đăng nhập</Link>
          </Button>
        </div>
      </div>
    );
  }

  const bookings = await getPlayerBookings(token).catch(() => []);
  const confirmedCount = bookings.filter(
    (booking) => booking.status === "CONFIRMED",
  ).length;
  const pendingCount = bookings.filter(
    (booking) => booking.status === "PENDING",
  ).length;
  const cancelledCount = bookings.filter(
    (booking) => booking.status === "CANCELLED",
  ).length;

  return (
    <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="My Bookings"
          title="Lịch sử đặt sân"
          description="Theo dõi booking của bạn, hủy sân khi cần và xem chính sách hoàn tiền trước giờ đá."
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-white/70">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-slate-950">
                {confirmedCount}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Lượt đặt đã xác nhận
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/70">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-slate-950">
                {pendingCount}
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Lượt đặt đang chờ xử lý
              </p>
            </CardContent>
          </Card>
          <Card className="border-white/70">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Ticket className="h-5 w-5" />
              </div>
              <div className="mt-4 text-3xl font-semibold text-slate-950">
                {bookings.length}
              </div>
              <p className="mt-2 text-sm text-slate-600">Tổng lượt booking</p>
            </CardContent>
          </Card>
          <Card className="border-white/70">
            <CardContent className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="text-3xl font-semibold text-slate-950">
                {cancelledCount}
              </div>
              <p className="mt-2 text-sm text-slate-600">Lượt đã hủy</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <PlayerBookingsClient initialBookings={bookings} />
        </div>
      </div>
    </div>
  );
}
