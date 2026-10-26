-- Password reset links (PasswordResetService). Only the SHA-256 (hex) of the
-- token is stored; the token itself exists only in the mail. A token is
-- single-use (used_at) and expires (expires_at). A member has at most one
-- unused token: the partial unique index lets the database settle two
-- concurrent requests (the loser is skipped). Expired rows are deleted on a schedule.
CREATE TABLE password_reset_tokens (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT password_reset_tokens_hash_uq UNIQUE (token_hash)
);

CREATE UNIQUE INDEX password_reset_tokens_active_uq ON password_reset_tokens (user_id) WHERE used_at IS NULL;
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);
CREATE INDEX password_reset_tokens_expires_idx ON password_reset_tokens (expires_at);
