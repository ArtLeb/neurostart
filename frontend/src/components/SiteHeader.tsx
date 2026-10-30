import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../auth";
import Logo from "./Logo";
import AuthModal from "./AuthModal";

export default function SiteHeader() {
  const { user, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}>{menuOpen ? <X /> : <Menu />}</button>
          <nav className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Основная навигация">
            <NavLink to="/" onClick={() => setMenuOpen(false)}>Каталог курсов</NavLink>
            {user && <NavLink to="/my" onClick={() => setMenuOpen(false)}>Моё обучение</NavLink>}
            {user?.role === "admin" && <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Админка</NavLink>}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <span className="user-label">{user.displayName || user.email}</span>
                <button className="icon-button" title="Выйти" aria-label="Выйти" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={18} /></button>
              </>
            ) : (
              <>
                <button className="button button-ghost" onClick={() => setAuthOpen(true)}>Войти</button>
                <button className="button button-primary header-cta" onClick={() => setAuthOpen(true)}>Начать <ArrowUpRight size={16} /></button>
              </>
            )}
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
