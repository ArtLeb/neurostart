import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, CircleDollarSign, CreditCard, GraduationCap, LayoutDashboard, Plus, Settings2, Users } from "lucide-react";
import { trpc } from "../providers/trpc";
import AdminCourseEditor from "./AdminCourseEditor";

type Tab = "overview" | "students" | "courses" | "payments";

function StudentCourses({ userId }: { userId: number }) {
  const query = trpc.admin.studentCourses.useQuery({ userId });
  if (query.isLoading) return <div className="student-detail">Загружаем курсы…</div>;
  if (!query.data?.length) return <div className="student-detail muted">Ученик ещё не начал ни одного курса.</div>;
  return <div className="student-detail">{query.data.map((course) => <div className="student-course-progress" key={course.id}><div><strong>{course.title}</strong><span>{course.completedLessons} из {course.totalLessons} уроков</span></div><div className="progress-track"><i style={{ width: `${course.progress}%` }} /></div><b>{course.progress}%</b></div>)}</div>;
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const overview = trpc.admin.overview.useQuery();
  const students = trpc.admin.students.useQuery(undefined, { enabled: tab === "students" });
  const courses = trpc.admin.courses.useQuery(undefined, { enabled: tab === "courses" });
  const purchases = trpc.admin.purchases.useQuery(undefined, { enabled: tab === "payments" });
  const selectedCourse = courses.data?.find((course) => course.id === selectedCourseId) || null;

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Обзор", icon: LayoutDashboard },
    { id: "students", label: "Ученики", icon: Users },
    { id: "courses", label: "Курсы и уроки", icon: BookOpen },
    { id: "payments", label: "Оплаты", icon: CreditCard },
  ];

  return (
    <main className="admin-page">
      <div className="container admin-heading"><div><p className="overline">НЕЙРОСТАРТ · УПРАВЛЕНИЕ</p><h1>Административная панель</h1></div><span className="admin-badge"><Settings2 size={16} /> Администратор</span></div>
      <div className="container admin-layout">
        <aside className="admin-nav">{tabs.map((item) => <button key={item.id} className={`${tab === item.id ? "active" : ""}${item.id === "payments" ? " admin-nav-separated" : ""}`} onClick={() => setTab(item.id)}><item.icon size={18} />{item.label}</button>)}</aside>
        <div className="admin-content">
          {tab === "overview" && <>
            <div className="admin-section-heading"><h2>Сегодня в платформе</h2><p>Основные показатели по ученикам, курсам и оплатам.</p></div>
            <div className="stats-grid">
              <div><span><Users /></span><small>Учеников</small><strong>{overview.data?.students ?? "—"}</strong></div>
              <div><span><BookOpen /></span><small>Всего курсов</small><strong>{overview.data?.courses ?? "—"}</strong></div>
              <div><span><GraduationCap /></span><small>Оплаченных заказов</small><strong>{overview.data?.paidPurchases ?? "—"}</strong></div>
              <div><span><CircleDollarSign /></span><small>Подтверждённая выручка</small><strong>{overview.data ? `${overview.data.revenue.toLocaleString("ru-RU")} ₽` : "—"}</strong></div>
            </div>
            <div className="admin-welcome"><div><p className="overline">БЫСТРЫЙ СТАРТ</p><h2>Управляйте обучением из одного места</h2><p>Создавайте курсы, добавляйте текст и видео, настраивайте тесты и следите за результатами учеников.</p></div><button className="button button-primary" onClick={() => { setTab("courses"); setCreatingCourse(true); setSelectedCourseId(null); }}><Plus size={17} />Новый курс</button></div>
          </>}

          {tab === "students" && <>
            <div className="admin-section-heading"><h2>Ученики</h2><p>Нажмите на строку, чтобы увидеть прогресс по каждому курсу.</p></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ученик</th><th>Курсы</th><th>Оплачено</th><th>Регистрация</th><th /></tr></thead><tbody>{students.data?.map((student) => <StudentRow key={student.id} student={student} expanded={expandedStudent === student.id} onToggle={() => setExpandedStudent(expandedStudent === student.id ? null : student.id)} />)}</tbody></table>{students.data?.length === 0 && <div className="empty-table">Учеников пока нет.</div>}</div>
          </>}

          {tab === "courses" && <>
            <div className="admin-section-heading"><h2>Курсы и уроки</h2><p>Редактируйте программу, видео, стоимость и проверочные вопросы.</p></div>
            <div className="course-admin-layout">
              <aside className="course-admin-list"><button className="button button-primary button-full" onClick={() => { setCreatingCourse(true); setSelectedCourseId(null); }}><Plus size={16} />Добавить курс</button>{courses.data?.map((course) => <button key={course.id} className={selectedCourseId === course.id && !creatingCourse ? "active" : ""} onClick={() => { setSelectedCourseId(course.id); setCreatingCourse(false); }}><span><strong>{course.title}</strong><small>{course.lessons.length} уроков · {course.isPublished ? "опубликован" : "черновик"}</small></span><b>{course.accessType === "free" ? "0 ₽" : `${course.price.toLocaleString("ru-RU")} ₽`}</b></button>)}</aside>
              {(selectedCourse || creatingCourse) ? <AdminCourseEditor key={creatingCourse ? "new" : selectedCourseId} course={creatingCourse ? null : selectedCourse} onCreated={(id) => { setCreatingCourse(false); setSelectedCourseId(id); }} /> : <div className="empty-state compact"><BookOpen /><h3>Выберите курс для редактирования</h3><p>Или создайте новый — каталог поддерживает любое количество программ.</p></div>}
            </div>
          </>}

          {tab === "payments" && <>
            <div className="admin-section-heading"><h2>История оплат</h2><p>Заказы и подтверждённые поступления через ЮKassa.</p></div>
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Заказ</th><th>Ученик</th><th>Курс</th><th>Способ</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead><tbody>{purchases.data?.map((payment) => <tr key={payment.id}><td>#{payment.id}</td><td>{payment.email}</td><td>{payment.courseTitle}</td><td>{payment.paymentMethod === "sbp" ? "СБП" : "Карта"}</td><td>{payment.amount.toLocaleString("ru-RU")} ₽</td><td><span className={`status-pill status-${payment.status}`}>{payment.status === "paid" ? "Оплачен" : payment.status === "pending" ? "Ожидает" : payment.status === "refunded" ? "Возврат" : "Отменён"}</span></td><td>{new Date(payment.createdAt).toLocaleDateString("ru-RU")}</td></tr>)}</tbody></table>{purchases.data?.length === 0 && <div className="empty-table">Оплат пока не было.</div>}</div>
          </>}
        </div>
      </div>
    </main>
  );
}

function StudentRow({ student, expanded, onToggle }: { student: { id: number; email: string; displayName: string | null; role: string; createdAt: Date; totalPaid: number; courses: { id: number; title: string; completed: number }[] }; expanded: boolean; onToggle: () => void }) {
  return <>
    <tr className="clickable-row" onClick={onToggle}><td><strong>{student.displayName || "Без имени"}</strong><small>{student.email}</small></td><td>{student.courses.length}</td><td>{student.totalPaid.toLocaleString("ru-RU")} ₽</td><td>{new Date(student.createdAt).toLocaleDateString("ru-RU")}</td><td>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</td></tr>
    {expanded && <tr><td colSpan={5}><StudentCourses userId={student.id} /></td></tr>}
  </>;
}
