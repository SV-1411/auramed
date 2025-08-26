import express from 'express';
import { PrismaClient, PaymentStatus, UserRole } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { PaymentService } from '../services/PaymentService';
import { logger } from '../utils/logger';

const router = express.Router();
const prisma = new PrismaClient();
const paymentService = new PaymentService();

// Process payment for appointment
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, amount, currency, method, paymentMethodId } = req.body;
    const userId = req.user?.id;

    // Verify appointment belongs to user
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patientId: userId
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const paymentResult = await paymentService.processPayment({
      appointmentId,
      patientId: userId!,
      amount,
      currency,
      method,
      paymentMethodId
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

// Generate payment link
router.post('/generate-link', authenticateToken, async (req, res) => {
  try {
    const { appointmentId, amount, currency } = req.body;
    const userId = req.user?.id;

    const paymentLink = await paymentService.generatePaymentLink({
      appointmentId,
      patientId: userId!,
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

// Refund payment
router.post('/refund/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;

    // Only doctors and admins can process refunds
    if (req.user?.role !== UserRole.DOCTOR && req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const success = await paymentService.refundPayment(paymentId, amount);

    if (success) {
      res.json({
        success: true,
        message: 'Refund processed successfully'
      });
    } else {
      res.status(400).json({ error: 'Refund processing failed' });
    }

  } catch (error) {
    logger.error('Refund processing error:', error);
    res.status(500).json({ error: 'Refund processing failed' });
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
        break;
      case 'payment_intent.payment_failed':
        // Handle failed payment
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

export default router;
