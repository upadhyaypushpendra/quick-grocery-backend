import { IsNotEmpty, IsOptional, IsPhoneNumber, IsNumber } from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty()
  label: string;

  @IsNotEmpty()
  line1: string;

  @IsOptional()
  line2: string;

  @IsNotEmpty()
  city: string;

  @IsNotEmpty()
  postcode: string;

  @IsNotEmpty()
  @IsPhoneNumber()
  phone: string;

  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @IsNotEmpty()
  @IsNumber()
  longitude: number;

  @IsOptional()
  isDefault: boolean;
}
