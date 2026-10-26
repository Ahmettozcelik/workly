package com.workly.auth;

import com.workly.user.UserRepository;
import com.workly.web.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session-based auth API. Logout (POST /api/auth/logout) is handled by Spring
 * Security's logout filter (see SecurityConfig).
 */
@RestController
@RequestMapping("/api/auth")
class AuthController {

	private final AuthService authService;
	private final SessionLogin sessionLogin;
	private final UserRepository users;
	private final AddressRateLimits addressRateLimits;
	private final EmailVerificationService emailVerification;
	private final PasswordResetService passwordReset;

	AuthController(AuthService authService, SessionLogin sessionLogin, UserRepository users,
			AddressRateLimits addressRateLimits, EmailVerificationService emailVerification,
			PasswordResetService passwordReset) {
		this.authService = authService;
		this.sessionLogin = sessionLogin;
		this.users = users;
		this.addressRateLimits = addressRateLimits;
		this.emailVerification = emailVerification;
		this.passwordReset = passwordReset;
	}

	/** Issues the XSRF-TOKEN cookie that every state-changing request must echo. */
	@GetMapping("/csrf")
	ResponseEntity<Void> csrf(CsrfToken token) {
		token.getToken();
		return ResponseEntity.noContent().build();
	}

	/**
	 * 202 with no body for every valid request, whether or not the email already
	 * has an account (see AuthService.register); what happened is mailed to the
	 * address. No session: the member signs in afterwards.
	 * 429 RATE_LIMITED: too many from this address.
	 */
	@PostMapping("/register")
	ResponseEntity<Void> register(@Valid @RequestBody AuthRequests.Register body, HttpServletRequest request) {
		addressRateLimits.checkRegister(request);
		authService.register(body);
		return ResponseEntity.accepted().build();
	}

	/** 429 RATE_LIMITED: too many attempts from this address, or this email is blocked for a while. */
	@PostMapping("/login")
	UserResponse login(@Valid @RequestBody AuthRequests.Login body, HttpServletRequest request,
			HttpServletResponse response) {
		addressRateLimits.checkLogin(request);
		var user = authService.authenticate(body);
		sessionLogin.logIn(user, request, response);
		return UserResponse.of(user);
	}

	/**
	 * Confirms a verification link. Public: the link may be opened signed out or
	 * on another device (CSRF still applies). 400 VERIFICATION_TOKEN_INVALID for
	 * an unknown, used or expired link.
	 */
	@PostMapping("/verify-email")
	ResponseEntity<Void> verifyEmail(@Valid @RequestBody AuthRequests.VerifyEmail body) {
		emailVerification.verify(body.token());
		return ResponseEntity.noContent().build();
	}

	/**
	 * Mails a new verification link to the signed-in member (none if already
	 * verified). 429 RATE_LIMITED past the per-member limits.
	 */
	@PostMapping("/verification-email")
	ResponseEntity<Void> resendVerificationEmail(@AuthenticationPrincipal AuthenticatedUser principal) {
		emailVerification.resend(principal.id());
		return ResponseEntity.noContent().build();
	}

	/**
	 * Mails a password reset link if the email has an account. 202 with no
	 * body either way (see PasswordResetService). Public, CSRF applies.
	 * 429 RATE_LIMITED: too many from this address.
	 */
	@PostMapping("/password-reset")
	ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody AuthRequests.PasswordReset body,
			HttpServletRequest request) {
		addressRateLimits.checkPasswordReset(request);
		passwordReset.request(body.email());
		return ResponseEntity.accepted().build();
	}

	/**
	 * Sets a new password with a reset link's token and ends every session of
	 * the member (no sign-in). Public, CSRF applies. 400
	 * PASSWORD_RESET_TOKEN_INVALID for an unknown, used or expired link.
	 */
	@PostMapping("/password-reset/confirm")
	ResponseEntity<Void> resetPassword(@Valid @RequestBody AuthRequests.PasswordResetConfirm body) {
		passwordReset.reset(body.token(), body.password());
		return ResponseEntity.noContent().build();
	}

	/** The signed-in member; 401 without a valid session. */
	@GetMapping("/me")
	ResponseEntity<?> me(@AuthenticationPrincipal AuthenticatedUser principal, HttpServletRequest request) {
		return users.findById(principal.id())
			.<ResponseEntity<?>>map(user -> ResponseEntity.ok(UserResponse.of(user)))
			.orElseGet(() -> {
				// The account no longer exists: end the stale session.
				HttpSession session = request.getSession(false);
				if (session != null) {
					session.invalidate();
				}
				return ApiError.UNAUTHENTICATED.toResponse();
			});
	}
}
