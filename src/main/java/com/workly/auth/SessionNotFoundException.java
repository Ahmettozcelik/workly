package com.workly.auth;

/** No session of the signed-in member has this id (404 NOT_FOUND; other members' sessions look the same). */
public class SessionNotFoundException extends RuntimeException {

	SessionNotFoundException() {
		super("Session not found", null, false, false);
	}
}
