import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router";
import "./App.css";
import SiteHeader from "./components/SiteHeader";
import Protected from "./components/Protected";
import Home from "./pages/Home";
import MyCourses from "./pages/MyCourses";
import Course from "./pages/Course";
import Admin from "./pages/Admin";
import PaymentReturn from "./pages/PaymentReturn";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my" element={<Protected><MyCourses /></Protected>} />
        <Route path="/course/:slug" element={<Protected><Course /></Protected>} />
        <Route path="/payment/return" element={<Protected><PaymentReturn /></Protected>} />
        <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
        <Route path="*" element={<main className="standalone-message"><span>404</span><h1>Страница не найдена</h1><p>Возможно, ссылка устарела или курс был снят с публикации.</p><Link className="button button-primary" to="/">На главную</Link></main>} />
      </Routes>
    </div>
  );
}
