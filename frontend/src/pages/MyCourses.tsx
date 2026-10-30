import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { trpc } from "../providers/trpc";
import ReferralPanel from "../components/ReferralPanel";

export default function MyCourses() {
  const courses = trpc.course.my.useQuery();
  const location = useLocation();
  useEffect(() => {
    if (location.hash !== "#referral") return;
    const timer = window.setTimeout(() => document.getElementById("referral")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => window.clearTimeout(timer);
  }, [location.hash, courses.data]);
  return (
    <main className="dashboard-page container">
      <div className="page-heading"><div><p className="overline">ЛИЧНЫЙ КАБИНЕТ</p><h1>Моё обучение</h1><p>Продолжайте с того места, где остановились.</p></div><Link className="button button-outline" to="/">Все курсы <ArrowRight size={16} /></Link></div>
      {courses.isLoading && <div className="page-loading"><span className="spinner" />Загружаем прогресс…</div>}
      {courses.data?.length === 0 && <div className="empty-state"><BookOpen /><h2>Здесь появятся ваши курсы</h2><p>Откройте бесплатный курс или приобретите практическую программу.</p><Link className="button button-primary" to="/">Перейти в каталог</Link></div>}
      <div className="my-course-list">
        {courses.data?.map((course) => (
          <article className="my-course" key={course.id}>
            <div className="my-course-icon"><BookOpen /></div>
            <div className="my-course-main"><div className="my-course-title"><div><span>{course.accessType === "free" ? "Бесплатный курс" : "Полный доступ"}</span><h2>{course.title}</h2></div><strong>{course.progress}%</strong></div><div className="progress-track"><i style={{ width: `${course.progress}%` }} /></div><div className="my-course-meta"><span>{course.completedCount} из {course.lessonCount} уроков пройдено</span>{course.progress === 100 && <span className="success-text"><CheckCircle2 size={15} /> Курс завершён</span>}</div></div>
            <Link className="button button-primary" to={`/course/${course.slug}`}>{course.completedCount ? "Продолжить" : "Начать"}<ArrowRight size={16} /></Link>
          </article>
        ))}
      </div>
      <ReferralPanel />
    </main>
  );
}
