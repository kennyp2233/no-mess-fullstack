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
  ParseIntPipe,
} from '@nestjs/common';
import { BudgetService } from '../services/budget.service';
import { CreateBudgetDto, UpdateBudgetDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';

@Controller('budgets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  @Roles('ADMIN', 'TREASURER', 'PRESIDENT')
  async create(@Body() createBudgetDto: CreateBudgetDto) {
    return this.budgetService.create(createBudgetDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('houseId') houseId?: string,
    @Query('year') year?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const yearNum = year ? parseInt(year, 10) : undefined;
    
    return this.budgetService.findAll(pageNum, limitNum, houseId, yearNum);
  }

  @Get('house/:houseId/year/:year')
  async findByHouseAndYear(
    @Param('houseId') houseId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.budgetService.findByHouseAndYear(houseId, year);
  }

  @Get('comparison/:houseId/:year')
  async getBudgetComparison(
    @Param('houseId') houseId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.budgetService.getBudgetComparison(houseId, year);
  }

  @Get('execution-report/:houseId/:year')
  async getBudgetExecutionReport(
    @Param('houseId') houseId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.budgetService.getBudgetExecutionReport(houseId, year);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.budgetService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'TREASURER', 'PRESIDENT')
  async update(
    @Param('id') id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetService.update(id, updateBudgetDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    return this.budgetService.remove(id);
  }
}
