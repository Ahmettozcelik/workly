package com.workly.security;

import com.workly.user.EmailAddress;
import com.workly.user.UserRepository;
import com.workly.web.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.savedrequest.NullRequestCache;

/**
 * Session-based security for a same-origin SPA (the Next.js frontend proxies
 * /api to this server):
 * <ul>
 * <li>the session lives in PostgreSQL (Spring Session JDBC) behind an HttpOnly,
 * SameSite=Lax cookie (SessionCookieConfig);</li>
 * <li>CSRF: XSRF-TOKEN cookie, echoed in the X-XSRF-TOKEN header;</li>
 * <li>sign-in rotates the session id and the CSRF token (SessionLogin);</li>
 * <li>errors are JSON problem details, never redirects or login pages.</li>
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, CookieCsrfTokenRepository csrfTokenRepository,
			SecurityContextRepository securityContextRepository) throws Exception {
		http
			.authorizeHttpRequests(requests -> requests
				.requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
				.requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
				.requestMatchers("/error").permitAll()
				.anyRequest().authenticated())
			// spa(): cookie repository plus a handler that accepts the raw header token.
			.csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokenRepository))
			.securityContext(context -> context.securityContextRepository(securityContextRepository))
			.requestCache(cache -> cache.requestCache(new NullRequestCache()))
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(logout -> logout
				.logoutUrl("/api/auth/logout")
				.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
			.exceptionHandling(errors -> errors
				.authenticationEntryPoint((request, response, ex) -> write(response, ApiError.UNAUTHENTICATED))
				.accessDeniedHandler((request, response, ex) ->
					write(response, ex instanceof CsrfException ? ApiError.CSRF_INVALID : ApiError.FORBIDDEN)));
		return http.build();
	}

	private static void write(HttpServletResponse response, ApiError error) throws IOException {
		response.setStatus(error.status().value());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.getWriter().write(error.toJson());
	}

	/** Not HttpOnly: the frontend reads it and sends it back as X-XSRF-TOKEN. */
	@Bean
	CookieCsrfTokenRepository csrfTokenRepository() {
		return CookieCsrfTokenRepository.withHttpOnlyFalse();
	}

	@Bean
	SecurityContextRepository securityContextRepository() {
		return new HttpSessionSecurityContextRepository();
	}

	/** What happens on sign-in (SessionLogin): new session id, new CSRF token. */
	@Bean
	SessionAuthenticationStrategy sessionAuthenticationStrategy(CookieCsrfTokenRepository csrfTokenRepository) {
		return new CompositeSessionAuthenticationStrategy(List.of(
				new ChangeSessionIdAuthenticationStrategy(),
				new CsrfAuthenticationStrategy(csrfTokenRepository)));
	}

	/** bcrypt by default; the {id} prefix in stored hashes allows upgrading later. */
	@Bean
	PasswordEncoder passwordEncoder() {
		return PasswordEncoderFactories.createDelegatingPasswordEncoder();
	}

	/** Looks members up by email; the username Spring Security sees is the member's id. */
	@Bean
	UserDetailsService userDetailsService(UserRepository users) {
		return email -> users.findByEmail(EmailAddress.normalize(email))
			.map(user -> org.springframework.security.core.userdetails.User
				.withUsername(user.getId().toString())
				.password(user.getPasswordHash())
				.authorities("ROLE_USER")
				.build())
			.orElseThrow(() -> new UsernameNotFoundException("Unknown email"));
	}

	@Bean
	AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}
}
