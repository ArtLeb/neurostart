import { useEffect, useState } from "react";
import { Check, ChevronDown, Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { trpc } from "../providers/trpc";

type Lesson = { id: number; courseId: number; title: string; content: string | null; videoUrl: string | null; sortOrder: number; isPreview: boolean; passPercent: number; questionCount: number };
type Course = { id: number; slug: string; title: string; description: string | null; level: string; price: number; accessType: "free" | "paid"; isPublished: boolean; sortOrder: number; lessons: Lesson[] };

const emptyCourse = { slug: "", title: "", description: "", level: "С нуля", price: 0, accessType: "free" as "free" | "paid", isPublished: false, sortOrder: 10 };

export default function AdminCourseEditor({ course, onCreated }: { course: Course | null; onCreated: (id: number) => void }) {
  const utils = trpc.useUtils();
  const [courseForm, setCourseForm] = useState(course || emptyCourse);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const selectedLesson = course?.lessons.find((item) => item.id === selectedLessonId) || null;
  const [lessonForm, setLessonForm] = useState({ title: "", content: "", videoUrl: "", sortOrder: 1, isPreview: false, passPercent: 80 });
  const [editingLesson, setEditingLesson] = useState(false);
  const [questionForm, setQuestionForm] = useState({ prompt: "", options: ["", "", "", ""], correctOption: 0, sortOrder: 1 });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const questionsQuery = trpc.admin.lessonQuestions.useQuery({ lessonId: selectedLessonId || 0 }, { enabled: Boolean(selectedLessonId) });
  const createCourse = trpc.admin.createCourse.useMutation({ onSuccess: async ({ id }) => { await refresh(); onCreated(id); setMessage("Курс создан"); } });
  const updateCourse = trpc.admin.updateCourse.useMutation({ onSuccess: async () => { await refresh(); setMessage("Изменения сохранены"); } });
  const createLesson = trpc.admin.createLesson.useMutation({ onSuccess: async ({ id }) => { await refresh(); setSelectedLessonId(id); setEditingLesson(false); } });
  const updateLesson = trpc.admin.updateLesson.useMutation({ onSuccess: async () => { await refresh(); setEditingLesson(false); } });
  const deleteLesson = trpc.admin.deleteLesson.useMutation({ onSuccess: async () => { await refresh(); setSelectedLessonId(null); } });
  const createQuestion = trpc.admin.createQuestion.useMutation({ onSuccess: async () => { await refreshQuestions(); resetQuestion(); } });
  const updateQuestion = trpc.admin.updateQuestion.useMutation({ onSuccess: async () => { await refreshQuestions(); resetQuestion(); } });
  const deleteQuestion = trpc.admin.deleteQuestion.useMutation({ onSuccess: refreshQuestions });

  async function refresh() { await utils.admin.courses.invalidate(); }
  async function refreshQuestions() { await Promise.all([questionsQuery.refetch(), refresh()]); }
  function resetQuestion() { setQuestionForm({ prompt: "", options: ["", "", "", ""], correctOption: 0, sortOrder: (questionsQuery.data?.length || 0) + 1 }); setEditingQuestionId(null); }

  useEffect(() => { setCourseForm(course || emptyCourse); setSelectedLessonId(null); setEditingLesson(false); setMessage(""); }, [course?.id]);
  useEffect(() => {
    if (selectedLesson) setLessonForm({ title: selectedLesson.title, content: selectedLesson.content || "", videoUrl: selectedLesson.videoUrl || "", sortOrder: selectedLesson.sortOrder, isPreview: selectedLesson.isPreview, passPercent: selectedLesson.passPercent });
  }, [selectedLessonId, course]);

  function saveCourse() {
    setMessage("");
    const values = { ...courseForm, description: courseForm.description || "", price: courseForm.accessType === "free" ? 0 : Number(courseForm.price), sortOrder: Number(courseForm.sortOrder) };
    if (course) updateCourse.mutate({ ...values, id: course.id });
    else createCourse.mutate(values);
  }
  function saveLesson() {
    if (!course) return;
    const values = { ...lessonForm, courseId: course.id, sortOrder: Number(lessonForm.sortOrder), passPercent: Number(lessonForm.passPercent) };
    if (selectedLesson) updateLesson.mutate({ ...values, id: selectedLesson.id });
    else createLesson.mutate(values);
  }
  function saveQuestion() {
    if (!selectedLessonId) return;
    const options: string[] = [];
    let correctOption = 0;
    questionForm.options.forEach((option, index) => {
      if (!option.trim()) return;
      if (index === questionForm.correctOption) correctOption = options.length;
      options.push(option.trim());
    });
    const values = { ...questionForm, lessonId: selectedLessonId, options, correctOption, sortOrder: Number(questionForm.sortOrder) };
    if (editingQuestionId) updateQuestion.mutate({ ...values, id: editingQuestionId });
    else createQuestion.mutate(values);
  }

  const mutationError = createCourse.error || updateCourse.error || createLesson.error || updateLesson.error || createQuestion.error || updateQuestion.error || deleteLesson.error || deleteQuestion.error;

  return (
    <div className="editor-stack">
      <section className="admin-editor-section">
        <div className="editor-title"><div><p className="overline">{course ? "НАСТРОЙКИ КУРСА" : "НОВЫЙ КУРС"}</p><h2>{course ? course.title : "Основная информация"}</h2></div>{message && <span className="save-message"><Check size={15} />{message}</span>}</div>
        <div className="admin-form-grid">
          <label className="span-2">Название<input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Например, Нейросети для маркетинга" /></label>
          <label>Адрес (slug)<input value={courseForm.slug} onChange={(e) => setCourseForm({ ...courseForm, slug: e.target.value.toLowerCase() })} placeholder="ai-marketing" /></label>
          <label>Уровень<input value={courseForm.level} onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })} /></label>
          <label className="span-2">Краткое описание<textarea rows={3} value={courseForm.description || ""} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} /></label>
          <label>Тип доступа<select value={courseForm.accessType} onChange={(e) => setCourseForm({ ...courseForm, accessType: e.target.value as "free" | "paid" })}><option value="free">Бесплатный</option><option value="paid">Платный</option></select></label>
          <label>Цена, ₽<input type="number" min="0" disabled={courseForm.accessType === "free"} value={courseForm.accessType === "free" ? 0 : courseForm.price} onChange={(e) => setCourseForm({ ...courseForm, price: Number(e.target.value) })} /></label>
          <label>Порядок в каталоге<input type="number" min="0" value={courseForm.sortOrder} onChange={(e) => setCourseForm({ ...courseForm, sortOrder: Number(e.target.value) })} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={courseForm.isPublished} onChange={(e) => setCourseForm({ ...courseForm, isPublished: e.target.checked })} /><span>Опубликован в каталоге</span></label>
        </div>
        <button className="button button-primary" onClick={saveCourse} disabled={createCourse.isPending || updateCourse.isPending || !courseForm.title || !courseForm.slug}><Save size={16} />{course ? "Сохранить курс" : "Создать курс"}</button>
      </section>

      {course && <section className="admin-editor-section">
        <div className="editor-title"><div><p className="overline">СОДЕРЖАНИЕ</p><h2>Уроки курса</h2></div><button className="button button-outline" onClick={() => { setSelectedLessonId(null); setLessonForm({ title: "", content: "", videoUrl: "", sortOrder: course.lessons.length + 1, isPreview: false, passPercent: 80 }); setEditingLesson(true); }}><Plus size={16} />Добавить урок</button></div>
        <div className="admin-lesson-list">
          {course.lessons.map((lesson, index) => <button key={lesson.id} className={selectedLessonId === lesson.id ? "active" : ""} onClick={() => { setSelectedLessonId(lesson.id); setEditingLesson(true); }}><span>{index + 1}</span><div><strong>{lesson.title}</strong><small>{lesson.questionCount} вопросов · зачёт от {lesson.passPercent}%</small></div><Edit3 size={16} /></button>)}
          {!course.lessons.length && <p className="muted">Добавьте первый урок, затем вопросы для проверки.</p>}
        </div>

        {editingLesson && <div className="nested-editor">
          <div className="editor-title"><h3>{selectedLesson ? "Редактирование урока" : "Новый урок"}</h3><button className="icon-button" onClick={() => setEditingLesson(false)} aria-label="Скрыть редактор"><X size={17} /></button></div>
          <div className="admin-form-grid">
            <label className="span-2">Название урока<input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></label>
            <label className="span-2">Текст урока<textarea rows={10} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} placeholder="Материал, объяснения и практическое задание…" /></label>
            <label className="span-2">Ссылка на видео<input value={lessonForm.videoUrl} onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=… или /videos/lesson.mp4" /></label>
            <label>Порядок<input type="number" min="1" value={lessonForm.sortOrder} onChange={(e) => setLessonForm({ ...lessonForm, sortOrder: Number(e.target.value) })} /></label>
            <label>Проходной балл, %<input type="number" min="1" max="100" value={lessonForm.passPercent} onChange={(e) => setLessonForm({ ...lessonForm, passPercent: Number(e.target.value) })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={lessonForm.isPreview} onChange={(e) => setLessonForm({ ...lessonForm, isPreview: e.target.checked })} /><span>Открытый демоурок</span></label>
          </div>
          <div className="editor-actions"><button className="button button-primary" onClick={saveLesson} disabled={!lessonForm.title}><Save size={16} />Сохранить урок</button>{selectedLesson && <button className="button button-danger-ghost" onClick={() => { if (window.confirm("Удалить урок, его вопросы и прогресс учеников?")) deleteLesson.mutate({ id: selectedLesson.id }); }}><Trash2 size={16} />Удалить</button>}</div>
        </div>}

        {selectedLesson && !editingLesson && <button className="button button-outline" onClick={() => setEditingLesson(true)}>Редактировать выбранный урок</button>}

        {selectedLesson && <div className="questions-editor">
          <div className="editor-title"><div><p className="overline">ТЕСТ</p><h3>Вопросы: {selectedLesson.title}</h3></div><span className="quiz-count">{questionsQuery.data?.length || 0}</span></div>
          <div className="question-admin-list">{questionsQuery.data?.map((question, index) => <div key={question.id}><button onClick={() => { setEditingQuestionId(question.id); setQuestionForm({ prompt: question.prompt, options: [...question.options], correctOption: question.correctOption, sortOrder: question.sortOrder }); }}><span>{index + 1}.</span>{question.prompt}<ChevronDown size={15} /></button><small>Правильный ответ: {question.options[question.correctOption]}</small></div>)}</div>
          <div className="nested-editor">
            <h4>{editingQuestionId ? "Редактировать вопрос" : "Добавить вопрос"}</h4>
            <label>Формулировка<textarea rows={2} value={questionForm.prompt} onChange={(e) => setQuestionForm({ ...questionForm, prompt: e.target.value })} /></label>
            <div className="option-editor">
              {questionForm.options.map((option, index) => (
                <div key={index}>
                  <input
                    type="radio"
                    name="correct-option"
                    checked={questionForm.correctOption === index}
                    onChange={() => setQuestionForm({ ...questionForm, correctOption: index })}
                    aria-label={`Ответ ${index + 1} правильный`}
                  />
                  <input
                    value={option}
                    onChange={(event) => {
                      const options = [...questionForm.options];
                      options[index] = event.target.value;
                      setQuestionForm({ ...questionForm, options });
                    }}
                    placeholder={`Вариант ${index + 1}`}
                  />
                </div>
              ))}
            </div>
            <p className="field-hint">Переключатель слева отмечает правильный вариант. Пустые варианты не сохраняются.</p>
            <div className="editor-actions"><button className="button button-primary" onClick={saveQuestion} disabled={!questionForm.prompt.trim() || questionForm.options.filter((item) => item.trim()).length < 2 || !questionForm.options[questionForm.correctOption]?.trim()}><Plus size={16} />{editingQuestionId ? "Сохранить вопрос" : "Добавить вопрос"}</button>{editingQuestionId && <><button className="button button-outline" onClick={resetQuestion}>Отмена</button><button className="button button-danger-ghost" onClick={() => { if (window.confirm("Удалить вопрос?")) deleteQuestion.mutate({ id: editingQuestionId }); }}><Trash2 size={16} /></button></>}</div>
          </div>
        </div>}
      </section>}
      {mutationError && <div className="alert alert-error">{mutationError.message}</div>}
    </div>
  );
}
