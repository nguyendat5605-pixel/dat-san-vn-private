import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

type RoomJoinPayload = {
  venueId?: string;
  fieldId?: string;
  userId?: string;
  ownerId?: string;
};

type RealtimeRoomPayload = {
  venueId?: string;
  fieldId?: string | null;
  userId?: string | null;
  ownerIds?: string[];
};

export type BookingRealtimePayload = RealtimeRoomPayload & {
  bookingId: string;
  status: string;
  totalPrice?: number;
  expiresAt?: Date | string | null;
  updatedAt?: Date | string;
};

export type SlotRealtimePayload = RealtimeRoomPayload & {
  bookingId?: string;
  slotId: string;
  status: string;
  updatedAt?: Date | string;
};

export type PaymentRealtimePayload = RealtimeRoomPayload & {
  bookingId: string;
  paymentId: string;
  attemptId?: string;
  status: string;
  provider: string;
  paidAt?: Date | string | null;
  updatedAt?: Date | string;
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Realtime client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Realtime client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinVenue')
  joinVenue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomJoinPayload,
  ) {
    return this.joinRoom(client, 'venue', payload.venueId);
  }

  @SubscribeMessage('joinField')
  joinField(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomJoinPayload,
  ) {
    return this.joinRoom(client, 'field', payload.fieldId);
  }

  @SubscribeMessage('joinUser')
  joinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomJoinPayload,
  ) {
    return this.joinRoom(client, 'user', payload.userId);
  }

  @SubscribeMessage('joinOwner')
  joinOwner(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RoomJoinPayload,
  ) {
    return this.joinRoom(client, 'owner', payload.ownerId);
  }

  emitBookingCreated(payload: BookingRealtimePayload) {
    this.emitToRooms('booking.created', payload);
  }

  emitSlotLocked(payload: SlotRealtimePayload) {
    this.emitToRooms('slot.locked', payload);
  }

  emitPaymentPaid(payload: PaymentRealtimePayload) {
    this.emitToRooms('payment.paid', payload);
  }

  emitBookingConfirmed(payload: BookingRealtimePayload) {
    this.emitToRooms('booking.confirmed', payload);
  }

  emitSlotBooked(payload: SlotRealtimePayload) {
    this.emitToRooms('slot.booked', payload);
  }

  emitBookingCancelled(payload: BookingRealtimePayload) {
    this.emitToRooms('booking.cancelled', payload);
  }

  emitSlotReleased(payload: SlotRealtimePayload) {
    this.emitToRooms('slot.released', payload);
  }

  private joinRoom(client: Socket, prefix: string, id?: string) {
    if (!this.isNonEmptyString(id)) {
      return { ok: false, error: `Missing ${prefix} id` };
    }

    const room = `${prefix}:${id}`;
    void client.join(room);
    this.logger.log(`join${this.capitalize(prefix)} ${room}`);
    return { ok: true, room };
  }

  private emitToRooms(event: string, payload: RealtimeRoomPayload) {
    if (!this.server) {
      return;
    }

    const rooms = this.resolveRooms(payload);
    if (rooms.length === 0) {
      this.server.emit(event, payload);
      return;
    }

    let target = this.server.to(rooms[0]);
    for (const room of rooms.slice(1)) {
      target = target.to(room);
    }

    target.emit(event, payload);
  }

  private resolveRooms(payload: RealtimeRoomPayload) {
    const rooms = new Set<string>();

    if (this.isNonEmptyString(payload.venueId)) {
      rooms.add(`venue:${payload.venueId}`);
    }

    if (this.isNonEmptyString(payload.fieldId)) {
      rooms.add(`field:${payload.fieldId}`);
    }

    if (this.isNonEmptyString(payload.userId)) {
      rooms.add(`user:${payload.userId}`);
    }

    for (const ownerId of payload.ownerIds ?? []) {
      if (this.isNonEmptyString(ownerId)) {
        rooms.add(`owner:${ownerId}`);
      }
    }

    return [...rooms];
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
