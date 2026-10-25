package com.workly.auth;

import com.workly.user.EmailAddress;
import com.workly.user.User;
import com.workly.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

	private static final String DEFAULT_LOCALE = "tr";

	private final UserRepository users;
	private final PasswordEncoder passwordEncoder;
	private final AuthenticationManager authenticationManager;

	AuthService(UserRepository users, PasswordEncoder passwordEncoder, AuthenticationManager authenticationManager) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.authenticationManager = authenticationManager;
	}

	/** Creates the member; the request is already validated. */
	public User register(AuthRequests.Register request) {
		String email = EmailAddress.normalize(request.email());
		if (users.existsByEmail(email)) {
			throw new EmailAlreadyRegisteredException();
		}
		String locale = request.locale() == null ? DEFAULT_LOCALE : request.locale();
		User user = new User(email, passwordEncoder.encode(request.password()), request.displayName(), locale);
		try {
			return users.saveAndFlush(user);
		}
		catch (DataIntegrityViolationException ex) {
			// Lost a race with a concurrent registration of the same email.
			throw new EmailAlreadyRegisteredException();
		}
	}

	/**
	 * Checks the credentials. Every failure is the same BadCredentialsException,
	 * and an unknown email still costs a password check (DaoAuthenticationProvider),
	 * so the response never reveals whether an account exists.
	 */
	public User authenticate(AuthRequests.Login request) {
		// Longer passwords can never match (registration caps them); bcrypt would reject them.
		if (request.password().getBytes(StandardCharsets.UTF_8).length > AuthRequests.PASSWORD_MAX_BYTES) {
			throw new BadCredentialsException("Bad credentials");
		}
		Authentication result = authenticationManager.authenticate(
				UsernamePasswordAuthenticationToken.unauthenticated(
						EmailAddress.normalize(request.email()), request.password()));
		UUID id = UUID.fromString(((UserDetails) result.getPrincipal()).getUsername());
		return users.findById(id).orElseThrow(() -> new BadCredentialsException("Bad credentials"));
	}
}
