package com.workly.mail;

/**
 * Sends a plain-text mail. Implementations may throw on failure (for SMTP:
 * Spring's MailException); callers decide whether that matters. Tests replace
 * the SMTP implementation with one that records the mails.
 */
public interface Mailer {

	void send(OutgoingMail mail);
}
