package com.workly.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Password reset (workly.auth.password-reset.* in application.yml).
 * memberLimits: reset mails per member, every limit applies; past one, nothing
 * is sent and nothing is reported (the request answers 202 either way). The
 * links point to workly.auth.verification.base-url.
 */
@ConfigurationProperties("workly.auth.password-reset")
record PasswordResetProperties(Duration tokenLifetime, List<VerificationProperties.MailLimit> memberLimits) {
}
