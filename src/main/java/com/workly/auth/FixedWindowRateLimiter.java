package com.workly.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory request counter per key (here: client address) in fixed windows.
 * Per application instance and lost on restart, which is fine for a second
 * layer; the per-email limit (LoginThrottle) lives in PostgreSQL.
 */
final class FixedWindowRateLimiter {

	private record Window(Instant start, int requests) {
	}

	private final int maxRequests;
	private final Duration window;
	private final int maxKeys;
	private final Clock clock;
	private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

	FixedWindowRateLimiter(int maxRequests, Duration window, int maxKeys, Clock clock) {
		this.maxRequests = maxRequests;
		this.window = window;
		this.maxKeys = maxKeys;
		this.clock = clock;
	}

	/** Counts a request: empty when it is allowed, otherwise how long until the key may try again. */
	Optional<Duration> tryAcquire(String key) {
		Instant now = clock.instant();
		if (windows.size() >= maxKeys && !windows.containsKey(key)) {
			evictExpired();
			if (windows.size() >= maxKeys) {
				// Bounded memory: past the cap new keys are not tracked (fail open);
				// the per-email limit still applies.
				return Optional.empty();
			}
		}
		Window current = windows.compute(key, (k, old) -> old == null || expired(old, now)
				? new Window(now, 1)
				: new Window(old.start(), Math.min(old.requests() + 1, maxRequests + 1)));
		if (current.requests() <= maxRequests) {
			return Optional.empty();
		}
		return Optional.of(Duration.between(now, current.start().plus(window)));
	}

	/** Forgets the keys whose window is over. */
	void evictExpired() {
		Instant now = clock.instant();
		windows.values().removeIf(each -> expired(each, now));
	}

	int trackedKeys() {
		return windows.size();
	}

	private boolean expired(Window each, Instant now) {
		return !now.isBefore(each.start().plus(window));
	}
}
