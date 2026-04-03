import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Address) private addressRepo: Repository<Address>,
  ) {}

  async getProfile(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['addresses'],
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userRepo.update({ id: userId }, dto);
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async getAddresses(userId: string) {
    return this.addressRepo.find({
      where: { userId },
    });
  }

  async getAddress(userId: string, addressId: string) {
    const address = await this.addressRepo.findOne({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new Error('Address not found');
    }
    return address;
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    const address = this.addressRepo.create({
      ...dto,
      userId,
    });
    return this.addressRepo.save(address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    const address = await this.addressRepo.findOne({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new Error('Address not found');
    }
    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.addressRepo.findOne({
      where: { id: addressId, userId },
    });
    if (!address) {
      throw new Error('Address not found');
    }
    await this.addressRepo.remove(address);
    return { message: 'Address deleted' };
  }
}
