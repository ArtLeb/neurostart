import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, Circle, CreditCard, Lock, PlayCircle, RotateCcw, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { trpc } from "../providers/trpc";

function Video({ url, title }: { url: string; title: string }) {
  const embed = useMemo(() => {
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const rutube = url.match(/rutube\.ru\/video\/([\w-]+)/);
    if (rutube) return `https://rutube.ru/play/embed/${rutube[1]}`;
    if (url.includes("vk.com/video_ext.php")) return url;
    return null;
  }, [url]);
  return (
    <div className="lesson-video">
      {embed ? <iframe src={embed} title={`Видео: ${title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <video controls preload="metadata" src={url}>Ваш браузер не поддерживает видео.</video>}
    </div>
  );
}

export default function Course() {
  const { slug = "" } = useParams();
  const utils = trpc.useUtils();
  const courseQuery = trpc.course.get.useQuery({ slug });
  const paymentConfig = trpc.payment.configured.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correctCount: number; totalQuestions: number; passPercent: number; nextLessonId: number | null } | null>(null);
  const [method, setMethod] = useState<"bank_card" | "sbp">("bank_card");

  const data = courseQuery.data;
  useEffect(() => {
    if (!data || selectedId) return;
    const next = data.lessons.find((lesson) => !lesson.locked && !lesson.completed) || data.lessons.find((lesson) => !lesson.locked);
    if (next) setSelectedId(next.id);
  }, [data, selectedId]);

  const lessonQuery = trpc.course.lesson.useQuery({ slug, lessonId: selectedId || 0 }, { enabled: Boolean(selectedId) });
  const quizMutation = trpc.course.submitQuiz.useMutation({
    onSuccess: async (response) => {
      setResult(response);
      if (response.passed) await Promise.all([utils.course.get.invalidate({ slug }), utils.course.my.invalidate()]);
    },
  });
  const paymentMutation = trpc.payment.create.useMutation({
    onSuccess: async (response) => {
      if (response.confirmationUrl) window.location.href = response.confirmationUrl;
      else await utils.course.get.invalidate({ slug });
    },
  });

  function selectLesson(id: number) {
    setSelectedId(id);
    setAnswers({});
    setResult(null);
    quizMutation.reset();
  }

  const summary = data?.lessons.find((lesson) => lesson.id === selectedId);
  const questions = lessonQuery.data?.questions || [];
  const lesson = lessonQuery.data?.lesson;
  const passed = Boolean(summary?.completed || result?.passed);
  const currentIndex = data?.lessons.findIndex((item) => item.id === selectedId) ?? -1;
  const nextLesson = currentIndex >= 0 ? data?.lessons[currentIndex + 1] : null;

  if (courseQuery.isLoading) return <div className="page-loading"><span className="spinner" />Открываем курс…</div>;
  if (courseQuery.error || !data) return <div className="standalone-message"><h1>Не удалось открыть курс</h1><p>{courseQuery.error?.message}</p><Link className="button button-primary" to="/">Вернуться в каталог</Link></div>;

  return (
    <main className="course-page">
      <div className="course-topbar container"><Link to="/my" className="back-link"><ArrowLeft size={17} /> Моё обучение</Link><span>{data.course.title}</span><strong>{data.progress}%</strong></div>
      <div className="container course-layout">
        <aside className="curriculum">
          <div className="curriculum-heading"><p className="overline">ПРОГРАММА</p><h1>{data.course.title}</h1><span>{data.completedCount} из {data.lessons.length} уроков</span></div>
          <div className="progress-track"><i style={{ width: `${data.progress}%` }} /></div>
          <div className="curriculum-list">
            {data.lessons.map((item, index) => (
              <button key={item.id} className={`curriculum-item ${selectedId === item.id ? "active" : ""}`} disabled={item.locked} onClick={() => selectLesson(item.id)}>
                <span className={`lesson-status ${item.completed ? "complete" : ""}`}>{item.completed ? <Check size={15} /> : item.locked ? <Lock size={14} /> : <span>{index + 1}</span>}</span>
                <span><strong>{item.title}</strong><small>{item.isPreview ? "Открытый урок" : item.locked ? "Сначала пройдите предыдущий" : "Текст · видео · тест"}</small></span>
              </button>
            ))}
          </div>
          {!data.hasAccess && data.course.accessType === "paid" && (
            <div className="buy-panel">
              <p className="overline">ПОЛНЫЙ ДОСТУП</p><h2>{data.course.price.toLocaleString("ru-RU")} ₽</h2><p>Все уроки, тесты и сохранение прогресса без ограничения по времени.</p>
              <div className="payment-methods">
                <button className={method === "bank_card" ? "selected" : ""} onClick={() => setMethod("bank_card")}><CreditCard /> Банковская карта {method === "bank_card" && <CheckCircle2 />}</button>
                <button className={method === "sbp" ? "selected" : ""} onClick={() => setMethod("sbp")}><Smartphone /> СБП {method === "sbp" && <CheckCircle2 />}</button>
              </div>
              {paymentConfig.data && !paymentConfig.data.configured && <p className="config-note">Для приёма оплаты администратору нужно подключить магазин ЮKassa.</p>}
              <button className="button button-primary button-full" disabled={paymentMutation.isPending || paymentConfig.data?.configured === false} onClick={() => paymentMutation.mutate({ slug, method })}>{paymentMutation.isPending ? "Создаём платёж…" : "Перейти к оплате"}<ArrowRight size={16} /></button>
              {paymentMutation.error && <p className="form-error">{paymentMutation.error.message}</p>}
              <small className="secure-payment"><ShieldCheck size={14} /> Оплата на защищённой странице ЮKassa</small>
            </div>
          )}
        </aside>

        <section className="lesson-area">
          {lessonQuery.isLoading && <div className="page-loading"><span className="spinner" />Загружаем урок…</div>}
          {lessonQuery.error && <div className="alert alert-error">{lessonQuery.error.message}</div>}
          {lesson && (
            <article className="lesson-article">
              <div className="lesson-heading"><p className="overline">УРОК {currentIndex + 1} · {data.course.level}</p><h2>{lesson.title}</h2><div className="lesson-tags"><span><BookOpen size={14} /> Текст</span>{lesson.videoUrl && <span><PlayCircle size={14} /> Видео</span>}<span><CheckCircle2 size={14} /> Тест · зачёт от {lesson.passPercent}%</span></div></div>
              {lesson.videoUrl && <Video url={lesson.videoUrl} title={lesson.title} />}
              <div className="lesson-text">{lesson.content || "Материал урока скоро появится."}</div>

              <section className="quiz-section" id="quiz">
                <div className="quiz-heading"><div><p className="overline">ПРОВЕРКА ЗНАНИЙ</p><h3>Закрепим материал</h3><p>Ответьте на все вопросы. Для перехода дальше нужно набрать не менее {lesson.passPercent}%.</p></div><span className="quiz-count">{questions.length} вопросов</span></div>
                {questions.map((question, questionIndex) => (
                  <fieldset className="question" key={question.id} disabled={quizMutation.isPending}>
                    <legend><span>{questionIndex + 1}</span>{question.prompt}</legend>
                    <div className="answer-options">
                      {question.options.map((option, optionIndex) => (
                        <label className={answers[String(question.id)] === optionIndex ? "chosen" : ""} key={optionIndex}>
                          <input type="radio" name={`question-${question.id}`} checked={answers[String(question.id)] === optionIndex} onChange={() => { setAnswers({ ...answers, [String(question.id)]: optionIndex }); setResult(null); }} />
                          <span className="radio-mark">{answers[String(question.id)] === optionIndex && <i />}</span>{option}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {result && <div className={`quiz-result ${result.passed ? "passed" : "failed"}`} role="status">{result.passed ? <CheckCircle2 /> : <XCircle />}<div><h3>{result.passed ? "Зачёт получен!" : "Пока не получилось"}</h3><p>Правильно {result.correctCount} из {result.totalQuestions} — {result.score}%. {result.passed ? "Следующий урок открыт." : `Нужно минимум ${result.passPercent}%. Повторите материал и попробуйте снова.`}</p></div></div>}
                {quizMutation.error && <div className="alert alert-error">{quizMutation.error.message}</div>}
                {!passed && <button className="button button-primary quiz-submit" disabled={Object.keys(answers).length !== questions.length || quizMutation.isPending || questions.length === 0} onClick={() => quizMutation.mutate({ slug, lessonId: lesson.id, answers })}>{quizMutation.isPending ? "Проверяем…" : result ? <><RotateCcw size={17} /> Попробовать снова</> : "Проверить ответы"}</button>}
              </section>

              <div className="lesson-navigation">
                <button className="button button-outline" disabled={currentIndex <= 0} onClick={() => { const previous = data.lessons[currentIndex - 1]; if (previous) selectLesson(previous.id); }}><ChevronLeft size={17} /> Предыдущий</button>
                {nextLesson ? <button className="button button-primary" disabled={!passed} title={!passed ? "Сначала пройдите тест на 80% или выше" : ""} onClick={() => selectLesson(nextLesson.id)}>Следующий урок <ArrowRight size={17} /></button> : <Link className={`button button-primary ${!passed ? "disabled-link" : ""}`} aria-disabled={!passed} onClick={(event) => { if (!passed) event.preventDefault(); }} to="/my">Завершить в кабинете <Check size={17} /></Link>}
              </div>
              {!passed && <p className="next-hint"><Circle size={12} /> Кнопка следующего урока станет активной после успешной проверки</p>}
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
