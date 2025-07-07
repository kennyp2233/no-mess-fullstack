import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user, params } = context.switchToHttp().getRequest();
    
    // If no user is found, deny access
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // For house-specific operations, check if user belongs to the house
    if (params.houseId) {
      const houseId = params.houseId;
      
      // Find the user's role in this specific house
      const houseUser = user.houses.find(h => h.houseId === houseId);
      
      // If user doesn't belong to this house, deny access
      if (!houseUser) {
        throw new ForbiddenException('You do not have access to this house');
      }
      
      // Check if user's role for this house is sufficient
      return requiredRoles.includes(houseUser.role);
    } 
    
    // For non-house specific operations, check if user has any of the required roles in any house
    return user.houses.some(houseUser => requiredRoles.includes(houseUser.role));
  }
}
