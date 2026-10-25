package com.workly.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Mails through the SMTP server in spring.mail.* (dev: Mailpit on localhost:1025;
 * prod: MAIL_HOST and friends). Connection, read and write timeouts are set in
 * application.yml, so a slow server cannot hold a request for long.
 */
@Component
class SmtpMailer implements Mailer {

	private final JavaMailSender sender;
	private final String from;

	SmtpMailer(JavaMailSender sender, @Value("${workly.mail.from}") String from) {
		this.sender = sender;
		this.from = from;
	}

	@Override
	public void send(OutgoingMail mail) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom(from);
		message.setTo(mail.to());
		message.setSubject(mail.subject());
		message.setText(mail.text());
		sender.send(message);
	}
}
