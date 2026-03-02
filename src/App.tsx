import { Navigate, Route, Routes } from "react-router-dom";

import { DmDashboardPage } from "./routes/DmDashboardPage";
import { LoginPage } from "./routes/LoginPage";
import { PlayerSheetPage } from "./routes/PlayerSheetPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PlayerSheetPage />} />
      <Route path="/player" element={<Navigate to="/" replace />} />
      <Route path="/dm" element={<DmDashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
