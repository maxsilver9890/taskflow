import rateLimit from "express-rate-limit";

/**
 * Applied to all /auth/* routes.
 * Spec: max 10 requests per minute per IP address.
 *
 * In production behind a reverse proxy (nginx, ALB, Cloudflare) ensure
 * `app.set('trust proxy', 1)` is configured so `req.ip` reflects the
 * real client IP rather than the proxy's internal address.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: "draft-7", // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again after 1 minute.",
    code: "RATE_LIMIT_EXCEEDED",
    details: {}
  },
  // Skip rate limiting in test environment to avoid flaky tests
  skip: () => process.env["NODE_ENV"] === "test"
});
