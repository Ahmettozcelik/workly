package com.workly.auth;

import com.workly.mail.Mailer;
import com.workly.user.User;
import com.workly.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Email verification links: 32 random bytes (base64url) in the mail, only their
 * SHA-256 in the database (V4). A link works once and expires
 * (workly.auth.verification.token-lifetime); a new link replaces the member's
 * unused ones. Mails go out after the token is committed, outside the
 * transaction; a failed send is logged (without the address) and does not fail
 * the caller, since the member can ask for a new link.
 */
@Service
public class EmailVerificationService {

	private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
	private static final int TOKEN_BYTES = 32;

	private final EmailVerificationTokenRepository tokens;
	private final UserRepository users;
	private final Mailer mailer;
	private final TransactionTemplate transaction;
	private final Clock clock;
	private final VerificationProperties properties;
	private final List<FixedWindowRateLimiter> resendLimiters;
	private final SecureRandom random = new SecureRandom();

	EmailVerificationService(EmailVerificationTokenRepository tokens, UserRepository users, Mailer mailer,
			TransactionTemplate transaction, Clock clock, VerificationProperties properties) {
		this.tokens = tokens;
		this.users = users;
		this.mailer = mailer;
		this.transaction = transaction;
		this.clock = clock;
		this.properties = properties;
		// Keyed by member id; one entry per signed-in member at most.
		this.resendLimiters = properties.resendLimits().stream()
			.map(limit -> new FixedWindowRateLimiter(limit.maxRequests(), limit.window(), 100_000, clock))
			.toList();
	}

	/** Creates a new link for the member and mails it. */
	public void issue(User user) {
		String token = newToken();
		Instant now = clock.instant();
		transaction.executeWithoutResult(status -> {
			tokens.deleteUnusedOf(user.getId());
			tokens.save(new EmailVerificationToken(user, hash(token), now, now.plus(properties.tokenLifetime())));
		});
		try {
			mailer.send(VerificationMail.of(user, link(user, token), properties.tokenLifetime()));
		}
		catch (RuntimeException ex) {
			// The exception text may name the recipient; log its type only.
			log.warn("Verification mail could not be sent ({})", ex.getClass().getSimpleName());
		}
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
		String key = memberId.toString();
		for (FixedWindowRateLimiter limiter : resendLimiters) {
			limiter.tryAcquire(key).ifPresent(retryAfter -> {
				throw new RateLimitedException(retryAfter);
			});
		}
		users.findById(memberId)
			.filter(user -> !user.isEmailVerified())
			.ifPresent(this::issue);
	}

	@Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT10M")
	void deleteExpired() {
		transaction.executeWithoutResult(status -> tokens.deleteExpired(clock.instant()));
		resendLimiters.forEach(FixedWindowRateLimiter::evictExpired);
	}

	private String link(User user, String token) {
		String base = properties.baseUrl().replaceAll("/+$", "");
		String locale = "en".equals(user.getLocale()) ? "en" : "tr";
		return base + "/" + locale + "/verify-email?token=" + token;
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
