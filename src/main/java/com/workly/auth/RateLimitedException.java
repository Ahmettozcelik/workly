package com.workly.auth;

import java.time.Duration;

/** Too many attempts; the client may try again after {@code retryAfter} (429 RATE_LIMITED). */
public class RateLimitedException extends RuntimeException {

	private final Duration retryAfter;

	RateLimitedException(Duration retryAfter) {
		super("Rate limited", null, false, false);
		this.retryAfter = retryAfter;
	}

	public Duration retryAfter() {
		return retryAfter;
	}
}
