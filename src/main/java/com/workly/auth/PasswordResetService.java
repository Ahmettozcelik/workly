package com.workly.auth;

import com.workly.background.BackgroundTasks;
import com.workly.mail.MailOutbox;
import com.workly.user.EmailAddress;
import com.workly.user.User;
import com.workly.user.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Password reset links (LinkTokens: random token in the mail, only its SHA-256
 * in the database, V5). A link works once and expires
 * (workly.auth.password-reset.token-lifetime); a member has at most one unused
 * link, a new one replaces it.
 *
 * <p>Asking for a link never reveals whether the email has an account: the
 * request only queues the work (BackgroundTasks), and looking the member up,
 * the per-member limits, the token and the mail all happen later. Unknown
 * emails get nothing.
 *
 * <p>Using a link sets the new password, verifies the email (the link proved
 * ownership), lifts a sign-in block and ends every session of the member. The
 * new password raises the credentials version, so a sign-in that checked the
 * old password just before the change and saved its session right after the
 * deletion is ended on its next request (CredentialsCheckFilter).
 *
 * <p>The per-member limits are in memory: right for a single instance; with
 * several, move them to PostgreSQL like LoginThrottle.
 */
@Service
public class PasswordResetService {

	private final PasswordResetTokenRepository tokens;
	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final LoginThrottle loginThrottle;
	private final FindByIndexNameSessionRepository<? extends Session> sessions;
	private final MailOutbox outbox;
	private final BackgroundTasks background;
	private final TransactionTemplate transaction;
	private final Clock clock;
	private final PasswordResetProperties properties;
	private final String baseUrl;
	private final List<FixedWindowRateLimiter> memberLimiters;

	PasswordResetService(PasswordResetTokenRepository tokens, UserRepository users, PasswordEncoder passwordEncoder,
			LoginThrottle loginThrottle, FindByIndexNameSessionRepository<? extends Session> sessions,
			MailOutbox outbox, BackgroundTasks background, TransactionTemplate transaction, Clock clock,
			PasswordResetProperties properties, VerificationProperties verification) {
		this.tokens = tokens;
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.loginThrottle = loginThrottle;
		this.sessions = sessions;
		this.outbox = outbox;
		this.background = background;
		this.transaction = transaction;
		this.clock = clock;
		this.properties = properties;
		this.baseUrl = verification.baseUrl();
		// Keyed by member id; one entry per member asking at most.
		this.memberLimiters = properties.memberLimits().stream()
			.map(limit -> new FixedWindowRateLimiter(limit.maxRequests(), limit.window(), 100_000, clock))
			.toList();
	}

	/** Mails a link if the email has an account, later; the caller learns nothing either way. */
	public void request(String email) {
		background.run("Password reset request", () -> issue(EmailAddress.normalize(email)));
	}

	private void issue(String email) {
		users.findByEmail(email)
			.filter(user -> withinMemberLimits(user.getId()))
			.ifPresent(this::issue);
	}

	private void issue(User user) {
		String token = LinkTokens.newToken();
		Instant now = clock.instant();
		try {
			transaction.executeWithoutResult(status -> {
				tokens.deleteUnusedOf(user.getId());
				tokens.saveAndFlush(new PasswordResetToken(user, LinkTokens.hash(token), now,
						now.plus(properties.tokenLifetime())));
			});
		}
		catch (DataIntegrityViolationException ex) {
			// A concurrent request created the member's one unused link; it mails it.
			return;
		}
		outbox.queue(PasswordResetMail.of(user, LinkTokens.link(baseUrl, user, "/reset-password?token=" + token),
				properties.tokenLifetime()));
	}

	/** Counts a mail against every member limit; false if one is exceeded. */
	private boolean withinMemberLimits(UUID memberId) {
		String key = memberId.toString();
		for (FixedWindowRateLimiter limiter : memberLimiters) {
			if (limiter.tryAcquire(key).isPresent()) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Sets the new password with the link's token (already validated: the same
	 * rules as registration). The token is checked before the password is
	 * hashed, so invalid links cost no bcrypt. Unknown, used and expired tokens
	 * are all InvalidPasswordResetTokenException.
	 */
	public void reset(String token, String newPassword) {
		User user = transaction.execute(status -> {
			PasswordResetToken found = tokens.findByTokenHash(LinkTokens.hash(token))
				.orElseThrow(InvalidPasswordResetTokenException::new);
			Instant now = clock.instant();
			if (found.isUsed() || found.isExpiredAt(now)) {
				throw new InvalidPasswordResetTokenException();
			}
			found.markUsed(now);
			User member = found.getUser();
			member.changePassword(passwordEncoder.encode(newPassword));
			member.markEmailVerified();
			return member;
		});
		// After the commit: a sign-in from now on needs the new password.
		loginThrottle.reset(user.getEmail());
		sessions.findByPrincipalName(user.getId().toString()).keySet().forEach(sessions::deleteById);
		outbox.queue(PasswordChangedMail.of(user, LinkTokens.link(baseUrl, user, "/forgot-password")));
	}

	@Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT10M")
	void deleteExpired() {
		transaction.executeWithoutResult(status -> tokens.deleteExpired(clock.instant()));
		memberLimiters.forEach(FixedWindowRateLimiter::evictExpired);
	}
}
