-- Per-user FieldView OAuth2 token storage.
-- Each portal user connects their own FieldView account independently.
-- Tokens are short-lived (4h access, long-lived refresh) and never exposed client-side.

CREATE TABLE fieldview_tokens (
  user_id       uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token  text        NOT NULL,
  refresh_token text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  scope         text,
  connected_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fieldview_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns token"
  ON fieldview_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
