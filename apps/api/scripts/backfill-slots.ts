import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SlotGenerationService } from '../src/slots/slot-generation.service.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
  log: ['warn', 'error'],
});

async function main() {
  const venues = await prisma.venue.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: { select: { fields: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const generator = new SlotGenerationService(prisma as any);
  let totalFields = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  console.log(`Backfilling slots for ${venues.length} approved venues...`);

  for (const venue of venues) {
    const result = await generator.generateForVenue(venue.id);
    totalFields += result.fieldCount;
    totalCreated += result.created;
    totalSkipped += result.skipped;

    console.log(
      `${venue.name}: fields=${result.fieldCount}, created=${result.created}, skipped=${result.skipped}`,
    );
  }

  console.log('');
  console.log('Slot backfill summary');
  console.log(`Venues:  ${venues.length}`);
  console.log(`Fields:  ${totalFields}`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped: ${totalSkipped}`);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'Slot backfill failed.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

