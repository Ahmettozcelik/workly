package com.workly.auth;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Attempt limits: their settings, the clock they count with, and the cleanup schedule. */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ThrottleProperties.class)
@EnableScheduling
class ThrottleConfig {

	@Bean
	Clock clock() {
		return Clock.systemUTC();
	}
}
