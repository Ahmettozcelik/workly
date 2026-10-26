package com.workly.auth;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Limits on sign-in, registration and password reset requests (workly.auth.throttle.* in application.yml). */
@ConfigurationProperties("workly.auth.throttle")
record ThrottleProperties(EmailLimit loginEmail, AddressLimit loginAddress, AddressLimit registerAddress,
		AddressLimit passwordResetAddress) {

	/** maxFailures failed sign-ins within window block that email for block. */
	record EmailLimit(int maxFailures, Duration window, Duration block) {
	}

	/** At most maxRequests per client address within each window. */
	record AddressLimit(int maxRequests, Duration window) {
	}
}
