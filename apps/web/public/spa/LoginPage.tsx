// Login page, ported from public/login.html. Same DOM structure, same
// shared.css classes. Behavior diffs from the original:
//   - The "already logged in → /" check runs once on mount instead of
//     inline at parse time. End-state identical.
//   - On success, navigates to / via window.location so the browser
//     reloads the cookie-gated dashboard.html. Once dashboard migrates
//     to React Router, switch to react-router useNavigate().
//   - The action URL stays /api/auth?action=login for now; it'll move
//     to the REST alias /api/auth/login in a follow-up frontend pass.

import React, { useEffect, useRef, useState } from "react";

export function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (document.cookie.includes("nexus_logged_in=1")) {
      window.location.href = "/";
    }
  }, []);

  async function doLogin() {
    if (!user.trim() || !pass) {
      alert("Enter both username and password");
      return;
    }
    setError(null);
    try {
      const resp = await fetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.trim(), pass }),
      });
      const data = await resp.json();
      if (data.error) { setError(data.error); return; }
      window.location.href = "/";
    } catch (err) {
      setError("Error: " + (err as Error).message);
    }
  }

  return (
    <>
      <nav><span className="logo">Nexus</span></nav>
      <div className="page">
        <h1>Login</h1>
        <div className="card">
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                placeholder="Username"
                style={{ width: "100%" }}
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                ref={passRef}
                type="password"
                placeholder="Password"
                style={{ width: "100%" }}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }}
              />
            </div>
            <div><button onClick={doLogin}>Login</button></div>
          </div>
        </div>
        {error && <div className="status error">{error}</div>}
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 4,
  fontWeight: "bold",
};
