import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ProposalsService } from '../services/proposals.service';
import { CreateProposalDto, UpdateProposalDto, UpdateProposalStatusDto, ProposalQueryDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('proposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Post()
  create(@Body() createProposalDto: CreateProposalDto, @CurrentUser('id') userId: string) {
    return this.proposalsService.create(createProposalDto, userId);
  }

  @Get()
  findAll(@Query() query: ProposalQueryDto) {
    return this.proposalsService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'PRESIDENT')
  getStats() {
    return this.proposalsService.getProposalStats();
  }

  @Get('assembly/:assemblyId')
  getProposalsByAssembly(@Param('assemblyId') assemblyId: string) {
    return this.proposalsService.getProposalsByAssembly(assemblyId);
  }

  @Get('voting/:votingId')
  getProposalsByVoting(@Param('votingId') votingId: string) {
    return this.proposalsService.getProposalsByVoting(votingId);
  }

  @Get('project/:projectId')
  getProposalsByProject(@Param('projectId') projectId: string) {
    return this.proposalsService.getProposalsByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proposalsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string, 
    @Body() updateProposalDto: UpdateProposalDto,
    @CurrentUser('id') userId: string
  ) {
    return this.proposalsService.update(id, updateProposalDto, userId);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'PRESIDENT')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateProposalStatusDto,
    @CurrentUser('id') userId: string
  ) {
    return this.proposalsService.updateStatus(id, updateStatusDto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.proposalsService.remove(id, userId);
  }
}
