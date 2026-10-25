package com.workly.auth;

/** An unknown, used or expired verification link (400 VERIFICATION_TOKEN_INVALID). */
public class InvalidVerificationTokenException extends RuntimeException {

	InvalidVerificationTokenException() {
		super("Invalid verification token", null, false, false);
	}
}
