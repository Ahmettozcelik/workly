package com.workly.auth;

import static com.workly.auth.BrowserClient.CSRF_COOKIE;
import static com.workly.auth.BrowserClient.SESSION_COOKIE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.workly.TestcontainersConfiguration;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * The auth API end to end inside the application: real PostgreSQL
 * (Testcontainers + Flyway), Spring Session JDBC, real CSRF tokens and cookies.
 * Every test uses its own email, so tests do not depend on each other.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthApiIntegrationTests {

	private static final String PASSWORD = "correct horse 1";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private JdbcTemplate jdbc;

	private BrowserClient browser;

	@BeforeEach
	void newBrowser() {
		browser = new BrowserClient(mvc);
	}

	private static String uniqueEmail() {
		return "member-" + UUID.randomUUID() + "@example.com";
	}

	private static String registerJson(String displayName, String email, String password, String locale) {
		return """
				{"displayName": %s, "email": %s, "password": %s, "locale": %s}"""
			.formatted(quote(displayName), quote(email), quote(password), quote(locale));
	}

	private static String loginJson(String email, String password) {
		return """
				{"email": %s, "password": %s}""".formatted(quote(email), quote(password));
	}

	private static String quote(String value) {
		return value == null ? "null" : "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
	}

	private String register(String email) throws Exception {
		browser.post("/api/auth/register", registerJson("Ayşe Yılmaz", email, PASSWORD, "tr"))
			.andExpect(status().isCreated());
		return email;
	}

	// --- CSRF -------------------------------------------------------------

	@Test
	void csrfEndpointIssuesATokenTheFrontendCanRead() throws Exception {
		var response = browser.get("/api/auth/csrf")
			.andExpect(status().isNoContent())
			.andReturn().getResponse();
		var setCookies = response.getHeaders(HttpHeaders.SET_COOKIE);
		String csrfCookie = setCookies.stream()
			.filter(cookie -> cookie.startsWith(CSRF_COOKIE + "="))
			.findFirst()
			.orElseThrow();
		// Readable by the frontend's JavaScript, unlike the session cookie.
		// SameSite=Lax (a cookie attribute, not in MockMvc's header text); Secure
		// only in the prod profile (ProductionProfileTests).
		assertThat(csrfCookie).doesNotContain("HttpOnly").doesNotContain("Secure");
		assertThat(response.getCookie(CSRF_COOKIE).getAttribute("SameSite")).isEqualTo("Lax");
		assertThat(browser.cookie(CSRF_COOKIE)).isNotBlank();
		// No session for anonymous visitors.
		assertThat(browser.cookie(SESSION_COOKIE)).isNull();
	}

	@Test
	void stateChangingRequestsWithoutTheCsrfHeaderAreRejected() throws Exception {
		browser.get("/api/auth/csrf");
		browser.postWithoutCsrfHeader("/api/auth/register", registerJson("Ali Veli", uniqueEmail(), PASSWORD, "tr"))
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
		browser.postWithoutCsrfHeader("/api/auth/logout", "{}")
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
	}

	// --- Register ---------------------------------------------------------

	@Test
	void registerCreatesTheAccountAndSignsIn() throws Exception {
		String email = uniqueEmail();
		browser.post("/api/auth/register", registerJson("  Ayşe Yılmaz  ", email, PASSWORD, "en"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").isNotEmpty())
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.displayName").value("Ayşe Yılmaz"))
			.andExpect(jsonPath("$.locale").value("en"))
			.andExpect(jsonPath("$.emailVerified").value(false))
			.andExpect(jsonPath("$.password").doesNotExist())
			.andExpect(jsonPath("$.passwordHash").doesNotExist())
			.andExpect(header().stringValues(HttpHeaders.SET_COOKIE, hasItem(allOf(
					containsString(SESSION_COOKIE + "="), containsString("HttpOnly"),
					containsString("SameSite=Lax"), containsString("Path=/")))));

		browser.get("/api/auth/me")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(email));

		var row = jdbc.queryForMap(
				"SELECT id, password_hash, email_verified, locale FROM users WHERE email = ?", email);
		assertThat((String) row.get("password_hash")).startsWith("{bcrypt}$2").doesNotContain(PASSWORD);
		assertThat(row.get("email_verified")).isEqualTo(false);
		assertThat(row.get("locale")).isEqualTo("en");

		// The session lives in PostgreSQL (Spring Session JDBC), keyed by the member
		// id, with the 12-hour idle timeout from application.yml.
		Integer timeout = jdbc.queryForObject(
				"SELECT max_inactive_interval FROM spring_session WHERE principal_name = ?", Integer.class,
				row.get("id").toString());
		assertThat(timeout).isEqualTo(12 * 60 * 60);
	}

	@Test
	void registerNormalisesTheEmailAndRejectsDuplicatesInAnyCase() throws Exception {
		String email = uniqueEmail();
		browser.post("/api/auth/register",
				registerJson("Ali Veli", "  " + email.toUpperCase() + " ", PASSWORD, null))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.locale").value("tr"));

		new BrowserClient(mvc).post("/api/auth/register", registerJson("Başka Biri", email, PASSWORD, "tr"))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
		assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Integer.class, email))
			.isEqualTo(1);
	}

	static Stream<Arguments> invalidRegistrations() {
		String email = "valid@example.com";
		return Stream.of(
				Arguments.of(registerJson("", email, PASSWORD, "tr"), "displayName", "REQUIRED"),
				Arguments.of(registerJson("   ", email, PASSWORD, "tr"), "displayName", "REQUIRED"),
				Arguments.of(registerJson("x".repeat(101), email, PASSWORD, "tr"), "displayName", "TOO_LONG"),
				Arguments.of(registerJson("Ali", "", PASSWORD, "tr"), "email", "REQUIRED"),
				Arguments.of(registerJson("Ali", "not-an-email", PASSWORD, "tr"), "email", "INVALID_EMAIL"),
				Arguments.of(registerJson("Ali", "a@b", PASSWORD, "tr"), "email", "INVALID_EMAIL"),
				Arguments.of(registerJson("Ali", email, "", "tr"), "password", "REQUIRED"),
				Arguments.of(registerJson("Ali", email, "1234567", "tr"), "password", "TOO_SHORT"),
				// 37 characters but 74 bytes: over bcrypt's 72-byte limit.
				Arguments.of(registerJson("Ali", email, "ş".repeat(37), "tr"), "password", "TOO_LONG"),
				Arguments.of(registerJson("Ali", email, PASSWORD, "de"), "locale", "INVALID_LOCALE"));
	}

	@ParameterizedTest
	@MethodSource("invalidRegistrations")
	void registerReportsTheFirstBrokenRulePerField(String json, String field, String code) throws Exception {
		browser.post("/api/auth/register", json)
			.andExpect(status().isBadRequest())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
			.andExpect(jsonPath("$.errors.length()").value(1))
			.andExpect(jsonPath("$.errors[0].field").value(field))
			.andExpect(jsonPath("$.errors[0].code").value(code));
		assertThat(browser.cookie(SESSION_COOKIE)).isNull();
	}

	@Test
	void registerAcceptsAPasswordOfExactly72Bytes() throws Exception {
		browser.post("/api/auth/register", registerJson("Ali", uniqueEmail(), "ş".repeat(36), "tr"))
			.andExpect(status().isCreated());
	}

	@Test
	void malformedJsonIsABadRequest() throws Exception {
		browser.post("/api/auth/register", "{not json")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
	}

	// --- Login ------------------------------------------------------------

	@Test
	void loginSignsInWithAnyCaseOfTheEmail() throws Exception {
		String email = register(uniqueEmail());
		BrowserClient other = new BrowserClient(mvc);
		other.post("/api/auth/login", loginJson(" " + email.toUpperCase() + " ", PASSWORD))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value(email))
			.andExpect(jsonPath("$.displayName").value("Ayşe Yılmaz"));
		other.get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void loginFailuresAreGenericAndStartNoSession() throws Exception {
		String email = register(uniqueEmail());
		String wrongPassword = new BrowserClient(mvc).post("/api/auth/login", loginJson(email, "wrong password"))
			.andExpect(status().isUnauthorized())
			.andReturn().getResponse().getContentAsString();

		BrowserClient stranger = new BrowserClient(mvc);
		String unknownEmail = stranger.post("/api/auth/login", loginJson(uniqueEmail(), PASSWORD))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
			.andReturn().getResponse().getContentAsString();

		assertThat(unknownEmail).isEqualTo(wrongPassword);
		assertThat(stranger.cookie(SESSION_COOKIE)).isNull();
		stranger.get("/api/auth/me").andExpect(status().isUnauthorized());
	}

	@Test
	void anOverlongPasswordIsJustAFailedLogin() throws Exception {
		String email = register(uniqueEmail());
		new BrowserClient(mvc).post("/api/auth/login", loginJson(email, "ş".repeat(100)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void loginRequiresBothFields() throws Exception {
		browser.post("/api/auth/login", loginJson("", ""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors.length()").value(2))
			.andExpect(jsonPath("$.errors[0].field").value("email"))
			.andExpect(jsonPath("$.errors[0].code").value("REQUIRED"))
			.andExpect(jsonPath("$.errors[1].field").value("password"))
			.andExpect(jsonPath("$.errors[1].code").value("REQUIRED"));
	}

	@Test
	void loginReplacesTheSessionIdAndTheCsrfToken() throws Exception {
		String email = register(uniqueEmail());
		String sessionBefore = browser.cookie(SESSION_COOKIE);
		String csrfBefore = browser.cookie(CSRF_COOKIE);

		browser.post("/api/auth/login", loginJson(email, PASSWORD)).andExpect(status().isOk());

		assertThat(browser.cookie(SESSION_COOKIE)).isNotBlank().isNotEqualTo(sessionBefore);
		assertThat(browser.cookie(CSRF_COOKIE)).isNotBlank().isNotEqualTo(csrfBefore);
		browser.get("/api/auth/me").andExpect(status().isOk());

		// The old session id no longer works (session fixation protection).
		BrowserClient attacker = new BrowserClient(mvc);
		attacker.setCookie(SESSION_COOKIE, sessionBefore);
		attacker.get("/api/auth/me").andExpect(status().isUnauthorized());
	}

	// --- Attempt limits (workly.auth.throttle in application.yml) ---------

	private static final int MAX_FAILURES_PER_EMAIL = 5;
	private static final int MAX_LOGINS_PER_ADDRESS = 20;
	private static final int MAX_REGISTRATIONS_PER_ADDRESS = 10;

	/** Failed sign-ins, each from a new address (so only the per-email limit applies). */
	private void failLogins(String email, int times) throws Exception {
		for (int i = 0; i < times; i++) {
			new BrowserClient(mvc).post("/api/auth/login", loginJson(email, "wrong password"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
		}
	}

	private static long retryAfterSeconds(ResultActions result) {
		return Long.parseLong(result.andReturn().getResponse().getHeader(HttpHeaders.RETRY_AFTER));
	}

	/** Moves an email's throttle row back in time, as if that much time had passed. */
	private void timePasses(String email, String interval) {
		jdbc.update("""
				UPDATE login_throttle
				SET window_started_at = window_started_at - CAST(? AS INTERVAL),
				    blocked_until = blocked_until - CAST(? AS INTERVAL)
				WHERE email_hash = ?""", interval, interval, LoginThrottle.hash(email));
	}

	@Test
	void repeatedFailedSignInsBlockTheEmailEvenWithTheRightPassword() throws Exception {
		String email = register(uniqueEmail());
		failLogins(email, MAX_FAILURES_PER_EMAIL);

		BrowserClient member = new BrowserClient(mvc);
		ResultActions blocked = member.post("/api/auth/login", loginJson(" " + email.toUpperCase(), PASSWORD))
			.andExpect(status().isTooManyRequests())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		assertThat(retryAfterSeconds(blocked)).isBetween(1L, 15 * 60L);
		assertThat(member.cookie(SESSION_COOKIE)).isNull();

		// Only this email: another member signs in as usual.
		String other = register(uniqueEmail());
		new BrowserClient(mvc).post("/api/auth/login", loginJson(other, PASSWORD)).andExpect(status().isOk());
	}

	@Test
	void unknownEmailsAreBlockedTheSameWay() throws Exception {
		String member = register(uniqueEmail());
		String unknown = uniqueEmail();
		failLogins(member, MAX_FAILURES_PER_EMAIL);
		failLogins(unknown, MAX_FAILURES_PER_EMAIL);

		String memberBody = new BrowserClient(mvc).post("/api/auth/login", loginJson(member, PASSWORD))
			.andExpect(status().isTooManyRequests())
			.andReturn().getResponse().getContentAsString();
		String unknownBody = new BrowserClient(mvc).post("/api/auth/login", loginJson(unknown, PASSWORD))
			.andExpect(status().isTooManyRequests())
			.andReturn().getResponse().getContentAsString();
		assertThat(unknownBody).isEqualTo(memberBody);
		// Stored by hash only, never the typed email.
		assertThat(jdbc.queryForObject("SELECT count(*) FROM login_throttle WHERE email_hash = ?", Integer.class,
				LoginThrottle.hash(unknown))).isEqualTo(1);
	}

	@Test
	void theBlockEndsAndASuccessfulSignInStartsOver() throws Exception {
		String email = register(uniqueEmail());
		failLogins(email, MAX_FAILURES_PER_EMAIL);
		timePasses(email, "16 minutes");

		new BrowserClient(mvc).post("/api/auth/login", loginJson(email, PASSWORD)).andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT count(*) FROM login_throttle WHERE email_hash = ?", Integer.class,
				LoginThrottle.hash(email))).isZero();
	}

	@Test
	void aSuccessfulSignInResetsTheCount() throws Exception {
		String email = register(uniqueEmail());
		failLogins(email, MAX_FAILURES_PER_EMAIL - 1);
		new BrowserClient(mvc).post("/api/auth/login", loginJson(email, PASSWORD)).andExpect(status().isOk());

		failLogins(email, MAX_FAILURES_PER_EMAIL - 1);
		new BrowserClient(mvc).post("/api/auth/login", loginJson(email, PASSWORD)).andExpect(status().isOk());
	}

	@Test
	void failuresAfterTheWindowStartANewCount() throws Exception {
		String email = register(uniqueEmail());
		failLogins(email, MAX_FAILURES_PER_EMAIL - 1);
		timePasses(email, "16 minutes");
		failLogins(email, MAX_FAILURES_PER_EMAIL - 1);

		assertThat(jdbc.queryForObject("SELECT failed_attempts FROM login_throttle WHERE email_hash = ?",
				Integer.class, LoginThrottle.hash(email))).isEqualTo(MAX_FAILURES_PER_EMAIL - 1);
		new BrowserClient(mvc).post("/api/auth/login", loginJson(email, PASSWORD)).andExpect(status().isOk());
	}

	@Test
	void tooManySignInsFromOneAddressAreRejected() throws Exception {
		BrowserClient device = new BrowserClient(mvc);
		for (int i = 0; i < MAX_LOGINS_PER_ADDRESS; i++) {
			device.post("/api/auth/login", loginJson(uniqueEmail(), PASSWORD)).andExpect(status().isUnauthorized());
		}
		ResultActions limited = device.post("/api/auth/login", loginJson(uniqueEmail(), PASSWORD))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		assertThat(retryAfterSeconds(limited)).isBetween(1L, 60L);

		// Other addresses are not affected.
		new BrowserClient(mvc).post("/api/auth/login", loginJson(uniqueEmail(), PASSWORD))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}

	@Test
	void tooManyRegistrationsFromOneAddressAreRejected() throws Exception {
		String address = BrowserClient.nextAddress();
		for (int i = 0; i < MAX_REGISTRATIONS_PER_ADDRESS; i++) {
			new BrowserClient(mvc, address)
				.post("/api/auth/register", registerJson("Ali Veli", uniqueEmail(), PASSWORD, "tr"))
				.andExpect(status().isCreated());
		}
		String email = uniqueEmail();
		ResultActions limited = new BrowserClient(mvc, address)
			.post("/api/auth/register", registerJson("Ali Veli", email, PASSWORD, "tr"))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		assertThat(retryAfterSeconds(limited)).isBetween(1L, 60 * 60L);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ?", Integer.class, email)).isZero();
	}

	// --- Me and logout ----------------------------------------------------

	@Test
	void meWithoutASessionIsUnauthenticated() throws Exception {
		browser.get("/api/auth/me")
			.andExpect(status().isUnauthorized())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
	}

	@Test
	void logoutEndsTheSessionInTheDatabase() throws Exception {
		String email = register(uniqueEmail());
		String session = browser.cookie(SESSION_COOKIE);
		String memberId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", String.class, email);

		browser.post("/api/auth/logout", "{}")
			.andExpect(status().isNoContent())
			.andExpect(header().stringValues(HttpHeaders.SET_COOKIE,
					hasItem(allOf(containsString(SESSION_COOKIE + "="), containsString("Max-Age=0")))));

		assertThat(browser.cookie(SESSION_COOKIE)).isNull();
		browser.get("/api/auth/me").andExpect(status().isUnauthorized());
		assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session WHERE principal_name = ?",
				Integer.class, memberId)).isZero();

		// Replaying the old cookie does not bring the session back.
		BrowserClient replay = new BrowserClient(mvc);
		replay.setCookie(SESSION_COOKIE, session);
		replay.get("/api/auth/me").andExpect(status().isUnauthorized());
	}

	// --- Everything else is protected -------------------------------------

	@Test
	void otherEndpointsNeedASessionAndOnlyHealthIsPublic() throws Exception {
		browser.get("/actuator/health").andExpect(status().isOk());
		browser.get("/actuator/env").andExpect(status().isUnauthorized());
		browser.get("/api/anything").andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
	}
}
