import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession";

function DiscordIcon() {
  return (
    <svg className="discord-auth-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M10.2 10.6c1.7-.8 3.5-1.1 5.8-1.1s4.1.3 5.8 1.1c1.4 2 2.1 4.2 2.3 6.8-1.9 1.4-3.8 2.2-5.7 2.4l-.7-1.2c.9-.2 1.7-.6 2.4-1.1-1.2.6-2.5.9-4.1.9s-2.9-.3-4.1-.9c.7.5 1.5.9 2.4 1.1l-.7 1.2c-1.9-.2-3.8-1-5.7-2.4.2-2.6.9-4.8 2.3-6.8Z" />
      <circle cx="13" cy="15.3" r="1.2" />
      <circle cx="19" cy="15.3" r="1.2" />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { chooseAuth } = useAppFlow();
  const online = useOnlineSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");

  function handleChoice(choice: "login" | "signup"): void {
    chooseAuth(choice);
    navigate("/role");
  }

  async function handleOnlineSignIn(): Promise<void> {
    const error = await online.signInWithPassword(email, password);
    if (error) {
      setMessage(error);
      return;
    }

    chooseAuth("login");
    navigate("/role");
  }

  async function handleOnlineSignUp(): Promise<void> {
    const error = await online.signUpWithPassword({
      email,
      password,
      displayName: displayName.trim() || email.trim(),
    });
    if (error) {
      setMessage(error);
      return;
    }

    chooseAuth("signup");
    navigate("/role");
  }

  async function handleDiscordSignIn(): Promise<void> {
    const error = await online.signInWithDiscord();
    if (error) {
      setMessage(error);
    }
  }

  async function handleSignOut(): Promise<void> {
    const error = await online.signOut();
    if (error) {
      setMessage(error);
      return;
    }

    setMessage("Signed out.");
  }

  if (online.isConfigured) {
    return (
      <main className="flow-page">
        <section className="flow-card">
          <p className="section-kicker">Convergence</p>
          <h1>Enter</h1>
          {online.status === "authenticated" ? (
            <>
              <p className="dm-summary-line">
                Signed in as {online.profile?.displayName ?? online.user?.email ?? online.user?.id}.
              </p>
              <div className="flow-actions">
                <button type="button" className="flow-primary" onClick={() => handleChoice("login")}>
                  Continue
                </button>
                <button type="button" className="flow-secondary" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="dm-stack">
                <label className="dm-field">
                  <span>Email</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="dm-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <label className="dm-field">
                  <span>Display Name</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </label>
              </div>
              <div className="flow-actions">
                <button type="button" className="flow-primary" onClick={handleOnlineSignIn}>
                  Login
                </button>
                <button type="button" className="flow-secondary" onClick={handleOnlineSignUp}>
                  Sign Up
                </button>
                <div className="discord-auth-block">
                  <span>Use Discord</span>
                  <button
                    type="button"
                    className="discord-auth-button"
                    aria-label="Sign in with Discord"
                    onClick={handleDiscordSignIn}
                  >
                    <DiscordIcon />
                  </button>
                </div>
              </div>
            </>
          )}
          {message || online.authError ? (
            <p className="dm-status-line">{message || online.authError}</p>
          ) : null}
          <p className="dm-summary-line">
            Online mode is active for live DM/player sessions.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Convergence</p>
        <h1>Enter</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => handleChoice("login")}>
            Login
          </button>
          <button type="button" className="flow-secondary" onClick={() => handleChoice("signup")}>
            Sign Up
          </button>
        </div>
      </section>
    </main>
  );
}
