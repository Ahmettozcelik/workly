package com.workly.auth;

import com.workly.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A password reset link's token, by hash only. The schema is owned by Flyway (V5). */
@Entity
@Table(name = "password_reset_tokens")
class PasswordResetToken {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false, updatable = false)
	private User user;

	@Column(name = "token_hash", nullable = false, length = 64, updatable = false)
	private String tokenHash;

	@Column(name = "expires_at", nullable = false, updatable = false)
	private Instant expiresAt;

	@Column(name = "used_at")
	private Instant usedAt;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected PasswordResetToken() {
		// For JPA.
	}

	PasswordResetToken(User user, String tokenHash, Instant createdAt, Instant expiresAt) {
		this.user = user;
		this.tokenHash = tokenHash;
		this.createdAt = createdAt;
		this.expiresAt = expiresAt;
	}

	User getUser() {
		return user;
	}

	boolean isUsed() {
		return usedAt != null;
	}

	boolean isExpiredAt(Instant now) {
		return !now.isBefore(expiresAt);
	}

	void markUsed(Instant now) {
		usedAt = now;
	}
}
