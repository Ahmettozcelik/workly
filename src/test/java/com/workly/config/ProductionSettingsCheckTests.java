package com.workly.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.assertj.core.api.Assertions.assertThatNoException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionSettingsCheckTests {

	private final ProductionSettingsCheck check = new ProductionSettingsCheck();

	/** Everything but the cookie flag, which the tests set themselves. */
	private static MockEnvironment withoutCookieFlag() {
		MockEnvironment environment = new MockEnvironment()
			.withProperty("DB_URL", "jdbc:postgresql://db.internal:5432/workly")
			.withProperty("DB_USERNAME", "workly")
			.withProperty("DB_PASSWORD", "s3cret-value")
			.withProperty("MAIL_HOST", "smtp.example.com")
			.withProperty("MAIL_PORT", "587")
			.withProperty("MAIL_USERNAME", "workly")
			.withProperty("MAIL_PASSWORD", "mail-s3cret")
			.withProperty("MAIL_FROM", "no-reply@workly.example")
			.withProperty("APP_BASE_URL", "https://workly.example");
		environment.setActiveProfiles("prod");
		return environment;
	}

	private static MockEnvironment validProduction() {
		return withoutCookieFlag().withProperty("workly.session.cookie-secure", "true");
	}

	@Test
	void validProductionSettingsPass() {
		assertThatNoException().isThrownBy(() -> check.postProcessEnvironment(validProduction(), null));
	}

	@Test
	void withoutTheProdProfileNothingIsChecked() {
		assertThatNoException().isThrownBy(() -> check.postProcessEnvironment(new MockEnvironment(), null));
	}

	@Test
	void missingDatabaseSettingsStopTheStartup() {
		MockEnvironment environment = new MockEnvironment().withProperty("workly.session.cookie-secure", "true");
		environment.setActiveProfiles("prod");
		assertThatIllegalStateException()
			.isThrownBy(() -> check.postProcessEnvironment(environment, null))
			.withMessageContaining("DB_URL is not set")
			.withMessageContaining("DB_USERNAME is not set")
			.withMessageContaining("DB_PASSWORD is not set");
	}

	@Test
	void blankValuesCountAsMissing() {
		MockEnvironment environment = validProduction().withProperty("DB_PASSWORD", "   ");
		assertThat(ProductionSettingsCheck.problems(environment)).containsExactly("DB_PASSWORD is not set");
	}

	@Test
	void onlyPostgresUrlsAreAccepted() {
		MockEnvironment environment = validProduction().withProperty("DB_URL", "jdbc:h2:mem:workly");
		assertThat(ProductionSettingsCheck.problems(environment)).containsExactly("DB_URL must be a jdbc:postgresql: URL");
	}

	@Test
	void insecureOrMissingCookieSettingStopsTheStartup() {
		MockEnvironment insecure = validProduction().withProperty("workly.session.cookie-secure", "false");
		assertThatIllegalStateException()
			.isThrownBy(() -> check.postProcessEnvironment(insecure, null))
			.withMessageContaining("workly.session.cookie-secure must be true");

		assertThat(ProductionSettingsCheck.problems(withoutCookieFlag()))
			.containsExactly("workly.session.cookie-secure must be true (Secure cookies over HTTPS)");
	}

	@Test
	void missingMailAndBaseUrlSettingsStopTheStartup() {
		MockEnvironment environment = new MockEnvironment()
			.withProperty("DB_URL", "jdbc:postgresql://db.internal:5432/workly")
			.withProperty("DB_USERNAME", "workly")
			.withProperty("DB_PASSWORD", "s3cret-value")
			.withProperty("workly.session.cookie-secure", "true");
		environment.setActiveProfiles("prod");
		assertThat(ProductionSettingsCheck.problems(environment)).containsExactly(
				"MAIL_HOST is not set", "MAIL_USERNAME is not set", "MAIL_PASSWORD is not set",
				"MAIL_PORT is not set", "MAIL_FROM is not set", "APP_BASE_URL is not set");
	}

	@Test
	void invalidMailAndBaseUrlValuesAreRejected() {
		MockEnvironment environment = validProduction()
			.withProperty("MAIL_PORT", "smtp")
			.withProperty("MAIL_FROM", "workly")
			.withProperty("APP_BASE_URL", "http://workly.example");
		assertThat(ProductionSettingsCheck.problems(environment)).containsExactly(
				"MAIL_PORT must be a port number", "MAIL_FROM must be an email address",
				"APP_BASE_URL must be an https:// URL");
		assertThat(ProductionSettingsCheck.problems(validProduction().withProperty("MAIL_PORT", "70000")))
			.containsExactly("MAIL_PORT must be a port number");
	}

	@Test
	void theErrorNeverContainsTheValues() {
		MockEnvironment environment = validProduction()
			.withProperty("DB_URL", "mysql://user:s3cret-value@db")
			.withProperty("workly.session.cookie-secure", "false")
			.withProperty("MAIL_FROM", "mail-s3cret")
			.withProperty("APP_BASE_URL", "http://mail-s3cret.example");
		assertThatIllegalStateException()
			.isThrownBy(() -> check.postProcessEnvironment(environment, null))
			.withMessageNotContaining("s3cret")
			.withMessageNotContaining("mysql://");
	}
}
