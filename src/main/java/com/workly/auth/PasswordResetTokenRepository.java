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

interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

	/** Locks the row, so two submits of the same link cannot both use it. */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	Optional<PasswordResetToken> findByTokenHash(String tokenHash);

	/** A new link replaces the member's unused one. */
	@Modifying
	@Query("DELETE FROM PasswordResetToken t WHERE t.user.id = :userId AND t.usedAt IS NULL")
	int deleteUnusedOf(@Param("userId") UUID userId);

	@Modifying
	@Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt <= :now")
	int deleteExpired(@Param("now") Instant now);
}
