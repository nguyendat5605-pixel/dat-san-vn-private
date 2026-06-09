import Link from "next/link";
import type { BookingItem } from "@/lib/mock-data";
import { CalendarDays, MapPin } from "lucide-react";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export function BookingsList({ bookings }: Readonly<{ bookings: BookingItem[] }>) {
  return (
    <div className="grid gap-4">
      {bookings.map((booking) => (
        <Card key={booking.id} className="border-white/70">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-slate-950">{booking.venueName}</h3>
                <BookingStatusBadge status={booking.status} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{booking.fieldName}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-700" />
                  {booking.bookingDate} · {booking.bookingTime}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-700" />
                  {booking.address}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <div className="text-xl font-semibold text-slate-950">{formatCurrency(booking.totalPrice)}</div>
              <Button asChild variant="secondary">
                <Link href={`/venues/${booking.venueId}`}>Xem lại sân</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
