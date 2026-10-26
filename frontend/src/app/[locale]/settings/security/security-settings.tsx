"use client";

import { useState } from "react";
import { ActiveSessions } from "./active-sessions";
import { ChangePasswordForm } from "./change-password-form";

// A password change ends the other sessions, so the list reloads after one.
export function SecuritySettings() {
  const [passwordChanges, setPasswordChanges] = useState(0);

  return (
    <>
      <ChangePasswordForm onChanged={() => setPasswordChanges((count) => count + 1)} />
      <ActiveSessions reloadKey={passwordChanges} />
    </>
  );
}
