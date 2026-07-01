// Login — the platform's public auth page (Pliny). No shared chrome: a single
// liquid-glass card centered over the global #sky-bg, composed from the design
// system (BaseBox/BaseText primitives + Button/InputFrame composed). The card
// wears the canonical `.glass-surface` recipe (dna-bridge.css) and publishes a
// `controlSize` so the hosted InputFrames inherit their height. Page-only layout
// (viewport centering) lives in login.css.
//
// Behavior (unchanged from the port): POSTs to /api/auth?action=login; on the
// existing-cookie check or a successful login it navigates to / via
// window.location so the browser reloads the cookie-gated dashboard.

import React, { useEffect, useState } from "react";
import { BaseBox, BaseText } from "../ui-kit";
import { Button } from "../../ui/composed/Button";
import { LoginField } from "./LoginField";
import "./login.css";

export function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (document.cookie.includes("nexus_logged_in=1")) {
      window.location.href = "/";
    }
  }, []);

  async function doLogin() {
    if (!user.trim() || !pass) {
      setError("Enter both username and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const resp = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), pass }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); setBusy(false); return; }
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <BaseBox as="main" className="login-screen">
      <BaseBox
        as="form"
        display="flex"
        direction="col"
        gap="6"
        p="8"
        controlSize="md"
        radius="card"
        className="glass-surface login-card"
        onSubmit={(e: React.FormEvent) => { e.preventDefault(); doLogin(); }}
      >
        <BaseBox display="flex" direction="col" gap="1">
          <BaseText as="span" variant="display" className="login-wordmark">Pliny</BaseText>
          <BaseText as="span" variant="caption" color="muted">Sign in to continue</BaseText>
        </BaseBox>

        <BaseBox display="flex" direction="col" gap="4">
          <LoginField
            label="Username"
            type="text"
            autoComplete="username"
            autoFocus
            value={user}
            onChange={setUser}
          />
          <LoginField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={setPass}
          />

          {error && (
            <BaseText as="span" variant="detail" color="error" role="alert">{error}</BaseText>
          )}

          <Button type="submit" variant="primary" fullWidth loading={busy}>
            Sign in
          </Button>
        </BaseBox>
      </BaseBox>
    </BaseBox>
  );
}
