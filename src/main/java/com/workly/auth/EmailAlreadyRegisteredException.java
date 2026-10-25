package com.workly.auth;

/** Registration with an email that already has an account (409 EMAIL_TAKEN). */
public class EmailAlreadyRegisteredException extends RuntimeException {

	public EmailAlreadyRegisteredException() {
		super("Email already registered");
	}
}
