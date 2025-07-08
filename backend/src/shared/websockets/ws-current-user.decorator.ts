import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

/**
 * WebSocket decorator to extract the current authenticated user from the socket
 * Usage: @WsCurrentUser() user: WebSocketUser
 */
export const WsCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const client: Socket = ctx.switchToWs().getClient();
    
    // The user should be attached to client.data.user by the WsAuthGuard
    return client.data?.user || null;
  },
);

/**
 * Alternative decorator that can extract specific user properties
 * Usage: @WsUserProperty('id') userId: string
 */
export const WsUserProperty = createParamDecorator(
  (property: string, ctx: ExecutionContext) => {
    const client: Socket = ctx.switchToWs().getClient();
    const user = client.data?.user;
    
    return user && property ? user[property] : user;
  },
);
