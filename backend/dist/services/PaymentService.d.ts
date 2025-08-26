interface PaymentRequest {
    appointmentId: string;
    patientId: string;
    amount: number;
    currency: string;
    method: 'card' | 'upi' | 'wallet' | 'deferred';
    paymentMethodId?: string;
}
interface PaymentResult {
    id: string;
    status: 'succeeded' | 'pending' | 'failed' | 'deferred';
    amount: number;
    currency: string;
    transactionId?: string;
    failureReason?: string;
}
export declare class PaymentService {
    private prisma;
    private stripe;
    constructor();
    processPayment(request: PaymentRequest): Promise<PaymentResult>;
    private createDeferredPayment;
    processRazorpayPayment(request: PaymentRequest): Promise<PaymentResult>;
    refundPayment(paymentId: string, amount?: number): Promise<boolean>;
    getPaymentStatus(paymentId: string): Promise<PaymentResult | null>;
    processDeferredPayments(): Promise<void>;
    generatePaymentLink(request: PaymentRequest): Promise<string>;
}
export {};
//# sourceMappingURL=PaymentService.d.ts.map