import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`Client ${client.id} attempted to connect without token`);
        throw new WsException('Authentication token required');
      }

      const user = await this.validateToken(token);
      
      if (!user) {
        this.logger.warn(`Client ${client.id} provided invalid token`);
        throw new WsException('Invalid authentication token');
      }

      // Attach user to client for later use
      client.data.user = user;
      this.logger.log(`Client ${client.id} authenticated as ${user.email}`);

      return true;
    } catch (error) {
      this.logger.error(`Authentication failed for client:`, error.message);
      throw new WsException('Authentication failed');
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Check multiple possible locations for the token
    const authHeader = client.handshake.headers.authorization;
    const authToken = client.handshake.auth?.token;
    const queryToken = client.handshake.query?.token as string;

    // Priority: auth object > authorization header > query parameter
    if (authToken) {
      return typeof authToken === 'string' ? authToken : null;
    }

    if (authHeader) {
      const match = authHeader.match(/^Bearer\s+(.*)$/);
      return match ? match[1] : null;
    }

    if (queryToken) {
      return queryToken;
    }

    return null;
  }

  private async validateToken(token: string): Promise<any> {
    try {
      // Verify JWT token
      const payload = this.jwtService.verify(token);
      
      if (!payload.sub) {
        throw new Error('Invalid token payload');
      }

      // Fetch user from database to ensure they still exist and are active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tokenPayload: payload,
      };
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null;
    }
  }
}
