package com.workly.auth;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, UUID> {

	/** Locks the row, so two clicks on the same link cannot both use it. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

	/** A new link replaces the member's unused ones. */
	@Modifying
	@Query("DELETE FROM EmailVerificationToken t WHERE t.user.id = :userId AND t.usedAt IS NULL")
	int deleteUnusedOf(@Param("userId") UUID userId);

	@Modifying
	@Query("DELETE FROM EmailVerificationToken t WHERE t.expiresAt <= :now")
	int deleteExpired(@Param("now") Instant now);
}
