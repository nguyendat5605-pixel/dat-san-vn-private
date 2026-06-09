import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

export function Footer() {
  return (
    <footer className="px-4 pb-10 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-[24px] border border-white/70 bg-[#102216] px-5 py-8 text-white shadow-[0_24px_80px_rgba(16,34,22,0.22)] sm:rounded-[32px] sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
            DatSanVN
          </div>
          <h2 className="mt-4 max-w-md text-2xl font-semibold leading-tight sm:text-3xl">
            Nền tảng hàng đầu giúp bạn tìm kiếm và đặt sân bóng đá nhanh chóng,
            tiện lợi nhất.
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/70">
            DatSanVN kết nối hàng trăm sân bóng đá tại TP.HCM với hàng nghìn đội
            bóng mỗi ngày. Minh bạch thông tin, đặt sân dễ dàng và lịch sử giao
            dịch luôn trong tầm tay.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-white/80">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-emerald-300" />
            <span>TP.HCM, Việt Nam</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-emerald-300" />
            <span>0909 000 999</span>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-emerald-300" />
            <span>support@datsan.vn</span>
          </div>
          <div className="flex flex-wrap gap-4 pt-4 text-sm">
            <Link href="/" className="transition hover:text-white">
              Trang chủ
            </Link>
            <Link href="/search" className="transition hover:text-white">
              Tìm sân
            </Link>
            <Link href="/bookings" className="transition hover:text-white">
              Lịch đặt
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
