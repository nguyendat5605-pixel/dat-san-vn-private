/**
 * Fix script: Link owner@test.com to demo venues via VenueOwner junction table.
 * Run: npx tsx scripts/fix-owner-venue-link.ts
 */
import 'dotenv/config';
import { PrismaClient, VenueOwnerStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
  log: ['warn', 'error'],
});

async function main() {
  // 1. Find the real owner@test.com user (has clerkId)
  const ownerUser = await prisma.user.findUnique({
    where: { email: 'owner@test.com' },
    select: { id: true, email: true, clerkId: true, role: true },
  });

  if (!ownerUser) {
    console.error('owner@test.com not found in DB');
    return;
  }

  console.log('[FixOwner] Found owner@test.com:', {
    id: ownerUser.id,
    clerkId: ownerUser.clerkId,
    role: ownerUser.role,
  });

  // 2. Find all demo venues
  const demoVenues = await prisma.venue.findMany({
    where: {
      name: { startsWith: 'DatSanVN Demo' },
      deletedAt: null,
    },
    select: { id: true, name: true },
  });

  console.log(`[FixOwner] Found ${demoVenues.length} demo venues`);

  // 3. Upsert VenueOwner for each venue
  for (const venue of demoVenues) {
    const result = await prisma.venueOwner.upsert({
      where: {
        userId_venueId: {
          userId: ownerUser.id,
          venueId: venue.id,
        },
      },
      update: {
        status: VenueOwnerStatus.APPROVED,
      },
      create: {
        userId: ownerUser.id,
        venueId: venue.id,
        status: VenueOwnerStatus.APPROVED,
      },
    });

    console.log(`[FixOwner] Upserted VenueOwner: ${ownerUser.email} → ${venue.name} (status: ${result.status})`);
  }

  // 4. Verify
  const venueOwners = await prisma.venueOwner.findMany({
    where: { userId: ownerUser.id },
    include: {
      venue: { select: { id: true, name: true } },
    },
  });

  console.log('\n[FixOwner] Verification — VenueOwner records for owner@test.com:');
  for (const vo of venueOwners) {
    console.log(`  ${vo.venue.name} — status: ${vo.status}`);
  }

  console.log('\n[FixOwner] Done. Owner should now see bookings for these venues.');
}

main()
  .catch((error) => {
    console.error('Fix script failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
