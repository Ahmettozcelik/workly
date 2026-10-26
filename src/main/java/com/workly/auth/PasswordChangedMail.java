package com.workly.auth;

import com.workly.mail.OutgoingMail;
import com.workly.user.User;

/**
 * Sent after a password reset, so the owner notices a reset they did not make.
 * Plain text, in the member's language (tr, or en).
 */
final class PasswordChangedMail {

	private PasswordChangedMail() {
	}

	static OutgoingMail of(User user, String forgotPasswordLink) {
		if ("en".equals(user.getLocale())) {
			return new OutgoingMail(user.getEmail(), "Your Workly password was changed", """
					Hi %s,

					The password of your Workly account was just changed, and every device was signed out.

					If this was not you, choose a new password right away:

					%s

					Workly
					""".formatted(user.getDisplayName(), forgotPasswordLink));
		}
		return new OutgoingMail(user.getEmail(), "Workly şifren değiştirildi", """
				Merhaba %s,

				Workly hesabının şifresi az önce değiştirildi ve bütün cihazlarda oturum kapatıldı.

				Bunu sen yapmadıysan hemen yeni bir şifre belirle:

				%s

				Workly
				""".formatted(user.getDisplayName(), forgotPasswordLink));
	}
}
