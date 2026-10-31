// lib/db/schema.ts
import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  // Compte (tenant) proprietaire. Renseigne au premier login
  // (ensureAccountProvisioned) ; toute requete metier est filtree dessus.
  accountId: uuid("accountId")
    .notNull()
    .references(() => account.id, { onDelete: "restrict" }),
  password: varchar("password", { length: 64 }),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  bio: text("bio"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  onboarded: boolean("onboarded").notNull().default(false),
  title: text("title"),
  intent: varchar("intent", { length: 24 }),
  company: text("company"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ name: "Vote_v2_pkey", columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet", "site"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    chatId: uuid("chatId").references(() => chat.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

export const userSettings = pgTable("UserSettings", {
  userId: uuid("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  preferences: json("preferences").notNull().default({}),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserSettings = InferSelectModel<typeof userSettings>;

// ============ MODULE FILES ============

export const file = pgTable("File", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: text("size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type DBFile = InferSelectModel<typeof file>;

// ============ MODULE SIMULATIONS ============

export const simulation = pgTable("Simulation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull(),
  parameters: json("parameters").notNull().default({}),
  code: text("code"),
  isFavorite: boolean("isFavorite").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Simulation = InferSelectModel<typeof simulation>;

export const userCategory = pgTable("UserCategory", {
  userId: uuid("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserCategory = InferSelectModel<typeof userCategory>;

// ============ MODULE CONNECTORS ============

export const connector = pgTable("connectors", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Connector = InferSelectModel<typeof connector>;
// ============ MODULE NOTIFICATIONS ============

export const notification = pgTable("notifications", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider"),
  title: text("title").notNull(),
  body: text("body"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = InferSelectModel<typeof notification>;
// ============ MODULE OTP (one-time password par email) ============

export const otpCode = pgTable(
  "OtpCode",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // Email normalise (minuscules, sans espaces) vise par le code.
    email: varchar("email", { length: 254 }).notNull(),
    // Jamais le code en clair : SHA-256 hex du code a 7 chiffres.
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    // Usage unique : renseigne a la validation (ou a l'invalidation).
    usedAt: timestamp("usedAt"),
    // Tentatives de validation (verrouillage au-dela du maximum).
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("OtpCode_email_created_idx").on(table.email, table.createdAt),
  ]
);

export type OtpCode = InferSelectModel<typeof otpCode>;
// ============ MODULE MULTI-TENANT (comptes + isolation stricte) ============

// Un compte = un tenant. Chaque utilisateur appartient a exactement un
// compte ; toutes les donnees metier (employes recrutes, missions)
// portent le accountId et sont toujours filtrees dessus. Le catalogue
// des talents et les departements sont un referentiel global partage.
export const account = pgTable("Account", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Account = InferSelectModel<typeof account>;

// ============ MODULE EMPLOYEES (departements + employes IA) ============

export const department = pgTable("Department", {
  // Slug stable, cle des libelles i18n
  // (engineering|research-data|operations).
  id: text("id").primaryKey(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Department = InferSelectModel<typeof department>;

// Catalogue recrutable : miroir en base des 6 specs du noyau
// (core/employee/profiles/*.json, lecture seule). Synchronise par
// syncTalentCatalog() a chaque migration ; jamais edite a la main.
export const talentProfile = pgTable("TalentProfile", {
  // Nom de spec noyau (ex: "atlas-software-engineer"), stable.
  spec: text("spec").primaryKey(),
  version: varchar("version", { length: 24 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 120 }).notNull(),
  departmentId: text("departmentId")
    .notNull()
    .references(() => department.id, { onDelete: "restrict" }),
  background: text("background").notNull(),
  allowedTools: json("allowedTools").notNull().default([]),
  technologies: json("technologies").notNull().default([]),
  createdBy: varchar("createdBy", { length: 120 })
    .notNull()
    .default("Cofoundator"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TalentProfile = InferSelectModel<typeof talentProfile>;

export const employee = pgTable(
  "Employee",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // Tenant proprietaire (isolation stricte).
    accountId: uuid("accountId")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    // Nature : "chef" (manager auto-provisionne) | "hired" (recrute).
    kind: varchar("kind", { length: 16 }).notNull().default("hired"),
    // Spec noyau d'origine (NULL pour le Chef, hors catalogue).
    talentSpec: text("talentSpec"),
    specVersion: varchar("specVersion", { length: 24 }),
    // Identite cryptographique noyau (remplie a la publication).
    kernelEmployeeId: uuid("kernelEmployeeId"),
    name: varchar("name", { length: 120 }).notNull(),
    role: varchar("role", { length: 120 }).notNull(),
    // Statut metier : idle | working | completed (valide cote API).
    status: varchar("status", { length: 20 }).notNull().default("idle"),
    departmentId: text("departmentId")
      .notNull()
      .references(() => department.id, { onDelete: "restrict" }),
    background: text("background"),
    createdBy: varchar("createdBy", { length: 120 }),
    technologies: json("technologies").notNull().default([]),
    hiredAt: timestamp("hiredAt").notNull().defaultNow(),
    currentTask: text("currentTask"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("Employee_department_idx").on(table.departmentId),
    index("Employee_account_idx").on(table.accountId),
    // Un talent = une instance par compte (NULL = Chef, non concerné).
    unique("Employee_account_talent_uniq").on(
      table.accountId,
      table.talentSpec
    ),
  ]
);

export type Employee = InferSelectModel<typeof employee>;

// ============ MODULE MISSIONS (suivi cote web) ============

// Fiche de suivi d'une mission confiee a un employe du compte.
// L'execution elle-meme passe par le noyau (core/employee) ; ici on
// garde la trace (statut, rapport, job noyau) pour l'interface.
export const mission = pgTable(
  "Mission",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    accountId: uuid("accountId")
      .notNull()
      .references(() => account.id, { onDelete: "cascade" }),
    employeeId: uuid("employeeId")
      .notNull()
      .references(() => employee.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    // Statut : queued | running | succeeded | failed | needs_review.
    status: varchar("status", { length: 24 }).notNull().default("queued"),
    report: text("report"),
    kernelJobId: text("kernelJobId"),
    expectFile: text("expectFile"),
    expectTest: boolean("expectTest").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("Mission_account_idx").on(table.accountId)]
);

export type Mission = InferSelectModel<typeof mission>;
