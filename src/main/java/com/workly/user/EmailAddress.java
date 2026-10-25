package com.workly.user;

import java.util.Locale;

/** Email normalisation shared by registration, login and lookups. */
public final class EmailAddress {

	private EmailAddress() {
	}

	/** Trimmed and lower-cased with the root locale (no Turkish dotless-i surprises). */
	public static String normalize(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}
}
