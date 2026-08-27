import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ListServicesQueryDto } from './dto/list-services-query.dto';
import { ListServicesResponseDto } from './dto/list-services-response.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateServiceVersionDto } from './dto/create-service-version.dto';
import { UpdateServiceVersionDto } from './dto/update-service-version.dto';
import { Service } from './entities/service.entity';
import { ServiceVersion } from './entities/service-version.entity';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'List services with filtering, sorting and pagination' })
  @ApiOkResponse({ type: ListServicesResponseDto })
  list(@Query() query: ListServicesQueryDto) {
    return this.servicesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single service, including its versions' })
  @ApiOkResponse({ type: Service })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: "Retrieve a service's versions" })
  @ApiOkResponse({ type: [ServiceVersion] })
  @ApiNotFoundResponse()
  listVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.listVersions(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a service' })
  @ApiCreatedResponse({ type: Service })
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a service' })
  @ApiOkResponse({ type: Service })
  @ApiNotFoundResponse()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service and its versions' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.remove(id);
  }

  @Post(':id/versions')
  @Roles('admin')
  @ApiOperation({ summary: 'Add a version to a service' })
  @ApiCreatedResponse({ type: ServiceVersion })
  @ApiNotFoundResponse()
  createVersion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateServiceVersionDto) {
    return this.servicesService.createVersion(id, dto);
  }

  @Patch(':id/versions/:versionId')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a service version' })
  @ApiOkResponse({ type: ServiceVersion })
  @ApiNotFoundResponse()
  updateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateServiceVersionDto,
  ) {
    return this.servicesService.updateVersion(id, versionId, dto);
  }

  @Delete(':id/versions/:versionId')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service version' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  removeVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.servicesService.removeVersion(id, versionId);
  }
}
