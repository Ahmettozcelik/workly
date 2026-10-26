package com.workly.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.workly.MailTestConfiguration;
import com.workly.TestcontainersConfiguration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/**
 * CredentialsCheckFilter: a session ends on its next request once the member's
 * credentials version moved past the one its sign-in checked. Raising the
 * version in the database without deleting the session is what a password
 * change looks like to a sign-in that raced it (checked the old password,
 * saved its session after the change deleted the others).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, MailTestConfiguration.class })
class CredentialsCheckIntegrationTests {

	private static final String PASSWORD = "correct horse 1";

	@Autowired
	private MockMvc mvc;

	@Autowired
	private JdbcTemplate jdbc;

	private record Member(String email, String id, BrowserClient browser) {
	}

	/** Registers a member and signs in with a new browser. */
	private Member signedInMember() throws Exception {
		String email = "member-" + UUID.randomUUID() + "@example.com";
		BrowserClient browser = new BrowserClient(mvc);
		browser.post("/api/auth/register", """
				{"displayName": "Deniz Arslan", "email": "%s", "password": "%s"}""".formatted(email, PASSWORD))
			.andExpect(status().isAccepted());
		signIn(browser, email);
		String id = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", String.class, email);
		return new Member(email, id, browser);
	}

	private void signIn(BrowserClient browser, String email) throws Exception {
		browser.post("/api/auth/login", """
				{"email": "%s", "password": "%s"}""".formatted(email, PASSWORD))
			.andExpect(status().isOk());
	}

	/** The member's password changed, as far as existing sessions can tell. */
	private void raiseCredentialsVersion(Member member) {
		jdbc.update("UPDATE users SET credentials_version = credentials_version + 1 WHERE id = CAST(? AS UUID)",
				member.id());
	}

	private int sessionsOf(Member member) {
		return jdbc.queryForObject("SELECT count(*) FROM spring_session WHERE principal_name = ?", Integer.class,
				member.id());
	}

	@Test
	void aSessionKeepsWorkingWhileThePasswordIsUnchanged() throws Exception {
		Member member = signedInMember();
		for (int i = 0; i < 3; i++) {
			member.browser().get("/api/auth/me").andExpect(status().isOk());
		}
		assertThat(jdbc.queryForObject("""
				SELECT count(*) FROM spring_session_attributes a JOIN spring_session s ON s.primary_id = a.session_primary_id
				WHERE s.principal_name = ? AND a.attribute_name = ?""", Integer.class, member.id(),
				SessionLogin.CREDENTIALS_VERSION)).isEqualTo(1);
	}

	@Test
	void aSessionSignedInBeforeAPasswordChangeEndsOnItsNextRequest() throws Exception {
		Member member = signedInMember();
		raiseCredentialsVersion(member);

		member.browser().get("/api/auth/me")
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertThat(sessionsOf(member)).isZero();
		// Also on the next request, and for state-changing ones.
		member.browser().post("/api/auth/verification-email", "{}").andExpect(status().isUnauthorized());

		// Signing in again picks up the current version.
		signIn(member.browser(), member.email());
		member.browser().get("/api/auth/me").andExpect(status().isOk());
		member.browser().get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void onlyThatMembersSessionsEnd() throws Exception {
		Member changed = signedInMember();
		Member other = signedInMember();
		raiseCredentialsVersion(changed);

		changed.browser().get("/api/auth/me").andExpect(status().isUnauthorized());
		other.browser().get("/api/auth/me").andExpect(status().isOk());
	}

	@Test
	void aSessionFromBeforeTheVersionExistedCountsAsVersionZero() throws Exception {
		Member member = signedInMember();
		jdbc.update("""
				DELETE FROM spring_session_attributes a USING spring_session s
				WHERE s.primary_id = a.session_primary_id AND s.principal_name = ? AND a.attribute_name = ?""",
				member.id(), SessionLogin.CREDENTIALS_VERSION);

		member.browser().get("/api/auth/me").andExpect(status().isOk());
		raiseCredentialsVersion(member);
		member.browser().get("/api/auth/me").andExpect(status().isUnauthorized());
	}

	@Test
	void aSessionOfADeletedMemberEndsOnAnyRequest() throws Exception {
		Member member = signedInMember();
		jdbc.update("DELETE FROM users WHERE id = CAST(? AS UUID)", member.id());

		// Before, this endpoint answered 204 and did nothing for a missing member.
		member.browser().post("/api/auth/verification-email", "{}")
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
		assertThat(sessionsOf(member)).isZero();
	}

	@Test
	void publicEndpointsStillWorkForAStaleSession() throws Exception {
		Member member = signedInMember();
		raiseCredentialsVersion(member);

		// The stale session is dropped and the request continues signed out.
		member.browser().get("/api/auth/csrf").andExpect(status().isNoContent());
		assertThat(sessionsOf(member)).isZero();
		signIn(member.browser(), member.email());
		member.browser().get("/api/auth/me").andExpect(status().isOk());
	}
}
