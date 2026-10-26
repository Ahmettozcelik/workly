package com.workly.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Email verification (workly.auth.verification.* in application.yml).
 * baseUrl: the frontend origin the mailed links point to (prod: APP_BASE_URL).
 * resendLimits: new links per member, every limit applies (e.g. 1 per minute
 * and 5 per hour). existingAccountLimit: "account exists" notices per member.
 */
@ConfigurationProperties("workly.auth.verification")
record VerificationProperties(String baseUrl, Duration tokenLifetime, List<MailLimit> resendLimits,
		MailLimit existingAccountLimit) {

	/** At most maxRequests mails within each window. */
	record MailLimit(int maxRequests, Duration window) {
	}
}
