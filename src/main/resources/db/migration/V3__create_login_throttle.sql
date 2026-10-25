-- Failed sign-ins per email (LoginThrottle). Keyed by the SHA-256 of the
-- normalised email, so unknown emails are tracked the same way as members'
-- (the API never reveals which exist) and no typed email is stored as text.
-- Rows are deleted on a successful sign-in and once their window and block
-- are over.
CREATE TABLE login_throttle (
    email_hash        CHAR(64)    PRIMARY KEY,
    failed_attempts   INTEGER     NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    blocked_until     TIMESTAMPTZ
);
