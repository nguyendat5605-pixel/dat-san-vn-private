// ============================================================
// DatSanVN — API Response Helper
// Trả về format chuẩn: { statusCode, message, data }
// Dùng ApiResponse type từ @dat-san-vn/types
// ============================================================

import type { ApiResponse } from '@dat-san-vn/types';

/**
 * Tạo response thành công theo format chuẩn project.
 *
 * @example
 * return success(user, 'User created successfully', 201);
 * // → { statusCode: 201, message: 'User created successfully', data: { ... } }
 */
export function success<T>(
  data: T,
  message = 'Success',
  statusCode = 200,
): ApiResponse<T> {
  return { statusCode, message, data };
}
