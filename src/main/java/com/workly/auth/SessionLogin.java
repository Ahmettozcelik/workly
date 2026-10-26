package com.workly.auth;

import com.workly.user.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Component;

/**
 * Starts an authenticated session for a member, as Spring Security's own login
 * filters would: new session id (fixation protection), new CSRF token, and the
 * security context saved in the (JDBC-backed) session. The session also keeps
 * the credentials version the sign-in checked (CredentialsCheckFilter) and a
 * coarse device label for the session list (DeviceLabel).
 */
@Component
class SessionLogin {

	/** Session attribute: the member's credentials version when this session signed in. */
	static final String CREDENTIALS_VERSION = "workly.credentialsVersion";

	/** Session attribute: e.g. "Chrome · Windows"; absent when not recognised. */
	static final String DEVICE = "workly.device";

	private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();
	private final SessionAuthenticationStrategy sessionStrategy;
	private final SecurityContextRepository contextRepository;

	SessionLogin(SessionAuthenticationStrategy sessionStrategy, SecurityContextRepository contextRepository) {
		this.sessionStrategy = sessionStrategy;
		this.contextRepository = contextRepository;
	}

	/** credentialsVersion: read with the password hash the sign-in checked (MemberDetails). */
	void logIn(User user, int credentialsVersion, HttpServletRequest request, HttpServletResponse response) {
		Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
				new AuthenticatedUser(user.getId()), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
		SecurityContext context = contextHolder.createEmptyContext();
		context.setAuthentication(authentication);
		contextHolder.setContext(context);

		sessionStrategy.onAuthentication(authentication, request, response);
		contextRepository.saveContext(context, request, response);
		request.getSession().setAttribute(CREDENTIALS_VERSION, credentialsVersion);
		request.getSession().setAttribute(DEVICE, DeviceLabel.of(request.getHeader("User-Agent")));

		// The CSRF strategy replaced the token lazily; load it so the response
		// carries the new XSRF-TOKEN cookie for the client's next request.
		if (request.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken token) {
			token.getToken();
		}
	}
}
