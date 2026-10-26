package com.workly.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;

/**
 * The signed-in member's sessions (Spring Session JDBC, indexed by member id).
 * A session id is a bearer secret (it is the cookie value), so it never leaves
 * the server: the API names a session by an opaque handle derived from it
 * (base64url of the first 16 bytes of its SHA-256), which cannot be turned
 * back into a usable id.
 */
@Service
class MemberSessions {

	private final FindByIndexNameSessionRepository<? extends Session> sessions;

	MemberSessions(FindByIndexNameSessionRepository<? extends Session> sessions) {
		this.sessions = sessions;
	}

	record Info(String id, boolean current, String device, Instant createdAt, Instant lastActiveAt) {
	}

	/** The member's live sessions: the current one first, then the most recently active. */
	List<Info> list(UUID memberId, String currentSessionId) {
		return sessionsOf(memberId).stream()
			.map(session -> new Info(handle(session.getId()), session.getId().equals(currentSessionId),
					session.getAttribute(SessionLogin.DEVICE), session.getCreationTime(),
					session.getLastAccessedTime()))
			.sorted(Comparator.comparing(Info::current).reversed()
				.thenComparing(Comparator.comparing(Info::lastActiveAt).reversed()))
			.toList();
	}

	/**
	 * Ends the member's session with this handle; true if it was the current one
	 * (the caller then signs the request out). Unknown handles and other
	 * members' sessions are SessionNotFoundException alike.
	 */
	boolean revoke(UUID memberId, String handle, String currentSessionId) {
		Session session = sessionsOf(memberId).stream()
			.filter(each -> handle(each.getId()).equals(handle))
			.findFirst()
			.orElseThrow(SessionNotFoundException::new);
		if (session.getId().equals(currentSessionId)) {
			return true;
		}
		sessions.deleteById(session.getId());
		return false;
	}

	/** Ends every session of the member except the current one. */
	void revokeOthers(UUID memberId, String currentSessionId) {
		sessionsOf(memberId).stream()
			.map(Session::getId)
			.filter(id -> !id.equals(currentSessionId))
			.forEach(sessions::deleteById);
	}

	private List<? extends Session> sessionsOf(UUID memberId) {
		return sessions.findByPrincipalName(memberId.toString()).values().stream()
			.filter(session -> !session.isExpired())
			.toList();
	}

	static String handle(String sessionId) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(sessionId.getBytes(StandardCharsets.UTF_8));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(Arrays.copyOf(digest, 16));
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 is always available", ex);
		}
	}
}
