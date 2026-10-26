package com.workly.auth;

import com.workly.mail.OutgoingMail;
import com.workly.user.User;

/**
 * Sent after the password changed (a reset link, or the member's own change),
 * so the owner notices a change they did not make. Plain text, in the
 * member's language (tr, or en).
 */
final class PasswordChangedMail {

	private PasswordChangedMail() {
	}

	/** After a reset link: every device was signed out. */
	static OutgoingMail afterReset(User user, String forgotPasswordLink) {
		return of(user, forgotPasswordLink, "and every device was signed out",
				"ve bütün cihazlarda oturum kapatıldı");
	}

	/** After a change from a signed-in device: the other devices were signed out. */
	static OutgoingMail afterChange(User user, String forgotPasswordLink) {
		return of(user, forgotPasswordLink, "and your other devices were signed out",
				"ve diğer cihazlarda oturum kapatıldı");
	}

	private static OutgoingMail of(User user, String forgotPasswordLink, String signedOutEn, String signedOutTr) {
		if ("en".equals(user.getLocale())) {
			return new OutgoingMail(user.getEmail(), "Your Workly password was changed", """
					Hi %s,

					The password of your Workly account was just changed, %s.

					If this was not you, choose a new password right away:

					%s

					Workly
					""".formatted(user.getDisplayName(), signedOutEn, forgotPasswordLink));
		}
		return new OutgoingMail(user.getEmail(), "Workly şifren değiştirildi", """
				Merhaba %s,

				Workly hesabının şifresi az önce değiştirildi %s.

				Bunu sen yapmadıysan hemen yeni bir şifre belirle:

				%s

				Workly
				""".formatted(user.getDisplayName(), signedOutTr, forgotPasswordLink));
	}
}
