package com.workly.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class MailOutboxTests {

	private final List<Runnable> background = new ArrayList<>();
	private final RecordingMailer mailer = new RecordingMailer();
	private final MailOutbox outbox = new MailOutbox(mailer, background::add);
	private final OutgoingMail mail = new OutgoingMail("member@example.com", "Subject", "Text");

	@Test
	void queueReturnsBeforeTheMailIsSent() {
		outbox.queue(mail);
		assertThat(mailer.sentTo(mail.to())).isEmpty();

		background.forEach(Runnable::run);
		assertThat(mailer.sentTo(mail.to())).containsExactly(mail);
	}

	@Test
	void aFailedSendIsLoggedNotThrown() {
		mailer.failSends(true);
		outbox.queue(mail);
		assertThatNoException().isThrownBy(() -> background.forEach(Runnable::run));
		assertThat(mailer.sentTo(mail.to())).isEmpty();
	}
}
