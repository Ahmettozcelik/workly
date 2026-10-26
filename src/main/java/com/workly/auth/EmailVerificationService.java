package com.workly.auth;

import com.workly.mail.MailOutbox;
import com.workly.user.User;
import com.workly.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Email verification links: 32 random bytes (base64url) in the mail, only their
 * SHA-256 in the database (V4). A link works once and expires
 * (workly.auth.verification.token-lifetime); a new link replaces the member's
 * unused ones. Mails are queued after the token is committed and sent in the
 * background (MailOutbox); a failed send does not fail the caller, since the
 * member can ask for a new link.
 */
@Service
public class EmailVerificationService {

	private static final int TOKEN_BYTES = 32;

	private final EmailVerificationTokenRepository tokens;
	private final UserRepository users;
	private final MailOutbox outbox;
	private final TransactionTemplate transaction;
	private final Clock clock;
	private final VerificationProperties properties;
	private final List<FixedWindowRateLimiter> resendLimiters;
	private final FixedWindowRateLimiter existingAccountLimiter;
	private final SecureRandom random = new SecureRandom();

	EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users, MailOutbox outbox,
			TransactionTemplate transaction, Clock clock, VerificationProperties properties) {
		this.tokens = tokens;
		this.users = users;
		this.outbox = outbox;
		this.transaction = transaction;
		this.clock = clock;
		this.properties = properties;
		// Keyed by member id; one entry per member asking at most.
		this.resendLimiters = properties.resendLimits().stream().map(limit -> limiter(limit, clock)).toList();
		this.existingAccountLimiter = limiter(properties.existingAccountLimit(), clock);
	}

	private static FixedWindowRateLimiter limiter(VerificationProperties.MailLimit limit, Clock clock) {
		return new FixedWindowRateLimiter(limit.maxRequests(), limit.window(), 100_000, clock);
	}

	/** Creates a new link for the member and queues the mail. */
	public void issue(User user) {
		String token = newToken();
		Instant now = clock.instant();
		transaction.executeWithoutResult(status -> {
			tokens.deleteUnusedOf(user.getId());
			tokens.save(new EmailVerificationToken(user, hash(token), now, now.plus(properties.tokenLifetime())));
		});
		outbox.queue(VerificationMail.of(user, link(user, "/verify-email?token=" + token), properties.tokenLifetime()));
	}

	/**
	 * Verifies the member the token belongs to. A used token of an already
	 * verified member is accepted again (a second click); otherwise unknown,
	 * used and expired tokens are all InvalidVerificationTokenException.
	 */
	@Transactional
	public void verify(String token) {
		EmailVerificationToken found = tokens.findByTokenHash(hash(token))
			.orElseThrow(InvalidVerificationTokenException::new);
		if (found.isUsed()) {
			if (found.getUser().isEmailVerified()) {
				return;
			}
			throw new InvalidVerificationTokenException();
		}
		Instant now = clock.instant();
		if (found.isExpiredAt(now)) {
			throw new InvalidVerificationTokenException();
		}
		found.markUsed(now);
		found.getUser().markEmailVerified();
	}

	/**
	 * A new link for a signed-in member, limited per member (429 past a limit).
	 * Nothing happens for a member who is already verified.
	 */
	public void resend(UUID memberId) {
		resendLimited(memberId).ifPresent(retryAfter -> {
			throw new RateLimitedException(retryAfter);
		});
		users.findById(memberId)
			.filter(user -> !user.isEmailVerified())
			.ifPresent(this::issue);
	}

	/**
	 * Someone registered with this member's email. The caller gets the same
	 * answer as for a new account, so the owner is told by mail instead: a new
	 * link while unverified (counted against the resend limits), otherwise an
	 * "account exists" notice (workly.auth.verification.existing-account-limit).
	 * Past a limit, nothing is sent, and nothing is reported either.
	 */
	public void registeredAgain(User user) {
		if (!user.isEmailVerified()) {
			if (resendLimited(user.getId()).isEmpty()) {
				issue(user);
			}
			return;
		}
		if (existingAccountLimiter.tryAcquire(user.getId().toString()).isEmpty()) {
			outbox.queue(AccountExistsMail.of(user, link(user, "/login")));
		}
	}

	/** Counts a new link against every resend limit; the wait if one is exceeded. */
	private Optional<Duration> resendLimited(UUID memberId) {
		String key = memberId.toString();
		for (FixedWindowRateLimiter limiter : resendLimiters) {
			Optional<Duration> retryAfter = limiter.tryAcquire(key);
			if (retryAfter.isPresent()) {
				return retryAfter;
			}
		}
		return Optional.empty();
	}

	@Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT10M")
	void deleteExpired() {
		transaction.executeWithoutResult(status -> tokens.deleteExpired(clock.instant()));
		resendLimiters.forEach(FixedWindowRateLimiter::evictExpired);
		existingAccountLimiter.evictExpired();
	}

	/** A frontend page in the member's language, e.g. /login → {base-url}/tr/login. */
	private String link(User user, String page) {
		String base = properties.baseUrl().replaceAll("/+$", "");
		String locale = "en".equals(user.getLocale()) ? "en" : "tr";
		return base + "/" + locale + page;
	}

	private String newToken() {
		byte[] bytes = new byte[TOKEN_BYTES];
		random.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	/** SHA-256 (hex) of the token as it appears in the link. */
	static String hash(String token) {
		try {
			return HexFormat.of().formatHex(
					MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 is always available", ex);
		}
	}
}
