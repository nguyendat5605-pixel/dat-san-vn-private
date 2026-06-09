"use client";

import { useAuth } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Clock3,
  Copy,
  MapPin,
  QrCode,
  Wallet,
} from "lucide-react";
import type { PaymentProvider } from "@dat-san-vn/types";
import type { NextAvailableSlot } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PaymentCountdown } from "@/components/booking/payment-countdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createPlayerBooking } from "@/lib/player-booking-api";
import {
  createPayment,
  getPaymentStatusByBooking,
  type CreatePaymentResult,
} from "@/lib/player-payment-api";
import { getRealtimeSocket } from "@/lib/realtime-client";
import {
  formatCurrency,
  formatTimeRange,
  getOptionalSafeImageUrl,
  safeJsonParse,
  shouldUnoptimizeImage,
  toNumber,
} from "@/lib/utils";
import { getPaymentHoldExpiresAt } from "@/lib/payment-hold";

type AvailableSlot = {
  id: string;
  startTime: string;
  endTime: string;
  pricePerSlot: number | string;
};

function getSlotLabel(slot: AvailableSlot) {
  return formatTimeRange(slot.startTime, slot.endTime);
}

export function BookingSheet({
  venueName,
  fieldId,
  fieldName,
  timeSlotId,
  bookingDate,
  firstSlot,
  pricePerSlot,
  availableSlots = [],
  nextAvailableSlot = null,
  venueAddress,
  venueImage,
}: Readonly<{
  venueName: string;
  fieldId: string;
  fieldName: string;
  timeSlotId?: string;
  bookingDate: string;
  firstSlot: string;
  pricePerSlot: number;
  availableSlots?: AvailableSlot[];
  nextAvailableSlot?: NextAvailableSlot | null;
  venueAddress?: string;
  venueImage?: string | null;
}>) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(timeSlotId ?? "");
  const [paymentProvider, setPaymentProvider] =
    useState<PaymentProvider>("MOMO_MANUAL");
  const [manualPayment, setManualPayment] =
    useState<CreatePaymentResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingLabel, setSubmittingLabel] = useState("");
  const submittingRef = useRef(false);
  const idempotencyRef = useRef<{
    payloadSignature: string;
    key: string;
  } | null>(null);
  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.id === selectedSlotId),
    [availableSlots, selectedSlotId],
  );
  const selectedSlotLabel = selectedSlot
    ? getSlotLabel(selectedSlot)
    : firstSlot;
  const selectedSlotPrice = toNumber(
    selectedSlot?.pricePerSlot ?? pricePerSlot,
  );
  const safeVenueImage = getOptionalSafeImageUrl(venueImage);
  const nextAvailableLabel = nextAvailableSlot
    ? `${formatTimeRange(nextAvailableSlot.startTime, nextAvailableSlot.endTime)}${
        nextAvailableSlot.date
          ? `, ${new Intl.DateTimeFormat("vi-VN", {
              day: "2-digit",
              month: "2-digit",
            }).format(new Date(nextAvailableSlot.date))}`
          : ""
      }`
    : null;
  const payloadSignature = useMemo(
    () =>
      JSON.stringify({
        fieldId,
        timeSlotId: selectedSlotId || null,
        bookingDate,
        selectedSlot: selectedSlotLabel,
        note: null,
      }),
    [bookingDate, fieldId, selectedSlotId, selectedSlotLabel],
  );

  useEffect(() => {
    idempotencyRef.current = null;
  }, [payloadSignature]);

  useEffect(() => {
    setSelectedSlotId(timeSlotId ?? "");
  }, [timeSlotId]);

  useEffect(() => {
    if (!manualPayment) return;

    let cancelled = false;
    const socket = getRealtimeSocket();
    const handleConfirmed = (event: { bookingId?: string }) => {
      if (event.bookingId !== manualPayment.bookingId) return;
      toast({
        title: "Thanh toán đã được xác nhận",
        description: "Booking của bạn đã được xác nhận.",
      });
      setManualPayment(null);
      setOpen(false);
      router.push("/bookings");
      router.refresh();
    };
    const handleCancelled = (event: { bookingId?: string }) => {
      if (event.bookingId !== manualPayment.bookingId) return;
      toast({
        title: "Booking đã bị huỷ",
        description: "Thanh toán MoMo thủ công chưa được xác nhận kịp thời.",
        variant: "destructive",
      });
      setManualPayment(null);
      setOpen(false);
      router.push("/bookings");
      router.refresh();
    };

    socket.on("booking.confirmed", handleConfirmed);
    socket.on("booking.cancelled", handleCancelled);

    const poll = async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      try {
        const status = await getPaymentStatusByBooking(
          token,
          manualPayment.bookingId,
        );
        if (cancelled) return;

        if (
          status.payment?.status === "PAID" &&
          status.bookingStatus === "CONFIRMED"
        ) {
          handleConfirmed({ bookingId: manualPayment.bookingId });
        } else if (status.bookingStatus === "CANCELLED") {
          handleCancelled({ bookingId: manualPayment.bookingId });
        }
      } catch {
        // Realtime remains active; polling retries on the next interval.
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 3_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      socket.off("booking.confirmed", handleConfirmed);
      socket.off("booking.cancelled", handleCancelled);
    };
  }, [getToken, manualPayment, router]);

  useEffect(() => {
    if (
      availableSlots.length > 0 &&
      !availableSlots.some((slot) => slot.id === selectedSlotId)
    ) {
      setSelectedSlotId(availableSlots[0]?.id ?? "");
    }
  }, [availableSlots, selectedSlotId]);

  function getIdempotencyKey() {
    if (idempotencyRef.current?.payloadSignature === payloadSignature) {
      return idempotencyRef.current.key;
    }

    const key =
      globalThis.crypto?.randomUUID?.() ??
      `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    idempotencyRef.current = { payloadSignature, key };
    return key;
  }

  /** Generate a separate idempotency key for payment initiation */
  function generatePaymentIdempotencyKey() {
    return (
      globalThis.crypto?.randomUUID?.() ??
      `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  }

  async function copyToClipboard(
    label: string,
    value?: string | number | null,
  ) {
    if (value === undefined || value === null || value === "") return;

    await navigator.clipboard.writeText(String(value));
    toast({
      title: "Đã sao chép",
      description: `${label} đã được sao chép vào clipboard.`,
    });
  }

  const handleBooking = async () => {
    if (submittingRef.current) {
      return;
    }

    if (!selectedSlotId) {
      toast({
        title: "Chưa có slot khả dụng",
        description: "Vui lòng chọn một khung giờ trống để tạo booking.",
        variant: "destructive",
      });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmittingLabel("Đang tạo booking...");

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Vui lòng đăng nhập để đặt sân");
      }

      const booking = await createPlayerBooking(
        token,
        { fieldId, timeSlotId: selectedSlotId },
        { idempotencyKey: getIdempotencyKey() },
      );

      if (fieldId.includes("-field-")) {
        const bookingTimeLabel = selectedSlotLabel.includes("-")
          ? selectedSlotLabel
          : `${selectedSlotLabel} - ${String((Number(selectedSlotLabel.split(":")[0]) + 1) % 24).padStart(2, "0")}:${selectedSlotLabel.split(":")[1]}`;
        const mockBooking = {
          id: booking.id,
          venueId: fieldId.split("-")[0] + "-venue",
          venueName,
          venueAddress: "Đang cập nhật",
          fieldName,
          bookingDate: new Date().toLocaleDateString("vi-VN"),
          bookingTime: bookingTimeLabel,
          startsAt: new Date().toISOString(),
          status: "PENDING",
          totalPrice: selectedSlotPrice,
          refundAmount: 0,
          refundPercent: 100,
          canCancel: true,
          cancelledAt: null,
          cancelReason: null,
          expiresAt: getPaymentHoldExpiresAt(),
        };
        const existing = safeJsonParse(
          localStorage.getItem("mock_bookings"),
          [],
        );
        localStorage.setItem(
          "mock_bookings",
          JSON.stringify([mockBooking, ...existing]),
        );

        // Mock path: skip payment, go to bookings
        setOpen(false);
        toast({
          title: "Đặt sân thành công!",
          description: `Booking #${booking.id} đã được tạo.`,
        });
        router.push("/bookings");
        router.refresh();
        return;
      }

      // ── Real booking: initiate provider payment ──────────────
      setSubmittingLabel("Đang tạo thanh toán...");

      try {
        const paymentIdempotencyKey = generatePaymentIdempotencyKey();
        const paymentResult = await createPayment(
          token,
          { bookingId: booking.id, provider: paymentProvider },
          { idempotencyKey: paymentIdempotencyKey },
        );

        if (paymentResult.provider === "MOMO_MANUAL") {
          setManualPayment(paymentResult);
          toast({
            title: "Đã tạo hướng dẫn thanh toán MoMo",
            description:
              "Vui lòng chuyển khoản đúng nội dung để chủ sân xác nhận.",
          });
          return;
        }

        if (paymentResult.paymentUrl) {
          const providerLabel =
            paymentResult.provider === "VNPAY" ? "VNPay" : "MoMo";
          toast({
            title: `Đang chuyển hướng đến ${providerLabel}...`,
            description: `Bạn sẽ được chuyển đến trang thanh toán ${providerLabel}.`,
          });
          window.location.href = paymentResult.paymentUrl;
          return;
        }

        // paymentUrl missing — unusual but possible
        toast({
          title: "Không thể tạo link thanh toán",
          description:
            "Booking đã được tạo. Vui lòng thanh toán trong mục Lịch sử đặt sân trước khi hết hạn.",
          variant: "destructive",
        });
      } catch (paymentError) {
        const paymentMessage =
          paymentError instanceof Error
            ? paymentError.message
            : "Không thể tạo thanh toán";
        toast({
          title: "Lỗi thanh toán",
          description: `Booking đã được tạo nhưng thanh toán gặp lỗi: ${paymentMessage}. Booking sẽ tự hủy sau 5 phút nếu chưa thanh toán.`,
          variant: "destructive",
        });
      }

      // Booking created but payment failed/no URL — redirect to bookings
      setOpen(false);
      router.push("/bookings");
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tạo booking";
      const isInProgressConflict =
        errorMessage.includes("already in progress") ||
        errorMessage.includes("đang được xử lý");

      toast({
        title: isInProgressConflict ? "Đang xử lý booking" : "Lỗi",
        description: isInProgressConflict
          ? "Yêu cầu đặt sân trước đó vẫn đang được xử lý. Vui lòng chờ vài giây rồi kiểm tra lịch đặt."
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      setSubmittingLabel("");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">
          Đặt sân ngay
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-[100dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-slate-200 px-4 py-4 text-left sm:px-6">
          <SheetTitle>Đặt sân</SheetTitle>
          <SheetDescription>
            Kiểm tra lại sân và khung giờ trước khi xác nhận booking.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <div className="grid gap-3">
          <div className="relative min-h-[190px] overflow-hidden rounded-2xl bg-emerald-800 text-white">
            {safeVenueImage ? (
              <Image
                src={safeVenueImage}
                alt={venueName}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 480px"
                unoptimized={shouldUnoptimizeImage(safeVenueImage)}
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#064e3b_0%,#047857_52%,#0f766e_100%)]">
                <div className="absolute inset-0 opacity-25 bg-[linear-gradient(rgba(255,255,255,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.24)_1px,transparent_1px)] bg-[size:32px_32px]" />
                <div className="absolute inset-5 rounded-2xl border border-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
            <div className="relative flex h-full min-h-[190px] flex-col justify-end gap-2 p-4">
              <div className="flex w-fit items-center gap-1.5 rounded-full bg-emerald-400/95 px-3 py-1 text-xs font-semibold text-emerald-950">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Có thể đặt online
              </div>
              <div>
                <h3 className="text-xl font-semibold leading-tight">
                  {venueName}
                </h3>
                <p className="mt-1 text-sm font-medium text-white/90">
                  {fieldName}
                </p>
                {venueAddress ? (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-white/80">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {venueAddress}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="rounded-[28px] bg-emerald-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Sân đã chọn
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">
              {venueName}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{fieldName}</p>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <CalendarClock className="h-4 w-4 text-emerald-700" />
              Hôm nay, slot khả dụng sớm nhất
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Clock3 className="h-4 w-4 text-emerald-700" />
              {selectedSlotLabel}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-700">
              <Wallet className="h-4 w-4 text-emerald-700" />
              {selectedSlotPrice > 0
                ? formatCurrency(selectedSlotPrice)
                : "Liên hệ"}
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">
              Phương thức thanh toán
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["VNPAY", "MOMO_MANUAL"] as const).map((provider) => {
                const isSelected = paymentProvider === provider;
                return (
                  <Button
                    key={provider}
                    type="button"
                    variant={isSelected ? "default" : "secondary"}
                    className="h-12 justify-center gap-2"
                    onClick={() => setPaymentProvider(provider)}
                  >
                    {provider === "VNPAY" ? (
                      <QrCode className="h-4 w-4" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    {provider === "VNPAY" ? "VNPay QR" : "MoMo QR thủ công"}
                  </Button>
                );
              })}
            </div>
          </div>

          {manualPayment ? (
            <div className="grid gap-4 rounded-[28px] border border-pink-200 bg-pink-50 p-5">
              <div>
                <div className="text-sm font-semibold text-pink-950">
                  MoMo QR thủ công
                </div>
                <p className="mt-1 text-xs leading-5 text-pink-800">
                  Đây là thanh toán chuyển khoản thủ công. Booking chỉ được xác
                  nhận sau khi chủ sân xác nhận đã nhận tiền.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {manualPayment.expiresAt ? (
                    <PaymentCountdown expiresAt={manualPayment.expiresAt} />
                  ) : null}
                  <span className="text-xs font-medium text-pink-900">
                    Bạn có 05:00 để chuyển khoản. Sau thời gian này sân sẽ tự
                    động mở lại.
                  </span>
                </div>
              </div>

              {manualPayment.qrImageUrl ? (
                <img
                  src={manualPayment.qrImageUrl}
                  alt="MoMo QR"
                  className="mx-auto h-48 w-48 rounded-2xl border border-white bg-white object-contain p-2"
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-pink-200 bg-white/70 p-4 text-center text-sm text-pink-800">
                  Chưa cấu hình ảnh QR. Vui lòng chuyển khoản theo số điện thoại
                  và nội dung bên dưới.
                </div>
              )}

              <div className="grid gap-2 text-sm">
                <ManualPaymentRow
                  label="Người nhận"
                  value={manualPayment.receiverName}
                />
                <ManualPaymentRow
                  label="Số MoMo"
                  value={manualPayment.phone}
                  onCopy={() => copyToClipboard("Số MoMo", manualPayment.phone)}
                />
                <ManualPaymentRow
                  label="Số tiền"
                  value={formatCurrency(manualPayment.amount)}
                  onCopy={() =>
                    copyToClipboard("Số tiền", manualPayment.amount)
                  }
                />
                <ManualPaymentRow
                  label="Nội dung"
                  value={manualPayment.transferContent}
                  onCopy={() =>
                    copyToClipboard("Nội dung", manualPayment.transferContent)
                  }
                />
              </div>

              <p className="text-xs leading-5 text-pink-800">
                {manualPayment.instructions ??
                  "Quét QR MoMo và nhập đúng nội dung chuyển khoản. Chủ sân sẽ xác nhận sau khi nhận tiền."}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">
              Chọn khung giờ
            </div>
            {availableSlots.length > 0 ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {availableSlots.map((slot) => {
                  const isSelected = slot.id === selectedSlotId;
                  return (
                    <Button
                      key={slot.id}
                      type="button"
                      variant={isSelected ? "default" : "secondary"}
                      className="h-auto min-h-14 justify-start whitespace-normal px-3 py-2 text-left"
                      onClick={() => setSelectedSlotId(slot.id)}
                    >
                      <span className="grid gap-0.5">
                        <span>{getSlotLabel(slot)}</span>
                        <span className="text-xs opacity-80">
                          {formatCurrency(toNumber(slot.pricePerSlot))}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            ) : selectedSlotId ? (
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="default"
                  className="h-auto min-h-14 justify-start whitespace-normal px-3 py-2 text-left"
                >
                  <span className="grid gap-0.5">
                    <span>{selectedSlotLabel}</span>
                    <span className="text-xs opacity-80">
                      {formatCurrency(selectedSlotPrice)}
                    </span>
                  </span>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white text-emerald-700">
                  <CalendarX2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-950">
                    Chưa có khung giờ trống hôm nay
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Thử chọn ngày khác hoặc quay lại sau.
                  </p>
                </div>
                {nextAvailableLabel ? (
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-emerald-800">
                    Slot gần nhất: {nextAvailableLabel}
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.refresh()}
                  >
                    Chọn ngày khác
                  </Button>
                  {nextAvailableLabel ? (
                    <Button type="button" onClick={() => router.refresh()}>
                      Chọn ngày gần nhất
                    </Button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        <SheetFooter className="border-t border-slate-200 bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] pt-4 backdrop-blur sm:px-6">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => setOpen(false)}
          >
            Để sau
          </Button>
          <Button
            onClick={handleBooking}
            disabled={isSubmitting || !selectedSlotId || Boolean(manualPayment)}
            className="w-full whitespace-normal sm:w-auto"
          >
            {manualPayment
              ? "Đang chờ chủ sân xác nhận"
              : isSubmitting
                ? submittingLabel || "Đang xử lý..."
                : "Đặt sân & Thanh toán"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ManualPaymentRow({
  label,
  value,
  onCopy,
}: Readonly<{
  label: string;
  value?: string | number | null;
  onCopy?: () => void;
}>) {
  return (
    <div className="grid gap-2 rounded-2xl bg-white/80 p-3 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
      <span className="text-xs font-semibold uppercase text-pink-700">
        {label}
      </span>
      <span className="min-w-0 break-words font-medium text-slate-950">
        {value ?? "Chưa cấu hình"}
      </span>
      {onCopy ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full gap-2 sm:w-auto"
          onClick={onCopy}
        >
          <Copy className="h-4 w-4" />
          Sao chép
        </Button>
      ) : null}
    </div>
  );
}
