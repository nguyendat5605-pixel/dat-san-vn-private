"use client";

import type { OwnerBooking } from "@/lib/owner-api";
import { BookingStatusBadge } from "@/components/booking/booking-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

export function BookingTable({
  bookings,
  isLoading,
  actionBookingId,
  onConfirm,
  onConfirmManualPayment,
  onReject,
  onCancel,
}: Readonly<{
  bookings: OwnerBooking[];
  isLoading?: boolean;
  actionBookingId?: string | null;
  onConfirm: (bookingId: string) => void | Promise<void>;
  onConfirmManualPayment: (bookingId: string) => void | Promise<void>;
  onReject: (bookingId: string) => void | Promise<void>;
  onCancel: (bookingId: string) => void | Promise<void>;
}>) {
  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
      <CardContent className="p-0">
        <div className="md:hidden">
          {bookings.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {isLoading
                ? "Đang tải danh sách booking..."
                : "Chưa có booking nào khớp bộ lọc hiện tại."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookings.map((booking) => {
                const isPendingAction = actionBookingId === booking.id;
                return (
                  <div key={booking.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-medium text-slate-950">
                          {booking.customerName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {booking.customerPhone || booking.customerEmail}
                        </div>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="font-medium text-slate-950">
                        {booking.venueName}
                      </div>
                      <div className="text-slate-500">{booking.fieldName}</div>
                      <div className="mt-2 text-slate-700">
                        {booking.bookingDate} • {booking.bookingTime}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-slate-500">Tổng tiền</div>
                      <div className="font-medium text-emerald-700">
                        {formatCurrency(booking.totalPrice)}
                      </div>
                    </div>

                    {booking.isManualMomoPending && (
                      <Badge
                        variant="outline"
                        className="border-pink-200 bg-pink-50 text-pink-700 w-fit"
                      >
                        Chờ xác nhận MoMo
                      </Badge>
                    )}

                    <div className="pt-2 flex flex-wrap gap-2">
                      {booking.status === "PENDING" ? (
                        <>
                          {booking.isManualMomoPending ? (
                            <Button
                              size="sm"
                              className="w-full sm:w-auto"
                              disabled={isPendingAction}
                              onClick={() => onConfirmManualPayment(booking.id)}
                            >
                              Xác nhận đã nhận tiền
                            </Button>
                          ) : (
                            <span className="w-full rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 sm:w-auto">
                              Chờ khách thanh toán
                            </span>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full sm:w-auto bg-red-50 text-red-700 hover:bg-red-100"
                            disabled={isPendingAction}
                            onClick={() => onReject(booking.id)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : null}

                      {booking.status === "CONFIRMED" &&
                      booking.canOwnerCancel ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50"
                          disabled={isPendingAction}
                          onClick={() => onCancel(booking.id)}
                        >
                          Huỷ
                        </Button>
                      ) : null}

                      {booking.status === "CONFIRMED" &&
                      !booking.canOwnerCancel ? (
                        <span className="text-xs text-slate-500">
                          Còn dưới 24 giờ (Không thể huỷ)
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Người đặt</TableHead>
                <TableHead>Sân</TableHead>
                <TableHead>Khung giờ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-slate-500"
                  >
                    {isLoading
                      ? "Đang tải danh sách booking..."
                      : "Chưa có booking nào khớp bộ lọc hiện tại."}
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => {
                  const isPendingAction = actionBookingId === booking.id;

                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="font-medium text-slate-950">
                          {booking.customerName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {booking.customerEmail}
                        </div>
                        {booking.customerPhone ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {booking.customerPhone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-950">
                          {booking.venueName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {booking.fieldName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-950">
                          {booking.bookingDate}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {booking.bookingTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <BookingStatusBadge status={booking.status} />
                        {booking.isManualMomoPending ? (
                          <Badge
                            variant="outline"
                            className="mt-2 border-pink-200 bg-pink-50 text-pink-700"
                          >
                            Chờ xác nhận MoMo
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-950">
                        {formatCurrency(booking.totalPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {booking.status === "PENDING" ? (
                            <>
                              {booking.isManualMomoPending ? (
                                <Button
                                  size="sm"
                                  disabled={isPendingAction}
                                  onClick={() =>
                                    onConfirmManualPayment(booking.id)
                                  }
                                >
                                  Xác nhận đã nhận tiền
                                </Button>
                              ) : (
                                <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                  Chờ khách thanh toán
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="bg-red-50 text-red-700 hover:bg-red-100"
                                disabled={isPendingAction}
                                onClick={() => onReject(booking.id)}
                              >
                                Từ chối
                              </Button>
                            </>
                          ) : null}

                          {booking.status === "CONFIRMED" &&
                          booking.canOwnerCancel ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              disabled={isPendingAction}
                              onClick={() => onCancel(booking.id)}
                            >
                              Huỷ
                            </Button>
                          ) : null}

                          {booking.status === "CONFIRMED" &&
                          !booking.canOwnerCancel ? (
                            <span className="text-xs text-slate-500">
                              Còn dưới 24 giờ
                            </span>
                          ) : null}

                          {booking.status !== "PENDING" &&
                          booking.status !== "CONFIRMED" ? (
                            <span className="text-xs text-slate-500">
                              Không có thao tác
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
