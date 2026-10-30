import {
  bigint,
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 160 }),
  role: mysqlEnum("role", ["student", "admin"]).default("student").notNull(),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  referredByUserId: bigint("referred_by_user_id", { mode: "number", unsigned: true }).references((): any => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courses = mysqlTable("courses", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  level: varchar("level", { length: 80 }).default("С нуля").notNull(),
  price: int("price").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
  accessType: mysqlEnum("access_type", ["free", "paid"]).default("paid").notNull(),
  allowAsGift: boolean("allow_as_gift").default(true).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessons = mysqlTable("lessons", {
  id: serial("id").primaryKey(),
  courseId: bigint("course_id", { mode: "number", unsigned: true }).notNull().references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  videoUrl: text("video_url"),
  sortOrder: int("sort_order").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  passPercent: int("pass_percent").default(80).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = mysqlTable("questions", {
  id: serial("id").primaryKey(),
  lessonId: bigint("lesson_id", { mode: "number", unsigned: true }).notNull().references(() => lessons.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  options: json("options").$type<string[]>().notNull(),
  correctOption: int("correct_option").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});

export const quizAttempts = mysqlTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: bigint("lesson_id", { mode: "number", unsigned: true }).notNull().references(() => lessons.id, { onDelete: "cascade" }),
  score: int("score").notNull(),
  correctCount: int("correct_count").notNull(),
  totalQuestions: int("total_questions").notNull(),
  passed: boolean("passed").notNull(),
  answers: json("answers").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lessonProgress = mysqlTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: bigint("lesson_id", { mode: "number", unsigned: true }).notNull().references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("uq_user_lesson").on(table.userId, table.lessonId)]);

export const purchases = mysqlTable("course_purchases", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  courseId: bigint("course_id", { mode: "number", unsigned: true }).notNull().references(() => courses.id),
  status: mysqlEnum("status", ["pending", "paid", "cancelled", "refunded"]).default("pending").notNull(),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
  paymentProvider: varchar("payment_provider", { length: 80 }),
  paymentMethod: varchar("payment_method", { length: 40 }),
  externalPaymentId: varchar("external_payment_id", { length: 191 }),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("uq_external_payment").on(table.paymentProvider, table.externalPaymentId)]);

export const courseAccess = mysqlTable("course_access", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: bigint("course_id", { mode: "number", unsigned: true }).notNull().references(() => courses.id, { onDelete: "cascade" }),
  accessSource: mysqlEnum("access_source", ["free", "purchase", "gift", "admin"]).notNull(),
  purchaseId: bigint("purchase_id", { mode: "number", unsigned: true }).references(() => purchases.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("uq_user_course_access").on(table.userId, table.courseId)]);

export const paymentEvents = mysqlTable("payment_events", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 80 }).notNull(),
  eventId: varchar("event_id", { length: 191 }).notNull(),
  payload: json("payload").notNull(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("uq_payment_event").on(table.provider, table.eventId)]);

export const referrals = mysqlTable("referrals", {
  id: serial("id").primaryKey(),
  referrerUserId: bigint("referrer_user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  referredUserId: bigint("referred_user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  status: mysqlEnum("status", ["pending", "qualified", "reversed"]).default("pending").notNull(),
  qualifiedPurchaseId: bigint("qualified_purchase_id", { mode: "number", unsigned: true }).references(() => purchases.id, { onDelete: "set null" }),
  qualifiedAt: timestamp("qualified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [uniqueIndex("referred_user_id").on(table.referredUserId)]);

export const referralRewards = mysqlTable("referral_rewards", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull().references(() => users.id, { onDelete: "cascade" }),
  rewardNumber: int("reward_number").notNull(),
  status: mysqlEnum("status", ["available", "claimed", "cancelled"]).default("available").notNull(),
  courseId: bigint("course_id", { mode: "number", unsigned: true }).references(() => courses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  claimedAt: timestamp("claimed_at"),
}, (table) => [uniqueIndex("uq_referral_reward_number").on(table.userId, table.rewardNumber)]);

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Question = typeof questions.$inferSelect;
