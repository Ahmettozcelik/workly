package com.workly.user;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	/** Expects a normalised email ({@link EmailAddress#normalize}). */
	Optional<User> findByEmail(String email);

	/** Locks the row for a password change (PasswordChangeService). */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT u FROM User u WHERE u.id = :id")
	Optional<User> findLockedById(@Param("id") UUID id);

	/** Only the credentials version (checked on every request with a session); empty if the member is gone. */
	@Query("SELECT u.credentialsVersion FROM User u WHERE u.id = :id")
	Optional<Integer> findCredentialsVersion(@Param("id") UUID id);
}
