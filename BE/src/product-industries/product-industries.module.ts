import { Module } from '@nestjs/common';
import { ProductIndustriesController } from './product-industries.controller';
import { ProductIndustriesService } from './product-industries.service';

@Module({
  controllers: [ProductIndustriesController],
  providers: [ProductIndustriesService],
  exports: [ProductIndustriesService],
})
export class ProductIndustriesModule {}
