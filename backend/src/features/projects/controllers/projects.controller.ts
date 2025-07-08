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
import { ProjectsService } from '../services/projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ProjectQueryDto,
  ProjectStatsDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { ProjectStatus } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER')
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: any) {
    return this.projectsService.create(createProjectDto, user.id);
  }

  @Get()
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  findAll(@Query() query: ProjectQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY')
  getStats(@Query('houseId') houseId?: string): Promise<ProjectStatsDto> {
    return this.projectsService.getProjectStats(houseId);
  }

  @Get('house/:houseId')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  getProjectsByHouse(
    @Param('houseId') houseId: string,
    @Query('status') status?: ProjectStatus,
  ) {
    return this.projectsService.getProjectsByHouse(houseId, status);
  }

  @Get(':id')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER', 'SECRETARY', 'RESIDENT')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRESIDENT', 'TREASURER')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'PRESIDENT')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PRESIDENT')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/proposals')
  getProjectProposals(@Param('id') id: string) {
    return this.projectsService.getProjectProposals(id);
  }
}
