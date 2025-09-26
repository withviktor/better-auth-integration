import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from '@/shared/db/schema';

export class DatabaseService {
  private db;

  constructor() {
    const client = createClient({
      url: process.env.DATABASE_URL || 'file:./local.db',
      authToken: process.env.DATABASE_AUTH_TOKEN
    });
    
    this.db = drizzle(client, { schema });
  }

  getDb() {
    return this.db;
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      await this.db.select().from(schema.users).limit(1);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService();