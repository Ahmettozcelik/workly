package com.workly.auth;

import java.util.List;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;

/**
 * What a sign-in checks (SecurityConfig's UserDetailsService): the member's id
 * as the username, the password hash, and the credentials version read in the
 * same row, so a session never outlives the password it was signed in with.
 */
public class MemberDetails extends User {

	private final int credentialsVersion;

	public MemberDetails(com.workly.user.User member) {
		super(member.getId().toString(), member.getPasswordHash(), List.of(new SimpleGrantedAuthority("ROLE_USER")));
		this.credentialsVersion = member.getCredentialsVersion();
	}

	public int getCredentialsVersion() {
		return credentialsVersion;
	}
}
