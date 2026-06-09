import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import type { Request, Response } from 'express';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { RawBody } from '../common/decorators/raw-body.decorator.js';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { CreatePaymentDto } from './dto/index.js';
import { PaymentService } from './payment.service.js';

@Controller('payments')
@UseGuards(ClerkAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentService.createPaymentForBooking(
      user.id,
      dto,
      idempotencyKey,
      this.getClientIp(request),
    );
  }

  @Get('booking/:bookingId/status')
  getBookingPaymentStatus(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentService.getPaymentStatusForBooking(user.id, bookingId);
  }

  @Post('mock/:attemptId/complete')
  @HttpCode(HttpStatus.OK)
  completeMockPayment(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentService.completeMockPaymentAttempt(user.id, attemptId);
  }

  @Public()
  @Post('webhooks/:provider')
  async paymentWebhookPost(
    @Param('provider') provider: string,
    @RawBody() rawBody: Buffer | null,
    @Body() body: unknown,
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() response: Response,
  ) {
    if (!rawBody && this.parseProvider(provider) === PaymentProvider.MOMO) {
      throw new InternalServerErrorException(
        'Raw request body is unavailable for webhook verification',
      );
    }

    const result = await this.paymentService.processPaymentWebhook(
      this.parseProvider(provider),
      rawBody ?? Buffer.from(''),
      body,
      headers,
      query,
    );

    if (result) {
      response.status(HttpStatus.OK).json(result);
      return;
    }

    response.status(HttpStatus.NO_CONTENT).send();
  }

  @Public()
  @Get('webhooks/:provider')
  async paymentWebhookGet(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Res() response: Response,
  ) {
    const result = await this.paymentService.processPaymentWebhook(
      this.parseProvider(provider),
      Buffer.from(''),
      undefined,
      headers,
      query,
    );

    if (result) {
      response.status(HttpStatus.OK).json(result);
      return;
    }

    response.status(HttpStatus.NO_CONTENT).send();
  }

  private parseProvider(provider: string) {
    const normalized = provider.toUpperCase();

    if (
      !Object.values(PaymentProvider).includes(normalized as PaymentProvider)
    ) {
      throw new BadRequestException('Invalid payment provider');
    }

    return normalized as PaymentProvider;
  }

  private getClientIp(request: Request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const firstForwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    const rawIp =
      firstForwardedIp?.trim() ??
      request.ip ??
      request.socket.remoteAddress ??
      '127.0.0.1';

    return rawIp.replace(/^::ffff:/, '') || '127.0.0.1';
  }
}
