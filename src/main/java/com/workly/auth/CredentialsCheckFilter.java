package com.workly.auth;

import com.workly.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Objects;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Ends a session whose credentials are out of date, before the request is
 * authorized: the member's password changed after the session's sign-in
 * checked it (SessionLogin.CREDENTIALS_VERSION against
 * users.credentials_version), or the member no longer exists. The request then
 * continues signed out (401 where a session is needed). Sessions from before
 * the version existed count as version 0. Costs one primary-key query per
 * request with a session.
 *
 * <p>Deleting a member's sessions on a password change ends them at once; this
 * check also catches a sign-in that read the old password just before the
 * change and saved its session right after the deletion.
 */
public class CredentialsCheckFilter extends OncePerRequestFilter {

	private final SecurityContextHolderStrategy contextHolder = SecurityContextHolder.getContextHolderStrategy();
	private final UserRepository users;

	public CredentialsCheckFilter(UserRepository users) {
		this.users = users;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Authentication authentication = contextHolder.getContext().getAuthentication();
		if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser member) {
			HttpSession session = request.getSession(false);
			Object stored = session == null ? null : session.getAttribute(SessionLogin.CREDENTIALS_VERSION);
			int sessionVersion = stored instanceof Integer version ? version : 0;
			Optional<Integer> current = users.findCredentialsVersion(member.id());
			if (current.isEmpty() || !Objects.equals(current.get(), sessionVersion)) {
				if (session != null) {
					session.invalidate();
				}
				contextHolder.clearContext();
			}
		}
		chain.doFilter(request, response);
	}
}
