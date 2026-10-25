-- Email verification links (EmailVerificationService). Only the SHA-256 (hex)
-- of the token is stored; the token itself exists only in the mail. A token is
-- single-use (used_at) and expires (expires_at). Issuing a new one deletes the
-- member's unused ones; expired rows are deleted on a schedule.
CREATE TABLE email_verification_tokens (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT email_verification_tokens_hash_uq UNIQUE (token_hash)
);

CREATE INDEX email_verification_tokens_user_idx ON email_verification_tokens (user_id);
CREATE INDEX email_verification_tokens_expires_idx ON email_verification_tokens (expires_at);
