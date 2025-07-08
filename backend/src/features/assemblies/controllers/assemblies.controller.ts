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
import { AssembliesService } from '../services/assemblies.service';
import {
  CreateAssemblyDto,
  UpdateAssemblyDto,
  UpdateAssemblyStatusDto,
  AssemblyResponseDto,
  AssemblyQueryDto,
  AssemblyStatsDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { AssemblyStatus } from '@prisma/client';

@Controller('assemblies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssembliesController {
  constructor(private readonly assembliesService: AssembliesService) {}

  @Post()
  @Roles('ADMIN', 'PRESIDENT', 'SECRETARY')
  create(@Body() createAssemblyDto: CreateAssemblyDto): Promise<AssemblyResponseDto> {
    return this.assembliesService.create(createAssemblyDto);
  }

  @Get()
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  findAll(@Query() query: AssemblyQueryDto) {
    return this.assembliesService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  getStats(@Query('houseId') houseId?: string): Promise<AssemblyStatsDto> {
    return this.assembliesService.getAssemblyStats(houseId);
  }

  @Get('upcoming')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  getUpcoming(@Query('houseId') houseId?: string) {
    return this.assembliesService.getUpcomingAssemblies(houseId);
  }

  @Get('house/:houseId')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  getAssembliesByHouse(
    @Param('houseId') houseId: string,
    @Query('status') status?: AssemblyStatus,
  ) {
    return this.assembliesService.getAssembliesByHouse(houseId, status);
  }

  @Get(':id')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  findOne(@Param('id') id: string): Promise<AssemblyResponseDto> {
    return this.assembliesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRESIDENT', 'SECRETARY')
  update(
    @Param('id') id: string,
    @Body() updateAssemblyDto: UpdateAssemblyDto,
  ): Promise<AssemblyResponseDto> {
    return this.assembliesService.update(id, updateAssemblyDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'PRESIDENT', 'SECRETARY')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateAssemblyStatusDto,
  ): Promise<AssemblyResponseDto> {
    return this.assembliesService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PRESIDENT')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.assembliesService.remove(id);
  }

  @Get(':id/votings')
  getAssemblyVotings(@Param('id') id: string) {
    return this.assembliesService.getAssemblyVotings(id);
  }

  @Get(':id/proposals')
  getAssemblyProposals(@Param('id') id: string) {
    return this.assembliesService.getAssemblyProposals(id);
  }
}
