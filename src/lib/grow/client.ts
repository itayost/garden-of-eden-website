/**
 * GROW (Meshulam) Payment Gateway Client
 * API Documentation: https://grow-il.readme.io/
 */

// Environment variables
const GROW_API_URL = process.env.GROW_API_URL || 'https://sandbox.meshulam.co.il/api/light/server/1.0';
const GROW_USER_ID = process.env.GROW_USER_ID;
const GROW_PAGE_CODE_ONE_TIME = process.env.GROW_PAGE_CODE; // Regular credit card payments
const GROW_PAGE_CODE_RECURRING = process.env.GROW_PAGE_CODE_RECURRING; // Direct debit (הוראת קבע)

// Timeout and retry configuration
const FETCH_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Types
export interface CreatePaymentRequest {
  sum: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  fullName: string;
  phone: string;
  email?: string;
  paymentNum?: number;
  maxPaymentNum?: number;
  cField1?: string; // Custom field for user_id
  cField2?: string; // Custom field for payment type
  notifyUrl?: string;
  isRecurring?: boolean; // If true, use recurring (הוראת קבע) page code
}

export interface CreatePaymentResponse {
  status: 0 | 1;
  err: string | { id: number; message: string };
  data: {
    processId: string;
    processToken: string;
    url: string;
  } | '';
}

export interface WebhookPayload {
  err: string;
  status: string;
  data: {
    asmachta: string;
    cardSuffix: string;
    cardType: string;
    cardTypeCode: string;
    cardBrand: string;
    cardBrandCode: string;
    cardExp: string;
    firstPaymentSum: string;
    periodicalPaymentSum: string;
    status: string;
    statusCode: string;
    transactionTypeId: string;
    paymentType: string;
    sum: string;
    paymentsNum: string;
    allPaymentsNum: string;
    paymentDate: string;
    description: string;
    fullName: string;
    payerPhone: string;
    payerEmail: string;
    transactionId: string;
    transactionToken: string;
    processId: string;
    processToken: string;
    payerBankAccountDetails: string;
    customFields: {
      cField1?: string;
      cField2?: string;
      [key: string]: string | undefined;
    };
  };
}

export interface ApproveTransactionRequest {
  transactionId: string;
  transactionToken: string;
  transactionTypeId: string;
  paymentType: string;
  sum: string;
  firstPaymentSum: string;
  periodicalPaymentSum: string;
  paymentsNum: string;
  allPaymentsNum: string;
  paymentDate: string;
  asmachta: string;
  description: string;
  fullName: string;
  payerPhone: string;
  payerEmail: string;
  cardSuffix: string;
  cardType: string;
  cardTypeCode: string;
  cardBrand: string;
  cardBrandCode: string;
  cardExp: string;
  processId: string;
  processToken: string;
}

export interface ApproveTransactionResponse {
  status: 0 | 1;
  err: string | { id: number; message: string };
  data: unknown;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry logic and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[GROW] Attempt ${attempt + 1}/${maxRetries} to ${url}`);
      const response = await fetchWithTimeout(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      console.error(`[GROW] Attempt ${attempt + 1} failed:`, error);

      // Don't retry on abort (user cancelled) or if it's the last attempt
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[GROW] Request timed out on attempt ${attempt + 1}`);
      }

      if (attempt < maxRetries - 1) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        console.log(`[GROW] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Creates a payment process and returns the payment URL
 */
export async function createPaymentProcess(
  request: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  // Select correct page code based on payment type
  const pageCode = request.isRecurring ? GROW_PAGE_CODE_RECURRING : GROW_PAGE_CODE_ONE_TIME;

  if (!GROW_USER_ID || !pageCode) {
    const missingCode = request.isRecurring ? 'GROW_PAGE_CODE_RECURRING' : 'GROW_PAGE_CODE';
    throw new Error(`GROW credentials not configured: missing ${missingCode}`);
  }

  const formData = new FormData();
  formData.append('pageCode', pageCode);
  formData.append('userId', GROW_USER_ID);
  formData.append('sum', request.sum.toString());
  formData.append('description', request.description);
  formData.append('successUrl', request.successUrl);
  formData.append('cancelUrl', request.cancelUrl);
  formData.append('pageField[fullName]', request.fullName);
  formData.append('pageField[phone]', request.phone);

  if (request.email) {
    formData.append('pageField[email]', request.email);
  }

  if (request.paymentNum) {
    formData.append('paymentNum', request.paymentNum.toString());
  }

  if (request.maxPaymentNum) {
    formData.append('maxPaymentNum', request.maxPaymentNum.toString());
  }

  if (request.cField1) {
    formData.append('cField1', request.cField1);
  }

  if (request.cField2) {
    formData.append('cField2', request.cField2);
  }

  if (request.notifyUrl) {
    formData.append('notifyUrl', request.notifyUrl);
  }

  const response = await fetchWithRetry(`${GROW_API_URL}/createPaymentProcess`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`GROW API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Approves a transaction after receiving webhook notification
 */
export async function approveTransaction(
  webhookData: WebhookPayload['data'],
  isRecurring?: boolean
): Promise<ApproveTransactionResponse> {
  // Select correct page code based on payment type
  const pageCode = isRecurring ? GROW_PAGE_CODE_RECURRING : GROW_PAGE_CODE_ONE_TIME;

  if (!pageCode) {
    throw new Error('GROW credentials not configured');
  }

  const formData = new FormData();
  formData.append('pageCode', pageCode);
  formData.append('transactionId', webhookData.transactionId);
  formData.append('transactionToken', webhookData.transactionToken);
  formData.append('transactionTypeId', webhookData.transactionTypeId);
  formData.append('paymentType', webhookData.paymentType);
  formData.append('sum', webhookData.sum);
  formData.append('firstPaymentSum', webhookData.firstPaymentSum);
  formData.append('periodicalPaymentSum', webhookData.periodicalPaymentSum);
  formData.append('paymentsNum', webhookData.paymentsNum);
  formData.append('allPaymentsNum', webhookData.allPaymentsNum);
  formData.append('paymentDate', webhookData.paymentDate);
  formData.append('asmachta', webhookData.asmachta);
  formData.append('description', webhookData.description);
  formData.append('fullName', webhookData.fullName);
  formData.append('payerPhone', webhookData.payerPhone);
  formData.append('payerEmail', webhookData.payerEmail);
  formData.append('cardSuffix', webhookData.cardSuffix);
  formData.append('cardType', webhookData.cardType);
  formData.append('cardTypeCode', webhookData.cardTypeCode);
  formData.append('cardBrand', webhookData.cardBrand);
  formData.append('cardBrandCode', webhookData.cardBrandCode);
  formData.append('cardExp', webhookData.cardExp);
  formData.append('processId', webhookData.processId);
  formData.append('processToken', webhookData.processToken);

  const response = await fetchWithRetry(`${GROW_API_URL}/approveTransaction`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`GROW API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Helper to get the base URL for webhooks based on environment
 */
export function getWebhookBaseUrl(): string {
  // In production, use the actual domain
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_SITE_URL || 'https://gardengym.co.il';
  }
  // In development/preview, use Vercel URL or fallback
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://garden-of-eden-website-six.vercel.app';
}
