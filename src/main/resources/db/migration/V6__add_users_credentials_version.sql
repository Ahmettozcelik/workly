-- Credentials version (CredentialsCheckFilter). Raised by every password
-- change. A session stores the version its sign-in read together with the
-- password hash; a session whose version is no longer current is ended on its
-- next request, also one whose sign-in raced the change.
ALTER TABLE users ADD COLUMN credentials_version INTEGER NOT NULL DEFAULT 0;
