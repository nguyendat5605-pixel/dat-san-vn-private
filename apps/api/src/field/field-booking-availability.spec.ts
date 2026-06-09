import { FieldService } from './field.service';

describe('FieldService booking slot availability guards', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2026-06-09T10:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not list past slots for today', async () => {
    const prisma = {
      field: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'field-1',
          venueId: 'venue-1',
          isActive: true,
          version: 1,
        }),
      },
      venueSlot: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'past-slot',
            date: new Date('2026-06-09T00:00:00.000Z'),
            startTime: new Date('1970-01-01T09:00:00.000Z'),
          },
          {
            id: 'future-slot',
            date: new Date('2026-06-09T00:00:00.000Z'),
            startTime: new Date('1970-01-01T11:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new FieldService(prisma as never, {} as never);

    const response = await service.getAvailableSlots('field-1', '2026-06-09');

    expect(response.data).toEqual([
      expect.objectContaining({ id: 'future-slot' }),
    ]);
  });
});
