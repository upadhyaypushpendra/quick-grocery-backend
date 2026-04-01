import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OrderRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

@Entity('order_requests')
@Index(['deliveryPartnerId', 'status'])
@Index(['createdAt'])
export class OrderRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deliveryPartnerId' })
  deliveryPartner: User;

  @Column()
  deliveryPartnerId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  deliveryFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  pickupLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  pickupLongitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  deliveryLatitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  deliveryLongitude: number;

  @Column({
    type: 'enum',
    enum: OrderRequestStatus,
    default: OrderRequestStatus.PENDING,
  })
  status: OrderRequestStatus;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
