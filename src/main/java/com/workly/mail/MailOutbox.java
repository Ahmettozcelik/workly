package com.workly.mail;

import com.workly.background.BackgroundTasks;
import org.springframework.stereotype.Component;

/**
 * Sends mails in the background (BackgroundTasks), so a request never waits for
 * the SMTP server and its response time does not show whether a mail went out
 * (registration and password reset must not reveal which emails have accounts).
 * A failed send is logged as "Mail failed" with the exception type only.
 */
@Component
public class MailOutbox {

	private final Mailer mailer;
	private final BackgroundTasks background;

	public MailOutbox(Mailer mailer, BackgroundTasks background) {
		this.mailer = mailer;
		this.background = background;
	}

	public void queue(OutgoingMail mail) {
		background.run("Mail", () -> mailer.send(mail));
	}
}
