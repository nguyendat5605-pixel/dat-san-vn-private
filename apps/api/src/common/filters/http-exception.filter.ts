// ============================================================
// DatSanVN — Global HTTP Exception Filter
// Bắt tất cả exception, trả về format chuẩn: { statusCode, error, message }
// Dùng ApiError type từ @dat-san-vn/types
// ============================================================

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@dat-san-vn/types';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'InternalServerError';
    let message: string | string[] = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string | string[]) || exception.message;
        error = (res.error as string) || exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // class-validator trả message dạng array → join thành string
    const finalMessage = Array.isArray(message) ? message.join('; ') : message;

    this.logger.error(
      `[${statusCode}] ${error}: ${finalMessage}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const errorResponse: ApiError = {
      statusCode,
      error,
      message: finalMessage,
    };

    response.status(statusCode).json(errorResponse);
  }
}
