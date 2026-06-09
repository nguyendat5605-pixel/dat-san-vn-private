"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FieldSize } from "@dat-san-vn/types";
import { Filter, Search } from "lucide-react";
import { allDistricts } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentValues = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      district: searchParams.get("district") ?? "ALL",
      size: (searchParams.get("size") as FieldSize | "ALL") ?? "ALL",
      priceMax: searchParams.get("priceMax") ?? "800000",
      startTime: searchParams.get("startTime") ?? "",
    }),
    [searchParams],
  );

  const [q, setQ] = useState(() => currentValues.q);
  const [district, setDistrict] = useState(() => currentValues.district);
  const [size, setSize] = useState<FieldSize | "ALL">(() => currentValues.size);
  const [priceMax, setPriceMax] = useState(() => currentValues.priceMax);
  const [startTime, setStartTime] = useState(() => currentValues.startTime);

  useEffect(() => {
    setQ(currentValues.q);
    setDistrict(currentValues.district);
    setSize(currentValues.size);
    setPriceMax(currentValues.priceMax);
    setStartTime(currentValues.startTime);
  }, [currentValues]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());

      q ? params.set("q", q) : params.delete("q");
      district !== "ALL"
        ? params.set("district", district)
        : params.delete("district");
      size !== "ALL" ? params.set("size", size) : params.delete("size");
      priceMax ? params.set("priceMax", priceMax) : params.delete("priceMax");
      startTime
        ? params.set("startTime", startTime)
        : params.delete("startTime");

      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const onReset = () => {
    startTransition(() => {
      router.push(pathname);
    });
    setQ("");
    setDistrict("ALL");
    setSize("ALL");
    setPriceMax("800000");
    setStartTime("");
  };

  return (
    <form
      onSubmit={onSubmit}
      className="surface-panel rounded-[24px] border border-white/70 p-4 sm:rounded-[32px] sm:p-5 lg:sticky lg:top-24"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Filter className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-950">Bộ lọc tìm sân</h2>
          <p className="text-sm text-slate-600">
            Lọc theo khu vực, loại sân và khung giờ.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Từ khóa
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Tên sân hoặc khu vực"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Khu vực
          <select
            value={district}
            onChange={(event) => setDistrict(event.target.value)}
            className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base md:text-sm text-slate-950 outline-none focus:border-emerald-400"
          >
            <option value="ALL">Tất cả khu vực</option>
            {allDistricts.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Loại sân
          <select
            value={size}
            onChange={(event) =>
              setSize(event.target.value as FieldSize | "ALL")
            }
            className="h-12 rounded-2xl border border-slate-200 bg-white/90 px-4 text-base md:text-sm text-slate-950 outline-none focus:border-emerald-400"
          >
            <option value="ALL">Tất cả loại sân</option>
            <option value="FIELD_5">Sân 5</option>
            <option value="FIELD_7">Sân 7</option>
            <option value="FIELD_11">Sân 11</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Giá tối đa
          <Input
            type="number"
            min={200000}
            step={50000}
            value={priceMax}
            onChange={(event) => setPriceMax(event.target.value)}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Khung giờ bắt đầu
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Button type="submit" className="min-h-11 w-full">
          <Search className="h-4 w-4" />
          Áp dụng bộ lọc
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          onClick={onReset}
        >
          Đặt lại
        </Button>
      </div>
    </form>
  );
}
