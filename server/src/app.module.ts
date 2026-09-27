import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Complaint,
  CreditRecord,
  DepositTransaction,
  EquipmentItem,
  EquipmentKitItem,
  EquipmentScanLog,
  Incident,
  IncidentMessage,
  OnsiteCheck,
  Organization,
  Screening,
  TimelineEvent,
  User,
  Venue,
  VenueBlacklistRecord,
  VolunteerCheckin,
} from './entities';
import { AuthModule } from './modules/auth/auth.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AuditModule } from './modules/audit/audit.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { OnsiteModule } from './modules/onsite/onsite.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { FinanceModule } from './modules/finance/finance.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { TimelineModule } from './modules/timeline/timeline.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      // node-postgres: host 以 / 开头时作为 unix socket 目录
      host: process.env.DB_SOCKET || process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5433),
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'cinema',
      entities: [
        User,
        Organization,
        Venue,
        VenueBlacklistRecord,
        Screening,
        TimelineEvent,
        EquipmentItem,
        EquipmentKitItem,
        EquipmentScanLog,
        OnsiteCheck,
        Incident,
        IncidentMessage,
        Complaint,
        VolunteerCheckin,
        CreditRecord,
        DepositTransaction,
      ],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
    }),
    AuthModule,
    ApplicationsModule,
    AuditModule,
    WarehouseModule,
    OnsiteModule,
    IncidentsModule,
    FinanceModule,
    OrgsModule,
    TimelineModule,
  ],
})
export class AppModule {}
