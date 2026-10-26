package com.workly.auth;

/**
 * A password change the member can fix in the form: the current password is
 * wrong (currentPassword INCORRECT) or the new one is the same
 * (newPassword SAME_AS_CURRENT). Answered as 400 VALIDATION_FAILED with that
 * field error, like the other form errors.
 */
public class PasswordChangeRejectedException extends RuntimeException {

	private final String field;
	private final String code;

	PasswordChangeRejectedException(String field, String code) {
		super("Password change rejected", null, false, false);
		this.field = field;
		this.code = code;
	}

	public String field() {
		return field;
	}

	public String code() {
		return code;
	}
}
