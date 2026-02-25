import { Controller, Post, Get, Body, HttpCode, Delete, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    @HttpCode(202)
    async placeOrder(@Body() orderPayload: any) {
        return this.ordersService.processIncomingOrder(orderPayload);
    }

    @Get()
    async getOrders() {
        return this.ordersService.getAllOrders();
    }

    @Get('customer/:email')
    async getCustomerHistory(@Param('email') email: string) {
        return this.ordersService.getCustomerOrderHistory(email);
    }

    @Delete(':id')
    async deleteOrder(@Param('id') id: string) {
        return this.ordersService.deleteOrder(id);
    }
}
