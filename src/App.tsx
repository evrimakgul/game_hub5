import { Navigate, Route, Routes } from "react-router-dom";

import { CombatDashboardPage } from "./routes/CombatDashboardPage";
import { CombatEncounterPage } from "./routes/CombatEncounterPage";
import { DmCharacterHubPage } from "./routes/DmCharacterHubPage";
import { DmNpcCreatorPage } from "./routes/DmNpcCreatorPage";
import { DmPage } from "./routes/DmPage";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { PlayerCharacterPage } from "./routes/PlayerCharacterPage";
import { PlayerHubPage } from "./routes/PlayerHubPage";
import { RoleSelectPage } from "./routes/RoleSelectPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/role" element={<RoleSelectPage />} />
      <Route path="/player" element={<PlayerHubPage />} />
      <Route path="/player/character" element={<PlayerCharacterPage viewMode="player" />} />
      <Route path="/dm" element={<DmPage />} />
      <Route path="/dm/characters" element={<DmCharacterHubPage />} />
      <Route path="/dm/character" element={<PlayerCharacterPage viewMode="dm-readonly" />} />
      <Route path="/dm/npc-creator" element={<DmNpcCreatorPage />} />
      <Route path="/dm/npc-character" element={<PlayerCharacterPage viewMode="dm-editable" />} />
      <Route path="/dm/combat" element={<CombatDashboardPage />} />
      <Route path="/dm/combat/encounter" element={<CombatEncounterPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
