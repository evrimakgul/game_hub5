import { Navigate, Route, Routes } from "react-router-dom";

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
      <Route path="/player/character" element={<PlayerCharacterPage />} />
      <Route path="/dm" element={<DmPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
