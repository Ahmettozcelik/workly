package com.workly.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import static org.assertj.core.api.Assertions.assertThatNoException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionSettingsCheckTests {

	private final ProductionSettingsCheck check = new ProductionSettingsCheck();

	private static MockEnvironment validProduction() {
		MockEnvironment environment = new MockEnvironment()
			.withProperty("DB_URL", "jdbc:postgresql://db.internal:5432/workly")
			.withProperty("DB_USERNAME", "workly")
			.withProperty("DB_PASSWORD", "s3cret-value")
			.withProperty("workly.session.cookie-secure", "true");
		environment.setActiveProfiles("prod");
		return environment;
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

		MockEnvironment missing = new MockEnvironment()
			.withProperty("DB_URL", "jdbc:postgresql://db.internal:5432/workly")
			.withProperty("DB_USERNAME", "workly")
			.withProperty("DB_PASSWORD", "s3cret-value");
		assertThat(ProductionSettingsCheck.problems(missing))
			.containsExactly("workly.session.cookie-secure must be true (Secure cookies over HTTPS)");
	}

	@Test
	void theErrorNeverContainsTheValues() {
		MockEnvironment environment = validProduction()
			.withProperty("DB_URL", "mysql://user:s3cret-value@db")
			.withProperty("workly.session.cookie-secure", "false");
		assertThatIllegalStateException()
			.isThrownBy(() -> check.postProcessEnvironment(environment, null))
			.withMessageNotContaining("s3cret-value")
			.withMessageNotContaining("mysql://");
	}
}
