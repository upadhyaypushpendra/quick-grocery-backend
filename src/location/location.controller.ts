import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { LocationService } from './location.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UpdateLocationDto } from './location.service';

@Controller('location')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('delivery_partner')
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Post()
  async updateLocation(
    @CurrentUser() user: any,
    @Body() dto: UpdateLocationDto,
  ) {
    const location = await this.locationService.updateLocation(user.id, dto);
    return {
      message: 'Location updated successfully',
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        updatedAt: location.updatedAt,
      },
    };
  }

  @Get()
  async getLocation(@CurrentUser() user: any) {
    const location = await this.locationService.getLocation(user.id);
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      speed: location.speed,
      isTracking: location.isTracking,
      updatedAt: location.updatedAt,
    };
  }

  @Post('start')
  async startTracking(@CurrentUser() user: any) {
    await this.locationService.startTracking(user.id);
    return { message: 'Tracking started' };
  }

  @Post('stop')
  async stopTracking(@CurrentUser() user: any) {
    await this.locationService.stopTracking(user.id);
    return { message: 'Tracking stopped' };
  }

  @Get('active')
  async getAllActiveLocations() {
    const locations = await this.locationService.getAllActiveLocations();
    return {
      count: locations.length,
      locations,
    };
  }
}
