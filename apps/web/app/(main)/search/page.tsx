import { Search } from "lucide-react";
import type { FieldSize } from "@dat-san-vn/types";
import { searchVenues } from "@/lib/api";
import { EmptyState } from "@/components/common/empty-state";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/components/venue/search-filters";
import { VenueList } from "@/components/venue/venue-list";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    district?: string;
    size?: FieldSize | "ALL";
    priceMax?: string;
    startTime?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const venues = await searchVenues({
    q: resolvedSearchParams.q,
    district: resolvedSearchParams.district,
    size: resolvedSearchParams.size,
    priceMax: resolvedSearchParams.priceMax
      ? Number(resolvedSearchParams.priceMax)
      : undefined,
    startTime: resolvedSearchParams.startTime,
  });

  const activeFilters = [
    resolvedSearchParams.q,
    resolvedSearchParams.district,
    resolvedSearchParams.size && resolvedSearchParams.size !== "ALL"
      ? resolvedSearchParams.size
      : undefined,
    resolvedSearchParams.startTime,
  ].filter(Boolean) as string[];

  return (
    <div className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Tìm Sân"
          title="Tìm sân theo khu vực, loại sân, giá và khung giờ"
          description="Lọc nhanh các sân còn phù hợp, xem giá và mở trang chi tiết để đặt lịch ngay."
        />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="bg-white/80">
            {venues.length} kết quả
          </Badge>
          {activeFilters.length > 0 ? (
            activeFilters.map((filter) => (
              <Badge key={filter} variant="secondary">
                {filter}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Đang hiển thị tất cả sân</Badge>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="min-w-0">
            <SearchFilters />
          </aside>

          <section className="grid min-w-0 gap-5">
            <div className="surface-panel flex items-start gap-3 rounded-[24px] border border-white/70 px-4 py-4 sm:items-center sm:rounded-[28px] sm:px-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Search className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">
                  Kết quả tìm kiếm
                </div>
                <p className="text-sm text-slate-600">
                  Chọn sân phù hợp rồi mở chi tiết để xem slot còn trống.
                </p>
              </div>
            </div>

            {venues.length > 0 ? (
              <VenueList venues={venues} />
            ) : (
              <EmptyState
                title="Chưa tìm thấy sân phù hợp"
                description="Thử đổi khu vực, bỏ bớt khung giờ hoặc tăng mức giá tối đa để mở rộng kết quả."
                actionHref="/search"
                actionLabel="Xem lại tất cả sân"
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
