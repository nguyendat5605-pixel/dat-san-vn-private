"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { AdminVenue } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

type VenueStatusFilter = "ALL" | "PENDING" | "APPROVED";

/**
 * Derive display status from venue data:
 *  - venue.isActive === true → "APPROVED"
 *  - venue.isActive === false → depends on VenueOwner status
 *    - any PENDING owner → "PENDING"
 *    - all REJECTED owners → "REJECTED"
 *    - no owners → "PENDING"
 */
function getVenueDisplayStatus(venue: AdminVenue): "PENDING" | "APPROVED" | "REJECTED" {
  if (venue.isActive) return "APPROVED";
  const hasPending = venue.owners.some((o) => o.status === "PENDING");
  if (hasPending) return "PENDING";
  const hasRejected = venue.owners.some((o) => o.status === "REJECTED");
  if (hasRejected) return "REJECTED";
  return "PENDING";
}

function statusBadge(status: "PENDING" | "APPROVED" | "REJECTED") {
  switch (status) {
    case "APPROVED":
      return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Đã duyệt</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-50 text-red-600 hover:bg-red-50">Đã từ chối</Badge>;
    default:
      return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Chờ duyệt</Badge>;
  }
}

export function VenueApprovalTable({
  venues,
  token,
}: Readonly<{
  venues: AdminVenue[];
  token: string;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionVenueId, setActionVenueId] = useState<string | null>(null);
  const [filter, setFilter] = useState<VenueStatusFilter>("ALL");

  const filteredVenues = venues.filter((venue) => {
    if (filter === "ALL") return true;
    const status = getVenueDisplayStatus(venue);
    return status === filter;
  });

  async function handleApprove(venueId: string) {
    setActionVenueId(venueId);
    try {
      const { approveVenue } = await import("@/lib/admin-api");
      await approveVenue(token, venueId);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to approve venue:", error);
    } finally {
      setActionVenueId(null);
    }
  }

  async function handleReject(venueId: string) {
    if (!confirm("Bạn chắc chắn muốn từ chối venue này?")) return;
    setActionVenueId(venueId);
    try {
      const { rejectVenue } = await import("@/lib/admin-api");
      await rejectVenue(token, venueId);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to reject venue:", error);
    } finally {
      setActionVenueId(null);
    }
  }

  async function handleDelete(venueId: string) {
    if (!confirm("Bạn chắc chắn muốn xoá hoàn toàn venue này khỏi hệ thống?")) return;
    setActionVenueId(venueId);
    try {
      const { deleteVenue } = await import("@/lib/admin-api");
      await deleteVenue(token, venueId);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to delete venue:", error);
    } finally {
      setActionVenueId(null);
    }
  }

  const filterTabs: { value: VenueStatusFilter; label: string }[] = [
    { value: "ALL", label: `Tất cả (${venues.length})` },
    { value: "PENDING", label: `Chờ duyệt (${venues.filter((v) => getVenueDisplayStatus(v) === "PENDING").length})` },
    { value: "APPROVED", label: `Đã duyệt (${venues.filter((v) => getVenueDisplayStatus(v) === "APPROVED").length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filter === tab.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredVenues.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
          Không có venue nào {filter !== "ALL" ? `ở trạng thái "${filter}"` : "trong hệ thống"}.
        </div>
      ) : (
        <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên sân</TableHead>
                    <TableHead>Chủ sân</TableHead>
                    <TableHead>Địa chỉ</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVenues.map((venue) => {
                    const displayStatus = getVenueDisplayStatus(venue);
                    const isLoading = isPending && actionVenueId === venue.id;
                    const ownerName = venue.owners[0]?.user.fullName ?? "Chưa có";

                    return (
                      <TableRow key={venue.id} className={isLoading ? "opacity-50" : ""}>
                        <TableCell>
                          <span className="font-medium text-slate-900">{venue.name}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm text-slate-700">{ownerName}</div>
                            <div className="text-xs text-slate-400">{venue.owners[0]?.user.email ?? ""}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-slate-600">
                          {venue.address}, {venue.district}, {venue.city}
                        </TableCell>
                        <TableCell>{statusBadge(displayStatus)}</TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {new Date(venue.createdAt).toLocaleDateString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {displayStatus === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  disabled={isLoading}
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                  onClick={() => handleApprove(venue.id)}
                                >
                                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                  Duyệt
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isLoading}
                                  className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                  onClick={() => handleReject(venue.id)}
                                >
                                  <XCircle className="mr-1.5 h-4 w-4" />
                                  Từ chối
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isLoading}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => handleDelete(venue.id)}
                            >
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              Xoá
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
