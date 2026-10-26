package com.workly.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.workly.MailTestConfiguration;
import com.workly.TestcontainersConfiguration;
import com.workly.mail.OutgoingMail;
import com.workly.mail.RecordingMailer;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Password reset through the API: the generic answer, the mailed link (recorded,
 * not sent), single use, expiry, replacement, the limits, and what a reset does
 * to the account (password, verification, sign-in block, sessions). The first
 * member limit is raised to 2 per minute here so a link can be replaced within
 * a test; the limit itself is checked with a third request.
 */
@SpringBootTest(properties = {
		"workly.auth.password-reset.member-limits[0].max-requests=2",
		"workly.auth.password-reset.member-limits[0].window=1m",
		"workly.auth.password-reset.member-limits[1].max-requests=5",
		"workly.auth.password-reset.member-limits[1].window=1h" })
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, MailTestConfiguration.class })
class PasswordResetIntegrationTests {

	private static final String PASSWORD = "correct horse 1";
	private static final String NEW_PASSWORD = "new battery staple 2";
	// workly.auth.verification.base-url default in application.yml.
	private static final Pattern LINK =
			Pattern.compile("http://localhost:3000/(tr|en)/reset-password\\?token=([A-Za-z0-9_-]{43})");
	private static final String RESET_SUBJECT_TR = "Workly şifreni sıfırla";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private RecordingMailer mailer;

	@Autowired
	private PasswordResetService passwordReset;

	private static String uniqueEmail() {
		return "member-" + UUID.randomUUID() + "@example.com";
	}

	private static String loginJson(String email, String password) {
		return """
				{"email": "%s", "password": "%s"}""".formatted(email, password);
	}

	private static String resetJson(String token, String password) {
		return """
				{"token": "%s", "password": "%s"}""".formatted(token, password);
	}

	/** Registers a member and returns a browser signed in as them. */
	private BrowserClient member(String email, String locale) throws Exception {
		BrowserClient browser = new BrowserClient(mvc);
		browser.post("/api/auth/register", """
				{"displayName": "Deniz Arslan", "email": "%s", "password": "%s", "locale": "%s"}"""
				.formatted(email, PASSWORD, locale))
			.andExpect(status().isAccepted());
		signIn(browser, email, PASSWORD).andExpect(status().isOk());
		return browser;
	}

	private ResultActions signIn(BrowserClient browser, String email, String password) throws Exception {
		return browser.post("/api/auth/login", loginJson(email, password));
	}

	private ResultActions requestReset(String email) throws Exception {
		return new BrowserClient(mvc).post("/api/auth/password-reset", "{\"email\": \"" + email + "\"}");
	}

	private ResultActions reset(String token, String password) throws Exception {
		return new BrowserClient(mvc).post("/api/auth/password-reset/confirm", resetJson(token, password));
	}

	private List<OutgoingMail> resetMails(String email) {
		return mailer.sentTo(email).stream()
			.filter(mail -> mail.subject().equals(RESET_SUBJECT_TR) || mail.subject().equals("Reset your Workly password"))
			.toList();
	}

	private Matcher lastLink(String email) {
		List<OutgoingMail> mails = resetMails(email);
		assertThat(mails).isNotEmpty();
		Matcher link = LINK.matcher(mails.getLast().text());
		assertThat(link.find()).as("reset link in the mail").isTrue();
		return link;
	}

	private String lastToken(String email) {
		return lastLink(email).group(2);
	}

	private String passwordHash(String email) {
		return jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
	}

	// --- Asking for a link --------------------------------------------------

	@Test
	void aKnownEmailGetsALinkInTheMembersLanguage() throws Exception {
		String tr = uniqueEmail();
		member(tr, "tr");
		requestReset(tr).andExpect(status().isAccepted()).andExpect(content().string(""));
		OutgoingMail mail = resetMails(tr).getFirst();
		assertThat(mail.subject()).isEqualTo(RESET_SUBJECT_TR);
		assertThat(mail.text()).contains("Merhaba Deniz Arslan", "30 dakika");
		assertThat(lastLink(tr).group(1)).isEqualTo("tr");

		String en = uniqueEmail();
		member(en, "en");
		// Any case and surrounding spaces.
		requestReset("  " + en.toUpperCase() + " ").andExpect(status().isAccepted());
		assertThat(resetMails(en).getFirst().subject()).isEqualTo("Reset your Workly password");
		assertThat(resetMails(en).getFirst().text()).contains("30 minutes");
		assertThat(lastLink(en).group(1)).isEqualTo("en");
	}

	@Test
	void knownAndUnknownEmailsGetTheSameAnswer() throws Exception {
		String known = uniqueEmail();
		member(known, "tr");
		String unknown = uniqueEmail();

		var knownResponse = requestReset(known).andReturn().getResponse();
		var unknownResponse = requestReset(unknown).andReturn().getResponse();
		assertThat(knownResponse.getStatus()).isEqualTo(unknownResponse.getStatus()).isEqualTo(202);
		assertThat(knownResponse.getContentAsString()).isEqualTo(unknownResponse.getContentAsString()).isEmpty();
		assertThat(knownResponse.getHeaderNames()).isEqualTo(unknownResponse.getHeaderNames());
		for (String name : unknownResponse.getHeaderNames()) {
			assertThat(knownResponse.getHeaders(name)).as(name).isEqualTo(unknownResponse.getHeaders(name));
		}
		assertThat(resetMails(known)).hasSize(1);
		assertThat(mailer.sentTo(unknown)).isEmpty();
	}

	@Test
	void onlyTheHashOfTheTokenIsStored() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		requestReset(email);
		String token = lastToken(email);
		List<String> hashes = jdbc.queryForList("""
				SELECT t.token_hash FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
				WHERE u.email = ?""", String.class, email);
		assertThat(hashes).containsExactly(LinkTokens.hash(token));
	}

	@Test
	void aMemberHasAtMostOneUnusedLink() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		requestReset(email);
		String first = lastToken(email);
		requestReset(email);
		String second = lastToken(email);
		assertThat(second).isNotEqualTo(first);
		reset(first, NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));

		// The database refuses a second unused token (two concurrent requests).
		String memberId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", String.class, email);
		assertThatExceptionOfType(DataIntegrityViolationException.class).isThrownBy(() -> jdbc.update("""
				INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
				VALUES (gen_random_uuid(), CAST(? AS UUID), ?, now() + INTERVAL '30 minutes', now())""",
				memberId, "f".repeat(64)));

		reset(second, NEW_PASSWORD).andExpect(status().isNoContent());
	}

	@Test
	void requestsArePerMemberLimitedQuietly() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		for (int i = 0; i < 3; i++) {
			requestReset(email).andExpect(status().isAccepted());
		}
		// 2 per minute in this test (1 in application.yml): the third is answered alike, without a mail.
		assertThat(resetMails(email)).hasSize(2);
	}

	@Test
	void tooManyRequestsFromOneAddressAreRejected() throws Exception {
		String address = BrowserClient.nextAddress();
		for (int i = 0; i < 10; i++) {
			new BrowserClient(mvc, address).post("/api/auth/password-reset", "{\"email\": \"" + uniqueEmail() + "\"}")
				.andExpect(status().isAccepted());
		}
		String retryAfter = new BrowserClient(mvc, address)
			.post("/api/auth/password-reset", "{\"email\": \"" + uniqueEmail() + "\"}")
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"))
			.andReturn().getResponse().getHeader(HttpHeaders.RETRY_AFTER);
		assertThat(Long.parseLong(retryAfter)).isBetween(1L, 60 * 60L);
	}

	@Test
	void anInvalidEmailIsAValidationError() throws Exception {
		new BrowserClient(mvc).post("/api/auth/password-reset", "{\"email\": \"not-an-email\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("email"))
			.andExpect(jsonPath("$.errors[0].code").value("INVALID_EMAIL"));
		new BrowserClient(mvc).post("/api/auth/password-reset", "{}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].code").value("REQUIRED"));
	}

	@Test
	void bothEndpointsNeedTheCsrfToken() throws Exception {
		BrowserClient stranger = new BrowserClient(mvc);
		stranger.get("/api/auth/csrf");
		stranger.postWithoutCsrfHeader("/api/auth/password-reset", "{\"email\": \"" + uniqueEmail() + "\"}")
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
		stranger.postWithoutCsrfHeader("/api/auth/password-reset/confirm", resetJson("x".repeat(43), NEW_PASSWORD))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
	}

	// --- Using a link -------------------------------------------------------

	@Test
	void theLinkSetsTheNewPasswordAndVerifiesTheEmail() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		requestReset(email);
		// Opened on another device, signed out.
		reset(lastToken(email), NEW_PASSWORD).andExpect(status().isNoContent()).andExpect(content().string(""));

		signIn(new BrowserClient(mvc), email, PASSWORD).andExpect(status().isUnauthorized());
		BrowserClient browser = new BrowserClient(mvc);
		signIn(browser, email, NEW_PASSWORD).andExpect(status().isOk())
			.andExpect(jsonPath("$.emailVerified").value(true));
		assertThat(passwordHash(email)).startsWith("{bcrypt}$2");

		OutgoingMail changed = mailer.sentTo(email).getLast();
		assertThat(changed.subject()).isEqualTo("Workly şifren değiştirildi");
		assertThat(changed.text()).contains("Merhaba Deniz Arslan", "http://localhost:3000/tr/forgot-password");
	}

	@Test
	void aResetEndsEverySessionOfTheMemberOnly() throws Exception {
		String email = uniqueEmail();
		BrowserClient laptop = member(email, "en");
		BrowserClient phone = new BrowserClient(mvc);
		signIn(phone, email, PASSWORD).andExpect(status().isOk());
		String otherEmail = uniqueEmail();
		BrowserClient otherMember = member(otherEmail, "tr");

		requestReset(email);
		// From the signed-in laptop: its own session ends too.
		laptop.post("/api/auth/password-reset/confirm", resetJson(lastToken(email), NEW_PASSWORD))
			.andExpect(status().isNoContent());

		laptop.get("/api/auth/me").andExpect(status().isUnauthorized());
		phone.get("/api/auth/me").andExpect(status().isUnauthorized());
		String memberId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", String.class, email);
		assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session WHERE principal_name = ?",
				Integer.class, memberId)).isZero();
		otherMember.get("/api/auth/me").andExpect(status().isOk());
		assertThat(mailer.sentTo(email).getLast().subject()).isEqualTo("Your Workly password was changed");
	}

	@Test
	void aResetLiftsASignInBlock() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		for (int i = 0; i < 5; i++) {
			signIn(new BrowserClient(mvc), email, "wrong password").andExpect(status().isUnauthorized());
		}
		signIn(new BrowserClient(mvc), email, PASSWORD).andExpect(status().isTooManyRequests());

		requestReset(email);
		reset(lastToken(email), NEW_PASSWORD).andExpect(status().isNoContent());
		signIn(new BrowserClient(mvc), email, NEW_PASSWORD).andExpect(status().isOk());
	}

	@Test
	void unknownUsedAndExpiredLinksAreInvalidAndChangeNothing() throws Exception {
		reset("x".repeat(43), NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));

		String used = uniqueEmail();
		member(used, "tr");
		requestReset(used);
		String usedToken = lastToken(used);
		reset(usedToken, NEW_PASSWORD).andExpect(status().isNoContent());
		String hashAfterReset = passwordHash(used);
		reset(usedToken, "yet another password").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
		assertThat(passwordHash(used)).isEqualTo(hashAfterReset);

		String expired = uniqueEmail();
		member(expired, "tr");
		requestReset(expired);
		String expiredToken = lastToken(expired);
		String hashBefore = passwordHash(expired);
		jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - INTERVAL '1 second' WHERE token_hash = ?",
				LinkTokens.hash(expiredToken));
		reset(expiredToken, NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("PASSWORD_RESET_TOKEN_INVALID"));
		assertThat(passwordHash(expired)).isEqualTo(hashBefore);
		signIn(new BrowserClient(mvc), expired, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void theNewPasswordFollowsTheRegistrationRules() throws Exception {
		reset("x".repeat(43), "1234567").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("password"))
			.andExpect(jsonPath("$.errors[0].code").value("TOO_SHORT"));
		// 37 characters but 74 bytes: over bcrypt's 72-byte limit.
		reset("x".repeat(43), "ş".repeat(37)).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].code").value("TOO_LONG"));
		new BrowserClient(mvc).post("/api/auth/password-reset/confirm", "{\"password\": \"" + NEW_PASSWORD + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("token"))
			.andExpect(jsonPath("$.errors[0].code").value("REQUIRED"));
		reset("x".repeat(101), NEW_PASSWORD).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].code").value("TOO_LONG"));
	}

	@Test
	void twoConcurrentUsesOfOneLinkSucceedOnce() throws Exception {
		String email = uniqueEmail();
		member(email, "tr");
		requestReset(email);
		String token = lastToken(email);

		CountDownLatch start = new CountDownLatch(1);
		Callable<Boolean> use = () -> {
			start.await();
			try {
				passwordReset.reset(token, NEW_PASSWORD);
				return true;
			}
			catch (InvalidPasswordResetTokenException ex) {
				return false;
			}
		};
		ExecutorService threads = Executors.newFixedThreadPool(2);
		try {
			Future<Boolean> first = threads.submit(use);
			Future<Boolean> second = threads.submit(use);
			start.countDown();
			assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(true, false);
		}
		finally {
			threads.shutdownNow();
		}
		assertThat(mailer.sentTo(email).stream()
			.filter(mail -> mail.subject().equals("Workly şifren değiştirildi"))).hasSize(1);
	}
}
