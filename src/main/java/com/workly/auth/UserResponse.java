package com.workly.auth;

import com.workly.user.User;
import java.util.UUID;

/** The signed-in member as the frontend sees it (never the password hash). */
public record UserResponse(UUID id, String email, String displayName, String locale, boolean emailVerified) {

	static UserResponse of(User user) {
		return new UserResponse(
				user.getId(), user.getEmail(), user.getDisplayName(), user.getLocale(), user.isEmailVerified());
	}
}
