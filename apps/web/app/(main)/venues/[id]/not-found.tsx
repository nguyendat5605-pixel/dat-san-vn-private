import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VenueNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-5 px-4 py-16 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <SearchX className="h-8 w-8" />
      </div>
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Không tìm thấy sân</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Route detail đã có fallback riêng để người dùng không rơi vào trạng thái trang trống.
        </p>
      </div>
      <Button asChild>
        <Link href="/search">
          <ArrowLeft className="h-4 w-4" />
          Quay lại trang tìm sân
        </Link>
      </Button>
    </div>
  );
}
