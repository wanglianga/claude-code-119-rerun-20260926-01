import { Module, Global } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export const JWT_SERVICE = 'JWT_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: JWT_SERVICE,
      useValue: {
        sign: (payload: object) =>
          jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' }),
        verify: (token: string) =>
          jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'),
      },
    },
  ],
  exports: [JWT_SERVICE],
})
export class JwtModule {}
