# НЕЙРОСТАРТ: развёртывание на Beget и Foxcloud

Это инструкция для раздельного размещения готового проекта:

- `https://ai.lebedevit.ru` — frontend на Beget;
- `https://api.lebedevit.ru` — backend на Foxcloud VPS;
- MySQL — в Docker на том же VPS, без доступа из интернета;
- Caddy — HTTPS и обратный прокси перед backend;
- существующий VPN и его порты не изменяются.

Фактическое размещение выполняется вами по этой инструкции. До прохождения проверок не считайте сайт опубликованным, а тестовые записи — реальной оплатой.

## 1. Что находится в комплекте

- `backend` — серверная часть, Dockerfile, SQL-обновления и зависимости.
- `frontend` — исходный код клиентской части.
- `deploy` — Docker Compose, Caddyfile и пример серверных настроек.
- `beget_upload` — уже собранный frontend для загрузки на Beget, включая скрытый файл `.htaccess`.

Реальных файлов `.env`, паролей, ключей ЮKassa и папок `node_modules` в комплекте нет.

## 2. Порядок работы

Выполняйте этапы последовательно:

1. Создайте сайт и поддомен `ai.lebedevit.ru` в Beget.
2. Настройте DNS для обоих поддоменов.
3. Загрузите frontend на Beget и включите для него SSL.
4. Установите Docker на VPS, не меняя настройки VPN.
5. Загрузите `backend` и `deploy` на VPS.
6. Создайте серверный `.env` с новыми секретами.
7. Выберите один вариант: новая база или перенос локальной базы.
8. Запустите backend и Caddy.
9. Проверите HTTPS, вход, сохранение сессии, курсы и прогресс.
10. После этого подключайте тестовую, а затем боевую ЮKassa.

## 3. DNS

### 3.1. Поддомен API

В панели управления DNS домена `lebedevit.ru` создайте запись:

| Тип | Имя | Значение | TTL |
|---|---|---|---|
| A | `api` | `194.156.66.82` | 300 или значение по умолчанию |

Если в панели требуется полное имя, укажите `api.lebedevit.ru`. Не включайте для этой записи сторонний прокси, пока не проверена выдача HTTPS-сертификата.

### 3.2. Поддомен сайта

Сначала создайте сайт в Beget и прикрепите к нему `ai.lebedevit.ru`. Затем настройте DNS именно так, как покажет Beget для этого сайта.

- Если DNS домена обслуживается Beget, нужная запись может быть создана панелью автоматически.
- Если DNS обслуживается другим регистратором, скопируйте тип и значение записи из инструкции Beget.
- Не направляйте `ai.lebedevit.ru` A-записью на `194.156.66.82`: это адрес API, а не frontend.

Дождитесь применения DNS. Проверка в PowerShell:

```powershell
Resolve-DnsName ai.lebedevit.ru
Resolve-DnsName api.lebedevit.ru
```

Для `api.lebedevit.ru` должен отображаться адрес `194.156.66.82`.

## 4. Frontend на Beget

### Вариант А. Использовать готовую сборку

В архиве уже есть папка `beget_upload`. Сборка выполнена с адресом API `https://api.lebedevit.ru`.

1. В Beget откройте файловый менеджер сайта, к которому прикреплён `ai.lebedevit.ru`.
2. Перейдите в его каталог `public_html`.
3. Удалите только демонстрационную заглушку нового сайта, если она там есть. Не удаляйте чужие файлы, если каталог уже используется.
4. Загрузите содержимое папки `beget_upload` в `public_html`.
5. Важно загрузить именно содержимое: `index.html`, папку `assets`, видео при наличии и скрытый `.htaccess`.
6. Включите отображение скрытых файлов и убедитесь, что `public_html/.htaccess` существует.
7. В разделе SSL/HTTPS Beget включите бесплатный сертификат для `ai.lebedevit.ru`.

`.htaccess` нужен, чтобы при открытии внутренней страницы сайта Beget возвращал `index.html`, а не ошибку 404.

### Вариант Б. Собрать frontend самостоятельно в Windows

Этот вариант нужен после изменения исходного кода или добавления видео.

Откройте PowerShell в папке `frontend` комплекта:

```powershell
npm ci
$env:VITE_API_URL = "https://api.lebedevit.ru"
npm run check
npm run build
Test-Path .\dist\index.html
Test-Path .\dist\.htaccess
```

Обе последние команды должны вывести `True`. После этого загрузите содержимое `dist` в `public_html` вместо содержимого `beget_upload`.

Не создавайте в frontend переменные с секретом ЮKassa, паролем MySQL или `APP_SECRET`. Значения, начинающиеся с `VITE_`, попадают в браузер и не являются секретными.

### Локальные видео уроков

До сборки поместите MP4-файлы в:

```text
frontend/public/videos/
```

В админке указывайте ссылку вида:

```text
/videos/lesson-01-ai-around-us.mp4
```

После сборки файлы окажутся в `dist/videos` и должны быть загружены на Beget вместе с остальным содержимым `dist`.

## 5. Подключение к VPS и предварительная проверка

Подключитесь из PowerShell:

```powershell
ssh root@194.156.66.82
```

Если используется другой пользователь, замените `root` на его имя и выполняйте серверные команды через `sudo`.

Проверьте систему, память и занятые порты:

```bash
cat /etc/os-release
free -h
df -h /
sudo ss -lntup
docker --version
docker compose version
```

Важно:

- Если порты `80` или `443` уже заняты VPN или другим сервисом, остановитесь и выясните, какой процесс их использует. Не завершайте VPN и не удаляйте его настройки.
- Если Docker уже установлен и работает, не переустанавливайте его и не удаляйте старые пакеты.
- Не выполняйте `ufw reset`, `iptables -F`, `docker system prune` и `docker compose down -v`.
- Не открывайте наружу порты `3000` и `3306`.

## 6. Установка Docker на Ubuntu 24.04

Если обе команды `docker --version` и `docker compose version` уже выполняются успешно, пропустите этот раздел.

Используется официальный репозиторий Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl openssl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
docker --version
docker compose version
```

Официальная документация: <https://docs.docker.com/engine/install/ubuntu/>.

Docker предупреждает, что опубликованные порты контейнеров могут обходить правила UFW. Поэтому в данном Compose наружу опубликованы только порты Caddy `80` и `443`; MySQL и backend доступны лишь внутри Docker-сети.

## 7. Загрузка файлов на VPS

На VPS создайте каталог:

```bash
sudo mkdir -p /opt/neurostart
sudo chown -R "$USER":"$USER" /opt/neurostart
```

На Windows откройте новый PowerShell в каталоге, где находятся папки `backend` и `deploy`, и выполните:

```powershell
scp -r .\backend root@194.156.66.82:/opt/neurostart/
scp -r .\deploy root@194.156.66.82:/opt/neurostart/
```

Если используется не `root`, подставьте своего пользователя. Папку `frontend` на VPS загружать не нужно.

На VPS проверьте:

```bash
cd /opt/neurostart
ls -la
ls -la backend/Dockerfile deploy/docker-compose.yml deploy/Caddyfile
```

## 8. Серверный файл .env

На VPS выполните:

```bash
cd /opt/neurostart/deploy
cp .env.example .env
chmod 600 .env

APP_SECRET_NEW=$(openssl rand -hex 32)
MYSQL_PASSWORD_NEW=$(openssl rand -hex 32)
MYSQL_ROOT_PASSWORD_NEW=$(openssl rand -hex 32)

sed -i "s|^APP_SECRET=.*|APP_SECRET=${APP_SECRET_NEW}|" .env
sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${MYSQL_PASSWORD_NEW}|" .env
sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD_NEW}|" .env

unset APP_SECRET_NEW MYSQL_PASSWORD_NEW MYSQL_ROOT_PASSWORD_NEW
```

Команды не выводят секреты на экран. Не присылайте содержимое `.env` в чат и не добавляйте его в архив.

Проверьте только несекретные адреса:

```bash
grep -E '^(PUBLIC_APP_URL|CORS_ORIGINS|API_ONLY|PORT)=' .env
```

Ожидаемые значения:

```text
PUBLIC_APP_URL=https://ai.lebedevit.ru
CORS_ORIGINS=https://ai.lebedevit.ru
API_ONLY=true
PORT=3000
```

Проверьте Compose, не выводя секреты:

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env config --quiet
```

Отсутствие сообщений означает успешную проверку синтаксиса.

## 9. Запуск MySQL и сборка образов

DNS `api.lebedevit.ru` уже должен указывать на VPS, а порты `80` и `443` должны быть свободны.

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env pull mysql caddy
docker compose --env-file .env build backend db-tools
docker compose --env-file .env up -d mysql
docker compose --env-file .env ps
```

Дождитесь состояния `healthy` у `mysql`. Проверка:

```bash
docker compose --env-file .env ps mysql
```

Теперь выберите только один из двух следующих разделов: новая база или перенос существующей.

## 10. Вариант 1: создать новую базу

Выберите этот вариант только если переносить локальных учеников, курсы и оплаты не требуется.

Создайте таблицы:

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env run --rm db-tools npm run db:push
```

Не добавляйте флаг `--force`. Если команда предлагает удалить таблицу или столбец, не подтверждайте операцию и остановитесь.

Демонстрационные курсы создавать необязательно. Если база действительно новая и нужны именно демонстрационные данные, выполните один раз:

```bash
docker compose --env-file .env run --rm db-tools npm run db:seed
```

Не запускайте `db:seed` для перенесённой рабочей базы: сидер обновляет демонстрационные курсы и не является средством переноса данных.

Перейдите к разделу 12.

## 11. Вариант 2: перенести текущую локальную базу

Этот вариант сохраняет существующих пользователей, курсы, прогресс, доступы и записи об оплатах. Сначала убедитесь, что локальная версия сайта работает с актуальной схемой базы.

### 11.1. Экспорт на Windows

Откройте PowerShell. Проверьте путь к MySQL и при необходимости измените версию в первой строке:

```powershell
$MySqlBin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
$DbName = "neurostart"
$DumpFile = "$env:USERPROFILE\neurostart-backup.sql"

Test-Path "$MySqlBin\mysqldump.exe"

& "$MySqlBin\mysqldump.exe" `
  --host=127.0.0.1 `
  --user=root `
  --password `
  --default-character-set=utf8mb4 `
  --single-transaction `
  --routines `
  --triggers `
  $DbName `
  --result-file="$DumpFile"

Get-Item $DumpFile
```

MySQL запросит локальный пароль root. Вместо `neurostart` укажите фактическое имя вашей локальной базы, если оно другое. Не вписывайте пароль прямо в команду.

Сохраните отдельную копию дампа. Не удаляйте локальную базу после экспорта.

### 11.2. Загрузка дампа на VPS

В том же PowerShell:

```powershell
scp "$env:USERPROFILE\neurostart-backup.sql" root@194.156.66.82:/opt/neurostart/deploy/import.sql
```

### 11.3. Импорт в Docker MySQL

На VPS:

```bash
cd /opt/neurostart/deploy
chmod 600 import.sql
set -a
. ./.env
set +a

docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < import.sql

docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES;"
```

После успешного импорта удалите переносную копию с сервера, оставив резервный файл на своём компьютере:

```bash
rm -f /opt/neurostart/deploy/import.sql
```

Если дамп сделан из текущей рабочей локальной версии проекта, повторно применять SQL-обновления и запускать `db:push` не требуется.

Если база старше текущего кода, сначала сохраните дополнительную копию, затем применяйте только нужные SQL-файлы из `backend/database`. Оба комплектных обновления используют проверки существования объектов:

```bash
cd /opt/neurostart/deploy
set -a
. ./.env
set +a

docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < ../backend/database/001_update_from_original.sql

docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < ../backend/database/002_add_referral_rewards.sql
```

Не выполняйте эти команды автоматически при каждом обновлении. Они нужны только для базы со старой схемой.

## 12. Запуск backend и HTTPS

После создания или импорта базы:

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env up -d backend caddy
docker compose --env-file .env ps
```

Проверьте журналы:

```bash
docker compose --env-file .env logs --tail=100 backend
docker compose --env-file .env logs --tail=100 caddy
```

Caddy автоматически запрашивает сертификат для `api.lebedevit.ru`. Для этого DNS должен работать, а порты `80` и `443` — быть доступны снаружи.

Проверка API с VPS:

```bash
curl -i https://api.lebedevit.ru/api/health
```

Ожидается HTTP `200` и ответ:

```json
{"ok":true}
```

## 13. Firewall без изменения VPN

Сначала посмотрите текущее состояние:

```bash
sudo ufw status verbose
sudo ss -lntup
```

Не сбрасывайте существующие правила. Если UFW активен и в нём ещё нет разрешений для веб-серверов, добавьте только необходимые:

```bash
sudo ufw allow 80/tcp comment "NEUROSTART HTTP and ACME"
sudo ufw allow 443/tcp comment "NEUROSTART HTTPS"
sudo ufw allow 443/udp comment "NEUROSTART HTTP3"
```

Если в Foxcloud включён отдельный облачный firewall, разрешите в нём входящие `80/tcp`, `443/tcp` и `443/udp`. Не удаляйте правила SSH и VPN.

Дополнительно открывать `3000` и `3306` не нужно. В Compose для них вообще нет публикации на хост.

## 14. Проверка CORS и пользовательской сессии

С VPS или другого компьютера:

```bash
curl -i -X OPTIONS https://api.lebedevit.ru/api/auth/login \
  -H "Origin: https://ai.lebedevit.ru" \
  -H "Access-Control-Request-Method: POST"
```

В ответе должны быть заголовки:

```text
Access-Control-Allow-Origin: https://ai.lebedevit.ru
Access-Control-Allow-Credentials: true
```

Для неразрешённого адреса такого разрешения быть не должно:

```bash
curl -i -X OPTIONS https://api.lebedevit.ru/api/auth/login \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST"
```

Затем откройте `https://ai.lebedevit.ru` в браузере:

1. Главная страница и каталог курсов открываются без ошибок.
2. Регистрация и вход работают.
3. После обновления страницы пользователь остаётся авторизованным.
4. Урок, тест и сохранение прогресса работают.
5. Следующий урок открывается только после результата не ниже 80%.
6. В админке отображаются ученики, прогресс, оплаты и курсы.
7. Реферальная ссылка и статистика доступны в личном кабинете.

При новой пустой базе первый зарегистрированный пользователь получает роль администратора. Поэтому сразу после запуска зарегистрируйте собственный административный аккаунт. Не публикуйте его пароль.

Если вход работает только до обновления страницы, проверьте в браузерных инструментах разработчика запрос `/api/auth/me`, ответ API и наличие cookie. Оба адреса должны использовать HTTPS, а `CORS_ORIGINS` — содержать ровно `https://ai.lebedevit.ru` без завершающего `/`.

## 15. Подключение ЮKassa после проверки сайта

Сначала используйте тестовый магазин ЮKassa. Данные магазина вносятся только в серверный `/opt/neurostart/deploy/.env`:

```env
YOOKASSA_SHOP_ID=идентификатор_магазина
YOOKASSA_SECRET_KEY=секретный_ключ_магазина
YOOKASSA_VAT_CODE=1
```

Не используйте префикс `VITE_` и не переносите секретный ключ во frontend. Значение `YOOKASSA_VAT_CODE` согласуйте с вашими настройками налогообложения.

Отредактируйте файл локально на сервере:

```bash
cd /opt/neurostart/deploy
nano .env
chmod 600 .env
docker compose --env-file .env up -d --force-recreate backend
```

В личном кабинете ЮKassa укажите адрес HTTP-уведомления:

```text
https://api.lebedevit.ru/api/payments/yookassa/webhook
```

Адрес возврата покупателя формируется backend от значения:

```text
PUBLIC_APP_URL=https://ai.lebedevit.ru
```

Проверяйте сначала тестовой оплатой банковской картой и СБП. Затем убедитесь, что:

- запись платежа появилась в админке;
- доступ выдан только после подтверждённого успешного платежа;
- повторное уведомление не создаёт второй доступ или повторную реферальную квалификацию;
- ручная выдача доступа не засчитывается как оплата приглашённого;
- после каждых десяти уникальных оплативших приглашённых появляется одна новая награда;
- подарочный курс можно выбрать только из доступных для награды платных курсов.

Наличие записи в локальной базе само по себе не доказывает реальную оплату. Для боевого запуска отдельно проверьте статус платежа в ЮKassa и повторную серверную проверку через API.

## 16. Резервные копии

### 16.1. Создать копию базы на VPS

```bash
mkdir -p /opt/neurostart/backups
chmod 700 /opt/neurostart/backups
cd /opt/neurostart/deploy
set -a
. ./.env
set +a

BACKUP_FILE="/opt/neurostart/backups/neurostart-$(date +%F-%H%M).sql"
docker compose --env-file .env exec -T mysql \
  mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" \
  --single-transaction --routines --triggers \
  "$MYSQL_DATABASE" > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"
unset BACKUP_FILE
```

Скачайте копию на свой компьютер в PowerShell, подставив фактическое имя файла:

```powershell
scp root@194.156.66.82:/opt/neurostart/backups/ИМЯ_ФАЙЛА.sql "$env:USERPROFILE\Desktop\"
```

Храните хотя бы одну копию вне VPS. Резервная копия содержит персональные и платёжные записи, поэтому не отправляйте её в чат и не выкладывайте в открытый доступ.

### 16.2. Восстановление

Восстановление в рабочую базу перезаписывает таблицы из дампа. Сначала создайте новую аварийную копию текущего состояния и по возможности проверьте дамп на отдельной тестовой базе.

Для аварийного восстановления выбранной копии:

```bash
cd /opt/neurostart/deploy
set -a
. ./.env
set +a

docker compose --env-file .env stop backend caddy

docker compose --env-file .env exec -T mysql \
  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  < /opt/neurostart/backups/ИМЯ_ФАЙЛА.sql

docker compose --env-file .env up -d backend caddy
docker compose --env-file .env ps
```

Не удаляйте Docker volume `mysql_data` для восстановления и не используйте `docker compose down -v`.

## 17. Обновление сайта

### Backend

Перед обновлением сделайте резервную копию базы. Загрузите изменённые файлы `backend` и, при необходимости, `deploy`, затем:

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env build backend db-tools
docker compose --env-file .env up -d backend caddy
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 backend
```

Если обновление меняет схему базы, применяйте поставленный SQL-файл отдельно и только после резервной копии. Не запускайте `db:push --force`.

### Frontend

После изменения исходников повторите сборку в PowerShell:

```powershell
npm ci
$env:VITE_API_URL = "https://api.lebedevit.ru"
npm run check
npm run build
Test-Path .\dist\.htaccess
```

Загрузите новое содержимое `dist` на Beget. Старые файлы `assets` с другими хешами можно удалять только после успешной загрузки нового `index.html` и всех новых файлов.

## 18. Диагностика типичных ошибок

### `api.lebedevit.ru` не открывается по HTTPS

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=150 caddy
curl -i http://localhost/api/health
```

Проверьте DNS, занятость портов `80/443`, облачный firewall и доступность VPS снаружи. Не удаляйте VPN-сервис, если он занимает нужный порт.

### Backend перезапускается или база недоступна

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=150 mysql
docker compose --env-file .env logs --tail=150 backend
free -h
```

Не публикуйте вывод, если в нём видны пароли или ключи. Не пересоздавайте volume базы.

### Frontend открывается, но курсы и вход не работают

Проверьте:

1. `https://api.lebedevit.ru/api/health` возвращает `200`.
2. В собранном frontend использовался `VITE_API_URL=https://api.lebedevit.ru`.
3. В серверном `.env` задано `CORS_ORIGINS=https://ai.lebedevit.ru`.
4. Оба сайта открываются по HTTPS.
5. В браузерной консоли и на вкладке Network нет ошибок CORS или `401/500`.

После изменения `VITE_API_URL` frontend нужно собрать заново. После изменения `CORS_ORIGINS` backend нужно пересоздать:

```bash
cd /opt/neurostart/deploy
docker compose --env-file .env up -d --force-recreate backend
```

### Внутренняя страница сайта на Beget выдаёт 404

Убедитесь, что файл `.htaccess` находится именно в корне `public_html`, а не во вложенной папке. Затем повторно загрузите его из `beget_upload` или `frontend/dist`.

### Нехватка памяти на VPS

```bash
free -h
docker stats --no-stream
```

В Compose уже ограничены MySQL, backend и Caddy. Не запускайте одновременно несколько лишних сборок и не отключайте VPN ради освобождения памяти. При повторной нехватке памяти рассмотрите увеличение тарифа VPS.

## 19. Что проверено в подготовленном комплекте

- TypeScript-проверки backend и frontend выполнены.
- Production-сборки backend и frontend выполнены.
- `.htaccess` присутствует в готовой сборке frontend.
- Синтаксис Docker Compose проверен.
- MySQL и backend не публикуют порты наружу; наружу опубликованы только `80/443` Caddy.
- В production-зависимостях устранено замечание к `@hono/node-server`; использованная версия esbuild также обновлена.
- После обновления остаются четыре moderate-замечания npm в цепочке инструментов разработки `drizzle-kit` / старого вложенного `esbuild`. Production-образ backend содержит только собранный bundle и не содержит `node_modules`; инструменты БД собираются в отдельный образ `db-tools`. Не применялся разрушающий `npm audit fix --force` и не выполнялся откат `drizzle-kit` до старой major-версии.
- Реальные Docker build, запуск на вашем VPS, DNS, SSL, Beget, перенос вашей базы и оплата ЮKassa ещё не выполнялись. Их нужно пройти по шагам этой инструкции.

## 20. Краткий чек-лист запуска

- [ ] `ai.lebedevit.ru` прикреплён к отдельному сайту Beget.
- [ ] `api.lebedevit.ru` имеет A-запись на `194.156.66.82`.
- [ ] Содержимое `beget_upload` загружено в `public_html`, включая `.htaccess`.
- [ ] SSL включён для обоих поддоменов.
- [ ] Секреты созданы непосредственно на VPS и не включены в архив.
- [ ] Выбран только один сценарий: новая база или импорт существующей.
- [ ] `db:push --force`, `down -v`, сброс firewall и удаление VPN не выполнялись.
- [ ] `/api/health` возвращает `200` по HTTPS.
- [ ] Вход сохраняется после обновления страницы.
- [ ] Прогресс, тесты 80%, админка и реферальный кабинет проверены.
- [ ] Создана и скачана резервная копия базы.
- [ ] ЮKassa сначала проверена в тестовом режиме, webhook указывает на API-поддомен.
