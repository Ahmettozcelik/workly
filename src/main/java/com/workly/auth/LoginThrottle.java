package com.workly.auth;

import com.workly.user.EmailAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Failed sign-ins per email, in PostgreSQL (login_throttle, V3), so the limit
 * holds across restarts and instances. After maxFailures failures within the
 * window, sign-in for that email is blocked for the block duration: a temporary
 * block, not a permanent lock, so nobody can shut a member out for good just
 * by knowing their email. Unknown emails are counted the same way.
 */
@Component
class LoginThrottle {

	private static final Logger log = LoggerFactory.getLogger(LoginThrottle.class);

	private final JdbcTemplate jdbc;
	private final Clock clock;
	private final ThrottleProperties.EmailLimit limit;

	LoginThrottle(JdbcTemplate jdbc, Clock clock, ThrottleProperties properties) {
		this.jdbc = jdbc;
		this.clock = clock;
		this.limit = properties.loginEmail();
	}

	/** How long sign-in stays blocked for this email; empty when it is not blocked. */
	Optional<Duration> blockedFor(String email) {
		OffsetDateTime now = now();
		return jdbc.queryForList(
				"SELECT blocked_until FROM login_throttle WHERE email_hash = ? AND blocked_until > ?",
				OffsetDateTime.class, hash(email), now)
			.stream()
			.findFirst()
			.map(until -> Duration.between(now, until));
	}

	/**
	 * Counts a failed sign-in in one atomic upsert: a failure after the window
	 * starts a new one, and the failure that reaches maxFailures sets the block.
	 */
	void recordFailure(String email) {
		OffsetDateTime now = now();
		OffsetDateTime windowStart = now.minus(limit.window());
		OffsetDateTime blockEnd = now.plus(limit.block());
		Integer failures = jdbc.queryForObject("""
				INSERT INTO login_throttle AS t (email_hash, failed_attempts, window_started_at, blocked_until)
				VALUES (?, 1, ?, CASE WHEN 1 >= ? THEN CAST(? AS TIMESTAMPTZ) END)
				ON CONFLICT (email_hash) DO UPDATE SET
				    failed_attempts = CASE WHEN t.window_started_at > ? THEN t.failed_attempts + 1 ELSE 1 END,
				    window_started_at = CASE WHEN t.window_started_at > ? THEN t.window_started_at ELSE EXCLUDED.window_started_at END,
				    blocked_until = CASE
				        WHEN (CASE WHEN t.window_started_at > ? THEN t.failed_attempts + 1 ELSE 1 END) >= ?
				        THEN CAST(? AS TIMESTAMPTZ) END
				RETURNING failed_attempts""",
				Integer.class,
				hash(email), now, limit.maxFailures(), blockEnd,
				windowStart, windowStart, windowStart, limit.maxFailures(), blockEnd);
		if (failures != null && failures == limit.maxFailures()) {
			// No email in the log: the hash would still identify a known address.
			log.warn("Sign-in blocked for {} after {} failed attempts", limit.block(), failures);
		}
	}

	/** A successful sign-in starts over. */
	void reset(String email) {
		jdbc.update("DELETE FROM login_throttle WHERE email_hash = ?", hash(email));
	}

	/** Removes rows whose window and block are both over. */
	@Scheduled(fixedDelayString = "PT10M", initialDelayString = "PT10M")
	void deleteExpired() {
		OffsetDateTime now = now();
		jdbc.update("""
				DELETE FROM login_throttle
				WHERE window_started_at <= ? AND (blocked_until IS NULL OR blocked_until <= ?)""",
				now.minus(limit.window()), now);
	}

	/** SHA-256 (hex) of the normalised email: case and surrounding spaces do not matter. */
	static String hash(String email) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256")
				.digest(EmailAddress.normalize(email).getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(digest);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 is always available", ex);
		}
	}

	private OffsetDateTime now() {
		return clock.instant().atOffset(ZoneOffset.UTC);
	}
}
