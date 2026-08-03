const buckets = new Map();

export function rateLimit({ windowMs, max, keyPrefix }) {
  return (request, response, next) => {
    const ip = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      response.status(429).json({ ok: false, message: "Too many requests. Please wait and try again." });
      return;
    }

    next();
  };
}
