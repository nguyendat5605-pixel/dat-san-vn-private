import 'dotenv/config';

import {
  FieldSize,
  PrismaClient,
  SlotStatus,
  SportType,
  UserRole,
  VenueOwnerStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
  log: ['warn', 'error'],
});

const DEMO_OWNER_EMAIL = 'demo-owner@dat-san-vn.local';
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const SLOT_WINDOW_START_HOUR = 6;
const SLOT_WINDOW_END_HOUR = 22;

type DemoFieldInput = {
  name: string;
  sportType: SportType;
  size: FieldSize;
  pricePerSlot: number;
};

type DemoVenueInput = {
  name: string;
  description: string;
  address: string;
  district: string;
  city: string;
  pricePerHour: number;
  images: string[];
  amenities: string[];
  fields: DemoFieldInput[];
};

const demoVenues: DemoVenueInput[] = [
  {
    name: 'DatSanVN Demo Riverside Arena',
    description:
      'Demo football venue with evening lighting, parking, and changing rooms.',
    address: '12 Ben Van Don',
    district: 'Quan 4',
    city: 'TP.HCM',
    pricePerHour: 520000,
    images: [
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: ['Parking', 'Changing room', 'Cafe', 'Drinking water'],
    fields: [
      {
        name: 'Field 5A',
        sportType: SportType.FOOTBALL,
        size: FieldSize.FIELD_5,
        pricePerSlot: 420000,
      },
      {
        name: 'Field 7A',
        sportType: SportType.FOOTBALL,
        size: FieldSize.FIELD_7,
        pricePerSlot: 650000,
      },
    ],
  },
  {
    name: 'DatSanVN Demo City Sports Hub',
    description:
      'Demo sports hub near the city center for after-work football bookings.',
    address: '88 Nguyen Thi Minh Khai',
    district: 'Quan 3',
    city: 'TP.HCM',
    pricePerHour: 500000,
    images: [
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1200&q=80',
    ],
    amenities: ['Motorbike parking', 'Bib rental', 'Cold drinks'],
    fields: [
      {
        name: 'Field 5 Premium',
        sportType: SportType.FOOTBALL,
        size: FieldSize.FIELD_5,
        pricePerSlot: 390000,
      },
      {
        name: 'Field 7 Center',
        sportType: SportType.FOOTBALL,
        size: FieldSize.FIELD_7,
        pricePerSlot: 620000,
      },
    ],
  },
];

const stats = {
  owner: { created: 0, reused: 0 },
  venues: { created: 0, reused: 0 },
  fields: { created: 0, reused: 0 },
  slots: { created: 0, reused: 0 },
};

function getVietnamDateStrings(days: number) {
  const vietnamNow = new Date(Date.now() + VIETNAM_UTC_OFFSET_MS);
  const baseUtcMs = Date.UTC(
    vietnamNow.getUTCFullYear(),
    vietnamNow.getUTCMonth(),
    vietnamNow.getUTCDate(),
  );

  return Array.from({ length: days }, (_, index) =>
    new Date(baseUtcMs + index * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  );
}

function dateOnly(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function timeOnly(hour: number) {
  return new Date(Date.UTC(1970, 0, 1, hour, 0, 0, 0));
}

async function getOrCreateOwner() {
  // Prefer an OWNER who has already been synced from Clerk (has clerkId).
  // This prevents the mismatch where the demo-owner user owns venues but
  // owner@test.com (the real Clerk user) cannot see bookings.
  const clerkOwner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER, isActive: true, clerkId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (clerkOwner) {
    stats.owner.reused += 1;
    return clerkOwner;
  }

  const existingOwner = await prisma.user.findFirst({
    where: { role: UserRole.OWNER, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  if (existingOwner) {
    stats.owner.reused += 1;
    return existingOwner;
  }

  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: {
      fullName: 'DatSanVN Demo Owner',
      role: UserRole.OWNER,
      isActive: true,
    },
    create: {
      email: DEMO_OWNER_EMAIL,
      fullName: 'DatSanVN Demo Owner',
      role: UserRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });

  stats.owner.created += 1;
  return owner;
}


async function getOrCreateVenue(ownerId: string, input: DemoVenueInput) {
  const existing = await prisma.venue.findFirst({
    where: {
      name: input.name,
      address: input.address,
      deletedAt: null,
    },
    select: { id: true, isActive: true },
  });

  if (existing) {
    stats.venues.reused += 1;

    if (!existing.isActive) {
      await prisma.venue.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }

    await prisma.venueOwner.upsert({
      where: { userId_venueId: { userId: ownerId, venueId: existing.id } },
      update: { status: VenueOwnerStatus.APPROVED },
      create: {
        userId: ownerId,
        venueId: existing.id,
        status: VenueOwnerStatus.APPROVED,
      },
    });

    return existing;
  }

  const venue = await prisma.venue.create({
    data: {
      name: input.name,
      description: input.description,
      address: input.address,
      district: input.district,
      city: input.city,
      images: input.images,
      amenities: input.amenities,
      pricePerHour: input.pricePerHour,
      isActive: true,
      owners: {
        create: {
          userId: ownerId,
          status: VenueOwnerStatus.APPROVED,
        },
      },
    },
    select: { id: true },
  });

  stats.venues.created += 1;
  return venue;
}

async function getOrCreateField(venueId: string, input: DemoFieldInput) {
  const existing = await prisma.field.findFirst({
    where: { venueId, name: input.name },
    select: { id: true, isActive: true },
  });

  if (existing) {
    stats.fields.reused += 1;

    if (!existing.isActive) {
      await prisma.field.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }

    return existing;
  }

  const field = await prisma.field.create({
    data: {
      venueId,
      name: input.name,
      sportType: input.sportType,
      size: input.size,
      isActive: true,
    },
    select: { id: true },
  });

  stats.fields.created += 1;
  return field;
}

async function getOrCreateSlots(fieldId: string, pricePerSlot: number) {
  const dateStrings = getVietnamDateStrings(7);

  for (const dateString of dateStrings) {
    const date = dateOnly(dateString);

    for (
      let hour = SLOT_WINDOW_START_HOUR;
      hour < SLOT_WINDOW_END_HOUR;
      hour += 1
    ) {
      const startTime = timeOnly(hour);
      const endTime = timeOnly(hour + 1);

      const existing = await prisma.venueSlot.findFirst({
        where: {
          fieldId,
          date,
          startTime,
        },
        select: { id: true },
      });

      if (existing) {
        stats.slots.reused += 1;
        continue;
      }

      await prisma.venueSlot.create({
        data: {
          fieldId,
          date,
          startTime,
          endTime,
          pricePerSlot,
          status: SlotStatus.AVAILABLE,
        },
      });

      stats.slots.created += 1;
    }
  }
}

async function main() {
  console.log('Seeding DatSanVN demo data...');

  const owner = await getOrCreateOwner();

  for (const venueInput of demoVenues) {
    const venue = await getOrCreateVenue(owner.id, venueInput);

    for (const fieldInput of venueInput.fields) {
      const field = await getOrCreateField(venue.id, fieldInput);
      await getOrCreateSlots(field.id, fieldInput.pricePerSlot);
    }
  }

  const totalSlots = await prisma.venueSlot.count();
  const availableSlots = await prisma.venueSlot.count({
    where: { status: SlotStatus.AVAILABLE },
  });

  console.log('');
  console.log('Demo seed summary');
  console.log(
    `Owner:  created ${stats.owner.created}, reused ${stats.owner.reused}`,
  );
  console.log(
    `Venues: created ${stats.venues.created}, reused ${stats.venues.reused}`,
  );
  console.log(
    `Fields: created ${stats.fields.created}, reused ${stats.fields.reused}`,
  );
  console.log(
    `Slots:  created ${stats.slots.created}, reused ${stats.slots.reused}`,
  );
  console.log(`Slot totals: ${totalSlots} total, ${availableSlots} available`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
