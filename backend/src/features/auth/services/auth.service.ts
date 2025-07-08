import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../shared/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prismaService.user.findUnique({
      where: { email },
      include: {
        houses: {
          include: {
            house: true
          }
        }
      }
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    
    if (!user) {
      return null;
    }

    const payload = { 
      sub: user.id, 
      email: user.email,
      name: user.name,
      phone: user.phone
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        houses: user.houses
      },
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async register(registerData: {
    email: string;
    name: string;
    password: string;
    phone?: string;
  }) {
    // Check if user already exists
    const existingUser = await this.prismaService.user.findUnique({
      where: { email: registerData.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(registerData.password);

    // Create the user
    const user = await this.prismaService.user.create({
      data: {
        email: registerData.email,
        name: registerData.name,
        password: hashedPassword,
        phone: registerData.phone,
      },
      include: {
        houses: {
          include: {
            house: true
          }
        }
      }
    });

    // Generate JWT token
    const payload = { 
      sub: user.id, 
      email: user.email,
      name: user.name,
      phone: user.phone
    };

    const { password: _, ...userWithoutPassword } = user;

    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }
}
