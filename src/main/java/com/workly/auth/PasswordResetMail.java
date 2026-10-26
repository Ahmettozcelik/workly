package com.workly.auth;

import com.workly.mail.OutgoingMail;
import com.workly.user.User;
import java.time.Duration;

/** The password reset mail in the member's language (tr, or en). Plain text. */
final class PasswordResetMail {

	private PasswordResetMail() {
	}

	static OutgoingMail of(User user, String link, Duration lifetime) {
		long minutes = Math.max(1, lifetime.toMinutes());
		if ("en".equals(user.getLocale())) {
			return new OutgoingMail(user.getEmail(), "Reset your Workly password", """
					Hi %s,

					To choose a new password for your Workly account, open the link below:

					%s

					The link works once and expires in %d minutes. If you did not ask for this, you can ignore this email; your password stays the same.

					Workly
					""".formatted(user.getDisplayName(), link, minutes));
		}
		return new OutgoingMail(user.getEmail(), "Workly şifreni sıfırla", """
				Merhaba %s,

				Workly hesabın için yeni bir şifre belirlemek üzere aşağıdaki bağlantıyı aç:

				%s

				Bağlantı yalnızca bir kez kullanılabilir ve %d dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.

				Workly
				""".formatted(user.getDisplayName(), link, minutes));
	}
}
