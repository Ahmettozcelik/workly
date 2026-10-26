package com.workly.auth;

import static com.workly.auth.BrowserClient.SESSION_COOKIE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.workly.MailTestConfiguration;
import com.workly.TestcontainersConfiguration;
import com.workly.mail.OutgoingMail;
import com.workly.mail.RecordingMailer;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Changing the password while signed in, and the member's sessions: list, revoke one, revoke the others. */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, MailTestConfiguration.class })
class AccountSecurityIntegrationTests {

	private static final String PASSWORD = "correct horse 1";
	private static final String NEW_PASSWORD = "new battery staple 2";
	private static final String WINDOWS_CHROME =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
	private static final String IPHONE_SAFARI =
			"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private RecordingMailer mailer;

	private static String uniqueEmail() {
		return "member-" + UUID.randomUUID() + "@example.com";
	}

	private static String changeJson(String current, String next) {
		return """
				{"currentPassword": "%s", "newPassword": "%s"}""".formatted(current, next);
	}

	private void register(String email) throws Exception {
		new BrowserClient(mvc).post("/api/auth/register", """
				{"displayName": "Deniz Arslan", "email": "%s", "password": "%s"}""".formatted(email, PASSWORD))
			.andExpect(status().isAccepted());
	}

	private ResultActions signIn(BrowserClient browser, String email, String password) throws Exception {
		return browser.post("/api/auth/login", """
				{"email": "%s", "password": "%s"}""".formatted(email, password));
	}

	/** A new browser, signed in as the member. */
	private BrowserClient device(String email, String userAgent) throws Exception {
		BrowserClient browser = new BrowserClient(mvc).userAgent(userAgent);
		signIn(browser, email, PASSWORD).andExpect(status().isOk());
		return browser;
	}

	private List<String> sessionIds(BrowserClient browser) throws Exception {
		String json = browser.get("/api/auth/sessions").andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		return JsonPath.read(json, "$[*].id");
	}

	// --- Change password ----------------------------------------------------

	@Test
	void changingThePasswordKeepsThisSessionAndEndsTheOthers() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		BrowserClient phone = device(email, IPHONE_SAFARI);
		String laptopSessionBefore = laptop.cookie(SESSION_COOKIE);

		laptop.post("/api/auth/password", changeJson(PASSWORD, NEW_PASSWORD)).andExpect(status().isNoContent());

		// This device stays signed in, under a new session id.
		laptop.get("/api/auth/me").andExpect(status().isOk());
		laptop.get("/api/auth/me").andExpect(status().isOk());
		assertThat(laptop.cookie(SESSION_COOKIE)).isNotBlank().isNotEqualTo(laptopSessionBefore);
		phone.get("/api/auth/me").andExpect(status().isUnauthorized());
		laptop.get("/api/auth/sessions").andExpect(jsonPath("$", hasSize(1)));

		signIn(new BrowserClient(mvc), email, PASSWORD).andExpect(status().isUnauthorized());
		signIn(new BrowserClient(mvc), email, NEW_PASSWORD).andExpect(status().isOk());
		assertThat(jdbc.queryForObject("SELECT credentials_version FROM users WHERE email = ?", Integer.class, email))
			.isEqualTo(1);

		OutgoingMail mail = mailer.sentTo(email).getLast();
		assertThat(mail.subject()).isEqualTo("Workly şifren değiştirildi");
		assertThat(mail.text()).contains("diğer cihazlarda oturum kapatıldı", "http://localhost:3000/tr/forgot-password");
	}

	@Test
	void aWrongCurrentPasswordIsAFieldErrorAndCountsTowardsTheBlock() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient browser = device(email, WINDOWS_CHROME);

		for (int i = 0; i < 5; i++) {
			browser.post("/api/auth/password", changeJson("wrong password", NEW_PASSWORD))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.errors[0].field").value("currentPassword"))
				.andExpect(jsonPath("$.errors[0].code").value("INCORRECT"));
		}
		// Blocked like sign-in: even the right password is not checked now.
		browser.post("/api/auth/password", changeJson(PASSWORD, NEW_PASSWORD))
			.andExpect(status().isTooManyRequests())
			.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
		signIn(new BrowserClient(mvc), email, PASSWORD).andExpect(status().isTooManyRequests());
		// The session itself is untouched.
		browser.get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void theNewPasswordMustDifferAndFollowTheRules() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient browser = device(email, WINDOWS_CHROME);

		browser.post("/api/auth/password", changeJson(PASSWORD, PASSWORD))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("newPassword"))
			.andExpect(jsonPath("$.errors[0].code").value("SAME_AS_CURRENT"));
		browser.post("/api/auth/password", changeJson(PASSWORD, "1234567"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("newPassword"))
			.andExpect(jsonPath("$.errors[0].code").value("TOO_SHORT"));
		browser.post("/api/auth/password", changeJson(PASSWORD, "ş".repeat(37)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].code").value("TOO_LONG"));
		browser.post("/api/auth/password", "{\"newPassword\": \"" + NEW_PASSWORD + "\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("currentPassword"))
			.andExpect(jsonPath("$.errors[0].code").value("REQUIRED"));
		// Nothing changed.
		signIn(new BrowserClient(mvc), email, PASSWORD).andExpect(status().isOk());
	}

	@Test
	void changingThePasswordNeedsASessionAndTheCsrfToken() throws Exception {
		new BrowserClient(mvc).post("/api/auth/password", changeJson(PASSWORD, NEW_PASSWORD))
			.andExpect(status().isUnauthorized());

		String email = uniqueEmail();
		register(email);
		BrowserClient browser = device(email, WINDOWS_CHROME);
		browser.postWithoutCsrfHeader("/api/auth/password", changeJson(PASSWORD, NEW_PASSWORD))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
	}

	// --- Sessions -----------------------------------------------------------

	@Test
	void theListShowsTheMembersSessionsWithThisOneFirst() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		device(email, IPHONE_SAFARI);
		device(email, null);
		String otherEmail = uniqueEmail();
		register(otherEmail);
		device(otherEmail, WINDOWS_CHROME);

		String json = laptop.get("/api/auth/sessions")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(3)))
			.andExpect(jsonPath("$[0].current").value(true))
			.andExpect(jsonPath("$[0].device").value("Chrome · Windows"))
			.andExpect(jsonPath("$[0].createdAt").isNotEmpty())
			.andExpect(jsonPath("$[0].lastActiveAt").isNotEmpty())
			.andExpect(jsonPath("$[1].current").value(false))
			.andReturn().getResponse().getContentAsString();
		List<String> devices = JsonPath.read(json, "$[*].device");
		assertThat(devices).containsExactlyInAnyOrder("Chrome · Windows", "Safari · iOS", null);

		// Opaque ids: never the session id (the cookie value), and only 22 characters.
		List<String> ids = JsonPath.read(json, "$[*].id");
		String sessionId = new String(Base64.getDecoder().decode(laptop.cookie(SESSION_COOKIE)));
		assertThat(ids).doesNotContain(sessionId, laptop.cookie(SESSION_COOKIE)).allSatisfy(id -> assertThat(id).hasSize(22));
		assertThat(json).doesNotContain(sessionId);
	}

	@Test
	void revokingASessionEndsExactlyThatOne() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		BrowserClient phone = device(email, IPHONE_SAFARI);
		BrowserClient tablet = device(email, null);

		String phoneId = sessionIds(phone).getFirst();
		laptop.delete("/api/auth/sessions/" + phoneId).andExpect(status().isNoContent());

		phone.get("/api/auth/me").andExpect(status().isUnauthorized());
		laptop.get("/api/auth/me").andExpect(status().isOk());
		tablet.get("/api/auth/me").andExpect(status().isOk());
		assertThat(sessionIds(laptop)).hasSize(2).doesNotContain(phoneId);
		laptop.delete("/api/auth/sessions/" + phoneId).andExpect(status().isNotFound());
	}

	@Test
	void anotherMembersSessionCannotBeRevoked() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient member = device(email, WINDOWS_CHROME);
		String otherEmail = uniqueEmail();
		register(otherEmail);
		BrowserClient other = device(otherEmail, WINDOWS_CHROME);

		member.delete("/api/auth/sessions/" + sessionIds(other).getFirst())
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.code").value("NOT_FOUND"));
		member.delete("/api/auth/sessions/unknown-id").andExpect(status().isNotFound());
		other.get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void revokingThisSessionSignsOutLikeLogout() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		BrowserClient phone = device(email, IPHONE_SAFARI);

		laptop.delete("/api/auth/sessions/" + sessionIds(laptop).getFirst()).andExpect(status().isNoContent());
		laptop.get("/api/auth/me").andExpect(status().isUnauthorized());
		phone.get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void revokingTheOthersKeepsThisSession() throws Exception {
		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		BrowserClient phone = device(email, IPHONE_SAFARI);
		BrowserClient tablet = device(email, null);
		String otherEmail = uniqueEmail();
		register(otherEmail);
		BrowserClient otherMember = device(otherEmail, WINDOWS_CHROME);

		laptop.post("/api/auth/sessions/revoke-others", "{}").andExpect(status().isNoContent());

		laptop.get("/api/auth/me").andExpect(status().isOk());
		phone.get("/api/auth/me").andExpect(status().isUnauthorized());
		tablet.get("/api/auth/me").andExpect(status().isUnauthorized());
		otherMember.get("/api/auth/me").andExpect(status().isOk());
		laptop.get("/api/auth/sessions").andExpect(jsonPath("$", hasSize(1)));
	}

	@Test
	void sessionEndpointsNeedASessionAndTheCsrfToken() throws Exception {
		BrowserClient stranger = new BrowserClient(mvc);
		stranger.get("/api/auth/sessions").andExpect(status().isUnauthorized());
		stranger.post("/api/auth/sessions/revoke-others", "{}").andExpect(status().isUnauthorized());
		stranger.delete("/api/auth/sessions/any").andExpect(status().isUnauthorized());

		String email = uniqueEmail();
		register(email);
		BrowserClient laptop = device(email, WINDOWS_CHROME);
		BrowserClient phone = device(email, IPHONE_SAFARI);
		laptop.deleteWithoutCsrfHeader("/api/auth/sessions/" + sessionIds(phone).getFirst())
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("CSRF_INVALID"));
		laptop.postWithoutCsrfHeader("/api/auth/sessions/revoke-others", "{}").andExpect(status().isForbidden());
		phone.get("/api/auth/me").andExpect(status().isOk());
	}
}
