package com.workly.mail;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.mail.MailSendException;

/**
 * Keeps the mails instead of sending them (tests have no SMTP server).
 * failSends(true) makes every send throw, like an unreachable server.
 */
public class RecordingMailer implements Mailer {

	private final List<OutgoingMail> sent = new CopyOnWriteArrayList<>();
	private volatile boolean failing;

	@Override
	public void send(OutgoingMail mail) {
		if (failing) {
			throw new MailSendException("Simulated SMTP failure for " + mail.to());
		}
		sent.add(mail);
	}

	public List<OutgoingMail> sentTo(String address) {
		return sent.stream().filter(mail -> mail.to().equals(address)).toList();
	}

	public void failSends(boolean failing) {
		this.failing = failing;
	}
}
