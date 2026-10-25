package com.workly.mail;

/** One plain-text mail to one recipient. */
public record OutgoingMail(String to, String subject, String text) {
}
