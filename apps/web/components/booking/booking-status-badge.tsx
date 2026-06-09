import type { BookingStatus } from "@dat-san-vn/types";
import { Badge } from "@/components/ui/badge";

const statusMap: Record<
  BookingStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  PENDING: { label: "Đang giữ chỗ", variant: "secondary" },
  CONFIRMED: { label: "Đã đặt", variant: "default" },
  COMPLETED: { label: "Hoàn thành", variant: "outline" },
  CANCELLED: { label: "Đã hủy", variant: "destructive" },
};

export function BookingStatusBadge({
  status,
}: Readonly<{ status: BookingStatus }>) {
  const config = statusMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
