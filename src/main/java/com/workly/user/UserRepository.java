package com.workly.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

	/** Expects a normalised email ({@link EmailAddress#normalize}). */
	Optional<User> findByEmail(String email);

	/** Only the credentials version (checked on every request with a session); empty if the member is gone. */
	@Query("SELECT u.credentialsVersion FROM User u WHERE u.id = :id")
	Optional<Integer> findCredentialsVersion(@Param("id") UUID id);
}
