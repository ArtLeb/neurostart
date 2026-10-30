import { Link, useSearchParams } from "react-router";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { trpc } from "../providers/trpc";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const purchaseId = Number(params.get("purchase"));
  const status = trpc.payment.status.useQuery({ purchaseId }, {
    enabled: Number.isInteger(purchaseId) && purchaseId > 0,
    refetchInterval: (query) => query.state.data?.purchase.status === "pending" ? 4000 : false,
  });
  const state = status.data?.purchase.status;
  return (
    <main className="payment-return container">
      <div className="payment-status-card">
        {status.isLoading || state === "pending" ? <><span className="status-icon pending"><Clock3 /></span><p className="overline">ПРОВЕРЯЕМ ПЛАТЁЖ</p><h1>Подтверждение займёт немного времени</h1><p>Не закрывайте страницу. Как только ЮKassa подтвердит оплату, курс появится в вашем кабинете.</p></> : state === "paid" ? <><span className="status-icon success"><CheckCircle2 /></span><p className="overline">ОПЛАТА ПОДТВЕРЖДЕНА</p><h1>Курс уже доступен</h1><p>Оплата прошла успешно. Можно переходить к урокам — прогресс будет сохраняться автоматически.</p><Link className="button button-primary" to={`/course/${status.data!.course.slug}`}>Начать обучение <ArrowRight size={17} /></Link></> : <><span className="status-icon error"><XCircle /></span><p className="overline">ПЛАТЁЖ НЕ ЗАВЕРШЁН</p><h1>Попробуйте оплатить ещё раз</h1><p>Если деньги списались, проверьте статус заказа в кабинете или повторите попытку позже.</p><Link className="button button-primary" to={status.data ? `/course/${status.data!.course.slug}` : "/"}>Вернуться к курсу</Link></>}
        {status.error && <div className="alert alert-error">{status.error.message}</div>}
      </div>
    </main>
  );
}
