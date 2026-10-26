package com.workly.auth;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Attempt limits, email verification and password reset: their settings, the
 * clock they count with, and the cleanup schedules.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties({ ThrottleProperties.class, VerificationProperties.class,
		PasswordResetProperties.class })
@EnableScheduling
class ThrottleConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
