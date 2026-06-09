import Link from "next/link";
import { ArrowRight, MapPin, Search, Star } from "lucide-react";
import { getFeaturedVenues } from "@/lib/api";
import { testimonials, venueCategories } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeroPreviewDialog } from "@/components/common/hero-preview-dialog";
import { SectionHeading } from "@/components/common/section-heading";
import { VenueList } from "@/components/venue/venue-list";

export default async function LandingPage() {
  const featuredVenues = await getFeaturedVenues();

  return (
    <div className="pb-8">
      <section className="px-4 pt-3 sm:px-6 sm:pt-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,#102216_0%,#17432a_45%,#f59e0b_160%)] px-5 py-8 text-white shadow-[0_30px_90px_rgba(16,34,22,0.26)] sm:rounded-[40px] sm:px-10 sm:py-14">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-100 sm:px-4 sm:text-xs sm:tracking-[0.24em]">
              <Star className="h-4 w-4 text-amber-300" />
              Nền Tảng Đặt Sân Bóng Đá Số 1
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight sm:mt-6 sm:text-5xl lg:text-6xl">
              Tìm kiếm, so sánh và chốt sân bóng đá nhanh chóng — mọi lúc, mọi
              nơi.
            </h1>
            <p className="mt-5 max-w-2xl text-sm text-white/75 sm:text-base">
              Hàng trăm sân bóng đá tại TP.HCM, đầy đủ thông tin slot trống, giá
              cả và tiện ích. Đặt sân chỉ trong vài thao tác, không cần gọi điện
              hỏi từng nơi.
            </p>

            <form
              action="/search"
              className="mt-8 grid gap-3 rounded-[24px] bg-white/10 p-3 backdrop-blur-md sm:rounded-[32px] sm:p-4 md:grid-cols-[1fr_180px]"
            >
              <label className="flex min-h-12 items-center gap-3 rounded-[20px] bg-white/92 px-4 py-3 text-slate-950 shadow-lg sm:rounded-[24px]">
                <Search className="h-5 w-5 text-emerald-700" />
                <input
                  type="text"
                  name="q"
                  placeholder="Tìm theo tên sân hoặc khu vực"
                  className="w-full bg-transparent text-base sm:text-sm outline-none placeholder:text-slate-400"
                />
              </label>
              <Button
                type="submit"
                size="lg"
                className="min-h-[52px] w-full bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                Bắt đầu tìm sân
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/search">
                  <MapPin className="h-4 w-4" />
                  Khám phá sân gần bạn
                </Link>
              </Button>
              <HeroPreviewDialog />
            </div>
          </div>

          <div className="grid gap-4">
            <Card className="overflow-hidden border-white/70 bg-white/80">
              <CardContent className="p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Hệ Thống Rộng Lớn
                </div>
                <div className="mt-4 text-4xl font-semibold text-slate-950">
                  120+
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Sân bóng đá được xác minh trên toàn TP.HCM, cập nhật slot
                  trống theo thời gian thực.
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-white/70 bg-[#fff7e8]">
              <CardContent className="p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Trải Nghiệm Tiện Lợi
                </div>
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  Đặt sân trong 60 giây
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Tìm kiếm, xem slot trống và xác nhận đặt sân ngay trên điện
                  thoại — không cần gọi điện.
                </p>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-white/70 bg-[#eef8f0]">
              <CardContent className="p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  An Toàn & Bảo Mật
                </div>
                <div className="mt-4 text-2xl font-semibold text-slate-950">
                  Thanh toán & lịch sử rõ ràng
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Mọi giao dịch được lưu lại, lịch đặt sân minh bạch và có thể
                  tra cứu bất cứ lúc nào.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Sân Bóng Nổi Bật"
            title="Những sân được đặt nhiều nhất tuần này"
            description="Được chọn lọc dựa trên đánh giá thực tế, chất lượng mặt sân và sự tiện lợi về vị trí."
          />
          <div className="mt-8">
            <VenueList venues={featuredVenues} />
          </div>
        </div>
      </section>

      <section className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Đa Dạng Loại Sân"
            title="Chọn loại sân phù hợp với đội của bạn"
            description="Từ trận đá nhanh 5 người đến giải phong trào 11 người — DatSanVN đều có đủ lựa chọn."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {venueCategories.map((category) => (
              <Card key={category.size} className="border-white/70">
                <CardContent className="p-6">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    {category.label}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {category.description}
                  </p>
                  <Button asChild variant="secondary" className="mt-6">
                    <Link href={`/search?size=${category.size}`}>
                      Xem sân {category.label.toLowerCase()}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Khách Hàng Nói Gì"
            title="Hàng nghìn đội bóng đã tin dùng DatSanVN"
            description="Trải nghiệm thực tế từ những người dùng đặt sân thường xuyên mỗi tuần."
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="border-white/70">
                <CardContent className="p-6">
                  <p className="text-base leading-7 text-slate-700">
                    "{testimonial.quote}"
                  </p>
                  <div className="mt-6">
                    <div className="font-semibold text-slate-950">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-slate-500">
                      {testimonial.role}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
