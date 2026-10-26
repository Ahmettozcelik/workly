package com.workly.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class DeviceLabelTests {

	@ParameterizedTest
	@CsvSource(delimiter = '|', textBlock = """
			Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 | Chrome · Windows
			Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0 | Edge · Windows
			Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15 | Safari · macOS
			Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1 | Safari · iOS
			Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1 | Chrome · iOS
			Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 | Chrome · Android
			Mozilla/5.0 (Linux; Android 15; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36 | Samsung Internet · Android
			Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0 | Firefox · Linux
			Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/122.0.0.0 | Opera · Windows
			Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 | Chrome · ChromeOS
			""")
	void recognisesCommonBrowsersAndSystems(String userAgent, String label) {
		assertThat(DeviceLabel.of(userAgent)).isEqualTo(label);
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = { "   ", "curl/8.9.1", "Java-http-client/21" })
	void unknownAgentsHaveNoLabel(String userAgent) {
		assertThat(DeviceLabel.of(userAgent)).isNull();
	}

	@ParameterizedTest
	@ValueSource(strings = { "SomeApp/1.0 (Windows NT 10.0)", "SomeApp/1.0 (Linux; Android 15)" })
	void aKnownSystemAloneIsEnough(String userAgent) {
		assertThat(DeviceLabel.of(userAgent)).isIn("Windows", "Android");
	}
}
