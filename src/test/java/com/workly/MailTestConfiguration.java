package com.workly;

import com.workly.background.BackgroundTasks;
import com.workly.mail.RecordingMailer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Replaces the SMTP mailer with one that records the mails, for tests that
 * register members or reset passwords. Background tasks run on the calling
 * thread, so their mails are recorded by the time the request returns
 * (BackgroundTasksTests covers the real, later execution).
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
	BackgroundTasks immediateBackgroundTasks() {
		return new BackgroundTasks(Runnable::run);
	}
}
