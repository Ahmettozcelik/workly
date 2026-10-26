package com.workly.mail;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * Sends mails in the background (Boot's applicationTaskExecutor), so a request
 * never waits for the SMTP server and its response time does not show whether
 * a mail went out (registration must not reveal which emails have accounts).
 * A failed send is logged with the exception type only, since its text may
 * name the recipient; mails still queued at shutdown are lost.
 */
@Component
public class MailOutbox {

	private static final Logger log = LoggerFactory.getLogger(MailOutbox.class);

	private final Mailer mailer;
	private final Executor executor;

	public MailOutbox(Mailer mailer, @Qualifier("applicationTaskExecutor") Executor executor) {
		this.mailer = mailer;
		this.executor = executor;
	}

	public void queue(OutgoingMail mail) {
		executor.execute(() -> {
			try {
				mailer.send(mail);
			}
			catch (RuntimeException ex) {
				log.warn("Mail could not be sent ({})", ex.getClass().getSimpleName());
			}
		});
	}
}
