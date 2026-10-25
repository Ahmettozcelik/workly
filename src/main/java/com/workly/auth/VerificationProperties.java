package com.workly.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Email verification (workly.auth.verification.* in application.yml).
 * baseUrl: the frontend origin the link points to (prod: APP_BASE_URL).
 * resendLimits: per member, every limit applies (e.g. 1 per minute and 5 per hour).
 */
@ConfigurationProperties("workly.auth.verification")
record VerificationProperties(String baseUrl, Duration tokenLifetime, List<ResendLimit> resendLimits) {

	record ResendLimit(int maxRequests, Duration window) {
	}
}
