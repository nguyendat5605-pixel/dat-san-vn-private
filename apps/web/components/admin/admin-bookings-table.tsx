"use client";

import type { AdminBooking } from "@/lib/admin-api";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDateLabel, formatTimeRange, toNumber } from "@/lib/utils";

export function AdminBookingsTable({
  bookings,
}: Readonly<{
  bookings: AdminBooking[];
}>) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
        Chưa có booking nào trong hệ thống.
      </div>
    );
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người đặt</TableHead>
                <TableHead>Sân</TableHead>
                <TableHead>Ngày / Giờ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Giá</TableHead>
                <TableHead>Ngày tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const firstSlot = booking.bookingSlots[0]?.venueSlot;

                return (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">{booking.user.fullName}</div>
                        <div className="text-xs text-slate-400">{booking.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium text-slate-700">{booking.venue.name}</div>
                        {firstSlot?.field ? (
                          <div className="text-xs text-slate-400">{firstSlot.field.name}</div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {firstSlot ? (
                        <div>
                          <div className="text-sm text-slate-700">{formatDateLabel(firstSlot.date)}</div>
                          <div className="text-xs text-slate-400">
                            {formatTimeRange(firstSlot.startTime, firstSlot.endTime)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BookingStatusBadge status={booking.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {formatCurrency(toNumber(booking.totalPrice))}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(booking.createdAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
