"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-5 px-4 py-16 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <TriangleAlert className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-950">Có lỗi xảy ra khi tải trang</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          Mình đã chuẩn bị sẵn fallback error boundary để người dùng không bị kẹt màn hình trắng.
        </p>
      </div>
      <Button onClick={reset}>
        Thử lại
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
