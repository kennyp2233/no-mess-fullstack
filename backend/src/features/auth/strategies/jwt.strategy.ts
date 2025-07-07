import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../shared/database';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prismaService: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'supersecret', // Use env variable in production
    });
  }

  async validate(payload: any) {
    // Find the user with houses relation to get roles
    const user = await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        houses: {
          select: {
            houseId: true,
            role: true,
            house: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
