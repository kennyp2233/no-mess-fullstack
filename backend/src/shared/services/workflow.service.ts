import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BusinessRulesService } from './business-rules.service';
import {
  ProjectStatus,
  AssemblyStatus,
  ProposalStatus,
  ProposalType,
  VotingType,
  VoteOption,
} from '@prisma/client';

@Injectable()
export class WorkflowService {
  constructor(
    private prisma: PrismaService,
    private businessRules: BusinessRulesService,
  ) {}

  // ====================================
  // PROJECT WORKFLOWS
  // ====================================

  // Workflow: Create Project → Generate Proposal → Include in Voting
  async createProjectWorkflow(projectData: {
    title: string;
    description: string;
    budget: number;
    houseId: string;
    userId: string;
    assemblyId?: string;
  }): Promise<{
    project: any;
    proposal: any;
    voting?: any;
  }> {
    // 1. Create the project
    const project = await this.prisma.project.create({
      data: {
        title: projectData.title,
        description: projectData.description,
        budget: projectData.budget,
        status: ProjectStatus.PROPOSED,
        houseId: projectData.houseId,
      },
    });

    // 2. Create proposal for project approval
    const proposal = await this.prisma.proposal.create({
      data: {
        title: `Aprobación del Proyecto: ${projectData.title}`,
        description: `Propuesta para aprobar el proyecto "${projectData.title}" con un presupuesto de $${projectData.budget}`,
        proposalType: ProposalType.PROJECT_APPROVAL,
        status: ProposalStatus.PENDING,
        userId: projectData.userId,
        projectId: project.id,
        assemblyId: projectData.assemblyId,
      },
    });

    // 3. If assembly exists, create voting for the proposal
    let voting = null;
    if (projectData.assemblyId) {
      const assembly = await this.prisma.assembly.findUnique({
        where: { id: projectData.assemblyId },
      });

      if (assembly) {
        voting = await this.prisma.voting.create({
          data: {
            title: `Votación: ${projectData.title}`,
            description: `Votación para aprobar el proyecto "${projectData.title}"`,
            type: VotingType.SIMPLE_MAJORITY,
            startDate: assembly.date,
            endDate: new Date(assembly.date.getTime() + 2 * 60 * 60 * 1000), // 2 hours duration
            assemblyId: projectData.assemblyId,
          },
        });

        // Link proposal to voting
        await this.prisma.proposal.update({
          where: { id: proposal.id },
          data: { votingId: voting.id },
        });
      }
    }

    return { project, proposal, voting };
  }

  // ====================================
  // VOTING WORKFLOWS
  // ====================================

  // Workflow: Voting Approved → Update Proposal Status → Update Project Status
  async processVotingResults(votingId: string): Promise<{
    voting: any;
    updatedProposals: any[];
    updatedProjects: any[];
  }> {
    // 1. Calculate voting results
    const results = await this.businessRules.calculateVotingResults(votingId);

    // 2. Get all proposals linked to this voting
    const proposals = await this.prisma.proposal.findMany({
      where: { votingId },
      include: { project: true },
    });

    const updatedProposals = [];
    const updatedProjects = [];

    // 3. Update proposal statuses based on voting results
    for (const proposal of proposals) {
      const newProposalStatus = results.isPassed
        ? ProposalStatus.APPROVED
        : ProposalStatus.REJECTED;

      if (this.businessRules.canTransitionProposalStatus(proposal.status, newProposalStatus)) {
        const updatedProposal = await this.prisma.proposal.update({
          where: { id: proposal.id },
          data: { status: newProposalStatus },
        });
        updatedProposals.push(updatedProposal);

        // 4. If proposal is approved and relates to a project, update project status
        if (newProposalStatus === ProposalStatus.APPROVED && proposal.project) {
          const newProjectStatus = ProjectStatus.APPROVED;
          
          if (this.businessRules.canTransitionProjectStatus(proposal.project.status, newProjectStatus)) {
            const updatedProject = await this.prisma.project.update({
              where: { id: proposal.project.id },
              data: { status: newProjectStatus },
            });
            updatedProjects.push(updatedProject);
          }
        }
      }
    }

    const voting = await this.prisma.voting.findUnique({
      where: { id: votingId },
      include: { proposals: true },
    });

    return { voting, updatedProposals, updatedProjects };
  }

  // ====================================
  // TRANSACTION WORKFLOWS
  // ====================================

  // Workflow: Transaction → Update Account Balance → Update House Balance
  async processTransactionWorkflow(transactionData: {
    title: string;
    description?: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    category: any;
    date: Date;
    userId: string;
    houseId: string;
    accountId: string;
    projectId?: string;
  }): Promise<{
    transaction: any;
    updatedAccount: any;
    updatedHouse: any;
  }> {
    // 1. Create transaction
    const transaction = await this.prisma.transaction.create({
      data: transactionData,
    });

    // 2. Update account balance
    const account = await this.prisma.account.findUnique({
      where: { id: transactionData.accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const balanceChange = transactionData.type === 'INCOME' 
      ? transactionData.amount 
      : -transactionData.amount;

    const updatedAccount = await this.prisma.account.update({
      where: { id: transactionData.accountId },
      data: {
        balance: account.balance + balanceChange,
      },
    });

    // 3. Update house balance
    const house = await this.prisma.house.findUnique({
      where: { id: transactionData.houseId },
    });

    if (!house) {
      throw new Error('House not found');
    }

    const updatedHouse = await this.prisma.house.update({
      where: { id: transactionData.houseId },
      data: {
        balance: house.balance + balanceChange,
      },
    });

    return { transaction, updatedAccount, updatedHouse };
  }

  // ====================================
  // ASSEMBLY WORKFLOWS
  // ====================================

  // Workflow: Assembly → Create Votings → Process Results
  async createAssemblyWorkflow(assemblyData: {
    title: string;
    description?: string;
    date: Date;
    location?: string;
    houseId: string;
    proposalIds?: string[];
  }): Promise<{
    assembly: any;
    votings: any[];
  }> {
    // 1. Validate assembly scheduling
    const schedulingValidation = await this.businessRules.validateAssemblyScheduling(assemblyData.date);
    
    if (!schedulingValidation.isValid) {
      throw new Error('Assembly conflicts with existing assemblies on the same date');
    }

    // 2. Create assembly
    const assembly = await this.prisma.assembly.create({
      data: {
        title: assemblyData.title,
        description: assemblyData.description,
        date: assemblyData.date,
        location: assemblyData.location,
        status: AssemblyStatus.SCHEDULED,
        houseId: assemblyData.houseId,
      },
    });

    const votings = [];

    // 3. Create votings for existing proposals
    if (assemblyData.proposalIds && assemblyData.proposalIds.length > 0) {
      const proposals = await this.prisma.proposal.findMany({
        where: {
          id: { in: assemblyData.proposalIds },
          status: ProposalStatus.PENDING,
        },
      });

      for (const proposal of proposals) {
        const voting = await this.prisma.voting.create({
          data: {
            title: `Votación: ${proposal.title}`,
            description: proposal.description,
            type: this.getVotingTypeForProposal(proposal.proposalType),
            startDate: assemblyData.date,
            endDate: new Date(assemblyData.date.getTime() + 2 * 60 * 60 * 1000), // 2 hours
            assemblyId: assembly.id,
          },
        });

        // Link proposal to voting and assembly
        await this.prisma.proposal.update({
          where: { id: proposal.id },
          data: { 
            votingId: voting.id,
            assemblyId: assembly.id,
          },
        });

        votings.push(voting);
      }
    }

    return { assembly, votings };
  }

  // ====================================
  // PROPOSAL WORKFLOWS
  // ====================================

  // Workflow: Create Proposal → Auto-assign to next Assembly
  async createProposalWorkflow(proposalData: {
    title: string;
    description: string;
    proposalType: ProposalType;
    userId: string;
    projectId?: string;
  }): Promise<{
    proposal: any;
    assembly?: any;
  }> {
    // 1. Create proposal
    const proposal = await this.prisma.proposal.create({
      data: {
        ...proposalData,
        status: ProposalStatus.PENDING,
      },
    });

    // 2. Find next scheduled assembly
    const nextAssembly = await this.prisma.assembly.findFirst({
      where: {
        date: { gte: new Date() },
        status: AssemblyStatus.SCHEDULED,
      },
      orderBy: { date: 'asc' },
    });

    // 3. Auto-assign to next assembly if exists
    if (nextAssembly) {
      await this.prisma.proposal.update({
        where: { id: proposal.id },
        data: { assemblyId: nextAssembly.id },
      });
    }

    return { proposal, assembly: nextAssembly };
  }

  // ====================================
  // HELPER METHODS
  // ====================================

  private getVotingTypeForProposal(proposalType: ProposalType): VotingType {
    switch (proposalType) {
      case ProposalType.PROJECT_APPROVAL:
        return VotingType.SIMPLE_MAJORITY;
      case ProposalType.ALIQUOT_CHANGE:
        return VotingType.QUALIFIED_MAJORITY;
      case ProposalType.BUDGET_APPROVAL:
        return VotingType.QUALIFIED_MAJORITY;
      case ProposalType.REGULATION_CHANGE:
        return VotingType.QUALIFIED_MAJORITY;
      case ProposalType.EXTRAORDINARY_FEE:
        return VotingType.QUALIFIED_MAJORITY;
      default:
        return VotingType.SIMPLE_MAJORITY;
    }
  }

  // ====================================
  // STATUS UPDATE WORKFLOWS
  // ====================================

  // Start Assembly Workflow
  async startAssembly(assemblyId: string): Promise<any> {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: assemblyId },
      include: { votings: true },
    });

    if (!assembly) {
      throw new Error('Assembly not found');
    }

    if (!this.businessRules.canTransitionAssemblyStatus(assembly.status, AssemblyStatus.IN_PROGRESS)) {
      throw new Error('Cannot start assembly from current status');
    }

    return this.prisma.assembly.update({
      where: { id: assemblyId },
      data: { status: AssemblyStatus.IN_PROGRESS },
    });
  }

  // Complete Assembly Workflow
  async completeAssembly(assemblyId: string): Promise<{
    assembly: any;
    processedVotings: any[];
  }> {
    const assembly = await this.prisma.assembly.findUnique({
      where: { id: assemblyId },
      include: { votings: true },
    });

    if (!assembly) {
      throw new Error('Assembly not found');
    }

    if (!this.businessRules.canTransitionAssemblyStatus(assembly.status, AssemblyStatus.COMPLETED)) {
      throw new Error('Cannot complete assembly from current status');
    }

    // Process all votings results
    const processedVotings = [];
    for (const voting of assembly.votings) {
      const result = await this.processVotingResults(voting.id);
      processedVotings.push(result);
    }

    const updatedAssembly = await this.prisma.assembly.update({
      where: { id: assemblyId },
      data: { status: AssemblyStatus.COMPLETED },
    });

    return { assembly: updatedAssembly, processedVotings };
  }
}
