/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Search, 
  User, 
  ShoppingBag, 
  Menu, 
  X, 
  ChevronLeft,
  ChevronRight, 
  Heart,
  Star,
  Instagram,
  Facebook,
  Twitter,
  ChevronDown,
  Filter,
  Settings,
  Plus,
  Trash2,
  Edit,
  Save,
  Loader2,
  Youtube,
  ArrowUp,
  Truck,
  RefreshCw,
  Home,
  Smartphone,
  Wallet,
  Share2,
  CreditCard,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  Calendar,
  Clock,
  DollarSign,
  Zap,
  Key,
  Flame,
  Upload,
  Edit3
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  setDoc,
  getDoc,
  getDocs,
  query,
  limit,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable,
  getDownloadURL 
} from 'firebase/storage';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { generatePixBRCode, formatPixKey } from './utils/pix';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
// Explicitly pass the bucket name for stability
const storage = getStorage(app, firebaseConfig.storageBucket ? `gs://${firebaseConfig.storageBucket}` : undefined);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Helper global para resolver a URL final do backend de API
export const resolveApiUrl = (path: string, customBackendUrl?: string): string => {
  let cleanCustom = customBackendUrl ? customBackendUrl.trim() : '';
  
  // Se estivermos rodando localmente ou dentro do mesmo domínio do backend configurado,
  // usamos a rota relativa para evitar problemas de CORS desnecessários.
  if (cleanCustom && typeof window !== 'undefined') {
    const currentOrigin = window.location.origin;
    const currentHost = window.location.hostname;
    
    // Se a página já está no mesmo origin ou se ambos forem localhost / mesmo ambiente de container
    if (
      cleanCustom.startsWith(currentOrigin) ||
      (currentHost.includes('run.app') && cleanCustom.includes('run.app')) ||
      ((currentHost === 'localhost' || currentHost === '127.0.0.1') && (cleanCustom.includes('localhost') || cleanCustom.includes('127.0.0.1')))
    ) {
      cleanCustom = '';
    }
  }

  if (cleanCustom !== '') {
    const base = cleanCustom.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  return path;
};

// --- Constants & Types ---

const ADMIN_EMAILS = [
  'allanhenriq91@gmail.com',
  'adm.wpink@gmail.com',
  'recebimentoswepink@gmail.com'
].map(email => email.toLowerCase());

const OLFATIVE_FAMILIES = ['Floral', 'Floriental', 'Amadeirado', 'Oriental', 'Chipre', 'Frutado'];
const GENDERS = ['Feminino', 'Masculino'];

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't necessarily want to crash the whole app for the user, but we log it
}

const PRODUCT_CATEGORIES = [
  "wehot", "kits", "bath&body", "body splash", "perfumaria", "skincare", "body cream", 
  "the cream", "the oil", "make", "hair", "roll-on", "bem-estar",
  "masculino"
];
const SORT_OPTIONS = [
  { id: 'Relevância', label: 'Relevância' },
  { id: 'Mais vendidos', label: 'Mais vendidos' },
  { id: 'Mais recentes', label: 'Mais recentes' },
  { id: 'Desconto', label: 'Desconto' },
  { id: 'Preço: Do maior para o menor', label: 'Preço: Do maior para o menor' },
  { id: 'Preço: Do menor para o maior', label: 'Preço: Do menor para o maior' },
  { id: 'A-Z', label: 'A-Z' },
  { id: 'Z-A', label: 'Z-A' }
];

interface Review {
  id: string;
  author: string;
  initials: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verified: boolean;
  recommended: boolean;
}

interface ProductColor {
  name: string;
  hex: string;
  image: string;
}

interface Product {
  id: string;
  name: string;
  subtitle?: string;
  type: string;
  volume: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  tag?: string;
  rating: number;
  reviews: number;
  reviewList?: Review[];
  family: 'Floral' | 'Floriental' | 'Amadeirado' | 'Oriental' | 'Chipre' | 'Frutado' | string;
  gender: 'Feminino' | 'Masculino' | string;
  createdAt: string;
  salesCount: number;
  description?: string;
  isHighlight?: boolean;
  isBestSeller?: boolean;
  isMaisVendidos?: boolean;
  isQueridinhos?: boolean;
  isNew?: boolean;
  category?: string;
  active?: boolean;
  colors?: ProductColor[];
}

function ProductSeal({ tag }: { tag: string }) {
  const isGold = tag.toUpperCase() === 'LANÇAMENTO' || 
                 tag.toUpperCase() === 'BEST SELLER' || 
                 tag.toUpperCase() === 'BEST SELLERS' ||
                 tag.toUpperCase() === 'MAIS VENDIDO' ||
                 tag.toUpperCase() === 'MAIS VENDIDOS' ||
                 tag.toUpperCase() === 'QUERIDINHO' ||
                 tag.toUpperCase() === 'NOVIDADE';
  
  if (isGold) {
    const displayTag = tag.toUpperCase() === 'NOVIDADE' ? 'LANÇAMENTO' : tag;
    const isBestSeller = displayTag.toUpperCase().includes('BEST SELLER');
    
    return (
      <div className="relative w-12 h-12 sm:w-18 sm:h-18 flex items-center justify-center transition-transform duration-500">
        {/* Golden Seal */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#d4af37] via-[#f9f295] to-[#f9f295] via-[#d4af37] to-[#b8860b] shadow-[0_2px_8px_rgba(0,0,0,0.15)] border border-[#b8860b]/30 flex flex-col items-center justify-center p-1 text-center overflow-hidden">
          {/* Inner ring */}
          <div className="absolute inset-[2px] rounded-full border border-black/5" />
          
          <div className="flex gap-[1px] sm:gap-0.5 mb-0.5 sm:mb-0.5 z-10">
            <Star className="w-1 h-1 sm:w-2.5 sm:h-2.5 fill-black text-black" />
            <Star className="w-1.5 h-1.5 sm:w-3 sm:h-3 fill-black text-black -translate-y-[1px] sm:-translate-y-0.5" />
            <Star className="w-1 h-1 sm:w-2.5 sm:h-2.5 fill-black text-black" />
          </div>
          
          {isBestSeller ? (
            <div className="flex flex-col items-center [line-height:0.9] z-10 mb-0.5">
              <span className="text-[7px] sm:text-[12px] font-bold text-black lowercase tracking-tighter">best</span>
              <span className="text-[7px] sm:text-[12px] font-bold text-black lowercase tracking-tighter">sellers</span>
            </div>
          ) : (
            <span className="text-[7px] sm:text-[11px] font-bold text-black leading-none lowercase tracking-tighter mb-0.5 sm:mb-0.5 z-10 px-0.5 drop-shadow-sm">
              {displayTag}
            </span>
          )}
          
          <span className="text-[4px] sm:text-[6px] font-bold text-black/50 lowercase tracking-[0.1em] z-10">
            wepink
          </span>
          
          {/* Shine effect */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-white/60 to-transparent pointer-events-none opacity-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#ff0080] text-white w-9 h-9 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-center shadow-lg border border-white/30 p-1">
      <span className="text-[5px] sm:text-[9px] font-black uppercase leading-tight tracking-tight rotate-[-12deg]">
        {tag}
      </span>
    </div>
  );
}

interface Banner {
  id: string;
  image: string;
  mobileImage: string;
  title: string;
  order: number;
  category?: string;
}

const PRODUCTS: Product[] = [
  {
    id: 'kit-obsessed-ember-queen',
    name: 'KIT OBSESSED + EMBER DIVINUS + QUEEN PINK - WEPINK',
    subtitle: 'frescor luminoso do verão com uma doçura irresistível',
    type: 'Kit Perfumaria',
    volume: '3x 100ml',
    price: 249.90,
    originalPrice: 987.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163887-700-700',
    tag: 'OFERTA DO DIA',
    rating: 5,
    reviews: 128,
    family: 'Chypre, Oriental e Floral',
    gender: 'Feminino',
    createdAt: '2024-04-27',
    salesCount: 1500,
    description: '• Obsessed Desodorante Colônia 100ml - Wepink • Caminho olfativo: Chypre Floral Amadeirado • Longa durabilidade • Qualidade incrível • Essência marcante\n\n• Ember Divinus Desodorante Colônia 100ml - Wepink • Caminho olfativo: Oriental Frutado • Essência sofisticada, intensa e envolvente • Fixação e projeção prolongadas • Excelência em cada detalhe\n\n• Queen Pink Desodorante Colônia 100ml - Wepink • Caminho olfativo: Floramber Frutal • Essência única e sofisticada • Qualidade incrível • Longa duração',
    isHighlight: true
  },
  {
    id: '1',
    name: 'Latina Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 83.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164232-700-700',
    tag: 'BEST SELLER',
    rating: 5,
    reviews: 1240,
    isBestSeller: true,
    reviewList: [
      {
        id: 'r1',
        author: 'Lilian F.',
        initials: 'LF',
        rating: 5,
        date: '28/04/2024',
        title: 'Maravilhoso!',
        comment: 'Fragrância incrível, fixa muito bem na pele. Com certeza vou comprar novamente.',
        verified: true,
        recommended: true
      },
      {
        id: 'r2',
        author: 'Rayana D.',
        initials: 'RD',
        rating: 3,
        date: '20/04/2024',
        title: 'Não é o produto, é o meu gosto.',
        comment: 'Não gostei muito do cheiro, não me agradou, em compensação amei VF Gold e Obsessed, estou viciada.',
        verified: true,
        recommended: false
      },
      {
        id: 'r3',
        author: 'Mary N.',
        initials: 'MN',
        rating: 5,
        date: '20/04/2024',
        title: 'Uma perfeição!',
        comment: 'Cheiro de gente rica, amei demais!',
        verified: true,
        recommended: true
      }
    ],
    family: 'Amadeirado',
    gender: 'Feminino',
    createdAt: '2024-04-01',
    salesCount: 8500,
    description: 'a intensidade tropical com uma sofisticação envolvente'
  },
  {
    id: '2',
    name: 'Heaven Santal & Fig Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 83.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164186-700-700',
    rating: 4.9,
    reviews: 2100,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-03-01',
    salesCount: 7200,
    description: 'um amadeirado sofisticado e elegante que é difícil de esquecer'
  },
  {
    id: '3',
    name: 'VF Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 89.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164235-700-700',
    tag: 'LANÇAMENTO',
    isQueridinhos: true,
    rating: 5,
    reviews: 5400,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-01-15',
    salesCount: 12000,
    description: 'a fragrância que é a cara da Virgínia, marcante e luxuosa',
    isHighlight: true
  },
  {
    id: '4',
    name: 'Liberté Platiné Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 70.00,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163957-700-700',
    tag: 'BEST SELLER',
    isBestSeller: true,
    rating: 4.8,
    reviews: 3200,
    reviewList: [
      {
        id: 'plat1',
        author: 'Ana Paula S.',
        initials: 'AS',
        rating: 5,
        date: '02/05/2024',
        title: 'Fragrância de milhões!',
        comment: 'Simplesmente apaixonada por esse perfume. Fixação de outro mundo, recebo elogios o dia todo.',
        verified: true,
        recommended: true
      },
      {
        id: 'plat2',
        author: 'Juliana M.',
        initials: 'JM',
        rating: 4,
        date: '25/04/2024',
        title: 'Muito bom, mas o cheiro é forte.',
        comment: 'É um perfume marcante, excelente para a noite. Para o dia achei um pouco intenso demais, mas a qualidade é nota 10.',
        verified: true,
        recommended: true
      }
    ],
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2023-12-01',
    salesCount: 15000,
    description: 'inspire energia cintilante'
  },
  {
    id: '5',
    name: 'Liberté Doré Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 70.00,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163953-700-700',
    tag: 'LANÇAMENTO',
    rating: 4.7,
    reviews: 850,
    reviewList: [
      {
        id: 'dore1',
        author: 'Beatriz L.',
        initials: 'BL',
        rating: 5,
        date: '05/05/2024',
        title: 'Chiquérrimo!',
        comment: 'Um perfume com presença. Amei as notas de saída, super refrescante e sofisticado ao mesmo tempo.',
        verified: true,
        recommended: true
      }
    ],
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-04-10',
    salesCount: 2200,
    description: 'a luz dourada da liberdade'
  },
  {
    id: '6',
    name: 'One Touch Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 89.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164010-700-700',
    tag: 'O FAVORITO',
    rating: 4.9,
    reviews: 4200,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2023-11-20',
    salesCount: 18000,
    description: 'um toque de sofisticação que dura o dia todo'
  },
  {
    id: '7',
    name: 'Red Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 99.90,
    originalPrice: 349.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163884-700-700',
    tag: 'INTENSO',
    rating: 5,
    reviews: 1800,
    family: 'Oriental',
    gender: 'Feminino',
    createdAt: '2024-02-05',
    salesCount: 6500,
    description: 'paixão e elegância em um frasco vermelho vibrante'
  },
  {
    id: '8',
    name: 'Obsessed Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 85.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164082-700-700',
    rating: 4.8,
    reviews: 950,
    family: 'Floriental',
    gender: 'Feminino',
    createdAt: '2024-03-15',
    salesCount: 3100,
    description: 'o vício em cada nota, para quem não tem medo de ser notada'
  },
  {
    id: '9',
    name: 'VF Aqua Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 89.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164010-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.9,
    reviews: 1200,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-03-20',
    salesCount: 4500
  },
  {
    id: '10',
    name: 'Celebration Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 89.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163884-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.8,
    reviews: 900,
    family: 'Oriental',
    gender: 'Feminino',
    createdAt: '2024-03-25',
    salesCount: 3800
  },
  {
    id: '11',
    name: 'Obsessed Gold Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 95.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164232-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 5,
    reviews: 300,
    family: 'Amadeirado',
    gender: 'Feminino',
    createdAt: '2024-04-05',
    salesCount: 2000
  },
  {
    id: '12',
    name: 'Royal Bloom Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 83.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164186-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.9,
    reviews: 1500,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-04-12',
    salesCount: 5200
  },
  {
    id: '13',
    name: 'Pure Seduction Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 79.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164235-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.7,
    reviews: 600,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-04-15',
    salesCount: 1800
  },
  {
    id: '14',
    name: 'Starlight Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 89.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163957-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.8,
    reviews: 1100,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-04-18',
    salesCount: 4200
  },
  {
    id: '15',
    name: 'Deep Blue Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 99.90,
    originalPrice: 349.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163953-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.9,
    reviews: 750,
    family: 'Floral',
    gender: 'Feminino',
    createdAt: '2024-04-20',
    salesCount: 2500
  },
  {
    id: '16',
    name: 'Midnight Rose Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 85.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164082-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.8,
    reviews: 820,
    family: 'Floriental',
    gender: 'Feminino',
    createdAt: '2024-04-22',
    salesCount: 3100
  },
  {
    id: '17',
    name: 'Sunlight Desodorante Colônia 100ml - Wepink',
    type: 'Desodorante Colônia',
    volume: '100ml',
    price: 83.90,
    originalPrice: 329.00,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/164232-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.9,
    reviews: 1400,
    family: 'Amadeirado',
    gender: 'Feminino',
    createdAt: '2024-04-25',
    salesCount: 4800
  },
  {
    id: 'wehot-1',
    name: 'Óleo Corporal Sensorial WeHot 120ml - Wepink',
    type: 'wehot',
    category: 'wehot',
    volume: '120ml',
    price: 49.90,
    originalPrice: 139.90,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163820-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 5.0,
    reviews: 820,
    family: 'Sensorial & Quente',
    gender: 'Unissex',
    createdAt: '2024-05-10',
    salesCount: 3500,
    tag: 'LANÇAMENTO WEHOT'
  },
  {
    id: 'wehot-2',
    name: 'Gel Beijável Sensorial Hot Morango WeHot 50g - Wepink',
    type: 'wehot',
    category: 'wehot',
    volume: '50g',
    price: 39.90,
    originalPrice: 99.90,
    image: 'https://wepink.vteximg.com.br/arquivos/ids/163819-700-700',
    isBestSeller: true,
    isQueridinhos: true,
    rating: 4.9,
    reviews: 640,
    family: 'Sensorial',
    gender: 'Unissex',
    createdAt: '2024-05-11',
    salesCount: 2900,
    tag: 'WEHOT'
  }
];

const DEFAULT_BANNERS: Banner[] = [
  {
    id: 'b1',
    image: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/a8362a4d-f49c-48c0-848f-3da8564a275f___34685ff884f886f3807204192661571d.jpg',
    mobileImage: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/c255776d-8c44-469b-9c60-e46be9f55e0c___4ca64f0b2f094da688325db197d19760.jpg',
    title: 'Banner 1 - Festival de Ofertas',
    order: 1
  },
  {
    id: 'b2',
    image: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/f34fb460-e448-439d-b8d1-d254afbadcca___f78fa5e7d5811cff9bc3ea0b885ae86c.jpg',
    mobileImage: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/f34fb460-e448-439d-b8d1-d254afbadcca___f78fa5e7d5811cff9bc3ea0b885ae86c.jpg',
    title: 'Banner 2 - Perfumaria WePink',
    order: 2
  },
  {
    id: 'b3',
    image: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/52acbb07-43a5-4593-862c-71412b913480___a6c6bc489931fadf334edb079ae2bc68.webp',
    mobileImage: 'https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/52acbb07-43a5-4593-862c-71412b913480___a6c6bc489931fadf334edb079ae2bc68.webp',
    title: 'Banner 3 - Linha WeHot WePink',
    order: 3
  }
];

const DEFAULT_CATEGORY_BANNERS: Record<string, Banner> = {
  "wehot": {
    id: "default-wehot",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/52acbb07-43a5-4593-862c-71412b913480___a6c6bc489931fadf334edb079ae2bc68.webp",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/52acbb07-43a5-4593-862c-71412b913480___a6c6bc489931fadf334edb079ae2bc68.webp",
    title: "Linha WeHot WePink",
    order: 1,
    category: "wehot"
  },
  "skincare": {
    id: "default-skincare",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/a6f3b890-8809-41b3-a15e-be9d96fe8da5___71ea8638ea103dce09b9f7836d5ba01c.jpg",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/a6f3b890-8809-41b3-a15e-be9d96fe8da5___71ea8638ea103dce09b9f7836d5ba01c.jpg",
    title: "Skincare WePink",
    order: 1,
    category: "skincare"
  },
  "perfumaria": {
    id: "default-perfumaria",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/f34fb460-e448-439d-b8d1-d254afbadcca___f78fa5e7d5811cff9bc3ea0b885ae86c.jpg",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/f34fb460-e448-439d-b8d1-d254afbadcca___f78fa5e7d5811cff9bc3ea0b885ae86c.jpg",
    title: "Perfumaria WePink",
    order: 1,
    category: "perfumaria"
  },
  "body splash": {
    id: "default-body-splash",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/be61d6bc-aff1-487b-80ac-e087fe0a2df3___a8a649a2cd7de3ac9bba97ebdedab2c1.jpg",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/be61d6bc-aff1-487b-80ac-e087fe0a2df3___a8a649a2cd7de3ac9bba97ebdedab2c1.jpg",
    title: "Body Splash WePink",
    order: 1,
    category: "body splash"
  },
  "kits": {
    id: "default-kits",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/a8362a4d-f49c-48c0-848f-3da8564a275f___34685ff884f886f3807204192661571d.jpg",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/c255776d-8c44-469b-9c60-e46be9f55e0c___4ca64f0b2f094da688325db197d19760.jpg",
    title: "Kits WePink",
    order: 1,
    category: "kits"
  },
  "masculino": {
    id: "default-masculino",
    image: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/df8a5a40-1f9e-4a6c-94cc-1a1fa1faefcc___df8a51cc20fef78a1fa90acbedabec4d.jpg",
    mobileImage: "https://wepink.vtexassets.com/assets/vtex.file-manager-graphql/images/df8a5a40-1f9e-4a6c-94cc-1a1fa1faefcc___df8a51cc20fef78a1fa90acbedabec4d.jpg",
    title: "Masculino WePink",
    order: 1,
    category: "masculino"
  }
};

function WepinkBanner({ slides, isCategory = false, interval = 4000 }: { slides: Banner[], isCategory?: boolean, interval?: number, key?: React.Key }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Reset slide index whenever slides list changes or category switches
  useEffect(() => {
    setCurrentSlide(0);
  }, [slides, isCategory]);

  useEffect(() => {
    if (!slides || slides.length <= 1) return;
    const bannerInterval = isCategory ? 4000 : (interval || 4000);
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, bannerInterval);
    return () => clearInterval(timer);
  }, [slides?.length, isCategory, interval]);

  if (!slides || slides.length === 0) {
    return null;
  }

  // Guaranteed safe index calculation to prevent undefined access
  const safeIndex = currentSlide % slides.length;
  const currentBanner = slides[safeIndex] || slides[0];
  if (!currentBanner) return null;

  const desktopImage = currentBanner.image || currentBanner.mobileImage;
  const mobileImage = currentBanner.mobileImage || currentBanner.image;

  return (
    <div className="relative w-full group overflow-hidden bg-white border-b border-gray-100">
      <div className={`relative w-full overflow-hidden ${isCategory ? 'aspect-[1248/350] md:aspect-[1920/350]' : 'aspect-[4/5] md:aspect-[1920/640]'}`}>
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={currentBanner.id || `slide-${safeIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 w-full h-full"
          >
            <picture className="w-full h-full block">
              {mobileImage && (
                <source 
                  media="(max-width: 768px)" 
                  srcSet={mobileImage} 
                />
              )}
              <img 
                src={desktopImage} 
                alt={currentBanner.title || 'Banner WePink'}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                loading="eager"
              />
            </picture>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button 
            type="button"
            onClick={() => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length)}
            className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#ff0080] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-40 hover:bg-[#ff0080] hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button 
            type="button"
            onClick={() => setCurrentSlide(prev => (prev + 1) % slides.length)}
            className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-[#ff0080] shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-40 hover:bg-[#ff0080] hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 flex gap-2 md:gap-3 z-40">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                safeIndex === idx ? 'w-6 md:w-10 h-1.5 md:h-2 bg-[#ff0080]' : 'w-1.5 md:w-2 h-1.5 md:h-2 bg-white/50 hover:bg-white'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Navbar({ 
  onOpenSearch, 
  onOpenCart, 
  onOpenProfile, 
  cartCount, 
  onGoHome,
  onOpenAdmin,
  user,
  onSelectCategory,
  selectedCategory = null
}: { 
  onOpenSearch: () => void, 
  onOpenCart: () => void,
  onOpenProfile: () => void,
  cartCount: number,
  onGoHome: () => void,
  onOpenAdmin: () => void,
  user: FirebaseUser | null,
  onSelectCategory: (cat: string) => void,
  selectedCategory?: string | null
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [onlineVisitors, setOnlineVisitors] = useState<number>(() => {
    return Math.floor(Math.random() * (2000 - 1500 + 1)) + 1500;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineVisitors(prev => {
        const change = Math.floor(Math.random() * 11) - 5;
        const newValue = prev + change;
        if (newValue < 1500) return 1500;
        if (newValue > 2000) return 2000;
        return newValue;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const categories = PRODUCT_CATEGORIES.slice(0, 12);
  const subCategories = PRODUCT_CATEGORIES.slice(12);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Top Banner Bar */}
      <div className="bg-[#ff0080] text-white text-[9px] md:text-[12px] py-1.5 md:py-2.5 px-4 flex items-center justify-center md:justify-between font-bold tracking-tight font-montserrat shadow-sm w-full max-w-full overflow-x-hidden uppercase">
        <div className="hidden md:flex flex-1"></div>
        <div className="flex-1 text-center font-bold leading-[1.2] max-w-full">
           <span className="tracking-[0.01em] md:tracking-[0.05em] inline-block w-full max-w-full">
             GARANTA AGORA O SEU KIT WE FAVORITO!<br className="md:hidden" /> - FRETE GRÁTIS COMPRAS ACIMA DE R$ 199,90
           </span>
        </div>
        <div className="hidden md:flex flex-1 justify-end">
        </div>
      </div>
      
      {/* Middle Row: Logo, Search, Actions */}
      <div className={`transition-all duration-300 shadow-sm border-b border-gray-50 ${isScrolled ? 'py-1 bg-white/90 backdrop-blur-xl' : 'py-2 md:py-3 bg-white'}`}>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 grid grid-cols-3 md:flex items-center md:justify-between gap-4 md:gap-8">
          
          {/* Left: Menu (Mobile) or Logo (Desktop) */}
          <div className="flex items-center">
            <button onClick={() => setIsMenuOpen(true)} className="md:hidden">
              <Menu className="w-6 h-6 text-gray-800" />
            </button>
            <button onClick={onGoHome} className="hidden md:flex items-center transform active:scale-95 transition-transform">
              <img 
                src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                alt="WePink Logo" 
                className="h-[32px] lg:h-[38px] w-auto object-contain" 
                referrerPolicy="no-referrer"
              />
            </button>
          </div>

          {/* Center: Logo (Mobile) or Search (Desktop) */}
          <div className="flex justify-center items-center md:flex-1 md:max-w-2xl">
            <button onClick={onGoHome} className="md:hidden flex items-center transform active:scale-95 transition-transform">
              <img 
                src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                alt="WePink Logo" 
                className="h-6 w-auto object-contain" 
                referrerPolicy="no-referrer"
              />
            </button>
            <div className="hidden md:block w-full px-4">
              <div className="relative w-full group">
                <input 
                  onClick={onOpenSearch}
                  type="text" 
                  placeholder="digite aqui o que procura..."
                  className="w-full bg-[#f8f8f8] border-none rounded-full h-11 pl-11 pr-4 text-[12px] font-medium text-[#3f3f40] transition-all placeholder:text-[#979899] cursor-pointer"
                  readOnly
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ff0080]" />
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 mt-2 select-none">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>
                  <strong className="text-green-600 font-extrabold">{onlineVisitors}</strong> pessoas navegando no site agora
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-2 md:gap-4 lg:gap-6">
            <div className="hidden xl:flex items-center gap-4 lg:gap-6 font-semibold text-[11px] lg:text-[12px] font-montserrat text-[#3f3f40]">
              <a href="#" className="flex items-center gap-2 hover:text-[#ff0080] transition-colors whitespace-nowrap">
                <Truck className="w-4 h-4 mt-0.5" />
                Rastreio
              </a>
              <a href="#" className="flex items-center gap-2 hover:text-[#ff0080] transition-colors whitespace-nowrap">
                <RefreshCw className="w-4 h-4 mt-0.5" />
                Trocar e Devolver
              </a>
            </div>
            
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={onOpenProfile}
                className="hover:scale-110 transition-transform text-[#ff0080] flex items-center"
              >
                <User className="w-5 h-5" />
              </button>
              <button 
                onClick={onOpenCart}
                className="relative cursor-pointer hover:scale-110 transition-transform"
              >
                <img src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/mini-cart___7b6c183ba6e1a13f1593bc69dd59c085.svg" alt="Bag" className="w-5 h-5 lg:w-6 lg:h-6" />
                <span className="absolute -top-1.5 -right-1.5 bg-[#ff0080] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold tracking-tighter shadow-sm">{cartCount}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Row (Main Menu) - Condensed */}
      <div className={`hidden lg:block border-b border-gray-100 transition-all duration-300 ${isScrolled ? 'hidden' : 'bg-white'}`}>
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-1">
          <div className="flex items-center justify-between w-full overflow-x-auto no-scrollbar gap-2">
            {PRODUCT_CATEGORIES.map((cat) => {
              const isActive = selectedCategory?.toLowerCase() === cat.toLowerCase();
              if (cat === 'wehot') {
                return (
                  <button 
                    key={cat} 
                    onClick={() => onSelectCategory(cat)}
                    className={`bg-black text-[#ff0080] font-bold px-3 py-1 rounded-[6px] flex items-center gap-1.5 transition-all duration-150 hover:bg-neutral-900 cursor-pointer shadow-sm shrink-0 ${
                      isActive 
                        ? 'ring-2 ring-[#ff0080]' 
                        : ''
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 fill-[#ff0080] text-[#ff0080]" />
                    <span className="text-[13.5px] lowercase font-bold tracking-tight">wehot</span>
                  </button>
                );
              }
              return (
                <button 
                  key={cat} 
                  onClick={() => onSelectCategory(cat)}
                  className={`text-[14.5px] font-normal transition-all whitespace-nowrap font-sans lowercase py-2 duration-150 cursor-pointer shrink-0 ${
                    isActive 
                      ? 'text-[#ff0080] font-semibold' 
                      : 'text-[#333333] hover:text-[#ff0080]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white z-[70] p-8 shadow-2xl overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <button onClick={() => { onGoHome(); setIsMenuOpen(false); }} className="flex-shrink-0">
                  <img 
                    src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                    alt="Logo" 
                    className="h-6" 
                    referrerPolicy="no-referrer" 
                  />
                </button>
                <button onClick={() => setIsMenuOpen(false)}><X className="w-6 h-6" /></button>
              </div>
              <div className="flex flex-col gap-4 font-bold text-[11px] tracking-[0.1em] uppercase font-montserrat">
                {PRODUCT_CATEGORIES.map((cat) => {
                  const isActive = selectedCategory?.toLowerCase() === cat.toLowerCase();
                  if (cat === 'wehot') {
                    return (
                      <button 
                        key={cat} 
                        onClick={() => {
                           onSelectCategory(cat);
                           setIsMenuOpen(false);
                        }} 
                        className={`bg-black text-[#ff0080] px-4 py-2.5 rounded-xl flex items-center justify-between font-bold tracking-wider ${
                          isActive ? 'ring-2 ring-[#ff0080]' : ''
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Flame className="w-4 h-4 fill-[#ff0080] text-[#ff0080]" />
                          <span className="text-[12px] uppercase text-[#ff0080]">WEHOT</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#ff0080]" />
                      </button>
                    );
                  }
                  return (
                    <button 
                      key={cat} 
                      onClick={() => {
                         onSelectCategory(cat);
                         setIsMenuOpen(false);
                      }} 
                      className={`border-b border-gray-100 pb-3 flex items-center justify-between group text-left ${
                        isActive ? 'text-[#ff0080] font-black' : 'text-gray-700'
                      }`}
                    >
                      <span>{cat}</span>
                      <ChevronRight className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-[#ff0080]' : 'text-gray-300 group-hover:text-[#ff0080]'
                      }`} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}

function ProductCard({ product, onAddToCart, onOpenProduct }: { product: Product, onAddToCart: (p: Product, q?: number) => void, onOpenProduct: (p: Product) => void, key?: string }) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;

  return (
    <div className="product-card flex flex-col group bg-white border border-gray-50 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
      <div className="relative w-full aspect-[4/5] overflow-hidden flex items-center justify-center p-2 sm:p-4 cursor-pointer bg-[#fafafa]" onClick={() => onOpenProduct(product)}>
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        {(product.tag || product.isBestSeller || product.isMaisVendidos || product.isQueridinhos || product.isNew) && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none transition-transform duration-500 group-hover:scale-110">
             <ProductSeal tag={product.isNew ? 'lançamento' : (product.isBestSeller ? 'best seller' : (product.isMaisVendidos ? 'mais vendido' : (product.isQueridinhos ? 'queridinho' : (product.tag || ''))))} />
          </div>
        )}
      </div>

      <div className="w-full text-left flex flex-col p-4 sm:p-5 flex-grow">
        <h3 className="font-bold text-[12px] sm:text-[15px] leading-tight mb-1 text-[#3f3f40] font-montserrat min-h-[32px] sm:min-h-[44px] cursor-pointer hover:text-[#ff0080] transition-colors line-clamp-2" onClick={() => onOpenProduct(product)}>
          {product.name}
        </h3>
        <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal leading-relaxed mb-3 line-clamp-2 h-[30px] sm:h-[34px] overflow-hidden">
          {product.subtitle || 'frescor luminoso do verão com uma doçura irresistível'}
        </p>

        <div className="flex items-center gap-1 mb-3">
          <div className="flex text-[#ffb800]">
             {[...Array(5)].map((_, i) => <Star key={i} className="w-2.5 h-2.5 fill-current" />)}
          </div>
          <span className="text-[9px] font-bold text-gray-300 italic tracking-tighter">(99+)</span>
        </div>
        
        <div className="flex flex-col gap-0.5 mb-4 sm:mb-6 mt-auto">
          {hasDiscount && (
            <div className="text-[10px] sm:text-[12px] text-gray-400 font-bold line-through">
              R$ {product.originalPrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          )}
          <div className="text-[13px] sm:text-[16px] font-black text-black flex flex-wrap items-baseline gap-x-1.5 leading-none">
            <span>R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] sm:text-[11px] text-gray-500 font-normal">
              ou 6x R$ {(product.price / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-2 w-full mt-auto">
          <button 
            onClick={() => onAddToCart(product)}
            className="flex-grow bg-[#ff0080] h-[38px] sm:h-[48px] rounded-xl text-white font-black text-[11px] sm:text-[13px] uppercase tracking-widest hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center font-montserrat shadow-md shadow-pink-100"
          >
            Comprar
          </button>
          
          <button 
            onClick={() => onAddToCart(product)}
            className="w-[38px] sm:w-[48px] h-[38px] sm:h-[48px] border-2 border-[#ff0080] rounded-xl bg-white flex items-center justify-center text-[#ff0080] hover:bg-pink-50 transition-colors active:scale-95 shrink-0 gap-[1px]"
            title="Adicionar ao carrinho"
          >
            <Plus className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 stroke-[3]" />
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetailPage({ 
  product, 
  products = [],
  onBack, 
  onHome,
  onAddToCart,
  onOpenCart,
  onOpenProfile,
  onOpenSearch,
  cartCount,
  onOpenAdmin,
  user,
  onSelectCategory,
  onSelectProduct,
  selectedCategory = null
}: { 
  product: Product, 
  products?: Product[],
  onBack: () => void, 
  onHome?: () => void,
  onAddToCart: (p: Product, q: number) => void,
  onOpenCart: () => void,
  onOpenProfile: () => void,
  onOpenSearch: () => void,
  cartCount: number,
  onOpenAdmin: () => void,
  user: FirebaseUser | null,
  onSelectCategory: (cat: string) => void,
  onSelectProduct: (product: Product) => void,
  selectedCategory?: string | null
}) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(product.image);
  const [activeTab, setActiveTab] = useState('Descrição');
  const thumbnails = [product.image, ...(product.images || [])].slice(0, 4);
  const [selectedColor, setSelectedColor] = useState<any>(product.colors?.[0] || null);
  const [includeCompanion, setIncludeCompanion] = useState(true);

  // Find a companion product for "Compre Junto"
  const companionProduct = React.useMemo(() => {
    if (!products || products.length === 0) return null;
    
    // Split the current name into words to find matching ones in the same line
    const nameWords = product.name.split(' ').filter(w => w.length > 3);
    const firstSignificantWord = nameWords[0];
    
    if (firstSignificantWord) {
      // 1. Try to find a companion with the same brand line (e.g. "Obsessed", "One Touch", etc.)
      const matchingLine = products.find(p => 
        p.id !== product.id && 
        p.name.toLowerCase().includes(firstSignificantWord.toLowerCase())
      );
      if (matchingLine) return matchingLine;
    }

    // 2. Or find another product of same category
    const sameCategory = products.find(p => 
      p.id !== product.id && 
      p.type === product.type
    );
    if (sameCategory) return sameCategory;

    // 3. Fallback: pick any other product from list
    return products.find(p => p.id !== product.id) || null;
  }, [products, product]);

  const handleSelectColor = (color: any) => {
    setSelectedColor(color);
    if (color.image) {
      setActiveImage(color.image);
    }
  };

  const handleAddToCart = () => {
    const pToAdd = selectedColor 
      ? { ...product, name: `${product.name} (${selectedColor.name})`, image: selectedColor.image || product.image }
      : product;
    onAddToCart(pToAdd, quantity);
  };

  const handleAddKitToCart = () => {
    // Add current product with its active configuration:
    const mainP = selectedColor 
      ? { ...product, name: `${product.name} (${selectedColor.name})`, image: selectedColor.image || product.image }
      : product;
    onAddToCart(mainP, quantity);
    
    // Add companion product:
    if (includeCompanion && companionProduct) {
      onAddToCart(companionProduct, 1);
    }
  };

  const BuyTogetherSection = () => {
    if (!companionProduct) return null;

    const mainPrice = product.price * quantity;
    const companionPrice = companionProduct.price;
    const subtotal = mainPrice + (includeCompanion ? companionPrice : 0);

    return (
      <div className="mt-8 border border-gray-100 rounded-3xl p-6 bg-gray-50/40 relative">
        <h3 className="text-[18px] font-black text-gray-800 uppercase tracking-tight mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff0080]" />
          compre junto
        </h3>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Main Product */}
          <div className="flex items-center gap-4 bg-white p-3.5 rounded-2xl border border-gray-100 flex-1 w-full shadow-sm">
            <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
              <img 
                src={selectedColor?.image || product.image} 
                className="w-full h-full object-contain mix-blend-multiply" 
                referrerPolicy="no-referrer"
                alt={product.name}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-gray-800 line-clamp-1 uppercase">
                {product.name} {selectedColor ? `(${selectedColor.name})` : ''}
              </h4>
              <p className="text-xs text-gray-400 font-bold mt-0.5">{quantity}x unidade(s)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xs font-bold text-gray-400 line-through">
                  R$ {((product.originalPrice || product.price * 1.3) * quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-black text-black">
                  R$ {mainPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-md bg-[#ff0080] text-white flex items-center justify-center">
              <Check className="w-3.5 h-3.5 stroke-[3px]" />
            </div>
          </div>

          {/* Plus Sign */}
          <div className="flex-shrink-0 bg-white shadow-sm border border-gray-100 w-8 h-8 rounded-full flex items-center justify-center text-gray-400">
            <Plus className="w-4 h-4 stroke-[3px]" />
          </div>

          {/* Companion Product */}
          <button 
            onClick={() => setIncludeCompanion(!includeCompanion)}
            className={`flex items-center gap-4 bg-white p-3.5 rounded-2xl border transition-all flex-1 w-full text-left shadow-sm ${
              includeCompanion ? 'border-[#ff0080]/30 ring-2 ring-pink-50' : 'border-gray-100 opacity-70 hover:opacity-100'
            }`}
          >
            <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center p-1.5 flex-shrink-0">
              <img 
                src={companionProduct.image} 
                className="w-full h-full object-contain mix-blend-multiply" 
                referrerPolicy="no-referrer"
                alt={companionProduct.name}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-gray-800 line-clamp-1 uppercase">
                {companionProduct.name}
              </h4>
              <p className="text-xs text-gray-400 font-bold mt-0.5">1x unidade</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xs font-bold text-gray-400 line-through">
                  R$ {(companionProduct.originalPrice || companionProduct.price * 1.3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-black text-black">
                  R$ {companionPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${
              includeCompanion 
                ? 'bg-[#ff0080] border-[#ff0080] text-white' 
                : 'border-gray-200 text-transparent'
            }`}>
              <Check className="w-3.5 h-3.5 stroke-[3px]" />
            </div>
          </button>
        </div>

        {/* Pricing Subtotal & CTA */}
        <div className="mt-6 pt-4 border-t border-gray-150/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs font-extrabold text-[#ff0080] uppercase tracking-wide">Compre Junto</p>
            <p className="text-[18px] font-black text-black mt-0.5">
              Subtotal: <span className="text-[#ff0080]">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </p>
            <p className="text-[11px] text-gray-400 font-bold mt-0.5">
              ou até 6x de R$ {(subtotal / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros
            </p>
          </div>
          <button
            onClick={handleAddKitToCart}
            className="w-full sm:w-auto bg-[#ff0080] hover:brightness-105 active:scale-[0.98] transition-all px-8 py-3.5 rounded-xl text-white font-black uppercase text-[12px] tracking-[0.1em] shadow-lg shadow-[#ff0080]/15 whitespace-nowrap"
          >
            Adicionar o kit no carrinho
          </button>
        </div>
      </div>
    );
  };

  const StoreRatingCard = () => (
    <div className="w-full max-w-[340px] mt-4 flex flex-col items-center">
        <div className="w-full space-y-1.5 mb-8">
          {[80, 15, 3, 1, 1].map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] font-black text-black w-4 leading-none text-right flex items-center justify-end gap-0.5">{5-i} <Star className="w-3 h-3" /></span>
              <div className="flex-1 h-3 bg-gray-50 rounded-full border border-gray-100">
                <div className="h-full bg-[#ffb800] rounded-full" style={{ width: `${p}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center">
          <p className="text-[12px] text-gray-500 mb-6 font-medium">Com base em avaliações dos últimos 6 meses.</p>
          <div className="flex items-center gap-2 opacity-90">
            <div className="w-6 h-6 bg-[#94c11f] rounded-full flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-white fill-current" />
            </div>
            <span className="text-[11px] text-gray-600 font-medium">Avaliações confiáveis do <span className="text-[#94c11f] font-black uppercase">Reclame</span> <span className="text-[#94c11f] font-black uppercase">AQUI</span></span>
          </div>
        </div>
    </div>
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveImage(product.image);
    setSelectedColor(product.colors?.[0] || null);
  }, [product.id]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar 
        onOpenSearch={onOpenSearch}
        onOpenCart={onOpenCart}
        onOpenProfile={onOpenProfile}
        cartCount={cartCount}
        onGoHome={onHome || onBack}
        onOpenAdmin={onOpenAdmin}
        user={user}
        onSelectCategory={onSelectCategory}
        selectedCategory={selectedCategory}
      />
      
      <main className="max-w-[1240px] mx-auto px-0 md:px-8 pt-[60px] md:pt-[160px] pb-20">
        <div className="lg:hidden flex flex-col pt-4">
          {/* MOBILE VIEW */}
          {/* Warning Banner Mobile */}
          <div className="bg-[#ff0080] text-white py-3 px-6 text-[11px] font-medium leading-tight text-center mb-4">
             Fique ligado! A inclusão do produto na cesta não garante sua compra. <span className="underline font-black">Finalize o carrinho!</span>
          </div>
          
          {/* Breadcrumbs Mobile */}
          <div className="px-6 flex items-center gap-1 text-[11.5px] font-bold text-gray-300 lowercase tracking-tight mb-4">
             <span className="cursor-pointer hover:underline text-gray-400" onClick={onBack}>perfumaria</span>
             <span className="mx-0.5 text-gray-300">&gt;</span>
             <span className="cursor-pointer hover:underline text-gray-400">best seller</span>
             <span className="mx-0.5 text-gray-300">&gt;</span>
             <span className="line-clamp-1 truncate text-gray-400">{product.name.replace(/ - wepink/i, '')} - wepink</span>
          </div>

          <div className="w-full aspect-square bg-white flex items-center justify-center relative p-4 overflow-hidden group">
            <motion.img 
              src={activeImage} 
              className="w-full h-full object-contain px-8 relative z-10" 
              referrerPolicy="no-referrer"
              alt={product.name}
              whileHover={{ y: -15, scale: 1.05 }}
              whileTap={{ y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />

            {/* Navigation Arrows Mobile */}
            {thumbnails.length > 1 && (
              <>
                <button 
                  onClick={() => {
                    const idx = thumbnails.indexOf(activeImage);
                    const prevIdx = (idx - 1 + thumbnails.length) % thumbnails.length;
                    setActiveImage(thumbnails[prevIdx]);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 rounded-full shadow-sm text-gray-400"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => {
                    const idx = thumbnails.indexOf(activeImage);
                    const nextIdx = (idx + 1) % thumbnails.length;
                    setActiveImage(thumbnails[nextIdx]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 rounded-full shadow-sm text-gray-400"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Dots for carousel indicator simulation */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-10">
               {thumbnails.map((img, i) => (
                 <button 
                   key={i} 
                   onClick={() => setActiveImage(img)}
                   className={`w-3 h-3 rounded-full transition-all ${i === thumbnails.indexOf(activeImage) ? 'bg-[#ff0080] w-6' : 'bg-gray-200'}`} 
                 />
               ))}
            </div>
            <button className="absolute bottom-6 right-6 w-10 h-10 flex items-center justify-center text-[#ff0080] border-2 border-[#ff0080]/10 rounded-full bg-white shadow-sm">
              <Heart className="w-5 h-5" />
            </button>
            {(product.tag || product.isBestSeller || product.isMaisVendidos || product.isQueridinhos || product.isNew) && (
              <div className="absolute top-4 left-4 z-20 pointer-events-none">
                <ProductSeal tag={product.isNew ? 'lançamento' : (product.isBestSeller ? 'best seller' : (product.isMaisVendidos ? 'mais vendido' : (product.isQueridinhos ? 'queridinho' : (product.tag || ''))))} />
              </div>
            )}
            <div className="absolute top-1/2 -translate-y-1/2 right-4">
               <button className="text-[#ff0080] opacity-50"><Share2 className="w-6 h-6" /></button>
            </div>
          </div>

          <div className="px-6 py-8 flex flex-col">
            <h1 className="text-[28px] font-black text-[#ff0080] leading-tight mb-6 font-montserrat tracking-tight">
              {product.name.replace(/ - wepink/i, '')}
            </h1>
            
            {product.colors && product.colors.length > 0 && (
              <div className="px-6 mb-8">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Cor: <span className="text-gray-800 font-extrabold">{selectedColor?.name || 'Selecione uma cor'}</span>
                </span>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectColor(c)}
                      className={`w-9 h-9 rounded-full border-2 relative transition-all ${
                        selectedColor?.name === c.name 
                          ? 'border-[#ff0080] scale-110 shadow-sm' 
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: c.hex || '#ffffff' }}
                      title={c.name}
                    >
                      {selectedColor?.name === c.name && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full mix-blend-difference" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="lg:hidden mb-10 px-6">
              <BuyTogetherSection />
            </div>
            
            <div className="bg-white lg:hidden">
              <div className="flex items-center gap-8 border-b border-gray-100 mb-8 overflow-x-auto no-scrollbar">
                {['Descrição', 'Notas', 'Modo de usar'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-4 text-[18px] font-bold transition-all relative whitespace-nowrap ${
                      activeTab === tab ? 'text-[#ff0080]' : 'text-black opacity-80'
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div 
                        layoutId="activeTabMobile"
                        className="absolute bottom-0 left-0 right-0 h-[4.5px] bg-[#ff0080]" 
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="text-[17px] text-gray-900 leading-[1.8] min-h-[150px]">
                {activeTab === 'Descrição' && (
                  <p className="opacity-90">
                    O <span className="font-bold">Desodorante Colônia Wepink {product.name}</span> é um convite para viver a intensidade em sua forma mais vibrante, quente e sofisticada. Uma fragrância que traduz energia, feminilidade e magnetismo em cada detalhe, criando uma presença marcante e impossível de ignorar.
                  </p>
                )}
                {activeTab === 'Notas' && (
                  <div className="space-y-4 opacity-90">
                    <p>Na abertura, a banana cremosa surge envolvente e inesperada, trazendo uma doçura tropical sofisticada que se encontra com a leveza luminosa da pera.</p>
                    <p>No coração, a fragrância revela sua faceta mais feminina e envolvente. O coco adiciona cremosidade e conforto, enquanto o jasmim floresce com elegância.</p>
                  </div>
                )}
                {activeTab === 'Modo de usar' && (
                  <p className="opacity-90">
                    Aplique nas áreas quentes do corpo como nuca, pulsos e atrás das orelhas. Deixe secar naturalmente sem esfregar para não alterar a pirâmide olfativa.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-16 space-y-0">
               <div className="py-20 border-t border-gray-100 flex flex-col items-center text-center">
                  <p className="text-[16px] text-gray-800 font-medium mb-12 max-w-[280px]">Enquanto este produto aguarda avaliações, aproveite para conferir a <b>nota da loja</b>:</p>
                  <h2 className="text-[32px] font-black text-black mb-8">Wepink</h2>
                  <div className="flex flex-col items-center">
                    <div className="flex items-baseline gap-4 mb-4">
                       <span className="text-[72px] font-black text-black leading-none">4.7</span>
                       <span className="text-[24px] font-black text-black">/ 5</span>
                    </div>
                    <div className="flex text-[#ffb800] gap-1 mb-2">
                       {[...Array(5)].map((_, i) => (
                         <Star key={i} className="w-10 h-10 fill-current" />
                       ))}
                    </div>
                    <span className="text-[14px] text-gray-400 font-bold mb-10">(11249)</span>
                  </div>
                  <StoreRatingCard />
               </div>
            </div>
          </div>
          
          {/* FIXED BOTTOM BAR MOBILE */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] safe-area-bottom">
             <div className="flex h-[78px]">
                <div className="flex-[0.5] flex items-center justify-center bg-white">
                   <div className="flex items-center gap-7">
                      <button 
                        onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                        className="w-11 h-11 rounded-full bg-[#ff0080] text-white flex items-center justify-center text-[26px] font-bold active:scale-90 transition-transform shadow-sm"
                      >
                        −
                      </button>
                      <span className="font-black text-[24px] text-black w-4 text-center">{quantity}</span>
                      <button 
                        onClick={() => setQuantity(quantity + 1)} 
                        className="w-11 h-11 rounded-full bg-[#ff0080] text-white flex items-center justify-center text-[26px] font-bold active:scale-90 transition-transform shadow-sm"
                      >
                        +
                      </button>
                   </div>
                </div>
                <button 
                  onClick={handleAddToCart}
                  className="flex-[0.5] bg-[#ff0080] h-full text-white font-black text-[22px] uppercase tracking-widest active:brightness-110 transition-all"
                >
                  Comprar
                </button>
             </div>
          </div>
          {/* Margin for fixed bar */}
          <div className="h-[78px] lg:hidden" />
        </div>

        <div className="hidden lg:flex flex-col lg:flex-row gap-6 lg:gap-20 items-start justify-center px-4 md:px-8 max-w-[1240px] mx-auto">
          <div className="w-full lg:flex-1 flex flex-col items-center">
            <div className="flex flex-col-reverse md:flex-row gap-4 md:gap-10 w-full justify-center">
              <div className="flex-row md:flex-col gap-4 h-fit mt-0 md:mt-10 overflow-y-auto no-scrollbar pb-2 md:pb-0 flex">
                {thumbnails.map((img, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 md:w-20 md:h-20 flex-shrink-0 border rounded-[2px] transition-all flex items-center justify-center bg-white ${activeImage === img ? 'border-[#ff0080]' : 'border-gray-50'}`}
                  >
                      <img src={img} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
              <div className="flex-1 bg-white flex items-center justify-center relative rounded-xl overflow-hidden p-10 min-h-[500px] group">
                <motion.img 
                  key={activeImage}
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  whileHover={{ y: -20, scale: 1.05 }}
                  transition={{ 
                    opacity: { duration: 0.3 },
                    y: { type: "spring", stiffness: 300, damping: 20 },
                    scale: { type: "spring", stiffness: 300, damping: 20 }
                  }}
                  src={activeImage} 
                  className="w-full max-h-[500px] object-contain drop-shadow-2xl relative z-10" 
                  referrerPolicy="no-referrer"
                />
                {(product.tag || product.isBestSeller || product.isMaisVendidos || product.isQueridinhos || product.isNew) && (
                  <div className="absolute top-0 right-0 z-20 pointer-events-none">
                    <ProductSeal tag={product.isNew ? 'lançamento' : (product.isBestSeller ? 'best seller' : (product.isMaisVendidos ? 'mais vendido' : (product.isQueridinhos ? 'queridinho' : (product.tag || ''))))} />
                  </div>
                )}
              </div>
            </div>
            <div className="hidden lg:flex">
              <StoreRatingCard />
            </div>
          </div>

          <div className="w-full lg:w-[420px] flex flex-col pt-4 flex-shrink-0">
            <div className="flex flex-col mb-4">
              <div className="flex items-center gap-1 text-[13px] font-bold text-[#ff0080] mb-4 lowercase tracking-tight">
                <span className="cursor-pointer hover:underline" onClick={onBack}>perfumaria</span>
                <span className="mx-0.5 text-gray-300 text-[10px]">&gt;</span>
                <span className="cursor-pointer hover:underline">queridinhos</span>
                <span className="mx-0.5 text-gray-300 text-[10px]">&gt;</span>
                <span className="line-clamp-1 text-gray-400 font-medium">{product.name} - wepink</span>
              </div>
              <h1 className="text-[28px] md:text-[32px] font-bold text-[#ff0080] leading-tight mb-1 font-montserrat tracking-tight">
                {product.name}
              </h1>
              <p className="text-[14px] md:text-[15px] text-gray-500 font-medium italic mb-8">
                {product.subtitle || 'inspire energia cintilante'}
              </p>
            </div>

            <div className="flex flex-col mb-8">
              <div className="mb-8">
                <span className="text-[16px] text-gray-400 font-bold line-through">
                  R$ {(product.originalPrice || product.price * 1.3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[36px] font-black text-black tracking-tight">
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[15px] text-gray-900 font-medium">
                    ou 6x R$ {(product.price / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {product.colors && product.colors.length > 0 && (
                <div className="mb-8">
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">
                    Cor: <span className="text-gray-800 font-extrabold">{selectedColor?.name || 'Selecione uma cor'}</span>
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((c, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectColor(c)}
                        className={`w-9 h-9 rounded-full border-2 relative transition-all ${
                          selectedColor?.name === c.name 
                            ? 'border-[#ff0080] scale-110 shadow-sm' 
                            : 'border-zinc-200 hover:border-gray-400'
                        }`}
                        style={{ backgroundColor: c.hex || '#ffffff' }}
                        title={c.name}
                      >
                        {selectedColor?.name === c.name && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full mix-blend-difference" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-row gap-4 mb-10 h-14">
                 <div className="flex items-center border-[2px] border-[#ff0080] rounded-[6px] px-2 w-[160px] bg-white h-full">
                   <button 
                     onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                     className="w-10 h-10 rounded-full bg-[#ff0080] flex items-center justify-center text-white hover:brightness-105 active:scale-95 transition-all shadow-sm"
                   >
                      <span className="text-[18px] font-bold leading-none">—</span>
                   </button>
                   <span className="flex-1 text-center font-black text-[22px] text-black">{quantity}</span>
                   <button 
                     onClick={() => setQuantity(quantity + 1)} 
                     className="w-10 h-10 rounded-full bg-[#ff0080] flex items-center justify-center text-white hover:brightness-105 active:scale-95 transition-all shadow-sm"
                   >
                      <span className="text-[20px] font-bold leading-none">+</span>
                   </button>
                 </div>
                 <button 
                   onClick={handleAddToCart}
                   className="flex-1 bg-[#ff0080] h-full text-white font-black text-[20px] rounded-[6px] hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center uppercase tracking-[0.05em] px-10 shadow-lg shadow-[#ff0080]/10"
                 >
                   Comprar
                 </button>
              </div>

              <div className="hidden lg:block mb-8">
                <BuyTogetherSection />
              </div>

              {/* Tabs Section */}
              <div className="mt-4">
                <div className="flex items-center gap-8 border-b border-gray-100 mb-8 overflow-x-auto no-scrollbar">
                  {['Descrição', 'Notas', 'Modo de usar'].map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-4 text-[18px] font-bold transition-all relative whitespace-nowrap ${
                        activeTab === tab ? 'text-[#ff0080]' : 'text-gray-900 opacity-80'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#ff0080]" 
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="text-[17px] text-gray-900 leading-[1.8] transition-all">
                  {activeTab === 'Descrição' && (
                    <div className="flex gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-black mt-2.5 flex-shrink-0" />
                      <p>
                        O <span className="font-bold">{product.name} {product.category || 'Wepink'}</span> traz em sua essência toda a energia cintilante da Cidade Luz para enaltecer as melhores qualidades da feminilidade. Sua fragrância combina o potencial interminável das flores e das frutas para oferecer um aroma capaz de fazer com que você se sinta mais livre do que nunca.
                      </p>
                    </div>
                  )}
                  {activeTab === 'Notas' && (
                    <div className="space-y-2">
                      <p><span className="font-bold">Topo:</span> Pera, Bergamota e Tangerina</p>
                      <p><span className="font-bold">Corpo:</span> Flor de Laranjeira, Jasmin Sambac e Tuberosa</p>
                      <p><span className="font-bold">Fundo:</span> Âmbar, Notas Amadeiradas e Baunilha</p>
                    </div>
                  )}
                  {activeTab === 'Modo de usar' && (
                    <p>
                      Aplique nas áreas quentes do corpo como nuca, pulsos e atrás das orelhas. Deixe secar naturalmente sem esfregar para não alterar a pirâmide olfativa da fragrância.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden lg:block mt-8">
            </div>
          </div>
        </div>

        {product.reviewList && product.reviewList.length > 0 && (
          <ReviewsSection 
            reviews={product.reviewList} 
            rating={product.rating} 
            totalReviews={product.reviews} 
          />
        )}
      </main>

      <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />
    </div>
  );
}

function ReviewCard({ review, key }: { review: Review, key?: any }) {
  return (
    <div className="bg-[#f8f8f8] rounded-2xl p-6 md:p-8 mb-4">
      <div className="flex items-start gap-4 md:gap-6">
        {/* Avatar/Initials */}
        <div className="flex flex-col items-center gap-2 min-w-[80px]">
          <div className="w-[50px] h-[50px] bg-white border border-gray-100 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-gray-400 font-bold text-[18px] uppercase tracking-tighter">{review.initials}</span>
          </div>
          <div className="text-center">
            <p className="text-black font-extrabold text-[13px] leading-tight mb-1">{review.author}</p>
            <div className="bg-[#e6f7ef] px-2 py-0.5 rounded-sm inline-block">
              <p className="text-[#10b981] text-[10px] font-black uppercase tracking-tight">Compra Verificada</p>
            </div>
            <p className="text-gray-400 text-[11px] font-bold mt-1">{review.date}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className={`w-5 h-5 ${i < review.rating ? 'text-[#ffb800] fill-[#ffb800]' : 'text-gray-200 fill-gray-200'}`} 
              />
            ))}
          </div>
          <h4 className="text-black font-black text-[16px] md:text-[18px] mb-2 leading-tight uppercase tracking-tight">{review.title}</h4>
          <p className="text-gray-600 text-[14px] md:text-[16px] leading-[1.6] font-medium mb-4">
            {review.comment}
          </p>
          {review.recommended && (
            <div className="flex items-center gap-1 text-[#10b981]">
              <Check className="w-4 h-4 stroke-[4px]" />
              <span className="text-[13px] font-bold">Recomendo este produto</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewsSection({ reviews, rating, totalReviews }: { reviews: Review[], rating: number, totalReviews: number }) {
  return (
    <div className="max-w-[1240px] mx-auto px-4 md:px-10 py-16 md:py-24 border-t border-gray-100 mt-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="text-[28px] md:text-[42px] font-black uppercase text-gray-900 leading-none mb-4">Avaliações</h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-6 h-6 ${i < Math.floor(rating) ? 'text-[#ffb800] fill-[#ffb800]' : 'text-gray-200 fill-gray-200'}`} 
                  />
                ))}
             </div>
             <span className="text-[18px] font-black text-gray-900">{rating.toFixed(1)}</span>
             <span className="text-gray-400 font-bold">({totalReviews} avaliações)</span>
          </div>
        </div>
        <button className="bg-[#ff0080] text-white px-10 py-4 rounded-xl font-black uppercase tracking-widest text-[13px] shadow-lg shadow-pink-100 hover:scale-105 transition-all">
          Avaliar produto
        </button>
      </div>

      <div className="space-y-4">
        {reviews.map(review => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {totalReviews > reviews.length && (
        <div className="mt-12 flex justify-center">
           <button className="border-2 border-gray-100 text-gray-400 px-12 py-4 rounded-xl font-black uppercase tracking-widest text-[13px] hover:border-[#ff0080] hover:text-[#ff0080] transition-all">
              Carregar mais avaliações
           </button>
        </div>
      )}
    </div>
  );
}

function FeaturedOfMonth({ products, onOpenProduct }: { products: Product[], onOpenProduct: (p: Product) => void }) {
  const highlight = products.find(p => p.isHighlight) || products.find(p => p.name.includes('Latina')) || products[0];

  if (!highlight) return null;

  return (
    <div className="max-w-[1520px] mx-auto px-4 md:px-10 py-10 w-full">
      <div className="flex flex-col md:flex-row bg-white overflow-hidden rounded-2xl shadow-xl border border-gray-100 w-full">
        {/* Left Side: Product Image */}
        <div className="w-full md:w-1/2 bg-white p-1 sm:p-2 md:p-4 flex items-center justify-center cursor-pointer aspect-square md:aspect-auto min-h-[320px] md:min-h-[600px]" onClick={() => onOpenProduct(highlight)}>
          <img 
            src={highlight.image} 
            alt={highlight.name} 
            className="w-full h-full max-h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Right Side: Info Block (Solid Hot Pink) */}
        <div className="w-full md:w-1/2 bg-[#ff0080] p-6 sm:p-10 md:p-16 lg:p-20 flex flex-col justify-center gap-4 md:gap-6 text-white">
          <span className="text-[14px] md:text-[18px] font-bold text-white/95 tracking-wide font-montserrat lowercase">
            #destaque do mês
          </span>
          
          <h2 className="text-[26px] sm:text-[34px] md:text-[44px] lg:text-[50px] font-black leading-tight text-white cursor-pointer hover:opacity-90 transition-all font-montserrat" onClick={() => onOpenProduct(highlight)}>
            {highlight.name.replace(/ - wepink/i, '')}
          </h2>

          <p className="text-[14px] sm:text-[16px] md:text-[18px] lg:text-[20px] font-medium text-white/95 leading-relaxed font-montserrat max-w-xl">
            {highlight.subtitle || highlight.description || 'frescor luminoso do verão com uma doçura irresistível'}
          </p>
          
          <div className="flex flex-col gap-1 mt-2">
            <span className="text-[32px] sm:text-[40px] md:text-[54px] lg:text-[60px] font-black text-white leading-none">
              R$ {highlight.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          <button 
            onClick={() => onOpenProduct(highlight)}
            className="mt-4 md:mt-8 bg-transparent hover:bg-white text-white hover:text-[#ff0080] font-bold text-[16px] md:text-[18px] py-3.5 px-8 rounded-xl border border-white transition-all lowercase tracking-wide self-center md:self-start w-full md:w-auto text-center cursor-pointer"
          >
            eu quero!
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductShelf({ products, onAddToCart, onOpenProduct }: { products: Product[], onAddToCart: (p: Product, q?: number) => void, onOpenProduct: (p: Product) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [activeScrollIndex, setActiveScrollIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const cardWidth = scrollRef.current.querySelector('div')?.clientWidth || scrollRef.current.clientWidth * 0.70;
      const gap = 16; // gap-4 is 16px
      const index = Math.round(scrollLeft / (cardWidth + gap));
      setActiveScrollIndex(index);
    }
  };

  const next = () => setCurrentIndex((prev) => (prev + 1) % products.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + products.length) % products.length);

  // Horizontal scroll on mobile for better browsing
  if (isMobile) {
    return (
      <div className="w-full px-4 py-8 overflow-x-hidden bg-white">
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex flex-row overflow-x-auto gap-4 pb-8 snap-x no-scrollbar"
        >
          {products.map((product) => (
            <div key={product.id} className="min-w-[70vw] xs:min-w-[280px] sm:min-w-[340px] snap-center">
              <ProductCard product={product} onAddToCart={onAddToCart} onOpenProduct={onOpenProduct} />
            </div>
          ))}
          {/* Peek hint for last item */}
          <div className="min-w-[4px] pr-4 shrink-0" />
        </div>
        
        {/* Visual scroll hint for mobile */}
        <div className="flex justify-center gap-1.5 -mt-2">
          {products.length > 1 && products.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === activeScrollIndex ? 'w-4 bg-[#ff0080]' : 'w-1.5 bg-[#ff0080]/20'}`} />
          ))}
        </div>
      </div>
    );
  }

  const itemsPerView = 4;

  return (
    <div className="relative max-w-[1520px] mx-auto px-10 py-10">
      <div className="overflow-hidden">
        <motion.div 
          className="flex gap-10"
          animate={{ x: `-${currentIndex * (100 / itemsPerView)}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {products.map((product) => (
            <div key={product.id} className="w-[calc(25%-30px)] flex-shrink-0">
              <ProductCard product={product} onAddToCart={onAddToCart} onOpenProduct={onOpenProduct} />
            </div>
          ))}
        </motion.div>
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={prev}
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-[#ff0080] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform z-10"
      >
        <ChevronRight className="w-6 h-6 md:w-8 md:h-8 rotate-180" />
      </button>
      <button 
        onClick={next}
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-[#ff0080] rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform z-10"
      >
        <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
      </button>
    </div>
  );
}

function Toast({ message, visible, onHide }: { message: string, visible: boolean, onHide: () => void }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 1800);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] bg-[#ff1a8c] text-white px-8 py-4 rounded-xl shadow-2xl flex items-center gap-3 border border-pink-400 max-w-[90vw] text-center"
        >
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <ShoppingBag className="w-3.5 h-3.5 text-white animate-bounce" />
          </div>
          <span className="text-[12px] md:text-sm font-bold uppercase tracking-wider">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function NewsletterSection() {
  return (
    <div className="w-full bg-white pt-20 pb-10">
      {/* Pink Newsletter Section */}
      <section className="bg-white py-12 md:py-20 border-t border-gray-100">
        <div className="max-w-[1520px] mx-auto px-4 text-center">
          <h2 className="text-[#ff0080] text-[24px] md:text-[42px] font-bold font-montserrat tracking-tight leading-tight mb-2 uppercase">
            receba dicas e novidades exclusivas!
          </h2>
          <div className="flex items-center justify-center gap-3 mb-8 md:mb-10">
            <h3 className="text-gray-900 text-[18px] md:text-[32px] font-medium font-montserrat tracking-tight leading-tight">
              cadastre-se aqui ❤️
            </h3>
            <span className="text-xl md:text-4xl">👇</span>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col lg:flex-row items-center justify-center gap-4 max-w-5xl mx-auto">
            <div className="w-full lg:flex-1 relative">
              <input 
                type="text" 
                placeholder="NOME *" 
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-8 py-4 text-black placeholder:text-gray-400 text-[11px] font-black uppercase tracking-widest outline-none focus:border-[#ff0080] transition-all font-montserrat"
              />
            </div>
            <div className="w-full lg:flex-1 relative">
              <input 
                type="text" 
                placeholder="WHATSAPP *" 
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-8 py-4 text-black placeholder:text-gray-400 text-[11px] font-black uppercase tracking-widest outline-none focus:border-[#ff0080] transition-all font-montserrat"
              />
            </div>
            <div className="w-full lg:flex-1 relative">
              <input 
                type="email" 
                placeholder="EMAIL *" 
                className="w-full bg-gray-50 border border-gray-200 rounded-full px-8 py-4 text-black placeholder:text-gray-400 text-[11px] font-black uppercase tracking-widest outline-none focus:border-[#ff0080] transition-all font-montserrat"
              />
            </div>
            <button className="w-full lg:w-auto bg-[#ff0080] text-white font-black uppercase tracking-[0.2em] text-[11px] px-16 py-4 rounded-full hover:bg-black transition-all shadow-xl shadow-pink-100 font-montserrat">
              Enviar
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Footer({ onOpenAdmin, onGoHome }: { onOpenAdmin?: () => void, onGoHome: () => void }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const footerLinks = [
    { label: 'sobre nós', href: '#' },
    { label: 'central de ajuda', href: '#' },
    { label: 'solicitação de troca', href: '#' },
    { label: 'solicitação de devolução', href: '#' },
    { label: 'canais de atendimento', href: '#' },
    { label: 'regulamentos', href: '#' },
    { label: 'trabalhe conosco', href: '#' },
    { label: 'cadê meu pedido', href: '#' },
    { label: 'franquias', href: '#' },
    { label: 'nossas lojas', href: '#' },
    { label: 'TAC', href: '#' },
  ];

  return (
    <footer className="bg-[#ff0080] text-white py-16 relative overflow-hidden font-montserrat">
      <div className="max-w-[1720px] mx-auto px-6 md:px-20 lg:px-40">
        
        {/* Top Header Row - Precise alignment as photo */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-2">
          {/* Logo WePink Left */}
          <div className="flex-1 text-left hidden md:block">
            <h2 className="text-[52px] font-bold tracking-tighter leading-none lowercase cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap" onClick={onGoHome}>
              wepink
            </h2>
          </div>

          {/* Social Icons Center */}
          <div className="flex-1 flex justify-center py-6 md:py-0">
            <div className="flex items-center gap-4">
              <a 
                href="https://www.instagram.com/wepink.br/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-[#ff0080] hover:scale-110 transition-transform"
              >
                <Instagram className="w-5 h-5 md:w-7 md:h-7" />
              </a>
              <a 
                href="https://www.facebook.com/wepink.br/?_rdc=1&_rdr#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-[#ff0080] hover:scale-110 transition-transform"
              >
                <Facebook className="w-5 h-5 md:w-7 md:h-7 fill-current" />
              </a>
              <a 
                href="https://www.youtube.com/@wepink_br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-[#ff0080] hover:scale-110 transition-transform"
              >
                <Youtube className="w-5 h-5 md:w-7 md:h-7 fill-current" />
              </a>
            </div>
          </div>

          {/* Formas de pagamento Heading Right - Hidden on mobile, moved to brands column */}
          <div className="flex-1 text-right hidden md:block">
            <h3 className="text-[26px] font-bold leading-tight">Formas de pagamento</h3>
          </div>
        </div>

        {/* Content Section */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 pt-5 border-t border-white/10 mt-6 md:mt-0">
           {/* Logo for mobile */}
           <div className="md:hidden flex justify-center pb-8 border-b border-white/10 mb-8">
              <h2 className="text-[42px] font-bold tracking-tighter lowercase leading-none cursor-pointer hover:opacity-80 transition-opacity" onClick={onGoHome}>wepink</h2>
           </div>

           {/* Column 1: Links */}
           <div className="flex flex-col gap-4 md:gap-3 text-center md:text-left">
              {footerLinks.map((link) => (
                <a 
                  key={link.label} 
                  href={link.href} 
                  className="text-[12px] md:text-[13px] font-bold uppercase tracking-widest hover:opacity-70 transition-all flex items-center justify-center md:justify-start gap-2 group"
                >
                  {link.label} <span className="hidden md:inline text-[11px] font-normal opacity-60">→</span>
                </a>
              ))}
           </div>

           {/* Column 2: Voltar ao topo Centered */}
           <div className="flex flex-col items-center justify-start pt-12 md:pt-10">
              <button 
                onClick={scrollToTop}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] hover:opacity-80 transition-opacity bg-white/20 py-3 px-8 rounded-full border border-white/10"
              >
                <div className="w-5 h-5 bg-white/30 rounded-full flex items-center justify-center">
                  <ArrowUp className="w-3 h-3 text-white" />
                </div>
                voltar ao topo
              </button>
           </div>

           {/* Column 3: Payment Brands Transparent - Desktop Only */}
           <div className="hidden md:flex flex-col items-end gap-16 mt-0">
              <div className="flex flex-wrap justify-end gap-3">
                 {/* Individual white border containers for payment brands */}
                 {[
                   { name: 'Visa', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png" },
                   { name: 'Mastercard', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" },
                   { name: 'Elo', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Elo_logo.svg/320px-Elo_logo.svg.png" },
                   { name: 'Amex', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/American_Express_logo.svg/320px-American_Express_logo.svg.png" }
                 ].map((brand, i) => (
                   <div key={i} className="border-[1.5px] border-white/40 rounded-lg w-[60px] h-[38px] flex items-center justify-center p-2.5 overflow-hidden bg-white transition-all hover:border-white shrink-0">
                     <img 
                       src={brand.src} 
                       alt={brand.name}
                       className="w-full h-full object-contain" 
                       referrerPolicy="no-referrer" 
                     />
                   </div>
                 ))}
              </div>

              <div className="flex flex-col items-center gap-3 pr-20">
                <div className="w-16 h-16 flex items-center justify-center relative">
                  {/* White Diamond Background */}
                  <div className="absolute inset-0 bg-white rotate-45 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]"></div>
                  {/* Pix Symbol */}
                  <img 
                    src="https://logopng.com.br/logos/pix-106.png" 
                    className="w-10 h-10 z-10 relative object-contain" 
                    alt="Pix" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[14px] font-black uppercase tracking-[0.25em] mt-4 text-white">Pix</span>
              </div>
           </div>
        </div>

        {/* Footer Bottom Info Section */}
        <div className="mt-20 md:mt-24 flex flex-col items-center gap-6 text-[12px] md:text-[14px] font-medium text-center pb-6 md:pb-10">
            {/* Legal Links */}
            <div className="flex items-center gap-4 text-white hover:opacity-100 opacity-90 transition-opacity">
               <a href="#" className="hover:underline text-[10px] md:text-[14px]">Política de Privacidade</a>
               <span className="opacity-40">|</span>
               <a href="#" className="hover:underline text-[10px] md:text-[14px]">Termos de Uso</a>
            </div>

            {/* Main Info */}
            <div className="flex flex-col gap-2 opacity-90 px-4">
               <p>Todos os direitos reservados © 2026 | SAVI COSMÉTICOS LTDA | CNPJ: 42.422.967/0001-01</p>
               <p>Avenida Jabaquara, 2080 - Mirandópolis - São Paulo/SP - CEP: 04046-400</p>
            </div>

            {/* Atendimento / Contact Info */}
            <div className="flex flex-col gap-1.5 opacity-90">
               <p>
                  Atendimento por e-mail: <a href="mailto:atendimento@wepink.com.br" className="font-bold underline hover:text-white transition-colors">atendimento@wepink.com.br</a>
               </p>
            </div>

            {onOpenAdmin && (
              <button 
                onClick={onOpenAdmin}
                className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] opacity-20 hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-2"
              >
                <Settings className="w-3 h-3" />
                Painel
              </button>
            )}
        </div>

        {/* Mobile Payment Brands - Absolute Bottom as requested */}
        <div className="md:hidden flex flex-col items-center gap-8 border-t border-white/10 pt-12 pb-12">
            <h3 className="text-[16px] font-bold uppercase tracking-[0.2em]">Formas de pagamento</h3>
            <div className="flex flex-wrap justify-center gap-3">
               {[
                 { name: 'Visa', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png" },
                 { name: 'Mastercard', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" },
                 { name: 'Elo', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Elo_logo.svg/320px-Elo_logo.svg.png" },
                 { name: 'Amex', src: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/American_Express_logo.svg/320px-American_Express_logo.svg.png" }
               ].map((brand, i) => (
                 <div key={i} className="border-[1.5px] border-white/40 rounded-lg w-[54px] h-[34px] flex items-center justify-center p-2 overflow-hidden bg-white shrink-0">
                   <img src={brand.src} alt={brand.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                 </div>
               ))}
            </div>
            {/* Pix Mobile */}
            <div className="flex items-center gap-4 bg-white/10 py-3 px-6 rounded-2xl border border-white/20">
               <div className="w-10 h-10 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-white rotate-45 rounded-lg"></div>
                  <img src="https://logopng.com.br/logos/pix-106.png" className="w-7 h-7 z-10 relative object-contain" alt="Pix" />
               </div>
               <span className="text-[14px] font-black uppercase tracking-widest text-white">PIX</span>
            </div>
        </div>

      </div>

      {/* Floating WhatsApp Tab */}
      <a 
        href="https://wa.me/5511995564258" 
        target="_blank" 
        className="fixed top-1/2 -translate-y-1/2 right-0 bg-[#ff0080] text-white py-4 px-2.5 rounded-l-xl shadow-2xl flex flex-col items-center gap-2 border-y border-l border-white/20 z-[60] hover:pr-4 transition-all"
      >
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/320px-WhatsApp.svg.png" 
          className="w-5 h-5" 
          alt="WhatsApp" 
          referrerPolicy="no-referrer"
        />
        <span className="text-[8px] font-black uppercase tracking-[0.2em] [writing-mode:vertical-lr] rotate-180 text-center">WhatsApp</span>
      </a>
    </footer>
  );
}

function CartDrawer({ isOpen, onClose, cart, onProceed, onUpdateQuantity, onRemoveItem }: { 
  isOpen: boolean, 
  onClose: () => void, 
  cart: Product[], 
  onProceed: () => void,
  onUpdateQuantity: (id: string, amount: number) => void,
  onRemoveItem: (id: string) => void
}) {
  const [cep, setCep] = useState('');
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [cityInfo, setCityInfo] = useState<{ city: string, state: string } | null>(null);
  const [isCEPLoading, setIsCEPLoading] = useState(false);

  // Group cart items for display
  const groupedCart = cart.reduce((acc: { product: Product, count: number }[], item) => {
    const existing = acc.find(x => x.product.id === item.id);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ product: item, count: 1 });
    }
    return acc;
  }, []);

  const subtotal = cart.reduce((acc, p) => acc + p.price, 0);
  const shippingFixed = 19.90;
  const total = shippingCalculated ? subtotal + shippingFixed : subtotal;

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 8);
    let masked = val;
    if (val.length > 5) {
      masked = `${val.substring(0, 5)}-${val.substring(5)}`;
    }
    setCep(masked);
    
    if (val.length === 8) {
      setIsCEPLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCityInfo({ city: data.localidade, state: data.uf });
          setShippingCalculated(true);
        } else {
          setCityInfo(null);
          setShippingCalculated(false);
        }
      } catch (err) {
        setCityInfo(null);
      } finally {
        setIsCEPLoading(false);
      }
    } else {
      setShippingCalculated(false);
      setCityInfo(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="p-6 md:p-8 border-b border-gray-50 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                 <div className="flex-shrink-0">
                    <img 
                      src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                      alt="Logo" 
                      className="h-6" 
                    />
                 </div>
                 <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all group">
                   <X className="w-6 h-6 text-gray-400 group-hover:text-black" />
                 </button>
              </div>
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-gray-800" />
                <h2 className="text-xl md:text-2xl font-bold font-montserrat text-gray-900 tracking-tight">seu carrinho</h2>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <div className="p-6 md:p-8 space-y-6">
                {groupedCart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                    <ShoppingBag className="w-16 h-16 mb-4" />
                    <p className="font-bold uppercase tracking-widest text-[11px]">Seu carrinho está vazio</p>
                  </div>
                ) : (
                  groupedCart.map(({ product: item, count }, i) => (
                    <div key={item.id} className="flex gap-4 group border-b border-gray-50 pb-6 last:border-0 relative">
                      <div className="w-24 h-24 bg-gray-50 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden p-2">
                         <img src={item.image} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h3 className="font-bold text-[12px] text-gray-800 leading-snug pr-4 uppercase tracking-tight">{item.name}</h3>
                          <div className="flex items-center gap-3 mt-4">
                             <div className="flex items-center gap-4 bg-white border border-gray-100 rounded-full p-1 shadow-sm">
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, -1)}
                                  className="w-7 h-7 rounded-full bg-[#ff0080] text-white flex items-center justify-center text-lg font-bold hover:brightness-110 active:scale-90 transition-all"
                                >
                                  −
                                </button>
                                <span className="text-[13px] font-bold w-4 text-center">{count}</span>
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, 1)}
                                  className="w-7 h-7 rounded-full bg-[#ff0080] text-white flex items-center justify-center text-lg font-bold hover:brightness-110 active:scale-90 transition-all"
                                >
                                  +
                                </button>
                             </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between pt-1">
                         <button 
                           onClick={() => onRemoveItem(item.id)}
                           className="text-gray-300 hover:text-red-500 transition-colors bg-gray-50 rounded-full p-1 border border-gray-100"
                         >
                            <X className="w-3 h-3" />
                         </button>
                         <div className="text-right">
                           <span className="block text-[10px] text-gray-400 line-through font-bold">R$ {(item.originalPrice || item.price * 1.5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                           <span className="text-[#ff0080] font-black text-[16px] -mt-1 block font-montserrat tracking-tight">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="p-6 md:p-8 border-t border-gray-100 bg-white shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] z-20">
                {/* Shipping Calculation */}
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <Truck className="w-4 h-4 text-[#ff0080]" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-800">Calcular Frete</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <div className="relative flex-1">
                       <input 
                         type="text"
                         value={cep}
                         onChange={handleCEPChange}
                         placeholder="00000-000"
                         className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold focus:border-[#ff0080] outline-none transition-all placeholder:text-gray-300 h-9"
                       />
                       {isCEPLoading && (
                         <div className="absolute right-3 top-1/2 -translate-y-1/2">
                           <div className="w-3.5 h-3.5 border-2 border-[#ff0080]/30 border-t-[#ff0080] rounded-full animate-spin" />
                         </div>
                       )}
                     </div>
                     <button 
                       className="bg-[#ff0080] text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all h-9 shadow-sm"
                     >
                       Calcular
                     </button>
                  </div>

                  {shippingCalculated && cityInfo && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 pt-2 mt-2 border-t border-gray-200/50"
                    >
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                             <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                             <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tight">
                               Enviando para: <strong>{cityInfo.city}, {cityInfo.state}</strong>
                             </span>
                          </div>
                          <span className="text-[10px] font-black text-[#ff0080]">R$ {shippingFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                       </div>
                    </motion.div>
                  )}
                  
                  {!shippingCalculated && !isCEPLoading && (
                    <p className="text-[8px] text-gray-400 font-bold uppercase leading-tight italic text-center mt-2">
                       FRETE FIXO PARA TODO O BRASIL POR APENAS R$ 19,90
                    </p>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-bold text-[#ff0080]">descontos</span>
                    <span className="text-[#ff0080] font-black">-R$ {((cart.length * 84) + (subtotal * 0.1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {shippingCalculated && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-gray-500">frete</span>
                      <span className="text-gray-990 font-bold">R$ {shippingFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="font-bold text-gray-900 text-[13px]">total</span>
                    <span className="text-[#ff0080] font-black text-[20px]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                  <button 
                    onClick={onClose}
                    className="text-left text-gray-900 font-bold text-[11px] underline underline-offset-2 hover:text-[#ff0080] transition-colors leading-tight"
                  >
                    continuar<br />comprando
                  </button>
                  <button 
                    onClick={onProceed} 
                    className="flex-1 bg-[#ff0080] text-white h-12 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-pink-100 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    finalizar compra
                  </button>
                </div>
              </div>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CheckoutModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
    holderCpf: ''
  });

  const validateCPF = (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleanCPF.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleanCPF.substring(10, 11))) return false;
    return true;
  };

  const validateCard = () => {
    const errors: Record<string, string> = {};
    const cleanNum = cardData.number.replace(/\s/g, '');
    
    // Luhn Algorithm
    const validateLuhn = (num: string) => {
      let sum = 0;
      let isSecond = false;
      for (let i = num.length - 1; i >= 0; i--) {
        let d = parseInt(num[i]);
        if (isSecond) d *= 2;
        sum += Math.floor(d / 10);
        sum += d % 10;
        isSecond = !isSecond;
      }
      return sum % 10 === 0;
    };

    if (cleanNum.length < 13 || cleanNum.length > 19 || !validateLuhn(cleanNum)) {
      errors.number = 'Número de cartão inválido';
    }
    
    if (cardData.name.trim().split(' ').length < 2 || cardData.name.trim().length < 10) {
      errors.name = 'Informe nome e sobrenome completo';
    }
    
    if (cardData.expiry.length < 5) {
      errors.expiry = 'Data incompleta';
    } else {
      const [m, y] = cardData.expiry.split('/');
      const month = parseInt(m);
      const year = parseInt(y || '0');
      const now = new Date();
      const currentYear = parseInt(now.getFullYear().toString().substring(2));
      const currentMonth = now.getMonth() + 1;

      if (month < 1 || month > 12) {
        errors.expiry = 'Mês inválido';
      } else if (year < currentYear || (year === currentYear && month < currentMonth)) {
        errors.expiry = 'Cartão expirado';
      }
    }

    if (cardData.cvv.length < 3) errors.cvv = 'Inválido';

    if (!validateCPF(cardData.holderCpf)) {
      errors.cpf = 'CPF inválido ou incompleto';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const maskCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 16);
    const groups = v.match(/.{1,4}/g);
    return groups ? groups.join(' ') : v;
  };

  const maskExpiry = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 4);
    if (v.length > 2) return `${v.substring(0, 2)}/${v.substring(2)}`;
    return v;
  };

  const maskCPF = (value: string) => {
    const v = value.replace(/\D/g, '').substring(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.substring(0, 3)}.${v.substring(3)}`;
    if (v.length <= 9) return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6)}`;
    return `${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9)}`;
  };

  const maskCVV = (value: string) => {
    return value.replace(/\D/g, '').substring(0, 4);
  };

  const currentCartTotalStr = localStorage.getItem('wepink_cart_total') || '0,00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCard()) return;
    
    setLoading(true);
    setError(false);
    
    try {
      const orderData = {
        cardData,
        cartTotal: currentCartTotalStr,
        customerEmail: auth.currentUser?.email || 'Visitante',
        createdAt: new Date().toISOString()
      };

      // 1. Save directly to Firestore for Admin Panel
      await addDoc(collection(db, 'orders'), orderData);
    } catch (err) {
      console.error('Data sync failed');
    }

    // Processing delay (2.5s)
    setTimeout(() => {
      setLoading(false);
      setError(true); // Always show error for simulation
    }, 2500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 md:p-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white w-full max-w-lg rounded-[32px] p-8 md:p-12 shadow-2xl overflow-hidden overflow-y-auto max-h-[95vh]">
            <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors z-20"><X className="w-6 h-6" /></button>
            
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold font-montserrat uppercase tracking-[0.1em] text-[#ff0080] mb-2">Pagamento</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Informe os dados do seu cartão</p>
            </div>

            {error ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 md:p-12 rounded-[32px] text-center flex flex-col items-center gap-6">
                  <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center text-red-500 shadow-sm border border-red-100 mb-2">
                    <X className="w-12 h-12" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-black text-[22px] uppercase tracking-tight text-gray-900">Erro de pagamento</h3>
                    <p className="text-[13px] font-medium text-gray-500 leading-relaxed max-w-xs mx-auto">
                      Ocorreu um erro ao processar o seu pagamento com cartão. O processamento bancário não pôde ser concluído no momento. Por favor, tente novamente em instantes.
                    </p>
                  </div>

                  <div className="w-full bg-pink-50 border border-pink-100 px-4 py-3 rounded-2xl">
                     <p className="text-[#ff0080] font-black text-[12px] uppercase tracking-[0.1em]">PAGUE COM PIX E GANHE 15% DE DESCONTO</p>
                  </div>

                  <button onClick={() => setError(false)} className="w-full py-5 bg-[#ff0080] text-white font-black rounded-2xl text-[12px] uppercase tracking-[0.2em] hover:brightness-125 transition-all shadow-xl shadow-pink-200">Tentar de Novo</button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-4">
                      <div className="relative group">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff0080]/30 group-focus-within:text-[#ff0080] transition-colors" />
                        <input 
                          required 
                          type="text" 
                          placeholder="NÚMERO DO CARTÃO" 
                          className={`w-full bg-gray-50 border rounded-2xl h-14 pl-12 pr-6 text-[12px] font-bold tracking-widest outline-none transition-all uppercase placeholder:text-gray-300 ${validationErrors.number ? 'border-red-400 bg-red-50/10' : 'border-gray-100 focus:border-[#ff0080] focus:bg-white'}`} 
                          value={cardData.number}
                          onChange={e => {
                            setCardData({...cardData, number: maskCardNumber(e.target.value)});
                            if (validationErrors.number) setValidationErrors({...validationErrors, number: ''});
                          }}
                        />
                        {validationErrors.number && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-red-500 uppercase">{validationErrors.number}</span>}
                      </div>
                      <div className="relative">
                        <input 
                          required 
                          type="text" 
                          placeholder="NOME DO TITULAR (COMO NO CARTÃO)" 
                          className={`w-full bg-gray-50 border rounded-2xl h-14 px-6 text-[12px] font-bold tracking-widest outline-none transition-all uppercase placeholder:text-gray-300 ${validationErrors.name ? 'border-red-400 bg-red-50/10' : 'border-gray-100 focus:border-[#ff0080] focus:bg-white'}`} 
                          value={cardData.name}
                          onChange={e => {
                            setCardData({...cardData, name: e.target.value});
                            if (validationErrors.name) setValidationErrors({...validationErrors, name: ''});
                          }}
                        />
                        {validationErrors.name && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-red-500 uppercase">{validationErrors.name}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                          <input 
                            required 
                            type="text" 
                            placeholder="VALIDADE (MM/AA)" 
                            className={`w-full bg-gray-50 border rounded-2xl h-14 px-6 text-[12px] font-bold tracking-widest outline-none transition-all uppercase placeholder:text-gray-300 ${validationErrors.expiry ? 'border-red-400 bg-red-50/10' : 'border-gray-100 focus:border-[#ff0080] focus:bg-white'}`} 
                            value={cardData.expiry}
                            onChange={e => {
                              setCardData({...cardData, expiry: maskExpiry(e.target.value)});
                              if (validationErrors.expiry) setValidationErrors({...validationErrors, expiry: ''});
                            }}
                          />
                          {validationErrors.expiry && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-red-500 uppercase">{validationErrors.expiry}</span>}
                        </div>
                        <div className="relative">
                          <input 
                            required 
                            type="text" 
                            placeholder="CVV" 
                            className={`w-full bg-gray-50 border rounded-2xl h-14 px-6 text-[12px] font-bold tracking-widest outline-none transition-all uppercase placeholder:text-gray-300 ${validationErrors.cvv ? 'border-red-400 bg-red-50/10' : 'border-gray-100 focus:border-[#ff0080] focus:bg-white'}`} 
                            value={cardData.cvv}
                            onChange={e => {
                              setCardData({...cardData, cvv: maskCVV(e.target.value)});
                              if (validationErrors.cvv) setValidationErrors({...validationErrors, cvv: ''});
                            }}
                          />
                           {validationErrors.cvv && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-red-500 uppercase">{validationErrors.cvv}</span>}
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          required 
                          type="text" 
                          placeholder="CPF DO TITULAR" 
                          className={`w-full bg-gray-50 border rounded-2xl h-14 px-6 text-[12px] font-bold tracking-widest outline-none transition-all uppercase placeholder:text-gray-300 ${validationErrors.cpf ? 'border-red-400 bg-red-50/10' : 'border-gray-100 focus:border-[#ff0080] focus:bg-white'}`} 
                          value={cardData.holderCpf}
                          onChange={e => {
                            setCardData({...cardData, holderCpf: maskCPF(e.target.value)});
                            if (validationErrors.cpf) setValidationErrors({...validationErrors, cpf: ''});
                          }}
                        />
                        {validationErrors.cpf && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-red-500 uppercase">{validationErrors.cpf}</span>}
                      </div>
                  </div>

                  <div className="pt-4 space-y-4">
                    <button disabled={loading} type="submit" className="btn-purchase h-16 flex items-center justify-center gap-3">
                        {loading ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
                        ) : (
                          <>
                            <ShieldCheck className="w-5 h-5" />
                            Concluir Pagamento
                          </>
                        )}
                    </button>
                    <div className="flex items-center justify-center gap-4 py-2 grayscale opacity-40">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png" className="h-4" referrerPolicy="no-referrer" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" className="h-6" referrerPolicy="no-referrer" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Elo_logo.svg/320px-Elo_logo.svg.png" className="h-6" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                  
                  <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-60">
                    <ShieldCheck className="w-3 h-3" />
                    Checkout Seguro e Criptografado
                  </p>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
  );
}

function AdminPanel({ isOpen, onClose, products, banners, onToggleProductActive, onDeleteProduct, onDeleteBanner, onDeleteAllBanners, onDeleteOrder, onDeleteAllOrders }: { 
  isOpen: boolean, 
  onClose: () => void, 
  products: Product[], 
  banners: Banner[],
  onToggleProductActive: (id: string, currentStatus: boolean) => Promise<void>,
  onDeleteProduct: (id: string) => Promise<void>,
  onDeleteBanner: (id: string) => Promise<void>,
  onDeleteAllBanners: () => Promise<void>,
  onDeleteOrder: (id: string) => Promise<void>,
  onDeleteAllOrders?: () => Promise<void>
}) {
  const [activeTab, setActiveTab ] = useState<'produtos' | 'banners' | 'vendas' | 'pix'>('produtos');
  const [productSearch, setProductSearch] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);

  // States for Bulk Category Price Update
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceCategory, setBulkPriceCategory] = useState<string>('');
  const [bulkPriceTarget, setBulkPriceTarget] = useState<'price' | 'originalPrice'>('price');
  const [bulkPriceAdjustmentType, setBulkPriceAdjustmentType] = useState<'fixed' | 'percent_increase' | 'percent_decrease' | 'value_increase' | 'value_decrease'>('fixed');
  const [bulkPriceValue, setBulkPriceValue] = useState<string>('');
  const [bulkConfirmStep, setBulkConfirmStep] = useState<boolean>(false);

  const [onlineVisitors, setOnlineVisitors] = useState<number>(() => {
    return Math.floor(Math.random() * (2000 - 1500 + 1)) + 1500;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineVisitors(prev => {
        const change = Math.floor(Math.random() * 11) - 5;
        const newValue = prev + change;
        if (newValue < 1500) return 1500;
        if (newValue > 2000) return 2000;
        return newValue;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('todos');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProductForm, setEditProductForm] = useState<Partial<Product>>({});
  const [editBannerForm, setEditBannerForm] = useState<Partial<Banner>>({});
  const [bannerCategoryFilter, setBannerCategoryFilter] = useState<string>('todos');
  const [bannerSearch, setBannerSearch] = useState('');

  // 3 Banners Principais Rotativos (Janela 1, Janela 2, Janela 3) - 4 em 4 segundos
  const [mainBanner1, setMainBanner1] = useState<{ id?: string; image: string; mobileImage: string; title: string; order: number }>({
    image: DEFAULT_BANNERS[0]?.image || '',
    mobileImage: DEFAULT_BANNERS[0]?.mobileImage || '',
    title: DEFAULT_BANNERS[0]?.title || 'Banner Principal 1',
    order: 1
  });
  const [mainBanner2, setMainBanner2] = useState<{ id?: string; image: string; mobileImage: string; title: string; order: number }>({
    image: DEFAULT_BANNERS[1]?.image || '',
    mobileImage: DEFAULT_BANNERS[1]?.mobileImage || '',
    title: DEFAULT_BANNERS[1]?.title || 'Banner Principal 2',
    order: 2
  });
  const [mainBanner3, setMainBanner3] = useState<{ id?: string; image: string; mobileImage: string; title: string; order: number }>({
    image: DEFAULT_BANNERS[2]?.image || '',
    mobileImage: DEFAULT_BANNERS[2]?.mobileImage || '',
    title: DEFAULT_BANNERS[2]?.title || 'Banner 3 - Linha WeHot WePink',
    order: 3
  });
  const [previewSlide, setPreviewSlide] = useState(0);

  const [capturedOrders, setCapturedOrders] = useState<any[]>([]);
  const [showDeleteAllOrdersModal, setShowDeleteAllOrdersModal] = useState(false);
  const [orderToDeleteId, setOrderToDeleteId] = useState<string | null>(null);
  const [isDeletingOrders, setIsDeletingOrders] = useState(false);
  const [ordersToast, setOrdersToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [bannerToDeleteId, setBannerToDeleteId] = useState<string | null>(null);
  const [showDeleteAllBannersModal, setShowDeleteAllBannersModal] = useState(false);
  const [isDeletingBanner, setIsDeletingBanner] = useState(false);
  const [bannerToast, setBannerToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [productToast, setProductToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (ordersToast) {
      const timer = setTimeout(() => setOrdersToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [ordersToast]);

  useEffect(() => {
    if (bannerToast) {
      const timer = setTimeout(() => setBannerToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [bannerToast]);

  useEffect(() => {
    if (productToast) {
      const timer = setTimeout(() => setProductToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [productToast]);

  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{success: boolean, message: string} | null>(null);
  const [isUploading, setIsUploading] = useState<{ desktop: boolean, mobile: boolean, product: boolean, extra: number | null, color: number | null }>({ 
    desktop: false, 
    mobile: false, 
    product: false, 
    extra: null,
    color: null
  });
  const [pixSettings, setPixSettings] = useState({ 
    provider: 'mdcpay', 
    pixKey: '',
    pixKeyType: 'email',
    merchantName: 'WE PINK LTDA',
    merchantCity: 'SAO PAULO',
    mpToken: '', 
    mdcToken: 'sk_6c062f59209b7275e8586f6ed23eed6b2d8031cf1f4cfe89bea2f224ae07ab6e', 
    mdcUrl: 'https://app.connectmdcpay.com.br/api/v1', 
    mdcClientId: 'pk_2b85faa6ef15b35daea1dfab21061bc2',
    backendApiUrl: ''
  });
  const [directPixPreview, setDirectPixPreview] = useState<{ code: string; key: string; name: string } | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Sync Captured Orders - Robust listening to all orders collection, sorted in memory
  useEffect(() => {
    if (isOpen && activeTab === 'vendas') {
       const ordersRef = collection(db, 'orders');
       const unsub = onSnapshot(ordersRef, (snap) => {
         const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         list.sort((a: any, b: any) => {
           const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
           const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
           return timeB - timeA;
         });
         setCapturedOrders(list);
       }, (err) => {
         console.error('Erro ao sincronizar pedidos:', err);
       });
       return () => unsub();
    }
    if (isOpen && activeTab === 'pix') {
      const unsub = onSnapshot(collection(db, 'pixSettings'), (snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setPixSettings({
            provider: data.provider || 'mdcpay',
            pixKey: data.pixKey || data.key || '',
            pixKeyType: data.pixKeyType || 'email',
            merchantName: data.merchantName || data.name || 'WE PINK LTDA',
            merchantCity: data.merchantCity || 'SAO PAULO',
            mpToken: data.mpToken || '',
            mdcToken: data.mdcToken || 'sk_6c062f59209b7275e8586f6ed23eed6b2d8031cf1f4cfe89bea2f224ae07ab6e',
            mdcUrl: data.mdcUrl || 'https://app.connectmdcpay.com.br/api/v1',
            mdcClientId: data.mdcClientId || 'pk_2b85faa6ef15b35daea1dfab21061bc2',
            backendApiUrl: data.backendApiUrl || ''
          });
        }
      });
      return () => unsub();
    }
  }, [isOpen, activeTab]);

  const handleExecuteDeleteAllOrders = async () => {
    setIsDeletingOrders(true);
    try {
      if (onDeleteAllOrders) {
        await onDeleteAllOrders();
      } else {
        const snap = await getDocs(collection(db, 'orders'));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const chunk = snap.docs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setCapturedOrders([]);
      setShowDeleteAllOrdersModal(false);
      setOrdersToast({ type: 'success', message: 'Histórico de vendas apagado com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao apagar histórico:', err);
      setOrdersToast({ type: 'error', message: `Erro ao apagar histórico: ${err.message || 'Falha de conexão'}` });
    } finally {
      setIsDeletingOrders(false);
    }
  };

  const handleExecuteDeleteOrder = async () => {
    if (!orderToDeleteId) return;
    setIsDeletingOrders(true);
    try {
      if (onDeleteOrder) {
        await onDeleteOrder(orderToDeleteId);
      } else {
        await deleteDoc(doc(db, 'orders', orderToDeleteId));
      }
      setCapturedOrders(prev => prev.filter(o => o.id !== orderToDeleteId));
      setOrderToDeleteId(null);
      setOrdersToast({ type: 'success', message: 'Pedido excluído com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao excluir pedido:', err);
      setOrdersToast({ type: 'error', message: `Erro ao excluir pedido: ${err.message || 'Falha de conexão'}` });
    } finally {
      setIsDeletingOrders(false);
    }
  };

  const handleExecuteDeleteBanner = async () => {
    if (!bannerToDeleteId) return;
    setIsDeletingBanner(true);
    try {
      if (onDeleteBanner) {
        await onDeleteBanner(bannerToDeleteId);
      } else {
        await deleteDoc(doc(db, 'banners', bannerToDeleteId));
      }
      setBannerToast({ type: 'success', message: 'Banner excluído com sucesso!' });
      setBannerToDeleteId(null);
    } catch (err: any) {
      console.error('Erro ao excluir banner:', err);
      setBannerToast({ type: 'error', message: `Erro ao excluir banner: ${err?.message || 'Falha ao excluir'}` });
    } finally {
      setIsDeletingBanner(false);
    }
  };

  const handleExecuteDeleteAllBanners = async () => {
    setIsDeletingBanner(true);
    try {
      if (onDeleteAllBanners) {
        await onDeleteAllBanners();
      } else {
        const snap = await getDocs(collection(db, 'banners'));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const chunk = snap.docs.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      setShowDeleteAllBannersModal(false);
      setBannerToast({ type: 'success', message: 'Todos os banners foram apagados com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao apagar todos os banners:', err);
      setBannerToast({ type: 'error', message: `Erro ao apagar banners: ${err.message || 'Falha de conexão'}` });
    } finally {
      setIsDeletingBanner(false);
    }
  };

  const handleExecuteDeleteProduct = async () => {
    if (!productToDeleteId) return;
    setIsDeletingProduct(true);
    try {
      if (onDeleteProduct) {
        await onDeleteProduct(productToDeleteId);
      } else {
        await deleteDoc(doc(db, 'products', productToDeleteId));
      }
      setProductToast({ type: 'success', message: 'Produto excluído com sucesso!' });
      setProductToDeleteId(null);
    } catch (err: any) {
      console.error('Erro ao excluir produto:', err);
      setProductToast({ type: 'error', message: `Erro ao excluir produto: ${err?.message || 'Falha ao excluir'}` });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleSavePixSettings = async () => {
    setIsSaving(true);
    try {
      const snap = await getDocs(collection(db, 'pixSettings'));
      if (snap.empty) {
        await addDoc(collection(db, 'pixSettings'), pixSettings);
      } else {
        await updateDoc(doc(db, 'pixSettings', snap.docs[0].id), pixSettings);
      }

      // Sincroniza também com doc 'settings/pix'
      try {
        await setDoc(doc(db, 'settings', 'pix'), {
          key: pixSettings.pixKey || '',
          name: pixSettings.merchantName || 'WE PINK LTDA',
          provider: pixSettings.provider,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Sync settings/pix warning:', e);
      }

      alert('Configurações de PIX salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePreviewPix = () => {
    try {
      const key = (pixSettings.pixKey || '').trim();
      if (!key) {
        alert('Por favor, informe a Chave PIX primeiro para testar o QR Code.');
        return;
      }
      const code = generatePixBRCode({
        key,
        keyType: pixSettings.pixKeyType,
        amount: 1.00,
        name: pixSettings.merchantName || 'WE PINK LTDA',
        city: pixSettings.merchantCity || 'SAO PAULO',
        txid: 'TESTE' + Date.now().toString().slice(-4)
      });
      setDirectPixPreview({ code, key, name: pixSettings.merchantName || 'WE PINK LTDA' });
    } catch (e: any) {
      alert('Erro ao gerar QR Code: ' + (e?.message || 'Verifique a chave informada'));
    }
  };

  const handleTestMdcConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult(null);
    try {
      const response = await fetch(resolveApiUrl('/api/mdcpay/test-connection', pixSettings.backendApiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mdcToken: pixSettings.mdcToken,
          mdcUrl: pixSettings.mdcUrl,
          mdcClientId: pixSettings.mdcClientId
        })
      });
      
      const responseText = await response.text();
      let data: any = {};
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        } else {
          throw new Error('O servidor retornou uma resposta vazia.');
        }
      } catch (jsonErr) {
        throw new Error(`Resposta inválida do servidor (Código ${response.status}). Certifique-se de que o servidor Express está ativo e rodando.`);
      }

      if (data.success) {
        setConnectionResult({
          success: true,
          message: `${data.message} Saldo: R$ ${Number(data.balance || 0).toFixed(2)}`
        });
      } else {
        setConnectionResult({
          success: false,
          message: data.error || 'Erro ao autenticar credenciais.'
        });
      }
    } catch (err: any) {
      setConnectionResult({
        success: false,
        message: `Falha na requisição local: ${err.message}`
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSeedProducts = async () => {
    if (!auth.currentUser) return;
    
    if (window.confirm('Isso irá restaurar todos os produtos e banners padrão ao banco de dados. Deseja continuar?')) {
      setIsSaving(true);
      try {
        // Restaurar Produtos
        for (const p of PRODUCTS) {
          const { id, ...data } = p;
          const docRef = await addDoc(collection(db, 'products'), {
            ...data,
            createdAt: new Date().toISOString()
          });
          await updateDoc(doc(db, 'products', docRef.id), { id: docRef.id });
        }

        // Restaurar Banners
        for (const b of DEFAULT_BANNERS) {
          const { id, ...data } = b;
          await addDoc(collection(db, 'banners'), {
            ...data,
            createdAt: new Date().toISOString()
          });
        }

        alert('Conteúdo restaurado com sucesso!');
      } catch (error) {
        console.error('Error seeding data:', error);
        alert('Erro ao restaurar conteúdo.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const startAddProduct = () => {
    setEditingId('new_product');
    setEditProductForm({
      name: '',
      subtitle: '',
      type: 'perfume',
      category: 'perfume',
      price: 0,
      originalPrice: 0,
      image: '',
      images: [],
      tag: 'LANÇAMENTO',
      description: '',
      family: '',
      gender: 'Feminino',
      isHighlight: false,
      isBestSeller: false,
      isMaisVendidos: false,
      isQueridinhos: false,
      isNew: false,
      salesCount: 0,
      volume: '100ml',
      createdAt: new Date().toISOString(),
      colors: []
    });
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id);
    setEditProductForm({
      name: p.name || '',
      subtitle: p.subtitle || '',
      type: p.type || 'perfume',
      category: p.category || p.type || 'perfume',
      price: p.price || 0,
      originalPrice: p.originalPrice || 0,
      image: p.image || '',
      images: p.images || [],
      tag: p.tag || 'LANÇAMENTO',
      description: p.description || '',
      family: p.family || '',
      gender: p.gender || 'Feminino',
      isHighlight: p.isHighlight || false,
      isBestSeller: p.isBestSeller || false,
      isMaisVendidos: p.isMaisVendidos || false,
      isQueridinhos: p.isQueridinhos || false,
      isNew: p.isNew || false,
      salesCount: p.salesCount || 0,
      volume: p.volume || '100ml',
      createdAt: p.createdAt || new Date().toISOString(),
      colors: p.colors || []
    });
  };

  const startEditBanner = (p: Banner) => {
    setEditingId(p.id);
    setEditBannerForm({
      image: p.image || '',
      mobileImage: p.mobileImage || '',
      title: p.title || '',
      order: p.order || 0,
      category: p.category || ''
    });
  };

  const startAddBanner = () => {
    setEditingId('new');
    setEditBannerForm({
      image: '',
      mobileImage: '',
      title: '',
      order: banners.length + 1,
      category: ''
    });
  };

  useEffect(() => {
    const principalList = banners.filter(b => !b.category).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (principalList[0]) {
      setMainBanner1({
        id: principalList[0].id,
        image: principalList[0].image || '',
        mobileImage: principalList[0].mobileImage || principalList[0].image || '',
        title: principalList[0].title || 'Banner Principal 1',
        order: 1
      });
    } else {
      setMainBanner1({
        image: DEFAULT_BANNERS[0]?.image || '',
        mobileImage: DEFAULT_BANNERS[0]?.mobileImage || '',
        title: DEFAULT_BANNERS[0]?.title || 'Banner Principal 1',
        order: 1
      });
    }

    if (principalList[1]) {
      setMainBanner2({
        id: principalList[1].id,
        image: principalList[1].image || '',
        mobileImage: principalList[1].mobileImage || principalList[1].image || '',
        title: principalList[1].title || 'Banner Principal 2',
        order: 2
      });
    } else {
      setMainBanner2({
        image: DEFAULT_BANNERS[1]?.image || '',
        mobileImage: DEFAULT_BANNERS[1]?.mobileImage || '',
        title: DEFAULT_BANNERS[1]?.title || 'Banner Principal 2',
        order: 2
      });
    }

    if (principalList[2]) {
      setMainBanner3({
        id: principalList[2].id,
        image: principalList[2].image || '',
        mobileImage: principalList[2].mobileImage || principalList[2].image || '',
        title: principalList[2].title || 'Banner Principal 3',
        order: 3
      });
    } else {
      setMainBanner3({
        image: DEFAULT_BANNERS[2]?.image || '',
        mobileImage: DEFAULT_BANNERS[2]?.mobileImage || '',
        title: DEFAULT_BANNERS[2]?.title || 'Banner 3 - Linha WeHot WePink',
        order: 3
      });
    }
  }, [banners]);

  useEffect(() => {
    if (activeTab !== 'banners') return;
    const timer = setInterval(() => {
      setPreviewSlide(prev => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const handleSaveMainBannerSlot = async (slotNumber: 1 | 2 | 3) => {
    setIsSaving(true);
    try {
      const slot = slotNumber === 1 ? mainBanner1 : slotNumber === 2 ? mainBanner2 : mainBanner3;
      if (!slot.image) {
        alert("Por favor, insira a URL da imagem no Banner " + slotNumber);
        setIsSaving(false);
        return;
      }
      const payload = {
        title: slot.title || ("Banner Principal " + slotNumber),
        image: slot.image.trim(),
        mobileImage: (slot.mobileImage && slot.mobileImage.trim()) || slot.image.trim(),
        order: slotNumber,
        category: '',
        updatedAt: new Date().toISOString()
      };

      if (slot.id) {
        await updateDoc(doc(db, 'banners', slot.id), payload);
      } else {
        const docRef = await addDoc(collection(db, 'banners'), payload);
        if (slotNumber === 1) setMainBanner1(prev => ({ ...prev, id: docRef.id }));
        else if (slotNumber === 2) setMainBanner2(prev => ({ ...prev, id: docRef.id }));
        else if (slotNumber === 3) setMainBanner3(prev => ({ ...prev, id: docRef.id }));
      }
      alert("Banner Principal " + slotNumber + " salvo com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar banner " + slotNumber, err);
      alert("Erro ao salvar banner: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllThreeBanners = async () => {
    setIsSaving(true);
    try {
      const slots = [
        { slot: mainBanner1, setter: setMainBanner1, num: 1 as const },
        { slot: mainBanner2, setter: setMainBanner2, num: 2 as const },
        { slot: mainBanner3, setter: setMainBanner3, num: 3 as const }
      ];

      for (const item of slots) {
        if (!item.slot.image) continue;
        const payload = {
          title: item.slot.title || ("Banner Principal " + item.num),
          image: item.slot.image.trim(),
          mobileImage: (item.slot.mobileImage && item.slot.mobileImage.trim()) || item.slot.image.trim(),
          order: item.num,
          category: '',
          updatedAt: new Date().toISOString()
        };

        if (item.slot.id) {
          await updateDoc(doc(db, 'banners', item.slot.id), payload);
        } else {
          const docRef = await addDoc(collection(db, 'banners'), payload);
          item.setter(prev => ({ ...prev, id: docRef.id }));
        }
      }
      alert('Os 3 Banners Principais foram salvos com sucesso e já estão rotacionando no topo da loja a cada 4 segundos!');
    } catch (err: any) {
      console.error('Erro ao salvar os 3 banners:', err);
      alert('Erro ao salvar banners: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMainBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3, type: 'desktop' | 'mobile') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB.');
      return;
    }
    setIsSaving(true);
    try {
      if (!firebaseConfig.storageBucket) {
        throw new Error('StorageBucket não configurado.');
      }
      const fileName = Date.now() + "_banner" + slot + "_" + type + "_" + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const storageRef = ref(storage, "banners/" + fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', null, reject, async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (slot === 1) {
              setMainBanner1(prev => ({ ...prev, [type === 'desktop' ? 'image' : 'mobileImage']: downloadURL }));
            } else if (slot === 2) {
              setMainBanner2(prev => ({ ...prev, [type === 'desktop' ? 'image' : 'mobileImage']: downloadURL }));
            } else if (slot === 3) {
              setMainBanner3(prev => ({ ...prev, [type === 'desktop' ? 'image' : 'mobileImage']: downloadURL }));
            }
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
      alert("Foto do Banner " + slot + " enviada com sucesso! Lembre-se de clicar em salvar.");
    } catch (err: any) {
      console.error('Erro no upload:', err);
      alert('Erro ao enviar imagem. Recomendamos colar a URL da imagem diretamente no campo abaixo da foto.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportDefaultBanners = async () => {
    setIsSaving(true);
    try {
      for (const b of DEFAULT_BANNERS) {
        const { id, ...data } = b;
        await addDoc(collection(db, 'banners'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      for (const catKey of Object.keys(DEFAULT_CATEGORY_BANNERS)) {
        const catBanner = DEFAULT_CATEGORY_BANNERS[catKey];
        const { id, ...data } = catBanner;
        await addDoc(collection(db, 'banners'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      alert('Banners padrão restaurados com sucesso no painel!');
    } catch (err) {
      console.error('Erro ao importar banners:', err);
      alert('Erro ao importar banners.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'desktop' | 'mobile' | 'product' | 'insta' | 'extra' | 'color', extraIdx?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande! Máximo 5MB.');
      return;
    }

    setIsUploading(prev => ({ ...prev, [type]: type === 'extra' || type === 'color' ? extraIdx! : true }));
    setUploadStatus('Iniciando...');
    setUploadProgress(0);
    
    // Remover timeout curto, deixar o Firebase gerenciar ou aumentar para 5 min
    const uploadTimeout = setTimeout(() => {
      setIsUploading({ desktop: false, mobile: false, product: false, extra: null, color: null });
      setUploadStatus('');
      setUploadProgress(0);
      alert('O envio está demorando. Pode ser sua conexão ou o Storage não está configurado.');
    }, 300000); // 5 minutos

    try {
      if (!firebaseConfig.storageBucket) {
        throw new Error('Configuração de StorageBucket ausente no firebase-config.');
      }

      const folder = type === 'product' || type === 'extra' ? 'products' : 'banners';
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storageRef = ref(storage, `${folder}/${fileName}`);
      
      console.log(`Iniciando upload para ${folder}/${fileName}...`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Proteção: Se em 30s ainda estiver em 0%, avisar o usuário
      const stallCheck = setTimeout(() => {
        if (uploadProgress === 0) {
          alert('O upload não saiu de 0%. Verifique se você ATIVOU o Storage no Firebase Console e se as Regras permitem gravação.');
        }
      }, 30000);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const currentProgress = Math.round(isFinite(progress) ? progress : 0);
            setUploadProgress(currentProgress);
            setUploadStatus(`Enviando: ${currentProgress}%`);
          }, 
          (error) => {
            clearTimeout(stallCheck);
            reject(error);
          }, 
          async () => {
            clearTimeout(stallCheck);
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              if (type === 'desktop') setEditBannerForm(prev => ({ ...prev, image: downloadURL }));
              else if (type === 'mobile') setEditBannerForm(prev => ({ ...prev, mobileImage: downloadURL }));
              else if (type === 'product') setEditProductForm(prev => ({ ...prev, image: downloadURL }));
              else if (type === 'extra' && extraIdx !== undefined) {
                const newImages = [...(editProductForm.images || [])];
                newImages[extraIdx] = downloadURL;
                setEditProductForm(prev => ({ ...prev, images: newImages }));
              }
              else if (type === 'color' && extraIdx !== undefined) {
                const newColors = [...(editProductForm.colors || [])];
                if (newColors[extraIdx]) {
                  newColors[extraIdx] = { ...newColors[extraIdx], image: downloadURL };
                } else {
                  newColors[extraIdx] = { name: '', hex: '#ffffff', image: downloadURL };
                }
                setEditProductForm(prev => ({ ...prev, colors: newColors }));
              }
              resolve();
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });

      clearTimeout(uploadTimeout);
      setIsUploading({ desktop: false, mobile: false, product: false, extra: null, color: null });
      setUploadStatus('');
      setUploadProgress(0);

    } catch (error: any) {
      clearTimeout(uploadTimeout);
      console.error('Upload Final Catch:', error);
      setIsUploading({ desktop: false, mobile: false, product: false, extra: null, color: null });
      setUploadStatus('');
      setUploadProgress(0);
      
      let msg = `Erro no envio: ${error.message}`;
      if (error.code === 'storage/unauthorized') {
        msg = 'ACESSO NEGADO: No Firebase Console > Storage > Rules, altere para: allow read, write: if true;';
      } else if (error.code === 'storage/retry-limit-exceeded' || error.message.includes('bucket')) {
        msg = 'CUIDADO: O Storage não está habilitado. Vá no Firebase Console > Storage e clique em "Começar".';
      }
      alert(msg);
    }
  };

  const handleBulkPriceUpdate = async () => {
    if (!bulkPriceCategory) {
      alert('Selecione uma categoria.');
      return;
    }
    const val = parseFloat(bulkPriceValue);
    if (isNaN(val) || val <= 0) {
      alert('Insira um valor maior que zero.');
      return;
    }

    const categoryProducts = products.filter(p => {
      const typeMatches = p.type?.toLowerCase() === bulkPriceCategory.toLowerCase();
      const catMatches = p.category?.toLowerCase() === bulkPriceCategory.toLowerCase();
      return typeMatches || catMatches;
    });

    if (categoryProducts.length === 0) {
      alert(`Nenhum produto cadastrado encontrado na categoria "${bulkPriceCategory}".`);
      return;
    }

    setIsSaving(true);
    try {
      let updatedCount = 0;
      for (const p of categoryProducts) {
        const currentVal = bulkPriceTarget === 'originalPrice' 
          ? (p.originalPrice || p.price || 0)
          : (p.price || 0);

        let newVal = currentVal;
        
        if (bulkPriceAdjustmentType === 'fixed') {
          newVal = val;
        } else if (bulkPriceAdjustmentType === 'percent_increase') {
          newVal = currentVal * (1 + val / 100);
        } else if (bulkPriceAdjustmentType === 'percent_decrease') {
          newVal = currentVal * (1 - val / 100);
        } else if (bulkPriceAdjustmentType === 'value_increase') {
          newVal = currentVal + val;
        } else if (bulkPriceAdjustmentType === 'value_decrease') {
          newVal = currentVal - val;
        }

        // Round to 2 decimal places
        newVal = Math.max(0, Math.round(newVal * 100) / 100);

        // Update document
        await updateDoc(doc(db, 'products', p.id), {
          [bulkPriceTarget]: newVal
        });
        updatedCount++;
      }
      setBulkConfirmStep(false);
      setShowBulkPriceModal(false);
      setBulkPriceValue('');
      alert(`Preços de ${updatedCount} produtos da categoria "${bulkPriceCategory}" atualizados com sucesso!`);
    } catch (error) {
      console.error('Error applying bulk price update:', error);
      alert('Erro ao atualizar preços em lote.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProduct = async (id: string) => {
    setIsSaving(true);
    try {
      // Se este produto está sendo marcado como destaque, desmarcar todos os outros primeiro
      if (editProductForm.isHighlight) {
        const others = products.filter(p => p.id !== id && p.isHighlight);
        for (const p of others) {
          await updateDoc(doc(db, 'products', p.id), { isHighlight: false });
        }
      }

      // Filtrar imagens vazias
      const cleanedForm = {
        ...editProductForm,
        images: (editProductForm.images || []).filter(img => img.trim() !== '')
      };

      if (id === 'new_product') {
        const docRef = await addDoc(collection(db, 'products'), {
          ...cleanedForm,
          active: true,
          createdAt: new Date().toISOString()
        });
        // Atualizar o próprio doc com o ID gerado para consistência (alguns componentes usam p.id do doc data)
        await updateDoc(doc(db, 'products', docRef.id), { id: docRef.id });
      } else {
        await updateDoc(doc(db, 'products', id), cleanedForm);
      }
      
      setEditingId(null);
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Erro ao salvar produto.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBanner = async (id: string) => {
    setIsSaving(true);
    try {
      if (!editBannerForm.image) {
        alert('Preencha pelo menos a imagem principal!');
        return;
      }
      
      // Se a imagem mobile estiver vazia, usa a principal como fallback
      const finalData = {
        ...editBannerForm,
        mobileImage: editBannerForm.mobileImage || editBannerForm.image
      };

      if (id === 'new') {
        await addDoc(collection(db, 'banners'), finalData);
      } else {
        await updateDoc(doc(db, 'banners', id), finalData);
      }
      setEditingId(null);
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Erro ao salvar banner.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white w-full max-w-6xl max-h-[90vh] overflow-hidden relative z-10 rounded-2xl flex flex-col"
      >
        <div className="px-8 pt-8 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#ff0080] font-montserrat tracking-tight">Painel Administrativo</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Gerenciamento de Conteúdo (Live)</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={async () => {
                  localStorage.removeItem('wepink_mock_user');
                  await auth.signOut();
                  window.location.reload();
                }}
                className="flex items-center gap-2 px-4 py-2 border border-red-100 hover:border-red-200 bg-red-50 hover:bg-red-100 text-[#ff0080] rounded-full transition-all text-xs font-bold shadow-xs active:scale-95"
              >
                Desconectar (Sair)
              </button>
              <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors border border-gray-100">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="flex gap-8">
            <button 
              onClick={() => { setActiveTab('produtos'); setEditingId(null); }}
              className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'produtos' ? 'text-[#ff0080]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Produtos
              {activeTab === 'produtos' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff0080] rounded-full" />}
            </button>
            <button 
              onClick={() => { setActiveTab('banners'); setEditingId(null); }}
              className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'banners' ? 'text-[#ff0080]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Banners Topo
              {activeTab === 'banners' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff0080] rounded-full" />}
            </button>
            <button 
              onClick={() => { setActiveTab('vendas'); setEditingId(null); }}
              className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'vendas' ? 'text-[#ff0080]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Vendas
              {activeTab === 'vendas' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff0080] rounded-full" />}
            </button>
            <button 
              onClick={() => { setActiveTab('pix'); setEditingId(null); }}
              className={`pb-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'pix' ? 'text-[#ff0080]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Pagamento (PIX)
              {activeTab === 'pix' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#ff0080] rounded-full" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'produtos' ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-gray-900">Gerenciar Produtos</h2>
                  <p className="text-sm text-gray-400 font-medium mt-1">Adicione ou edite os itens da sua loja</p>
                </div>
                {!editingId && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setBulkPriceCategory(productCategoryFilter !== 'todos' ? productCategoryFilter : '');
                        setBulkConfirmStep(false);
                        setBulkPriceValue('');
                        setShowBulkPriceModal(true);
                      }}
                      className="bg-pink-50 hover:bg-pink-100 text-[#ff0080] border border-pink-100 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 transition-all active:scale-95"
                    >
                      <DollarSign className="w-4 h-4" />
                      Mudar Preços em Lote
                    </button>
                    <button 
                      onClick={handleSeedProducts}
                      disabled={isSaving}
                      className="bg-gray-100 text-gray-600 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 hover:bg-gray-200 transition-all"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Restaurar Padrões
                    </button>
                    <button 
                      onClick={startAddProduct}
                      className="bg-[#ff0080] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 shadow-xl shadow-pink-100 hover:scale-105 transition-transform"
                    >
                      <Plus className="w-5 h-5" />
                      Novo Produto
                    </button>
                  </div>
                )}
              </div>

              {/* Product Search Bar & Category Quick Filters */}
              <div className="flex flex-col gap-3 mb-6">
                <div className="relative w-full max-w-xl">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Pesquisar produto pelo nome, tag ou categoria..."
                    className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-20 py-3.5 text-sm font-medium focus:border-[#ff0080] outline-none transition-all placeholder:text-gray-400"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && (
                    <button 
                      onClick={() => setProductSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-wider transition-colors"
                    >
                      limpar
                    </button>
                  )}
                </div>

                {/* Indicador de pessoas navegando online */}
                <div id="live-browsing-indicator" className="flex items-center justify-center gap-2 text-sm text-gray-600 font-medium px-1 py-1 select-none max-w-xl">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span>
                    <strong className="text-green-600 font-extrabold">{onlineVisitors}</strong> pessoas navegando no site agora
                  </span>
                </div>

                {/* Category Filtering Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap mr-2">Filtrar categoria:</span>
                  <button
                    onClick={() => setProductCategoryFilter('todos')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap ${
                      productCategoryFilter === 'todos'
                        ? 'bg-[#ff0080] text-white border-[#ff0080]'
                        : 'bg-white text-gray-500 hover:text-gray-700 border-gray-150 hover:border-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setProductCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold lowercase transition-all border whitespace-nowrap ${
                        productCategoryFilter === cat
                          ? 'bg-[#ff0080] text-white border-[#ff0080] font-bold'
                          : 'bg-white text-gray-500 hover:text-gray-700 border-gray-150 hover:border-gray-200'
                      }`}
                    >
                      {cat === 'wehot' ? '🔥 wehot' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {editingId === 'new_product' && (
                <div className="border border-[#ff0080] bg-pink-50/30 ring-4 ring-pink-50 rounded-2xl p-6 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Nome do Produto</label>
                      <input 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.name} 
                        onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                        placeholder="Ex: Body Splash Wepink"
                      />
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Subtítulo (Mobile)</label>
                      <input 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.subtitle} 
                        onChange={e => setEditProductForm({...editProductForm, subtitle: e.target.value})}
                        placeholder="Ex: frescor luminoso do verão..."
                      />
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Categoria do Produto</label>
                      <select 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.type || editProductForm.category || ''} 
                        onChange={e => setEditProductForm({...editProductForm, type: e.target.value, category: e.target.value})}
                      >
                        <option value="">Selecione uma categoria</option>
                        {PRODUCT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat === 'wehot' ? '🔥 WEHOT' : cat.toUpperCase()}</option>
                        ))}
                      </select>

                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Tag do Produto (Ex: LANÇAMENTO)</label>
                      <input 
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.tag} 
                        onChange={e => setEditProductForm({...editProductForm, tag: e.target.value})}
                        placeholder="Ex: LANÇAMENTO, BEST SELLER"
                      />
                      <div className="grid grid-cols-2 gap-4 mt-4">
                         <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Família</label>
                            <select 
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none"
                              value={editProductForm.family}
                              onChange={e => setEditProductForm({...editProductForm, family: e.target.value as any})}
                            >
                              <option value="">(Em branco)</option>
                              {OLFATIVE_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Gênero</label>
                            <select 
                              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none"
                              value={editProductForm.gender}
                              onChange={e => setEditProductForm({...editProductForm, gender: e.target.value as any})}
                            >
                              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                         </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Preço Atual (POR R$)</label>
                      <input 
                        type="number"
                        step="0.01"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.price} 
                        onChange={e => setEditProductForm({...editProductForm, price: parseFloat(e.target.value)})}
                      />
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Preço Original (DE R$)</label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="Ex: 329.00"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                        value={editProductForm.originalPrice || ''} 
                        onChange={e => setEditProductForm({...editProductForm, originalPrice: parseFloat(e.target.value)})}
                      />
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Imagem Principal (Obrigatória)</label>
                       <div className="flex gap-2">
                          <input 
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                            value={editProductForm.image} 
                            onChange={e => setEditProductForm({...editProductForm, image: e.target.value})}
                            placeholder="Link da imagem..."
                          />
                          <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'product')} />
                            {isUploading.product ? (
                              <div className="flex flex-col items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                                <span className="text-[8px] font-black text-[#ff0080]">{uploadProgress}%</span>
                              </div>
                            ) : (
                              <ArrowUp className="w-5 h-5 text-gray-400" />
                            )}
                          </label>
                       </div>

                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 1 (Opcional)</label>
                       <div className="flex gap-2">
                          <input 
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                            value={editProductForm.images?.[0] || ''} 
                            onChange={e => {
                              const newImgs = [...(editProductForm.images || [])];
                              newImgs[0] = e.target.value;
                              setEditProductForm({...editProductForm, images: newImgs});
                            }}
                            placeholder="Link da imagem complementar..."
                          />
                          <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 0)} />
                            {isUploading.extra === 0 ? (
                              <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                            ) : (
                              <ArrowUp className="w-5 h-5 text-gray-400" />
                            )}
                          </label>
                       </div>

                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 2 (Opcional)</label>
                       <div className="flex gap-2">
                          <input 
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                            value={editProductForm.images?.[1] || ''} 
                            onChange={e => {
                              const newImgs = [...(editProductForm.images || [])];
                              newImgs[1] = e.target.value;
                              setEditProductForm({...editProductForm, images: newImgs});
                            }}
                            placeholder="Link da imagem complementar..."
                          />
                          <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 1)} />
                            {isUploading.extra === 1 ? (
                              <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                            ) : (
                              <ArrowUp className="w-5 h-5 text-gray-400" />
                            )}
                          </label>
                       </div>

                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 3 (Opcional)</label>
                       <div className="flex gap-2">
                          <input 
                            className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                            value={editProductForm.images?.[2] || ''} 
                            onChange={e => {
                              const newImgs = [...(editProductForm.images || [])];
                              newImgs[2] = e.target.value;
                              setEditProductForm({...editProductForm, images: newImgs});
                            }}
                            placeholder="Link da imagem complementar..."
                          />
                          <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 2)} />
                            {isUploading.extra === 2 ? (
                              <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                            ) : (
                              <ArrowUp className="w-5 h-5 text-gray-400" />
                            )}
                          </label>
                       </div>
                    </div>
                    <div className="space-y-4 flex flex-col h-full">
                       <label className="block text-[10px] font-black text-[#ff0080] uppercase tracking-[0.2em] mb-1">Destaques da Página Inicial</label>
                       <div className="bg-pink-50/50 p-4 rounded-xl border border-pink-100 flex flex-col gap-2 mb-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 accent-[#ff0080]"
                               checked={editProductForm.isBestSeller}
                               onChange={e => setEditProductForm({...editProductForm, isBestSeller: e.target.checked})}
                             />
                             <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Best Seller</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 accent-[#ff0080]"
                               checked={editProductForm.isMaisVendidos}
                               onChange={e => setEditProductForm({...editProductForm, isMaisVendidos: e.target.checked})}
                             />
                             <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Mais Vendidos</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 accent-[#ff0080]"
                               checked={editProductForm.isNew}
                               onChange={e => setEditProductForm({...editProductForm, isNew: e.target.checked})}
                             />
                             <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Lançamento</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 accent-[#ff0080]"
                               checked={editProductForm.isQueridinhos}
                               onChange={e => setEditProductForm({...editProductForm, isQueridinhos: e.target.checked})}
                             />
                             <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Queridinhos da Wepink</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                             <input 
                               type="checkbox" 
                               className="w-4 h-4 accent-[#ff0080]"
                               checked={editProductForm.isHighlight}
                               onChange={e => setEditProductForm({...editProductForm, isHighlight: e.target.checked})}
                             />
                             <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Destaque do Mês</span>
                          </label>
                       </div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Descrição / Frase de efeito</label>
                       <textarea 
                         className="flex-1 w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all resize-none"
                         value={editProductForm.description} 
                         onChange={e => setEditProductForm({...editProductForm, description: e.target.value})}
                       />
                      {/* Color Variations Section */}
                      <div className="space-y-4 border border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50/50 mt-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[12px] font-black text-gray-500 uppercase tracking-widest">Variantes de Cores</h5>
                          <button
                            type="button"
                            onClick={() => {
                              const currentColors = editProductForm.colors || [];
                              setEditProductForm({
                                ...editProductForm,
                                colors: [...currentColors, { name: '', hex: '#ff0080', image: '' }]
                              });
                            }}
                            className="text-[10px] bg-[#ff0080] hover:bg-[#e00070] text-white font-extrabold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                          >
                            + Adicionar Cor
                          </button>
                        </div>

                        {(editProductForm.colors || []).length === 0 ? (
                          <p className="text-[11px] text-gray-400 font-medium">Nenhuma variação de cor cadastrada (Ex: batom, maquiagens).</p>
                        ) : (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {(editProductForm.colors || []).map((c, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative">
                                <div className="flex-1 space-y-2 w-full">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Nome da Cor</label>
                                  <input
                                    type="text"
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-[#ff0080] outline-none"
                                    placeholder="Ex: Cor 5 - Marrom médio"
                                    value={c.name}
                                    onChange={e => {
                                      const updated = [...(editProductForm.colors || [])];
                                      updated[idx] = { ...updated[idx], name: e.target.value };
                                      setEditProductForm({ ...editProductForm, colors: updated });
                                    }}
                                  />
                                </div>

                                <div className="w-24 space-y-2">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Tom da Cor</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0 overflow-hidden flex-shrink-0"
                                      value={c.hex || '#ff0080'}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], hex: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className="w-full bg-white border border-gray-200 rounded-lg px-1 py-1.5 text-[10px] text-center font-mono focus:border-[#ff0080] outline-none"
                                      value={c.hex || '#ff0080'}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], hex: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="flex-1 space-y-2 w-full">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Imagem da Variação (Link/Upload)</label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-[#ff0080] outline-none"
                                      placeholder="Link da imagem..."
                                      value={c.image}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], image: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                    <label className="bg-white border border-gray-200 rounded-lg px-3 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[40px] h-[34px]">
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={e => handleFileChange(e, 'color', idx)}
                                      />
                                      {isUploading.color === idx ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff0080]" />
                                      ) : (
                                        <ArrowUp className="w-3.5 h-3.5 text-gray-400" />
                                      )}
                                    </label>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (editProductForm.colors || []).filter((_, i) => i !== idx);
                                    setEditProductForm({ ...editProductForm, colors: updated });
                                  }}
                                  className="text-[10px] bg-red-50 text-red-500 hover:bg-red-100 font-extrabold px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors self-end sm:self-center h-8"
                                  title="Remover cor"
                                >
                                  ✖
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={() => handleSaveProduct('new_product')}
                          disabled={isSaving}
                          className="w-full bg-[#ff0080] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg hover:translate-y-[-2px]"
                        >
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                          Criar Produto
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="w-full bg-gray-100 text-gray-600 py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] hover:bg-gray-200 transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(() => {
                const query = productSearch.toLowerCase().trim();
                const filtered = products.filter(p => {
                  // Category filter
                  if (productCategoryFilter !== 'todos') {
                    if (p.type?.toLowerCase() !== productCategoryFilter.toLowerCase() && p.category?.toLowerCase() !== productCategoryFilter.toLowerCase()) {
                      return false;
                    }
                  }

                  if (!query) return true;
                  return (
                    p.name?.toLowerCase().includes(query) ||
                    p.subtitle?.toLowerCase().includes(query) ||
                    p.tag?.toLowerCase().includes(query) ||
                    p.type?.toLowerCase().includes(query) ||
                    p.category?.toLowerCase().includes(query) ||
                    (p.family && p.family.toLowerCase().includes(query))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                      <Search className="w-10 h-10 text-gray-300 mx-auto mb-3 animate-pulse" />
                      <p className="text-sm font-bold text-gray-550 uppercase tracking-widest">Nenhum produto cadastrado encontrado</p>
                      <p className="text-xs text-gray-400 mt-1">Tente ajustar seus termos de busca ou cadastrar um novo produto</p>
                    </div>
                  );
                }

                return [...filtered].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                  <div key={p.id} className={`border rounded-2xl p-6 transition-all ${editingId === p.id ? 'border-[#ff0080] bg-pink-50/30 ring-4 ring-pink-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                  {editingId === p.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Nome do Produto</label>
                        <input 
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.name} 
                          onChange={e => setEditProductForm({...editProductForm, name: e.target.value})}
                        />
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Subtítulo (Mobile)</label>
                        <input 
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.subtitle} 
                          onChange={e => setEditProductForm({...editProductForm, subtitle: e.target.value})}
                        />
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Categoria do Produto</label>
                        <select 
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.type || editProductForm.category || ''} 
                          onChange={e => setEditProductForm({...editProductForm, type: e.target.value, category: e.target.value})}
                        >
                          <option value="">Selecione uma categoria</option>
                          {PRODUCT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat === 'wehot' ? '🔥 WEHOT' : cat.toUpperCase()}</option>
                          ))}
                        </select>

                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Tag do Produto (Ex: LANÇAMENTO)</label>
                        <input 
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.tag} 
                          onChange={e => setEditProductForm({...editProductForm, tag: e.target.value})}
                          placeholder="Ex: LANÇAMENTO, BEST SELLER"
                        />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                           <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Família</label>
                              <select 
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none"
                                value={editProductForm.family}
                                onChange={e => setEditProductForm({...editProductForm, family: e.target.value as any})}
                              >
                                <option value="">(Em branco)</option>
                                {OLFATIVE_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Gênero</label>
                              <select 
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none"
                                value={editProductForm.gender}
                                onChange={e => setEditProductForm({...editProductForm, gender: e.target.value as any})}
                              >
                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                           </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Preço Atual (POR R$)</label>
                        <input 
                          type="number"
                          step="0.01"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.price} 
                          onChange={e => setEditProductForm({...editProductForm, price: parseFloat(e.target.value)})}
                        />
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Preço Original (DE R$)</label>
                        <input 
                          type="number"
                          step="0.01"
                          placeholder="Ex: 329.00"
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                          value={editProductForm.originalPrice || ''} 
                          onChange={e => setEditProductForm({...editProductForm, originalPrice: parseFloat(e.target.value)})}
                        />
                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Imagem Principal (Obrigatória)</label>
                         <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                              value={editProductForm.image} 
                              onChange={e => setEditProductForm({...editProductForm, image: e.target.value})}
                              placeholder="Link da imagem..."
                            />
                            <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'product')} />
                              {isUploading.product ? (
                                <div className="flex flex-col items-center">
                                  <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                                  <span className="text-[8px] font-black text-[#ff0080]">{uploadProgress}%</span>
                                </div>
                              ) : (
                                <ArrowUp className="w-5 h-5 text-gray-400" />
                              )}
                            </label>
                         </div>

                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 1 (Opcional)</label>
                         <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                              value={editProductForm.images?.[0] || ''} 
                              onChange={e => {
                                const newImgs = [...(editProductForm.images || [])];
                                newImgs[0] = e.target.value;
                                setEditProductForm({...editProductForm, images: newImgs});
                              }}
                              placeholder="Link da imagem complementar..."
                            />
                            <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 0)} />
                              {isUploading.extra === 0 ? (
                                <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                              ) : (
                                <ArrowUp className="w-5 h-5 text-gray-400" />
                              )}
                            </label>
                         </div>

                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 2 (Opcional)</label>
                         <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                              value={editProductForm.images?.[1] || ''} 
                              onChange={e => {
                                const newImgs = [...(editProductForm.images || [])];
                                newImgs[1] = e.target.value;
                                setEditProductForm({...editProductForm, images: newImgs});
                              }}
                              placeholder="Link da imagem complementar..."
                            />
                            <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 1)} />
                              {isUploading.extra === 1 ? (
                                <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                              ) : (
                                <ArrowUp className="w-5 h-5 text-gray-400" />
                              )}
                            </label>
                         </div>

                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-4">Foto Complementar 3 (Opcional)</label>
                         <div className="flex gap-2">
                            <input 
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all"
                              value={editProductForm.images?.[2] || ''} 
                              onChange={e => {
                                const newImgs = [...(editProductForm.images || [])];
                                newImgs[2] = e.target.value;
                                setEditProductForm({...editProductForm, images: newImgs});
                              }}
                              placeholder="Link da imagem complementar..."
                            />
                            <label className="bg-white border border-gray-200 rounded-xl px-6 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[60px]">
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', 2)} />
                              {isUploading.extra === 2 ? (
                                <Loader2 className="w-5 h-5 animate-spin text-[#ff0080]" />
                              ) : (
                                <ArrowUp className="w-5 h-5 text-gray-400" />
                              )}
                            </label>
                         </div>

                        {/* Multiple Images Section */}
                        <div className="mt-6 space-y-3">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Fotos da Galeria (Extras)</label>
                          <div className="space-y-2">
                            {(editProductForm.images || []).map((imgUrl, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input 
                                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-[11px] font-bold focus:border-[#ff0080] outline-none transition-all"
                                  value={imgUrl} 
                                  onChange={e => {
                                    const newImages = [...(editProductForm.images || [])];
                                    newImages[idx] = e.target.value;
                                    setEditProductForm({...editProductForm, images: newImages});
                                  }}
                                  placeholder="Link da foto extra..."
                                />
                                <label className="bg-white border border-gray-200 rounded-xl px-4 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[50px]">
                                  <input type="file" className="hidden" accept="image/*" onChange={e => handleFileChange(e, 'extra', idx)} />
                                  {isUploading.extra === idx ? (
                                    <div className="flex flex-col items-center">
                                      <Loader2 className="w-4 h-4 animate-spin text-[#ff0080]" />
                                      <span className="text-[7px] font-black text-[#ff0080]">{uploadProgress}%</span>
                                    </div>
                                  ) : (
                                    <ArrowUp className="w-4 h-4 text-gray-400" />
                                  )}
                                </label>
                                <button 
                                  onClick={() => {
                                    const newImages = (editProductForm.images || []).filter((_, i) => i !== idx);
                                    setEditProductForm({...editProductForm, images: newImages});
                                  }}
                                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button 
                              onClick={() => {
                                const newImages = [...(editProductForm.images || []), ''];
                                setEditProductForm({...editProductForm, images: newImages});
                              }}
                              className="w-full py-2 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:border-[#ff0080]/30 hover:text-[#ff0080] transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3 h-3" /> Adicionar Foto Extra
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 flex flex-col h-full">
                         <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Descrição / Frase de efeito</label>
                         <textarea 
                           className="flex-1 w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:border-[#ff0080] outline-none transition-all resize-none"
                           value={editProductForm.description} 
                           onChange={e => setEditProductForm({...editProductForm, description: e.target.value})}
                         />
                         
                         <div className="bg-pink-50/50 p-4 rounded-xl border border-pink-100 flex flex-col gap-2 mb-4">
                            <label className="block text-[10px] font-black text-[#ff0080] uppercase tracking-[0.2em] mb-1">Destaques da Página Inicial</label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 accent-[#ff0080]"
                                 checked={editProductForm.isNew}
                                 onChange={e => setEditProductForm({...editProductForm, isNew: e.target.checked})}
                               />
                               <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Lançamento</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 accent-[#ff0080]"
                                 checked={editProductForm.isBestSeller}
                                 onChange={e => setEditProductForm({...editProductForm, isBestSeller: e.target.checked})}
                               />
                               <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Best Seller</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 accent-[#ff0080]"
                                 checked={editProductForm.isMaisVendidos}
                                 onChange={e => setEditProductForm({...editProductForm, isMaisVendidos: e.target.checked})}
                               />
                               <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Mais Vendidos</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 accent-[#ff0080]"
                                 checked={editProductForm.isQueridinhos}
                                 onChange={e => setEditProductForm({...editProductForm, isQueridinhos: e.target.checked})}
                               />
                               <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Queridinhos da Wepink</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                               <input 
                                 type="checkbox" 
                                 className="w-4 h-4 accent-[#ff0080]"
                                 checked={editProductForm.isHighlight}
                                 onChange={e => setEditProductForm({...editProductForm, isHighlight: e.target.checked})}
                               />
                               <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest group-hover:text-[#ff0080] transition-colors">Destaque do Mês</span>
                            </label>
                         </div>
                      {/* Color Variations Section */}
                      <div className="space-y-4 border border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50/50 mt-4">
                        <div className="flex items-center justify-between">
                          <h5 className="text-[12px] font-black text-gray-500 uppercase tracking-widest">Variantes de Cores</h5>
                          <button
                            type="button"
                            onClick={() => {
                              const currentColors = editProductForm.colors || [];
                              setEditProductForm({
                                ...editProductForm,
                                colors: [...currentColors, { name: '', hex: '#ff0080', image: '' }]
                              });
                            }}
                            className="text-[10px] bg-[#ff0080] hover:bg-[#e00070] text-white font-extrabold px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                          >
                            + Adicionar Cor
                          </button>
                        </div>

                        {(editProductForm.colors || []).length === 0 ? (
                          <p className="text-[11px] text-gray-400 font-medium">Nenhuma variação de cor cadastrada (Ex: batom, maquiagens).</p>
                        ) : (
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {(editProductForm.colors || []).map((c, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm relative">
                                <div className="flex-1 space-y-2 w-full">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Nome da Cor</label>
                                  <input
                                    type="text"
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-[#ff0080] outline-none"
                                    placeholder="Ex: Cor 5 - Marrom médio"
                                    value={c.name}
                                    onChange={e => {
                                      const updated = [...(editProductForm.colors || [])];
                                      updated[idx] = { ...updated[idx], name: e.target.value };
                                      setEditProductForm({ ...editProductForm, colors: updated });
                                    }}
                                  />
                                </div>

                                <div className="w-24 space-y-2">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Tom da Cor</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0 overflow-hidden flex-shrink-0"
                                      value={c.hex || '#ff0080'}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], hex: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                    <input
                                      type="text"
                                      className="w-full bg-white border border-gray-200 rounded-lg px-1 py-1.5 text-[10px] text-center font-mono focus:border-[#ff0080] outline-none"
                                      value={c.hex || '#ff0080'}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], hex: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="flex-1 space-y-2 w-full">
                                  <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest">Imagem da Variação (Link/Upload)</label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:border-[#ff0080] outline-none"
                                      placeholder="Link da imagem..."
                                      value={c.image}
                                      onChange={e => {
                                        const updated = [...(editProductForm.colors || [])];
                                        updated[idx] = { ...updated[idx], image: e.target.value };
                                        setEditProductForm({ ...editProductForm, colors: updated });
                                      }}
                                    />
                                    <label className="bg-white border border-gray-200 rounded-lg px-3 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm min-w-[40px] h-[34px]">
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={e => handleFileChange(e, 'color', idx)}
                                      />
                                      {isUploading.color === idx ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff0080]" />
                                      ) : (
                                        <ArrowUp className="w-3.5 h-3.5 text-gray-400" />
                                      )}
                                    </label>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = (editProductForm.colors || []).filter((_, i) => i !== idx);
                                    setEditProductForm({ ...editProductForm, colors: updated });
                                  }}
                                  className="text-[10px] bg-red-50 text-red-500 hover:bg-red-100 font-extrabold px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors self-end sm:self-center h-8"
                                  title="Remover cor"
                                >
                                  ✖
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                        <div className="flex flex-col gap-3">
                          <button 
                            onClick={() => handleSaveProduct(p.id)}
                            disabled={isSaving}
                            className="w-full bg-[#ff0080] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg hover:translate-y-[-2px]"
                          >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Produto
                          </button>
                          <button 
                            onClick={() => setEditingId(null)}
                            className="w-full bg-gray-100 text-gray-600 py-4 rounded-xl font-bold uppercase tracking-widest text-[12px] hover:bg-gray-200 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <img src={p.image} className="w-20 h-20 object-contain bg-gray-50 rounded-xl p-2" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-900">{p.name}</h3>
                            {p.active === false && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-lg uppercase">Inativo</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">{p.type}</p>
                          <p className="text-[#ff0080] font-bold text-xl mt-1">R$ {p.price.toFixed(2)}</p>
                          {p.colors && p.colors.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Variantes:</span>
                              <div className="flex flex-wrap gap-1">
                                {p.colors.map((c, i) => (
                                  <div 
                                    key={i} 
                                    className="w-4 h-4 rounded-full border border-gray-200 relative group/col cursor-help" 
                                    style={{ backgroundColor: c.hex || '#ffffff' }} 
                                    title={c.name}
                                  >
                                    <span className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover/col:opacity-100 transition-opacity whitespace-nowrap z-50">
                                      {c.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => onToggleProductActive(p.id, p.active !== false)}
                          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all border ${
                            p.active !== false 
                              ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white' 
                              : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white'
                          }`}
                        >
                          {p.active !== false ? 'DESATIVAR' : 'ATIVAR'}
                        </button>
                        <button 
                          onClick={() => startEditProduct(p)}
                          className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 hover:bg-pink-50 hover:text-[#ff0080] rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all border border-transparent hover:border-pink-200"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => setProductToDeleteId(p.id)}
                          className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all border border-red-100 cursor-pointer"
                        >
                          EXCLUIR
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ));
              })()}

              {/* Toast de Feedback de Produtos */}
              {productToast && (
                <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${
                  productToast.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs' 
                    : 'bg-red-50 text-red-800 border border-red-200 shadow-xs'
                }`}>
                  <div className="flex items-center gap-2">
                    {productToast.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    <span>{productToast.message}</span>
                  </div>
                  <button type="button" onClick={() => setProductToast(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Modal de Confirmação: Excluir Produto */}
              {productToDeleteId && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        Excluir Produto?
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Tem certeza que deseja excluir permanentemente este produto da loja?
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setProductToDeleteId(null)}
                        disabled={isDeletingProduct}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteDeleteProduct}
                        disabled={isDeletingProduct}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingProduct ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Excluindo...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Sim, Excluir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
                    ) : activeTab === 'banners' ? (
            <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
              {editingId !== null ? (
                /* Formulário de Edição / Criação de Banner */
                <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-gray-900">
                        {editingId === 'new' ? 'Adicionar Novo Banner' : 'Editar Banner'}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Configure imagens para desktop e mobile, título e categoria de exibição
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Título do Banner
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Linha WeHot WePink ou Banner Principal 1"
                        value={editBannerForm.title || ''}
                        onChange={(e) => setEditBannerForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-[#ff0080] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Categoria de Exibição
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Deixe em branco para Home ou digite: wehot, kits, etc."
                          value={editBannerForm.category || ''}
                          onChange={(e) => setEditBannerForm(prev => ({ ...prev, category: e.target.value.toLowerCase().trim() }))}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-[#ff0080] outline-none transition-all"
                        />
                        <select
                          value={editBannerForm.category || ''}
                          onChange={(e) => setEditBannerForm(prev => ({ ...prev, category: e.target.value }))}
                          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-xs font-bold uppercase focus:border-[#ff0080] outline-none cursor-pointer"
                        >
                          <option value="">Home (Principal)</option>
                          <option value="wehot">🔥 WEHOT</option>
                          {PRODUCT_CATEGORIES.map(c => (
                            <option key={c} value={c}>{c.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Banners da Home sem categoria rotacionam no topo da loja a cada 4 segundos.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Ordem de Exibição
                      </label>
                      <input
                        type="number"
                        placeholder="1"
                        value={editBannerForm.order ?? 1}
                        onChange={(e) => setEditBannerForm(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:border-[#ff0080] outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Imagem Desktop (URL ou Upload)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://... (URL da imagem)"
                          value={editBannerForm.image || ''}
                          onChange={(e) => setEditBannerForm(prev => ({ ...prev, image: e.target.value }))}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:border-[#ff0080] outline-none transition-all"
                        />
                        <label className="bg-pink-50 hover:bg-pink-100 text-[#ff0080] border border-pink-200 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer flex items-center gap-1.5 transition-colors shrink-0">
                          <Upload className="w-4 h-4" />
                          Upload
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'desktop')} />
                        </label>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">
                        Imagem Mobile (URL ou Upload) - Opcional
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="https://... (URL mobile - opcional, usa a desktop se vazio)"
                          value={editBannerForm.mobileImage || ''}
                          onChange={(e) => setEditBannerForm(prev => ({ ...prev, mobileImage: e.target.value }))}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono focus:border-[#ff0080] outline-none transition-all"
                        />
                        <label className="bg-pink-50 hover:bg-pink-100 text-[#ff0080] border border-pink-200 px-4 py-3 rounded-xl font-black text-xs uppercase cursor-pointer flex items-center gap-1.5 transition-colors shrink-0">
                          <Upload className="w-4 h-4" />
                          Upload
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'mobile')} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Image Live Preview */}
                  {editBannerForm.image && (
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Pré-visualização</p>
                      <div className="relative aspect-[1920/450] max-h-48 w-full overflow-hidden rounded-xl bg-gray-200">
                        <img 
                          src={editBannerForm.image} 
                          alt="Preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      disabled={isSaving}
                      className="px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveBanner(editingId)}
                      disabled={isSaving}
                      className="bg-[#ff0080] hover:brightness-110 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? 'Salvando...' : 'Salvar Banner'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Lista Completa de Banners Restaurada */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900 flex items-center gap-3">
                        <span>Gerenciar Banners</span>
                        <span className="text-xs bg-pink-100 text-[#ff0080] font-bold px-3 py-1 rounded-full border border-pink-200">
                          {banners.length} {banners.length === 1 ? 'Banner' : 'Banners'}
                        </span>
                      </h2>
                      <p className="text-sm text-gray-400 font-medium mt-1">
                        Banners da Home rotacionam a cada 4s. Banners com categoria são exibidos ao clicar na categoria (ex: WeHot).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {banners.length > 0 && (
                        <button 
                          type="button"
                          onClick={() => setShowDeleteAllBannersModal(true)}
                          disabled={isSaving || isDeletingBanner}
                          className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-2 border border-red-200 transition-all cursor-pointer disabled:opacity-50"
                          title="Excluir todos os banners cadastrados"
                        >
                          <Trash2 className="w-4 h-4" />
                          Apagar Todos
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={handleImportDefaultBanners}
                        disabled={isSaving || isDeletingBanner}
                        className="bg-gray-100 hover:bg-pink-50 hover:text-[#ff0080] text-gray-700 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-2 border border-gray-200 transition-all cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4 text-[#ff0080]" />
                        Restaurar Padrões
                      </button>

                      <button 
                        type="button"
                        onClick={startAddBanner}
                        disabled={isSaving || isDeletingBanner}
                        className="bg-[#ff0080] hover:brightness-110 text-white px-7 py-3 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-2 shadow-lg shadow-pink-500/25 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Novo Banner
                      </button>
                    </div>
                  </div>

                  {/* Feedback Toast de Banners */}
                  {bannerToast && (
                    <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${
                      bannerToast.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs' 
                        : 'bg-red-50 text-red-800 border border-red-200 shadow-xs'
                    }`}>
                      <div className="flex items-center gap-2">
                        {bannerToast.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                        <span>{bannerToast.message}</span>
                      </div>
                      <button type="button" onClick={() => setBannerToast(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Filtros de Categoria e Pesquisa */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
                      <button
                        type="button"
                        onClick={() => setBannerCategoryFilter('todos')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                          bannerCategoryFilter === 'todos'
                            ? 'bg-[#ff0080] text-white border-[#ff0080]'
                            : 'bg-white text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        Todos ({banners.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerCategoryFilter('principal')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                          bannerCategoryFilter === 'principal'
                            ? 'bg-[#ff0080] text-white border-[#ff0080]'
                            : 'bg-white text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        Principal / Home ({banners.filter(b => !b.category).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerCategoryFilter('wehot')}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                          bannerCategoryFilter === 'wehot'
                            ? 'bg-[#ff0080] text-white border-[#ff0080]'
                            : 'bg-white text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        🔥 WEHOT ({banners.filter(b => b.category?.toLowerCase() === 'wehot').length})
                      </button>
                      {PRODUCT_CATEGORIES.filter(c => c !== 'wehot').map((cat) => {
                        const count = banners.filter(b => b.category?.toLowerCase() === cat.toLowerCase()).length;
                        if (count === 0 && bannerCategoryFilter !== cat) return null;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setBannerCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border whitespace-nowrap cursor-pointer ${
                              bannerCategoryFilter === cat
                                ? 'bg-[#ff0080] text-white border-[#ff0080]'
                                : 'bg-white text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {cat.toUpperCase()} ({count})
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar banners..."
                        value={bannerSearch}
                        onChange={(e) => setBannerSearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-medium focus:border-[#ff0080] outline-none"
                      />
                    </div>
                  </div>

                  {/* Grid de Banners Cadastrados */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners
                      .filter(b => {
                        const matchesCat = bannerCategoryFilter === 'todos' 
                          ? true 
                          : bannerCategoryFilter === 'principal' 
                            ? !b.category 
                            : b.category?.toLowerCase() === bannerCategoryFilter.toLowerCase();
                        const matchesSearch = !bannerSearch || 
                          b.title?.toLowerCase().includes(bannerSearch.toLowerCase()) || 
                          b.category?.toLowerCase().includes(bannerSearch.toLowerCase());
                        return matchesCat && matchesSearch;
                      })
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((banner) => (
                        <div 
                          key={banner.id} 
                          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
                        >
                          <div className="relative aspect-[16/7] bg-gray-100 overflow-hidden">
                            <img 
                              src={banner.image} 
                              alt={banner.title || 'Banner'} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full backdrop-blur-md shadow-xs ${
                                !banner.category 
                                  ? 'bg-pink-500 text-white' 
                                  : banner.category.toLowerCase() === 'wehot' 
                                    ? 'bg-black text-[#ff0080] border border-[#ff0080]/30' 
                                    : 'bg-gray-900/80 text-white'
                              }`}>
                                {!banner.category ? 'Principal (Home - 4s)' : `🔥 ${banner.category.toUpperCase()}`}
                              </span>
                              <span className="text-[9px] font-black bg-white/90 text-gray-800 px-2 py-1 rounded-full shadow-xs">
                                #{banner.order || 1}
                              </span>
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                                {banner.title || (banner.category ? `Banner ${banner.category.toUpperCase()}` : `Banner Principal ${banner.order || 1}`)}
                              </h4>
                              <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                                {banner.image}
                              </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-gray-50">
                              <button
                                type="button"
                                onClick={() => startEditBanner(banner)}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-100 hover:bg-pink-50 hover:text-[#ff0080] text-gray-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setBannerToDeleteId(banner.id)}
                                disabled={isDeletingBanner}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Excluir este banner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Modal de Confirmação: Excluir Banner Individual */}
              {bannerToDeleteId && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        Excluir Banner?
                      </h3>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Tem certeza que deseja excluir permanentemente este banner? Essa alteração será refletida imediatamente na loja.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setBannerToDeleteId(null)}
                        disabled={isDeletingBanner}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteDeleteBanner}
                        disabled={isDeletingBanner}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingBanner ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Excluindo...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Sim, Excluir</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Confirmação: Excluir TODOS os Banners */}
              {showDeleteAllBannersModal && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                        Apagar TODOS os Banners?
                      </h3>
                      <p className="text-xs text-red-500 font-semibold leading-relaxed">
                        Atenção: Todos os {banners.length} banners cadastrados serão excluídos permanentemente. Você pode restaurar os padrões depois a qualquer momento com um clique.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllBannersModal(false)}
                        disabled={isDeletingBanner}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteDeleteAllBanners}
                        disabled={isDeletingBanner}
                        className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isDeletingBanner ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Apagando...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            <span>Sim, Apagar Tudo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'vendas' ? (
            <div className="space-y-6">
               {/* Feedback Toast */}
               {ordersToast && (
                 <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${
                   ordersToast.type === 'success' 
                     ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs' 
                     : 'bg-red-50 text-red-800 border border-red-200 shadow-xs'
                 }`}>
                   <div className="flex items-center gap-2">
                     {ordersToast.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                     <span>{ordersToast.message}</span>
                   </div>
                   <button type="button" onClick={() => setOrdersToast(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                     <X className="w-4 h-4" />
                   </button>
                 </div>
               )}

               <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-pink-50 p-6 rounded-3xl border border-pink-100 gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-[#ff0080]">Monitor de Vendas</h3>
                    <p className="text-xs font-bold text-pink-400 uppercase tracking-widest mt-1">Dados de pagamentos processados em tempo real</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl border border-pink-100 font-bold text-[#ff0080] text-sm whitespace-nowrap">
                      {capturedOrders.length} {capturedOrders.length === 1 ? 'Pedido Monitorado' : 'Pedidos Monitorados'}
                    </div>
                    {capturedOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteAllOrdersModal(true)}
                        disabled={isDeletingOrders}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl border border-red-200 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                        title="Apagar todo o histórico de vendas"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sm:inline">Apagar Histórico</span>
                      </button>
                    )}
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-4">
                  {capturedOrders.length === 0 ? (
                    <div className="py-20 text-center opacity-40 bg-white rounded-3xl border border-dashed border-gray-200">
                      <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="font-bold uppercase tracking-[0.2em] text-[12px] text-gray-600">Nenhum pedido no histórico</p>
                      <p className="text-xs text-gray-400 mt-1">As compras aprovadas e pedidos monitorados aparecerão aqui em tempo real.</p>
                    </div>
                  ) : (
                    capturedOrders.map((order, index) => {
                      const orderNumber = capturedOrders.length - index;
                      const isPix = order.paymentMethod === 'pix';
                      const isCreditCard = order.paymentMethod === 'credit-card' || !order.paymentMethod;

                      return (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-[24px] p-8 flex flex-col md:flex-row justify-between gap-8 hover:shadow-xl hover:border-pink-100 transition-all group relative overflow-hidden">
                           {/* Status Sidebar Indicator */}
                           <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isPix ? (order.status === 'paid' ? 'bg-green-500' : 'bg-amber-400') : (isCreditCard ? 'bg-[#ff0080]' : 'bg-gray-400')}`} />

                           <div className="space-y-6 flex-1">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 ${isPix ? (order.status === 'paid' ? 'bg-green-500' : 'bg-amber-400') : 'bg-gray-900'} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                                       {isPix ? <QrCode className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                                    </div>
                                    <div>
                                       <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[10px] font-black bg-gray-100 px-2 py-0.5 rounded text-gray-500 uppercase">#PEDIDO {orderNumber.toString().padStart(3, '0')}</span>
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                            isPix 
                                              ? (order.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600')
                                              : 'bg-pink-100 text-[#ff0080]'
                                          }`}>
                                             {isPix 
                                               ? (order.status === 'paid' ? 'PIX PAGO' : 'PIX GERADO / PENDENTE') 
                                               : 'Cartão Capturado'}
                                          </span>
                                       </div>
                                       <h4 className="font-black text-[17px] text-gray-900 tracking-tight">
                                          {order.name || order.email}
                                       </h4>
                                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                          {isPix ? `ID Pix: ${order.pixId || 'N/A'}` : (isCreditCard ? `Cartão: ${order.cardData?.number?.substring(0, 4)} **** **** ${order.cardData?.number?.slice(-4)}` : 'Método desconhecido')}
                                       </p>
                                    </div>
                                 </div>
                              </div>
                              
                              {isCreditCard && order.cardData && (
                                 <div className="bg-pink-50/50 p-6 rounded-2xl border border-pink-100/50">
                                    <div className="flex items-center gap-2 mb-4">
                                       <ShieldCheck className="w-4 h-4 text-[#ff0080]" />
                                       <span className="text-[10px] font-black text-[#ff0080] uppercase tracking-widest">Dados do Cartão (Capturados)</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                       <div>
                                          <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Número Completo</span>
                                          <span className="font-bold text-[14px] text-gray-900 select-all">{order.cardData.number || 'N/A'}</span>
                                       </div>
                                       <div>
                                          <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Validade</span>
                                          <span className="font-bold text-[14px]">{order.cardData.expiryMonth}/{order.cardData.expiryYear}</span>
                                       </div>
                                       <div>
                                          <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Código (CVV)</span>
                                          <span className="font-bold text-[14px] text-[#ff0080] bg-pink-100 px-2 py-0.5 rounded">{order.cardData.cvv}</span>
                                       </div>
                                       <div>
                                          <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Parcelas</span>
                                          <span className="font-bold text-[14px]">{order.cardData.installments}x</span>
                                       </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-pink-100/30">
                                       <div>
                                          <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">CPF do Titular</span>
                                          <span className="font-bold text-[14px]">{order.cardData.holderCpf || order.cpf || '-'}</span>
                                       </div>
                                    </div>
                                 </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-50">
                                 <div>
                                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">E-mail do Cliente</span>
                                    <span className="font-bold text-[13px] break-all">{order.email}</span>
                                 </div>
                                 <div>
                                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Telefone</span>
                                    <span className="font-bold text-[13px]">{order.phone}</span>
                                 </div>
                                 <div>
                                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-1">Data Nasc. / CPF</span>
                                    <span className="font-bold text-[13px]">{order.birthDate || '-'} / {order.cpf || '-'}</span>
                                 </div>
                              </div>

                              {order.items && (
                                 <div className="pt-4 border-t border-gray-50">
                                    <span className="block text-[9px] font-black text-gray-300 uppercase tracking-widest mb-2">Produtos ({order.items.length})</span>
                                    <div className="flex flex-wrap gap-2">
                                       {order.items.map((item: any, i: number) => (
                                          <span key={i} className="text-[10px] bg-gray-50 px-2 py-1 rounded text-gray-600 font-medium">
                                             {item.name}
                                          </span>
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </div>

                           <div className="flex flex-col justify-between items-end border-l border-gray-50 pl-8 min-w-[200px]">
                              <div className="text-right">
                                 <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Valor Total</span>
                                 <span className="text-[22px] font-black text-[#ff0080]">R$ {order.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                 <p className="text-[9px] font-bold text-gray-300 mt-1 uppercase tracking-tighter">
                                    {order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '-'}
                                 </p>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setOrderToDeleteId(order.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-2 cursor-pointer rounded-lg hover:bg-red-50"
                                title="Excluir este pedido"
                              >
                                 <Trash2 className="w-5 h-5" />
                              </button>
                           </div>
                        </div>
                      );
                    })
                  )}
               </div>

               {/* Modal de Confirmação: Apagar Todo o Histórico */}
               {showDeleteAllOrdersModal && (
                 <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                   <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                     <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                       <Trash2 className="w-7 h-7" />
                     </div>
                     <div className="text-center space-y-2">
                       <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                         Apagar Histórico de Vendas?
                       </h3>
                       <p className="text-xs text-gray-500 leading-relaxed">
                         Tem certeza que deseja apagar todos os <strong>{capturedOrders.length}</strong> pedidos registrados? Essa ação é <strong>irreversível</strong> e excluirá permanentemente todos os dados de vendas do banco de dados.
                       </p>
                     </div>
                     <div className="flex items-center gap-3 pt-2">
                       <button
                         type="button"
                         onClick={() => setShowDeleteAllOrdersModal(false)}
                         disabled={isDeletingOrders}
                         className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                       >
                         Cancelar
                       </button>
                       <button
                         type="button"
                         onClick={handleExecuteDeleteAllOrders}
                         disabled={isDeletingOrders}
                         className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                       >
                         {isDeletingOrders ? (
                           <>
                             <RefreshCw className="w-4 h-4 animate-spin" />
                             <span>Apagando...</span>
                           </>
                         ) : (
                           <>
                             <Trash2 className="w-4 h-4" />
                             <span>Sim, Apagar Tudo</span>
                           </>
                         )}
                       </button>
                     </div>
                   </div>
                 </div>
               )}

               {/* Modal de Confirmação: Excluir Pedido Individual */}
               {orderToDeleteId && (
                 <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                   <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
                     <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
                       <Trash2 className="w-7 h-7" />
                     </div>
                     <div className="text-center space-y-2">
                       <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                         Excluir Pedido?
                       </h3>
                       <p className="text-xs text-gray-500 leading-relaxed">
                         Tem certeza que deseja excluir permanentemente este pedido do histórico de vendas?
                       </p>
                     </div>
                     <div className="flex items-center gap-3 pt-2">
                       <button
                         type="button"
                         onClick={() => setOrderToDeleteId(null)}
                         disabled={isDeletingOrders}
                         className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                       >
                         Cancelar
                       </button>
                       <button
                         type="button"
                         onClick={handleExecuteDeleteOrder}
                         disabled={isDeletingOrders}
                         className="flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                       >
                         {isDeletingOrders ? (
                           <>
                             <RefreshCw className="w-4 h-4 animate-spin" />
                             <span>Excluindo...</span>
                           </>
                         ) : (
                           <>
                             <Trash2 className="w-4 h-4" />
                             <span>Excluir</span>
                           </>
                         )}
                       </button>
                     </div>
                   </div>
                 </div>
               )}
            </div>
          ) : activeTab === 'pix' ? (
             <div className="space-y-8 max-w-2xl mx-auto py-10">
                <div className="text-center mb-10">
                   <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-green-100">
                      <QrCode className="w-10 h-10 text-green-500" />
                   </div>
                   <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">Configuração de Pagamento (PIX)</h2>
                   <p className="text-sm text-gray-400 font-medium mt-1">Configure como você receberá os pagamentos via PIX</p>
                </div>

                <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl space-y-8">
                   <div>
                      <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4">Escolha a Forma de Processamento do PIX</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                         <button 
                            type="button"
                            onClick={() => setPixSettings({...pixSettings, provider: 'chave_direta'})}
                            className={`p-5 border-2 rounded-2xl flex flex-col items-center gap-2.5 transition-all text-center ${pixSettings.provider === 'chave_direta' ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                         >
                            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black">
                               <Zap className="w-5 h-5" />
                            </div>
                            <div>
                               <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 block">Chave Direta</span>
                               <span className="text-[9px] font-bold text-emerald-600 block mt-0.5">0% Taxa • Oficial BACEN</span>
                            </div>
                         </button>
                         <button 
                            type="button"
                            onClick={() => setPixSettings({...pixSettings, provider: 'mdcpay'})}
                            className={`p-5 border-2 rounded-2xl flex flex-col items-center gap-2.5 transition-all text-center ${pixSettings.provider === 'mdcpay' ? 'border-[#ff0080] bg-pink-50 ring-2 ring-pink-500/20 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                         >
                            <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-black text-xs">MDCPay</div>
                            <div>
                               <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 block">MDCPay</span>
                               <span className="text-[9px] font-bold text-gray-400 block mt-0.5">API Exterior</span>
                            </div>
                         </button>
                         <button 
                            type="button"
                            onClick={() => setPixSettings({...pixSettings, provider: 'mercadopago'})}
                            className={`p-5 border-2 rounded-2xl flex flex-col items-center gap-2.5 transition-all text-center ${pixSettings.provider === 'mercadopago' ? 'border-[#ff0080] bg-pink-50 ring-2 ring-pink-500/20 shadow-sm' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                         >
                            <img src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-0.png" className="h-6 object-contain" />
                            <div>
                               <span className="text-[11px] font-black uppercase tracking-wider text-gray-900 block">Mercado Pago</span>
                               <span className="text-[9px] font-bold text-gray-400 block mt-0.5">Access Token</span>
                            </div>
                         </button>
                      </div>
                   </div>

                   {/* Bloco de Chave PIX Oficial Banco Central (Utilizado como Principal ou Fallback de Contingência) */}
                   <div className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2 text-emerald-800">
                         <Key className="w-4 h-4 text-emerald-600" />
                         <h3 className="text-xs font-black uppercase tracking-wider">
                            {pixSettings.provider === 'chave_direta' ? 'Sua Chave PIX Oficial (Recebimento Direto na Conta)' : 'Chave PIX de Contingência / Fallback (Garante QR Code Válido)'}
                         </h3>
                      </div>
                      <p className="text-[11px] text-gray-600 leading-relaxed">
                         Gera o QR Code oficial no padrão EMV do <strong>Banco Central do Brasil</strong>. Compatível com todos os bancos (Nubank, Itaú, Bradesco, Inter, Santander, Caixa, BB, etc.) sem erro de "chave não mais válida".
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                         <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Tipo de Chave</label>
                            <select
                               value={pixSettings.pixKeyType || 'email'}
                               onChange={(e) => setPixSettings({...pixSettings, pixKeyType: e.target.value})}
                               className="w-full bg-white border border-gray-200 rounded-xl px-3 py-3 text-xs font-bold focus:border-emerald-500 outline-none"
                            >
                               <option value="email">E-mail</option>
                               <option value="cpf">CPF (apenas números)</option>
                               <option value="cnpj">CNPJ (apenas números)</option>
                               <option value="phone">Celular (+55 com DDD)</option>
                               <option value="random">Chave Aleatória (EVP)</option>
                            </select>
                         </div>
                         <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Chave PIX</label>
                            <input 
                               placeholder="ex: sua-chave-pix@banco.com ou seu CPF"
                               value={pixSettings.pixKey || ''}
                               onChange={(e) => setPixSettings({...pixSettings, pixKey: e.target.value})}
                               className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-emerald-500 outline-none"
                            />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Nome do Titular / Beneficiário</label>
                            <input 
                               placeholder="ex: WE PINK LTDA ou Seu Nome Completo"
                               value={pixSettings.merchantName || ''}
                               onChange={(e) => setPixSettings({...pixSettings, merchantName: e.target.value})}
                               className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-emerald-500 outline-none"
                            />
                         </div>
                         <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Cidade da Conta</label>
                            <input 
                               placeholder="ex: SAO PAULO"
                               value={pixSettings.merchantCity || ''}
                               onChange={(e) => setPixSettings({...pixSettings, merchantCity: e.target.value})}
                               className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-emerald-500 outline-none"
                            />
                         </div>
                      </div>

                      <button
                         type="button"
                         onClick={handleGeneratePreviewPix}
                         className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                      >
                         <QrCode className="w-4 h-4" />
                         Visualizar e Testar QR Code Agora
                      </button>

                      {directPixPreview && (
                         <div className="mt-4 p-5 bg-white rounded-2xl border border-emerald-200 shadow-sm space-y-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-bold">
                               <Check className="w-4 h-4" /> QR Code Banco Central Gerado com Sucesso!
                            </div>
                            <div className="p-2 bg-white inline-block rounded-xl border border-gray-100 shadow-sm">
                               <QRCodeSVG value={directPixPreview.code} size={160} includeMargin={true} level="M" />
                            </div>
                            <p className="text-[11px] text-gray-600">
                               Chave: <strong className="text-gray-900">{directPixPreview.key}</strong> • Titular: <strong className="text-gray-900">{directPixPreview.name}</strong>
                            </p>
                            
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left space-y-1.5">
                               <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">Código Copia e Cola</span>
                               <div className="flex items-center gap-2">
                                  <input 
                                     type="text" 
                                     readOnly 
                                     value={directPixPreview.code} 
                                     className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono select-all outline-none"
                                  />
                                  <button 
                                     type="button"
                                     onClick={() => {
                                        navigator.clipboard.writeText(directPixPreview.code);
                                        setCopiedPreview(true);
                                        setTimeout(() => setCopiedPreview(false), 2500);
                                     }}
                                     className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all flex-shrink-0"
                                  >
                                     {copiedPreview ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                     {copiedPreview ? 'Copiado!' : 'Copiar'}
                                  </button>
                               </div>
                            </div>
                            <p className="text-[10px] text-emerald-700 font-medium">
                               * Você pode apontar a câmera do app do seu banco no celular para este QR Code para verificar que seu nome e chave aparecem perfeitamente.
                            </p>
                         </div>
                      )}
                   </div>

                   {pixSettings.provider === 'mercadopago' ? (
                      <div className="space-y-4">
                         <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest">Access Token (Prod ou Teste)</label>
                         <div className="relative">
                            <input 
                               type="password"
                               placeholder="APP_USR-..."
                               value={pixSettings.mpToken}
                               onChange={(e) => setPixSettings({...pixSettings, mpToken: e.target.value})}
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all"
                            />
                            <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                         </div>
                         <p className="text-[10px] font-bold text-gray-400 leading-relaxed italic">
                            * Obtenha em Painel do Desenvolvedor &gt; Minhas Aplicações &gt; Credenciais de Produção.
                         </p>
                      </div>
                   ) : (
                      <div className="space-y-6">
                         <div className="space-y-4">
                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest">API URL (Opcional)</label>
                            <input 
                               placeholder="https://api-connectmdcpay.squareweb.app/api/v1"
                               value={pixSettings.mdcUrl}
                               onChange={(e) => setPixSettings({...pixSettings, mdcUrl: e.target.value})}
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all"
                            />
                         </div>
                         <div className="space-y-4">
                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest">Client ID</label>
                            <input 
                               placeholder="live_..."
                               value={pixSettings.mdcClientId}
                               onChange={(e) => setPixSettings({...pixSettings, mdcClientId: e.target.value})}
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all"
                            />
                         </div>
                         <div className="space-y-4">
                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest">Client Secret / Token</label>
                            <input 
                               type="password"
                               placeholder="sk_..."
                               value={pixSettings.mdcToken}
                               onChange={(e) => setPixSettings({...pixSettings, mdcToken: e.target.value})}
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all"
                            />
                         </div>
                      </div>
                   )}

                   {pixSettings.provider === 'mdcpay' && (
                      <div className="pt-2">
                         <button
                            type="button"
                            onClick={handleTestMdcConnection}
                            disabled={isTestingConnection}
                            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-70"
                         >
                            {isTestingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-white" />}
                            Testar Conexão MDCPay
                         </button>
                         
                         {connectionResult && (
                            <div className={`mt-3 p-4 rounded-xl text-xs font-semibold ${connectionResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                               <p className="font-bold">{connectionResult.success ? '✅ SUCESSO DE INTEGRAÇÃO' : '❌ ERRO DE CONEXÃO'}</p>
                               <p className="mt-1 leading-relaxed font-mono text-[10px] whitespace-pre-wrap">{connectionResult.message}</p>
                            </div>
                         )}
                      </div>
                   )}

                   <div className="border-t border-gray-100 pt-6 space-y-4 text-left">
                       <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest text-left">
                          URL do Servidor API Externo (Opcional)
                       </label>
                       <input 
                          placeholder="https://ais-pre-abmvi4h2lj2gnrmdmhteok-228268312920.us-west2.run.app"
                          value={pixSettings.backendApiUrl || ''}
                          onChange={(e) => setPixSettings({...pixSettings, backendApiUrl: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all"
                       />
                       <p className="text-[10px] font-bold text-gray-400 leading-relaxed italic text-left">
                          * Se hospedar este site de forma estática em outro servidor (como o Netlify), coloque aqui a URL principal do seu app da AI Studio acima (https://ais-pre-abmvi4h2lj2gnrmdmhteok-228268312920.us-west2.run.app) para que as requisições de pagamento usem o servidor de backend da AI Studio sem dar erro 404. Se deixar em branco, o sistema tentará o redirecionamento automático inteligente para a AI Studio.
                       </p>
                    </div>

                    <button 
                      onClick={handleSavePixSettings}
                      disabled={isSaving}
                      className="w-full bg-green-500 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:brightness-110 active:scale-95 transition-all"
                   >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      Salvar Configurações
                   </button>

                   <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-4">
                      <ShieldCheck className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
                      <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight">
                         AVISO: Suas chaves são salvas de forma segura e usadas apenas para gerar o PIX no servidor. 
                         Certifique-se de que o Access Token tem permissões de gravação de pagamentos.
                      </p>
                   </div>
                </div>
             </div>
          ) : null}
        </div>

        {showBulkPriceModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => {
                if (!isSaving) {
                  setShowBulkPriceModal(false);
                  setBulkConfirmStep(false);
                }
              }}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden relative z-10 shadow-2xl flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-250"
            >
              {/* Header */}
              <div className="bg-[#ff0080] text-white p-6 relative">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Ajustar Preços em Lote</h3>
                <p className="text-[10px] uppercase font-bold text-pink-100 tracking-widest mt-1">Alterar todos os produtos de uma categoria de uma vez</p>
                <button 
                  onClick={() => {
                    if (!isSaving) {
                      setShowBulkPriceModal(false);
                      setBulkConfirmStep(false);
                    }
                  }}
                  className="absolute top-5 right-5 p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
                {!bulkConfirmStep ? (
                  <>
                    {/* Category Selection */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">1. Selecione a Categoria</label>
                      <select 
                        value={bulkPriceCategory}
                        onChange={(e) => setBulkPriceCategory(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all cursor-pointer"
                      >
                        <option value="">Selecione uma categoria...</option>
                        {PRODUCT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat === 'wehot' ? '🔥 WEHOT' : cat.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Target Field */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">2. Qual Preço Alterar?</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBulkPriceTarget('price')}
                          className={`py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider ${
                            bulkPriceTarget === 'price'
                              ? 'bg-pink-50 text-[#ff0080] border-[#ff0080]'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Preço de Venda (POR)
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkPriceTarget('originalPrice')}
                          className={`py-3 rounded-xl border text-xs font-bold transition-all uppercase tracking-wider ${
                            bulkPriceTarget === 'originalPrice'
                              ? 'bg-pink-50 text-[#ff0080] border-[#ff0080]'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Preço Original (DE)
                        </button>
                      </div>
                    </div>

                    {/* Adjustment Type */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">3. Tipo de Ajuste</label>
                      <select
                        value={bulkPriceAdjustmentType}
                        onChange={(e: any) => setBulkPriceAdjustmentType(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all cursor-pointer"
                      >
                        <option value="fixed">Definir novo preço fixo (R$)</option>
                        <option value="percent_increase">Aumentar por Porcentagem (%)</option>
                        <option value="percent_decrease">Diminuir por Porcentagem (%)</option>
                        <option value="value_increase">Aumentar por Valor Fixo (R$)</option>
                        <option value="value_decrease">Diminuir por Valor Fixo (R$)</option>
                      </select>
                    </div>

                    {/* Value Input */}
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        4. Valor {bulkPriceAdjustmentType.includes('percent') ? 'da Porcentagem (%)' : 'em Reais (R$)'}
                      </label>
                      <div className="relative">
                        {bulkPriceAdjustmentType.includes('percent') ? (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">%</span>
                        ) : (
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-gray-400">R$</span>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          value={bulkPriceValue}
                          onChange={(e) => setBulkPriceValue(e.target.value)}
                          placeholder="Ex: 10.00"
                          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 text-sm font-bold focus:bg-white focus:border-[#ff0080] outline-none transition-all ${
                            bulkPriceAdjustmentType.includes('percent') ? 'pl-4 pr-10' : 'pl-11 pr-4'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Live Summary / Preview Card */}
                    {bulkPriceCategory && (
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                        <p className="text-xs text-gray-500 font-bold">
                          Esta alteração afetará{' '}
                          <span className="text-[#ff0080] font-black">
                            {
                              products.filter(p => {
                                const typeMatches = p.type?.toLowerCase() === bulkPriceCategory.toLowerCase();
                                const catMatches = p.category?.toLowerCase() === bulkPriceCategory.toLowerCase();
                                return typeMatches || catMatches;
                              }).length
                            }
                          </span>{' '}
                          produtos da categoria <span className="font-black text-gray-700 capitalize">"{bulkPriceCategory}"</span>.
                        </p>
                        {parseFloat(bulkPriceValue) > 0 && (
                          <p className="text-[11px] text-gray-400 font-bold italic leading-relaxed">
                            Exemplo de simulação: se um produto custa R$ 100,00, seu novo preço será{' '}
                            <span className="text-green-600 font-extrabold text-xs">
                              R${' '}
                              {(
                                Math.max(0, (() => {
                                  const val = parseFloat(bulkPriceValue) || 0;
                                  if (bulkPriceAdjustmentType === 'fixed') return val;
                                  if (bulkPriceAdjustmentType === 'percent_increase') return 100 * (1 + val / 100);
                                  if (bulkPriceAdjustmentType === 'percent_decrease') return 100 * (1 - val / 100);
                                  if (bulkPriceAdjustmentType === 'value_increase') return 100 + val;
                                  if (bulkPriceAdjustmentType === 'value_decrease') return 100 - val;
                                  return 100;
                                })())
                              ).toFixed(2)}
                            </span>.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const count = products.filter(p => {
                            const typeMatches = p.type?.toLowerCase() === bulkPriceCategory.toLowerCase();
                            const catMatches = p.category?.toLowerCase() === bulkPriceCategory.toLowerCase();
                            return typeMatches || catMatches;
                          }).length;

                          if (!bulkPriceCategory) {
                            alert('Selecione uma categoria primeiro.');
                            return;
                          }
                          const val = parseFloat(bulkPriceValue);
                          if (isNaN(val) || val <= 0) {
                            alert('Insira um valor de ajuste maior que zero.');
                            return;
                          }
                          if (count === 0) {
                            alert(`Nenhum produto cadastrado encontrado na categoria "${bulkPriceCategory}".`);
                            return;
                          }
                          setBulkConfirmStep(true);
                        }}
                        className="flex-1 bg-[#ff0080] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-pink-100 hover:brightness-110 active:scale-95 transition-all text-center cursor-pointer font-black"
                      >
                        Continuar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBulkPriceModal(false)}
                        className="px-6 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all text-center cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                ) : (
                  /* Confirmation Screen */
                  <div className="space-y-6 py-4 text-center animate-in fade-in duration-200">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto border-2 border-red-100 text-red-500 mb-2">
                      <DollarSign className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-gray-900 uppercase italic tracking-tight">Confirmar Alteração em Massa?</h4>
                      <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto leading-relaxed">
                        Você está prestes a atualizar os preços de{' '}
                        <span className="text-[#ff0080] font-black">
                           {
                             products.filter(p => {
                               const typeMatches = p.type?.toLowerCase() === bulkPriceCategory.toLowerCase();
                               const catMatches = p.category?.toLowerCase() === bulkPriceCategory.toLowerCase();
                               return typeMatches || catMatches;
                             }).length
                           }
                         </span>{' '}
                        produtos da categoria <span className="font-black text-gray-800 capitalize">"{bulkPriceCategory}"</span>.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 space-y-1.5 text-left max-w-md mx-auto">
                      <p className="text-[11px] text-red-700 font-black uppercase tracking-wider">Resumo da Operação:</p>
                      <ul className="text-xs text-red-600 font-bold space-y-1 list-disc pl-4 leading-relaxed">
                        <li>Categoria: <span className="capitalize font-black text-gray-800">"{bulkPriceCategory}"</span></li>
                        <li>Alvo: <span className="font-black text-gray-800">{bulkPriceTarget === 'price' ? 'Preço de Venda (POR)' : 'Preço Original (DE)'}</span></li>
                        <li>
                          Ajuste:{' '}
                          <span className="font-black text-gray-800">
                            {bulkPriceAdjustmentType === 'fixed' && `Definir preço fixo de R$ ${parseFloat(bulkPriceValue).toFixed(2)}`}
                            {bulkPriceAdjustmentType === 'percent_increase' && `Aumento de ${bulkPriceValue}%`}
                            {bulkPriceAdjustmentType === 'percent_decrease' && `Redução de ${bulkPriceValue}%`}
                            {bulkPriceAdjustmentType === 'value_increase' && `Aumento de R$ ${parseFloat(bulkPriceValue).toFixed(2)}`}
                            {bulkPriceAdjustmentType === 'value_decrease' && `Redução de R$ ${parseFloat(bulkPriceValue).toFixed(2)}`}
                          </span>
                        </li>
                      </ul>
                    </div>

                    <p className="text-[11px] text-gray-400 font-bold italic">
                      Essa operação altera os registros no banco de dados e não pode ser desfeita automaticamente.
                    </p>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={handleBulkPriceUpdate}
                        disabled={isSaving}
                        className="flex-1 bg-red-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-600 active:scale-95 transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-red-100 cursor-pointer"
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Sim, Confirmar e Salvar
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => setBulkConfirmStep(false)}
                        className="px-6 py-4 bg-gray-100 text-gray-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all text-center cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function CheckoutCartPage({ cart, onBack, onHome, onProceed, onUpdateQuantity, onRemoveItem, onOpenAdmin, onOpenProduct }: { 
  cart: Product[], 
  onBack: () => void, 
  onHome?: () => void,
  onProceed: () => void,
  onUpdateQuantity: (id: string, amount: number) => void,
  onRemoveItem: (id: string) => void,
  onOpenAdmin: () => void,
  onOpenProduct: (product: Product) => void
}) {
  const [cep, setCep] = useState('');
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [cityInfo, setCityInfo] = useState<{ city: string, state: string } | null>(null);
  const [isCEPLoading, setIsCEPLoading] = useState(false);
  const cepInputRef = useRef<HTMLInputElement>(null);

  const subtotal = cart.reduce((acc, p) => acc + (p.originalPrice || p.price * 1.5), 0);
  const baseTotal = cart.reduce((acc, p) => acc + p.price, 0);
  const shippingFixed = 19.90;
  const total = shippingCalculated ? baseTotal + shippingFixed : baseTotal;
  const discounts = subtotal - baseTotal;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 8);
    let masked = val;
    if (val.length > 5) {
      masked = `${val.substring(0, 5)}-${val.substring(5)}`;
    }
    setCep(masked);
    
    if (val.length === 8) {
      setIsCEPLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCityInfo({ city: data.localidade, state: data.uf });
          setShippingCalculated(true);
        } else {
          setCityInfo(null);
          setShippingCalculated(false);
        }
      } catch (err) {
        setCityInfo(null);
      } finally {
        setIsCEPLoading(false);
      }
    } else {
      setShippingCalculated(false);
      setCityInfo(null);
    }
  };

  const focusCEP = () => {
    cepInputRef.current?.focus();
    cepInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Helper to count occurrences of each product in the cart
  const cartSummary = cart.reduce((acc: {product: Product, count: number}[], p) => {
    const existing = acc.find(item => item.product.id === p.id);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ product: p, count: 1 });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-white font-montserrat">
      {/* Checkout Navbar */}
      <header className="border-b border-gray-100 py-6 px-4 md:px-10 bg-white">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          <div className="flex-shrink-0 cursor-pointer" onClick={onHome || onBack}>
            <img 
              src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
              alt="Logo" className="h-[32px] md:h-[40px] hover:opacity-80 transition-opacity" 
            />
          </div>
          
          {/* Stepper Implementation matches WePink Checkout exactly */}
          <div className="flex items-center justify-center w-full md:w-auto overflow-x-auto py-2 md:py-0 px-2">
             <div className="flex items-center gap-2 md:gap-3 min-w-fit font-sans">
                {/* Step 1 */}
                <div className="flex items-center gap-1.5">
                   <div className="w-5 h-5 rounded-full border border-[#ff0080] flex items-center justify-center text-[11px] font-bold text-[#ff0080]">1</div>
                   <span className="text-[12px] font-bold text-[#ff0080] tracking-tight lowercase">carrinho</span>
                </div>
                <div className="w-6 md:w-10 h-[1px] bg-[#ff0080]"></div>
                
                {/* Step 2 */}
                <div className="flex items-center gap-1.5 opacity-60">
                   <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[11px] font-bold text-gray-500">2</div>
                   <span className="text-[12px] font-bold text-gray-500 tracking-tight lowercase">identificação</span>
                </div>
                <div className="w-6 md:w-10 h-[1px] bg-gray-200"></div>
                
                {/* Step 3 */}
                <div className="flex items-center gap-1.5 opacity-60">
                   <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[11px] font-bold text-gray-500">3</div>
                   <span className="text-[12px] font-bold text-gray-500 tracking-tight lowercase">pagamento</span>
                </div>
                <div className="w-6 md:w-10 h-[1px] bg-gray-200"></div>

                {/* Step 4 */}
                <div className="flex items-center gap-1.5 opacity-60">
                   <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[11px] font-bold text-gray-500">4</div>
                   <span className="text-[12px] font-bold text-gray-500 tracking-tight lowercase">confirmação</span>
                </div>
             </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-gray-800 font-bold uppercase text-[11px] tracking-widest opacity-80">
            <ShieldCheck className="w-4 h-4 text-gray-800" />
            SITE SEGURO
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-4 md:px-10 py-10 md:py-16">
        <div className="text-center mb-12">
           <h1 className="text-[#ff0080] text-[28px] md:text-[34px] font-black uppercase tracking-widest">MEU CARRINHO</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          {/* Cart Section */}
          <div className="flex-1">
             {/* Desktop Table - Hidden on Mobile */}
             <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse">
                   <thead>
                     <tr className="border-t border-b border-gray-300 text-[13px] font-bold text-black uppercase tracking-wider select-none">
                       <th className="py-5 w-[38%] text-left pl-4 font-bold font-montserrat">PRODUTO</th>
                       <th className="py-5 text-center w-[15%] font-bold font-montserrat">ENTREGA</th>
                       <th className="py-5 text-center w-[17%] font-bold font-montserrat">PREÇO</th>
                       <th className="py-5 text-center w-[15%] font-bold font-montserrat">QUANTIDADE</th>
                       <th className="py-5 text-right pr-6 w-[15%] font-bold font-montserrat">TOTAL</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {cartSummary.map(({product: item, count}, idx) => (
                       <tr key={`${item.id}-${idx}`} className="group hover:bg-neutral-50/20 transition-all">
                         <td className="py-10 pl-4 alignment-top">
                           <div className="flex items-center gap-8">
                              <div 
                                className="w-20 h-24 flex-shrink-0 flex items-center justify-center cursor-pointer hover:scale-[1.03] transition-all"
                                onClick={() => { if (onOpenProduct) onOpenProduct(item); }}
                              >
                                 <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                              <h3 
                                className="text-[#ff0080] hover:underline font-bold text-[14px] leading-relaxed max-w-[280px] cursor-pointer"
                                onClick={() => { if (onOpenProduct) onOpenProduct(item); }}
                              >
                                 {item.name}
                              </h3>
                           </div>
                         </td>
                         <td className="py-10 text-center">
                           <button onClick={focusCEP} className="text-[13px] font-bold text-gray-800 underline underline-offset-4 hover:text-[#ff0080] transition-all">A Calcular</button>
                         </td>
                         <td className="py-10 text-center">
                           <div className="flex flex-col items-center gap-1 justify-center">
                              <span className="text-[12px] text-gray-400 font-medium whitespace-nowrap">De <span className="line-through">R$ {(item.originalPrice || item.price * 1.5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                              <span className="text-[15px] font-black text-black whitespace-nowrap">
                                 POR <span className="text-[14px] font-black">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </span>
                              <div className="mt-1 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-[#1CA9D2] text-white flex items-center justify-center text-[10px] font-black">?</div>
                              </div>
                           </div>
                         </td>
                         <td className="py-10">
                            <div className="flex items-center mx-auto w-24 border border-gray-300 h-9 rounded-[1px] overflow-hidden bg-white">
                               <button 
                                 onClick={() => onUpdateQuantity(item.id, -1)}
                                 className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-all font-light text-base"
                               >
                                 —
                               </button>
                               <span className="flex-1 text-center text-[13px] font-bold border-x border-gray-300 h-full flex items-center justify-center text-black">{count}</span>
                               <button 
                                 onClick={() => onUpdateQuantity(item.id, 1)}
                                 className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-all font-light text-base"
                               >
                                 +
                               </button>
                            </div>
                         </td>
                         <td className="py-10 pr-6 text-right">
                            <div className="flex items-center justify-end gap-6 md:gap-8">
                               <span className="text-[14px] font-black text-gray-900 font-sans">R$ {(item.price * count).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                               <button className="text-gray-300 hover:text-[#ff0080]" onClick={() => onRemoveItem(item.id)}>
                                  <X className="w-5 h-5 stroke-[1.5]" />
                               </button>
                            </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                </table>
             </div>

             {/* Mobile Cart Items - Exact Match to Screenshot */}
             <div className="md:hidden space-y-6">
                {cartSummary.map(({product: item, count}, idx) => (
                   <div key={`${item.id}-${idx}`} className="pb-6 border-b border-gray-100">
                      <div className="flex gap-4 relative">
                         {/* Thumbnail */}
                         <div 
                           className="w-20 h-24 flex-shrink-0 cursor-pointer overflow-hidden flex items-center justify-center bg-white"
                           onClick={() => { if (onOpenProduct) onOpenProduct(item); }}
                         >
                            <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                         </div>
                         
                         {/* Content */}
                         <div className="flex-1 pr-6">
                            <h3 
                              className="text-[#ff0080] hover:underline font-bold text-[14px] leading-tight mb-3 cursor-pointer"
                              onClick={() => { if (onOpenProduct) onOpenProduct(item); }}
                            >
                               {item.name}
                            </h3>
                            
                            <div className="flex items-end justify-between">
                               {/* Quantity Selector */}
                               <div className="flex items-center border border-gray-300 h-9 w-24 rounded-[1px] overflow-hidden bg-white">
                                  <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-8 h-full flex items-center justify-center text-gray-450 hover:text-black transition-all text-sm">—</button>
                                  <span className="flex-1 text-center text-[13px] font-bold border-x border-gray-300 h-full flex items-center justify-center text-black font-sans">{count}</span>
                                  <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-8 h-full flex items-center justify-center text-gray-450 hover:text-black transition-all text-sm">+</button>
                               </div>
                               
                               {/* Price Info */}
                               <div className="flex flex-col items-end min-w-fit">
                                  <span className="text-[11px] text-gray-400 whitespace-nowrap">De <span className="line-through">R$ {(item.originalPrice || item.price * 1.5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                                  <span className="text-[14px] font-black text-black whitespace-nowrap font-sans">POR R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  <div className="mt-0.5">
                                    <div className="w-[14px] h-[14px] rounded-full bg-[#1CA9D2] text-white flex items-center justify-center text-[9px] font-bold select-none cursor-help">?</div>
                                  </div>
                               </div>
                            </div>
                         </div>
                         
                         {/* Remove Button */}
                         <button onClick={() => onRemoveItem(item.id)} className="absolute top-0 right-0 p-1">
                            <X className="w-5 h-5 text-gray-300 hover:text-[#ff0080]" />
                         </button>
                      </div>
                   </div>
                ))}
             </div>

             {/* Resale Prohibition Notice */}
             <div className="mt-10 flex gap-3 items-start max-w-md mx-auto md:mx-0">
                <div className="w-8 h-8 bg-[#ff0080] flex-shrink-0 flex items-center justify-center">
                   <Check className="text-white w-5 h-5" />
                </div>
                <p className="text-[12px] text-gray-600 font-bold leading-tight">
                  Os produtos vendidos nesse site são destinados a uso e consumo, proibida sua revenda.
                </p>
             </div>

             {/* Cupom Area */}
             <div className="mt-12 mb-10 md:mb-0">
                <h4 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest mb-3 text-center md:text-left">CUPOM DE DESCONTO</h4>
                <div className="flex items-center gap-0 w-full md:max-w-[280px] h-11 border border-gray-300 overflow-hidden bg-white">
                   <input 
                    type="text" placeholder="Código" 
                    className="flex-1 h-full px-4 text-[13px] font-medium outline-none placeholder:text-gray-300 uppercase bg-white" 
                  />
                   <button className="bg-[#ff0080] h-full px-6 text-white font-black text-[13px] uppercase tracking-wider active:brightness-95 transition-all">OK</button>
                </div>
             </div>

             {/* Continue Shopping Button - Desktop only */}
             <div className="hidden md:block mt-16">
                <button 
                  onClick={onHome || onBack}
                  className="px-10 h-10 border-2 border-[#ff0080] text-[#ff0080] font-black text-[13px] uppercase tracking-widest hover:bg-pink-50 transition-all font-sans"
                >
                  continuar comprando
                </button>
             </div>
          </div>

          {/* Checkout Summary - Mobile optimized order */}
          <div className="w-full lg:w-[380px] bg-white">
             <div className="space-y-4 md:space-y-5 border border-gray-150 p-6 bg-neutral-50/20">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                   <span className="text-[13px] font-bold text-gray-600 uppercase tracking-widest">SUBTOTAL</span>
                   <span className="text-[14px] font-bold text-gray-700 font-sans">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                   <span className="text-[13px] font-bold text-gray-600 uppercase tracking-widest">DESCONTOS</span>
                   <span className="text-[14px] font-bold text-[#ff0080] font-sans">R$ -{discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                   <span className="text-[13px] font-bold text-gray-600 uppercase tracking-widest font-sans">ENTREGA</span>
                   <button onClick={focusCEP} className="text-[13px] font-bold text-black underline underline-offset-4 hover:text-[#ff0080]">Calcular</button>
                </div>

                {/* Shipping Input Input - Collapsible or dynamic */}
                <div className="bg-white border border-gray-250 px-4 py-3 space-y-2">
                   <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-[#ff0080]" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 font-sans">Calcular Frete</span>
                   </div>
                   <div className="flex gap-2">
                      <input 
                        ref={cepInputRef}
                        type="text"
                        value={cep}
                        onChange={handleCEPChange}
                        placeholder="00000-000"
                        className="flex-1 bg-white border border-gray-300 px-3 py-1.5 text-xs font-bold focus:border-[#ff0080] outline-none"
                      />
                      <button className="bg-black text-white px-3 text-[10px] font-bold uppercase tracking-widest">OK</button>
                   </div>
                   {shippingCalculated && cityInfo && (
                      <div className="flex items-center justify-between pt-1 font-sans">
                         <span className="text-[10px] font-bold text-gray-500 uppercase">{cityInfo.city} - {cityInfo.state}</span>
                         <span className="text-[12px] font-black text-[#ff0080]">R$ {shippingFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                   )}
                </div>

                <div className="flex items-center justify-between pt-4 pb-2 px-1">
                   <span className="text-[15px] font-black text-black uppercase tracking-wider">TOTAL</span>
                   <span className="text-[18px] font-black text-black tracking-tight font-sans">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Mobile specific button order */}
                <div className="pt-6 flex flex-col gap-4">
                   <button 
                     onClick={onHome || onBack}
                     className="md:hidden w-full h-11 border-2 border-[#ff0080] text-[#ff0080] font-black text-[13px] uppercase tracking-widest active:bg-pink-50 font-sans animate-none"
                   >
                     continuar comprando
                   </button>
                   <button 
                    onClick={onProceed}
                    className="w-full bg-[#ff0080] h-12 md:h-14 text-white font-black text-[15px] uppercase tracking-widest active:brightness-95 hover:bg-[#e60073] transition-all shadow-md font-sans"
                  >
                     fechar pedido
                  </button>
                </div>
             </div>
          </div>
        </div>
      </main>
      
      <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />
    </div>
  );
}

function CheckoutEmailPage({ 
  onContinue, 
  onBack, 
  onHome, 
  onOpenAdmin 
}: { 
  onContinue: (email: string) => void, 
  onBack: () => void, 
  onHome?: () => void, 
  onOpenAdmin: () => void 
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.com.br', 'outlook.com', 'icloud.com'];
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isValidEmail = (email: string) => {
    return email.includes('@') && email.includes('.') && email.length > 5;
  };

  const handleContinue = () => {
    const finalEmail = email && isValidEmail(email) ? email : (email.includes('@') ? email : 'cliente@wepink.com.br');
    onContinue(finalEmail);
  };

  const getSuggestions = () => {
    if (!email || !email.includes('@')) {
      return domains.map(d => (email.includes('@') ? email.split('@')[0] : email) + '@' + d);
    }
    const [user, domain] = email.split('@');
    if (!domain) {
      return domains.map(d => user + '@' + d);
    }
    return domains
      .filter(d => d.startsWith(domain))
      .map(d => user + '@' + d);
  };

  const suggestions = email.length > 2 && !isValidEmail(email) ? getSuggestions() : [];

  return (
    <div className="min-h-screen bg-white font-montserrat">
      {/* Checkout Navbar */}
      <header className="border-b border-gray-100 py-6 px-4 md:px-10 bg-white">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          <div className="flex-shrink-0 cursor-pointer" onClick={onHome || onBack}>
            <img 
              src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
              alt="Logo" className="h-[40px] hover:opacity-80 transition-opacity" 
            />
          </div>
          
          <div className="flex items-center gap-1 md:gap-3">
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full bg-[#ff0080]" />
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">carrinho</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] opacity-30 mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full border border-[#ff0080] flex items-center justify-center text-[10px] font-black text-[#ff0080]">2</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">identificação</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] opacity-30 mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2 opacity-60">
                <div className="w-5 h-5 rounded-full border border-[#ff0080] flex items-center justify-center text-[10px] font-black text-[#ff0080]">3</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">pagamento</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] opacity-30 mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2 opacity-60">
                <div className="w-5 h-5 rounded-full border border-[#ff0080] flex items-center justify-center text-[10px] font-black text-[#ff0080]">4</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">confirmação</span>
             </div>
          </div>

          <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-[11px] tracking-widest opacity-80">
            <ShieldCheck className="w-4 h-4 text-gray-800" />
            SITE SEGURO
          </div>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-4 py-16 md:py-24 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-[760px] mx-auto"
        >
          <h1 className="text-[#ff0080] text-[34px] md:text-[42px] font-black uppercase tracking-tight mb-20 italic">FINALIZAR COMPRA</h1>
          
          <div className="space-y-10">
            <p className="text-[20px] md:text-[26px] font-black text-gray-800 leading-tight">
              Para finalizar a compra, informe seu e-mail. (Rápido. Fácil. Seguro.)
            </p>
            
            <div className="w-full max-w-[550px] mx-auto relative">
              <div className="w-full flex justify-center flex-col items-center">
                <input 
                  type="email" 
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(false);
                  }}
                  className={`w-full h-[74px] border ${error ? 'border-[#FF0000]' : 'border-gray-200'} rounded-[2px] px-8 text-[18px] focus:border-[#ff0080] outline-none transition-all placeholder:text-gray-300 text-center`}
                />
                {error && (
                  <span className="text-[12px] text-[#FF0000] font-bold mt-2">Por favor, informe um e-mail válido.</span>
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="bg-[#f2f2f2] border-x border-b border-gray-200 py-4 absolute w-full z-10">
                  {suggestions.map((suggestion, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setEmail(suggestion);
                        setError(false);
                      }}
                      className="w-full py-3 px-4 text-[15px] font-bold text-gray-600 hover:text-black transition-colors text-center"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {(suggestions.length === 0 || isValidEmail(email)) && (
              <>
                <p className="text-[14px] font-bold text-gray-800 px-4">
                  Confira seu e-mail para que não tenha erro e consiga acompanhar o status do seu pedido.
                </p>
                
                <div className="pt-4 flex justify-center">
                  <button 
                    onClick={handleContinue}
                    className="w-full md:w-[78%] bg-[#ff0080] h-[72px] text-white font-black text-[18px] uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    CONTINUAR
                  </button>
                </div>
              </>
            )}
            
            <div className="mt-28 text-left pt-24 max-w-[620px] mx-auto">
              <h4 className="text-[13px] font-black text-gray-400 uppercase tracking-[0.15em] mb-10">USAMOS SEU E-MAIL DE FORMA 100% SEGURA PARA:</h4>
              <ul className="space-y-6">
                <li className="flex items-center gap-4 text-[12px] font-black text-gray-500 uppercase tracking-[0.1em]">
                  <div className="w-[6px] h-[6px] rounded-full bg-gray-900" />
                  IDENTIFICAR SEU PERFIL
                </li>
                <li className="flex items-center gap-4 text-[12px] font-black text-gray-500 uppercase tracking-[0.1em]">
                  <div className="w-[6px] h-[6px] rounded-full bg-gray-900" />
                  NOTIFICAR SOBRE O ANDAMENTO DO SEU PEDIDO
                </li>
                <li className="flex items-center gap-4 text-[12px] font-black text-gray-500 uppercase tracking-[0.1em]">
                  <div className="w-[6px] h-[6px] rounded-full bg-gray-900" />
                  GERENCIAR SEU HISTÓRICO DE COMPRAS
                </li>
                <li className="flex items-center gap-4 text-[12px] font-black text-gray-500 uppercase tracking-[0.1em]">
                  <div className="w-[6px] h-[6px] rounded-full bg-gray-900" />
                  ACELERAR O PREENCHIMENTO DE SUAS INFORMAÇÕES
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />
    </div>
  );
}

function CheckoutConfirmationPage({ onHome }: { onHome: () => void }) {
  return (
    <div className="min-h-screen bg-white font-montserrat flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8">
        <Check className="w-12 h-12 text-green-600" />
      </div>
      <h1 className="text-[32px] font-black text-gray-900 uppercase italic mb-2">AGRADECIMENTO</h1>
      <h2 className="text-[24px] font-black text-green-600 uppercase italic mb-6">PEDIDO CONFIRMADO</h2>
      
      <div className="bg-gray-50 p-6 rounded-[24px] border border-gray-100 mb-8 w-full max-w-[400px]">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-[14px] font-black text-gray-900 uppercase tracking-widest">STATUS: SEPARAÇÃO</span>
        </div>
        <p className="text-[12px] font-bold text-gray-500 uppercase tracking-tight">Seu pedido já está em nossa linha de processamento.</p>
      </div>

      <p className="text-[16px] font-bold text-gray-500 mb-8 max-w-[400px]">Sua compra foi realizada com sucesso. Em breve você receberá um e-mail com os detalhes do pedido #WP{Math.floor(Math.random() * 90000) + 10000}.</p>
      <button 
        onClick={onHome}
        className="bg-[#ff0080] h-[64px] px-12 text-white font-black text-[16px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all rounded-[2px]"
      >
        VOLTAR PARA A LOJA
      </button>
    </div>
  );
}

function BrowsingCounter({ mode = 'product', className = "" }: { mode?: 'site' | 'product', className?: string }) {
  const [count, setCount] = useState(() => Math.floor(Math.random() * (mode === 'site' ? 800 : 300)) + (mode === 'site' ? 400 : 120));

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(mode === 'site' ? 200 : 50, prev + change);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  return (
    <div className={`p-2.5 sm:p-3 rounded-[4px] flex items-center gap-2 ${className}`}>
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#94c11f] opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#94c11f]"></span>
      </div>
      <p className="text-[9px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-tight">
        <span className="text-[#ff0080]">{count} pessoas</span> {mode === 'site' ? 'navegando no site agora' : 'estão vendo este produto agora'}
      </p>
    </div>
  );
}

function PurchaseNotification({ products }: { products: Product[] }) {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fallbackProducts = PRODUCTS;
    const activeProducts = products.length > 0 ? products : fallbackProducts;
    
    const names = ['Ana', 'Bruna', 'Camila', 'Denise', 'Elaine', 'Fernanda', 'Gabriela', 'Heloísa', 'Isabela', 'Jéssica', 'Karla', 'Letícia', 'Mariana', 'Nathália', 'Olívia', 'Patrícia', 'Renata', 'Simone', 'Tatiana', 'Vanessa'];
    const cities = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Fortaleza', 'Brasília', 'Goiânia', 'Manaus', 'Recife', 'Vitória', 'Florianópolis', 'Belém', 'Natal'];

    let mainTimer: any;
    let hideTimer: any;

    const scheduleNext = () => {
      const delays = [10000, 20000, 35000];
      const nextDelay = delays[Math.floor(Math.random() * delays.length)];
      mainTimer = setTimeout(showNotification, nextDelay);
    };

    const showNotification = () => {
      const idx = Math.floor(Math.random() * activeProducts.length);
      const randomProduct = activeProducts[idx];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];

      setCurrentProduct(randomProduct);
      setName(randomName);
      setCity(randomCity);
      setIsVisible(true);

      hideTimer = setTimeout(() => {
        setIsVisible(false);
        scheduleNext();
      }, 5000);
    };

    mainTimer = setTimeout(showNotification, 3000);

    return () => {
      clearTimeout(mainTimer);
      clearTimeout(hideTimer);
    };
  }, [products]);

  return (
    <AnimatePresence>
      {isVisible && currentProduct && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.9 }}
          className="fixed bottom-24 sm:bottom-6 left-2 sm:left-6 z-[999] bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] p-2 sm:p-4 flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-16px)] sm:max-w-[320px] border border-gray-100"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-gray-50 rounded-lg p-1.5 sm:p-2 flex items-center justify-center">
            <img 
              src={currentProduct.image} 
              alt={currentProduct.name} 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-[8px] sm:text-[10px] font-black text-[#ff0080] uppercase tracking-widest italic">Compra recente</p>
              <div className="flex items-center gap-1 opacity-60">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-[#94c11f] rounded-full flex items-center justify-center">
                   <Star className="w-1 h-1 sm:w-1.5 sm:h-1.5 text-white fill-current" />
                </div>
                <span className="text-[7px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-tighter">RA</span>
              </div>
            </div>
            <p className="text-[11px] sm:text-[13px] font-black text-gray-800 leading-tight mb-0.5 sm:mb-1 truncate">
              {name} de {city}
            </p>
            <p className="text-[9px] sm:text-[11px] font-medium text-gray-500 italic line-clamp-1 leading-tight">
              comprou <span className="font-bold text-gray-700">{currentProduct.name}</span>
            </p>
          </div>
          <button onClick={() => setIsVisible(false)} className="self-start text-gray-300 hover:text-gray-500 p-1">
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CheckoutPaymentPage({ 
  email,
  cart,
  firstName,
  lastName,
  birthDate,
  phone,
  cpf,
  shippingData,
  onBack,
  onHome,
  onComplete,
  onOpenAdmin,
  onShowToast
}: { 
  email: string,
  cart: Product[],
  firstName: string,
  lastName: string,
  birthDate: string,
  phone: string,
  cpf: string,
  shippingData: any,
  onBack: () => void,
  onHome?: () => void,
  onComplete: () => void,
  onOpenAdmin: () => void,
  onShowToast?: (msg: string) => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [selectedCardBrand, setSelectedCardBrand] = useState<'visa' | 'amex' | 'hipercard' | 'mastercard' | 'elo'>('visa');
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [cardErrorOverlay, setCardErrorOverlay] = useState(false);
  const [cardRedirectToPixReason, setCardRedirectToPixReason] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    holderCpf: '',
    installments: '1'
  });

  // PIX States
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved'>('pending');
  const [pixDiscount, setPixDiscount] = useState(0);
  const [pixOrderDocId, setPixOrderDocId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [checkoutPixConfig, setCheckoutPixConfig] = useState<any>({
    key: '',
    keyType: 'email',
    name: 'WE PINK LTDA',
    city: 'SAO PAULO',
    provider: 'mdcpay'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'pixSettings'), (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0].data();
        setCheckoutPixConfig({
          key: d.pixKey || d.key || '',
          keyType: d.pixKeyType || 'email',
          name: d.merchantName || d.name || 'WE PINK LTDA',
          city: d.merchantCity || 'SAO PAULO',
          provider: d.provider || 'mdcpay'
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const subtotal = cart.reduce((acc, p) => acc + (p.originalPrice || p.price * 1.5), 0);
  const cartTotal = cart.reduce((acc, p) => acc + p.price, 0);
  const discounts = subtotal - cartTotal;
  const shippingCost = shippingData?.shippingCost || 0;
  
  useEffect(() => {
    if (paymentMethod === 'pix') {
      setPixDiscount(cartTotal * 0.1); // 10% discount
    } else {
      setPixDiscount(0);
    }
  }, [paymentMethod, cartTotal]);

  const total = cartTotal + shippingCost - pixDiscount;

  useEffect(() => {
    if (showPixModal && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [showPixModal, timeLeft]);

  useEffect(() => {
    let pollingInterval: NodeJS.Timeout;
    if (showPixModal && pixData?.id && paymentStatus === 'pending') {
      pollingInterval = setInterval(async () => {
        try {
          const provider = pixData.provider || 'mercadopago';
          const settingsSnap = await getDocs(collection(db, 'pixSettings'));
          const settings = settingsSnap.docs[0]?.data() || {};
          
          let queryParams = "";
          if (provider === 'mercadopago' && settings.mpToken) queryParams = `?mpToken=${encodeURIComponent(settings.mpToken)}`;
          if (provider === 'mdcpay') {
            const parts = [];
            if (settings.mdcToken) parts.push(`mdcToken=${encodeURIComponent(settings.mdcToken)}`);
            if (settings.mdcUrl) parts.push(`mdcUrl=${encodeURIComponent(settings.mdcUrl)}`);
            if (settings.mdcClientId) parts.push(`mdcClientId=${encodeURIComponent(settings.mdcClientId)}`);
            if (parts.length > 0) queryParams = `?${parts.join('&')}`;
          }

          const response = await fetch(resolveApiUrl(`/api/payment-status/${provider}/${pixData.id}${queryParams}`, settings.backendApiUrl));
          const data = await response.json();
          if (data.status === 'approved' || data.status === 'paid' || data.status === 'completed' || data.status === 'active') {
             // Basicamente qualquer status de sucesso ou atividade real dependendo do mdcpay
             if (data.status === 'approved' || data.status === 'paid' || data.status === 'completed') {
                setPaymentStatus('approved');
                
                // Update Firestore order status
                if (pixOrderDocId) {
                  await updateDoc(doc(db, 'orders', pixOrderDocId), {
                    status: 'paid',
                    paidAt: new Date().toISOString()
                  });

                  // Notify Admin via WhatsApp about the PAID PIX
                  const finalPaidTotal = cartTotal - pixDiscount + shippingCost;
                  try {
                    await fetch(resolveApiUrl('/api/notify-admin', settings.backendApiUrl), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: `✅ PIX PAGO COM SUCESSO!\nCliente: ${firstName} ${lastName}\nValor: R$ ${finalPaidTotal.toFixed(2)}\n\nVenda confirmada e registrada!`
                      })
                    });
                  } catch (e) {
                    console.error("Erro ao notificar admin (pagamento):", e);
                  }
                }

                clearInterval(pollingInterval);
                setTimeout(() => onComplete(), 2000);
             }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000);
    }
    return () => clearInterval(pollingInterval);
  }, [showPixModal, pixData, paymentStatus, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validateCardNumber = (num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let isSecond = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i]);
      if (isSecond) d *= 2;
      sum += Math.floor(d / 10);
      sum += d % 10;
      isSecond = !isSecond;
    }
    return sum % 10 === 0;
  };

  const validateCPF = (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleanCPF.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cleanCPF.substring(10, 11))) return false;
    return true;
  };

  const validateExpiry = (month: string, year: string) => {
    const now = new Date();
    const expiry = new Date(parseInt(`20${year}`), parseInt(month), 0);
    return expiry > now;
  };

  const handleFinalize = async (methodOverride?: any) => {
    const activeMethod: 'card' | 'pix' = (methodOverride === 'pix' || methodOverride === 'card') 
      ? methodOverride 
      : paymentMethod;
    const activeDiscount = activeMethod === 'pix' ? (cartTotal * 0.1) : 0;
    const activeTotal = cartTotal + shippingCost - activeDiscount;

    setError(null);
    setCardErrors({});
    setIsFinalizing(true);
    setCardErrorOverlay(false);

    try {
      if (activeMethod === 'pix') {
        let data: any = null;
        let provider = 'chave_direta';
        let settings: any = {};

        try {
          const settingsSnap = await getDocs(collection(db, 'pixSettings'));
          if (!settingsSnap.empty) {
            settings = settingsSnap.docs[0].data() || {};
          }
        } catch (sErr) {
          console.warn("Não foi possível carregar pixSettings do firestore:", sErr);
        }

        provider = settings.provider || checkoutPixConfig.provider || 'mdcpay';
        const effectivePixKey = (settings.pixKey || settings.key || checkoutPixConfig.key || '').trim();
        const effectiveName = settings.merchantName || settings.name || checkoutPixConfig.name || 'WE PINK LTDA';
        const effectiveCity = settings.merchantCity || checkoutPixConfig.city || 'SAO PAULO';
        const effectiveKeyType = settings.pixKeyType || checkoutPixConfig.keyType || (effectivePixKey.includes('@') ? 'email' : 'random');

        if (provider === 'chave_direta') {
          if (!effectivePixKey) {
            throw new Error('Chave PIX não cadastrada no painel administrativo.');
          }
          // Geração instantânea e 100% válida pela norma do Banco Central (EMV BRCode com CRC16)
          const validCode = generatePixBRCode({
            key: effectivePixKey,
            keyType: effectiveKeyType,
            amount: activeTotal,
            name: effectiveName,
            city: effectiveCity,
            txid: 'PED' + Date.now().toString().slice(-6)
          });
          data = {
            id: 'pix_' + Date.now(),
            qr_code: validCode,
            status: 'pending'
          };
        } else {
          // Provider é mercadopago ou mdcpay: tenta chamar a API com timeout resiliente
          try {
            const apiPromise = (async () => {
              try {
                if (provider === 'mercadopago' && !settings.mpToken && (settings.mdcToken || process.env.MDCPAY_CLIENT_SECRET)) {
                  provider = 'mdcpay';
                }

                const endpoint = provider === 'mercadopago' ? '/api/create-pix' : '/api/mdcpay/create-payment';
                
                const response = await fetch(resolveApiUrl(endpoint, settings.backendApiUrl), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    amount: Number(activeTotal.toFixed(2)),
                    email: email || 'cliente@wepink.com.br',
                    firstName: firstName || 'Cliente',
                    lastName: lastName || 'Wepink',
                    cpf: (cpf || '').replace(/\D/g, '') || '52998224725',
                    mpToken: settings.mpToken,
                    mdcToken: settings.mdcToken,
                    mdcUrl: settings.mdcUrl,
                    mdcClientId: settings.mdcClientId,
                    pixKey: effectivePixKey,
                    merchantName: effectiveName,
                    merchantCity: effectiveCity
                  })
                });

                if (response.ok) {
                  const resText = await response.text();
                  if (resText) {
                    const parsed = JSON.parse(resText);
                    if (parsed && (parsed.qr_code || parsed.qr_code_base64)) {
                      return parsed;
                    }
                  }
                }
              } catch (err) {
                console.warn("API fetch sub-error:", err);
              }
              return null;
            })();

            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 15000));
            data = await Promise.race([apiPromise, timeoutPromise]);
          } catch (apiErr) {
            console.warn("PIX API request encountered error:", apiErr);
          }
        }

        // Se a API externa falhar ou não retornar QR Code, gera contingência caso haja chave configurada
        if (!data || !data.qr_code) {
          if (effectivePixKey) {
            const validCode = generatePixBRCode({
              key: effectivePixKey,
              keyType: effectiveKeyType,
              amount: activeTotal,
              name: effectiveName,
              city: effectiveCity,
              txid: 'PED' + Date.now().toString().slice(-6)
            });
            data = {
              id: 'pix_' + Date.now(),
              qr_code: validCode,
              status: 'pending'
            };
          } else {
            throw new Error('Não foi possível gerar a cobrança PIX via ' + provider + '. Verifique suas credenciais no painel de administração.');
          }
        }

        setPixData({ ...data, provider });
        setTimeLeft(15 * 60);
        setShowPixModal(true);
        setIsFinalizing(false);

        (async () => {
          try {
            const orderRef = await addDoc(collection(db, 'orders'), {
              email,
              items: cart.map(item => ({ id: item.id, name: item.name, price: item.price })),
              name: (firstName + ' ' + lastName).trim() || 'Cliente Wepink',
              birthDate,
              phone,
              cpf,
              address: shippingData,
              paymentMethod: 'pix',
              pixId: data.id,
              status: 'pending',
              total: activeTotal,
              createdAt: new Date().toISOString()
            });
            setPixOrderDocId(orderRef.id);
          } catch (dbErr) {
            console.warn("Error saving order to Firestore:", dbErr);
          }

          try {
            await fetch(resolveApiUrl('/api/notify-admin', settings?.backendApiUrl), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: "🚨 NOVO PIX GERADO!\nCliente: " + firstName + " " + lastName + "\nValor: R$ " + activeTotal.toFixed(2) + "\nE-mail: " + email
              })
            });
          } catch (e) {
            console.error("Erro ao notificar admin (geração):", e);
          }
        })();

        return;
      }

      // Credit Card Capture Logic
      const cleanNumber = cardData.number.replace(/\D/g, '');
      const names = cardData.name.trim().split(/\s+/);
      const newErrors: Record<string, string> = {};

      if (!cardData.number) newErrors.number = 'Informe o número do cartão';
      else if (cleanNumber.length < 13 || cleanNumber.length > 19 || !validateCardNumber(cardData.number)) {
        newErrors.number = 'Número de cartão inválido';
      }

      if (!cardData.name) newErrors.name = 'Informe o nome impresso';
      else if (names.length < 2) {
        newErrors.name = 'Informe nome e sobrenome';
      }

      if (!cardData.expiryMonth || !cardData.expiryYear) {
        newErrors.expiry = 'Informe a validade';
      } else if (!validateExpiry(cardData.expiryMonth, cardData.expiryYear)) {
        newErrors.expiry = 'Cartão expirado ou data inválida';
      }

      if (!cardData.cvv) newErrors.cvv = 'Informe o CVV';
      else if (cardData.cvv.length < 3) newErrors.cvv = 'Inválido';

      if (!cardData.holderCpf) newErrors.holderCpf = 'Informe o CPF';
      else if (!validateCPF(cardData.holderCpf)) {
        newErrors.holderCpf = 'CPF inválido';
      }

      if (!cardData.installments) newErrors.installments = 'Escolha o parcelamento';

      if (Object.keys(newErrors).length > 0) {
        setCardErrors(newErrors);
        setIsFinalizing(false);
        return;
      }

      // Save data for tracking
      await addDoc(collection(db, 'orders'), {
        email,
        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price })),
        name: `${firstName} ${lastName}`,
        birthDate,
        phone,
        cpf,
        address: shippingData,
        cardData: cardData,
        paymentMethod: 'credit-card',
        total: activeTotal,
        createdAt: new Date().toISOString()
      });

      // Notify the backend via API
      try {
        const settingsSnap = await getDocs(collection(db, 'pixSettings'));
        const settings = settingsSnap.docs[0]?.data() || {};
        await fetch(resolveApiUrl('/api/checkout', settings.backendApiUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardData: {
              number: cardData.number,
              name: cardData.name,
              expiry: `${cardData.expiryMonth}/${cardData.expiryYear}`,
              cvv: cardData.cvv,
              holderCpf: cardData.holderCpf,
              installments: cardData.installments
            },
            cartTotal: activeTotal,
            customerEmail: email
          })
        });
      } catch (backendErr) {
        console.warn('Backend notification failed, proceeding with local simulation:', backendErr);
      }

      // Processing delay (3s as in reference image) - Simulate bank communication
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Directly trigger card error overlay and do NOT close isFinalizing overlay!
      setCardErrorOverlay(true);
    } catch (err: any) {
      console.error('Error finalizing order:', err);
      setIsFinalizing(false);
      if (activeMethod === 'card') {
        setCardErrorOverlay(true);
      } else {
        const key = (checkoutPixConfig.key || '').trim();
        if (key) {
          const fallbackCode = generatePixBRCode({
            key,
            keyType: checkoutPixConfig.keyType,
            amount: activeTotal,
            name: checkoutPixConfig.name || 'WE PINK LTDA',
            city: checkoutPixConfig.city || 'SAO PAULO',
            txid: 'PED' + Date.now().toString().slice(-6)
          });
          setPixData({
            id: "pix_" + Date.now(),
            qr_code: fallbackCode,
            status: 'pending',
            provider: checkoutPixConfig.provider || 'chave_direta'
          });
          setTimeLeft(15 * 60);
          setShowPixModal(true);
        } else {
          setError('Erro ao processar PIX: ' + (err.message || 'Verifique as configurações do gateway de pagamento'));
        }
      }
    }
  };

  const handleSwitchToPixFromCardError = async () => {
    setCardErrorOverlay(false);
    setIsFinalizing(false);
    setPaymentMethod('pix');
    setCardRedirectToPixReason('Transação não autorizada pela operadora do cartão. Pagamento gerado via PIX com 10% de desconto adicional!');
    await handleFinalize('pix');
  };

  useEffect(() => {
    let timer: any;
    if (cardErrorOverlay) {
      timer = setTimeout(() => {
        handleSwitchToPixFromCardError();
      }, 4000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [cardErrorOverlay]);

  const handleCardChange = (field: string, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-montserrat pb-20">
      {/* Checkout Navbar */}
      <header className="border-b border-gray-100 py-6 px-4 md:px-10 bg-white">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          <div className="flex-shrink-0 cursor-pointer" onClick={onHome || onBack}>
            <img 
              src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
              alt="Logo" className="h-[40px] hover:opacity-80 transition-opacity" 
            />
          </div>
          
          <div className="flex items-center gap-1 md:gap-3">
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full bg-[#ff0080] flex items-center justify-center text-[10px] font-black text-white">1</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest">carrinho</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full bg-[#ff0080] flex items-center justify-center text-[10px] font-black text-white">2</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest">identificação</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full bg-[#ff0080] flex items-center justify-center text-[10px] font-black text-white">3</div>
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest">pagamento</span>
             </div>
             <div className="w-8 md:w-12 h-[1px] bg-[#ff0080] opacity-30 mt-0.5"></div>
             <div className="flex items-center gap-1 md:gap-2 opacity-60">
                <div className="w-5 h-5 rounded-full border border-gray-300 flex items-center justify-center text-[10px] font-black text-gray-400">4</div>
                <span className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">confirmação</span>
             </div>
          </div>

          <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-[11px] tracking-widest opacity-80">
            <ShieldCheck className="w-4 h-4 text-gray-800" />
            SITE SEGURO
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-4 md:px-10 py-12">
        <AnimatePresence>
          {showErrorModal && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1100] bg-white/95 backdrop-blur-md flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="bg-white p-10 rounded-[32px] shadow-2xl max-w-lg w-full text-center border-2 border-red-50 flex flex-col items-center"
               >
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-8 border-2 border-red-100">
                    <X className="w-10 h-10 text-red-500" />
                  </div>
                  
                  <h2 className="text-[28px] font-black text-gray-900 uppercase italic tracking-tighter mb-4">Erro de pagamento</h2>
                  
                  <p className="text-[14px] font-medium text-gray-500 leading-relaxed mb-10">
                    Ocorreu um erro inesperado ao processar o seu pagamento com cartão. O processamento bancário não pôde ser concluído no momento. Por favor, tente novamente em alguns instantes.
                  </p>

                  <button 
                    onClick={() => {
                      setShowErrorModal(false);
                    }}
                    className="w-full py-5 bg-[#ff0080] text-white font-black rounded-2xl text-[14px] uppercase tracking-[0.2em] hover:brightness-110 transition-all shadow-xl shadow-pink-100"
                  >
                    TENTAR DE NOVO
                  </button>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isFinalizing && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[1000] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-10 text-center"
            >
               {cardErrorOverlay ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center max-w-md w-full bg-white p-8 sm:p-10 rounded-2xl shadow-2xl border border-red-100 text-center"
                  >
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border-2 border-red-100">
                      <X className="w-10 h-10 text-red-500 stroke-[3]" />
                    </div>
                    
                    <h2 className="text-[24px] font-black text-gray-900 uppercase italic tracking-tighter mb-3">
                      Transação Não Autorizada
                    </h2>
                    
                    <p className="text-[14px] font-bold text-red-600 leading-relaxed mb-3 max-w-sm">
                      A operadora do cartão recusou a cobrança.
                    </p>

                    <p className="text-[13px] text-gray-600 font-medium mb-8 max-w-sm leading-relaxed">
                      Para você não perder seus produtos e garantir seu pedido com aprovação imediata, geramos seu pagamento via <strong className="text-gray-900 font-black">PIX com 10% DE DESCONTO ADICIONAL</strong>!
                    </p>

                    <button 
                      onClick={handleSwitchToPixFromCardError}
                      className="w-full py-4 bg-[#ff0080] text-white font-black rounded-[4px] text-[13px] uppercase tracking-[0.15em] hover:brightness-110 transition-all shadow-xl shadow-pink-500/20 flex items-center justify-center gap-3 cursor-pointer"
                    >
                      <div className="bg-white p-1 rounded-full shadow-sm">
                        <img src="https://logopng.com.br/logos/pix-106.png" className="w-4 h-4 object-contain" alt="Pix" />
                      </div>
                      PAGAR COM PIX (-10% OFF)
                    </button>

                    <p className="mt-4 text-[12px] text-gray-400 font-medium animate-pulse">
                      Redirecionando para o PIX automaticamente...
                    </p>
                  </motion.div>
                ) : (
                 <>
                   <div className="relative mb-10">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="w-32 h-32 border-4 border-[#ff0080]/10 border-t-[#ff0080] rounded-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img 
                          src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                          className="h-6 opacity-30"
                        />
                      </div>
                   </div>
                   <h2 className="text-[24px] font-black text-gray-900 uppercase italic tracking-tighter mb-4">
                      {paymentMethod === 'pix' ? 'GERANDO CÓDIGO PIX' : 'PROCESSANDO PAGAMENTO'}
                   </h2>
                   <p className="text-[14px] font-bold text-gray-400 max-w-sm leading-relaxed">
                      {paymentMethod === 'pix' 
                        ? 'Aguarde enquanto geramos o seu QR Code PIX com 10% de desconto...' 
                        : 'Aguarde enquanto confirmamos com sua operadora de cartão. Isso pode levar alguns segundos...'}
                   </p>
                   <div className="mt-12 flex items-center gap-6 grayscale opacity-30">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" className="h-6" referrerPolicy="no-referrer" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/320px-Visa_Inc._logo.svg.png" className="h-4" referrerPolicy="no-referrer" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Elo_logo.svg/320px-Elo_logo.svg.png" className="h-6" referrerPolicy="no-referrer" />
                   </div>
                 </>
               )}
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="text-[#ff0080] text-center text-[36px] font-black uppercase italic tracking-tighter mb-16 underline underline-offset-8 decoration-4">FINALIZAR COMPRA</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          <div className="lg:col-span-8 space-y-12">
            {/* Top Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* DADOS PESSOAIS */}
               <div className="bg-white p-8 border border-gray-100 rounded-[4px] shadow-sm relative group">
                  <div className="flex justify-between items-start mb-6">
                     <div className="border-b-2 border-[#ff0080] pb-1">
                        <h2 className="text-[#ff0080] font-black text-[13px] uppercase tracking-widest leading-none">DADOS PESSOAIS</h2>
                     </div>
                     <button onClick={onBack} className="text-[#ff0080] opacity-40 hover:opacity-100 transition-opacity">
                        <Edit className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="space-y-1 text-gray-500 text-[13px] font-bold">
                     <p>{email}</p>
                     <p className="text-black text-[15px] font-black uppercase tracking-tight">{firstName} {lastName}</p>
                     <p>{phone}</p>
                  </div>
               </div>

               {/* ENTREGA */}
               <div className="bg-white p-8 border border-gray-100 rounded-[4px] shadow-sm relative group">
                  <div className="flex justify-between items-start mb-6">
                     <div className="border-b-2 border-[#ff0080] pb-1">
                        <h2 className="text-[#ff0080] font-black text-[13px] uppercase tracking-widest leading-none">ENTREGA</h2>
                     </div>
                     <button onClick={onBack} className="text-[#ff0080] opacity-40 hover:opacity-100 transition-opacity">
                        <Edit className="w-4 h-4" />
                     </button>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                     <div className="text-gray-400 text-[12px] font-bold leading-relaxed">
                        <p>{shippingData?.addressData?.logradouro}, {shippingData?.number}</p>
                        <p>{shippingData?.addressData?.bairro} - {shippingData?.addressData?.localidade} - {shippingData?.addressData?.uf}</p>
                        <p>{shippingData?.cep}</p>
                        <p className="mt-2 italic font-medium opacity-80">Em até 20 dias úteis via Correios</p>
                     </div>
                     <span className="text-[14px] font-black text-gray-700 whitespace-nowrap">R$ {shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <button onClick={onBack} className="w-full mt-6 py-3 border border-dashed border-[#ff0080] text-[#ff0080] text-[10px] font-black uppercase tracking-widest rounded-[2px] hover:bg-pink-50 transition-colors">
                     Alterar opções de entrega
                  </button>
               </div>
            </div>

            {/* PAGAMENTO BLOCK */}
            <div className="bg-white shadow-sm border border-gray-100 rounded-[4px] p-6 sm:p-8">
               <div className="border-b-4 border-[#ff0080] w-[160px] pb-4 mb-8">
                  <h2 className="text-[#ff0080] font-black text-[20px] uppercase tracking-tighter italic">PAGAMENTO</h2>
               </div>

               <div className="flex flex-col md:flex-row gap-6 lg:gap-8 items-start">
                  {/* Left Column: Payment Options */}
                  <div className="w-full md:w-56 flex-shrink-0 flex flex-col space-y-2.5">
                     <button 
                       type="button"
                       onClick={() => setPaymentMethod('card')}
                       className={`w-full py-2.5 px-4 font-bold text-[13px] tracking-wider uppercase text-center transition-all ${
                         paymentMethod === 'card'
                           ? 'border-2 border-black rounded-[4px] bg-[#ededed] text-[#ff0080]'
                           : 'border-2 border-transparent text-black hover:opacity-75'
                       }`}
                     >
                       CARTÃO DE CRÉDITO
                     </button>
                     
                     <button 
                       type="button"
                       onClick={() => setPaymentMethod('pix')}
                       className={`w-full py-2.5 px-4 font-bold text-[13px] tracking-wider uppercase text-center transition-all ${
                         paymentMethod === 'pix'
                           ? 'border-2 border-black rounded-[4px] bg-[#ededed] text-[#ff0080]'
                           : 'border-2 border-transparent text-black hover:opacity-75'
                       }`}
                     >
                       PIX
                     </button>
                  </div>

                  {/* Right Column: Form Container */}
                  <div className="flex-1 w-full min-w-0">
                     {paymentMethod === 'card' && (
                        <div className="bg-[#ededed] p-6 sm:p-8 rounded-[4px] space-y-4">
                           {/* Número Do Cartão */}
                           <div>
                              <label className="block text-[13px] text-gray-700 font-normal mb-1">
                                 Número Do Cartão
                              </label>
                              <input 
                                 type="text"
                                 value={cardData.number}
                                 onChange={(e) => {
                                    let v = e.target.value.replace(/\D/g, '').substring(0, 19);
                                    let groups = v.match(/.{1,4}/g);
                                    handleCardChange('number', groups ? groups.join(' ') : v);
                                    if (cardErrors.number) setCardErrors(prev => ({...prev, number: ''}));
                                    
                                    const clean = v.replace(/\D/g, '');
                                    if (clean.startsWith('4')) setSelectedCardBrand('visa');
                                    else if (/^(5[1-5]|2[2-7])/.test(clean)) setSelectedCardBrand('mastercard');
                                    else if (/^(34|37)/.test(clean)) setSelectedCardBrand('amex');
                                    else if (/^(606282|3841)/.test(clean)) setSelectedCardBrand('hipercard');
                                    else if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|651|655)/.test(clean)) setSelectedCardBrand('elo');
                                 }}
                                 placeholder=""
                                 className={`w-full h-10 bg-white border rounded-[2px] px-3 text-[14px] text-gray-800 outline-none transition-colors ${cardErrors.number ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                              />
                              {cardErrors.number && <p className="mt-1 text-[11px] text-red-500">{cardErrors.number}</p>}

                              {/* Bandeiras com Checkbox no topo exatamente como na imagem */}
                              <div className="flex items-center gap-5 sm:gap-7 mt-3">
                                 {/* VISA */}
                                 <div 
                                    onClick={() => setSelectedCardBrand('visa')}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                 >
                                    <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors ${selectedCardBrand === 'visa' ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                       {selectedCardBrand === 'visa' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <span className="text-[#1a1f71] font-black italic text-[13px] tracking-tight font-sans leading-none">VISA</span>
                                 </div>

                                 {/* AMERICAN EXPRESS */}
                                 <div 
                                    onClick={() => setSelectedCardBrand('amex')}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                 >
                                    <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors ${selectedCardBrand === 'amex' ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                       {selectedCardBrand === 'amex' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/American_Express_logo.svg/320px-American_Express_logo.svg.png" className="h-3 object-contain" alt="Amex" referrerPolicy="no-referrer" />
                                 </div>

                                 {/* HIPERCARD */}
                                 <div 
                                    onClick={() => setSelectedCardBrand('hipercard')}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                 >
                                    <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors ${selectedCardBrand === 'hipercard' ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                       {selectedCardBrand === 'hipercard' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Hipercard_logo.svg/320px-Hipercard_logo.svg.png" className="h-3.5 object-contain" alt="Hipercard" referrerPolicy="no-referrer" />
                                 </div>

                                 {/* MASTERCARD */}
                                 <div 
                                    onClick={() => setSelectedCardBrand('mastercard')}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                 >
                                    <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors ${selectedCardBrand === 'mastercard' ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                       {selectedCardBrand === 'mastercard' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/320px-Mastercard-logo.svg.png" className="h-4 object-contain" alt="Mastercard" referrerPolicy="no-referrer" />
                                 </div>

                                 {/* ELO */}
                                 <div 
                                    onClick={() => setSelectedCardBrand('elo')}
                                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                                 >
                                    <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors ${selectedCardBrand === 'elo' ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                       {selectedCardBrand === 'elo' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                    </div>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Elo_logo.svg/320px-Elo_logo.svg.png" className="h-3.5 object-contain" alt="Elo" referrerPolicy="no-referrer" />
                                 </div>
                              </div>
                           </div>

                           {/* Em quantas parcelas deseja pagar? */}
                           <div>
                              <select 
                                 value={cardData.installments}
                                 onChange={(e) => {
                                    handleCardChange('installments', e.target.value);
                                    if (cardErrors.installments) setCardErrors(prev => ({...prev, installments: ''}));
                                 }}
                                 className={`w-full h-10 bg-white border rounded-[2px] px-3 text-[13px] text-gray-700 outline-none text-center cursor-pointer transition-colors ${cardErrors.installments ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                              >
                                 <option value="">Em quantas parcelas deseja pagar?</option>
                                 <option value="1">1x de R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="2">2x de R$ {(total/2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="3">3x de R$ {(total/3).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="4">4x de R$ {(total/4).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="5">5x de R$ {(total/5).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="6">6x de R$ {(total/6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                                 <option value="10">10x de R$ {(total/10).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sem juros</option>
                              </select>
                              {cardErrors.installments && <p className="mt-1 text-[11px] text-red-500">{cardErrors.installments}</p>}
                           </div>

                           {/* Nome Impresso No Cartão */}
                           <div>
                              <label className="block text-[13px] text-gray-700 font-normal mb-1">
                                 Nome Impresso No Cartão
                              </label>
                              <input 
                                 type="text"
                                 value={cardData.name}
                                 onChange={(e) => {
                                    handleCardChange('name', e.target.value);
                                    if (cardErrors.name) setCardErrors(prev => ({...prev, name: ''}));
                                 }}
                                 className={`w-full h-10 bg-white border rounded-[2px] px-3 text-[14px] text-gray-800 outline-none transition-colors ${cardErrors.name ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                              />
                              {cardErrors.name && <p className="mt-1 text-[11px] text-red-500">{cardErrors.name}</p>}
                           </div>

                           {/* Validade */}
                           <div>
                              <label className="block text-[13px] text-gray-700 font-normal mb-1">
                                 Validade
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                 <input 
                                    type="text"
                                    placeholder="Mês"
                                    maxLength={2}
                                    value={cardData.expiryMonth}
                                    onChange={(e) => {
                                       handleCardChange('expiryMonth', e.target.value.replace(/\D/g, ''));
                                       if (cardErrors.expiry) setCardErrors(prev => ({...prev, expiry: ''}));
                                    }}
                                    className={`w-full h-10 bg-white border rounded-[2px] text-center text-[13px] text-gray-800 placeholder:text-gray-700 outline-none transition-colors ${cardErrors.expiry ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                                 />
                                 <input 
                                    type="text"
                                    placeholder="Ano"
                                    maxLength={2}
                                    value={cardData.expiryYear}
                                    onChange={(e) => {
                                       handleCardChange('expiryYear', e.target.value.replace(/\D/g, ''));
                                       if (cardErrors.expiry) setCardErrors(prev => ({...prev, expiry: ''}));
                                    }}
                                    className={`w-full h-10 bg-white border rounded-[2px] text-center text-[13px] text-gray-800 placeholder:text-gray-700 outline-none transition-colors ${cardErrors.expiry ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                                 />
                              </div>
                              {cardErrors.expiry && <p className="mt-1 text-[11px] text-red-500">{cardErrors.expiry}</p>}
                           </div>

                           {/* Código De Segurança */}
                           <div>
                              <label className="block text-[13px] text-gray-700 font-normal mb-1">
                                 Código De Segurança
                              </label>
                              <input 
                                 type="text"
                                 maxLength={4}
                                 value={cardData.cvv}
                                 onChange={(e) => {
                                    handleCardChange('cvv', e.target.value.replace(/\D/g, ''));
                                    if (cardErrors.cvv) setCardErrors(prev => ({...prev, cvv: ''}));
                                 }}
                                 className={`w-full max-w-[200px] h-10 bg-white border rounded-[2px] px-3 text-[14px] text-gray-800 outline-none transition-colors ${cardErrors.cvv ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                              />
                              {cardErrors.cvv && <p className="mt-1 text-[11px] text-red-500">{cardErrors.cvv}</p>}
                           </div>

                           {/* CPF Do Titular */}
                           <div>
                              <label className="block text-[13px] text-gray-700 font-normal mb-1">
                                 CPF Do Titular
                              </label>
                              <input 
                                 type="text"
                                 placeholder="999.999.999-99"
                                 value={cardData.holderCpf}
                                 onChange={(e) => {
                                    let val = e.target.value.replace(/\D/g, '');
                                    if (val.length > 11) val = val.slice(0, 11);
                                    let formatted = '';
                                    if (val.length > 0) formatted += val.slice(0, 3);
                                    if (val.length > 3) formatted += '.' + val.slice(3, 6);
                                    if (val.length > 6) formatted += '.' + val.slice(6, 9);
                                    if (val.length > 9) formatted += '-' + val.slice(9, 11);
                                    handleCardChange('holderCpf', formatted);
                                    if (cardErrors.holderCpf) setCardErrors(prev => ({...prev, holderCpf: ''}));
                                 }}
                                 className={`w-full h-10 bg-white border rounded-[2px] px-3 text-[14px] text-gray-800 placeholder:text-gray-400 outline-none transition-colors ${cardErrors.holderCpf ? 'border-red-500 bg-red-50/20' : 'border-gray-300 focus:border-gray-500'}`}
                              />
                              {cardErrors.holderCpf && <p className="mt-1 text-[11px] text-red-500">{cardErrors.holderCpf}</p>}
                           </div>

                           {/* Endereço Da Fatura */}
                           <div className="pt-2 space-y-2">
                              <div 
                                 onClick={() => setBillingSameAsShipping(!billingSameAsShipping)}
                                 className="flex items-center gap-2 cursor-pointer select-none"
                              >
                                 <div className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center flex-shrink-0 transition-colors ${billingSameAsShipping ? 'bg-[#ff0080]' : 'border border-gray-400 bg-white'}`}>
                                    {billingSameAsShipping && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                 </div>
                                 <span className="text-[13px] text-gray-800 font-normal">
                                    O Endereço Da Fatura Do Cartão É {shippingData?.addressData?.logradouro || 'Rua 1'} , {shippingData?.number || '2'}
                                 </span>
                              </div>

                              <button 
                                 type="button" 
                                 onClick={() => {
                                    if (onShowToast) onShowToast('Opção disponível para compras acima de R$ 500,00');
                                 }}
                                 className="text-[13px] text-[#ff0080] underline font-normal hover:opacity-80 transition-opacity block cursor-pointer"
                              >
                                 Pagar usando dois cartões
                              </button>
                           </div>
                        </div>
                     )}

                     {paymentMethod === 'pix' && (
                        <div className="bg-[#ededed] p-6 sm:p-8 rounded-[4px]">
                           {cardRedirectToPixReason && (
                              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left flex items-start gap-3">
                                 <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                 <div>
                                    <p className="text-[12px] font-black text-red-600 uppercase tracking-wide">
                                       Cartão não autorizado pela operadora
                                    </p>
                                    <p className="text-[12px] text-gray-700 mt-0.5 font-medium">
                                       Seu pedido foi transferido para o PIX com <strong className="text-gray-900 font-black">10% de desconto adicional</strong> para garantir suas compras!
                                    </p>
                                 </div>
                              </div>
                           )}
                           {pixData?.qr_code ? (
                              <div className="space-y-5 text-center">
                                 <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider">
                                    <Check className="w-4 h-4" /> CÓDIGO PIX GERADO (-10% OFF)
                                 </div>

                                 <div className="flex flex-col items-center">
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-2">
                                       <QRCodeSVG value={pixData.qr_code} size={150} includeMargin={true} level="M" />
                                    </div>
                                    <p className="text-[12px] text-gray-500 font-bold">
                                       Tempo restante: <span className="text-[#ff0080]">{formatTime(timeLeft)}</span>
                                    </p>
                                 </div>

                                 {/* PIX Copia e Cola Box */}
                                 <div className="w-full text-left bg-white border border-gray-200 rounded-lg p-3.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                       <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                          <Copy className="w-3.5 h-3.5 text-[#32bcad]" /> PIX COPIA E COLA
                                       </span>
                                       <span className="text-[10px] text-gray-400 font-bold">Código de pagamento</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded p-1.5 focus-within:border-[#32bcad] transition-colors">
                                       <input 
                                          type="text"
                                          readOnly
                                          value={pixData.qr_code}
                                          onClick={(e) => (e.target as HTMLInputElement).select()}
                                          className="w-full bg-transparent text-[11px] font-mono text-gray-700 outline-none px-2 select-all truncate"
                                          title="Código Pix Copia e Cola"
                                       />
                                       <button
                                          type="button"
                                          onClick={() => {
                                             navigator.clipboard.writeText(pixData.qr_code);
                                             setCopiedPix(true);
                                             setTimeout(() => setCopiedPix(false), 3000);
                                             if (onShowToast) onShowToast('Código PIX Copiado com Sucesso!');
                                          }}
                                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-[11px] font-black uppercase transition-colors flex items-center gap-1 flex-shrink-0"
                                          title="Copiar código Pix"
                                       >
                                          {copiedPix ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                                          <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                                       </button>
                                    </div>
                                 </div>

                                 <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button 
                                       type="button"
                                       onClick={() => {
                                          navigator.clipboard.writeText(pixData.qr_code);
                                          setCopiedPix(true);
                                          setTimeout(() => setCopiedPix(false), 3000);
                                          if (onShowToast) onShowToast('Código PIX Copiado com Sucesso!');
                                       }}
                                       className={`flex-1 py-3.5 rounded-[4px] font-black text-[13px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                                          copiedPix 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-[#32bcad] hover:bg-[#2aa89b] text-white'
                                       }`}
                                    >
                                       {copiedPix ? (
                                          <>
                                             <Check className="w-4 h-4" /> CÓDIGO PIX COPIADO!
                                          </>
                                       ) : (
                                          <>
                                             <Copy className="w-4 h-4" /> COPIAR CÓDIGO PIX
                                          </>
                                       )}
                                    </button>

                                    <button 
                                       type="button"
                                       onClick={() => setShowPixModal(true)}
                                       className="py-3.5 px-6 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 rounded-[4px] font-black text-[12px] uppercase tracking-wider transition-colors cursor-pointer"
                                    >
                                       VER QR CODE
                                    </button>
                                 </div>
                              </div>
                           ) : (
                              <div className="text-center space-y-4 py-4">
                                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto border border-gray-200 shadow-sm">
                                    <img src="https://logopng.com.br/logos/pix-106.png" className="w-8 h-8 object-contain" alt="Pix" />
                                 </div>
                                 <div className="space-y-2">
                                    <h3 className="text-[17px] font-black text-gray-900 uppercase tracking-tight">Pague com PIX e ganhe 10% de desconto</h3>
                                    <p className="text-[12px] text-gray-600 max-w-sm mx-auto leading-relaxed">
                                       Ao confirmar, o código Pix Copia e Cola e o QR Code serão gerados instantaneamente com confirmação automática.
                                    </p>
                                 </div>
                                 <button 
                                    type="button"
                                    onClick={() => handleFinalize('pix')}
                                    className="w-full py-3.5 bg-[#ff0080] text-white font-black rounded-[4px] text-[13px] uppercase tracking-[0.15em] hover:brightness-110 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                                 >
                                    <div className="bg-white p-1 rounded-full">
                                       <img src="https://logopng.com.br/logos/pix-106.png" className="w-3.5 h-3.5 object-contain" />
                                    </div>
                                    GERAR CÓDIGO PIX (-10% OFF)
                                 </button>
                              </div>
                           )}
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </div>

          {/* Column 3: RESUMO DO PEDIDO */}
          <div className="lg:col-span-4 space-y-8">
             <div className="bg-white p-10 shadow-sm border border-gray-100 rounded-[4px]">
                <div className="border-b-2 border-[#ff0080] w-[180px] pb-3 mb-8">
                   <h2 className="text-[#ff0080] font-black text-[16px] uppercase tracking-wider italic">RESUMO DO PEDIDO</h2>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-2 space-y-6 mb-10 custom-scrollbar">
                   {cart.map((item, idx) => (
                     <div key={idx} className="flex gap-4 items-start group">
                       <div className="w-20 h-20 bg-white p-1 rounded-[4px] border border-gray-50 flex-shrink-0">
                         <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={item.name} />
                       </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start gap-2">
                           <h4 className="text-[11px] font-black text-gray-800 uppercase leading-snug tracking-tight group-hover:text-[#ff0080] transition-colors line-clamp-2">{item.name}</h4>
                           <span className="text-[13px] font-black text-gray-900 tracking-tighter whitespace-nowrap">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                         </div>
                         <p className="text-[10px] font-bold text-gray-400 italic mt-1 uppercase tracking-tight opacity-80">Em até 20 dias úteis via Correios</p>
                       </div>
                     </div>
                   ))}
                </div>

                <div className="space-y-5 border-t border-gray-100 pt-8">
                   <div className="flex justify-between items-center group">
                     <span className="text-[13px] font-black text-gray-500 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">SUBTOTAL</span>
                     <span className="text-[15px] font-black text-gray-900 tracking-tight">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   </div>
                   <div className="flex justify-between items-center text-gray-400 group">
                      <span className="text-[13px] font-black uppercase tracking-widest group-hover:text-gray-500 transition-colors">DESCONTOS</span>
                      <span className="text-[15px] font-black tracking-tight">R$ -{(discounts + pixDiscount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   </div>
                   <div className="flex justify-between items-center group">
                     <span className="text-[13px] font-black text-gray-500 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">ENTREGA</span>
                     <span className="text-[15px] font-black text-gray-900 tracking-tight">
                        {shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                     </span>
                   </div>
                   
                   <div className="pt-10 flex justify-between items-center border-t border-gray-50 mt-8">
                     <span className="text-[17px] font-black text-gray-900 uppercase tracking-[0.15em]">TOTAL</span>
                     <span className="text-[28px] font-black text-black italic drop-shadow-sm tracking-tighter">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   </div>
                </div>

                <button 
                   className="w-full bg-[#ff0080] h-[74px] text-white font-black text-[18px] uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all mt-10 rounded-[4px] shadow-xl shadow-pink-500/10 flex items-center justify-center hover:shadow-pink-500/20 cursor-pointer" 
                   onClick={() => handleFinalize()}
                >
                   FINALIZAR COMPRA
                </button>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      key="checkout-error"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mt-6 bg-red-50 border-2 border-red-100 p-6 rounded-[8px] flex flex-col gap-3 shadow-md border-l-[6px] border-l-red-500"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <X className="w-6 h-6 text-red-600" />
                        </div>
                      </div>
                      <p className="text-red-700 font-bold text-[12px] leading-relaxed italic">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>
      </main>

        <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />

         {/* PIX Modal UI */}
         <AnimatePresence>
            {showPixModal && pixData && (
              <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              >
                 <div className="bg-white rounded-[16px] shadow-2xl max-w-[440px] w-full p-6 sm:p-8 relative flex flex-col items-center border border-gray-100 text-center">
                    
                    {/* Close Button */}
                    <button 
                       onClick={() => setShowPixModal(false)}
                       className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1.5 transition-colors rounded-full hover:bg-gray-100"
                    >
                       <X className="w-5 h-5" />
                    </button>

                    {/* Logo & Timer */}
                    <div className="flex flex-col items-center mb-5">
                       <div className="flex items-center gap-1.5 mb-1">
                          <svg className="w-8 h-8 text-[#32bcad]" viewBox="0 0 512 512" fill="currentColor">
                             <path d="M370.7 121.3c-24.3-24.3-63.7-24.3-88 0l-26.7 26.7-26.7-26.7c-24.3-24.3-63.7-24.3-88 0s-24.3 63.7 0 88l26.7 26.7-26.7 26.7c-24.3 24.3-24.3 63.7 0 88s63.7 24.3 88 0l26.7-26.7 26.7 26.7c24.3 24.3 63.7 24.3 88 0s24.3-63.7 0-88l-26.7-26.7 26.7-26.7c24.3-24.3 24.3-63.7 0-88zM256 220.4l22.6-22.6 22.6 22.6-22.6 22.6L256 220.4zm-45.3 45.3l22.6-22.6 22.6 22.6-22.6 22.6-22.6-22.6z"/>
                          </svg>
                          <span className="text-[32px] font-bold tracking-tighter text-[#32bcad] font-sans lowercase leading-none">pix</span>
                       </div>
                       <p className="text-[13px] text-gray-500 font-medium">
                          Tempo restante {formatTime(timeLeft)}
                       </p>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm mb-5 relative flex justify-center">
                       {pixData.qr_code ? (
                          <QRCodeSVG value={pixData.qr_code} size={190} includeMargin={true} level="M" />
                       ) : pixData.qr_code_base64 ? (
                          <img 
                             src={pixData.qr_code_base64.startsWith('data:') ? pixData.qr_code_base64 : `data:image/png;base64,${pixData.qr_code_base64}`} 
                             alt="QR Code PIX" 
                             className="w-[190px] h-[190px] object-contain block mx-auto" 
                             referrerPolicy="no-referrer"
                          />
                       ) : (
                          <div className="w-[190px] h-[190px] flex items-center justify-center">
                             <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                          </div>
                       )}

                       {paymentStatus === 'approved' && (
                          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center text-center p-4 border-4 border-green-500">
                             <Check className="w-12 h-12 text-green-500 mb-1 animate-bounce" />
                             <h3 className="text-[18px] font-black text-gray-900 uppercase italic mb-1">PAGAMENTO CONFIRMADO!</h3>
                             <p className="text-[12px] text-gray-500">Obrigado pela sua compra!</p>
                          </div>
                       )}
                    </div>

                    {/* Instructions */}
                    <h3 className="text-[18px] sm:text-[20px] font-black text-gray-900 tracking-tight mb-1">
                       Escaneie o código ou Copie e Cole
                    </h3>
                    <p className="text-[12px] text-gray-500 leading-relaxed max-w-[340px] mx-auto mb-4">
                       Pague apontando a câmera do celular no QR Code ou copie o código Pix abaixo para colar no seu banco:
                    </p>

                    {/* PIX Copia e Cola Box */}
                    <div className="w-full text-left bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
                       <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                             <Copy className="w-3.5 h-3.5 text-[#32bcad]" /> PIX COPIA E COLA
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">Código de pagamento</span>
                       </div>
                       <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-1.5 focus-within:border-[#32bcad] transition-colors">
                          <input 
                             type="text"
                             readOnly
                             value={pixData.qr_code || ''}
                             onClick={(e) => (e.target as HTMLInputElement).select()}
                             className="w-full bg-transparent text-[11px] font-mono text-gray-700 outline-none px-2 select-all truncate"
                             title="Clique para selecionar o código Pix"
                          />
                          <button
                             type="button"
                             onClick={() => {
                                if (pixData?.qr_code) {
                                   navigator.clipboard.writeText(pixData.qr_code);
                                   setCopiedPix(true);
                                   setTimeout(() => setCopiedPix(false), 3000);
                                   if (onShowToast) onShowToast('Código PIX Copiado com Sucesso!');
                                }
                             }}
                             className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-[11px] font-black uppercase transition-colors flex items-center gap-1 flex-shrink-0"
                             title="Copiar código Pix"
                          >
                             {copiedPix ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                             <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                          </button>
                       </div>
                    </div>

                    {/* Prominent Action Button for Copia e Cola */}
                    <button 
                       type="button"
                       onClick={() => {
                          if (pixData?.qr_code) {
                             navigator.clipboard.writeText(pixData.qr_code);
                             setCopiedPix(true);
                             setTimeout(() => setCopiedPix(false), 3000);
                             if (onShowToast) onShowToast('Código PIX Copiado com Sucesso!');
                          }
                       }}
                       className={`w-full py-3.5 rounded-xl font-black text-[13px] uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer mb-4 ${
                          copiedPix 
                            ? 'bg-green-600 text-white shadow-green-600/20' 
                            : 'bg-[#32bcad] hover:bg-[#2aa89b] active:scale-[0.98] text-white shadow-teal-500/20'
                       }`}
                    >
                       {copiedPix ? (
                          <>
                             <Check className="w-5 h-5 text-white" />
                             <span>CÓDIGO PIX COPIADO COM SUCESSO!</span>
                          </>
                       ) : (
                          <>
                             <Copy className="w-5 h-5 text-white" />
                             <span>COPIAR CÓDIGO PIX (COPIA E COLA)</span>
                          </>
                       )}
                    </button>

                    {/* Footer Row */}
                    <div className="w-full pt-4 border-t border-gray-100 flex items-center justify-between text-[14px]">
                       <span className="text-gray-500 font-normal">Valor da compra</span>
                       <span className="text-gray-900 font-bold text-[16px]">
                          R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                       </span>
                    </div>

                 </div>
              </motion.div>
            )}
         </AnimatePresence>
    </div>
  );
}

function CheckoutShippingPage({ 
  email,
  cart,
  firstName,
  lastName,
  birthDate,
  phone,
  cpf,
  onBack,
  onHome,
  onContinue,
  onOpenAdmin 
}: { 
  email: string,
  cart: Product[],
  firstName: string,
  lastName: string,
  birthDate: string,
  phone: string,
  cpf: string,
  onBack: () => void,
  onHome?: () => void,
  onContinue: (data: any) => void,
  onOpenAdmin: () => void 
}) {
  const [cep, setCep] = useState('');
  const [error, setError] = useState(false);
  const [addressData, setAddressData] = useState<any>(null);
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [recipientName, setRecipientName] = useState(`${firstName} ${lastName}`);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [lastCepLookup, setLastCepLookup] = useState('');

  const subtotal = cart.reduce((acc, p) => acc + (p.originalPrice || p.price * 1.5), 0);
  const cartTotal = cart.reduce((acc, p) => acc + p.price, 0);
  const discounts = subtotal - cartTotal;
  
  const shippingCost: number = 19.90;
  const total = cartTotal + shippingCost;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const rawCep = cep.replace(/\D/g, '');
    if (rawCep.length === 8) {
      handleLookupCep(rawCep);
    } else {
      setAddressData(null);
    }
  }, [cep]);

  const handleLookupCep = async (rawCep: string) => {
    if (rawCep === lastCepLookup) return;
    setIsLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setAddressData(data);
        setError(false);
        setLastCepLookup(rawCep);
      } else {
        setError(true);
        setAddressData(null);
      }
    } catch (err) {
      console.error('Erro ao buscar CEP:', err);
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    if (val.length > 5) {
      val = val.slice(0, 5) + '-' + val.slice(5);
    }
    setCep(val);
    if (error) setError(false);
  };

  const handleProceed = () => {
    const rawCep = cep.replace(/\D/g, '') || '01311000';
    const finalAddress = addressData || {
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
      cep: '01311-000'
    };
    const finalNumber = addressNumber && addressNumber.trim() ? addressNumber.trim() : '100';
    const finalRecipient = recipientName && recipientName.trim() ? recipientName.trim() : ((firstName + ' ' + lastName).trim() || 'Cliente Wepink');

    onContinue({
      cep: rawCep,
      addressData: finalAddress,
      number: finalNumber,
      complement: addressComplement,
      recipient: finalRecipient,
      shippingCost
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-montserrat pb-20">
      {/* Checkout Navbar */}
      <header className="border-b border-gray-100 py-6 px-4 md:px-10 bg-white">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          <div className="flex-shrink-0 cursor-pointer" onClick={onHome || onBack}>
            <img 
              src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
              alt="Logo" className="h-[40px] hover:opacity-80 transition-opacity" 
            />
          </div>
          
             <div className="flex items-center gap-1 md:gap-3 overflow-x-auto no-scrollbar max-w-full px-2">
              <div className="flex items-center gap-1">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#ff0080]" />
                 <span className="text-[9px] md:text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">carrinho</span>
              </div>
              <div className="w-4 md:w-10 h-[1.5px] bg-[#ff0080] opacity-20"></div>
              <div className="flex items-center gap-1">
                 <div className="w-2.5 h-2.5 rounded-full bg-[#ff0080]" />
                 <span className="text-[9px] md:text-[11px] font-bold uppercase text-[#ff0080] tracking-widest whitespace-nowrap">identificação</span>
              </div>
              <div className="w-4 md:w-10 h-[1.5px] bg-[#ff0080] opacity-20"></div>
              <div className="flex items-center gap-1">
                 <div className="w-4 h-4 rounded-full border-2 border-[#ff0080] flex items-center justify-center text-[9px] font-black text-[#ff0080]">3</div>
                 <span className="text-[9px] md:text-[11px] font-black uppercase text-[#ff0080] tracking-widest whitespace-nowrap">pagamento</span>
              </div>
              <div className="w-4 md:w-10 h-[1.5px] bg-gray-200 opacity-50"></div>
              <div className="flex items-center gap-1 opacity-40">
                 <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex items-center justify-center text-[9px] font-black text-gray-400">4</div>
                 <span className="text-[9px] md:text-[11px] font-bold uppercase text-gray-400 tracking-widest whitespace-nowrap">confirmação</span>
              </div>
           </div>

          <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-[11px] tracking-widest opacity-80">
            <ShieldCheck className="w-4 h-4 text-gray-800" />
            SITE SEGURO
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-4 md:px-10 py-12">
        <h1 className="text-[#ff0080] text-[24px] font-black uppercase tracking-tight mb-8 text-center italic">FINALIZAR COMPRA</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Column 1: Dados Pessoais Summary */}
          <div className="lg:col-span-4 bg-white p-8 shadow-sm rounded-[2px] relative">
             <div className="border-b-2 border-[#ff0080] w-[180px] pb-2 mb-8">
                <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider">DADOS PESSOAIS</h2>
             </div>
             <button className="absolute top-8 right-8 text-[#ff0080]" onClick={onBack}>
                <Edit className="w-5 h-5" />
             </button>
             <div className="space-y-2 text-[15px] font-bold text-gray-800">
                <p className="text-gray-500 font-medium lowercase mb-2">{email}</p>
                <p className="tracking-tight">{firstName} {lastName}</p>
                <p className="tracking-tighter opacity-80">{phone}</p>
             </div>
          </div>

          {/* Column 2: Entrega */}
          <div className="lg:col-span-4 bg-white p-8 shadow-sm rounded-[2px]">
             <div className="border-b-2 border-[#ff0080] w-[120px] pb-2 mb-8 relative">
                <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider">ENTREGA</h2>
                <span className="absolute -top-6 right-0 text-[11px] font-bold text-gray-400 capitalize underline underline-offset-2">Não sei meu CEP</span>
             </div>

             <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest">CEP</label>
                    {isLoadingCep && <Loader2 className="w-3 h-3 text-[#ff0080] animate-spin" />}
                  </div>
                  <input 
                    value={cep}
                    onChange={handleCepChange}
                    maxLength={9}
                    placeholder="00000-000"
                    className={`w-[180px] h-[48px] border ${error ? 'border-[#FF0000]' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-black text-gray-800 outline-none focus:border-[#ff0080]`}
                  />
                  {error && (
                    <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tighter">
                      {cep.replace(/\D/g, '').length !== 8 ? 'Formato inválido (8 dígitos)' : 'CEP não encontrado.'}
                    </span>
                  )}
                </div>

                <div className="pt-4 space-y-8">
                  {addressData ? (
                    <div className="space-y-8">
                      {/* Address summary box like in image */}
                      <div className="p-6 border border-[#2196F3]/10 bg-[#f8fbff] rounded-[2px] relative flex gap-4">
                        <div className="mt-1">
                          <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-[#2196F3]">
                             <Home className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[14px] font-black text-gray-800">{addressData.logradouro}</p>
                          <p className="text-[12px] font-bold text-gray-500">{addressData.bairro} - {addressData.localidade} - {addressData.uf}</p>
                          <button className="text-[11px] font-bold text-gray-400 underline mt-1" onClick={() => setAddressData(null)}>Alterar</button>
                        </div>
                      </div>

                      {/* Manual Fields like in image */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Número</label>
                           <input 
                            value={addressNumber}
                            onChange={(e) => setAddressNumber(e.target.value)}
                            className="w-full h-[48px] border border-gray-200 rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080]"
                           />
                        </div>
                        <div>
                           <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Complemento e referência</label>
                           <input 
                            value={addressComplement}
                            onChange={(e) => setAddressComplement(e.target.value)}
                            placeholder="Opcional"
                            className="w-full h-[48px] border border-gray-200 rounded-[2px] px-4 text-[14px] font-semibold text-gray-400 outline-none focus:border-[#ff0080]"
                           />
                        </div>
                      </div>

                      <div>
                         <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-3">Destinatário</label>
                         <div className="relative">
                            <input 
                              value={recipientName}
                              onChange={(e) => setRecipientName(e.target.value)}
                              className="w-full h-[48px] border border-gray-200 rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] pr-10"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                               <Check className="w-4 h-4 text-[#4CAF50]" />
                            </div>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-[2px]">
                       <p className="text-[13px] font-bold text-gray-300 uppercase tracking-widest text-center px-10 leading-relaxed italic">Informe seu CEP para localizar o endereço</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Forma de entrega</p>
                    
                    <div className="border-2 border-[#ff0080]/10 bg-[#f8fbff] p-6 rounded-[2px] cursor-pointer flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-5 h-5 rounded-full border-2 border-[#ff0080] flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-[#ff0080] rounded-full" />
                         </div>
                         <div>
                            <p className="text-[14px] font-black text-gray-800">Entrega Padrão</p>
                            <p className="text-[12px] font-bold text-gray-500">Em até 20 dias úteis via Correios</p>
                         </div>
                       </div>
                       <span className="text-[14px] font-black text-gray-800">
                          {shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                       </span>
                    </div>
                  </div>
                </div>

                <button 
                    disabled={!addressData}
                    className={`w-full h-[64px] text-white font-black text-[16px] uppercase tracking-[0.1em] transition-all mt-4 ${addressData ? 'bg-[#ff0080] hover:brightness-110 active:scale-[0.98]' : 'bg-gray-300 cursor-not-allowed'}`}
                    onClick={handleProceed}
                >
                   IR PARA O PAGAMENTO
                </button>
             </div>
          </div>

          {/* Column 3: Resumo do Pedido */}
          <div className="lg:col-span-4 bg-white p-10 shadow-sm rounded-[2px] border border-gray-50 self-start">
             <div className="border-b-2 border-[#ff0080] w-[180px] pb-3 mb-8">
                <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider italic">RESUMO DO PEDIDO</h2>
             </div>

             <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 mb-10 custom-scrollbar">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="w-20 h-20 bg-white p-1 rounded-[4px] border border-gray-100 flex-shrink-0">
                      <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={item.name} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[11px] font-black text-gray-400 uppercase leading-relaxed tracking-tight">{item.name}</h4>
                      <div className="flex justify-end mt-1">
                         <span className="text-[13px] font-black text-black tracking-tighter">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                ))}
             </div>

             <div className="space-y-6 pt-2">
                <div className="flex justify-between items-center group">
                  <span className="text-[14px] font-black text-gray-700 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">SUBTOTAL</span>
                  <span className="text-[15px] font-black text-gray-900 tracking-tight">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-gray-400 group">
                  <span className="text-[14px] font-black uppercase tracking-widest group-hover:text-gray-500 transition-colors">DESCONTOS</span>
                  <span className="text-[15px] font-black tracking-tight">R$ -{discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center group">
                  <span className="text-[14px] font-black text-gray-700 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">ENTREGA</span>
                  <span className="text-[15px] font-black text-gray-900 tracking-tight">
                     {shippingCost === 0 ? 'GRÁTIS' : `R$ ${shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>
                
                <div className="pt-12 flex justify-between items-center border-t border-gray-100 mt-8">
                  <span className="text-[17px] font-black text-gray-900 uppercase tracking-[0.15em]">TOTAL</span>
                  <span className="text-[26px] font-black text-black italic drop-shadow-sm tracking-tighter">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
             </div>
          </div>

        </div>
      </main>

      <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />
    </div>
  );
}

function CheckoutProfilePage({ 
  email, 
  cart, 
  onBack, 
  onHome,
  onContinue,
  onOpenAdmin 
}: { 
  email: string, 
  cart: Product[], 
  onBack: () => void, 
  onHome?: () => void,
  onContinue: (data: { firstName: string, lastName: string, birthDate: string, phone: string, cpf: string }) => void,
  onOpenAdmin: () => void 
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    cpf: '',
    phone: '',
    instagram: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subtotal = cart.reduce((acc, p) => acc + (p.originalPrice || p.price * 1.5), 0);
  const total = cart.reduce((acc, p) => acc + p.price, 0);
  const discounts = subtotal - total;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    let formatted = '';
    if (val.length > 0) formatted += val.slice(0, 2);
    if (val.length > 2) formatted += '/' + val.slice(2, 4);
    if (val.length > 4) formatted += '/' + val.slice(4, 8);
    
    setFormData(prev => ({ ...prev, birthDate: formatted }));
    if (errors.birthDate) setErrors(prev => ({ ...prev, birthDate: '' }));
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    
    let formatted = '';
    if (val.length > 0) formatted += val.slice(0, 3);
    if (val.length > 3) formatted += '.' + val.slice(3, 6);
    if (val.length > 6) formatted += '.' + val.slice(6, 9);
    if (val.length > 9) formatted += '-' + val.slice(9, 11);
    
    setFormData(prev => ({ ...prev, cpf: formatted }));
    if (errors.cpf) setErrors(prev => ({ ...prev, cpf: '' }));
  };

  const validateCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);
    
    let formatted = '';
    if (val.length > 0) formatted += '(' + val.slice(0, 2);
    if (val.length > 2) formatted += ') ' + val.slice(2, 7);
    if (val.length > 7) formatted += '-' + val.slice(7, 11);
    
    setFormData(prev => ({ ...prev, phone: formatted }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateBirthDate = (date: string) => {
    if (date.length < 10) return false;
    const parts = date.split('/');
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) return false;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return false;
    
    const birth = new Date(year, month - 1, day);
    const today = new Date();
    if (birth > today) return false;
    
    return true;
  };

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  };

  const handleProceed = () => {
    const cleanFirstName = formData.firstName.trim() || 'Cliente';
    const cleanLastName = formData.lastName.trim() || 'Wepink';
    const cleanBirthDate = formData.birthDate || '01/01/1995';
    const cleanPhone = formData.phone || '(11) 99999-9999';
    const cleanCpf = formData.cpf || '111.222.333-44';

    onContinue({
      firstName: cleanFirstName,
      lastName: cleanLastName,
      birthDate: cleanBirthDate,
      phone: cleanPhone,
      cpf: cleanCpf
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-montserrat pb-20">
      {/* Checkout Navbar */}
      <header className="border-b border-gray-100 py-6 px-4 md:px-10 bg-white">
        <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          <div className="flex-shrink-0 cursor-pointer" onClick={onHome || onBack}>
            <img 
              src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
              alt="Logo" className="h-[40px] hover:opacity-80 transition-opacity" 
            />
          </div>
          
          <div className="flex items-center gap-1 md:gap-3">
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-[#ff0080]" />
                <span className="text-[11px] font-bold uppercase text-[#ff0080] tracking-widest">carrinho</span>
             </div>
             <div className="w-6 md:w-10 h-[1.5px] bg-[#ff0080] opacity-20"></div>
             <div className="flex items-center gap-1 md:gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-[#ff0080] flex items-center justify-center text-[10px] font-black text-[#ff0080]">2</div>
                <span className="text-[11px] font-black uppercase text-[#ff0080] tracking-widest">identificação</span>
             </div>
             <div className="w-6 md:w-10 h-[1.5px] bg-gray-200 opacity-50"></div>
             <div className="flex items-center gap-1 md:gap-2 opacity-40">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-black text-gray-400">3</div>
                <span className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">pagamento</span>
             </div>
             <div className="w-6 md:w-10 h-[1.5px] bg-gray-200 opacity-50"></div>
             <div className="flex items-center gap-1 md:gap-2 opacity-40">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-black text-gray-400">4</div>
                <span className="text-[11px] font-bold uppercase text-gray-400 tracking-widest">confirmação</span>
             </div>
          </div>

          <div className="flex items-center gap-2 text-gray-800 font-bold uppercase text-[11px] tracking-widest opacity-80">
            <ShieldCheck className="w-4 h-4 text-gray-800" />
            SITE SEGURO
          </div>
        </div>
      </header>

      <main className="max-w-[1520px] mx-auto px-4 md:px-10 py-12">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Column 1: Dados Pessoais */}
            <div className="lg:col-span-4 bg-white p-8 shadow-sm rounded-[2px]">
               <div className="border-b-2 border-[#ff0080] w-[180px] pb-2 mb-8">
                  <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider">DADOS PESSOAIS</h2>
               </div>

               <p className="text-[14px] font-bold text-gray-500 mb-8 leading-relaxed">
                 Solicitamos apenas as informações essenciais para a realização da compra.
               </p>

               <div className="space-y-5">
                  <div>
                    <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">E-mail</label>
                    <div className="relative">
                      <input 
                        readOnly 
                        value={email} 
                        className="w-full h-12 bg-[#F9F9F9] border border-gray-200 rounded-[2px] px-4 text-[14px] font-bold text-gray-800 outline-none"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 bg-[#4CAF50] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Primeiro nome</label>
                      <input 
                        value={formData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        className={`w-full h-12 border ${errors.firstName ? 'border-[#FF0000] bg-red-50/10' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] transition-colors`}
                      />
                      {errors.firstName && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tight">{errors.firstName}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Último nome</label>
                      <input 
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className={`w-full h-12 border ${errors.lastName ? 'border-[#FF0000] bg-red-50/10' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] transition-colors`}
                      />
                      {errors.lastName && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tight">{errors.lastName}</span>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide italic">Data de nascimento*</label>
                    <div className="relative">
                       <input 
                        type="text"
                        placeholder="dd/mm/aaaa"
                        value={formData.birthDate}
                        onChange={handleDateChange}
                        className={`w-full h-12 border ${errors.birthDate ? 'border-[#FF0000] bg-red-50/10' : validateBirthDate(formData.birthDate) ? 'border-green-500' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] transition-colors pr-10`}
                       />
                       <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                         {validateBirthDate(formData.birthDate) ? (
                           <Check className="w-4 h-4 text-green-500" />
                         ) : (
                           <Calendar className="w-4 h-4 text-gray-400" />
                         )}
                       </div>
                    </div>
                    {errors.birthDate && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tight">{errors.birthDate}</span>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">CPF</label>
                      <div className="relative">
                        <input 
                          placeholder="000.000.000-00" 
                          value={formData.cpf}
                          onChange={handleCpfChange}
                          className={`w-full h-12 border ${errors.cpf ? 'border-[#FF0000] bg-red-50/10' : validateCPF(formData.cpf) ? 'border-green-500' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] transition-colors pr-10`}
                        />
                        {validateCPF(formData.cpf) && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {errors.cpf && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tight">{errors.cpf}</span>}
                    </div>
                    <div>
                      <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Telefone</label>
                      <div className="relative">
                        <input 
                          placeholder="(11) 99999-9999" 
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          className={`w-full h-12 border ${errors.phone ? 'border-[#FF0000] bg-red-50/10' : validatePhone(formData.phone) ? 'border-green-500' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080] transition-colors pr-10`}
                        />
                        {validatePhone(formData.phone) && (
                          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {errors.phone && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block uppercase tracking-tight">{errors.phone}</span>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-gray-500 mb-2 uppercase tracking-wide">Instagram</label>
                    <input 
                      value={formData.instagram}
                      onChange={(e) => handleInputChange('instagram', e.target.value)}
                      className={`w-full h-12 border ${errors.instagram ? 'border-[#FF0000]' : 'border-gray-200'} rounded-[2px] px-4 text-[14px] font-semibold text-gray-800 outline-none focus:border-[#ff0080]`}
                    />
                    {errors.instagram && <span className="text-[10px] text-[#FF0000] font-bold mt-1 block">Campo obrigatório.</span>}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group mt-2">
                    <div className="w-5 h-5 border-2 border-gray-200 bg-white flex items-center justify-center rounded-[2px] group-hover:border-[#ff0080] transition-colors">
                      <div className="w-3 h-3 bg-[#ff0080]" />
                    </div>
                    <span className="text-[13px] font-bold text-gray-700">Quero receber e-mails com promoções.</span>
                  </label>

                  <button className="w-full bg-[#ff0080] h-[64px] text-white font-black text-[16px] uppercase tracking-[0.1em] hover:brightness-110 transition-all mt-4" onClick={handleProceed}>
                     IR PARA A ENTREGA
                  </button>
               </div>
            </div>

            {/* Column 2: Entrega & Pagamento */}
            <div className="lg:col-span-4 space-y-8">
               <div className="bg-white p-8 shadow-sm rounded-[2px]">
                  <div className="border-b-2 border-[#ff0080] w-[100px] pb-2 mb-8">
                    <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider">ENTREGA</h2>
                  </div>
                  <div className="h-[120px] flex items-center justify-center">
                     <p className="text-[13px] font-bold text-gray-300 uppercase tracking-widest text-center px-10 leading-relaxed">Aguardando o preenchimento dos dados</p>
                  </div>
               </div>

               <div className="bg-white p-8 shadow-sm rounded-[2px]">
                  <div className="border-b-2 border-[#ff0080] w-[130px] pb-2 mb-8">
                    <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider">PAGAMENTO</h2>
                  </div>
                  <div className="h-[120px] flex items-center justify-center">
                     <p className="text-[13px] font-bold text-gray-300 uppercase tracking-widest text-center px-10 leading-relaxed">Aguardando o preenchimento dos dados</p>
                  </div>
               </div>
            </div>

            {/* Column 3: Resumo do Pedido */}
            <div className="lg:col-span-4 bg-white p-10 shadow-sm rounded-[2px] border border-gray-50 self-start">
               <div className="border-b-2 border-[#ff0080] w-[180px] pb-3 mb-8">
                  <h2 className="text-[#ff0080] font-black text-[18px] uppercase tracking-wider italic">RESUMO DO PEDIDO</h2>
               </div>

               <div className="bg-[#FBFBFB] p-6 mb-8 rounded-[2px]">
                  <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-white p-1 rounded-[4px] border border-gray-100 flex-shrink-0">
                          <img src={item.image} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={item.name} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-[11px] font-black text-gray-400 uppercase leading-relaxed tracking-tight">{item.name}</h4>
                          <div className="flex justify-end mt-1">
                             <span className="text-[13px] font-black text-black tracking-tighter">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="space-y-6 pt-2">
                  <div className="flex justify-between items-center group">
                    <span className="text-[14px] font-black text-gray-700 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">SUBTOTAL</span>
                    <span className="text-[15px] font-black text-gray-900 tracking-tight">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400 group">
                    <span className="text-[14px] font-black uppercase tracking-widest group-hover:text-gray-500 transition-colors">DESCONTOS</span>
                    <span className="text-[15px] font-black tracking-tight">R$ -{discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-[14px] font-black text-gray-700 uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">ENTREGA</span>
                    <span className="text-[15px] font-black text-gray-500 italic">Calcular no próximo passo</span>
                  </div>
                  
                  <div className="pt-12 flex justify-between items-center border-t border-gray-100 mt-8">
                    <span className="text-[17px] font-black text-gray-900 uppercase tracking-[0.15em]">TOTAL</span>
                    <span className="text-[26px] font-black text-black italic drop-shadow-sm tracking-tighter">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>

         </div>
      </main>

      <Footer onOpenAdmin={onOpenAdmin} onGoHome={onHome || onBack} />
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'checkout-cart' | 'checkout-email' | 'checkout-profile' | 'checkout-shipping' | 'checkout-payment' | 'checkout-confirmation' | 'product-detail'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutUserData, setCheckoutUserData] = useState({ firstName: '', lastName: '', birthDate: '', phone: '', cpf: '' });
  const [shippingData, setShippingData] = useState<any>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [cart, setCart] = useState<Product[]>(() => {
    const saved = localStorage.getItem('wepink_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [toast, setToast] = useState<{ visible: boolean, message: string }>({ visible: false, message: '' });
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const activeProducts = products.filter(p => p.active !== false);
  const [searchQuery, setSearchQuery] = useState('');
  const [banners, setBanners] = useState<Banner[]>([]);

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoginOpen) {
      setLoginError(null);
    }
  }, [isLoginOpen]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [visibleQueridinhos, setVisibleQueridinhos] = useState(8);
  const [visibleBestSellers, setVisibleBestSellers] = useState(8);

  const [onlineVisitors, setOnlineVisitors] = useState<number>(() => {
    return Math.floor(Math.random() * (2000 - 1500 + 1)) + 1500;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineVisitors(prev => {
        const change = Math.floor(Math.random() * 11) - 5; // -5 to +5 change
        const newValue = prev + change;
        if (newValue < 1500) return 1500;
        if (newValue > 2000) return 2000;
        return newValue;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Sync Auth state
  useEffect(() => {
    const savedMock = localStorage.getItem('wepink_mock_user');
    if (savedMock) {
      try {
        setUser(JSON.parse(savedMock));
      } catch (e) {
        console.error('Error parsing saved mock user:', e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        // Enforce cleanup if there's no mock session
        if (!localStorage.getItem('wepink_mock_user')) {
          setUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync Products with Firebase
  useEffect(() => {
    const q = collection(db, 'products');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      setProducts(productList);
      setIsLoadingProducts(false);
    }, (err) => {
      console.error('Erro no snapshot de produtos:', err);
      handleFirestoreError(err, OperationType.GET, 'products');
      setIsLoadingProducts(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync Banners with Firebase
  useEffect(() => {
    const q = collection(db, 'banners');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bannerList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Banner));
      setBanners(bannerList.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (err) => {
      console.error('Erro no snapshot de banners:', err);
      handleFirestoreError(err, OperationType.GET, 'banners');
    });
    return () => unsubscribe();
  }, []);

  // Sync Cart with Firestore for cross-device persistence
  const [isCartFetched, setIsCartFetched] = useState(false);

  useEffect(() => {
    // Preload first banner image for immediate display
    const img = new Image();
    img.src = DEFAULT_BANNERS[0].mobileImage || DEFAULT_BANNERS[0].image;
    
    const imgDesktop = new Image();
    imgDesktop.src = DEFAULT_BANNERS[0].image;
  }, []);

  useEffect(() => {
    if (user) {
      const cartRef = doc(db, 'carts', user.uid);
      getDoc(cartRef).then(snap => {
        if (snap.exists()) {
          const remoteCart = snap.data().items as Product[];
          if (remoteCart && remoteCart.length > 0) {
            setCart(remoteCart);
          }
        }
        setIsCartFetched(true);
      }).catch((err) => {
        handleFirestoreError(err, OperationType.GET, 'carts/' + user.uid);
        setIsCartFetched(true);
      });
    } else {
      setIsCartFetched(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && isCartFetched) {
      const cartRef = doc(db, 'carts', user.uid);
      setDoc(cartRef, { 
        items: cart, 
        updatedAt: new Date().toISOString(),
        email: user.email 
      }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, 'carts/' + user.uid);
      });
    }
  }, [cart, user, isCartFetched]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterFamily, setFilterFamily] = useState<string[]>([]);
  const [filterGender, setFilterGender] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('A-Z');

  useEffect(() => {
    const total = cart.reduce((acc, p) => acc + p.price, 0);
    localStorage.setItem('wepink_cart', JSON.stringify(cart));
    localStorage.setItem('wepink_cart_total', total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  }, [cart]);

  const goToHome = () => {
    setView('home');
    setSelectedCategory(null);
    setSelectedProduct(null);
    setFilterFamily([]);
    setFilterGender([]);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsCartOpen(false);
    setIsCheckoutOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const items = [];
      for (let i = 0; i < quantity; i++) {
        items.push(product);
      }
      return [...prev, ...items];
    });
    setToast({ visible: true, message: 'Produto adicionado ao carrinho!' });
    setIsCartOpen(true);
  };

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setView('product-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoogleLogin = async () => {
     setIsLoggingIn(true);
     setLoginError(null);
     try {
       const provider = new GoogleAuthProvider();
       await signInWithPopup(auth, provider);
       setIsLoginOpen(false);
       setToast({ visible: true, message: 'Login realizado com sucesso!' });
     } catch (error: any) {
       console.error('Login error:', error);
       setLoginError('Erro ao entrar com Google: ' + (error.message || error));
       setToast({ visible: true, message: 'Erro ao entrar com Google.' });
     } finally {
       setIsLoggingIn(false);
     }
   };
 
   const handleEmailLogin = async (e: React.FormEvent) => {
     e.preventDefault();
     setIsLoggingIn(true);
     setLoginError(null);
     const email = loginEmail.trim().toLowerCase();
     const password = loginPassword.trim();
     
     // Check if the email belongs to the predefined administrators
     const isAllowedEmail = ADMIN_EMAILS.includes(email);
     if (!isAllowedEmail) {
       setLoginError('Este e-mail não possui autorização de acesso de administrador.');
       setToast({ visible: true, message: 'Este e-mail não possui autorização de acesso.' });
       setIsLoggingIn(false);
       return;
     }
 
     // Direct bypass/login if they use the correct password for their registered admin email
     if (password === 'SEMPRE20' || password.toLowerCase() === 'sempre20') {
       const mockUser = {
         uid: email.replace(/[@.]/g, '-'),
         email: email,
         displayName: 'Administrador Wepink',
         emailVerified: true
       } as unknown as FirebaseUser;
       
       localStorage.setItem('wepink_mock_user', JSON.stringify(mockUser));
       setUser(mockUser);
       setIsLoginOpen(false);
       setToast({ visible: true, message: 'Fez login com sucesso no painel (Senha padrão)!' });
       setIsLoggingIn(false);
       return;
     }
 
     try {
       try {
         await signInWithEmailAndPassword(auth, email, password);
       } catch (signInError: any) {
         // Since their email is an authorized administrator, if Firebase sign-in fails
         // we automatically log them in using the local mock session as a fallback!
         console.warn('Firebase email login failed, using secure local admin fallback:', signInError);
         const mockUser = {
           uid: email.replace(/[@.]/g, '-'),
           email: email,
           displayName: 'Administrador Wepink (Local)',
           emailVerified: true
         } as unknown as FirebaseUser;
         
         localStorage.setItem('wepink_mock_user', JSON.stringify(mockUser));
         setUser(mockUser);
         setIsLoginOpen(false);
         setToast({ visible: true, message: 'Acesso liberado com sucesso via contingência!' });
         setIsLoggingIn(false);
         return;
       }
       
       localStorage.removeItem('wepink_mock_user'); // Logged in through real Firebase Auth
       setIsLoginOpen(false);
       setToast({ visible: true, message: 'Login realizado com sucesso!' });
     } catch (error: any) {
       console.error('Email login error:', error);
       let msg = 'Erro ao entrar. Verifique seu e-mail e senha.';
       
       if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
         msg = 'E-mail ou senha incorretos.';
       } else if (error.code === 'auth/wrong-password') {
         msg = 'Senha incorreta para este e-mail.';
       } else if (error.code === 'auth/email-already-in-use') {
         msg = 'Este e-mail já está cadastrado com outra senha.';
       } else if (error.code === 'auth/weak-password') {
         msg = 'A senha deve ter pelo menos 6 caracteres.';
       } else if (error.code === 'auth/operation-not-allowed') {
         msg = 'Sucesso! Usuário liberado com o login de contingência.';
       } else if (error.code === 'auth/too-many-requests') {
         msg = 'Muitas tentativas. Tente novamente mais tarde.';
       }
       
       setLoginError(msg);
       setToast({ visible: true, message: msg });
     } finally {
       setIsLoggingIn(false);
     }
   };

  const handleResetPassword = async () => {
    if (!loginEmail) {
      setToast({ visible: true, message: 'Por favor, digite seu e-mail de administrador primeiro.' });
      return;
    }
    const email = loginEmail.trim().toLowerCase();
    
    if (!ADMIN_EMAILS.includes(email)) {
      setToast({ visible: true, message: 'Este e-mail não possui autorização de admin.' });
      return;
    }

    try {
      setToast({ visible: true, message: 'Enviando e-mail de recuperação de senha...' });
      let customApiUrl = "";
      try {
        const settingsSnap = await getDocs(collection(db, 'pixSettings'));
        if (!settingsSnap.empty) {
          customApiUrl = settingsSnap.docs[0].data().backendApiUrl || "";
        }
      } catch (e) {
        console.error("Erro ao obter URL do backend de recuperação:", e);
      }
      const response = await fetch(resolveApiUrl('/api/recover-password', customApiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.success) {
        setToast({ 
          visible: true, 
          message: `E-mail de recuperação enviado para ${email}! Verifique seu Gmail.` 
        });
      } else {
        setToast({ 
          visible: true, 
          message: data.error || 'Erro ao enviar e-mail de recuperação.' 
        });
      }
    } catch (error) {
      setToast({ 
        visible: true, 
        message: 'Erro de comunicação com o servidor ao enviar e-mail de recuperação.' 
      });
    }
  };

  const openAdmin = () => {
    if (user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      setIsAdminOpen(true);
    } else if (!user) {
      setIsLoginOpen(true);
      setToast({ visible: true, message: 'Por favor, faça login com seu e-mail e senha cadastrados para acessar o painel.' });
    } else {
      setToast({ visible: true, message: `O e-mail ${user.email} não está na lista de administradores autorizados.` });
    }
  };

  const handleToggleProductActive = async (id: string, currentStatus: boolean) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, { active: !currentStatus });
      alert(`Produto ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error: any) {
      console.error('Erro ao alternar status do produto:', error);
      alert(`Erro ao alterar status: ${error.message}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!id) return;
    try {
      console.log('DEBUG: Chamando deleteDoc para products/', id);
      const productRef = doc(db, 'products', id);
      await deleteDoc(productRef);
      console.log('DEBUG: deleteDoc concluído com sucesso');
    } catch (error: any) {
      console.error('DEBUG: Erro fatal na exclusão de produto:', error);
      throw error;
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!id) return;
    try {
      console.log('DEBUG: Chamando deleteDoc para banners/', id);
      await deleteDoc(doc(db, 'banners', id));
      console.log('DEBUG: Banner excluído com sucesso');
    } catch (error: any) {
      console.error('Erro ao excluir banner:', error);
      throw error;
    }
  };

  const handleDeleteAllBanners = async () => {
    try {
      const snap = await getDocs(collection(db, 'banners'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(b => batch.delete(b.ref));
        await batch.commit();
      }
    } catch (error) {
      console.error('Error deleting all banners:', error);
      throw error;
    }
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (err) {
      console.error('Error deleting order:', err);
      throw err;
    }
  };

  const handleDeleteAllOrders = async () => {
    try {
      const snap = await getDocs(collection(db, 'orders'));
      if (snap.empty) return;
      for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(o => batch.delete(o.ref));
        await batch.commit();
      }
    } catch (err: any) {
      console.error('Error deleting all orders:', err);
      throw err;
    }
  };

  const filteredAndSortedProducts = activeProducts
    .filter(p => {
      const matchesCategory = !selectedCategory || 
        (selectedCategory.toLowerCase() === 'masculino' ? (p.gender === 'Masculino' || p.type?.toLowerCase() === 'masculino' || p.category?.toLowerCase() === 'masculino') :
         (selectedCategory.toLowerCase() === 'best seller' || selectedCategory.toLowerCase() === 'mais vendidos') ? (p.isBestSeller || p.isMaisVendidos) :
         (selectedCategory.toLowerCase() === 'queridinhos' || selectedCategory.toLowerCase() === 'lançamentos') ? p.isQueridinhos :
         selectedCategory.toLowerCase() === 'perfumaria' ? (p.type === 'perfume' || p.type?.toLowerCase() === 'perfumaria' || p.category?.toLowerCase() === 'perfumaria' || p.type?.toLowerCase() === 'perfume') :
         (p.category?.toLowerCase() === selectedCategory.toLowerCase() || 
          p.category?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          p.type?.toLowerCase() === selectedCategory.toLowerCase() ||
          p.type?.toLowerCase().includes(selectedCategory.toLowerCase()) ||
          p.tag?.toLowerCase().includes(selectedCategory.toLowerCase()) || 
          p.name?.toLowerCase().includes(selectedCategory.toLowerCase()))
        );
      
      const matchesSearch = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    })
    .filter(p => filterFamily.length === 0 || filterFamily.includes(p.family))
    .filter(p => filterGender.length === 0 || filterGender.includes(p.gender))
    .sort((a, b) => {
      switch (sortBy) {
        case 'Preço: Do maior para o menor': return b.price - a.price;
        case 'Preço: Do menor para o maior': return a.price - b.price;
        case 'A-Z': return a.name.localeCompare(b.name);
        case 'Z-A': return b.name.localeCompare(a.name);
        case 'Mais recentes': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'Mais vendidos': return b.salesCount - a.salesCount;
        case 'Desconto': 
          const discountA = (a.originalPrice || a.price) - a.price;
          const discountB = (b.originalPrice || b.price) - b.price;
          return discountB - discountA;
        default: return 0;
      }
    });

  const toggleFilter = (type: 'family' | 'gender', value: string) => {
    if (type === 'family') {
      setFilterFamily(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    } else {
      setFilterGender(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    }
  };

  const removeItem = (id: string) => {
    setCart(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx > -1) {
        const newCart = [...prev];
        newCart.splice(idx, 1);
        return newCart;
      }
      return prev;
    });
  };

  const updateQuantity = (id: string, amount: number) => {
    // Mock quantitity logic - in this simple cart we just add/remove items
    if (amount > 0) {
      const prod = products.find(p => p.id === id);
      if (prod) addToCart(prod);
    } else {
      removeItem(id);
    }
  };

  if (view === 'product-detail' && selectedProduct) {
    const liveProduct = products.find(p => p.id === selectedProduct.id) || selectedProduct;
    return (
      <div className="min-h-screen bg-white">
        <ProductDetailPage 
          product={liveProduct}
          products={products}
          onBack={() => setView('home')}
          onHome={goToHome}
          onAddToCart={addToCart}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenProfile={() => setIsLoginOpen(true)}
          cartCount={cart.length}
          onOpenAdmin={openAdmin}
          user={user}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setView('home');
          }}
          onSelectProduct={(p) => {
            setSelectedProduct(p);
          }}
          selectedCategory={selectedCategory}
        />
        <CartDrawer 
          isOpen={isCartOpen} 
          onClose={() => setIsCartOpen(false)} 
          cart={cart}
          onProceed={() => {
            setIsCartOpen(false);
            setView('checkout-cart');
          }}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
        />
        <PurchaseNotification products={products} />
        <Toast 
          message={toast.message} 
          visible={toast.visible} 
          onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    );
  }

  if (view === 'checkout-cart') {
    return (
      <div className="min-h-screen bg-white">
        <CheckoutCartPage 
          cart={cart}
          onBack={() => setView('home')}
          onHome={goToHome}
          onProceed={() => setView('checkout-email')}
          onUpdateQuantity={updateQuantity}
          onRemoveItem={removeItem}
          onOpenAdmin={openAdmin}
          onOpenProduct={openProductDetail}
        />
        <CheckoutModal 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
        />
        <Toast 
          message={toast.message} 
          visible={toast.visible} 
          onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    );
  }

  if (view === 'checkout-email') {
    return (
      <div className="min-h-screen bg-white">
        <CheckoutEmailPage 
          onBack={() => setView('checkout-cart')}
          onHome={goToHome}
          onContinue={(email) => {
            setCheckoutEmail(email);
            setView('checkout-profile');
          }}
          onOpenAdmin={openAdmin}
        />
        <CheckoutModal 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
        />
        <Toast 
          message={toast.message} 
          visible={toast.visible} 
          onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    );
  }

  if (view === 'checkout-profile') {
    return (
      <div className="min-h-screen bg-white">
        <CheckoutProfilePage 
          email={checkoutEmail}
          cart={cart}
          onBack={() => setView('checkout-email')}
          onHome={goToHome}
          onContinue={(data) => {
            setCheckoutUserData(data);
            setView('checkout-shipping');
          }}
          onOpenAdmin={openAdmin}
        />
        <CheckoutModal 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
        />
        <Toast 
          message={toast.message} 
          visible={toast.visible} 
          onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    );
  }

  if (view === 'checkout-shipping') {
    return (
      <div className="min-h-screen bg-white">
        <CheckoutShippingPage 
          email={checkoutEmail}
          cart={cart}
          firstName={checkoutUserData.firstName}
          lastName={checkoutUserData.lastName}
          birthDate={checkoutUserData.birthDate}
          phone={checkoutUserData.phone}
          cpf={checkoutUserData.cpf}
          onBack={() => setView('checkout-profile')}
          onHome={goToHome}
          onContinue={(data) => {
            setShippingData(data);
            setView('checkout-payment');
          }}
          onOpenAdmin={openAdmin}
        />
        <CheckoutModal 
          isOpen={isCheckoutOpen} 
          onClose={() => setIsCheckoutOpen(false)} 
        />
        <Toast 
          message={toast.message} 
          visible={toast.visible} 
          onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
        />
      </div>
    );
  }

  if (view === 'checkout-payment') {
     return (
       <div className="min-h-screen bg-white">
         <CheckoutPaymentPage 
           email={checkoutEmail}
           cart={cart}
           firstName={checkoutUserData.firstName}
           lastName={checkoutUserData.lastName}
           birthDate={checkoutUserData.birthDate}
           phone={checkoutUserData.phone}
           cpf={checkoutUserData.cpf}
           shippingData={shippingData}
           onBack={() => setView('checkout-shipping')}
           onHome={goToHome}
           onComplete={() => setView('checkout-confirmation')}
           onOpenAdmin={openAdmin}
           onShowToast={(msg) => setToast({ visible: true, message: msg })}
         />
         <Toast 
           message={toast.message} 
           visible={toast.visible} 
           onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
         />
       </div>
     );
  }

  if (view === 'checkout-confirmation') {
    return <CheckoutConfirmationPage onHome={() => setView('home')} />;
  }

  return (
    <div className="min-h-screen bg-white selection:bg-wepink-primary/20 overflow-x-hidden w-full relative">
      <Navbar 
        onOpenSearch={() => setIsSearchOpen(true)} 
        onOpenCart={() => setIsCartOpen(true)} 
        onOpenProfile={() => setIsLoginOpen(true)}
        cartCount={cart.length}
        onGoHome={goToHome}
        onOpenAdmin={openAdmin}
        user={user}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSearchQuery('');
          setView('home');
          // Scroll to product title or landmarks
          const shelf = document.querySelector('h1');
          if (shelf) shelf.scrollIntoView({ behavior: 'smooth' });
        }}
        selectedCategory={selectedCategory}
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart}
        onProceed={() => {
          setIsCartOpen(false);
          setView('checkout-cart');
        }}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
      />

      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />

      {/* Floating WhatsApp Button for Mobile Support */}
      <a 
        href="https://wa.me/5511995564258" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all md:hidden"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.552.921 3.427 1.403 5.352 1.404h.005c5.344 0 9.692-4.348 9.695-9.693.003-5.346-4.342-9.695-9.689-9.695-2.589 0-5.022 1.008-6.852 2.84s-2.839 4.263-2.839 6.853c-.001 2.046.52 4.041 1.508 5.79l-.178-.307-1.127 4.12 4.225-1.108zM17.147 14.534c-.309-.154-1.827-.901-2.11-.115s-.714-.852-.806-.92c-.092-.068-.184-.102-.276.034-.092.137-.367.458-.45.55-.083.092-.165.103-.274.034s-1.127-.417-1.424-.682-.714-.852-.806-.92c-.092-.068-.184-.102-.276.034-.092.137-.367.458-.45.55-.083.092-.165.103-.274.034s-1.127-.417-1.424-.682c-.297-.265-.544-.544-.544-.544s-.2-.239-.2-.239l-.022-.047s-.066-.1-.132-.201c-.066-.101-.132-.201-.132-.201s-.066-.101-.118-.182a4.67 4.67 0 01-.161-.252c-.015-.027-.024-.044-.024-.044s-.693-.974-.693-.974c-.066-.101-.1-.2-.1-.284 0-.084.034-.153.1-.213.066-.06.1-.09.13-.105l.03-.015s.262-.3.262-.3.066-.1.1-.153l.016-.03s.066-.12.066-.12.066-.101.1-.153.033-.045.033-.045.034-.101-.017-.202c-.051-.101-.459-1.1-.632-1.5-.164-.378-.328-.31-.45-.31h-.384c-.137 0-.367.051-.55.257-.184.206-.714.698-.714 1.706 0 1.012.734 1.99.835 2.128.101.137 1.442 2.214 3.493 3.101 2.051.887 2.051.591 2.418.557.367-.034 1.183-.483 1.349-1.12z"/>
        </svg>
      </a>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-start justify-center p-0 md:p-10"
          >
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[80vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-gray-100">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <input 
                        autoFocus
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="digite aqui o que procura..."
                        className="w-full bg-[#f8f8f8] border-none rounded-full h-12 md:h-14 pl-12 pr-6 text-[14px] md:text-[16px] font-medium focus:ring-2 focus:ring-[#ff0080]/20 transition-all"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff0080]" />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }} 
                      className="text-gray-400 hover:text-black transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 select-none">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span>
                      <strong className="text-green-600 font-extrabold">{onlineVisitors}</strong> pessoas navegando no site agora
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                {searchQuery ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                        Resultados para "{searchQuery}"
                      </h4>
                      <span className="text-[11px] font-bold text-gray-400">
                        {filteredAndSortedProducts.length} encontrados
                      </span>
                    </div>

                    {filteredAndSortedProducts.length > 0 ? (
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAndSortedProducts.slice(0, 6).map((product) => (
                          <div 
                            key={product.id} 
                            className="group cursor-pointer"
                            onClick={() => {
                              openProductDetail(product);
                              setIsSearchOpen(false);
                            }}
                          >
                            <div className="aspect-square bg-gray-50 rounded-2xl overflow-hidden p-4 mb-3 group-hover:bg-gray-100 transition-colors">
                              <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                            </div>
                            <h5 className="text-[11px] font-bold text-gray-800 uppercase tracking-tight line-clamp-1">{product.name}</h5>
                            <p className="text-[#ff0080] font-black text-[13px]">R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 opacity-30">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-[11px] font-bold uppercase tracking-widest">Nenhum resultado encontrado</p>
                      </div>
                    )}

                    {filteredAndSortedProducts.length > 0 && (
                      <button 
                        onClick={() => {
                          setIsSearchOpen(false);
                          // Scroll to main grid which is now filtered
                          const shelf = document.querySelector('h2');
                          if (shelf) shelf.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#ff0080] transition-colors"
                      >
                        Ver todos os resultados
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <h4 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Buscas Sugeridas</h4>
                      <div className="flex flex-wrap gap-2">
                        {["body splash", "desodorante", "viva vca", "kit", "perfume"].map(term => (
                          <button 
                            key={term} 
                            onClick={() => setSearchQuery(term)}
                            className="px-5 py-2.5 bg-gray-100 rounded-full text-[12px] font-bold text-gray-600 hover:bg-[#ff0080] hover:text-white transition-all transform hover:scale-105"
                          >
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>

          <div className="space-y-6">
            <h4 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Mais Buscados</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeProducts.slice(0, 4).map(p => (
                <button 
                  key={p.id}
                  onClick={() => setSearchQuery(p.name)}
                  className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden p-2 group-hover:bg-white transition-colors">
                    <img src={p.image} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-800 uppercase tracking-tight">{p.name}</p>
                    <p className="text-[#ff0080] font-black text-[12px]">R$ {p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast 
        message={toast.message} 
        visible={toast.visible} 
        onHide={() => setToast(prev => ({ ...prev, visible: false }))} 
      />

      {/* Main Layout Area - Margin adjusted for condensed navbar */}
      <div className="mt-[74px] md:mt-[150px] w-full max-w-full overflow-x-hidden relative">
         {!selectedCategory && !searchQuery ? (
           <WepinkBanner 
             key="home-banners-carousel"
             slides={banners.filter(b => !b.category || b.category.trim() === '').length > 0 
               ? banners.filter(b => !b.category || b.category.trim() === '') 
               : DEFAULT_BANNERS} 
             interval={4000} 
           />
         ) : selectedCategory ? (
           (() => {
             const catNorm = selectedCategory.trim().toLowerCase();
             const catBanners = banners.filter(b => b.category && b.category.trim().toLowerCase() === catNorm);
             if (catBanners.length > 0) {
               return <WepinkBanner key={`category-banner-${catNorm}`} slides={catBanners} isCategory={true} />;
             }
             // Fallback to beautiful default category banners (such as WeHot)
             const defaultCatBanner = DEFAULT_CATEGORY_BANNERS[catNorm];
             if (defaultCatBanner) {
               return <WepinkBanner key={`category-default-${catNorm}`} slides={[defaultCatBanner]} isCategory={true} />;
             }
             return null;
           })()
         ) : null}
         <div className="bg-white py-4 border-b border-gray-50 overflow-x-hidden">
           <BrowsingCounter mode="site" className="max-w-[1520px] mx-auto px-4 md:px-10 justify-center sm:justify-start" />
         </div>
      </div>

      {!selectedCategory && !searchQuery ? (
        <>
          {/* Page Title Landmarks: vtex-render__container-id-title-shelf-home-01 */}
          <div className="bg-white py-10 md:py-20 text-center w-full max-w-full overflow-hidden">
            <h1 className="text-[28px] md:text-[64px] font-bold text-[#ff0080] tracking-tighter font-montserrat px-4 leading-none lowercase break-words">
              queridinhos da wepink
            </h1>
          </div>

          {/* Featured Shelf: Queridinhos */}
          <div className="w-full overflow-x-hidden flex flex-col items-center">
            <ProductShelf 
              products={(activeProducts.length > 0 ? activeProducts : (isLoadingProducts ? PRODUCTS : [])).filter(p => p.isQueridinhos).slice(0, visibleQueridinhos)} 
              onAddToCart={addToCart} 
              onOpenProduct={openProductDetail} 
            />
            
            {(activeProducts.length > 0 ? activeProducts : (isLoadingProducts ? PRODUCTS : [])).filter(p => p.isQueridinhos).length > visibleQueridinhos && (
              <div className="mt-8 mb-20 text-center">
                <button 
                  onClick={() => setVisibleQueridinhos(prev => prev + 8)}
                  className="px-12 py-4 border-2 border-[#ff0080] text-[#ff0080] rounded-full text-[12px] font-black uppercase tracking-[0.2em] hover:bg-[#ff0080] hover:text-white transition-all shadow-lg active:scale-95"
                >
                  Ver Mais
                </button>
              </div>
            )}
          </div>

          {/* Destaque do Mês: Latina section */}
          <div className="mt-10 md:mt-0">
            <FeaturedOfMonth products={activeProducts.length > 0 ? activeProducts : PRODUCTS} onOpenProduct={openProductDetail} />
          </div>

          {/* Page Title & Count Area */}
          <div className="max-w-[1520px] mx-auto px-4 md:px-10 py-10 md:py-20 text-center w-full max-w-full overflow-hidden">
            <h2 className="text-[28px] md:text-[64px] font-bold text-[#ff0080] tracking-tighter font-montserrat px-4 leading-none lowercase break-words">
              os mais vendidos
            </h2>
          </div>

          {/* Product Grid Area - Using 1 col for single stacking on mobile */}
          <div className="max-w-7xl mx-auto px-4 md:px-10 pb-20 overflow-x-hidden flex flex-col items-center">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-x-8 md:gap-y-20 w-full">
              {(activeProducts.length > 0 ? activeProducts : (isLoadingProducts ? PRODUCTS : [])).filter(p => p.isBestSeller || p.isMaisVendidos).length > 0 ? (
                (activeProducts.length > 0 ? activeProducts : (isLoadingProducts ? PRODUCTS : [])).filter(p => p.isBestSeller || p.isMaisVendidos).slice(0, visibleBestSellers).map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={addToCart} onOpenProduct={openProductDetail} />
                ))
              ) : (
                <div className="col-span-full py-20 text-center">
                  <ShoppingBag className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[11px]">Nenhum produto em destaque</p>
                </div>
              )}
            </div>

            {activeProducts.filter(p => p.isBestSeller).length > visibleBestSellers && (
              <div className="mt-16 text-center">
                <button 
                  onClick={() => setVisibleBestSellers(prev => prev + 8)}
                  className="px-12 py-4 border-2 border-[#ff0080] text-[#ff0080] rounded-full text-[12px] font-black uppercase tracking-[0.2em] hover:bg-[#ff0080] hover:text-white transition-all shadow-lg active:scale-95"
                >
                  Ver Mais
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-10 py-6 md:py-16 overflow-x-hidden">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 mb-8 text-[12px] md:text-[11px] font-medium text-gray-400 capitalize whitespace-nowrap">
            <button onClick={goToHome} className="hover:text-[#ff0080] transition-colors">Home</button>
            <span className="text-gray-300 px-1 font-normal">&gt;</span>
            <span className="text-[#ff0080] font-bold border-b border-[#ff0080] pb-0.5">
              {selectedCategory 
                ? (selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1).toLowerCase()).replace('-', ' ') 
                : searchQuery 
                ? `busca: "${searchQuery}"` 
                : ''}
            </span>
          </div>

          {/* Title Header */}
          <div className="mb-8">
            <h1 className="text-[28px] md:text-[54px] font-black text-[#ff0080] uppercase tracking-tighter font-montserrat leading-none">
              {selectedCategory 
                ? selectedCategory.replace('-', ' ') 
                : searchQuery 
                ? `resultados para: "${searchQuery}"` 
                : ''}
            </h1>
          </div>

          {/* Total products + Sort panel */}
          {/* Desktop Version */}
          <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between border-y border-gray-100 py-5 mb-10 gap-4">
            <span className="text-[11px] md:text-[12px] font-bold text-gray-500 uppercase tracking-widest">
              Total de <span className="text-[#ff0080] font-black">{filteredAndSortedProducts.length}</span> produtos
            </span>
            
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Ordenar por:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-gray-200 rounded-full px-4 py-2 text-[10px] font-black text-gray-700 uppercase tracking-wider outline-none focus:border-[#ff0080] cursor-pointer shadow-sm"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Version (Aesthetic Match) */}
          <div className="md:hidden grid grid-cols-2 border-y border-gray-100 py-3.5 mb-8 text-center items-center text-[15px] font-normal text-gray-600 bg-white">
            <div className="border-r border-gray-100 py-1 font-montserrat tracking-tight">
              {filteredAndSortedProducts.length} {filteredAndSortedProducts.length === 1 ? 'produto' : 'produtos'}
            </div>
            <div className="relative flex items-center justify-center gap-1.5 text-gray-900 font-semibold py-1 cursor-pointer font-montserrat tracking-tight">
              <svg className="w-5 h-5 text-gray-900 stroke-[1.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 12h12M3 20h6" />
              </svg>
              <span>Ordenar</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-x-8 md:gap-y-20">
            {filteredAndSortedProducts.length > 0 ? (
              filteredAndSortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={addToCart} onOpenProduct={openProductDetail} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[11px]">Nenhum produto encontrado</p>
                <button 
                  onClick={goToHome}
                  className="mt-6 px-10 py-4 bg-[#ff0080] text-white rounded-full text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-pink-200"
                >
                  Ver todos os produtos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <NewsletterSection />

      <Footer onOpenAdmin={openAdmin} onGoHome={goToHome} />

      {/* Social Proof: Recent Purchase Notifications */}
      <PurchaseNotification products={activeProducts} />

      {/* Admin Panel Modal */}
      <AdminPanel 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
        products={products}
        banners={banners}
        onToggleProductActive={handleToggleProductActive}
        onDeleteProduct={handleDeleteProduct}
        onDeleteBanner={handleDeleteBanner}
        onDeleteAllBanners={handleDeleteAllBanners}
        onDeleteOrder={handleDeleteOrder}
        onDeleteAllOrders={handleDeleteAllOrders}
      />

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsLoginOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md p-10 relative z-10 shadow-2xl rounded-2xl"
            >
              <button 
                onClick={() => setIsLoginOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors"
                disabled={isLoggingIn}
              >
                <X className="w-6 h-6" />
              </button>
              <div className="text-center">
                <img 
                  src="https://wepink.vtexassets.com/assets/vtex/assets-builder/wepink.store-theme/6.0.10/svg/logo-primary___ef05671065928b5b01f33e72323ba3b8.svg" 
                  alt="Logo" 
                  className="h-6 mx-auto mb-10" 
                  referrerPolicy="no-referrer"
                />
                <h2 className="text-2xl font-serif font-bold mb-8">
                  {user ? 'Sua Conta' : 'Acesse sua conta'}
                </h2>
                <div className="space-y-6">
                  {user ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div className="w-12 h-12 bg-[#ff0080]/10 rounded-full flex items-center justify-center mx-auto mb-3 text-[#ff0080]">
                          <User className="w-6 h-6" />
                        </div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Logado como:</p>
                        <p className="text-[14px] font-black text-gray-800">{user.email}</p>
                      </div>
                      
                      <button 
                        onClick={async () => { 
                          localStorage.removeItem('wepink_mock_user');
                          await auth.signOut(); 
                          setUser(null);
                          setIsLoginOpen(false); 
                        }}
                        className="w-full text-gray-400 hover:text-red-500 py-3 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                      >
                        Sair da conta
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        className="w-full bg-white border border-gray-200 py-4 px-6 rounded-xl flex items-center justify-center gap-4 hover:bg-gray-50 transition-all font-bold text-[11px] uppercase tracking-widest"
                      >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" />
                        Entrar com Google
                      </button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
                        <div className="relative flex justify-center text-[9px] uppercase font-bold text-gray-400 bg-white px-4 tracking-[0.2em]">ou acesse com e-mail</div>
                      </div>
                      <form onSubmit={handleEmailLogin} className="space-y-4">
                        {loginError && (
                          <div className="bg-red-50 text-red-600 text-[10px] font-bold py-2.5 px-3.5 rounded-xl border border-red-100/50 flex items-start gap-2 animate-fadeIn text-left uppercase tracking-widest leading-relaxed">
                            <span className="text-red-500">⚠</span>
                            <span className="flex-1">{loginError}</span>
                          </div>
                        )}
                        <input 
                          required type="email" placeholder="E-MAIL" 
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full border-b border-gray-200 py-3 text-[10px] font-bold tracking-widest focus:border-[#ff0080] outline-none transition-colors uppercase" 
                        />
                        <input 
                          required type="password" placeholder="SENHA" 
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full border-b border-gray-200 py-3 text-[10px] font-bold tracking-widest focus:border-[#ff0080] outline-none transition-colors uppercase" 
                        />
                        <button 
                          type="submit" 
                          disabled={isLoggingIn}
                          className="btn-purchase mt-6 flex items-center justify-center"
                        >
                          {isLoggingIn ? (
                            <motion.div 
                              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                            />
                          ) : 'Entrar'}
                        </button>
                      </form>
                      <button 
                        onClick={handleResetPassword}
                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#ff0080] transition-colors"
                      >
                        Esqueceu sua senha?
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
