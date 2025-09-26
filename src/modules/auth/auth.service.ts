import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'accounts' | 'sessions'>;
  session: {
    token: string;
    expiresAt: Date;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { name, email, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with account
    const user = await this.prisma.user.create({
      data: {
        id: uuidv4(),
        name,
        email,
        emailVerified: false, // In production, implement email verification
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: {
          create: {
            id: uuidv4(),
            accountId: uuidv4(),
            providerId: 'credential',
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
    });

    // Create session
    const session = await this.createSession(user.id);

    this.logger.log(`User registered: ${user.email}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        credits: user.credits,
        maxServers: user.maxServers,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    // Find user with account
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          where: { providerId: 'credential' },
        },
      },
    });

    if (!user || !user.accounts.length) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is banned
    if (user.banned && (!user.banExpires || user.banExpires > new Date())) {
      throw new UnauthorizedException(`Account banned: ${user.banReason || 'No reason provided'}`);
    }

    // Verify password
    const account = user.accounts[0];
    if (!account.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create session
    const session = await this.createSession(user.id);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        credits: user.credits,
        maxServers: user.maxServers,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * Logout user
   */
  async logout(sessionToken: string): Promise<void> {
    await this.prisma.session.delete({
      where: { token: sessionToken },
    });

    this.logger.log('User logged out');
  }

  /**
   * Validate session token
   */
  async validateSession(token: string): Promise<User | null> {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updateData: { name?: string; image?: string }): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`User profile updated: ${user.email}`);
    return user;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Find user with account
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          where: { providerId: 'credential' },
        },
      },
    });

    if (!user || !user.accounts.length) {
      throw new UnauthorizedException('User not found');
    }

    const account = user.accounts[0];
    if (!account.password) {
      throw new UnauthorizedException('Cannot change password for this account');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, account.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.prisma.account.update({
      where: { id: account.id },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Password changed for user: ${user.email}`);
  }

  /**
   * Create a new session
   */
  private async createSession(userId: string) {
    const token = this.generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    const session = await this.prisma.session.create({
      data: {
        id: uuidv4(),
        token,
        userId,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Generate a secure session token
   */
  private generateSessionToken(): string {
    return uuidv4() + '.' + Date.now().toString(36) + '.' + Math.random().toString(36);
  }
}