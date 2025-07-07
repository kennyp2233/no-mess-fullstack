import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Add custom authentication logic here if needed
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    // If there's an error or no user, throw an unauthorized exception
    if (err || !user) {
      throw err || new UnauthorizedException('Access denied. Invalid or expired token.');
    }
    return user;
  }
}
