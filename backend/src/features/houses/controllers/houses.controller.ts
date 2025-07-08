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
  Put,
} from '@nestjs/common';
import { HousesService } from '../services/houses.service';
import { CreateHouseDto, UpdateHouseDto, QueryHousesDto, AssignUserToHouseDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../shared/decorators';
import { CurrentUser } from '../../../shared/decorators';
import { Role } from '@prisma/client';

@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN)
  create(
    @Body(ValidationPipe) createHouseDto: CreateHouseDto,
    @CurrentUser() user: any
  ) {
    return this.housesService.create(createHouseDto);
  }

  @Get()
  findAll(
    @Query(ValidationPipe) queryDto: QueryHousesDto,
    @CurrentUser() user: any
  ) {
    // Users can only see houses they have access to
    return this.housesService.findAll(queryDto, user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any
  ) {
    return this.housesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateHouseDto: UpdateHouseDto,
    @CurrentUser() user: any
  ) {
    return this.housesService.update(id, updateHouseDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: any
  ) {
    return this.housesService.remove(id);
  }

  // New endpoints for updated schema

  @Get(':id/balance')
  @Roles(Role.ADMIN, Role.PRESIDENT, Role.TREASURER)
  getBalance(
    @Param('id') id: string,
    @CurrentUser() user: any
  ) {
    return this.housesService.getHouseBalance(id);
  }

  @Post(':id/users')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.PRESIDENT)
  assignUser(
    @Param('id') houseId: string,
    @Body(ValidationPipe) assignUserDto: AssignUserToHouseDto,
    @CurrentUser() user: any
  ) {
    return this.housesService.assignUserToHouse(houseId, assignUserDto);
  }

  @Delete(':id/users/:userId')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.PRESIDENT)
  removeUser(
    @Param('id') houseId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any
  ) {
    return this.housesService.removeUserFromHouse(houseId, userId);
  }

  @Put(':id/users/:userId/role')
  @Roles(Role.ADMIN, Role.PRESIDENT)
  updateUserRole(
    @Param('id') houseId: string,
    @Param('userId') userId: string,
    @Body('role') newRole: Role,
    @CurrentUser() user: any
  ) {
    return this.housesService.updateUserRole(houseId, userId, newRole);
  }
}
