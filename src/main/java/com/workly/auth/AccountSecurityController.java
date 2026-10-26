package com.workly.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The signed-in member's password and sessions. Every endpoint needs a
 * session; the state-changing ones the CSRF token too.
 */
@RestController
@RequestMapping("/api/auth")
class AccountSecurityController {

	private final PasswordChangeService passwordChange;
	private final MemberSessions memberSessions;

	AccountSecurityController(PasswordChangeService passwordChange, MemberSessions memberSessions) {
		this.passwordChange = passwordChange;
		this.memberSessions = memberSessions;
	}

	/**
	 * Changes the password and ends every other session; this one continues
	 * under a new id. 400 VALIDATION_FAILED: the registration rules for the new
	 * password, currentPassword INCORRECT, newPassword SAME_AS_CURRENT.
	 * 429 RATE_LIMITED: too many wrong passwords for this email (as sign-in).
	 */
	@PostMapping("/password")
	ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthenticatedUser principal,
			@Valid @RequestBody AuthRequests.ChangePassword body, HttpServletRequest request) {
		int credentialsVersion = passwordChange.change(principal.id(), body.currentPassword(), body.newPassword());
		HttpSession session = request.getSession();
		memberSessions.revokeOthers(principal.id(), session.getId());
		// Still signed in with the new password: a new id, and the new version.
		request.changeSessionId();
		session.setAttribute(SessionLogin.CREDENTIALS_VERSION, credentialsVersion);
		return ResponseEntity.noContent().build();
	}

	/** The member's sessions, this one first. Ids are opaque handles, never session ids. */
	@GetMapping("/sessions")
	List<MemberSessions.Info> sessions(@AuthenticationPrincipal AuthenticatedUser principal,
			HttpServletRequest request) {
		return memberSessions.list(principal.id(), request.getSession().getId());
	}

	/**
	 * Ends one of the member's sessions. Ending this one signs the request out,
	 * like logout. 404 NOT_FOUND for an unknown id (or another member's).
	 */
	@DeleteMapping("/sessions/{id}")
	ResponseEntity<Void> revokeSession(@AuthenticationPrincipal AuthenticatedUser principal,
			@PathVariable String id, HttpServletRequest request) {
		HttpSession session = request.getSession();
		if (memberSessions.revoke(principal.id(), id, session.getId())) {
			session.invalidate();
			SecurityContextHolder.clearContext();
		}
		return ResponseEntity.noContent().build();
	}

	/** Ends every session of the member except this one. */
	@PostMapping("/sessions/revoke-others")
	ResponseEntity<Void> revokeOtherSessions(@AuthenticationPrincipal AuthenticatedUser principal,
			HttpServletRequest request) {
		memberSessions.revokeOthers(principal.id(), request.getSession().getId());
		return ResponseEntity.noContent().build();
	}
}
