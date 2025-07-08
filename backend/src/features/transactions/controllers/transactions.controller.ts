import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ValidationPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto, UpdateTransactionDto, QueryTransactionsDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators';
import { CurrentUser } from '../../../shared/decorators';
import { Role } from '@prisma/client';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.PRESIDENT, Role.TREASURER)
  create(
    @Body(ValidationPipe) createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.create(createTransactionDto, user.id);
  }

  @Get()
  findAll(
    @Query(ValidationPipe) queryDto: QueryTransactionsDto,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.findAll(queryDto, user.id);
  }

  @Get('statistics/:houseId')
  @Roles(Role.ADMIN, Role.PRESIDENT, Role.TREASURER)
  getStatistics(
    @Param('houseId', ParseUUIDPipe) houseId: string,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.getTransactionStatistics(houseId, user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.findOne(id, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.PRESIDENT, Role.TREASURER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.update(id, updateTransactionDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.PRESIDENT, Role.TREASURER)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any
  ) {
    return this.transactionsService.remove(id, user.id);
  }
}
