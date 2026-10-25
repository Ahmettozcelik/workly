package com.workly.auth;

import com.workly.mail.OutgoingMail;
import com.workly.user.User;
import java.time.Duration;

/** The verification mail in the member's language (tr, or en). Plain text. */
final class VerificationMail {

	private VerificationMail() {
	}

	static OutgoingMail of(User user, String link, Duration lifetime) {
		long hours = Math.max(1, lifetime.toHours());
		if ("en".equals(user.getLocale())) {
			return new OutgoingMail(user.getEmail(), "Verify your email for Workly", """
					Hi %s,

					To verify the email address of your Workly account, open the link below and press the button on the page:

					%s

					The link works once and expires in %d hours. If you did not create this account, you can ignore this email.

					Workly
					""".formatted(user.getDisplayName(), link, hours));
		}
		return new OutgoingMail(user.getEmail(), "Workly e-posta adresini doğrula", """
				Merhaba %s,

				Workly hesabının e-posta adresini doğrulamak için aşağıdaki bağlantıyı aç ve sayfadaki butona bas:

				%s

				Bağlantı yalnızca bir kez kullanılabilir ve %d saat geçerlidir. Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.

				Workly
				""".formatted(user.getDisplayName(), link, hours));
	}
}
