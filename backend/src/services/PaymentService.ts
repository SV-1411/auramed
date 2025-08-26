import { PrismaClient, PaymentStatus, PaymentMethod } from '@prisma/client';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

interface PaymentRequest {
  appointmentId: string;
  patientId: string;
  amount: number;
  currency: string;
  method: 'card' | 'upi' | 'wallet' | 'emi' | 'deferred';
  paymentMethodId?: string;
}

interface PaymentResult {
  id: string;
  status: 'succeeded' | 'pending' | 'failed' | 'deferred' | 'refunded';
  amount: number;
  currency: string;
  transactionId?: string;
}

export class PaymentService {
  private prisma: PrismaClient;
  private stripe: Stripe;

  constructor() {
    this.prisma = new PrismaClient();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16'
    });
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      logger.info(`Processing payment for appointment: ${request.appointmentId}`);

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
          method: this.mapMethod(request.method),
          status: paymentIntent.status === 'succeeded' ? PaymentStatus.PAID : PaymentStatus.PROCESSING,
          gatewayTransactionId: paymentIntent.id,
          gatewayResponse: paymentIntent as any,
          completedAt: paymentIntent.status === 'succeeded' ? new Date() : null
        }
      });

      return {
        id: paymentRecord.id,
        status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'pending',
        amount: request.amount,
        currency: request.currency,
        transactionId: paymentIntent.id
      };

    } catch (error) {
      logger.error('Payment processing failed:', error);
      
      // Save failed payment record
      await this.prisma.paymentTransaction.create({
        data: {
          appointmentId: request.appointmentId,
          patientId: request.patientId,
          amount: request.amount,
          currency: request.currency,
          method: this.mapMethod(request.method),
          status: PaymentStatus.FAILED,
          gatewayResponse: error instanceof Error ? { message: error.message } as any : undefined
        }
      });

      return {
        id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency
      };
    }
  }

  private async createDeferredPayment(request: PaymentRequest): Promise<PaymentResult> {
    const paymentRecord = await this.prisma.paymentTransaction.create({
      data: {
        appointmentId: request.appointmentId,
        patientId: request.patientId,
        amount: request.amount,
        currency: request.currency,
        method: PaymentMethod.DEFERRED,
        status: PaymentStatus.DEFERRED
      }
    });

    return {
      id: paymentRecord.id,
      status: 'deferred',
      amount: request.amount,
      currency: request.currency
    };
  }

  async processRazorpayPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // Razorpay integration would go here
      // For now, simulate successful payment
      const paymentRecord = await this.prisma.paymentTransaction.create({
        data: {
          appointmentId: request.appointmentId,
          patientId: request.patientId,
          amount: request.amount,
          currency: request.currency,
          method: this.mapMethod(request.method),
          status: PaymentStatus.PAID,
          gatewayTransactionId: `rzp_${Date.now()}`,
          completedAt: new Date()
        }
      });

      return {
        id: paymentRecord.id,
        status: 'succeeded',
        amount: request.amount,
        currency: request.currency,
        transactionId: paymentRecord.gatewayTransactionId || undefined
      };

    } catch (error) {
      logger.error('Razorpay payment failed:', error);
      return {
        id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency
      };
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<boolean> {
    try {
      const payment = await this.prisma.paymentTransaction.findUnique({
        where: { id: paymentId }
      });

      if (!payment || !payment.gatewayTransactionId) {
        throw new Error('Payment not found or no transaction ID');
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: payment.gatewayTransactionId,
        amount: amount ? amount * 100 : undefined // Convert to cents if partial refund
      });

      // Update payment record
      await this.prisma.paymentTransaction.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          gatewayResponse: {
            ...(payment.gatewayResponse as any || {}),
            refund: refund as any
          } as any
        }
      });

      return true;

    } catch (error) {
      logger.error('Refund failed:', error);
      return false;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentResult | null> {
    try {
      const payment = await this.prisma.paymentTransaction.findUnique({
        where: { id: paymentId }
      });

      if (!payment) {
        return null;
      }

      return {
        id: payment.id,
        status: this.mapResultStatus(payment.status),
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.gatewayTransactionId || undefined
      };

    } catch (error) {
      logger.error('Failed to get payment status:', error);
      return null;
    }
  }

  async processDeferredPayments(): Promise<void> {
    try {
      const deferredPayments = await this.prisma.paymentTransaction.findMany({
        where: {
          status: PaymentStatus.DEFERRED
        }
      });

      for (const payment of deferredPayments) {
        // Send payment reminder to patient
        logger.info(`Processing deferred payment: ${payment.id}`);
        
        // Update status to pending for manual collection
        await this.prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.PENDING }
        });
      }

    } catch (error) {
      logger.error('Failed to process deferred payments:', error);
    }
  }

  private mapMethod(method: PaymentRequest['method']): PaymentMethod {
    switch (method) {
      case 'card':
        return PaymentMethod.CARD;
      case 'wallet':
        return PaymentMethod.WALLET;
      case 'emi':
        return PaymentMethod.EMI;
      case 'deferred':
        return PaymentMethod.DEFERRED;
      case 'upi':
      default:
        return PaymentMethod.WALLET;
    }
  }

  private mapResultStatus(status: PaymentStatus): PaymentResult['status'] {
    switch (status) {
      case PaymentStatus.PAID:
        return 'succeeded';
      case PaymentStatus.PENDING:
      case PaymentStatus.PROCESSING:
        return 'pending';
      case PaymentStatus.DEFERRED:
        return 'deferred';
      case PaymentStatus.REFUNDED:
        return 'refunded';
      case PaymentStatus.FAILED:
      default:
        return 'failed';
    }
  }

  async generatePaymentLink(request: PaymentRequest): Promise<string> {
    try {
      // Payment Links API requires a Price; price_data is not accepted here.
      const price = await this.stripe.prices.create({
        unit_amount: request.amount * 100,
        currency: request.currency.toLowerCase(),
        product_data: {
          name: 'Medical Consultation'
        }
      });

      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [
          {
            price: price.id,
            quantity: 1
          }
        ],
        metadata: {
          appointmentId: request.appointmentId,
          patientId: request.patientId
        }
      });

      return paymentLink.url;

    } catch (error) {
      logger.error('Failed to generate payment link:', error);
      throw new Error('Could not generate payment link');
    }
  }
}
