"use client";

import { useEffect } from "react";
import type { CreateFieldPayload, FieldSize, SportType } from "@dat-san-vn/types";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OwnerField } from "@/lib/owner-api";

interface FieldFormValues {
  name: string;
  sportType: SportType;
  size: FieldSize;
}

const sportTypes: Array<{ value: SportType; label: string }> = [
  { value: "FOOTBALL", label: "Bóng đá" },
  { value: "BADMINTON", label: "Cầu lông" },
  { value: "TENNIS", label: "Tennis" },
  { value: "BASKETBALL", label: "Bóng rổ" },
  { value: "VOLLEYBALL", label: "Bóng chuyền" },
  { value: "TABLE_TENNIS", label: "Bóng bàn" },
  { value: "PICKLEBALL", label: "Pickleball" },
];

const fieldSizes: Array<{ value: FieldSize; label: string }> = [
  { value: "FIELD_5", label: "Sân 5" },
  { value: "FIELD_7", label: "Sân 7" },
  { value: "FIELD_11", label: "Sân 11" },
  { value: "OTHER", label: "Khác" },
];

export function FieldForm({
  field,
  submitting = false,
  onSubmit,
  onCancel,
}: Readonly<{
  field?: OwnerField | null;
  submitting?: boolean;
  onSubmit: (payload: CreateFieldPayload) => void | Promise<void>;
  onCancel?: () => void;
}>) {
  const form = useForm<FieldFormValues>({
    defaultValues: {
      name: "",
      sportType: "FOOTBALL",
      size: "FIELD_7",
    },
  });

  useEffect(() => {
    form.reset({
      name: field?.name ?? "",
      sportType: field?.sportType ?? "FOOTBALL",
      size: field?.size ?? "FIELD_7",
    });
  }, [field, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      name: values.name.trim(),
      sportType: values.sportType,
      size: values.size,
    } satisfies CreateFieldPayload);
  });

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="field-name">Tên sân con</Label>
        <Input id="field-name" placeholder="Sân 1" {...form.register("name", { required: true })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="field-sport-type">Loại hình</Label>
          <select
            id="field-sport-type"
            className="h-11 rounded-[24px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
            {...form.register("sportType")}
          >
            {sportTypes.map((sportType) => (
              <option key={sportType.value} value={sportType.value}>
                {sportType.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="field-size">Kích thước</Label>
          <select
            id="field-size"
            className="h-11 rounded-[24px] border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
            {...form.register("size")}
          >
            {fieldSizes.map((fieldSize) => (
              <option key={fieldSize.value} value={fieldSize.value}>
                {fieldSize.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Đóng
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : field ? "Lưu thay đổi" : "Tạo field"}
        </Button>
      </div>
    </form>
  );
}
