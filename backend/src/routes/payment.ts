import express, { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, UserRole, PaymentMethod } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { PaymentService } from '../services/PaymentService';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();
const paymentService = new PaymentService();

// Process payment for appointment (enhanced)
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, amount, currency = 'INR', method = 'CARD' } = req.body;
    const patientId = req.user?.id;

    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });
    if (!appointmentId || !amount) {
      return res.status(400).json({ error: 'Appointment ID and amount are required' });
    }

    // Verify appointment belongs to user
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId: patientId
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
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
      success: true,
      data: paymentResult
    });

  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// Get supported payment methods
router.get('/methods', authenticateToken, async (req, res) => {
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
      success: true,
      data: { methods: paymentMethods },
      message: 'Supported payment methods retrieved successfully'
    });

  } catch (error) {
    logger.error('Payment methods error:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

// Get payment history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });

    const { limit = 20, status } = req.query;

    const where: any = { patientId };
    if (status) where.status = status as PaymentStatus;

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
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingAmount = payments
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      data: {
        payments,
        summary: {
          totalPayments: payments.length,
          totalPaid,
          pendingAmount,
          completedPayments: payments.filter(p => p.status === 'PAID').length,
          failedPayments: payments.filter(p => p.status === 'FAILED').length
        }
      },
      count: payments.length
    });

  } catch (error) {
    logger.error('Payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// Get payment analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const patientId = req.user?.id;
    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });

    const payments = await prisma.paymentTransaction.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate analytics
    const totalSpent = payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlySpending = payments.reduce((acc, payment) => {
      if (payment.status === 'PAID' && payment.completedAt) {
        const month = new Date(payment.completedAt).toISOString().slice(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + payment.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const paymentMethodUsage = payments.reduce((acc, payment) => {
      if (payment.status === 'PAID') {
        acc[payment.method] = (acc[payment.method] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        analytics: {
          totalSpent,
          totalPayments: payments.length,
          successfulPayments: payments.filter(p => p.status === 'PAID').length,
          failedPayments: payments.filter(p => p.status === 'FAILED').length,
          monthlySpending,
          paymentMethodUsage,
          averageTransaction: totalSpent / Math.max(1, payments.filter(p => p.status === 'PAID').length)
        }
      }
    });

  } catch (error) {
    logger.error('Payment analytics error:', error);
    res.status(500).json({ error: 'Failed to get payment analytics' });
  }
});

// Process refund (enhanced)
router.post('/refund/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;

    const payment = await prisma.paymentTransaction.findFirst({
      where: {
        id: paymentId,
        patientId: req.user?.id
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'PAID') {
      return res.status(400).json({ error: 'Only paid transactions can be refunded' });
    }

    // Check if refund is within allowed timeframe (e.g., 24 hours)
    const paymentTime = new Date(payment.completedAt!);
    const now = new Date();
    const hoursSincePayment = (now.getTime() - paymentTime.getTime()) / (1000 * 60 * 60);

    if (hoursSincePayment > 24) {
      return res.status(400).json({ error: 'Refund requests must be within 24 hours of payment' });
    }

    const success = await paymentService.refundPayment(paymentId, amount || payment.amount);

    if (success) {
      // Update payment status to refunded
      const refundAmount = amount || payment.amount;

      const updatedPayment = await prisma.paymentTransaction.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
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
        data: { paymentStatus: 'REFUNDED' }
      });

      res.json({
        success: true,
        message: `Refund processed successfully`
      });
    } else {
      res.status(400).json({ error: 'Refund processing failed' });
    }

  } catch (error) {
    logger.error('Refund processing error:', error);
    res.status(500).json({ error: 'Refund processing failed' });
  }
});

// Generate payment link
router.post('/generate-link', authenticateToken, async (req, res) => {
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
      success: true,
      data: { paymentLink }
    });

  } catch (error) {
    logger.error('Payment link generation error:', error);
    res.status(500).json({ error: 'Failed to generate payment link' });
  }
});

// Get payment status
router.get('/status/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const paymentStatus = await paymentService.getPaymentStatus(paymentId);

    if (!paymentStatus) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      success: true,
      data: paymentStatus
    });

  } catch (error) {
    logger.error('Payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
});

// Webhook for payment events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

  const payment = await prisma.paymentTransaction.findFirst({
    where: { gatewayTransactionId: transactionId }
  });

  if (payment) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        completedAt: new Date(),
        gatewayResponse: data
      }
    });

    // Update appointment payment status
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { paymentStatus: 'PAID' }
    });

    logger.info(`Payment ${transactionId} marked as successful`);
  }
}

async function handlePaymentFailure(data: any) {
  const { transactionId } = data;

  const payment = await prisma.paymentTransaction.findFirst({
    where: { gatewayTransactionId: transactionId }
  });

  if (payment) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        gatewayResponse: data
      }
    });

    logger.info(`Payment ${transactionId} marked as failed`);
  }
}

export default router;
