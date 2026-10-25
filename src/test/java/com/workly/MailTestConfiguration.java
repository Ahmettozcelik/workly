package com.workly;

import com.workly.mail.RecordingMailer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the SMTP mailer with one that records the mails, for tests that register members. */
@TestConfiguration(proxyBeanMethods = false)
public class MailTestConfiguration {

	@Bean
	@Primary
	RecordingMailer recordingMailer() {
		return new RecordingMailer();
	}
}
