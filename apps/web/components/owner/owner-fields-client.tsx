"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Plus, PencilLine, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  createVenueField,
  deleteVenueField,
  getVenueFields,
  updateVenueField,
  type OwnerField,
} from "@/lib/owner-api";
import type { CreateFieldPayload } from "@dat-san-vn/types";
import { formatFieldSizeLabel, formatSportTypeLabel } from "@/lib/utils";
import { FieldForm } from "@/components/owner/field-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function OwnerFieldsClient({
  venueId,
  venueName,
  initialFields,
}: Readonly<{
  venueId: string;
  venueName: string;
  initialFields: OwnerField[];
}>) {
  const { getToken } = useAuth();
  const [fields, setFields] = useState(initialFields);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<OwnerField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null);

  async function refreshFields() {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Không thể tải danh sách field khi chưa có access token.",
      });
      return;
    }

    try {
      const nextFields = await getVenueFields(token, venueId);
      setFields(nextFields);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Tải field thất bại",
        description: error instanceof Error ? error.message : "Không thể tải danh sách field.",
      });
    }
  }

  async function handleSubmit(payload: CreateFieldPayload) {
    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để lưu field.",
      });
      return;
    }

    setSubmitting(true);

    try {
      if (editingField) {
        await updateVenueField(token, editingField.id, payload);
      } else {
        await createVenueField(token, venueId, payload);
      }

      toast({
        title: editingField ? "Đã cập nhật field" : "Đã tạo field mới",
        description: "Danh sách field đã được làm mới.",
      });
      setDialogOpen(false);
      setEditingField(null);
      await refreshFields();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Lưu field thất bại",
        description: error instanceof Error ? error.message : "Không thể lưu field.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(field: OwnerField) {
    if (!window.confirm(`Xoá field "${field.name}" khỏi sân này?`)) {
      return;
    }

    const token = await getToken();
    if (!token) {
      toast({
        variant: "destructive",
        title: "Thiếu phiên đăng nhập",
        description: "Vui lòng đăng nhập lại để xoá field.",
      });
      return;
    }

    setDeletingFieldId(field.id);

    try {
      await deleteVenueField(token, field.id);
      toast({
        title: "Đã xoá field",
        description: "Field đã được xoá khỏi danh sách quản lý.",
      });
      await refreshFields();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Xoá field thất bại",
        description: error instanceof Error ? error.message : "Không thể xoá field.",
      });
    } finally {
      setDeletingFieldId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">{venueName}</h2>
          <p className="mt-1 text-sm text-slate-600">Tạo, sửa hoặc xoá field trực tiếp trong owner dashboard.</p>
        </div>
        <Button
          onClick={() => {
            setEditingField(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm field
        </Button>
      </div>

      <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Tên field</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Giá/giờ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-slate-500">
                    Sân này chưa có field nào. Hãy tạo field đầu tiên.
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div className="font-medium text-slate-950">{field.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{field.slotCount} ca đã cấu hình</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-950">{formatSportTypeLabel(field.sportType)}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatFieldSizeLabel(field.size)}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">Theo từng slot</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          field.isActive
                            ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-50"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                        }
                      >
                        {field.isActive ? "Đang hoạt động" : "Đã tắt"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingField(field);
                            setDialogOpen(true);
                          }}
                        >
                          <PencilLine className="h-4 w-4" />
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={deletingFieldId === field.id}
                          onClick={() => handleDelete(field)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Xoá
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField ? "Chỉnh sửa field" : "Tạo field mới"}</DialogTitle>
            <DialogDescription>
              {editingField
                ? "Cập nhật tên, loại hình và kích thước của field."
                : "Thêm một field mới để chủ sân bắt đầu cấu hình lịch và giá slot."}
            </DialogDescription>
          </DialogHeader>

          <FieldForm
            field={editingField}
            submitting={submitting}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
