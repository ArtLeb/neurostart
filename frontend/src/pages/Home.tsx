import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowRight, BookOpen, Check, CheckCircle2, Clock3, CreditCard, Gift, Play, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "../providers/trpc";
import { useAuth } from "../auth";
import AuthModal from "../components/AuthModal";

export default function Home() {
  const courses = trpc.course.list.useQuery();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(params.get("login") === "1");
  const [pendingCourse, setPendingCourse] = useState<string | null>(null);

  useEffect(() => {
    if (user && pendingCourse) navigate(`/course/${pendingCourse}`);
  }, [user, pendingCourse, navigate]);

  useEffect(() => {
    const referralCode = params.get("ref")?.trim().toUpperCase();
    if (referralCode) window.localStorage.setItem("neurostart_referral", referralCode);
  }, [params]);

  function openCourse(slug: string) {
    if (user) navigate(`/course/${slug}`);
    else { setPendingCourse(slug); setAuthOpen(true); }
  }

  return (
    <div>
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="hero-badge"><Sparkles size={15} /> Практические курсы по нейросетям</div>
            <h1>Не просто смотреть.<br /><em>Научиться применять.</em></h1>
            <p>Освойте ИИ с нуля: короткие уроки, понятная практика и проверка знаний после каждой темы.</p>
            <div className="hero-actions">
              <a className="button button-primary button-large" href="#courses">Выбрать курс <ArrowRight size={18} /></a>
              <a className="watch-link" href="#method"><span><Play size={15} fill="currentColor" /></span> Как устроено обучение</a>
            </div>
            <div className="hero-proof"><span><Check size={15} /> Бесплатный старт</span><span><Check size={15} /> В своём темпе</span><span><Check size={15} /> Без опыта в IT</span></div>
          </div>
          <div className="hero-product" aria-label="Пример экрана обучения">
            <div className="product-window">
              <div className="window-top"><span className="window-dots"><i /><i /><i /></span><span>Урок 2 из 4</span><span className="window-score">80% для зачёта</span></div>
              <div className="window-body">
                <div className="mini-sidebar"><b>Содержание</b><span className="done"><CheckCircle2 /> Основы ИИ</span><span className="active"><Play /> Сильный запрос</span><span><Clock3 /> Проверка фактов</span><span><Clock3 /> Мини-проект</span></div>
                <div className="mini-lesson"><span className="mini-label">ПРАКТИКА</span><h3>Формула хорошего запроса</h3><div className="formula-row"><span>01</span><div><b>Роль и задача</b><small>Кто выполняет и что нужно получить</small></div></div><div className="formula-row"><span>02</span><div><b>Контекст</b><small>Аудитория, исходные данные, цель</small></div></div><div className="formula-row"><span>03</span><div><b>Формат</b><small>Список, таблица, план или письмо</small></div></div><div className="mini-quiz"><span><CheckCircle2 /> Тест пройден</span><b>5 / 5</b></div></div>
              </div>
            </div>
            <div className="floating-result"><span><Check /></span><div><strong>Урок пройден</strong><small>Следующий урок открыт</small></div></div>
            <div className="hero-grid" aria-hidden="true" />
          </div>
        </section>

        <section className="trust-line"><div className="container"><span>Текст и видео в каждом уроке</span><span>Тесты с проходным баллом</span><span>Оплата картой или через СБП</span><span>Прогресс в личном кабинете</span></div></section>

        <section className="courses-section container" id="courses">
          <div className="section-title-row"><div><p className="overline">КАТАЛОГ</p><h2>Выберите свой следующий навык</h2><p>Начните с бесплатной базы или сразу переходите к рабочим сценариям.</p></div><span className="catalog-count">{courses.data?.length || 0} курса</span></div>
          {courses.isLoading && <div className="page-loading"><span className="spinner" />Загружаем курсы…</div>}
          {courses.error && <div className="alert alert-error">Не удалось загрузить каталог. Попробуйте обновить страницу.</div>}
          <div className="course-grid">
            {courses.data?.map((course, index) => (
              <article className="course-card" key={course.id}>
                <div className={`course-cover cover-${index % 4 + 1}`}>
                  <div className="cover-top"><span>{course.accessType === "free" ? "БЕСПЛАТНЫЙ КУРС" : "ПРАКТИЧЕСКИЙ КУРС"}</span><BookOpen size={19} /></div>
                  <div className="cover-monogram">{index % 2 === 0 ? "AI" : "↗"}</div>
                  <span className="cover-number">0{index + 1}</span>
                </div>
                <div className="course-card-content">
                  <div className="course-meta"><span>{course.level}</span><span><BookOpen size={14} /> {course.lessonCount} уроков</span></div>
                  <h3>{course.title}</h3><p>{course.description}</p>
                  <div className="course-card-bottom"><div><small>Стоимость</small><strong>{course.accessType === "free" ? "Бесплатно" : `${course.price.toLocaleString("ru-RU")} ₽`}</strong></div><button className="round-arrow" onClick={() => openCourse(course.slug)} aria-label={`Открыть курс ${course.title}`}><ArrowRight /></button></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="referral-hero container" aria-labelledby="referral-title">
          <div className="referral-hero-copy">
            <span className="referral-hero-badge"><Gift size={18} /> Делитесь знаниями — получайте курсы</span>
            <h2 id="referral-title"><span>10 друзей —</span><br />курс в подарок!</h2>
            <p>Отправьте свою ссылку. Когда 10 приглашённых пользователей оплатят хотя бы один курс, вы выберете платный курс в подарок.</p>
            <button className="button referral-hero-button" onClick={() => user ? navigate("/my#referral") : setAuthOpen(true)}>
              {user ? "Моя реферальная ссылка" : "Получить свою ссылку"}<ArrowRight size={19} />
            </button>
          </div>
          <div className="referral-hero-steps" aria-label="Как получить подарок">
            <div><span>01</span><strong>Пригласите</strong><small>Поделитесь персональной ссылкой</small></div>
            <div><span>02</span><strong>Дождитесь 10 оплат</strong><small>Каждый друг засчитывается один раз</small></div>
            <div><span>03</span><strong>Выберите подарок</strong><small>Любой доступный платный курс</small></div>
          </div>
        </section>

        <section className="method-section" id="method">
          <div className="container method-layout">
            <div className="method-intro"><p className="overline">КАК ЭТО РАБОТАЕТ</p><h2>Знания закрепляются действием</h2><p>Нельзя просто пролистать курс. Каждая тема завершается короткой проверкой — так вы видите, что действительно разобрались.</p><button className="button button-dark" onClick={() => user ? navigate("/my") : setAuthOpen(true)}>Личный кабинет <ArrowRight size={17} /></button></div>
            <ol className="method-list">
              <li><span>01</span><div><h3>Изучите материал</h3><p>Текст, видео и практическое задание собраны на одной странице.</p></div></li>
              <li><span>02</span><div><h3>Пройдите проверку</h3><p>Ответьте минимум на 80% вопросов. Если не получилось — можно попробовать снова.</p></div></li>
              <li><span>03</span><div><h3>Двигайтесь дальше</h3><p>После зачёта откроется следующий урок, а результат сохранится в профиле.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="payment-banner container"><div><span className="payment-icon"><CreditCard /></span><div><h2>Один платёж — полный доступ</h2><p>Оплата картой российского банка или через СБП с возвратом в личный кабинет.</p></div></div><span className="secure-note"><ShieldCheck /> Доступ открывается после подтверждения оплаты</span></section>
      </main>
      <footer className="site-footer"><div className="container"><span>© {new Date().getFullYear()} НЕЙРОСТАРТ</span><span>Учись. Практикуй. Создавай.</span><a href="#courses">Все курсы</a></div></footer>
      <AuthModal open={authOpen} initialMode="register" onClose={() => { setAuthOpen(false); if (!user) setPendingCourse(null); }} />
    </div>
  );
}
