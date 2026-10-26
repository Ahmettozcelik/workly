package com.workly.auth;

/** An unknown, used or expired password reset link (400 PASSWORD_RESET_TOKEN_INVALID). */
public class InvalidPasswordResetTokenException extends RuntimeException {

	InvalidPasswordResetTokenException() {
		super("Invalid password reset token", null, false, false);
	}
}
