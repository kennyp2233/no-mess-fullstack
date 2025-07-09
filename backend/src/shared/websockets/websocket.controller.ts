import { Controller, Get, UseGuards } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { JwtAuthGuard } from '../../features/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../features/auth/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('websocket')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebSocketController {
    constructor(private readonly webSocketService: WebSocketService) {}

    @Get('stats')
    @Roles('ADMIN')
    getConnectionStats() {
        return this.webSocketService.getConnectionStats();
    }

    @Get('health')
    @Roles('ADMIN')
    getHealthStatus() {
        const stats = this.webSocketService.getConnectionStats();
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stats,
        };
    }
} 