import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { CreateMinutesDto, ValidateMinutesDto } from '../dto';

@Injectable()
export class MinutesService {
  constructor(private prisma: PrismaService) {}

  async create(createMinutesDto: CreateMinutesDto, secretaryId: string) {
    // Verify assembly exists and is completed
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: createMinutesDto.assemblyId },
      include: {
        votings: {
          include: {
            votes: true,
            proposals: true,
          },
        },
      },
    });

    if (!assembly) {
      throw new NotFoundException('Assembly not found');
    }

    if (assembly.status !== 'COMPLETED') {
      throw new BadRequestException('Can only create minutes for completed assemblies');
    }

    // Check if minutes already exist
    const existingMinutes = await this.prisma.minutes.findFirst({
      where: { assemblyId: createMinutesDto.assemblyId },
    });

    if (existingMinutes) {
      throw new BadRequestException('Minutes already exist for this assembly');
    }

    // Generate content automatically if not provided
    let content = createMinutesDto.content;
    if (!content) {
      content = await this.generateMinutesContent(assembly);
    }

    // Generate decisions from voting results if not provided
    let decisions = createMinutesDto.decisions || [];
    if (decisions.length === 0) {
      decisions = await this.generateDecisions(assembly);
    }

    const minutes = await this.prisma.minutes.create({
      data: {
        title: createMinutesDto.title,
        content,
        attendees: createMinutesDto.attendees || [],
        decisions,
        assemblyId: createMinutesDto.assemblyId,
      },
      include: {
        assembly: true,
      },
    });

    return minutes;
  }

  async findAll(page = 1, limit = 10, houseId?: string) {
    const skip = (page - 1) * limit;

    const where = houseId
      ? {
          assembly: {
            houseId,
          },
        }
      : {};

    const [minutes, total] = await Promise.all([
      this.prisma.minutes.findMany({
        where,
        include: {
          assembly: {
            select: { id: true, title: true, date: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.minutes.count({ where }),
    ]);

    return {
      data: minutes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
      include: {
        assembly: {
          include: {
            votings: {
              include: {
                votes: true,
                proposals: true,
              },
            },
          },
        },
      },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    return minutes;
  }

  async validate(id: string, validateMinutesDto: ValidateMinutesDto) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    // Simple validation - just mark as validated (using title prefix for now)
    const updatedMinutes = await this.prisma.minutes.update({
      where: { id },
      data: {
        title: `[VALIDATED] ${minutes.title.replace('[VALIDATED] ', '')}`,
      },
      include: {
        assembly: true,
      },
    });

    return updatedMinutes;
  }

  async publish(id: string) {
    const minutes = await this.prisma.minutes.findUnique({
      where: { id },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes not found');
    }

    // Simple publish - mark as published (using title prefix for now)
    const updatedMinutes = await this.prisma.minutes.update({
      where: { id },
      data: {
        title: `[PUBLISHED] ${minutes.title.replace('[VALIDATED] ', '').replace('[PUBLISHED] ', '')}`,
      },
      include: {
        assembly: true,
      },
    });

    return updatedMinutes;
  }

  async findByAssembly(assemblyId: string) {
    const minutes = await this.prisma.minutes.findFirst({
      where: { assemblyId },
      include: {
        assembly: true,
      },
    });

    return minutes;
  }

  // Helper method to generate content based on assembly data
  private async generateMinutesContent(assembly: any): Promise<string> {
    const date = new Date(assembly.date).toLocaleDateString();
    const time = new Date(assembly.date).toLocaleTimeString();

    let content = `MINUTES OF ${assembly.title.toUpperCase()}\n\n`;
    content += `Date: ${date}\n`;
    content += `Time: ${time}\n`;
    content += `Location: ${assembly.location || 'Community Center'}\n\n`;

    content += `AGENDA:\n`;
    content += `1. Call to Order\n`;
    content += `2. Approval of Previous Minutes\n`;
    content += `3. Reports\n`;
    content += `4. Voting on Proposals\n`;
    content += `5. New Business\n`;
    content += `6. Adjournment\n\n`;

    if (assembly.votings && assembly.votings.length > 0) {
      content += `VOTING RESULTS:\n`;
      for (const voting of assembly.votings) {
        const yesVotes = voting.votes.filter((v: any) => v.option === 'YES').length;
        const noVotes = voting.votes.filter((v: any) => v.option === 'NO').length;
        const abstainVotes = voting.votes.filter((v: any) => v.option === 'ABSTAIN').length;
        
        content += `\n${voting.title}:\n`;
        content += `  - Yes: ${yesVotes}\n`;
        content += `  - No: ${noVotes}\n`;
        content += `  - Abstain: ${abstainVotes}\n`;
        content += `  - Result: ${yesVotes > noVotes ? 'APPROVED' : 'REJECTED'}\n`;
      }
      content += `\n`;
    }

    content += `NEXT STEPS:\n`;
    content += `- Follow up on approved proposals\n`;
    content += `- Schedule next assembly\n\n`;

    content += `Meeting adjourned at ${new Date().toLocaleTimeString()}.\n\n`;
    content += `Respectfully submitted,\n`;
    content += `[Secretary Name]\n`;
    content += `Secretary`;

    return content;
  }

  // Helper method to generate decisions from voting results
  private async generateDecisions(assembly: any): Promise<string[]> {
    const decisions: string[] = [];

    if (assembly.votings && assembly.votings.length > 0) {
      for (const voting of assembly.votings) {
        const yesVotes = voting.votes.filter((v: any) => v.option === 'YES').length;
        const noVotes = voting.votes.filter((v: any) => v.option === 'NO').length;
        
        if (yesVotes > noVotes) {
          decisions.push(`Approved: ${voting.title}`);
        } else {
          decisions.push(`Rejected: ${voting.title}`);
        }
      }
    }

    return decisions;
  }
}
