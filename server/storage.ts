import { users, userStats, raceResults, feedback, type User, type InsertUser, type UpdateProfile, type UserStats, type RaceResult, type Feedback } from "@shared/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createUserStats(userId: number): Promise<void>;
  getUserStats(userId: number): Promise<UserStats | undefined>;
  updateUser(userId: number, data: UpdateProfile): Promise<User | undefined>;
  saveRaceResult(
    userId: number, 
    position: number, 
    totalTime: number,
    numberBoatsFinished?: number,
    boatName?: string, 
    raceId?: string
  ): Promise<RaceResult>;
  updateUserStats(userId: number, isWin: boolean): Promise<void>;
  
  // Password reset methods
  setResetToken(email: string, token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  resetPassword(userId: number, newPassword: string): Promise<boolean>;
  clearResetToken(userId: number): Promise<boolean>;
  
  // Feedback methods
  saveFeedback(feedback: Feedback): Promise<void>;
}

// Initialize PostgreSQL client
// Use production URL if NODE_ENV is production, otherwise use development URL
const connectionString = process.env.NODE_ENV === 'production' 
  ? process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

console.log(`Using database in ${process.env.NODE_ENV || 'development'} mode`);
const queryClient = postgres(connectionString);
const db = drizzle(queryClient);

export class DrizzleStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  
  async getUserByResetToken(token: string): Promise<User | undefined> {
    // Find user by reset token and check that it's not expired
    const result = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token));
      
    const user = result[0];
    
    // If no user found or token expired, return undefined
    if (!user || !user.resetTokenExpiry) return undefined;
    
    // Check if token is expired (older than 24 hours)
    const now = new Date();
    const expiry = new Date(user.resetTokenExpiry);
    if (expiry < now) return undefined;
    
    return user;
  }
  
  async setResetToken(email: string, token: string): Promise<User | undefined> {
    // Find user by email
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    
    // Set reset token with 24-hour expiry
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    await db.update(users)
      .set({
        resetToken: token,
        resetTokenExpiry: expiry
      })
      .where(eq(users.id, user.id));
      
    return this.getUser(user.id);
  }
  
  async resetPassword(userId: number, newPassword: string): Promise<boolean> {
    try {
      await db.update(users)
        .set({
          password: newPassword
        })
        .where(eq(users.id, userId));
        
      return true;
    } catch (error) {
      console.error('Failed to reset password:', error);
      return false;
    }
  }
  
  async clearResetToken(userId: number): Promise<boolean> {
    try {
      await db.update(users)
        .set({
          resetToken: null,
          resetTokenExpiry: null
        })
        .where(eq(users.id, userId));
        
      return true;
    } catch (error) {
      console.error('Failed to clear reset token:', error);
      return false;
    }
  }

  async createUserStats(userId: number): Promise<void> {
    await db.insert(userStats).values({
      userId,
      boatsCompleted: 0,
      avgFinish: 0
    });
  }

  async getUserStats(userId: number): Promise<UserStats | undefined> {
    const result = await db.select().from(userStats).where(eq(userStats.userId, userId));
    return result[0];
  }

  async updateUser(userId: number, data: UpdateProfile): Promise<User | undefined> {
    await db.update(users)
      .set(data)
      .where(eq(users.id, userId));
    
    return this.getUser(userId);
  }

  async saveRaceResult(
    userId: number, 
    position: number, 
    totalTime: number, 
    numberBoatsFinished: number = 1, 
    boatName?: string,
    raceId?: string
  ): Promise<RaceResult> {
    // Get the user to include username
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found when saving race result`);
    }
    
    // If boat name wasn't provided, determine which boat name to use based on position
    let finalBoatName = boatName || "";
    if (!finalBoatName) {
      if (position === 1) finalBoatName = user.boat1Name || "";
      else if (position === 2) finalBoatName = user.boat2Name || "";
      else if (position === 3) finalBoatName = user.boat3Name || "";
      else if (position === 4) finalBoatName = user.boat4Name || "";
    }
    
    // Generate a unique race ID using timestamp and random string if not provided
    const finalRaceId = raceId || `race-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    console.log(`Saving race result: userId=${userId}, position=${position}, boatName=${finalBoatName}, raceId=${finalRaceId}`);
    
    const [result] = await db.insert(raceResults)
      .values({
        userId,
        position,
        totalTime,
        username: user.username,
        boatName: finalBoatName,
        raceId: finalRaceId,
        racedAt: new Date()
      })
      .returning();
    
    return result;
  }

  async updateUserStats(userId: number, isWin: boolean): Promise<void> {
    // Get current stats
    const stats = await this.getUserStats(userId);
    if (!stats) {
      console.log(`No stats found for user ${userId}, creating new stats record`);
      await this.createUserStats(userId);
      // Get the newly created stats
      const newStats = await this.getUserStats(userId);
      if (!newStats) {
        console.error(`Failed to create stats for user ${userId}`);
        return;
      }
    }
    
    // Get all race results for this user to calculate avg position
    const userRaceResults = await db.select()
      .from(raceResults)
      .where(eq(raceResults.userId, userId));
    
    console.log(`Found ${userRaceResults.length} race results for user ${userId}`);
    
    // Get current stats again in case we just created them
    const currentStats = await this.getUserStats(userId);
    if (!currentStats) {
      console.error(`Still no stats found for user ${userId} after creation attempt`);
      return;
    }
    
    // Update boats completed counter
    const boatsCompleted = (currentStats.boatsCompleted || 0) + 1;
    
    // Calculate new average finish position
    const totalPositions = userRaceResults.reduce((sum, result) => sum + result.position, 0);
    const avgFinish = userRaceResults.length > 0 ? Math.round(totalPositions / userRaceResults.length) : 0;
    
    console.log(`Updating stats for user ${userId}: boats completed=${boatsCompleted}, avgFinish=${avgFinish}`);
    
    // Update stats
    await db.update(userStats)
      .set({
        boatsCompleted,
        avgFinish
      })
      .where(eq(userStats.userId, userId));
      
    console.log(`Stats updated successfully for user ${userId}`);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users)
      .values({ 
        ...insertUser, 
        bio: "", 
        profilePicture: "", 
        personalUrl: "",
        boat1Name: "",
        boat2Name: "",
        boat3Name: "",
        boat4Name: "",
        resetToken: null,
        resetTokenExpiry: null
      })
      .returning();
    
    return user;
  }

  async saveFeedback(feedbackData: Feedback): Promise<void> {
    await db.insert(feedback).values(feedbackData);
  }
}

// For backward compatibility, keep the MemStorage class
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private userStats: Map<number, UserStats>;
  private raceResults: RaceResult[];
  currentId: number;
  private statsId: number;
  private resultId: number;

  constructor() {
    this.users = new Map();
    this.userStats = new Map();
    this.raceResults = [];
    this.currentId = 1;
    this.statsId = 1;
    this.resultId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(
      (user) => user.resetToken === token,
    );
    
    if (!user || !user.resetTokenExpiry) return undefined;
    
    // Check if token is expired (older than 24 hours)
    const now = new Date();
    const expiry = new Date(user.resetTokenExpiry);
    if (expiry < now) return undefined;
    
    return user;
  }
  
  async setResetToken(email: string, token: string): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    
    // Set reset token with 24-hour expiry
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    
    const updatedUser = {
      ...user,
      resetToken: token,
      resetTokenExpiry: expiry
    };
    
    this.users.set(user.id, updatedUser);
    return updatedUser;
  }
  
  async resetPassword(userId: number, newPassword: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      const updatedUser = {
        ...user,
        password: newPassword
      };
      
      this.users.set(userId, updatedUser);
      return true;
    } catch (error) {
      console.error('Failed to reset password:', error);
      return false;
    }
  }
  
  async clearResetToken(userId: number): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      const updatedUser = {
        ...user,
        resetToken: null,
        resetTokenExpiry: null
      };
      
      this.users.set(userId, updatedUser);
      return true;
    } catch (error) {
      console.error('Failed to clear reset token:', error);
      return false;
    }
  }

  async createUserStats(userId: number): Promise<void> {
    const id = this.statsId++;
    const stats: UserStats = {
      id,
      userId,
      boatsCompleted: 0,
      avgFinish: 0
    };
    this.userStats.set(userId, stats);
  }

  async getUserStats(userId: number): Promise<UserStats | undefined> {
    return this.userStats.get(userId);
  }

  async updateUser(userId: number, data: UpdateProfile): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...data
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async saveRaceResult(
    userId: number, 
    position: number, 
    totalTime: number, 
    numberBoatsFinished: number = 1,
    boatName?: string,
    raceId?: string
  ): Promise<RaceResult> {
    const id = this.resultId++;
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found when saving race result`);
    }
    
    // If boat name wasn't provided, determine which boat name to use based on position
    let finalBoatName = boatName || "";
    if (!finalBoatName) {
      if (position === 1) finalBoatName = user.boat1Name || "";
      else if (position === 2) finalBoatName = user.boat2Name || "";
      else if (position === 3) finalBoatName = user.boat3Name || "";
      else if (position === 4) finalBoatName = user.boat4Name || "";
    }
    
    // Generate a unique race ID using timestamp and random string if not provided
    const finalRaceId = raceId || `race-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const result: RaceResult = {
      id,
      userId,
      position,
      totalTime,
      username: user.username,
      boatName: finalBoatName,
      raceId: finalRaceId,
      racedAt: new Date()
    };
    
    this.raceResults.push(result);
    return result;
  }

  async updateUserStats(userId: number, isWin: boolean): Promise<void> {
    const stats = this.userStats.get(userId);
    if (!stats) return;
    
    // Update boats completed counter
    const boatsCompleted = (stats.boatsCompleted || 0) + 1;
    
    // Calculate new average finish position
    const userResults = this.raceResults.filter(result => result.userId === userId);
    const totalPositions = userResults.reduce((sum, result) => sum + result.position, 0);
    const avgFinish = userResults.length > 0 ? Math.round(totalPositions / userResults.length) : 0;
    
    const updatedStats: UserStats = {
      ...stats,
      boatsCompleted,
      avgFinish
    };
    
    this.userStats.set(userId, updatedStats);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user = { 
      ...insertUser, 
      id, 
      bio: "", 
      profilePicture: "", 
      personalUrl: "",
      boat1Name: "",
      boat2Name: "",
      boat3Name: "",
      boat4Name: "", 
      resetToken: null,
      resetTokenExpiry: null,
      created_at: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async saveFeedback(feedbackData: Feedback): Promise<void> {
    // In memory storage, we just log the feedback for development
    console.log('Feedback received:', feedbackData);
  }
}

// Use DrizzleStorage instead of MemStorage
export const storage = new DrizzleStorage();
