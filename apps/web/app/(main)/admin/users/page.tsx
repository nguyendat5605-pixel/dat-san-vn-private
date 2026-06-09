import { auth } from "@clerk/nextjs/server";
import { SectionHeading } from "@/components/common/section-heading";
import { UsersTable } from "@/components/admin/users-table";
import { getAdminUsers } from "@/lib/admin-api";

export default async function AdminUsersPage() {
  const authObject = await auth();
  const token = await authObject.getToken();

  if (!token) {
    return null;
  }

  const usersData = await getAdminUsers(token, 1, 100).catch(() => ({
    items: [],
    meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
  }));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="User Management"
        title="Quản lý người dùng"
        description="Xem danh sách, phân quyền và quản lý tất cả người dùng trong hệ thống."
      />

      <UsersTable users={usersData.items} token={token} />
    </div>
  );
}
