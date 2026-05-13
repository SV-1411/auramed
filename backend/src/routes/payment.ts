import express, { Response, NextFunction } from 'express';
import { PaymentStatus } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { PaymentService } from '../services/PaymentService';
import { logger } from '../utils/logger';
import { createError } from '../middleware/errorHandler';
import { getDatabase } from '../config/database';

const router = express.Router();
const paymentService = new PaymentService();

// Process payment for appointment (enhanced)
router.post('/process', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { appointmentId, amount, currency = 'INR', method = 'CARD' } = req.body;
    const patientId = req.user?.id;

    if (!patientId) {
      throw createError('Unauthorized', 401);
    }
    if (!appointmentId || !amount) {
      throw createError('Appointment ID and amount are required', 400);
    }

    const prisma = getDatabase();

    // Verify appointment belongs to user
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId: patientId
      }
    });

    if (!appointment) {
      throw createError('Appointment not found', 404);
    }

    const paymentResult = await paymentService.processPayment({
      appointmentId,
      patientId: patientId,
      amount,
      currency,
      method,
      paymentMethodId: req.body.paymentMethodId
    });

    if (paymentResult.status === 'succeeded') {
      // Update appointment payment status
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { paymentStatus: PaymentStatus.PAID }
      });
    }

    res.json({
      status: 'success',
      data: paymentResult
    });

  } catch (error) {
    next(error);
  }
});

// Get supported payment methods
router.get('/methods', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const paymentMethods = [
      {
        id: 'card',
        name: 'Credit/Debit Card',
        description: 'Visa, Mastercard, American Express',
        icon: '💳',
        supported: true,
        processingFee: 2.9
      },
      {
        id: 'wallet',
        name: 'Digital Wallet',
        description: 'PayTM, Google Pay, PhonePe',
        icon: '📱',
        supported: true,
        processingFee: 1.5
      },
      {
        id: 'emi',
        name: 'EMI',
        description: '3, 6, 9, 12 month installments',
        icon: '📅',
        supported: true,
        processingFee: 3.5
      },
      {
        id: 'deferred',
        name: 'Pay Later',
        description: 'Pay within 30 days',
        icon: '⏰',
        supported: true,
        processingFee: 0
      }
    ];

    res.json({
      status: 'success',
      data: { methods: paymentMethods },
      message: 'Supported payment methods retrieved successfully'
    });

  } catch (error) {
    next(error);
  }
});

// Get payment history
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      throw createError('Unauthorized', 401);
    }

    const { limit = 20, status } = req.query;

    const where: any = { patientId };
    if (status) where.status = status as PaymentStatus;

    const prisma = getDatabase();
    const payments = await prisma.paymentTransaction.findMany({
      where,
      include: {
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            type: true,
            symptoms: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });

    // Calculate summary statistics
    const totalPaid = payments
      .filter(p => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payments
      .filter(p => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      status: 'success',
      data: {
        payments,
        summary: {
          totalPayments: payments.length,
          totalPaid,
          pendingAmount,
          completedPayments: payments.filter(p => p.status === PaymentStatus.PAID).length,
          failedPayments: payments.filter(p => p.status === PaymentStatus.FAILED).length
        }
      },
      count: payments.length
    });

  } catch (error) {
    next(error);
  }
});

// Get payment analytics
router.get('/analytics', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      throw createError('Unauthorized', 401);
    }

    const prisma = getDatabase();
    const payments = await prisma.paymentTransaction.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate analytics
    const totalSpent = payments
      .filter(p => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlySpending = payments.reduce((acc, payment) => {
      if (payment.status === PaymentStatus.PAID && payment.completedAt) {
        const month = new Date(payment.completedAt).toISOString().slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + payment.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const paymentMethodUsage = payments.reduce((acc, payment) => {
      if (payment.status === PaymentStatus.PAID) {
        acc[payment.method] = (acc[payment.method] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    res.json({
      status: 'success',
      data: {
        analytics: {
          totalSpent,
          totalPayments: payments.length,
          successfulPayments: payments.filter(p => p.status === PaymentStatus.PAID).length,
          failedPayments: payments.filter(p => p.status === PaymentStatus.FAILED).length,
          monthlySpending,
          paymentMethodUsage,
          averageTransaction: totalSpent / Math.max(1, payments.filter(p => p.status === PaymentStatus.PAID).length)
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// Process refund (enhanced)
router.post('/refund/:paymentId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;
    const patientId = req.user?.id;

    const prisma = getDatabase();
    const payment = await prisma.paymentTransaction.findFirst({
      where: {
        id: paymentId,
        patientId: patientId
      }
    });

    if (!payment) {
      throw createError('Payment not found', 404);
    }

    if (payment.status !== PaymentStatus.PAID) {
      throw createError('Only paid transactions can be refunded', 400);
    }

    // Check if refund is within allowed timeframe (e.g., 24 hours)
    const paymentTime = new Date(payment.completedAt!);
    const now = new Date();
    const hoursSincePayment = (now.getTime() - paymentTime.getTime()) / (1000 * 60 * 60);

    if (hoursSincePayment > 24) {
      throw createError('Refund requests must be within 24 hours of payment', 400);
    }

    const success = await paymentService.refundPayment(paymentId, amount || payment.amount);

    if (success) {
      // Update payment status to refunded
      const refundAmount = amount || payment.amount;

      await prisma.paymentTransaction.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          gatewayResponse: {
            ...(typeof payment.gatewayResponse === 'object' && payment.gatewayResponse !== null ? payment.gatewayResponse : {}),
            refundAmount,
            refundReason: reason,
            refundedAt: new Date().toISOString()
          }
        }
      });

      // Update appointment payment status
      await prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: { paymentStatus: PaymentStatus.REFUNDED }
      });

      res.json({
        status: 'success',
        message: `Refund processed successfully`
      });
    } else {
      throw createError('Refund processing failed', 400);
    }

  } catch (error) {
    next(error);
  }
});

// Generate payment link
router.post('/generate-link', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { appointmentId, amount, currency } = req.body;
    const patientId = req.user?.id;

    const paymentLink = await paymentService.generatePaymentLink({
      appointmentId,
      patientId: patientId!,
      amount,
      currency,
      method: 'card'
    });

    res.json({
      status: 'success',
      data: { paymentLink }
    });

  } catch (error) {
    next(error);
  }
});

// Get payment status
router.get('/status/:paymentId', authenticateToken, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;

    const paymentStatus = await paymentService.getPaymentStatus(paymentId);

    if (!paymentStatus) {
      throw createError('Payment not found', 404);
    }

    res.json({
      status: 'success',
      data: paymentStatus
    });

  } catch (error) {
    next(error);
  }
});

// Webhook for payment events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // const sig = req.headers['stripe-signature'];
    // const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify webhook signature (Stripe specific)
    // Implementation would depend on payment provider

    const event = req.body;
    logger.info('Payment webhook received:', event.type);

    // Handle different payment events
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Update payment status in database
        await handlePaymentSuccess(event.data);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Payment webhook error:', error);
    res.status(400).send('Webhook error');
  }
});

// Helper functions for webhook handling
async function handlePaymentSuccess(data: any) {
  const { transactionId } = data;
  const prisma = getDatabase();

  const payment = await prisma.paymentTransaction.findFirst({
    where: { gatewayTransactionId: transactionId }
  });

  if (payment) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        completedAt: new Date(),
        gatewayResponse: data
      }
    });

    // Update appointment payment status
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { paymentStatus: PaymentStatus.PAID }
    });

    logger.info(`Payment ${transactionId} marked as successful`);
  }
}

async function handlePaymentFailure(data: any) {
  const { transactionId } = data;
  const prisma = getDatabase();

  const payment = await prisma.paymentTransaction.findFirst({
    where: { gatewayTransactionId: transactionId }
  });

  if (payment) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.FAILED,
        gatewayResponse: data
      }
    });

    logger.info(`Payment ${transactionId} marked as failed`);
  }
}

export default router;
