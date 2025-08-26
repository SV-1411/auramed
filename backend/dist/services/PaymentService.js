"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
const stripe_1 = __importDefault(require("stripe"));
class PaymentService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2023-10-16'
        });
    }
    async processPayment(request) {
        try {
            logger_1.logger.info(`Processing payment for appointment: ${request.appointmentId}`);
            // Handle deferred payments for emergencies
            if (request.method === 'deferred') {
                return await this.createDeferredPayment(request);
            }
            // Process immediate payment
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: request.amount * 100, // Convert to cents
                currency: request.currency.toLowerCase(),
                payment_method: request.paymentMethodId,
                confirm: true,
                return_url: `${process.env.FRONTEND_URL}/payment/success`,
                metadata: {
                    appointmentId: request.appointmentId,
                    patientId: request.patientId
                }
            });
            // Save payment record
            const paymentRecord = await this.prisma.paymentTransaction.create({
                data: {
                    appointmentId: request.appointmentId,
                    patientId: request.patientId,
                    amount: request.amount,
                    currency: request.currency,
                    method: request.method,
                    status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
                    transactionId: paymentIntent.id,
                    gatewayResponse: JSON.stringify(paymentIntent),
                    processedAt: paymentIntent.status === 'succeeded' ? new Date() : null
                }
            });
            return {
                id: paymentRecord.id,
                status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
                amount: request.amount,
                currency: request.currency,
                transactionId: paymentIntent.id
            };
        }
        catch (error) {
            logger_1.logger.error('Payment processing failed:', error);
            // Save failed payment record
            await this.prisma.paymentTransaction.create({
                data: {
                    appointmentId: request.appointmentId,
                    patientId: request.patientId,
                    amount: request.amount,
                    currency: request.currency,
                    method: request.method,
                    status: 'failed',
                    failureReason: error instanceof Error ? error.message : 'Unknown error'
                }
            });
            return {
                id: '',
                status: 'failed',
                amount: request.amount,
                currency: request.currency,
                failureReason: error instanceof Error ? error.message : 'Payment processing failed'
            };
        }
    }
    async createDeferredPayment(request) {
        const paymentRecord = await this.prisma.paymentTransaction.create({
            data: {
                appointmentId: request.appointmentId,
                patientId: request.patientId,
                amount: request.amount,
                currency: request.currency,
                method: 'deferred',
                status: 'deferred',
                deferredUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
        });
        return {
            id: paymentRecord.id,
            status: 'deferred',
            amount: request.amount,
            currency: request.currency
        };
    }
    async processRazorpayPayment(request) {
        try {
            // Razorpay integration would go here
            // For now, simulate successful payment
            const paymentRecord = await this.prisma.paymentTransaction.create({
                data: {
                    appointmentId: request.appointmentId,
                    patientId: request.patientId,
                    amount: request.amount,
                    currency: request.currency,
                    method: request.method,
                    status: 'completed',
                    transactionId: `rzp_${Date.now()}`,
                    processedAt: new Date()
                }
            });
            return {
                id: paymentRecord.id,
                status: 'succeeded',
                amount: request.amount,
                currency: request.currency,
                transactionId: paymentRecord.transactionId
            };
        }
        catch (error) {
            logger_1.logger.error('Razorpay payment failed:', error);
            return {
                id: '',
                status: 'failed',
                amount: request.amount,
                currency: request.currency,
                failureReason: error instanceof Error ? error.message : 'Razorpay payment failed'
            };
        }
    }
    async refundPayment(paymentId, amount) {
        try {
            const payment = await this.prisma.paymentTransaction.findUnique({
                where: { id: paymentId }
            });
            if (!payment || !payment.transactionId) {
                throw new Error('Payment not found or no transaction ID');
            }
            const refund = await this.stripe.refunds.create({
                payment_intent: payment.transactionId,
                amount: amount ? amount * 100 : undefined // Convert to cents if partial refund
            });
            // Update payment record
            await this.prisma.paymentTransaction.update({
                where: { id: paymentId },
                data: {
                    status: 'refunded',
                    refundId: refund.id,
                    refundedAt: new Date(),
                    refundAmount: refund.amount / 100 // Convert back to dollars
                }
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Refund failed:', error);
            return false;
        }
    }
    async getPaymentStatus(paymentId) {
        try {
            const payment = await this.prisma.paymentTransaction.findUnique({
                where: { id: paymentId }
            });
            if (!payment) {
                return null;
            }
            return {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                transactionId: payment.transactionId || undefined,
                failureReason: payment.failureReason || undefined
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get payment status:', error);
            return null;
        }
    }
    async processDeferredPayments() {
        try {
            const deferredPayments = await this.prisma.paymentTransaction.findMany({
                where: {
                    status: 'deferred',
                    deferredUntil: {
                        lte: new Date()
                    }
                }
            });
            for (const payment of deferredPayments) {
                // Send payment reminder to patient
                logger_1.logger.info(`Processing deferred payment: ${payment.id}`);
                // Update status to pending for manual collection
                await this.prisma.paymentTransaction.update({
                    where: { id: payment.id },
                    data: { status: 'pending' }
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to process deferred payments:', error);
        }
    }
    async generatePaymentLink(request) {
        try {
            const paymentLink = await this.stripe.paymentLinks.create({
                line_items: [
                    {
                        price_data: {
                            currency: request.currency.toLowerCase(),
                            product_data: {
                                name: 'Medical Consultation',
                                description: `Appointment ID: ${request.appointmentId}`
                            },
                            unit_amount: request.amount * 100
                        },
                        quantity: 1
                    }
                ],
                metadata: {
                    appointmentId: request.appointmentId,
                    patientId: request.patientId
                }
            });
            return paymentLink.url;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate payment link:', error);
            throw new Error('Could not generate payment link');
        }
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=PaymentService.js.map