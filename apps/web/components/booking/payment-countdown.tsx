"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface PaymentCountdownProps {
  expiresAt: string;
  onExpired?: () => void;
}

function calculateRemainingMs(expiresAt: string) {
  const expirationTime = new Date(expiresAt).getTime();

  if (!Number.isFinite(expirationTime)) {
    return 0;
  }

  return Math.max(0, expirationTime - Date.now());
}

export function PaymentCountdown({
  expiresAt,
  onExpired,
}: PaymentCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(() =>
    calculateRemainingMs(expiresAt),
  );
  const [isExpired, setIsExpired] = useState(
    () => calculateRemainingMs(expiresAt) === 0,
  );

  useEffect(() => {
    const initialTimeLeft = calculateRemainingMs(expiresAt);
    setTimeLeft(initialTimeLeft);
    setIsExpired(initialTimeLeft === 0);

    if (initialTimeLeft === 0) {
      return;
    }

    const timer = setInterval(() => {
      const newTimeLeft = calculateRemainingMs(expiresAt);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft === 0) {
        clearInterval(timer);
        setIsExpired(true);
        if (onExpired) onExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const totalSeconds = Math.ceil(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
        <Clock className="w-3 h-3" />
        Đang xử lý hủy...
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
      <Clock className="w-3 h-3" />
      Còn lại: {formattedTime}
    </span>
  );
}
