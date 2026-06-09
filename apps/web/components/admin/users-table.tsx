"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldAlert, ShieldCheck, Trash2, RotateCcw } from "lucide-react";
import type { AdminUser } from "@/lib/admin-api";
import type { UserRole } from "@dat-san-vn/types";
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

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "PLAYER", label: "Player" },
  { value: "OWNER", label: "Owner" },
  { value: "ADMIN", label: "Admin" },
];

function roleBadgeStyles(role: UserRole) {
  switch (role) {
    case "ADMIN":
      return "bg-indigo-50 text-indigo-700 hover:bg-indigo-50";
    case "OWNER":
      return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
    default:
      return "bg-slate-100 text-slate-600 hover:bg-slate-100";
  }
}

function RoleIcon({ role }: Readonly<{ role: UserRole }>) {
  switch (role) {
    case "ADMIN":
      return <ShieldAlert className="mr-1 h-3.5 w-3.5" />;
    case "OWNER":
      return <ShieldCheck className="mr-1 h-3.5 w-3.5" />;
    default:
      return <Shield className="mr-1 h-3.5 w-3.5" />;
  }
}

export function UsersTable({
  users,
  token,
}: Readonly<{
  users: AdminUser[];
  token: string;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setActionUserId(userId);
    try {
      const { updateUserRole } = await import("@/lib/admin-api");
      await updateUserRole(token, userId, newRole);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to update role:", error);
    } finally {
      setActionUserId(null);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Bạn chắc chắn muốn vô hiệu hoá người dùng này?")) return;
    setActionUserId(userId);
    try {
      const { deleteUser } = await import("@/lib/admin-api");
      await deleteUser(token, userId);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to delete user:", error);
    } finally {
      setActionUserId(null);
    }
  }

  async function handleActivate(userId: string) {
    setActionUserId(userId);
    try {
      const { activateUser } = await import("@/lib/admin-api");
      await activateUser(token, userId);
      startTransition(() => router.refresh());
    } catch (error) {
      console.error("Failed to activate user:", error);
    } finally {
      setActionUserId(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
        Chưa có người dùng nào trong hệ thống.
      </div>
    );
  }

  return (
    <Card className="border-white/70 bg-white/92 shadow-[0_18px_60px_rgba(16,34,22,0.08)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isLoading = isPending && actionUserId === user.id;

                return (
                  <TableRow key={user.id} className={isLoading ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-900">{user.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={roleBadgeStyles(user.role)}>
                        <RoleIcon role={user.role} />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.isActive ? "bg-green-50 text-green-700 hover:bg-green-50" : "bg-red-50 text-red-600 hover:bg-red-50"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                          value={user.role}
                          disabled={isLoading}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        >
                          {roleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {user.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isLoading}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                            onClick={() => handleDelete(user.id)}
                            title="Vô hiệu hoá"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isLoading}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600"
                            onClick={() => handleActivate(user.id)}
                            title="Kích hoạt lại"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
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
  );
}
