/**
 * Utilitário oficial para geração de BRCode PIX (Padrão Banco Central do Brasil - EMV)
 * Compatível com todos os aplicativos bancários (Nubank, Itaú, Bradesco, Inter, Caixa, Santander, etc.)
 */

export function cleanPixString(str: string, maxLen: number): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '') // apenas alfanuméricos e espaços
    .trim()
    .toUpperCase()
    .substring(0, maxLen);
}

export function formatPixKey(key: string, keyType?: string): string {
  let clean = (key || '').trim();
  if (!clean) return '';

  const type = keyType || (
    clean.includes('@') ? 'email' :
    /^\d{11}$/.test(clean.replace(/\D/g, '')) ? 'cpf' :
    /^\d{14}$/.test(clean.replace(/\D/g, '')) ? 'cnpj' :
    /^\+?[0-9]{10,13}$/.test(clean.replace(/[\s()-]/g, '')) ? 'phone' : 'random'
  );

  if (type === 'email') {
    return clean.toLowerCase();
  }

  if (type === 'cpf') {
    return clean.replace(/\D/g, '');
  }

  if (type === 'cnpj') {
    return clean.replace(/\D/g, '');
  }

  if (type === 'phone') {
    let digits = clean.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }
    return '+' + digits;
  }

  return clean;
}

export function calculateCRC16(payload: string): string {
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

export interface PixBRCodeOptions {
  key: string;
  keyType?: string;
  amount: number;
  name?: string;
  city?: string;
  txid?: string;
}

export function generatePixBRCode(options: PixBRCodeOptions): string {
  const {
    key,
    keyType,
    amount,
    name = 'WE PINK LTDA',
    city = 'SAO PAULO',
    txid = '***'
  } = options;

  const formattedKey = formatPixKey(key, keyType);
  if (!formattedKey) {
    throw new Error('Chave PIX inválida ou vazia');
  }

  const cleanName = cleanPixString(name, 25) || 'WE PINK LTDA';
  const cleanCity = cleanPixString(city, 15) || 'SAO PAULO';
  const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9*]/g, '').substring(0, 25) || '***';
  const amountStr = Number(amount || 0).toFixed(2);

  function formatField(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  // 00: Payload Format Indicator
  const f00 = formatField('00', '01');

  // 01: Point of Initiation Method (12 = reutilizável / estático com valor)
  const f01 = formatField('01', '12');

  // 26: Merchant Account Information - PIX
  const sub00 = formatField('00', 'br.gov.bcb.pix');
  const sub01 = formatField('01', formattedKey);
  const f26 = formatField('26', `${sub00}${sub01}`);

  // 52: Merchant Category Code (0000 = Padrão ISO 18245)
  const f52 = formatField('52', '0000');

  // 53: Transaction Currency (986 = Real Brasileiro)
  const f53 = formatField('53', '986');

  // 54: Transaction Amount
  const f54 = formatField('54', amountStr);

  // 58: Country Code (BR)
  const f58 = formatField('58', 'BR');

  // 59: Merchant Name
  const f59 = formatField('59', cleanName);

  // 60: Merchant City
  const f60 = formatField('60', cleanCity);

  // 62: Additional Data Field Template (TxID)
  const sub05 = formatField('05', cleanTxid);
  const f62 = formatField('62', sub05);

  // Payload base para o cálculo do CRC16
  const payloadWithoutCRC = `${f00}${f01}${f26}${f52}${f53}${f54}${f58}${f59}${f60}${f62}6304`;

  const crc = calculateCRC16(payloadWithoutCRC);
  return `${payloadWithoutCRC}${crc}`;
}
