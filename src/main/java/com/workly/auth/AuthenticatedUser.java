package com.workly.auth;

import java.io.Serializable;
import java.util.UUID;
import org.springframework.security.core.AuthenticatedPrincipal;

/**
 * The principal kept in the session: only the member's id, never the password
 * hash. Serializable because Spring Session JDBC stores the security context.
 */
public record AuthenticatedUser(UUID id) implements AuthenticatedPrincipal, Serializable {

	/** Also the session's principal name (SPRING_SESSION.PRINCIPAL_NAME). */
	@Override
	public String getName() {
		return id.toString();
	}
}
