import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccountsService } from '../services/accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
  AccountBalanceDto,
  AccountTransactionHistoryDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@Controller('accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles('ADMIN', 'TREASURER')
  create(@Body() createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.accountsService.create(createAccountDto);
  }

  @Get()
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  findAll(@Query('houseId') houseId?: string): Promise<AccountResponseDto[]> {
    return this.accountsService.findAll(houseId);
  }

  @Get('house/:houseId')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  getAccountsByHouse(@Param('houseId') houseId: string): Promise<AccountResponseDto[]> {
    return this.accountsService.getAccountsByHouse(houseId);
  }

  @Get(':id')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  findOne(@Param('id') id: string): Promise<AccountResponseDto> {
    return this.accountsService.findOne(id);
  }

  @Get(':id/balance')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  getBalance(@Param('id') id: string): Promise<AccountBalanceDto> {
    return this.accountsService.getAccountBalance(id);
  }

  @Get(':id/history')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  getTransactionHistory(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ): Promise<AccountTransactionHistoryDto> {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    };

    return this.accountsService.getTransactionHistory(id, options);
  }

  @Post(':id/recalculate')
  @Roles('ADMIN', 'TREASURER')
  @HttpCode(HttpStatus.OK)
  recalculateBalance(@Param('id') id: string): Promise<AccountBalanceDto> {
    return this.accountsService.recalculateBalance(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'TREASURER')
  update(
    @Param('id') id: string,
    @Body() updateAccountDto: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountsService.update(id, updateAccountDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.accountsService.remove(id);
  }
}
