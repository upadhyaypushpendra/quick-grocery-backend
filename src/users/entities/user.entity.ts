import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Address } from './address.entity';

export enum UserRole {
  USER = 'user',
  DELIVERY_PARTNER = 'delivery_partner',
  ADMIN = 'admin',
}

export enum IdentifierType {
  EMAIL = 'email',
  PHONE = 'phone',
}

@Entity('users')
@Unique(['identifier', 'role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  identifier: string;

  @Column({ type: 'enum', enum: IdentifierType, nullable: true })
  identifierType: IdentifierType;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Address, (address) => address.user, { cascade: true })
  addresses: Address[];
}
