import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as bcrypt from "bcryptjs";
import session from "express-session";
import MemoryStore from "memorystore";
import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { sendPasswordResetEmail } from "./services/email";
import { log } from "./vite";
import {
  insertUserSchema,
  loginSchema,
  updateProfileSchema,
  feedbackSchema,
} from "@shared/schema";

// Extend the Express.Session interface to include our custom properties
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// Create a session store
const SessionStore = MemoryStore(session);

// Authentication middleware
const authenticate = (req: Request, res: Response, next: Function) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "goat-sailing-race-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
      store: new SessionStore({
        checkPeriod: 86400000, // 24 hours
      }),
    })
  );

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = bcrypt.hashSync(validatedData.password, 10);
      
      // Create user
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });
      
      // Create initial user stats
      await storage.createUserStats(newUser.id);
      
      // Set session
      req.session.userId = newUser.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByUsername(validatedData.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Verify password
      const isPasswordValid = bcrypt.compareSync(validatedData.password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user endpoint
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user information" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Handle forgot password
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security, don't reveal if email exists or not
        return res.json({ message: "If an account with that email exists, we've sent a password reset link." });
      }
      
      // Generate a reset token and save it to the user
      const resetToken = createId();
      const updatedUser = await storage.setResetToken(email, resetToken);
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to generate reset token" });
      }
      
      // Send password reset email
      const emailResult = await sendPasswordResetEmail(email, resetToken, user.username);
      
      if (!emailResult.success) {
        log(`Failed to send password reset email to ${email}: ${emailResult.error}`, 'express');
        return res.status(500).json({ message: "Failed to send reset email" });
      }
      
      log(`Password reset email sent to ${email}`, 'express');
      
      // For development: If we have a preview URL, log it
      if (emailResult.previewUrl) {
        log(`Email preview URL: ${emailResult.previewUrl}`, 'express');
      }
      
      res.json({ 
        message: "If an account with that email exists, we've sent a password reset link.",
        ...(emailResult.previewUrl && { previewUrl: emailResult.previewUrl })
      });
    } catch (error) {
      log(`Error in forgot password: ${error}`, 'express');
      res.status(500).json({ message: "Failed to process reset request" });
    }
  });
  
  // Handle password reset
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      
      // Find user by reset token
      const user = await storage.getUserByResetToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update user's password and clear reset token
      const success = await storage.resetPassword(user.id, hashedPassword);
      if (!success) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      // Clear the reset token
      await storage.clearResetToken(user.id);
      
      log(`Password reset successful for user: ${user.username}`, 'express');
      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      log(`Error in password reset: ${error}`, 'express');
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Get user stats
  app.get("/api/users/:id/stats", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user stats
      const stats = await storage.getUserStats(userId);
      if (!stats) {
        return res.status(404).json({ message: "Stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user stats" });
    }
  });

  // Update user profile
  app.patch("/api/users/:id/profile", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Only allow users to update their own profile
      if (req.session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Validate update data
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Update user
      const updatedUser = await storage.updateUser(userId, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Submit race results
  app.post("/api/race/results", authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { position, totalTime, boatName, raceId, boatNumber } = req.body;
      
      // Validate data
      if (typeof position !== 'number' || typeof totalTime !== 'number') {
        return res.status(400).json({ message: "Invalid race result data" });
      }
      
      // Log detailed request information
      console.log(`Authentication details:`, {
        sessionUserId: req.session.userId,
        authenticated: !!req.session.userId,
        sessionData: req.session
      });
      
      console.log(`Saving race result for user ${userId}: position=${position}, time=${totalTime}ms, boat name=${boatName || "Unknown"}, raceId=${raceId || "Unknown"}, boatNumber=${boatNumber || "Unknown"}`);
      
      // Now position represents the actual finish position (1st, 2nd, etc.) based on finish time
      // Save race result with boat name and race ID
      const result = await storage.saveRaceResult(userId, position, totalTime, 1, boatName, raceId);
      
      // Always update user stats to increment boats_completed, but only count position 1 as a win
      // Position 1 means first place (fastest time)
      await storage.updateUserStats(userId, position === 1);
      
      console.log(`Successfully saved race result: ${JSON.stringify(result)}`);
      
      res.status(201).json(result);
    } catch (error) {
      console.error("Error saving race results:", error);
      res.status(500).json({ message: "Failed to save race results" });
    }
  });

  // Submit feedback
  app.post("/api/feedback", authenticate, async (req: Request, res: Response) => {
    try {
      const validatedData = feedbackSchema.parse(req.body);
      
      await storage.saveFeedback(validatedData);
      
      res.status(201).json({ message: "Feedback submitted successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid feedback data", errors: error.errors });
      }
      console.error("Error saving feedback:", error);
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
