import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WsJwtStrategy extends PassportStrategy(Strategy, 'ws-jwt') {
  private readonly logger = new Logger(WsJwtStrategy.name);

  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: any) => {
          // Extract JWT from WebSocket handshake
          if (request?.handshake?.auth?.token) {
            return request.handshake.auth.token;
          }
          
          if (request?.handshake?.headers?.authorization) {
            const authHeader = request.handshake.headers.authorization;
            const match = authHeader.match(/^Bearer\s+(.*)$/);
            return match ? match[1] : null;
          }

          if (request?.handshake?.query?.token) {
            return request.handshake.query.token;
          }

          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    try {
      if (!payload.sub) {
        throw new WsException('Invalid token payload');
      }

      // Verify user exists and is active
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
        this.logger.warn(`User not found for token payload: ${payload.sub}`);
        throw new WsException('User not found');
      }

      this.logger.log(`WebSocket JWT validated for user: ${user.email}`);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tokenPayload: payload,
      };
    } catch (error) {
      this.logger.error(`WebSocket JWT validation failed: ${error.message}`);
      throw new WsException('Authentication failed');
    }
  }
}
