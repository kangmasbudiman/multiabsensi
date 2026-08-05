-- Magic link untuk custom attendance (multi-user whitelist)
-- Super admin generate link → whitelist specific users → user buka link,
-- input custom date/time + capture photo → submit attendance dengan value custom.

CREATE TABLE IF NOT EXISTS custom_attendance_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_attendance_links_token ON custom_attendance_links(token);

CREATE TABLE IF NOT EXISTS custom_attendance_link_users (
  link_id UUID NOT NULL REFERENCES custom_attendance_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_attendance_link_users_user ON custom_attendance_link_users(user_id);

CREATE TABLE IF NOT EXISTS custom_attendance_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id UUID NOT NULL REFERENCES custom_attendance_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  attendance_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_custom_attendance_submissions_link ON custom_attendance_submissions(link_id);
CREATE INDEX IF NOT EXISTS idx_custom_attendance_submissions_user ON custom_attendance_submissions(user_id);
