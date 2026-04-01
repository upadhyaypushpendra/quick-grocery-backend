import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Location } from './entities/location.entity';

const LOCATION_HEARTBEAT_TIMEOUT_MS = 30_000;

export interface UpdateLocationDto {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
}

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Update or create delivery partner location
   */
  async updateLocation(
    userId: string,
    data: UpdateLocationDto,
  ): Promise<Location> {
    let location = await this.locationRepo.findOne({ where: { userId } });

    if (!location) {
      // Create new location
      location = this.locationRepo.create({
        userId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        speed: data.speed,
        isTracking: true,
      });
    } else {
      // Update existing location
      location.latitude = data.latitude;
      location.longitude = data.longitude;
      location.accuracy = data.accuracy || 0;
      location.speed = data.speed || 0;
      location.isTracking = true;
      location.updatedAt = new Date();
    }

    const saved = await this.locationRepo.save(location);

    this.eventEmitter.emit('dp.location_updated', {
      userId,
      latitude: data.latitude,
      longitude: data.longitude,
    });

    return saved;
  }

  /**
   * Get user's current location
   */
  async getLocation(userId: string): Promise<Location> {
    const location = await this.locationRepo.findOne({ where: { userId } });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  /**
   * Start tracking for user
   */
  async startTracking(userId: string): Promise<void> {
    let location = await this.locationRepo.findOne({ where: { userId } });

    if (!location) {
      location = this.locationRepo.create({
        userId,
        latitude: 0,
        longitude: 0,
        isTracking: true,
      });
    } else {
      location.isTracking = true;
      location.updatedAt = new Date();
    }

    await this.locationRepo.save(location);
  }

  async heartbeat(userId: string): Promise<void> {
    let location = await this.locationRepo.findOne({ where: { userId } });

    if (!location) {
      location = this.locationRepo.create({
        userId,
        latitude: 0,
        longitude: 0,
        isTracking: true,
      });
    } else {
      location.isTracking = true;
      location.updatedAt = new Date();
    }

    await this.locationRepo.save(location);
  }

  /**
   * Stop tracking for user
   */
  async stopTracking(userId: string): Promise<void> {
    const location = await this.locationRepo.findOne({ where: { userId } });

    if (location) {
      location.isTracking = false;
      await this.locationRepo.save(location);
    }
  }

  /**
   * Get all active locations (for delivery partners currently tracking)
   */
  async getAllActiveLocations(): Promise<Location[]> {
    return this.locationRepo.find({
      where: {
        isTracking: true,
        updatedAt: MoreThan(
          new Date(Date.now() - LOCATION_HEARTBEAT_TIMEOUT_MS),
        ),
      },
    });
  }
}
