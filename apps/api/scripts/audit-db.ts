// apps/api/scripts/audit-db.ts
// READ-ONLY database audit script — no writes, no deletes
import { prisma } from './config';

async function audit() {
  console.log('=== DATABASE AUDIT (READ-ONLY) ===\n');

  // 1. Connection test
  try {
    const result = await prisma.$queryRaw<any[]>`SELECT 1 as ok`;
    console.log('✅ Database connection: OK');
  } catch (e: any) {
    console.error('❌ Database connection FAILED:', e.message);
    process.exit(1);
  }

  // 2. List tables
  try {
    const tables = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log('\n📋 Tables in public schema:');
    for (const t of tables) {
      console.log(`  - ${t.table_name}`);
    }
  } catch (e: any) {
    console.error('❌ Failed to list tables:', e.message);
  }

  // 3. Count records per model
  console.log('\n📊 Record counts:');
  try {
    const [users, venues, fields, venueOwners, venueSlots, bookings, bookingSlots, payments, paymentAttempts, webhookEvents, reviews, venueStaff] = await Promise.all([
      prisma.user.count(),
      prisma.venue.count(),
      prisma.field.count(),
      prisma.venueOwner.count(),
      prisma.venueSlot.count(),
      prisma.booking.count(),
      prisma.bookingSlot.count(),
      prisma.payment.count(),
      prisma.paymentAttempt.count(),
      prisma.paymentWebhookEvent.count(),
      prisma.review.count(),
      prisma.venueStaff.count(),
    ]);
    console.log(`  User:                ${users}`);
    console.log(`  Venue:               ${venues}`);
    console.log(`  Field:               ${fields}`);
    console.log(`  VenueOwner:          ${venueOwners}`);
    console.log(`  VenueSlot:           ${venueSlots}`);
    console.log(`  Booking:             ${bookings}`);
    console.log(`  BookingSlot:         ${bookingSlots}`);
    console.log(`  Payment:             ${payments}`);
    console.log(`  PaymentAttempt:      ${paymentAttempts}`);
    console.log(`  PaymentWebhookEvent: ${webhookEvents}`);
    console.log(`  Review:              ${reviews}`);
    console.log(`  VenueStaff:          ${venueStaff}`);
  } catch (e: any) {
    console.error('❌ Count failed:', e.message);
  }

  // 4. Venue breakdown: isActive + deletedAt
  console.log('\n🏟️ Venue status breakdown:');
  try {
    const activeVenues = await prisma.venue.count({ where: { isActive: true, deletedAt: null } });
    const inactiveVenues = await prisma.venue.count({ where: { isActive: false, deletedAt: null } });
    const deletedVenues = await prisma.venue.count({ where: { deletedAt: { not: null } } });
    console.log(`  Active (public):     ${activeVenues}`);
    console.log(`  Inactive (pending):  ${inactiveVenues}`);
    console.log(`  Soft-deleted:        ${deletedVenues}`);
  } catch (e: any) {
    console.error('❌ Venue breakdown failed:', e.message);
  }

  // 5. Sample venues (masked)
  console.log('\n📝 Sample venues (up to 5):');
  try {
    const venues = await prisma.venue.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        city: true,
        district: true,
        isActive: true,
        deletedAt: true,
        rating: true,
        avgRating: true,
        reviewCount: true,
        version: true,
        createdAt: true,
        _count: { select: { fields: true, bookings: true, owners: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const v of venues) {
      console.log(`  [${v.id.substring(0, 8)}...] "${v.name}" — ${v.city}/${v.district} | active=${v.isActive} | deleted=${!!v.deletedAt} | rating=${v.rating} | fields=${v._count.fields} | bookings=${v._count.bookings} | owners=${v._count.owners}`);
    }
  } catch (e: any) {
    console.error('❌ Sample venues failed:', e.message);
  }

  // 6. Sample fields
  console.log('\n⚽ Sample fields (up to 5):');
  try {
    const fields = await prisma.field.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        sportType: true,
        size: true,
        isActive: true,
        venueId: true,
        _count: { select: { slots: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const f of fields) {
      console.log(`  [${f.id.substring(0, 8)}...] "${f.name}" — sport=${f.sportType} size=${f.size} active=${f.isActive} slots=${f._count.slots} venueId=${f.venueId.substring(0, 8)}...`);
    }
  } catch (e: any) {
    console.error('❌ Sample fields failed:', e.message);
  }

  // 7. VenueSlot breakdown
  console.log('\n🕐 VenueSlot status breakdown:');
  try {
    const available = await prisma.venueSlot.count({ where: { status: 'AVAILABLE' } });
    const locked = await prisma.venueSlot.count({ where: { status: 'LOCKED' } });
    const booked = await prisma.venueSlot.count({ where: { status: 'BOOKED' } });
    console.log(`  AVAILABLE: ${available}`);
    console.log(`  LOCKED:    ${locked}`);
    console.log(`  BOOKED:    ${booked}`);
  } catch (e: any) {
    console.error('❌ Slot breakdown failed:', e.message);
  }

  // 8. Sample users (masked)
  console.log('\n👤 Sample users (up to 5, email masked):');
  try {
    const users = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        clerkId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    for (const u of users) {
      const maskedEmail = u.email.replace(/(.{2}).+(@.+)/, '$1****$2');
      const maskedClerk = u.clerkId ? `${u.clerkId.substring(0, 8)}...` : 'null';
      console.log(`  [${u.id.substring(0, 8)}...] ${maskedEmail} — role=${u.role} active=${u.isActive} clerkId=${maskedClerk}`);
    }
  } catch (e: any) {
    console.error('❌ Sample users failed:', e.message);
  }

  // 9. VenueOwner status breakdown
  console.log('\n🏠 VenueOwner status breakdown:');
  try {
    const pending = await prisma.venueOwner.count({ where: { status: 'PENDING' } });
    const approved = await prisma.venueOwner.count({ where: { status: 'APPROVED' } });
    const rejected = await prisma.venueOwner.count({ where: { status: 'REJECTED' } });
    console.log(`  PENDING:   ${pending}`);
    console.log(`  APPROVED:  ${approved}`);
    console.log(`  REJECTED:  ${rejected}`);
  } catch (e: any) {
    console.error('❌ VenueOwner breakdown failed:', e.message);
  }

  // 10. Booking status breakdown
  console.log('\n📅 Booking status breakdown:');
  try {
    const bPending = await prisma.booking.count({ where: { status: 'PENDING' } });
    const bConfirmed = await prisma.booking.count({ where: { status: 'CONFIRMED' } });
    const bCompleted = await prisma.booking.count({ where: { status: 'COMPLETED' } });
    const bCancelled = await prisma.booking.count({ where: { status: 'CANCELLED' } });
    console.log(`  PENDING:   ${bPending}`);
    console.log(`  CONFIRMED: ${bConfirmed}`);
    console.log(`  COMPLETED: ${bCompleted}`);
    console.log(`  CANCELLED: ${bCancelled}`);
  } catch (e: any) {
    console.error('❌ Booking breakdown failed:', e.message);
  }

  // 11. _prisma_migrations table
  console.log('\n🔄 Applied migrations:');
  try {
    const migrations = await prisma.$queryRaw<any[]>`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      ORDER BY finished_at ASC
    `;
    for (const m of migrations) {
      console.log(`  ✅ ${m.migration_name} — ${m.finished_at}`);
    }
  } catch (e: any) {
    console.error('❌ Migration table read failed:', e.message);
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

audit()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
