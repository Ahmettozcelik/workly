package com.workly.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class FixedWindowRateLimiterTests {

	private final MutableClock clock = new MutableClock(Instant.parse("2026-10-25T12:00:00Z"));
	private final FixedWindowRateLimiter limiter = new FixedWindowRateLimiter(3, Duration.ofMinutes(1), 2, clock);

	@Test
	void allowsUpToTheLimitPerWindow() {
		for (int i = 0; i < 3; i++) {
			assertThat(limiter.tryAcquire("a")).isEmpty();
		}
		clock.advance(Duration.ofSeconds(20));
		assertThat(limiter.tryAcquire("a")).contains(Duration.ofSeconds(40));
		// Other keys have their own count.
		assertThat(limiter.tryAcquire("b")).isEmpty();
	}

	@Test
	void aNewWindowStartsOver() {
		for (int i = 0; i < 4; i++) {
			limiter.tryAcquire("a");
		}
		clock.advance(Duration.ofMinutes(1));
		assertThat(limiter.tryAcquire("a")).isEmpty();
	}

	@Test
	void forgetsExpiredKeys() {
		limiter.tryAcquire("a");
		limiter.tryAcquire("b");
		clock.advance(Duration.ofMinutes(1));
		limiter.evictExpired();
		assertThat(limiter.trackedKeys()).isZero();
	}

	@Test
	void pastTheKeyCapNewKeysAreNotTracked() {
		limiter.tryAcquire("a");
		limiter.tryAcquire("b");
		for (int i = 0; i < 5; i++) {
			assertThat(limiter.tryAcquire("c")).isEmpty();
		}
		assertThat(limiter.trackedKeys()).isEqualTo(2);
		// Once old windows are over, there is room again.
		clock.advance(Duration.ofMinutes(1));
		limiter.tryAcquire("c");
		assertThat(limiter.trackedKeys()).isEqualTo(1);
	}

	private static final class MutableClock extends Clock {

		private Instant now;

		MutableClock(Instant now) {
			this.now = now;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			throw new UnsupportedOperationException();
		}
	}
}
