package com.workly.auth;

import com.workly.mail.MailOutbox;
import com.workly.user.User;
import com.workly.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A signed-in member changes their password, proving the current one. Wrong
 * current passwords count towards the sign-in limit of the email
 * (LoginThrottle), so a stolen session cannot guess freely; while the email is
 * blocked, nothing is checked (429). The change raises the credentials
 * version; the caller ends the member's other sessions and keeps the current
 * one (MemberSessions, CredentialsCheckFilter).
 */
@Service
class PasswordChangeService {

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final LoginThrottle loginThrottle;
	private final TransactionTemplate transaction;
	private final MailOutbox outbox;
	private final String baseUrl;

	PasswordChangeService(UserRepository users, PasswordEncoder passwordEncoder, LoginThrottle loginThrottle,
			TransactionTemplate transaction, MailOutbox outbox, VerificationProperties verification) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.loginThrottle = loginThrottle;
		this.transaction = transaction;
		this.outbox = outbox;
		this.baseUrl = verification.baseUrl();
	}

	/**
	 * Sets the new password (already validated: the registration rules) and
	 * returns the new credentials version. PasswordChangeRejectedException for a
	 * wrong current password or an unchanged one.
	 */
	int change(UUID memberId, String currentPassword, String newPassword) {
		User member = users.findById(memberId).orElseThrow(SessionNotFoundException::new);
		loginThrottle.blockedFor(member.getEmail()).ifPresent(retryAfter -> {
			throw new RateLimitedException(retryAfter);
		});
		if (!matches(currentPassword, member.getPasswordHash())) {
			loginThrottle.recordFailure(member.getEmail());
			throw new PasswordChangeRejectedException("currentPassword", "INCORRECT");
		}
		if (matches(newPassword, member.getPasswordHash())) {
			throw new PasswordChangeRejectedException("newPassword", "SAME_AS_CURRENT");
		}
		String newHash = passwordEncoder.encode(newPassword);
		User changed = transaction.execute(status -> {
			// Locked, and still the password just checked: a concurrent change wins.
			User locked = users.findLockedById(memberId).orElseThrow(SessionNotFoundException::new);
			if (!locked.getPasswordHash().equals(member.getPasswordHash())) {
				throw new PasswordChangeRejectedException("currentPassword", "INCORRECT");
			}
			locked.changePassword(newHash);
			return locked;
		});
		loginThrottle.reset(changed.getEmail());
		outbox.queue(PasswordChangedMail.afterChange(changed, LinkTokens.link(baseUrl, changed, "/forgot-password")));
		return changed.getCredentialsVersion();
	}

	// Longer passwords can never match (registration caps them); bcrypt would reject them.
	private boolean matches(String password, String hash) {
		return password.getBytes(StandardCharsets.UTF_8).length <= AuthRequests.PASSWORD_MAX_BYTES
				&& passwordEncoder.matches(password, hash);
	}
}
