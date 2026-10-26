package com.workly.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request bodies of the auth API. Constraint messages are machine-readable
 * error codes (see ApiExceptionHandler); the frontend owns the wording.
 */
public final class AuthRequests {

	/** Same password rule as the frontend: 8+ characters, at most 72 bytes. */
	static final int PASSWORD_MIN_LENGTH = 8;
	static final int PASSWORD_MAX_BYTES = 72;

	/** Same shape check as the frontend (src/components/auth/validation.ts). */
	private static final String EMAIL_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

	private AuthRequests() {
	}

	public record Register(
			@NotBlank(message = "REQUIRED") @Size(max = 100, message = "TOO_LONG") String displayName,
			@NotBlank(message = "REQUIRED")
			@Email(regexp = EMAIL_PATTERN, message = "INVALID_EMAIL")
			@Size(max = 254, message = "TOO_LONG") String email,
			@NotEmpty(message = "REQUIRED")
			@Size(min = PASSWORD_MIN_LENGTH, message = "TOO_SHORT")
			@MaxUtf8Bytes(PASSWORD_MAX_BYTES) String password,
			/** Preferred language; "tr" when omitted. */
			@Pattern(regexp = "tr|en", message = "INVALID_LOCALE") String locale) {

		/** Surrounding whitespace is ignored, except in the password. */
		public Register {
			displayName = displayName == null ? null : displayName.trim();
			email = email == null ? null : email.trim();
		}
	}

	/** No format rules on sign-in: they would only reveal the policy. */
	public record Login(
			@NotBlank(message = "REQUIRED") String email,
			@NotEmpty(message = "REQUIRED") String password) {
	}

	/** The token from a verification link (43 characters; a little slack, no more). */
	public record VerifyEmail(
			@NotBlank(message = "REQUIRED") @Size(max = 100, message = "TOO_LONG") String token) {
	}

	/** Asking for a reset link; the same email rules as registration. */
	public record PasswordReset(
			@NotBlank(message = "REQUIRED")
			@Email(regexp = EMAIL_PATTERN, message = "INVALID_EMAIL")
			@Size(max = 254, message = "TOO_LONG") String email) {

		public PasswordReset {
			email = email == null ? null : email.trim();
		}
	}

	/** The token from a reset link and the new password (the same rules as registration). */
	public record PasswordResetConfirm(
			@NotBlank(message = "REQUIRED") @Size(max = 100, message = "TOO_LONG") String token,
			@NotEmpty(message = "REQUIRED")
			@Size(min = PASSWORD_MIN_LENGTH, message = "TOO_SHORT")
			@MaxUtf8Bytes(PASSWORD_MAX_BYTES) String password) {
	}
}
