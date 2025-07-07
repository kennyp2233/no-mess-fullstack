import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Put,
    Param,
    Delete,
    Query,
    ValidationPipe,
    HttpCode,
    HttpStatus,
    UseGuards,
} from '@nestjs/common';
import { ReceiptsService } from '../services/receipts.service';
import { CreateReceiptDto, UpdateReceiptDto, QueryReceiptsDto, UpdateReceiptStatusDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../../../shared/decorators';
import { Role } from '@prisma/client';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
    constructor(private readonly receiptsService: ReceiptsService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Body(ValidationPipe) createReceiptDto: CreateReceiptDto,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.create(createReceiptDto, user.id);
    }

    @Get()
    findAll(
        @Query(ValidationPipe) queryDto: QueryReceiptsDto,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.findAll(queryDto, user);
    }

    @Get('stats')
    getStats(
        @Query('houseId') houseId?: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
        @CurrentUser() user?: any
    ) {
        const monthNum = month ? parseInt(month) : undefined;
        const yearNum = year ? parseInt(year) : undefined;
        return this.receiptsService.getReceiptStats(houseId, monthNum, yearNum, user);
    }

    @Get('monthly/:houseId/:year')
    getMonthlyStats(
        @Param('houseId') houseId: string,
        @Param('year') year: string,
        @CurrentUser() user: any
    ) {
        const yearNum = parseInt(year);
        return this.receiptsService.getMonthlyReceiptsByHouse(houseId, yearNum, user);
    }

    @Get(':id')
    findOne(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.findOne(id, user);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body(ValidationPipe) updateReceiptDto: UpdateReceiptDto,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.update(id, updateReceiptDto, user);
    }

    @Put(':id/status')
    @Roles(Role.ADMIN)
    updateStatus(
        @Param('id') id: string,
        @Body(ValidationPipe) updateStatusDto: UpdateReceiptStatusDto,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.updateStatus(id, updateStatusDto, user);
    }

    @Put(':id/file')
    updateFilePath(
        @Param('id') id: string,
        @Body() fileData: { filePath: string },
        @CurrentUser() user: any
    ) {
        return this.receiptsService.updateFilePath(id, fileData.filePath, user);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @Roles(Role.ADMIN)
    remove(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.receiptsService.remove(id, user);
    }
}
