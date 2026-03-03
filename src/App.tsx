import { Navigate, Route, Routes } from "react-router-dom";

import { HomePage } from "./routes/HomePage";
import { NotFoundPage } from "./routes/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/player" element={<Navigate to="/" replace />} />
      <Route path="/dm" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
