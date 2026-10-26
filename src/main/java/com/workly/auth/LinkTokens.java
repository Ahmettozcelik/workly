package com.workly.auth;

import com.workly.user.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Tokens of mailed links (email verification, password reset): 32 random bytes
 * as base64url in the link, only their SHA-256 in the database. And the links
 * themselves: a frontend page in the member's language.
 */
final class LinkTokens {

	private static final int TOKEN_BYTES = 32;
	private static final SecureRandom RANDOM = new SecureRandom();

	private LinkTokens() {
	}

	static String newToken() {
		byte[] bytes = new byte[TOKEN_BYTES];
		RANDOM.nextBytes(bytes);
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

	/** A frontend page in the member's language, e.g. /login → {baseUrl}/tr/login. */
	static String link(String baseUrl, User user, String page) {
		String base = baseUrl.replaceAll("/+$", "");
		String locale = "en".equals(user.getLocale()) ? "en" : "tr";
		return base + "/" + locale + page;
	}
}
