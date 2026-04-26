import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";
import { useOnlineSession } from "../state/onlineSession";

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { authChoice, chooseRole } = useAppFlow();
  const online = useOnlineSession();

  if (!authChoice) {
    return <Navigate to="/" replace />;
  }

  function handleRole(choice: "player" | "dm"): void {
    chooseRole(choice);
    navigate(choice === "player" ? "/player" : "/dm");
  }

  async function handleSignOut(): Promise<void> {
    if (online.isConfigured && online.status === "authenticated") {
      await online.signOut();
    }

    navigate("/");
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Role</p>
        <h1>Choose Your Side</h1>
        {online.isConfigured && online.status === "authenticated" ? (
          <p className="dm-summary-line">
            Signed in as {online.profile?.displayName ?? online.user?.email ?? online.user?.id}.
          </p>
        ) : null}
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => handleRole("dm")}>
            Dungeon Master
          </button>
          <button type="button" className="flow-secondary" onClick={() => handleRole("player")}>
            Player
          </button>
          <button type="button" className="flow-secondary" onClick={handleSignOut}>
            {online.isConfigured && online.status === "authenticated" ? "Sign Out" : "Exit"}
          </button>
        </div>
      </section>
    </main>
  );
}
