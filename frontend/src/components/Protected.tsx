import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../auth";

export default function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><span className="spinner" />Загружаем аккаунт…</div>;
  if (!user) return <Navigate to="/?login=1" replace />;
  if (admin && user.role !== "admin") return <div className="standalone-message"><h1>Недостаточно прав</h1><p>Этот раздел доступен только администратору.</p></div>;
  return children;
}
