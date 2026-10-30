-- НЕЙРОСТАРТ: реферальная программа «10 друзей — курс в подарок».
-- Запускать один раз после 001_update_from_original.sql.
-- Перед запуском сделайте резервную копию базы.

USE neurostart;

-- Поля добавляются только при отсутствии: скрипт подходит и для исходной,
-- и для более новой базы, созданной через db:push до реферальной версии.
SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'referral_code') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN referral_code VARCHAR(32) NULL AFTER role'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'referral_code') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD UNIQUE KEY referral_code (referral_code)'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'referred_by_user_id') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN referred_by_user_id BIGINT UNSIGNED NULL AFTER referral_code'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_schema = DATABASE() AND table_name = 'users' AND constraint_name = 'fk_users_referrer') > 0,
  'SELECT 1',
  'ALTER TABLE users ADD CONSTRAINT fk_users_referrer FOREIGN KEY (referred_by_user_id) REFERENCES users(id) ON DELETE SET NULL'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'courses' AND column_name = 'allow_as_gift') > 0,
  'SELECT 1',
  'ALTER TABLE courses ADD COLUMN allow_as_gift BOOLEAN NOT NULL DEFAULT TRUE AFTER access_type'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

ALTER TABLE course_access
  MODIFY access_source ENUM('free','purchase','gift','admin') NOT NULL;

-- Все существующие пользователи получают уникальные постоянные коды.
UPDATE users
SET referral_code = CONCAT('NS', LPAD(HEX(id), 10, '0'))
WHERE referral_code IS NULL OR referral_code = '';

ALTER TABLE users
  MODIFY referral_code VARCHAR(32) NOT NULL;

ALTER TABLE courses
  MODIFY allow_as_gift BOOLEAN NOT NULL DEFAULT TRUE;

-- Таблица связей уже была в исходной схеме; создаём только при её отсутствии.
CREATE TABLE IF NOT EXISTS referrals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  referrer_user_id BIGINT UNSIGNED NOT NULL,
  referred_user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  status ENUM('pending','qualified','reversed') NOT NULL DEFAULT 'pending',
  qualified_purchase_id BIGINT UNSIGNED NULL,
  qualified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_referral_referrer FOREIGN KEY (referrer_user_id) REFERENCES users(id),
  CONSTRAINT fk_referral_referred FOREIGN KEY (referred_user_id) REFERENCES users(id),
  CONSTRAINT fk_referral_purchase FOREIGN KEY (qualified_purchase_id) REFERENCES course_purchases(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Одна запись соответствует одной награде за каждые 10 оплативших referrals.
CREATE TABLE IF NOT EXISTS referral_rewards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  reward_number INT NOT NULL,
  status ENUM('available','claimed','cancelled') NOT NULL DEFAULT 'available',
  course_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP NULL,
  UNIQUE KEY uq_referral_reward_number (user_id, reward_number),
  CONSTRAINT fk_reward_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reward_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Если приглашённый уже оплатил курс до появления этой версии,
-- его первая оплаченная покупка засчитывается задним числом.
UPDATE referrals AS r
JOIN (
  SELECT user_id, MIN(id) AS first_paid_id
  FROM course_purchases
  WHERE status = 'paid'
  GROUP BY user_id
) AS first_paid ON first_paid.user_id = r.referred_user_id
JOIN course_purchases AS p ON p.id = first_paid.first_paid_id
SET
  r.status = 'qualified',
  r.qualified_purchase_id = p.id,
  r.qualified_at = COALESCE(p.paid_at, p.created_at, CURRENT_TIMESTAMP)
WHERE r.status = 'pending';

-- Награды за уже накопленные группы по 10 человек создаются автоматически
-- при первом открытии реферального раздела в личном кабинете.
