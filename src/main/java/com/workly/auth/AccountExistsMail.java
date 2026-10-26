package com.workly.auth;

import com.workly.mail.OutgoingMail;
import com.workly.user.User;

/**
 * Sent when someone registers with the email of a verified member: the API
 * answers as for a new account, and the owner learns about it here. Plain text,
 * in the member's language (tr, or en).
 */
final class AccountExistsMail {

	private AccountExistsMail() {
	}

	static OutgoingMail of(User user, String loginLink) {
		if ("en".equals(user.getLocale())) {
			return new OutgoingMail(user.getEmail(), "You already have a Workly account", """
					Hi %s,

					Someone tried to create a new Workly account with this email address. You already have an account, so nothing was changed.

					To sign in, open:

					%s

					If this was not you, you can ignore this email.

					Workly
					""".formatted(user.getDisplayName(), loginLink));
		}
		return new OutgoingMail(user.getEmail(), "Zaten bir Workly hesabın var", """
				Merhaba %s,

				Bu e-posta adresiyle yeni bir Workly hesabı açılmak istendi. Bu adresle zaten bir hesabın olduğu için hiçbir şey değiştirilmedi.

				Giriş yapmak için:

				%s

				Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.

				Workly
				""".formatted(user.getDisplayName(), loginLink));
	}
}
