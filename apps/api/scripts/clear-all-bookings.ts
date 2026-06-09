import { prisma } from './config';

async function main() {
  console.warn(
    '⚠️ WARNING: You are about to delete ALL bookings from the database.',
  );
  console.warn('⚠️ This action cannot be undone.');

  // Wait for 3 seconds so user can cancel if needed
  console.log('Starting in 3 seconds... (Press Ctrl+C to cancel)');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    const result = await prisma.booking.deleteMany();
    console.log(`✅ Successfully deleted ${result.count} bookings.`);
  } catch (error) {
    console.error('❌ Error deleting bookings:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
