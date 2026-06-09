// ============================================================
// DatSanVN — Global Response Interceptor
// Đảm bảo mọi response thành công đều có format ApiResponse<T>
// ============================================================

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '@dat-san-vn/types';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, any>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();

        // Skip transformation for webhook endpoints
        if (request.url.startsWith('/webhooks')) {
          return data;
        }

        // Nếu data đã dùng helper success() -> bỏ qua bọc lại
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'message' in data &&
          'data' in data
        ) {
          // Sync response statusCode with object statusCode if they differ
          if (response.statusCode !== data.statusCode && data.statusCode) {
              response.status(data.statusCode);
          }
          return data as ApiResponse<T>;
        }

        // Bọc data thành dạng chuẩn
        const apiResponse: ApiResponse<T> = {
          statusCode: response.statusCode,
          message: 'Success',
          data: data ?? null,
        };

        return apiResponse;
      }),
    );
  }
}
