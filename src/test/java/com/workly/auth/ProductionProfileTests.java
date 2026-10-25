package com.workly.auth;

import static com.workly.auth.BrowserClient.CSRF_COOKIE;
import static com.workly.auth.BrowserClient.SESSION_COOKIE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.workly.MailTestConfiguration;
import com.workly.TestcontainersConfiguration;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The application under the "prod" profile, with valid settings: it starts,
 * both cookies are Secure and SameSite=Lax, and Boot's /error fallback carries
 * no details. The DB_* values only satisfy ProductionSettingsCheck; the
 * Testcontainers connection replaces them. MAIL_* likewise: mails are recorded,
 * never sent.
 */
@SpringBootTest(properties = {
		"DB_URL=jdbc:postgresql://replaced-by-testcontainers/workly",
		"DB_USERNAME=replaced-by-testcontainers",
		"DB_PASSWORD=replaced-by-testcontainers",
		"MAIL_HOST=smtp.invalid",
		"MAIL_PORT=587",
		"MAIL_USERNAME=unused",
		"MAIL_PASSWORD=unused",
		"MAIL_FROM=no-reply@workly.example",
		"APP_BASE_URL=https://workly.example" })
@ActiveProfiles("prod")
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, MailTestConfiguration.class })
class ProductionProfileTests {

	@Autowired
	private MockMvc mvc;

	private static String cookieHeader(List<String> setCookies, String name) {
		return setCookies.stream().filter(cookie -> cookie.startsWith(name + "=")).findFirst().orElseThrow();
	}

	/**
	 * XSRF-TOKEN is a Servlet cookie with SameSite as a cookie attribute
	 * (Spring Security's CookieCsrfTokenRepository). Tomcat writes it into
	 * Set-Cookie; MockMvc's header text leaves it out, so check the cookie.
	 */
	private static void assertSecureLaxCsrfCookie(MockHttpServletResponse response) {
		Cookie csrf = response.getCookie(CSRF_COOKIE);
		assertThat(csrf).isNotNull();
		assertThat(csrf.getSecure()).isTrue();
		assertThat(csrf.isHttpOnly()).isFalse();
		assertThat(csrf.getAttribute("SameSite")).isEqualTo("Lax");
	}

	@Test
	void sessionAndCsrfCookiesAreSecureAndSameSiteLax() throws Exception {
		BrowserClient browser = new BrowserClient(mvc);
		assertSecureLaxCsrfCookie(browser.get("/api/auth/csrf")
			.andExpect(status().isNoContent())
			.andReturn().getResponse());

		MockHttpServletResponse registered = browser.post("/api/auth/register", """
				{"displayName": "Prod Test", "email": "prod-%s@example.com", "password": "correct horse 1"}"""
				.formatted(UUID.randomUUID()))
			.andExpect(status().isCreated())
			.andReturn().getResponse();
		assertThat(cookieHeader(registered.getHeaders(HttpHeaders.SET_COOKIE), SESSION_COOKIE))
			.contains("Secure", "HttpOnly", "SameSite=Lax");
		assertSecureLaxCsrfCookie(registered);
	}

	@Test
	void theErrorFallbackHasNoDetails() throws Exception {
		String body = mvc.perform(get("/error")
				.accept(MediaType.APPLICATION_JSON)
				.requestAttr(RequestDispatcher.ERROR_STATUS_CODE, 500)
				.requestAttr(RequestDispatcher.ERROR_REQUEST_URI, "/internal/secret-path")
				.requestAttr(RequestDispatcher.ERROR_MESSAGE, "secret detail")
				.requestAttr(RequestDispatcher.ERROR_EXCEPTION, new IllegalStateException("secret detail")))
			.andExpect(status().isInternalServerError())
			.andReturn().getResponse().getContentAsString();
		assertThat(body).doesNotContain("secret", "trace", "exception", "path", "message");
	}
}
