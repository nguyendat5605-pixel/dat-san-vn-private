import { createClerkClient } from '@clerk/backend';
import { UserRole } from '@prisma/client';
import { prisma } from './config';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env
dotenv.config({ path: join(process.cwd(), '.env') });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error('CLERK_SECRET_KEY is missing in .env');

const clerk = createClerkClient({ secretKey });

const usersToCreate = [
  { email: 'admin@test.com', firstName: 'Admin', lastName: 'Test', role: UserRole.ADMIN },
  { email: 'owner@test.com', firstName: 'Owner', lastName: 'Test', role: UserRole.OWNER },
  { email: 'user@test.com', firstName: 'User', lastName: 'Test', role: UserRole.PLAYER },
];

const STRONG_PASSWORD = 'DatSanVN@Test2026_Secure!';

async function main() {
  console.log('🚀 Starting test accounts creation...');
  
  // Kiểm tra kết nối Database trước khi chạy
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful.');
  } catch (error) {
    console.error('❌ LỖI: Không thể kết nối tới Database (PostgreSQL).');
    console.error('Vui lòng đảm bảo Docker container của Database đang chạy (ví dụ: docker-compose up -d) trước khi chạy script này.');
    process.exit(1);
  }

  for (const u of usersToCreate) {
    try {
      // 1. Check if user exists in Clerk
      const existingRes = await clerk.users.getUserList({ emailAddress: [u.email] });
      const existingUsers = Array.isArray(existingRes) ? existingRes : existingRes?.data;
      
      let clerkUserId: string;

      if (existingUsers && existingUsers.length > 0) {
        console.log(`⏳ User ${u.email} already exists. Deleting to recreate...`);
        await clerk.users.deleteUser(existingUsers[0].id);
      }

      // 2. Create in Clerk with a strong password and skip checks
      console.log(`⏳ Creating ${u.email} in Clerk...`);
      const created = await clerk.users.createUser({
        emailAddress: [u.email],
        password: STRONG_PASSWORD,
        firstName: u.firstName,
        lastName: u.lastName,
        skipPasswordChecks: true,
      });
      clerkUserId = created.id;
      console.log(`✅ Created ${u.email} in Clerk with ID: ${clerkUserId}`);

      // 3. Upsert in local database to ensure role is correct
      const dbUser = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          clerkId: clerkUserId,
          role: u.role,
          fullName: `${u.firstName} ${u.lastName}`,
        },
        create: {
          email: u.email,
          clerkId: clerkUserId,
          role: u.role,
          fullName: `${u.firstName} ${u.lastName}`,
        }
      });
      console.log(`✅ Upserted ${u.email} in DB with role ${dbUser.role}`);
    } catch (error) {
      console.error(`❌ Error processing ${u.email}:`, error);
    }
  }

  console.log('\n🎉 Finished setting up test accounts!');
  console.log(`🔑 Mật khẩu chung cho tất cả tài khoản là: ${STRONG_PASSWORD}`);
  console.log('💡 Lưu ý: Các tài khoản tạo qua API này có thể Đăng nhập (Sign In) trực tiếp bằng mật khẩu.');
  console.log('======================================================');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
