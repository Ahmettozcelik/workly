package com.workly.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.workly.MailTestConfiguration;
import com.workly.TestcontainersConfiguration;
import com.workly.mail.OutgoingMail;
import com.workly.mail.RecordingMailer;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Email verification through the API: the mail (recorded, not sent), the link,
 * single use, expiry, the resend limits. Same context as AuthApiIntegrationTests.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, MailTestConfiguration.class })
class EmailVerificationIntegrationTests {

	private static final String PASSWORD = "correct horse 1";
	// workly.auth.verification.base-url default in application.yml.
	private static final Pattern LINK =
			Pattern.compile("http://localhost:3000/(tr|en)/verify-email\\?token=([A-Za-z0-9_-]{43})");

	@Autowired
	private MockMvc mvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private RecordingMailer mailer;

	@AfterEach
	void sendMailsAgain() {
		mailer.failSends(false);
	}

	private record Member(String email, BrowserClient browser) {
	}

	private static String registerJson(String email, String locale) {
		return """
				{"displayName": "Deniz Arslan", "email": "%s", "password": "%s", "locale": "%s"}"""
			.formatted(email, PASSWORD, locale);
	}

	/** Registers, then signs in with the member's browser (registering starts no session). */
	private Member register(String locale) throws Exception {
		String email = "member-" + UUID.randomUUID() + "@example.com";
		BrowserClient browser = new BrowserClient(mvc);
		browser.post("/api/auth/register", registerJson(email, locale)).andExpect(status().isAccepted());
		browser.post("/api/auth/login", """
				{"email": "%s", "password": "%s"}""".formatted(email, PASSWORD))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.emailVerified").value(false));
		return new Member(email, browser);
	}

	/** Someone registers with the member's email again, from another device. */
	private void registerAgain(Member member, String locale) throws Exception {
		new BrowserClient(mvc).post("/api/auth/register", registerJson(member.email(), locale))
			.andExpect(status().isAccepted())
			.andExpect(content().string(""));
	}

	private Matcher lastLink(String email) {
		List<OutgoingMail> mails = mailer.sentTo(email);
		assertThat(mails).isNotEmpty();
		Matcher link = LINK.matcher(mails.getLast().text());
		assertThat(link.find()).as("verification link in the mail").isTrue();
		return link;
	}

	private String lastToken(String email) {
		return lastLink(email).group(2);
	}

	private static String verifyJson(String token) {
		return "{\"token\": \"" + token + "\"}";
	}

	private Integer tokenRows(String email) {
		return jdbc.queryForObject("""
				SELECT count(*) FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
				WHERE u.email = ?""", Integer.class, email);
	}

	@Test
	void registerMailsALinkInTheMembersLanguage() throws Exception {
		Member tr = register("tr");
		OutgoingMail trMail = mailer.sentTo(tr.email()).getFirst();
		assertThat(mailer.sentTo(tr.email())).hasSize(1);
		assertThat(trMail.subject()).isEqualTo("Workly e-posta adresini doğrula");
		assertThat(trMail.text()).contains("Merhaba Deniz Arslan", "24 saat");
		assertThat(lastLink(tr.email()).group(1)).isEqualTo("tr");

		Member en = register("en");
		assertThat(mailer.sentTo(en.email()).getFirst().subject()).isEqualTo("Verify your email for Workly");
		assertThat(lastLink(en.email()).group(1)).isEqualTo("en");
	}

	@Test
	void onlyTheHashOfTheTokenIsStored() throws Exception {
		Member member = register("tr");
		String token = lastToken(member.email());
		List<String> hashes = jdbc.queryForList("""
				SELECT t.token_hash FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
				WHERE u.email = ?""", String.class, member.email());
		assertThat(hashes).containsExactly(EmailVerificationService.hash(token));
		assertThat(hashes.getFirst()).isNotEqualTo(token).hasSize(64);
	}

	@Test
	void theLinkVerifiesTheMemberWithoutASession() throws Exception {
		Member member = register("tr");
		// Opened on another device: no session, only a CSRF token.
		new BrowserClient(mvc).post("/api/auth/verify-email", verifyJson(lastToken(member.email())))
			.andExpect(status().isNoContent());

		member.browser().get("/api/auth/me").andExpect(jsonPath("$.emailVerified").value(true));
		assertThat(jdbc.queryForObject("SELECT email_verified FROM users WHERE email = ?", Boolean.class,
				member.email())).isTrue();
	}

	@Test
	void verifyNeedsTheCsrfToken() throws Exception {
		Member member = register("tr");
		BrowserClient stranger = new BrowserClient(mvc);
		stranger.get("/api/auth/csrf");
		stranger.postWithoutCsrfHeader("/api/auth/verify-email", verifyJson(lastToken(member.email())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
		member.browser().get("/api/auth/me").andExpect(jsonPath("$.emailVerified").value(false));
	}

	@Test
	void aLinkWorksOnceAndASecondClickIsHarmless() throws Exception {
		Member member = register("tr");
		String token = lastToken(member.email());
		member.browser().post("/api/auth/verify-email", verifyJson(token)).andExpect(status().isNoContent());
		// Same link again (a double click, or opened twice): the member is verified, so it is fine.
		member.browser().post("/api/auth/verify-email", verifyJson(token)).andExpect(status().isNoContent());
	}

	@Test
	void unknownExpiredAndReplacedLinksAreInvalid() throws Exception {
		new BrowserClient(mvc).post("/api/auth/verify-email", verifyJson("x".repeat(43)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"));

		Member expired = register("tr");
		String expiredToken = lastToken(expired.email());
		jdbc.update("UPDATE email_verification_tokens SET expires_at = now() - INTERVAL '1 minute' WHERE token_hash = ?",
				EmailVerificationService.hash(expiredToken));
		expired.browser().post("/api/auth/verify-email", verifyJson(expiredToken))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"));

		Member replaced = register("tr");
		String first = lastToken(replaced.email());
		replaced.browser().post("/api/auth/verification-email", "{}").andExpect(status().isNoContent());
		String second = lastToken(replaced.email());
		assertThat(second).isNotEqualTo(first);
		assertThat(tokenRows(replaced.email())).isEqualTo(1);
		replaced.browser().post("/api/auth/verify-email", verifyJson(first))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"));
		replaced.browser().post("/api/auth/verify-email", verifyJson(second)).andExpect(status().isNoContent());
	}

	@Test
	void aMissingOrOverlongTokenIsAValidationError() throws Exception {
		new BrowserClient(mvc).post("/api/auth/verify-email", "{}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
		new BrowserClient(mvc).post("/api/auth/verify-email", verifyJson("x".repeat(101)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].code").value("TOO_LONG"));
	}

	@Test
	void resendNeedsASessionAndIsLimitedPerMember() throws Exception {
		BrowserClient stranger = new BrowserClient(mvc);
		stranger.post("/api/auth/verification-email", "{}")
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

		Member member = register("tr");
		member.browser().post("/api/auth/verification-email", "{}").andExpect(status().isNoContent());
		assertThat(mailer.sentTo(member.email())).hasSize(2);

		// 1 per minute (workly.auth.verification.resend-limits), even from another device.
		BrowserClient sameMember = new BrowserClient(mvc);
		sameMember.post("/api/auth/login", """
				{"email": "%s", "password": "%s"}""".formatted(member.email(), PASSWORD))
			.andExpect(status().isOk());
		String retryAfter = sameMember.post("/api/auth/verification-email", "{}")
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"))
			.andReturn().getResponse().getHeader(HttpHeaders.RETRY_AFTER);
		assertThat(Long.parseLong(retryAfter)).isBetween(1L, 60L);
		assertThat(mailer.sentTo(member.email())).hasSize(2);
	}

	@Test
	void resendDoesNothingForAVerifiedMember() throws Exception {
		Member member = register("tr");
		member.browser().post("/api/auth/verify-email", verifyJson(lastToken(member.email())))
			.andExpect(status().isNoContent());
		member.browser().post("/api/auth/verification-email", "{}").andExpect(status().isNoContent());
		assertThat(mailer.sentTo(member.email())).hasSize(1);
	}

	@Test
	void registeringAgainWhileUnverifiedMailsANewLinkWithinTheResendLimits() throws Exception {
		Member member = register("tr");
		String first = lastToken(member.email());

		registerAgain(member, "en");
		assertThat(mailer.sentTo(member.email())).hasSize(2);
		// Still in the member's own language: the account is not changed.
		assertThat(lastLink(member.email()).group(1)).isEqualTo("tr");
		String second = lastToken(member.email());
		assertThat(tokenRows(member.email())).isEqualTo(1);
		member.browser().post("/api/auth/verify-email", verifyJson(first))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VERIFICATION_TOKEN_INVALID"));

		// Past the resend limit (1 per minute) the answer is the same, without a mail.
		registerAgain(member, "tr");
		assertThat(mailer.sentTo(member.email())).hasSize(2);
		member.browser().post("/api/auth/verification-email", "{}").andExpect(status().isTooManyRequests());

		member.browser().post("/api/auth/verify-email", verifyJson(second)).andExpect(status().isNoContent());
	}

	@Test
	void registeringAgainAfterVerificationMailsTheOwnerOnceInAWhile() throws Exception {
		Member member = register("en");
		member.browser().post("/api/auth/verify-email", verifyJson(lastToken(member.email())))
			.andExpect(status().isNoContent());

		registerAgain(member, "tr");
		registerAgain(member, "tr");
		List<OutgoingMail> mails = mailer.sentTo(member.email());
		// The verification mail and one notice: at most 1 per 15 minutes (existing-account-limit).
		assertThat(mails).hasSize(2);
		OutgoingMail notice = mails.getLast();
		assertThat(notice.subject()).isEqualTo("You already have a Workly account");
		assertThat(notice.text()).contains("Hi Deniz Arslan", "http://localhost:3000/en/login")
			.doesNotContain("verify-email");
		assertThat(tokenRows(member.email())).isEqualTo(1);
		member.browser().get("/api/auth/me").andExpect(jsonPath("$.emailVerified").value(true));
	}

	@Test
	void theAccountExistsNoticeIsInTheMembersLanguage() throws Exception {
		Member member = register("tr");
		member.browser().post("/api/auth/verify-email", verifyJson(lastToken(member.email())))
			.andExpect(status().isNoContent());
		registerAgain(member, "en");
		OutgoingMail notice = mailer.sentTo(member.email()).getLast();
		assertThat(notice.subject()).isEqualTo("Zaten bir Workly hesabın var");
		assertThat(notice.text()).contains("Merhaba Deniz Arslan", "http://localhost:3000/tr/login");
	}

	@Test
	void aFailedMailDoesNotFailTheRegistration() throws Exception {
		mailer.failSends(true);
		Member member = register("tr");
		member.browser().get("/api/auth/me").andExpect(status().isOk());
		assertThat(mailer.sentTo(member.email())).isEmpty();
		// The link exists; the member can ask for a new mail once the server is back.
		assertThat(tokenRows(member.email())).isEqualTo(1);

		mailer.failSends(false);
		member.browser().post("/api/auth/verification-email", "{}").andExpect(status().isNoContent());
		assertThat(mailer.sentTo(member.email())).hasSize(1);
	}
}
