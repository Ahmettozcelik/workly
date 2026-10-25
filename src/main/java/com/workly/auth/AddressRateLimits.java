package com.workly.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Per-client-address limits on sign-in and registration, a second layer next
 * to the per-email LoginThrottle. The address is request.getRemoteAddr(): with
 * server.forward-headers-strategy=native it is taken from X-Forwarded-For when
 * the request comes from a trusted proxy (the Next.js server on localhost or a
 * private network). The Next.js proxy forwards a client-sent X-Forwarded-For
 * as is, so in production a reverse proxy in front must append the real
 * client address; until then this layer can be bypassed, the email limit not.
 */
@Component
class AddressRateLimits {

	/** Bounds memory when many addresses (or forged ones) are seen at once. */
	private static final int MAX_TRACKED_ADDRESSES = 100_000;

	private final FixedWindowRateLimiter login;
	private final FixedWindowRateLimiter register;

	AddressRateLimits(ThrottleProperties properties, Clock clock) {
		this.login = limiter(properties.loginAddress(), clock);
		this.register = limiter(properties.registerAddress(), clock);
	}

	private static FixedWindowRateLimiter limiter(ThrottleProperties.AddressLimit limit, Clock clock) {
		return new FixedWindowRateLimiter(limit.maxRequests(), limit.window(), MAX_TRACKED_ADDRESSES, clock);
	}

	void checkLogin(HttpServletRequest request) {
		check(login, request);
	}

	void checkRegister(HttpServletRequest request) {
		check(register, request);
	}

	private static void check(FixedWindowRateLimiter limiter, HttpServletRequest request) {
		limiter.tryAcquire(request.getRemoteAddr()).ifPresent(retryAfter -> {
			throw new RateLimitedException(retryAfter);
		});
	}

	@Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT1M")
	void evictExpired() {
		login.evictExpired();
		register.evictExpired();
	}
}
