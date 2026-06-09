export const PROTECTED_ROUTES = [
  '/dashboard',
  '/bookings',
  '/venues/create',
  '/admin',
] as const;

export const PROXY_ROUTES = [
  '/api/bookings',
  '/api/reviews',
  '/api/venues',
  '/api/fields',
  '/api/payments',
] as const;

export const ADMIN_ONLY = ['/admin', '/api/admin'];
export const OWNER_ONLY = ['/api/venues', '/api/fields'];
