import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNotEmpty, IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser } from './current-user.decorator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.authService.profile(user.id);
  }
}
