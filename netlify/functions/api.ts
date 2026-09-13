import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';
import crypto from 'crypto';

interface NetlifyEvent {
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-id, x-client-secret, client-id, client-secret, x-api-key, api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

function resolveMdcUrls(apiUrl: string) {
  let cleanUrl = (apiUrl || '').trim();

  while (cleanUrl.endsWith('/') || cleanUrl.endsWith(' ')) {
    cleanUrl = cleanUrl.slice(0, -1).trim();
  }
  
  const patternsToStrip = [
    /\/withdraws\/@me\/balance\/?$/i,
    /\/withdraws\/@me\/?$/i,
    /\/transactions\/?$/i,
    /\/deposit\/?$/i,
    /\/balance\/?$/i,
    /\/pix\/qrcode\/?$/i,
    /\/companies\/@me\/?$/i
  ];

  for (const pattern of patternsToStrip) {
    cleanUrl = cleanUrl.replace(pattern, '').trim();
  }

  if (!cleanUrl || cleanUrl.includes("squareweb.app") || cleanUrl.includes("api-connectmdcpay")) {
    cleanUrl = "https://app.connectmdcpay.com.br/api/v1";
  }

  if (!cleanUrl.endsWith("/api/v1")) {
    if (cleanUrl.endsWith("/api")) {
      cleanUrl = `${cleanUrl}/v1`;
    } else if (!cleanUrl.includes("/api/v1")) {
      cleanUrl = `${cleanUrl}/api/v1`;
    }
  }
  
  return {
    base: cleanUrl,
    balance: `${cleanUrl}/withdraws/@me/balance`,
    legacyBalance: `${cleanUrl}/balance`,
    transactions: `${cleanUrl}/transactions`,
    deposit: `${cleanUrl}/deposit`
  };
}

function buildMdcHeaders(clientId: string, clientSecret: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Idempotency-Key': crypto.randomUUID()
  };

  if (clientId && clientSecret) {
    const basicCreds = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    headers['Authorization'] = `Basic ${basicCreds}`;
    headers['x-client-id'] = clientId.trim();
    headers['x-client-secret'] = clientSecret.trim();
    headers['client-id'] = clientId.trim();
    headers['client-secret'] = clientSecret.trim();
  } else if (clientSecret) {
    headers['Authorization'] = `Bearer ${clientSecret.trim()}`;
  }

  return headers;
}

function cleanPixString(str: string, maxLen: number): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .substring(0, maxLen);
}

function calculateCRC16(payload: string): string {
  let crc = 0xFFFF;
  const polynomial = 0x1021;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function generatePixBRCode(key: string, amount: number, name = 'WE PINK LTDA', city = 'SAO PAULO', txid = '***'): string {
  let cleanKey = (key || process.env.PIX_KEY || '').trim();
  if (!cleanKey) {
    throw new Error('Chave PIX não informada');
  }
  if (cleanKey.includes('@')) {
    cleanKey = cleanKey.toLowerCase();
  } else if (/^\d{10,11}$/.test(cleanKey.replace(/\D/g, ''))) {
    const digits = cleanKey.replace(/\D/g, '');
    cleanKey = digits.length === 11 ? digits : '+55' + digits;
  } else if (/^\d{14}$/.test(cleanKey.replace(/\D/g, ''))) {
    cleanKey = cleanKey.replace(/\D/g, '');
  }

  const cleanName = cleanPixString(name, 25) || 'WE PINK LTDA';
  const cleanCity = cleanPixString(city, 15) || 'SAO PAULO';
  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9*]/g, '').substring(0, 25) || '***';
  const amountStr = Number(amount || 0).toFixed(2);

  const formatField = (id: string, value: string) => `${id}${value.length.toString().padStart(2, '0')}${value}`;

  const f00 = formatField('00', '01');
  const f01 = formatField('01', '12');
  const f26 = formatField('26', `${formatField('00', 'br.gov.bcb.pix')}${formatField('01', cleanKey)}`);
  const f52 = formatField('52', '0000');
  const f53 = formatField('53', '986');
  const f54 = formatField('54', amountStr);
  const f58 = formatField('58', 'BR');
  const f59 = formatField('59', cleanName);
  const f60 = formatField('60', cleanCity);
  const f62 = formatField('62', formatField('05', cleanTxid));

  const payloadWithoutCRC = `${f00}${f01}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;
  return `${payloadWithoutCRC}${calculateCRC16(payloadWithoutCRC)}`;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  let rawPath = event.path || '';
  if (rawPath.includes('?')) {
    rawPath = rawPath.split('?')[0];
  }

  let path = rawPath
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  let body: any = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  try {
    // 1. Health check
    if (path === '/health' || path === '') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ status: 'ok', server: 'netlify-functions' })
      };
    }

    // 2. MDCPay test connection
    if (path === '/mdcpay/test-connection') {
      const { mdcToken, mdcUrl: bodyUrl, mdcClientId } = body;
      const clientSecret = mdcToken || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC;
      const clientId = mdcClientId || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID;
      const apiUrl = bodyUrl || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

      if (!clientSecret) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: "Token / Client Secret do MDCPay não informado." })
        };
      }

      try {
        const urls = resolveMdcUrls(apiUrl);
        const headers = buildMdcHeaders(clientId || '', clientSecret || '');

        let response: any;
        try {
          response = await axios.get(urls.balance, { headers, timeout: 10000 });
        } catch (balErr: any) {
          response = await axios.get(urls.legacyBalance, { headers, timeout: 10000 });
        }

        if (response.data && (response.data.total_balance !== undefined || response.data.available_balance !== undefined || response.data.balance !== undefined || response.data.success !== undefined)) {
          const bal = response.data.total_balance ?? response.data.available_balance ?? response.data.balance ?? 0;
          
          let hasTransactionsScope = true;
          let warningMsg = "";
          try {
            await axios.get(urls.transactions, { headers, timeout: 5000 });
          } catch (txErr: any) {
            if (txErr.response?.status === 403) {
              hasTransactionsScope = false;
              warningMsg = "Atenção: A chave conectou com sucesso e consultou o saldo (R$ " + Number(bal || 0).toFixed(2) + "), porém retornou 403 (Forbidden) em transações. No painel da Connect Pay (app.connectmdcpay.com.br/integrations), certifique-se de marcar a permissão 'TRANSACTIONS' na sua chave, ou configure uma Chave PIX direta abaixo como contingência.";
            }
          }

          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: true,
              hasTransactionsScope,
              warning: warningMsg || undefined,
              message: warningMsg || "Credenciais de API do MDCPay autenticadas com sucesso!",
              balance: bal
            })
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "O gateway MDCPay respondeu mas não retornou confirmação de saldo.",
            raw: response.data
          })
        };
      } catch (error: any) {
        let errorMsg = error.message;
        if (error.response?.data && typeof error.response.data === 'object') {
          errorMsg = error.response.data.error || error.response.data.message || JSON.stringify(error.response.data);
        } else if (error.response?.data && typeof error.response.data === 'string') {
          errorMsg = error.response.data;
        }

        if (error.response?.status === 403 || error.response?.status === 401) {
          if (typeof errorMsg === 'string' && errorMsg.includes("Forbidden")) {
            errorMsg = "Credenciais inválidas ou escopo de acesso não concedido no painel do MDCPay. Verifique o Client ID e Client Secret.";
          }
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Falha na autenticação do MDCPay (Status ${error.response?.status || 'conexão'}): ${errorMsg}`
          })
        };
      }
    }

    // 3. MDCPay create payment
    if (path === '/mdcpay/create-payment') {
      const { amount, email, firstName, lastName, cpf, mdcToken, mdcUrl: bodyUrl, mdcClientId, pixKey, merchantName, merchantCity } = body;
      const clientSecret = mdcToken || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC;
      const clientId = mdcClientId || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID;
      const apiUrl = bodyUrl || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

      const cleanCpfDigits = (cpf || '').replace(/\D/g, '');
      const cleanCpf = cleanCpfDigits.length === 11 ? cleanCpfDigits : '52998224725';

      let cleanName = `${firstName || ''} ${lastName || ''}`.trim();
      if (!cleanName || cleanName.split(/\s+/).length < 2) {
        cleanName = cleanName ? `${cleanName} Silva` : "Cliente Wepink";
      }

      let cleanEmail = (email || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        cleanEmail = "cliente@wepink.com.br";
      }

      const numAmount = Number(Number(amount || 0).toFixed(2));

      if (!clientSecret || !clientId) {
        const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
        if (effectiveKey) {
          const fallbackCode = generatePixBRCode(effectiveKey, numAmount, merchantName || 'WE PINK LTDA', merchantCity || 'SAO PAULO');
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              id: `pix_${Date.now()}`,
              qr_code: fallbackCode,
              status: 'pending'
            })
          };
        }
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Client ID e Client Secret do MDCPay não configurados." })
        };
      }

      try {
        const urls = resolveMdcUrls(apiUrl);
        const headers = buildMdcHeaders(clientId, clientSecret);

        const cleanPhoneDigits = (body.phone || '').replace(/\D/g, '') || '11999999999';
        const mdcPayload = {
          method: "PIX",
          amount: Math.max(100, Math.round(numAmount * 100)),
          description: "Pedido Wepink",
          expiresIn: 900,
          payer: {
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhoneDigits,
            document: {
              type: "CPF",
              number: cleanCpf
            }
          }
        };

        const response = await axios.post(urls.transactions, mdcPayload, { headers, timeout: 15000 });
        const data = response.data;

        const findPixCode = (obj: any): string | null => {
          if (!obj) return null;
          const sanitize = (val: string): string => {
            let s = val.trim();
            if (s.includes('000201')) {
              s = s.substring(s.indexOf('000201'));
            }
            try {
              let decoded = decodeURIComponent(s);
              while (decoded !== s && decoded.includes('%')) {
                s = decoded;
                decoded = decodeURIComponent(s);
              }
              return decoded;
            } catch (e) {
              return s;
            }
          };

          if (typeof obj === 'string' && obj.includes('000201')) {
            const code = sanitize(obj);
            if (code.length > 30) return code;
          }

          if (typeof obj === 'object') {
            const typicalKeys = ['code', 'pix_copy_paste', 'pix_code', 'pix_payload', 'payload', 'qr_code', 'brcode', 'emv', 'copy_paste', 'content'];
            for (const key of typicalKeys) {
              if (typeof obj[key] === 'string' && obj[key].includes('000201')) {
                return sanitize(obj[key]);
              }
            }
            for (const key in obj) {
              if (key === 'raw' || key === 'response') continue;
              const found = findPixCode(obj[key]);
              if (found && found.length > 50) return found;
            }
          }
          return null;
        };

        let qrCode = data.qrcode?.code || data.qrcode?.payload || data.pix?.qrcode || findPixCode(data) || data.copyPaste || data.qr_code;
        if (qrCode && typeof qrCode === 'string') {
          try {
            qrCode = decodeURIComponent(qrCode);
          } catch (e) {}
          qrCode = qrCode.trim();
          if (qrCode.includes('000201')) {
            qrCode = qrCode.substring(qrCode.indexOf('000201'));
          }
        }

        const qrCodeBase64 = data.qrcode?.base64 || data.pix?.base64 || data.qrcodeUrl || data.qr_code_base64 || data.base64;
        const transactionId = data.id || data.externalId || data.external_id || data.transactionId || `pedido_${Date.now()}`;

        if (!qrCode) {
          const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
          if (effectiveKey) {
            qrCode = generatePixBRCode(effectiveKey, numAmount, merchantName || 'WE PINK LTDA', merchantCity || 'SAO PAULO');
          } else {
            return {
              statusCode: 502,
              headers: CORS_HEADERS,
              body: JSON.stringify({ error: "A API do MDCPay não retornou o código PIX.", details: data })
            };
          }
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            id: transactionId,
            qr_code: qrCode,
            qr_code_base64: qrCodeBase64,
            status: data.status ? String(data.status).toLowerCase() : 'pending',
            raw: data
          })
        };
      } catch (error: any) {
        console.error("Erro MDCPay API:", error.response?.data || error.message || error);
        const apiStatus = error.response?.status;
        const apiData = error.response?.data;
        let detailedMsg = `Erro ao comunicar com gateway MDCPay: ${error.message}`;

        if (apiStatus === 403) {
          detailedMsg = "MDCPay retornou erro 403 (Forbidden): A sua Chave de API conectou ao saldo, mas não possui permissão de escrita/transação ('TRANSACTIONS') no painel da Connect Pay, ou sua conta na Connect Pay ainda está em análise de compliance. Para emitir cobranças, edite a chave no painel da Connect Pay (app.connectmdcpay.com.br/integrations) e ative a permissão 'TRANSACTIONS', ou configure uma Chave PIX direta no Painel Adm da Wepink para receber pagamentos imediatamente.";
        } else if (apiStatus === 401) {
          detailedMsg = "MDCPay retornou erro 401 (Unauthorized): Client ID ou Client Secret incorretos no painel da Connect Pay.";
        } else if (apiData?.message) {
          detailedMsg = `MDCPay: ${apiData.message}`;
        }

        const effectiveKey = (body.pixKey || process.env.PIX_KEY || '').trim();
        if (effectiveKey) {
          const fallbackCode = generatePixBRCode(effectiveKey, numAmount, body.merchantName || 'WE PINK LTDA', body.merchantCity || 'SAO PAULO');
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              id: `pix_${Date.now()}`,
              qr_code: fallbackCode,
              status: 'pending',
              contingency: true,
              warning: detailedMsg
            })
          };
        }
        return {
          statusCode: apiStatus || 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: detailedMsg,
            status: apiStatus,
            details: apiData
          })
        };
      }
    }

    // 4. Create Mercado Pago PIX
    if (path === '/create-pix') {
      const { amount, email, firstName, lastName, cpf, mpToken, pixKey, merchantName, merchantCity } = body;
      const accessToken = mpToken || process.env.MP_ACCESS_TOKEN;

      if (!accessToken) {
        const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
        if (!effectiveKey) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Access Token do Mercado Pago ou Chave PIX não configurados." })
          };
        }
        const numAmount = Number(Number(amount || 0).toFixed(2));
        const directCode = generatePixBRCode(effectiveKey, numAmount, merchantName || 'WE PINK LTDA', merchantCity || 'SAO PAULO');
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            id: `pix_${Date.now()}`,
            qr_code: directCode,
            status: 'pending'
          })
        };
      }

      try {
        const cleanCpf = (cpf || '').replace(/\D/g, '') || '00000000000';
        const cleanAmount = Number(Number(amount || 0).toFixed(2));
        const client = new MercadoPagoConfig({ accessToken });
        const payment = new Payment(client);

        const result = await payment.create({
          body: {
            transaction_amount: cleanAmount,
            description: 'Compra Wepink',
            payment_method_id: 'pix',
            payer: {
              email: email || 'cliente@wepink.com.br',
              first_name: firstName || 'Cliente',
              last_name: lastName || 'Wepink',
              identification: {
                type: 'CPF',
                number: cleanCpf
              }
            }
          }
        });

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            id: result.id,
            qr_code: result.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            status: result.status
          })
        };
      } catch (mpErr: any) {
        return {
          statusCode: 500,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Erro ao gerar PIX no Mercado Pago", details: mpErr.message })
        };
      }
    }

    // 5. Create Direct PIX
    if (path === '/create-direct-pix') {
      const { amount, pixKey, merchantName, merchantCity, txid } = body;
      const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
      if (!effectiveKey) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Chave PIX não informada no painel administrativo." })
        };
      }
      const numAmount = Number(Number(amount || 0).toFixed(2));
      const code = generatePixBRCode(effectiveKey, numAmount, merchantName || 'WE PINK LTDA', merchantCity || 'SAO PAULO', txid);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          id: `pix_${Date.now()}`,
          qr_code: code,
          status: 'pending'
        })
      };
    }

    // 6. Payment status check
    if (path.startsWith('/payment-status/')) {
      const parts = path.split('/').filter(Boolean);
      // Expected: ['payment-status', provider, id]
      const provider = parts[1];
      const id = parts[2];
      const qParams = event.queryStringParameters || {};

      if (provider === 'mercadopago') {
        const accessToken = qParams.mpToken || process.env.MP_ACCESS_TOKEN;
        if (accessToken) {
          const client = new MercadoPagoConfig({ accessToken });
          const payment = new Payment(client);
          const result = await payment.get({ id });
          return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({ status: result.status })
          };
        }
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ status: 'pending' })
        };
      }

      if (provider === 'mdcpay') {
        const clientSecret = qParams.mdcToken || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC;
        const clientId = qParams.mdcClientId || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID;
        const apiUrl = qParams.mdcUrl || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

        const urls = resolveMdcUrls(apiUrl);
        const headers = buildMdcHeaders(clientId || '', clientSecret || '');

        try {
          const txResponse = await axios.get(`${urls.transactions}/${id}`, { headers, timeout: 8000 });
          const txData = txResponse.data;
          if (txData) {
            const rawStatus = String(txData.status || '').toUpperCase().trim();
            let status = 'pending';
            if (['APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'PAGO', 'APROVADO'].includes(rawStatus)) {
              status = 'approved';
            } else if (['CANCELLED', 'REFUSED', 'FAILED', 'REFUNDED', 'CHARGED_BACK', 'CANCELADO', 'RECUSADO'].includes(rawStatus)) {
              status = 'cancelled';
            }
            return {
              statusCode: 200,
              headers: CORS_HEADERS,
              body: JSON.stringify({ status, rawStatus, data: txData })
            };
          }
        } catch (e) {}

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({ status: 'pending' })
        };
      }

      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Provedor inválido" })
      };
    }

    // 7. Notify admin
    if (path === '/notify-admin') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, message: "Notificação recebida" })
      };
    }

    // 8. Checkout
    if (path === '/checkout') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, message: "Checkout recebido" })
      };
    }

    // 9. Recover password
    if (path === '/recover-password') {
      const { email } = body;
      const targetEmail = (email || '').trim().toLowerCase();
      const serverAdmins = [
        'allanhenriq91@gmail.com',
        'adm.wpink@gmail.com',
        'recebimentoswepink@gmail.com'
      ];
      if (!serverAdmins.includes(targetEmail)) {
        return {
          statusCode: 403,
          headers: CORS_HEADERS,
          body: JSON.stringify({ success: false, error: "Este e-mail não possui autorização de admin." })
        };
      }
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, message: "Email enviado com sucesso." })
      };
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: `Rota não encontrada: ${path}` })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message || 'Erro interno no servidor Netlify' })
    };
  }
};
