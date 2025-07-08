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
import { VotingService } from '../services/voting.service';
import { VotingStatsService } from '../services/voting-stats.service';
import { VotingQuorumService } from '../services/voting-quorum.service';
import { VotingSchedulerService } from '../services/voting-scheduler.service';
import { VotingNotificationService } from '../services/voting-notification.service';
import { CreateVotingDto, CastVoteDto, UpdateVotingDto, VotingQueryDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';

@Controller('voting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VotingController {
  constructor(
    private readonly votingService: VotingService,
    private readonly votingStatsService: VotingStatsService,
    private readonly votingQuorumService: VotingQuorumService,
    private readonly votingSchedulerService: VotingSchedulerService,
    private readonly votingNotificationService: VotingNotificationService
  ) {}

  @Post()
  @Roles('ADMIN', 'PRESIDENT')
  create(@Body() createVotingDto: CreateVotingDto, @CurrentUser('id') userId: string) {
    return this.votingService.create(createVotingDto, userId);
  }

  @Get()
  findAll(@Query() query: VotingQueryDto) {
    return this.votingService.findAll(query);
  }

  @Get('stats')
  @Roles('ADMIN', 'PRESIDENT')
  getStats() {
    return this.votingService.getVotingStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.votingService.findOne(id);
  }

  @Get(':id/results')
  getResults(@Param('id') id: string) {
    return this.votingService.getResults(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRESIDENT')
  update(@Param('id') id: string, @Body() updateVotingDto: UpdateVotingDto) {
    return this.votingService.update(id, updateVotingDto);
  }

  @Post('vote')
  @HttpCode(HttpStatus.OK)
  castVote(@Body() castVoteDto: CastVoteDto, @CurrentUser('id') userId: string) {
    return this.votingService.castVote(castVoteDto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PRESIDENT')
  remove(@Param('id') id: string) {
    return this.votingService.remove(id);
  }

  @Get(':id/proposals')
  getVotingProposals(@Param('id') id: string) {
    return this.votingService.getVotingProposals(id);
  }

  // VotingStatsService endpoints
  @Get(':id/stats')
  getRealTimeStats(@Param('id') id: string) {
    return this.votingStatsService.getRealTimeStats(id);
  }

  @Get(':id/participants')
  getVotingParticipants(@Param('id') id: string) {
    return this.votingStatsService.getVotingParticipants(id);
  }

  // VotingQuorumService endpoints
  @Get(':id/quorum')
  getQuorumStatus(@Param('id') id: string) {
    return this.votingQuorumService.checkQuorumStatus(id);
  }

  @Get(':id/quorum/history')
  getQuorumHistory(@Param('id') id: string) {
    return this.votingQuorumService.getQuorumHistory(id);
  }

  @Get(':id/quorum/validate')
  @Roles('ADMIN', 'PRESIDENT')
  validateQuorumRequirements(@Param('id') id: string) {
    return this.votingQuorumService.validateQuorumRequirements(id);
  }

  // VotingSchedulerService endpoints
  @Post(':id/auto-close-check')
  @Roles('ADMIN', 'PRESIDENT')
  checkAutoClose(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.votingSchedulerService.autoCloseVotingIfNeeded(id, userId);
  }

  @Post(':id/close')
  @Roles('ADMIN', 'PRESIDENT')
  closeVoting(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.votingService.closeVoting(id, userId);
  }

  // VotingNotificationService endpoints
  @Post(':id/reminder')
  @Roles('ADMIN', 'PRESIDENT')
  sendReminder(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.votingNotificationService.sendReminder(id, userId);
  }
}
