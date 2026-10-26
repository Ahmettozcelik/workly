package com.workly.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A Workly member. The schema is owned by Flyway (V1__create_users.sql). */
@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	/** Trimmed and lower-cased; see {@link EmailAddress#normalize}. */
	@Column(nullable = false, length = 254)
	private String email;

	@Column(name = "password_hash", nullable = false, length = 100)
	private String passwordHash;

	@Column(name = "display_name", nullable = false, length = 100)
	private String displayName;

	@Column(nullable = false, length = 5)
	private String locale;

	@Column(name = "email_verified", nullable = false)
	private boolean emailVerified;

	/** Raised by every password change; sessions signed in with an older one end (V6). */
	@Column(name = "credentials_version", nullable = false)
	private int credentialsVersion;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected User() {
		// For JPA.
	}

	public User(String email, String passwordHash, String displayName, String locale) {
		this.email = email;
		this.passwordHash = passwordHash;
		this.displayName = displayName;
		this.locale = locale;
	}

	@PrePersist
	void onCreate() {
		createdAt = Instant.now();
		updatedAt = createdAt;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public String getDisplayName() {
		return displayName;
	}

	public String getLocale() {
		return locale;
	}

	public boolean isEmailVerified() {
		return emailVerified;
	}

	/** The member proved they own the email (EmailVerificationService). */
	public void markEmailVerified() {
		emailVerified = true;
	}

	public int getCredentialsVersion() {
		return credentialsVersion;
	}

	/**
	 * A new password hash (PasswordResetService). Raises the credentials version,
	 * so every session signed in with the old password ends on its next request
	 * (CredentialsCheckFilter).
	 */
	public void changePassword(String passwordHash) {
		this.passwordHash = passwordHash;
		credentialsVersion++;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
