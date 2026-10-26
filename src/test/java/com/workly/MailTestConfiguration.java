package com.workly;

import com.workly.mail.MailOutbox;
import com.workly.mail.RecordingMailer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Replaces the SMTP mailer with one that records the mails, for tests that
 * register members. The outbox sends on the calling thread, so a mail is
 * recorded by the time the request returns (MailOutboxTests covers the
 * background sending).
 */
@TestConfiguration(proxyBeanMethods = false)
public class MailTestConfiguration {

	@Bean
	@Primary
	RecordingMailer recordingMailer() {
		return new RecordingMailer();
	}

	@Bean
	@Primary
	MailOutbox immediateMailOutbox(RecordingMailer mailer) {
		return new MailOutbox(mailer, Runnable::run);
	}
}
