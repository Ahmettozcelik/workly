package com.workly.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

	/** Expects a normalised email ({@link EmailAddress#normalize}). */
	Optional<User> findByEmail(String email);
}
