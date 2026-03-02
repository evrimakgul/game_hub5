import { Navigate, Route, Routes } from "react-router-dom";

import { HomePage } from "./routes/HomePage";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/player" element={<Navigate to="/" replace />} />
      <Route path="/dm" element={<HomePage initialView="dm" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
