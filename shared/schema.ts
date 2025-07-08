import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  bio: text("bio").default(""),
  profilePicture: text("profile_picture").default(""),
  personalUrl: text("personal_url").default(""),
  boat1Name: text("boat1_name").default(""),
  boat2Name: text("boat2_name").default(""),
  boat3Name: text("boat3_name").default(""),
  boat4Name: text("boat4_name").default(""),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  created_at: timestamp("created_at").defaultNow(),
});

export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  boatsCompleted: integer("boats_completed").default(0), // Renamed from racesCompleted
  avgFinish: integer("avg_finish").default(0),
});

export const raceResults = pgTable("race_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  position: integer("position").notNull(),
  totalTime: integer("total_time").notNull(), // In milliseconds
  username: text("username").notNull(), // Added username column
  boatName: text("boat_name").default(""), // Added boat_name column
  raceId: text("race_id").default(""), // Added race_id column
  racedAt: timestamp("raced_at").defaultNow(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export const loginSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const updateProfileSchema = createInsertSchema(users).pick({
  bio: true,
  profilePicture: true,
  personalUrl: true,
  boat1Name: true,
  boat2Name: true,
  boat3Name: true,
  boat4Name: true,
}).partial();

export const feedbackSchema = createInsertSchema(feedback).pick({
  username: true,
  email: true,
  message: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type User = typeof users.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type RaceResult = typeof raceResults.$inferSelect;
