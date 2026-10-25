-- Workly members. Emails are stored trimmed and lower-cased by the application
-- (EmailAddress.normalize); the check keeps it that way, so a plain unique
-- constraint on email is case-insensitive and lookups can use its index.
CREATE TABLE users (
    id             UUID         PRIMARY KEY,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    display_name   VARCHAR(100) NOT NULL,
    locale         VARCHAR(5)   NOT NULL,
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ  NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL,
    CONSTRAINT users_email_uq UNIQUE (email),
    CONSTRAINT users_email_lowercase_ck CHECK (email = lower(email))
);
