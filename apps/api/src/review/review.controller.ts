import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface.js';
import { Public } from '../common/decorators/public.decorator.js';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(UserRole.PLAYER, UserRole.OWNER, UserRole.ADMIN)
  create(
    @CurrentUser() user: AuthUser,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewService.create(createReviewDto, user.id);
  }

  @Get('eligibility')
  @UseGuards(ClerkAuthGuard)
  getEligibility(
    @CurrentUser() user: AuthUser,
    @Query('venueId') venueId: string,
  ) {
    if (!venueId) {
      return [];
    }
    return this.reviewService.checkEligibility(user.id, venueId);
  }

  @Public()
  @Get('venue/:venueId')
  findAllByVenue(
    @Param('venueId') venueId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewService.findByVenue(venueId, +page || 1, +limit || 10);
  }
}
