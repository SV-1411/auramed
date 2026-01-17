import express, { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getDatabase } from '../config/database';
import { createError } from '../middleware/errorHandler';

const router = express.Router();

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

function isLocation(loc: any): loc is { latitude: number; longitude: number } {
  return !!loc && typeof loc === 'object' && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
}

router.get('/products', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, requiresPrescription } = req.query;

    const db = getDatabase();
    const productDelegate = (db as any).medicineProduct;
    const inventoryDelegate = (db as any).pharmacyInventoryItem;
    const pharmacyDelegate = (db as any).pharmacyStore;

    const where: any = { isActive: true };
    if (category) where.category = String(category);
    if (requiresPrescription !== undefined) where.requiresPrescription = String(requiresPrescription) === 'true';
    if (search) {
      const s = String(search);
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { brand: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } }
      ];
    }

    const products = await productDelegate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200
    });

    const pharmacies = await pharmacyDelegate.findMany({ where: { isActive: true } });
    const pharmacyById = new Map(pharmacies.map((p: any) => [p.id, p]));

    const inventory = await inventoryDelegate.findMany({
      where: {
        stock: { gt: 0 },
        pharmacyId: { in: pharmacies.map((p: any) => p.id) }
      }
    });

    const availabilityByProductId = new Map<string, { minEta: number; totalStock: number }>();
    for (const inv of inventory) {
      const curr = availabilityByProductId.get(inv.productId) || { minEta: 9999, totalStock: 0 };
      availabilityByProductId.set(inv.productId, {
        minEta: Math.min(curr.minEta, inv.etaMinutes || 10),
        totalStock: curr.totalStock + (inv.stock || 0)
      });
    }

    res.json({
      status: 'success',
      data: {
        products: products.map((p: any) => {
          const a = availabilityByProductId.get(p.id);
          return {
            ...p,
            availability: a ? { inStock: a.totalStock > 0, totalStock: a.totalStock, minEtaMinutes: a.minEta } : { inStock: false, totalStock: 0, minEtaMinutes: null }
          };
        })
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/my', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const db = getDatabase();
    const orderDelegate = (db as any).medicineOrder;

    const orders = await orderDelegate.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { items: true, pharmacy: true }
    });

    res.json({ status: 'success', data: { orders } });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:orderId', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId as string;
    const role = (req as any).user.role as string;
    const { orderId } = req.params;

    const db = getDatabase();
    const orderDelegate = (db as any).medicineOrder;

    const order = await orderDelegate.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } }, pharmacy: true }
    });
    if (!order) throw createError('Order not found', 404);

    if (role === 'PATIENT' && order.patientId !== userId) {
      throw createError('Forbidden', 403);
    }

    res.json({ status: 'success', data: { order } });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/orders',
  authenticateToken,
  requireRole('PATIENT'),
  [
    body('items').isArray({ min: 1 }),
    body('items.*.productId').isString(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('deliveryLocation').custom(isLocation).withMessage('deliveryLocation {latitude, longitude} is required'),
    body('deliveryAddress').notEmpty()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patientId = (req as any).user.userId as string;
      const { items, deliveryLocation, deliveryAddress } = req.body as {
        items: { productId: string; quantity: number }[];
        deliveryLocation: { latitude: number; longitude: number };
        deliveryAddress: any;
      };

      const db = getDatabase();
      const pharmacyDelegate = (db as any).pharmacyStore;
      const inventoryDelegate = (db as any).pharmacyInventoryItem;
      const productDelegate = (db as any).medicineProduct;
      const orderDelegate = (db as any).medicineOrder;
      const orderItemDelegate = (db as any).medicineOrderItem;

      const pharmacies = await pharmacyDelegate.findMany({ where: { isActive: true } });
      if (!pharmacies.length) throw createError('No pharmacies available', 400);

      const productIds = items.map((i) => i.productId);
      const products = await productDelegate.findMany({ where: { id: { in: productIds }, isActive: true } });
      const productById = new Map(products.map((p: any) => [p.id, p]));

      for (const it of items) {
        if (!productById.has(it.productId)) {
          throw createError('Invalid product in cart', 400);
        }
      }

      const inventory = await inventoryDelegate.findMany({
        where: {
          pharmacyId: { in: pharmacies.map((p: any) => p.id) },
          productId: { in: productIds }
        }
      });

      const invByPharmacy = new Map<string, any[]>();
      for (const inv of inventory) {
        invByPharmacy.set(inv.pharmacyId, [...(invByPharmacy.get(inv.pharmacyId) || []), inv]);
      }

      let chosen: any | null = null;
      let bestDistance = Infinity;
      let chosenEta = 10;

      for (const ph of pharmacies) {
        const invs = invByPharmacy.get(ph.id) || [];
        const invByProduct = new Map(invs.map((x: any) => [x.productId, x]));

        let ok = true;
        let eta = 0;
        for (const it of items) {
          const inv = invByProduct.get(it.productId);
          if (!inv || (inv.stock || 0) < it.quantity) {
            ok = false;
            break;
          }
          eta = Math.max(eta, inv.etaMinutes || 10);
        }
        if (!ok) continue;

        const phLoc = ph.location as any;
        const distanceKm = isLocation(phLoc)
          ? haversineKm({ latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude }, { latitude: phLoc.latitude, longitude: phLoc.longitude })
          : 9999;

        if (distanceKm < bestDistance) {
          bestDistance = distanceKm;
          chosen = ph;
          chosenEta = Math.max(10, Math.round(eta + Math.min(15, distanceKm * 2)));
        }
      }

      if (!chosen) {
        throw createError('No nearby pharmacy has all items in stock', 400);
      }

      // Decrement stock per item
      for (const it of items) {
        const updated = await inventoryDelegate.updateMany({
          where: {
            pharmacyId: chosen.id,
            productId: it.productId,
            stock: { gte: it.quantity }
          },
          data: {
            stock: { decrement: it.quantity }
          }
        });
        if (!updated || updated.count !== 1) {
          throw createError('Stock changed. Please try again.', 409);
        }
      }

      const totalAmount = items.reduce((sum, it) => {
        const p = productById.get(it.productId);
        return sum + (p.price || 0) * it.quantity;
      }, 0);

      const order = await orderDelegate.create({
        data: {
          patientId,
          pharmacyId: chosen.id,
          status: 'PENDING',
          totalAmount,
          etaMinutes: chosenEta,
          deliveryAddress,
          deliveryLocation
        }
      });

      const orderItems = [];
      for (const it of items) {
        const p = productById.get(it.productId);
        orderItems.push(
          await orderItemDelegate.create({
            data: {
              orderId: order.id,
              productId: it.productId,
              name: p.name,
              quantity: it.quantity,
              unitPrice: p.price
            }
          })
        );
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`user-${patientId}`).emit('medicine-order:created', { orderId: order.id });
      }

      res.status(201).json({ status: 'success', data: { order: { ...order, items: orderItems } } });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/orders/:orderId/cancel', authenticateToken, requireRole('PATIENT'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = (req as any).user.userId as string;
    const { orderId } = req.params;

    const db = getDatabase();
    const orderDelegate = (db as any).medicineOrder;

    const order = await orderDelegate.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw createError('Order not found', 404);
    if (order.patientId !== patientId) throw createError('Forbidden', 403);

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      throw createError('Order cannot be cancelled at this stage', 400);
    }

    const updated = await orderDelegate.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });

    const io = req.app.get('io');
    if (io) {
      io.to(`user-${patientId}`).emit('medicine-order:updated', { orderId: updated.id, status: updated.status });
    }

    res.json({ status: 'success', data: { order: updated } });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/orders/:orderId/status',
  authenticateToken,
  requireRole('ADMIN'),
  [body('status').isString()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { orderId } = req.params;
      const { status } = req.body as { status: string };

      const db = getDatabase();
      const orderDelegate = (db as any).medicineOrder;

      const order = await orderDelegate.findUnique({ where: { id: orderId } });
      if (!order) throw createError('Order not found', 404);

      const updated = await orderDelegate.update({ where: { id: orderId }, data: { status } });

      const io = req.app.get('io');
      if (io) {
        io.to(`user-${order.patientId}`).emit('medicine-order:updated', { orderId: updated.id, status: updated.status, etaMinutes: updated.etaMinutes });
      }

      res.json({ status: 'success', data: { order: updated } });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/admin/seed', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const pharmacyDelegate = (db as any).pharmacyStore;
    const productDelegate = (db as any).medicineProduct;
    const inventoryDelegate = (db as any).pharmacyInventoryItem;

    const existing = await pharmacyDelegate.findMany({ take: 1 });
    if (existing.length === 0) {
      await pharmacyDelegate.create({
        data: {
          name: 'AuraMed Pharmacy Central',
          isActive: true,
          location: { latitude: 28.6139, longitude: 77.2090, address: 'Central Hub' }
        }
      });
    }

    const pharmacy = (await pharmacyDelegate.findMany({ take: 1 }))[0];

    const seedProducts = [
      { name: 'Paracetamol 500mg', brand: 'Generic', category: 'Fever & Pain', price: 49, mrp: 60, requiresPrescription: false, tags: ['fever', 'pain'] },
      { name: 'Cetirizine 10mg', brand: 'Generic', category: 'Allergy', price: 35, mrp: 45, requiresPrescription: false, tags: ['allergy'] },
      { name: 'ORS Sachet', brand: 'WHO', category: 'Digestive', price: 25, mrp: 30, requiresPrescription: false, tags: ['dehydration'] },
      { name: 'Amoxicillin 500mg', brand: 'Generic', category: 'Antibiotic', price: 120, mrp: 140, requiresPrescription: true, tags: ['infection'] }
    ];

    const createdProducts: any[] = [];
    for (const p of seedProducts) {
      const exists = await productDelegate.findFirst({ where: { name: p.name } });
      if (exists) {
        createdProducts.push(exists);
        continue;
      }
      createdProducts.push(await productDelegate.create({ data: { ...p, isActive: true } }));
    }

    for (const p of createdProducts) {
      await inventoryDelegate.upsert({
        where: { pharmacyId_productId: { pharmacyId: pharmacy.id, productId: p.id } },
        update: { stock: 100, etaMinutes: 10 },
        create: { pharmacyId: pharmacy.id, productId: p.id, stock: 100, etaMinutes: 10 }
      });
    }

    res.json({ status: 'success', data: { pharmacyId: pharmacy.id, products: createdProducts.length } });
  } catch (err) {
    next(err);
  }
});

export default router;
