"use client";

import type { BookingStatus } from "@dat-san-vn/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type OwnerBookingStatusFilter = "ALL" | BookingStatus;

const filters: Array<{ label: string; value: OwnerBookingStatusFilter }> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Đang giữ chỗ", value: "PENDING" },
  { label: "Đã đặt", value: "CONFIRMED" },
  { label: "Hoàn thành", value: "COMPLETED" },
  { label: "Đã huỷ", value: "CANCELLED" },
];

export function BookingFilterTabs({
  value,
  onValueChange,
}: Readonly<{
  value: OwnerBookingStatusFilter;
  onValueChange: (value: OwnerBookingStatusFilter) => void;
}>) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) =>
        onValueChange(nextValue as OwnerBookingStatusFilter)
      }
    >
      <TabsList>
        {filters.map((filter) => (
          <TabsTrigger key={filter.value} value={filter.value}>
            {filter.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
