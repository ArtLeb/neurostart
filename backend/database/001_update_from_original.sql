-- НЕЙРОСТАРТ: обновление исходной базы до новой версии приложения.
-- СУБД: MySQL 8+ / совместимая база.
-- Перед запуском обязательно сделайте резервную копию.
-- Скрипт предназначен для исходной схемы из schema.sql и запускается один раз.
-- Для новой пустой базы вместо этого файла используйте: npm run db:push
-- После обновления выполните: npm run db:seed

CREATE DATABASE IF NOT EXISTS neurostart
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE neurostart;

-- Пользователи старой OAuth-схемы могли не иметь email или пароля.
-- Таким аккаунтам присваиваются служебные уникальные email и непригодный для входа хеш.
-- Их данные остаются в базе; новая регистрация продолжает работать по email и паролю.
UPDATE users SET email = CONCAT('legacy-', id, '@invalid.local') WHERE email IS NULL;
UPDATE users SET password_hash = 'disabled' WHERE password_hash IS NULL;

ALTER TABLE users
  MODIFY email VARCHAR(320) NOT NULL,
  MODIFY password_hash TEXT NOT NULL,
  MODIFY referral_code VARCHAR(32) NULL;

-- Курсы: уровень, порядок сортировки и цена в целых рублях.
ALTER TABLE courses
  ADD COLUMN level VARCHAR(80) NOT NULL DEFAULT 'С нуля' AFTER description,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_published,
  MODIFY price INT NOT NULL DEFAULT 0;

-- Уроки: один основной видео-URL и настраиваемый проходной балл.
ALTER TABLE lessons
  ADD COLUMN video_url TEXT NULL AFTER content,
  ADD COLUMN pass_percent INT NOT NULL DEFAULT 80 AFTER is_preview;

-- Переносим первую ранее добавленную ссылку на видео в основную запись урока.
-- Таблицу lesson_videos не удаляем, чтобы сохранить исходные данные.
UPDATE lessons AS l
SET l.video_url = (
  SELECT v.video_url
  FROM lesson_videos AS v
  WHERE v.lesson_id = l.id
  ORDER BY v.id
  LIMIT 1
)
WHERE l.video_url IS NULL
  AND EXISTS (SELECT 1 FROM lesson_videos AS v WHERE v.lesson_id = l.id);

-- Заказы: новая модель хранит итоговую сумму в amount и способ оплаты.
-- Старые ценовые поля сохраняются, но становятся необязательными для новых заказов.
ALTER TABLE course_purchases
  ADD COLUMN amount INT NULL AFTER status,
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'RUB' AFTER amount,
  ADD COLUMN payment_method VARCHAR(40) NULL AFTER payment_provider,
  MODIFY list_price DECIMAL(10,2) NULL,
  MODIFY discount_amount DECIMAL(10,2) NULL,
  MODIFY final_price DECIMAL(10,2) NULL;

UPDATE course_purchases SET amount = ROUND(final_price) WHERE amount IS NULL;
ALTER TABLE course_purchases MODIFY amount INT NOT NULL;

-- Старые незаполненные даты завершения считаются датой миграции.
UPDATE lesson_progress SET completed_at = CURRENT_TIMESTAMP WHERE completed_at IS NULL;
ALTER TABLE lesson_progress MODIFY completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Вопросы проверочных тестов.
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  lesson_id BIGINT UNSIGNED NOT NULL,
  prompt TEXT NOT NULL,
  options JSON NOT NULL,
  correct_option INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_questions_lesson
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- История всех попыток, включая неудачные.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  score INT NOT NULL,
  correct_count INT NOT NULL,
  total_questions INT NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_quiz_attempt_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempt_lesson
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Оставшиеся таблицы создаются на случай частично заполненной исходной базы.
CREATE TABLE IF NOT EXISTS lesson_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id BIGINT UNSIGNED NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_lesson (user_id, lesson_id),
  CONSTRAINT fk_progress_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_lesson
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_access (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  access_source ENUM('free','purchase','admin') NOT NULL,
  purchase_id BIGINT UNSIGNED NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_course_access (user_id, course_id),
  CONSTRAINT fk_access_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_access_course
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_access_purchase
    FOREIGN KEY (purchase_id) REFERENCES course_purchases(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(80) NOT NULL,
  event_id VARCHAR(191) NOT NULL,
  payload JSON NOT NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_event (provider, event_id)
) ENGINE=InnoDB;
