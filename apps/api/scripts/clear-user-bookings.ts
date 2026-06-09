import { prisma } from './config';

async function main() {
  // Get userId from command line argument
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Please provide a userId.');
    console.log('Usage: pnpm clear:user-bookings <userId>');
    console.log('Example: pnpm clear:user-bookings user_2jW3Q...');
    process.exit(1);
  }

  console.warn(
    `⚠️ WARNING: You are about to delete ALL bookings for user: ${userId}`,
  );

  // Wait for 2 seconds so user can cancel if needed
  console.log('Starting in 2 seconds... (Press Ctrl+C to cancel)');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const result = await prisma.booking.deleteMany({
      where: {
        userId: userId,
      },
    });
    console.log(
      `✅ Successfully deleted ${result.count} bookings for user ${userId}.`,
    );
  } catch (error) {
    console.error(`❌ Error deleting bookings for user ${userId}:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
