import { Navigate, useNavigate } from "react-router-dom";

import { useAppFlow } from "../state/appFlow";

export function RoleSelectPage() {
  const navigate = useNavigate();
  const { authChoice, chooseRole } = useAppFlow();

  if (!authChoice) {
    return <Navigate to="/" replace />;
  }

  function handleRole(choice: "player" | "dm"): void {
    chooseRole(choice);
    navigate(choice === "player" ? "/player" : "/dm");
  }

  return (
    <main className="flow-page">
      <section className="flow-card">
        <p className="section-kicker">Role</p>
        <h1>Choose Your Side</h1>
        <div className="flow-actions">
          <button type="button" className="flow-primary" onClick={() => handleRole("dm")}>
            Dungeon Master
          </button>
          <button type="button" className="flow-secondary" onClick={() => handleRole("player")}>
            Player
          </button>
        </div>
      </section>
    </main>
  );
}
