import { registerAs } from '@nestjs/config';



/**
 * Clerk configuration namespace.
 *
 * Loaded via ConfigModule.forRoot({ load: [clerkConfig] }) in app.module.ts.
 *
 * Required ENV vars:
 *   CLERK_WEBHOOK_SECRET  — The webhook signing secret from Clerk Dashboard.
 *                           Format: whsec_xxxxxxxxxxxx...
 *                           Where to get it: Clerk Dashboard → Configure → Webhooks
 *                             → your endpoint → Signing Secret (click "Reveal").
 *
 *   CLERK_SECRET_KEY      — Backend API key for Clerk SDK operations (JWT verification).
 *                           Format: sk_test_xxxx... or sk_live_xxxx...
 *                           Where to get it: Clerk Dashboard → Configure → API Keys.
 *
 *   CLERK_PUBLISHABLE_KEY — Publishable key (used by frontend + token issuer validation).
 *                           Format: pk_test_xxxx... or pk_live_xxxx...
 *                           Where to get it: Clerk Dashboard → Configure → API Keys.
 *
 * Optional ENV vars:
 *   CLERK_JWT_KEY          — PEM public key for local JWT verification (skips JWKS fetch).
 *                           Format: -----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
 *                           Where to get it: Clerk Dashboard → Configure → API Keys → Advanced.
 *                           If not set, verifyToken() will use secretKey to fetch JWKS.
 *
 * Usage with typed injection:
 *   constructor(@Inject(clerkConfig.KEY) private cfg: ConfigType<typeof clerkConfig>) {}
 *   this.cfg.webhookSecret
 *   this.cfg.secretKey
 *
 * Usage via flat ConfigService (simpler, used in service):
 *   this.configService.get<string>('clerk.webhookSecret')
 *   this.configService.get<string>('clerk.secretKey')
 *
 * For full Clerk API access (users.getUser, etc.):
 *   @Inject(CLERK_CLIENT) private readonly clerk: ClerkClient
 */
export const clerkConfig = registerAs('clerk', () => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;
  const jwtKey = process.env.CLERK_JWT_KEY;

  if (!webhookSecret) {
    throw new Error(
      '[ClerkConfig] Missing required env var: CLERK_WEBHOOK_SECRET. ' +
        'Get it from: Clerk Dashboard → Configure → Webhooks → your endpoint → Signing Secret.',
    );
  }

  if (!secretKey) {
    throw new Error(
      '[ClerkConfig] Missing required env var: CLERK_SECRET_KEY. ' +
        'Get it from: Clerk Dashboard → Configure → API Keys.',
    );
  }

  if (!publishableKey) {
    throw new Error(
      '[ClerkConfig] Missing required env var: CLERK_PUBLISHABLE_KEY. ' +
        'Get it from: Clerk Dashboard → Configure → API Keys.',
    );
  }

  return {
    /** HMAC signing secret for Svix signature verification */
    webhookSecret,

    /** Backend secret key for Clerk SDK operations (JWT verification, JWKS) */
    secretKey,

    /** Publishable key for token issuer validation */
    publishableKey,

    /**
     * Optional PEM public key for local JWT verification.
     * If set, verifyToken() uses this instead of fetching JWKS via secretKey.
     * Faster verification — no network call needed.
     */
    jwtKey: jwtKey ?? undefined,
  };
});

/** Inferred type — use with ConfigType<typeof clerkConfig> */
export type ClerkConfig = ReturnType<typeof clerkConfig>;
