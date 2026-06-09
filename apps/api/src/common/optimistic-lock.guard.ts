import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const DEFAULT_OPTIMISTIC_LOCK_MESSAGE = 'Dữ liệu đã thay đổi, vui lòng thử lại';

export async function withOptimisticLock<T>(
  operation: () => Promise<T>,
  _version?: number,
  errorMessage = DEFAULT_OPTIMISTIC_LOCK_MESSAGE,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2025' || err.code === 'P2002')
    ) {
      throw new BadRequestException(errorMessage);
    }

    throw err;
  }
}

export function assertOptimisticUpdate(
  result: { count: number },
  errorMessage = DEFAULT_OPTIMISTIC_LOCK_MESSAGE,
) {
  if (result.count === 0) {
    throw new BadRequestException(errorMessage);
  }
}
