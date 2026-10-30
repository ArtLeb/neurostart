import { Link } from "react-router";

export default function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className={`logo ${inverse ? "logo-inverse" : ""}`} aria-label="НЕЙРОСТАРТ — на главную">
      <span className="logo-mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="logo-copy"><strong>НЕЙРОСТАРТ</strong><small>Образование в сфере ИИ</small></span>
    </Link>
  );
}
