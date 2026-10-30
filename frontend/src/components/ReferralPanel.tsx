import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Check, Copy, Gift, Users } from "lucide-react";
import { trpc } from "../providers/trpc";

export default function ReferralPanel() {
  const referral = trpc.referral.me.useQuery();
  const utils = trpc.useUtils();
  const [copyDone, setCopyDone] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number>(0);
  const [message, setMessage] = useState("");
  const data = referral.data;
  const availableCourses = useMemo(() => data?.giftCourses.filter((course) => !course.hasAccess) || [], [data]);
  const availableRewards = data?.rewards.filter((reward) => reward.status === "available") || [];
  const claimedRewards = data?.rewards.filter((reward) => reward.status === "claimed") || [];
  const referralLink = data ? `${window.location.origin}/?ref=${data.referralCode}` : "";

  useEffect(() => {
    if (!availableCourses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(availableCourses[0]?.id || 0);
    }
  }, [availableCourses, selectedCourseId]);

  const claim = trpc.referral.claim.useMutation({
    onSuccess: async (result) => {
      setMessage(`Курс «${result.courseTitle}» добавлен в ваш кабинет`);
      await Promise.all([utils.referral.me.invalidate(), utils.course.my.invalidate()]);
    },
  });

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setMessage("Не удалось скопировать автоматически. Выделите ссылку и скопируйте её вручную.");
    }
  }

  return (
    <section className="referral-panel" id="referral" aria-labelledby="referral-panel-title">
      <div className="referral-panel-heading">
        <div><p className="overline">ДЕЛИТЕСЬ И ПОЛУЧАЙТЕ</p><h2 id="referral-panel-title">10 друзей — курс в подарок!</h2><p>Засчитывается каждый приглашённый пользователь после его первой оплаты любого курса.</p></div>
        <span className="referral-panel-icon"><Gift /></span>
      </div>
      {referral.isLoading && <div className="page-loading"><span className="spinner" />Загружаем реферальную программу…</div>}
      {referral.error && <div className="alert alert-error">{referral.error.message}</div>}
      {data && <>
        <div className="referral-link-row">
          <label><span>Ваша персональная ссылка</span><input value={referralLink} readOnly onFocus={(event) => event.target.select()} /></label>
          <button className="button button-dark" onClick={copyLink}>{copyDone ? <Check size={17} /> : <Copy size={17} />}{copyDone ? "Скопировано" : "Копировать"}</button>
        </div>
        <div className="referral-stats">
          <div><strong>{data.qualified}</strong><span>оплатили</span></div>
          <div><strong>{data.total}</strong><span>приглашено</span></div>
          <div><strong>{availableRewards.length}</strong><span>наград доступно</span></div>
        </div>
        <div className="referral-next">
          <div><span>{availableRewards.length ? "Подарок уже ждёт вас" : `До следующего подарка: ещё ${data.remaining} оплативших`}</span><strong>{data.qualified % data.required} / {data.required}</strong></div>
          <div className="progress-track"><i style={{ width: `${data.qualified % data.required * 10}%` }} /></div>
        </div>

        {availableRewards.map((reward) => <div className="referral-reward-card" key={reward.id}>
          <div><span className="referral-reward-label"><Gift size={16} /> Награда №{reward.rewardNumber}</span><h3>Ваш платный курс в подарок</h3><p>Выберите программу — доступ откроется сразу и останется в личном кабинете.</p></div>
          {availableCourses.length ? <div className="referral-claim-form">
            <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(Number(event.target.value))} aria-label="Подарочный курс">
              {availableCourses.map((course) => <option value={course.id} key={course.id}>{course.title} · {course.price.toLocaleString("ru-RU")} ₽</option>)}
            </select>
            <button className="button button-primary" disabled={!selectedCourseId || claim.isPending} onClick={() => claim.mutate({ rewardId: reward.id, courseId: selectedCourseId })}>{claim.isPending ? "Открываем доступ…" : "Забрать курс"}<ArrowRight size={17} /></button>
          </div> : <p className="muted">Все доступные платные курсы уже есть в вашем кабинете.</p>}
        </div>)}
        {claim.error && <div className="alert alert-error">{claim.error.message}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {claimedRewards.length > 0 && <div className="referral-claimed"><h3>Полученные подарки</h3>{claimedRewards.map((reward) => <div key={reward.id}><span><Check size={16} /> Награда №{reward.rewardNumber}: {reward.courseTitle || "Курс"}</span>{reward.courseSlug && <Link to={`/course/${reward.courseSlug}`}>Открыть <ArrowRight size={14} /></Link>}</div>)}</div>}

        <div className="referral-invited">
          <h3><Users size={18} /> Ваши приглашённые</h3>
          {!data.invited.length && <p>Пока никто не зарегистрировался по вашей ссылке. Отправьте её друзьям, которым будут полезны курсы по нейросетям.</p>}
          {data.invited.map((person) => <div key={person.id}><span>{person.displayName || "Новый пользователь"}</span><small className={person.status === "qualified" ? "qualified" : ""}>{person.status === "qualified" ? "Оплата подтверждена" : person.status === "reversed" ? "Не засчитан" : "Ждём первую оплату"}</small></div>)}
        </div>
      </>}
    </section>
  );
}
