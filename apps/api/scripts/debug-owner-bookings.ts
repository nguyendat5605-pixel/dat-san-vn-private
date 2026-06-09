/**
 * Debug script: Inspect DB state for owner bookings issue.
 * Run: npx tsx apps/api/scripts/debug-owner-bookings.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
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
  console.log('\n========================================');
  console.log('1. LATEST BOOKING');
  console.log('========================================');

  const latestBooking = await prisma.booking.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      venue: { select: { id: true, name: true } },
      user: { select: { id: true, email: true, role: true } },
      payment: {
        include: {
          attempts: {
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      },
      bookingSlots: {
        include: {
          venueSlot: {
            include: {
              field: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (latestBooking) {
    console.log(JSON.stringify({
      bookingId: latestBooking.id,
      status: latestBooking.status,
      venueId: latestBooking.venueId,
      venueName: latestBooking.venue.name,
      userId: latestBooking.userId,
      userEmail: latestBooking.user.email,
      userRole: latestBooking.user.role,
      totalPrice: Number(latestBooking.totalPrice),
      createdAt: latestBooking.createdAt,
      expiresAt: latestBooking.expiresAt,
      paymentExists: !!latestBooking.payment,
      paymentStatus: latestBooking.payment?.status ?? null,
      paymentProvider: latestBooking.payment?.provider ?? null,
      paymentMethod: latestBooking.payment?.method ?? null,
      paymentAttempts: latestBooking.payment?.attempts?.map(a => ({
        id: a.id,
        provider: a.provider,
        status: a.status,
        amount: Number(a.amount),
        providerOrderId: a.providerOrderId,
      })) ?? [],
      slots: latestBooking.bookingSlots.map(bs => ({
        slotId: bs.venueSlot.id,
        fieldId: bs.venueSlot.fieldId,
        fieldName: bs.venueSlot.field.name,
        date: bs.venueSlot.date,
        startTime: bs.venueSlot.startTime,
        endTime: bs.venueSlot.endTime,
        slotStatus: bs.venueSlot.status,
      })),
    }, null, 2));
  } else {
    console.log('NO BOOKINGS IN DATABASE');
  }

  console.log('\n========================================');
  console.log('2. OWNER USER: owner@test.com');
  console.log('========================================');

  const ownerUser = await prisma.user.findUnique({
    where: { email: 'owner@test.com' },
  });

  if (ownerUser) {
    console.log(JSON.stringify({
      id: ownerUser.id,
      clerkId: ownerUser.clerkId,
      email: ownerUser.email,
      fullName: ownerUser.fullName,
      role: ownerUser.role,
      isActive: ownerUser.isActive,
    }, null, 2));
  } else {
    console.log('owner@test.com NOT FOUND in DB');
  }

  console.log('\n========================================');
  console.log('3. ALL OWNER USERS (role=OWNER)');
  console.log('========================================');

  const allOwners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: { id: true, clerkId: true, email: true, fullName: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(JSON.stringify(allOwners, null, 2));

  console.log('\n========================================');
  console.log('4. VENUE: DatSanVN Demo City Sports Hub');
  console.log('========================================');

  const venue = await prisma.venue.findFirst({
    where: { name: 'DatSanVN Demo City Sports Hub' },
    include: {
      owners: {
        include: {
          user: { select: { id: true, email: true, role: true, clerkId: true } },
        },
      },
      fields: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (venue) {
    console.log(JSON.stringify({
      venueId: venue.id,
      name: venue.name,
      isActive: venue.isActive,
      ownerRecords: venue.owners.map(o => ({
        venueOwnerId: o.id,
        userId: o.userId,
        userEmail: o.user.email,
        userClerkId: o.user.clerkId,
        userRole: o.user.role,
        ownershipStatus: o.status,
      })),
      fields: venue.fields,
    }, null, 2));
  } else {
    console.log('VENUE NOT FOUND');
  }

  console.log('\n========================================');
  console.log('5. ALL VENUE OWNERS (junction table)');
  console.log('========================================');

  const allVenueOwners = await prisma.venueOwner.findMany({
    include: {
      user: { select: { id: true, email: true, role: true, clerkId: true } },
      venue: { select: { id: true, name: true } },
    },
  });
  console.log(JSON.stringify(allVenueOwners.map(vo => ({
    venueOwnerRecordId: vo.id,
    userId: vo.userId,
    userEmail: vo.user.email,
    userClerkId: vo.user.clerkId,
    venueId: vo.venueId,
    venueName: vo.venue.name,
    status: vo.status,
  })), null, 2));

  console.log('\n========================================');
  console.log('6. OWNERSHIP MATCH CHECK');
  console.log('========================================');

  if (ownerUser && venue) {
    const matchingOwnership = venue.owners.find(o => o.userId === ownerUser.id);
    console.log(JSON.stringify({
      ownerDbId: ownerUser.id,
      ownerClerkId: ownerUser.clerkId,
      venueId: venue.id,
      venueHasOwnerMatch: !!matchingOwnership,
      matchingOwnershipStatus: matchingOwnership?.status ?? 'NO_MATCH',
      allVenueOwnerUserIds: venue.owners.map(o => o.userId),
    }, null, 2));

    if (!matchingOwnership) {
      console.log('\n*** MISMATCH DETECTED ***');
      console.log(`owner@test.com DB id = ${ownerUser.id}`);
      console.log(`Venue owner user IDs = ${venue.owners.map(o => `${o.userId} (${o.user.email})`).join(', ')}`);
    }
  }

  console.log('\n========================================');
  console.log('7. ALL BOOKINGS FOR THIS VENUE');
  console.log('========================================');

  if (venue) {
    const venueBookings = await prisma.booking.findMany({
      where: { venueId: venue.id },
      include: {
        user: { select: { email: true } },
        payment: { select: { status: true, provider: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(JSON.stringify(venueBookings.map(b => ({
      id: b.id,
      status: b.status,
      userId: b.userId,
      userEmail: b.user.email,
      venueId: b.venueId,
      totalPrice: Number(b.totalPrice),
      paymentStatus: b.payment?.status ?? null,
      paymentProvider: b.payment?.provider ?? null,
      paymentMethod: b.payment?.method ?? null,
      createdAt: b.createdAt,
    })), null, 2));
  }

  console.log('\n========================================');
  console.log('8. TOTAL COUNTS');
  console.log('========================================');

  const counts = {
    users: await prisma.user.count(),
    venues: await prisma.venue.count(),
    venueOwners: await prisma.venueOwner.count(),
    fields: await prisma.field.count(),
    venueSlots: await prisma.venueSlot.count(),
    bookings: await prisma.booking.count(),
    payments: await prisma.payment.count(),
    paymentAttempts: await prisma.paymentAttempt.count(),
  };
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error('Debug script failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
