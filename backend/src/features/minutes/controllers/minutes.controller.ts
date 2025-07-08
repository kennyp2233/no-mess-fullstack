import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MinutesService } from '../services/minutes.service';
import { CreateMinutesDto, ValidateMinutesDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('minutes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinutesController {
  constructor(private readonly minutesService: MinutesService) {}

  @Post()
  @Roles('SECRETARY', 'ADMIN')
  async create(
    @Body() createMinutesDto: CreateMinutesDto,
    @CurrentUser() user: any,
  ) {
    return this.minutesService.create(createMinutesDto, user.id);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('houseId') houseId?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.minutesService.findAll(pageNum, limitNum, houseId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.minutesService.findOne(id);
  }

  @Get('assembly/:assemblyId')
  async findByAssembly(@Param('assemblyId') assemblyId: string) {
    return this.minutesService.findByAssembly(assemblyId);
  }

  @Patch(':id/validate')
  @Roles('ADMIN', 'PRESIDENT')
  async validate(
    @Param('id') id: string,
    @Body() validateMinutesDto: ValidateMinutesDto,
  ) {
    return this.minutesService.validate(id, validateMinutesDto);
  }

  @Patch(':id/publish')
  @Roles('ADMIN', 'PRESIDENT')
  async publish(@Param('id') id: string) {
    return this.minutesService.publish(id);
  }
}
