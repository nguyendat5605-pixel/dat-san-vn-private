"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus, PencilLine, ShieldCheck, Clock3, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  createOwnerVenue,
  getOwnerVenues,
  updateOwnerVenue,
  deleteOwnerVenue,
  type OwnerVenue,
} from "@/lib/owner-api";
import type { CreateVenuePayload } from "@dat-san-vn/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { VenueForm } from "@/components/owner/venue-form";

function getVenueStatusMeta(venue: OwnerVenue) {
  if (venue.ownerStatus === "PENDING") {
    return {
      label: "Chờ duyệt sở hữu",
      className: "bg-amber-50 text-amber-800 hover:bg-amber-50",
      icon: Clock3,
    };
  }

  if (venue.isActive) {
    return {
      label: "Đang hoạt động",
      className: "bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
      icon: ShieldCheck,
    };
  }

  return {
    label: "Đã tạo nhưng chưa active",
    className: "bg-slate-100 text-slate-700 hover:bg-slate-100",
    icon: Clock3,
  };
}

export function OwnerVenuesClient({
  initialVenues,
}: Readonly<{
  initialVenues: OwnerVenue[];
}>) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [venues, setVenues] = useState(initialVenues);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<OwnerVenue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);

  async function refreshVenues() {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Không thể tải danh sách sân khi chưa có access token.",
      });
      return;
    }

    try {
      const nextVenues = await getOwnerVenues(token);
      setVenues(nextVenues);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Tải sân thất bại",
        description: error instanceof Error ? error.message : "Không thể tải danh sách sân.",
      });
    }
  }

  async function handleSubmit(payload: CreateVenuePayload) {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để lưu sân.",
      });
      return;
    }

    setSubmitting(true);

    try {
      if (editingVenue) {
        await updateOwnerVenue(token, editingVenue.id, payload);
      } else {
        await createOwnerVenue(token, payload);
      }

      toast({
        title: editingVenue ? "Đã cập nhật sân" : "Đã tạo sân mới",
        description: "Danh sách sân của bạn đã được làm mới.",
      });
      setSheetOpen(false);
      setEditingVenue(null);
      await refreshVenues();
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lưu sân thất bại",
        description: error instanceof Error ? error.message : "Không thể lưu thông tin sân.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(venue: OwnerVenue) {
    if (!window.confirm(`Xoá sân "${venue.name}" khỏi danh sách quản lý của bạn?`)) {
      return;
    }

    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để xoá sân.",
      });
      return;
    }

    setDeletingVenueId(venue.id);

    try {
      await deleteOwnerVenue(token, venue.id);
      toast({
        title: "Đã xoá sân",
        description: "Sân đã được xoá khỏi danh sách quản lý.",
      });
      await refreshVenues();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Xoá sân thất bại",
        description: error instanceof Error ? error.message : "Không thể xoá sân.",
      });
    } finally {
      setDeletingVenueId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Danh sách sân của tôi</h2>
          <p className="mt-1 text-sm text-slate-600">Bạn có thể tạo sân mới, chỉnh sửa thông tin cơ bản và đi tới trang quản lý field.</p>
        </div>
        <Button
          onClick={() => {
            setEditingVenue(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm sân mới
        </Button>
      </div>

      {venues.length === 0 ? (
        <Card className="border-dashed border-slate-200 bg-white/80">
          <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="text-xl font-semibold text-slate-950">Bạn chưa có sân nào</div>
            <p className="mt-2 max-w-lg text-sm text-slate-600">
              Tạo sân đầu tiên để bắt đầu nhận booking và quản lý các field trực tiếp từ dashboard owner.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                setEditingVenue(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Tạo sân đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((venue) => {
            const statusMeta = getVenueStatusMeta(venue);
            const StatusIcon = statusMeta.icon;

            return (
              <Card key={venue.id} className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">{venue.name}</h3>
                      <p className="mt-2 text-sm text-slate-600">{venue.address}</p>
                    </div>
                    <Badge className={statusMeta.className}>
                      <StatusIcon className="mr-1 h-3.5 w-3.5" />
                      {statusMeta.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-[28px] bg-slate-50 p-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Field</div>
                      <div className="mt-1 text-xl font-semibold text-slate-950">{venue.fieldCount}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Booking</div>
                      <div className="mt-1 text-xl font-semibold text-slate-950">{venue.bookingCount}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {venue.fields.slice(0, 3).map((field) => (
                      <Badge key={field.id} variant="outline" className="bg-white">
                        {field.name}
                      </Badge>
                    ))}
                    {venue.fields.length === 0 ? (
                      <Badge variant="outline" className="bg-white">
                        Chưa có field
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingVenue(venue);
                        setSheetOpen(true);
                      }}
                    >
                      <PencilLine className="h-4 w-4 mr-1" />
                      Sửa
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      disabled={deletingVenueId === venue.id}
                      onClick={() => handleDelete(venue)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Xoá
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/owner/venues/${venue.id}/fields`}>Quản lý Field</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingVenue ? "Chỉnh sửa sân" : "Tạo sân mới"}</SheetTitle>
            <SheetDescription>
              {editingVenue
                ? "Cập nhật thông tin cơ bản của sân và lưu lại ngay trong owner dashboard."
                : "Tạo sân mới để thêm vào danh sách quản lý của bạn."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <VenueForm
              venue={editingVenue}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
