"use client";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HeroPreviewDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="lg" className="w-full sm:w-auto">
          <PlayCircle className="h-4 w-4" />
          Hướng dẫn sử dụng
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đặt sân chỉ 3 bước đơn giản</DialogTitle>
          <DialogDescription>
            Từ lúc mở app đến khi chốt được sân ưng ý, toàn bộ quá trình chỉ mất
            chưa đến một phút.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-[28px] bg-emerald-50 p-5">
            <div className="text-sm font-semibold text-emerald-900">
              1. Tìm kiếm thông minh
            </div>
            <p className="mt-2 text-sm text-emerald-800">
              Nhập tên sân hoặc khu vực, lọc theo loại sân, khung giờ và mức giá
              phù hợp với đội bạn.
            </p>
          </div>
          <div className="rounded-[28px] bg-amber-50 p-5">
            <div className="text-sm font-semibold text-amber-900">
              2. Thông tin minh bạch
            </div>
            <p className="mt-2 text-sm text-amber-800">
              Xem ảnh thực tế, tiện ích, slot trống và giá từng sân — tất cả
              trên cùng một màn hình, không cần gọi điện hỏi thêm.
            </p>
          </div>
          <div className="rounded-[28px] bg-slate-100 p-5">
            <div className="text-sm font-semibold text-slate-900">
              3. Đặt sân dễ dàng
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Chọn slot, xác nhận đặt sân và nhận thông báo ngay lập tức. Lịch
              sử đặt sân được lưu lại để tra cứu bất cứ lúc nào.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
