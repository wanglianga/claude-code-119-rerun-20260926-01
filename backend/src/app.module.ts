import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  User, Organization, Venue, Equipment, ScreeningSession, SessionEquipment,
  Incident, IncidentMessage, Volunteer, FinanceRecord, CreditRecord, TimelineEvent,
} from './entities';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users.module';
import { OrgsModule } from './modules/orgs.module';
import { VenuesModule } from './modules/venues.module';
import { EquipmentModule } from './modules/equipment.module';
import { SessionsModule } from './modules/sessions.module';
import { IncidentsModule } from './modules/incidents.module';
import { VolunteersModule } from './modules/volunteers.module';
import { FinanceModule } from './modules/finance.module';
import { DashboardModule } from './modules/dashboard.module';
import { UploadModule } from './modules/upload.module';

const entities = [
  User, Organization, Venue, Equipment, ScreeningSession, SessionEquipment,
  Incident, IncidentMessage, Volunteer, FinanceRecord, CreditRecord, TimelineEvent,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5433,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'openair_cinema',
      entities,
      synchronize: true,
    }),
    TypeOrmModule.forFeature(entities),
    AuthModule,
    UsersModule,
    OrgsModule,
    VenuesModule,
    EquipmentModule,
    SessionsModule,
    IncidentsModule,
    VolunteersModule,
    FinanceModule,
    DashboardModule,
    UploadModule,
  ],
})
export class AppModule {}
