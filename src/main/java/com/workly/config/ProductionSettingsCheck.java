package com.workly.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

/**
 * Stops a "prod" startup whose settings are missing or insecure. Runs after the
 * configuration files are loaded (application-prod.yml) and before any bean is
 * created, so nothing connects to a database or serves a request first. Every
 * problem is reported at once; values are never printed.
 * Registered in META-INF/spring.factories.
 */
public class ProductionSettingsCheck implements EnvironmentPostProcessor, Ordered {

	static final String PROFILE = "prod";

	@Override
	public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
		if (!environment.acceptsProfiles(Profiles.of(PROFILE))) {
			return;
		}
		List<String> problems = problems(environment);
		if (!problems.isEmpty()) {
			throw new IllegalStateException("Refusing to start with the \"prod\" profile: " + String.join("; ", problems));
		}
	}

	static List<String> problems(ConfigurableEnvironment environment) {
		List<String> problems = new ArrayList<>();
		String url = environment.getProperty("DB_URL");
		if (isBlank(url)) {
			problems.add("DB_URL is not set");
		}
		else if (!url.startsWith("jdbc:postgresql:")) {
			problems.add("DB_URL must be a jdbc:postgresql: URL");
		}
		if (isBlank(environment.getProperty("DB_USERNAME"))) {
			problems.add("DB_USERNAME is not set");
		}
		if (isBlank(environment.getProperty("DB_PASSWORD"))) {
			problems.add("DB_PASSWORD is not set");
		}
		if (!"true".equalsIgnoreCase(environment.getProperty("workly.session.cookie-secure", "").trim())) {
			problems.add("workly.session.cookie-secure must be true (Secure cookies over HTTPS)");
		}
		return problems;
	}

	private static boolean isBlank(String value) {
		return value == null || value.isBlank();
	}

	/** After the configuration files are loaded (ConfigDataEnvironmentPostProcessor). */
	@Override
	public int getOrder() {
		return Ordered.LOWEST_PRECEDENCE;
	}
}
