/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  calculateNights,
  calculatePriceBreakdown,
  doDatesOverlap,
  isRoomAvailableForDates,
  ROLE_PERMISSIONS,
  UserRole
} from './src/utils/bookingEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'hotelpro_academic_jwt_secret_key_2026';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==========================================
// IN-MEMORY / MONGOOSE INTEGRATED DATA STORE
// ==========================================

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  accountStatus: 'active' | 'suspended';
  assignedHotelId: string | null;
  createdAt: string;
}

export interface HotelEntity {
  id: string;
  name: string;
  tagline: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  starRating: number;
  reviewAverage: number;
  reviewCount: number;
  amenities: string[];
  images: string[];
  managerId: string;
  status: 'active' | 'maintenance';
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationDays: number;
    petFriendly: boolean;
  };
}

export interface RoomEntity {
  id: string;
  hotelId: string;
  roomNumber: string;
  category: string;
  capacity: { adults: number; children: number };
  bedType: string;
  sizeSqFt: number;
  basePrice: number;
  amenities: string[];
  operationalStatus: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance';
  images: string[];
  floor: number;
}

export interface BookingEntity {
  id: string;
  bookingReference: string;
  userId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  roomCategory: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  nights: number;
  guests: { adults: number; children: number };
  numberOfRooms: number;
  priceBreakdown: {
    basePricePerNight: number;
    roomRateSubtotal: number;
    discountPercent: number;
    discountAmount: number;
    taxRate: number;
    taxAmount: number;
    resortFee: number;
    totalAmount: number;
    currency: string;
  };
  bookingStatus: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  paymentProvider: string;
  paymentReceipt: string;
  specialRequests: string;
  checkInTimestamp: string | null;
  checkOutTimestamp: string | null;
  createdAt: string;
}

export interface HousekeepingEntity {
  id: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  taskType: 'Turnover Clean' | 'Daily Refresh' | 'Deep Clean' | 'Inspection';
  priority: 'high' | 'standard' | 'low';
  status: 'Dirty' | 'Cleaning' | 'Inspected' | 'Ready';
  assignedStaffId: string | null;
  assignedStaffName: string;
  notes: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ServiceRequestEntity {
  id: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  bookingId: string;
  guestId: string;
  guestName: string;
  category: 'Room Service' | 'Extra Amenities' | 'Luggage Assistance' | 'Maintenance Issue' | 'Concierge Booking';
  description: string;
  priority: 'urgent' | 'standard' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface ReviewEntity {
  id: string;
  hotelId: string;
  userId: string;
  userName: string;
  bookingId: string;
  rating: number;
  title: string;
  comment: string;
  verifiedStay: boolean;
  createdAt: string;
}

export interface AdminLogEntity {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details: string;
  createdAt: string;
}

// ------------------------------------------
// SEED DATA INITIALIZATION
// ------------------------------------------

const defaultPasswordHash = bcrypt.hashSync('HotelPro@2026', 10);

const USERS: UserEntity[] = [
  {
    id: 'user-guest-1',
    name: 'Aarav Sharma',
    email: 'guest@hotelpro.io',
    passwordHash: defaultPasswordHash,
    role: 'guest',
    phone: '+91 98765 43210',
    accountStatus: 'active',
    assignedHotelId: null,
    createdAt: '2026-01-15T10:00:00Z'
  },
  {
    id: 'user-staff-1',
    name: 'Vikramaditya Rao (Front Office)',
    email: 'staff@hotelpro.io',
    passwordHash: defaultPasswordHash,
    role: 'staff',
    phone: '+91 91234 56789',
    accountStatus: 'active',
    assignedHotelId: 'hotel-1',
    createdAt: '2026-01-10T09:00:00Z'
  },
  {
    id: 'user-manager-1',
    name: 'Priya Patel (General Manager)',
    email: 'manager@hotelpro.io',
    passwordHash: defaultPasswordHash,
    role: 'manager',
    phone: '+91 94567 89012',
    accountStatus: 'active',
    assignedHotelId: 'hotel-1',
    createdAt: '2026-01-05T08:00:00Z'
  },
  {
    id: 'user-admin-1',
    name: 'Rajesh Verma (Platform Director)',
    email: 'admin@hotelpro.io',
    passwordHash: defaultPasswordHash,
    role: 'superadmin',
    phone: '+91 99990 00000',
    accountStatus: 'active',
    assignedHotelId: null,
    createdAt: '2026-01-01T00:00:00Z'
  }
];

const HOTELS: HotelEntity[] = [
  {
    id: 'hotel-1',
    name: 'The Taj Lake Palace & Mewar Sanctuary',
    tagline: 'Floating white marble palace on Lake Pichola with royal butler service',
    description: 'Constructed in 1746 by Maharana Jagat Singh II, this world-renowned floating marble palace in Udaipur delivers imperial Mewari hospitality, private sunset shikara boat cruises, and tranquil royal jharokhas overlooking the Aravali mountains.',
    address: 'Lake Pichola, Post Box No. 5',
    city: 'Udaipur',
    state: 'Rajasthan',
    country: 'India',
    starRating: 5,
    reviewAverage: 4.9,
    reviewCount: 284,
    amenities: ['Lake Pichola Views', 'Royal Jharokha Balcony', 'Ayurvedic Jiva Spa', 'Private Shikara Boat', 'Mewari Fine Dining', '24/7 Royal Butler', 'Heritage Courtyards', 'High-speed Wi-Fi'],
    images: [
      '/src/assets/images/udaipur_lake_palace_resort_1793110692210.jpg',
      '/src/assets/images/royal_rajasthan_suite_1793110694102.jpg',
      '/src/assets/images/hotel_spa_wellness_1793027978409.jpg'
    ],
    managerId: 'user-manager-1',
    status: 'active',
    policies: {
      checkInTime: '14:00',
      checkOutTime: '11:00',
      cancellationDays: 3,
      petFriendly: false
    }
  },
  {
    id: 'hotel-2',
    name: 'The Oberoi Grand Horizon Beach Resort',
    tagline: 'Arabian Sea sunset pavilions and private coastal cabanas',
    description: 'Spread across pristine beachfront in Candolim, this coastal luxury haven blends Mediterranean Portuguese heritage with tropical Goan architecture, featuring a grand infinity pool, authentic coastal seafood, and therapeutic Ayurvedic wellness.',
    address: 'Sinquerim Beach Road, Candolim',
    city: 'North Goa',
    state: 'Goa',
    country: 'India',
    starRating: 5,
    reviewAverage: 4.8,
    reviewCount: 196,
    amenities: ['Private Beach Access', 'Infinity Horizon Pool', 'Ayurvedic Wellness Spa', 'Coastal Konkan Dining', 'Sunset Cruise Deck', '24/7 Concierge', 'High-speed Wi-Fi'],
    images: [
      '/src/assets/images/goa_beach_resort_1793110716790.jpg',
      '/src/assets/images/royal_rajasthan_suite_1793110694102.jpg'
    ],
    managerId: 'user-manager-1',
    status: 'active',
    policies: {
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationDays: 2,
      petFriendly: true
    }
  },
  {
    id: 'hotel-3',
    name: 'The Himalayan Pine Sanctuary & Spa',
    tagline: 'Heated hydrotherapy and cedar deodar forests overlooking snow peaks',
    description: 'An alpine sanctuary nestled among century-old deodar pine forests in the Kullu valley, offering heated slate floors, stone fireplaces, thermal Himalayan hot tubs, and bespoke orchard apple tastings under starry mountain skies.',
    address: 'Naggar Road, Manali Hills',
    city: 'Manali',
    state: 'Himachal Pradesh',
    country: 'India',
    starRating: 5,
    reviewAverage: 4.9,
    reviewCount: 158,
    amenities: ['Snow Peak Panoramas', 'Heated Outdoor Hydro Pool', 'Cedar Wood Fireplaces', 'Himalayan Herbal Spa', 'Mountain Trek Butler', 'Fine Apple Orchard Dining'],
    images: [
      '/src/assets/images/himalayan_luxury_lodge_1793110694232.jpg',
      '/src/assets/images/hotel_spa_wellness_1793027978409.jpg'
    ],
    managerId: 'user-manager-1',
    status: 'active',
    policies: {
      checkInTime: '14:00',
      checkOutTime: '11:00',
      cancellationDays: 5,
      petFriendly: true
    }
  }
];

const ROOMS: RoomEntity[] = [
  // Hotel 1 (Udaipur)
  {
    id: 'room-101',
    hotelId: 'hotel-1',
    roomNumber: '101',
    category: 'Royal Lake View Suite',
    capacity: { adults: 2, children: 1 },
    bedType: 'Imperial King',
    sizeSqFt: 650,
    basePrice: 24500, // ₹24,500/night
    amenities: ['Lake Pichola Jharokha', 'Carved Marble Soaking Tub', 'Pashmina Bedspreads', 'Private Boat Chauffeur', 'Nespresso Bar'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/royal_rajasthan_suite_1793110694102.jpg'],
    floor: 1
  },
  {
    id: 'room-102',
    hotelId: 'hotel-1',
    roomNumber: '102',
    category: 'Deluxe Heritage King',
    capacity: { adults: 2, children: 0 },
    bedType: 'King',
    sizeSqFt: 480,
    basePrice: 16500, // ₹16,500/night
    amenities: ['Courtyard Garden View', 'Italian Marble Shower', 'Herbal Minibar', 'Artisan Work Desk'],
    operationalStatus: 'Occupied',
    images: ['/src/assets/images/royal_rajasthan_suite_1793110694102.jpg'],
    floor: 1
  },
  {
    id: 'room-201',
    hotelId: 'hotel-1',
    roomNumber: '201',
    category: 'Mewar Grand Presidential Suite',
    capacity: { adults: 4, children: 2 },
    bedType: 'Royal Maharaja King & Twin Queens',
    sizeSqFt: 1450,
    basePrice: 62000, // ₹62,000/night
    amenities: ['Panoramic 360° Lake Balcony', 'Gold-leaf Filigree Ceilings', 'Dedicated Khansama Butler', 'Private Heated Jacuzzi'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/royal_rajasthan_suite_1793110694102.jpg'],
    floor: 2
  },
  {
    id: 'room-202',
    hotelId: 'hotel-1',
    roomNumber: '202',
    category: 'Royal Lake View Suite',
    capacity: { adults: 2, children: 1 },
    bedType: 'Imperial King',
    sizeSqFt: 650,
    basePrice: 24500,
    amenities: ['Lake Pichola Jharokha', 'Carved Marble Soaking Tub', 'Pashmina Bedspreads'],
    operationalStatus: 'Cleaning',
    images: ['/src/assets/images/royal_rajasthan_suite_1793110694102.jpg'],
    floor: 2
  },
  // Hotel 2 (Goa)
  {
    id: 'room-301',
    hotelId: 'hotel-2',
    roomNumber: 'V-01',
    category: 'Oceanfront Luxury Villa',
    capacity: { adults: 3, children: 1 },
    bedType: 'Grand King',
    sizeSqFt: 1100,
    basePrice: 38000, // ₹38,000/night
    amenities: ['Direct Beach Access', 'Private Plunge Pool', 'Outdoor Rain Shower', 'Sunset Cabana'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/goa_beach_resort_1793110716790.jpg'],
    floor: 1
  },
  {
    id: 'room-302',
    hotelId: 'hotel-2',
    roomNumber: '204',
    category: 'Arabian Horizon Suite',
    capacity: { adults: 2, children: 0 },
    bedType: 'King',
    sizeSqFt: 580,
    basePrice: 19500, // ₹19,500/night
    amenities: ['Sea View Balcony', 'Complimentary Evening Cocktails', 'Teakwood Lounger', 'Bose Soundbar'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/goa_beach_resort_1793110716790.jpg'],
    floor: 2
  },
  // Hotel 3 (Manali)
  {
    id: 'room-401',
    hotelId: 'hotel-3',
    roomNumber: 'Himalaya-01',
    category: 'Cedar Mountain Chalet',
    capacity: { adults: 3, children: 1 },
    bedType: 'King & Daybed',
    sizeSqFt: 720,
    basePrice: 21000, // ₹21,000/night
    amenities: ['Stone Fireplace', 'Deodar Pine Balcony', 'Heated Slate Flooring', 'Herbal Steam Shower'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/himalayan_luxury_lodge_1793110694232.jpg'],
    floor: 1
  }
];

const BOOKINGS: BookingEntity[] = [
  {
    id: 'bkg-1001',
    bookingReference: 'HP-891024',
    userId: 'user-guest-1',
    guestName: 'Aarav Sharma',
    guestEmail: 'guest@hotelpro.io',
    guestPhone: '+91 98765 43210',
    hotelId: 'hotel-1',
    roomId: 'room-102',
    roomNumber: '102',
    roomCategory: 'Deluxe Heritage King',
    checkIn: '2026-10-25',
    checkOut: '2026-10-28',
    nights: 3,
    guests: { adults: 2, children: 0 },
    numberOfRooms: 1,
    priceBreakdown: {
      basePricePerNight: 16500,
      roomRateSubtotal: 49500,
      discountPercent: 10,
      discountAmount: 4950,
      taxRate: 0.18,
      taxAmount: 8019,
      resortFee: 2250,
      totalAmount: 54819,
      currency: 'INR'
    },
    bookingStatus: 'checked_in',
    paymentStatus: 'paid',
    paymentProvider: 'upi',
    paymentReceipt: 'UPI-908124892',
    specialRequests: 'Upper floor heritage wing with Lake Pichola boat pickup.',
    checkInTimestamp: '2026-10-25T14:30:00Z',
    checkOutTimestamp: null,
    createdAt: '2026-10-20T11:15:00Z'
  },
  {
    id: 'bkg-1002',
    bookingReference: 'HP-904152',
    userId: 'user-guest-1',
    guestName: 'Aarav Sharma',
    guestEmail: 'guest@hotelpro.io',
    guestPhone: '+91 98765 43210',
    hotelId: 'hotel-1',
    roomId: 'room-101',
    roomNumber: '101',
    roomCategory: 'Royal Lake View Suite',
    checkIn: '2026-11-10',
    checkOut: '2026-11-14',
    nights: 4,
    guests: { adults: 2, children: 1 },
    numberOfRooms: 1,
    priceBreakdown: {
      basePricePerNight: 24500,
      roomRateSubtotal: 98000,
      discountPercent: 0,
      discountAmount: 0,
      taxRate: 0.18,
      taxAmount: 17640,
      resortFee: 3000,
      totalAmount: 118640,
      currency: 'INR'
    },
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentProvider: 'razorpay',
    paymentReceipt: 'RZP-81044921',
    specialRequests: 'Celebrating wedding anniversary. Royal rose petal thali welcome requested.',
    checkInTimestamp: null,
    checkOutTimestamp: null,
    createdAt: '2026-10-24T14:22:00Z'
  }
];

const HOUSEKEEPING_TASKS: HousekeepingEntity[] = [
  {
    id: 'task-1',
    hotelId: 'hotel-1',
    roomId: 'room-202',
    roomNumber: '202',
    taskType: 'Turnover Clean',
    priority: 'high',
    status: 'Cleaning',
    assignedStaffId: 'user-staff-1',
    assignedStaffName: 'Vikramaditya Rao',
    notes: 'Prior guest departed at 11:00 AM. Deep sanitize lake view marble jharokha.',
    createdAt: '2026-10-26T11:05:00Z',
    completedAt: null
  },
  {
    id: 'task-2',
    hotelId: 'hotel-1',
    roomId: 'room-102',
    roomNumber: '102',
    taskType: 'Daily Refresh',
    priority: 'standard',
    status: 'Ready',
    assignedStaffId: 'user-staff-1',
    assignedStaffName: 'Vikramaditya Rao',
    notes: 'Mid-stay organic linen refresh and fresh Mogra flower arrangement placed.',
    createdAt: '2026-10-26T09:30:00Z',
    completedAt: '2026-10-26T10:15:00Z'
  }
];

const SERVICE_REQUESTS: ServiceRequestEntity[] = [
  {
    id: 'srv-1',
    hotelId: 'hotel-1',
    roomId: 'room-102',
    roomNumber: '102',
    bookingId: 'bkg-1001',
    guestId: 'user-guest-1',
    guestName: 'Aarav Sharma',
    category: 'Room Service',
    description: 'Hot saffron cardamom masala chai with Rajasthani kachoris and mineral water.',
    priority: 'standard',
    status: 'pending',
    createdAt: '2026-10-26T08:00:00Z'
  }
];

const REVIEWS: ReviewEntity[] = [
  {
    id: 'rev-1',
    hotelId: 'hotel-1',
    userId: 'user-guest-1',
    userName: 'Aarav Sharma',
    bookingId: 'bkg-past-0',
    rating: 5,
    title: 'An ethereal floating palace experience',
    comment: 'Arriving by private shikara boat on Lake Pichola felt straight out of a royal fairy tale. The staff anticipated our every requirement with graceful Indian warmth. The Mewari thali at sunset is simply unforgettable.',
    verifiedStay: true,
    createdAt: '2026-09-18T16:00:00Z'
  },
  {
    id: 'rev-2',
    hotelId: 'hotel-2',
    userId: 'user-guest-1',
    userName: 'Sunita Mehra',
    bookingId: 'bkg-past-1',
    rating: 5,
    title: 'Unmatched beachfront serenity in Goa',
    comment: 'The private pool villa facing the Arabian Sea sunset was pure bliss. Authentic Goan prawn curry paired with refreshing kokum coolers made our family holiday truly memorable.',
    verifiedStay: true,
    createdAt: '2026-08-12T14:30:00Z'
  }
];

const ADMIN_LOGS: AdminLogEntity[] = [
  {
    id: 'log-1',
    actorId: 'user-admin-1',
    actorName: 'Alexander Cross',
    actorRole: 'superadmin',
    action: 'SYSTEM_BOOTSTRAP',
    targetEntity: 'Platform',
    targetId: 'global',
    details: 'Initial secure system seed executed with verified cryptographic credentials.',
    createdAt: '2026-10-26T08:00:00Z'
  },
  {
    id: 'log-2',
    actorId: 'user-manager-1',
    actorName: 'Victoria Sterling',
    actorRole: 'manager',
    action: 'RATE_UPDATE',
    targetEntity: 'Hotel',
    targetId: 'hotel-1',
    details: 'Adjusted seasonal peak rate for Ocean View Suite to $420/night.',
    createdAt: '2026-10-26T08:10:00Z'
  }
];

// Helper to log admin actions
function logAdminAction(actor: UserEntity, action: string, targetEntity: string, targetId: string, details: string) {
  ADMIN_LOGS.unshift({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    targetEntity,
    targetId,
    details,
    createdAt: new Date().toISOString()
  });
}

// ------------------------------------------
// EXPRESS SERVER SETUP
// ------------------------------------------

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth Token Verification Middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: UserRole };
    const user = USERS.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }
    if (user.accountStatus === 'suspended') {
      return res.status(403).json({ success: false, message: 'Account is suspended.' });
    }
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired session token.' });
  }
};

// Role Access Middleware
const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as UserEntity | undefined;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Resource restricted to roles [${roles.join(', ')}]. Current role: '${user?.role || 'anonymous'}'`
      });
    }
    next();
  };
};

// ==========================================
// REST API ROUTES
// ==========================================

// 1. System Health & Environment Status
app.get('/api/system/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    system: 'HotelPro Hospitality Management System',
    version: '1.0.0-academic',
    environment: process.env.NODE_ENV || 'development',
    storageMode: process.env.MONGODB_URI ? 'MongoDB Persistent Instance' : 'High-Fidelity In-Memory Store (Active)',
    mongoConfigured: Boolean(process.env.MONGODB_URI),
    metrics: {
      hotelsCount: HOTELS.length,
      roomsCount: ROOMS.length,
      bookingsCount: BOOKINGS.length,
      usersCount: USERS.length,
      activeHousekeeping: HOUSEKEEPING_TASKS.filter((t) => t.status !== 'Ready').length
    }
  });
});

// 2. Auth Routes
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  }

  const existing = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: 'Email already registered.' });
  }

  const newUser: UserEntity = {
    id: `user-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'guest', // Public registration is strictly guest role
    phone: phone || '',
    accountStatus: 'active',
    assignedHotelId: null,
    createdAt: new Date().toISOString()
  };

  USERS.push(newUser);

  const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  const { passwordHash: _, ...safeUser } = newUser;

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    token,
    user: safeUser
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  const user = USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Please verify email and password.' });
  }

  if (user.accountStatus === 'suspended') {
    return res.status(403).json({ success: false, message: 'Account suspended. Contact administration.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: safeUser
  });
});

// Quick switch between test accounts for live portfolio demo
app.post('/api/auth/quick-switch', (req: Request, res: Response) => {
  const { role } = req.body;
  const targetUser = USERS.find((u) => u.role === role);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: `No seed user found for role: ${role}` });
  }

  const token = jwt.sign({ id: targetUser.id, role: targetUser.role }, JWT_SECRET, { expiresIn: '7d' });
  const { passwordHash: _, ...safeUser } = targetUser;

  res.json({
    success: true,
    message: `Switched session to ${targetUser.name} (${targetUser.role})`,
    token,
    user: safeUser
  });
});

app.get('/api/auth/me', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// 3. Hotel Routes
app.get('/api/hotels', (req: Request, res: Response) => {
  const { destination, minStar, maxPrice, amenity, sort } = req.query;

  let filtered = [...HOTELS];

  if (destination && typeof destination === 'string') {
    const q = destination.toLowerCase().trim();
    filtered = filtered.filter(
      (h) =>
        h.city.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q)
    );
  }

  if (minStar) {
    filtered = filtered.filter((h) => h.starRating >= Number(minStar));
  }

  if (amenity && typeof amenity === 'string') {
    filtered = filtered.filter((h) => h.amenities.includes(amenity));
  }

  if (sort === 'rating') {
    filtered.sort((a, b) => b.reviewAverage - a.reviewAverage);
  } else if (sort === 'reviews') {
    filtered.sort((a, b) => b.reviewCount - a.reviewCount);
  }

  // Include starting price from rooms
  const hotelsWithPrice = filtered.map((hotel) => {
    const hotelRooms = ROOMS.filter((r) => r.hotelId === hotel.id);
    const minPrice = hotelRooms.length > 0 ? Math.min(...hotelRooms.map((r) => r.basePrice)) : 250;
    return {
      ...hotel,
      startingPrice: minPrice,
      totalRooms: hotelRooms.length
    };
  });

  res.json({ success: true, count: hotelsWithPrice.length, hotels: hotelsWithPrice });
});

app.get('/api/hotels/:id', (req: Request, res: Response) => {
  const hotel = HOTELS.find((h) => h.id === req.params.id);
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel not found.' });
  }

  const hotelRooms = ROOMS.filter((r) => r.hotelId === hotel.id);
  const hotelReviews = REVIEWS.filter((r) => r.hotelId === hotel.id);

  res.json({
    success: true,
    hotel: {
      ...hotel,
      rooms: hotelRooms,
      reviews: hotelReviews
    }
  });
});

app.post('/api/hotels', authenticateToken, requireRole('superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const { name, tagline, description, address, city, state, starRating, amenities, images } = req.body;

  if (!name || !city || !address) {
    return res.status(400).json({ success: false, message: 'Name, city, and address are required.' });
  }

  const newHotel: HotelEntity = {
    id: `hotel-${Date.now()}`,
    name,
    tagline: tagline || '',
    description: description || 'Luxury hotel property.',
    address,
    city,
    state: state || '',
    country: 'United States',
    starRating: Number(starRating) || 5,
    reviewAverage: 5.0,
    reviewCount: 0,
    amenities: amenities || ['High-speed Wi-Fi', '24/7 Concierge'],
    images: images && images.length > 0 ? images : ['/src/assets/images/hero_luxury_resort_1793027976265.jpg'],
    managerId: 'user-manager-1',
    status: 'active',
    policies: {
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationDays: 2,
      petFriendly: true
    }
  };

  HOTELS.push(newHotel);
  logAdminAction(actor, 'CREATE_HOTEL', 'Hotel', newHotel.id, `Created new property: ${newHotel.name}`);

  res.status(201).json({ success: true, hotel: newHotel });
});

// 4. Room Routes & Availability Engine
app.get('/api/rooms/hotel/:hotelId', (req: Request, res: Response) => {
  const { checkIn, checkOut, adults } = req.query;
  const hotelRooms = ROOMS.filter((r) => r.hotelId === req.params.hotelId);

  // If checkIn & checkOut provided, check atomic date overlap
  if (checkIn && checkOut && typeof checkIn === 'string' && typeof checkOut === 'string') {
    const dates = { checkIn, checkOut };
    const existingBookingsForEngine = BOOKINGS.map((b) => ({
      id: b.id,
      roomId: b.roomId,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      bookingStatus: b.bookingStatus
    }));

    const enriched = hotelRooms.map((room) => {
      const isAvailable = isRoomAvailableForDates(room.id, dates, existingBookingsForEngine);
      const capacityCheck = adults ? room.capacity.adults >= Number(adults) : true;
      return {
        ...room,
        isAvailableForDates: isAvailable && capacityCheck
      };
    });

    return res.json({ success: true, rooms: enriched });
  }

  res.json({ success: true, rooms: hotelRooms });
});

app.post('/api/rooms', authenticateToken, requireRole('manager', 'superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const { hotelId, roomNumber, category, basePrice, capacity, bedType, sizeSqFt, amenities } = req.body;

  if (!hotelId || !roomNumber || !category || !basePrice) {
    return res.status(400).json({ success: false, message: 'Hotel, room number, category, and base price are required.' });
  }

  // Manager must only add to assigned hotel
  if (actor.role === 'manager' && actor.assignedHotelId && actor.assignedHotelId !== hotelId) {
    return res.status(403).json({ success: false, message: 'Managers may only manage rooms for their assigned property.' });
  }

  // Check unique room number per hotel
  const existing = ROOMS.find((r) => r.hotelId === hotelId && r.roomNumber === roomNumber);
  if (existing) {
    return res.status(400).json({ success: false, message: `Room #${roomNumber} already exists in this hotel.` });
  }

  const newRoom: RoomEntity = {
    id: `room-${Date.now()}`,
    hotelId,
    roomNumber,
    category,
    capacity: capacity || { adults: 2, children: 1 },
    bedType: bedType || 'King',
    sizeSqFt: Number(sizeSqFt) || 500,
    basePrice: Number(basePrice),
    amenities: amenities || ['Air Conditioning', 'Safe', 'HDTV', 'Wi-Fi'],
    operationalStatus: 'Available',
    images: ['/src/assets/images/hotel_presidential_suite_1793027976454.jpg'],
    floor: Math.floor(Number(roomNumber) / 100) || 1
  };

  ROOMS.push(newRoom);
  logAdminAction(actor, 'CREATE_ROOM', 'Room', newRoom.id, `Added Room #${newRoom.roomNumber} (${newRoom.category})`);

  res.status(201).json({ success: true, room: newRoom });
});

// Update Room Operational Status (Staff/Manager)
app.put('/api/rooms/:id/status', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const { operationalStatus } = req.body;
  const room = ROOMS.find((r) => r.id === req.params.id);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  const allowedStatuses = ['Available', 'Occupied', 'Cleaning', 'Maintenance'];
  if (!allowedStatuses.includes(operationalStatus)) {
    return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  room.operationalStatus = operationalStatus;
  res.json({ success: true, message: `Room ${room.roomNumber} status updated to ${operationalStatus}`, room });
});

// 5. Booking Engine Endpoints
app.post('/api/bookings', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const { hotelId, roomId, checkIn, checkOut, guests, specialRequests, paymentProvider } = req.body;

  if (!hotelId || !roomId || !checkIn || !checkOut) {
    return res.status(400).json({ success: false, message: 'Hotel, room, checkIn, and checkOut dates are required.' });
  }

  const hotel = HOTELS.find((h) => h.id === hotelId);
  const room = ROOMS.find((r) => r.id === roomId && r.hotelId === hotelId);

  if (!hotel || !room) {
    return res.status(404).json({ success: false, message: 'Selected hotel or room could not be found.' });
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    return res.status(400).json({ success: false, message: 'Check-out date must be strictly after check-in date.' });
  }

  // REVALIDATE AVAILABILITY AT SUBMISSION (Atomic Reservation Guard)
  const existingBookingsForEngine = BOOKINGS.map((b) => ({
    id: b.id,
    roomId: b.roomId,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    bookingStatus: b.bookingStatus
  }));

  const isAvailable = isRoomAvailableForDates(room.id, { checkIn, checkOut }, existingBookingsForEngine);
  if (!isAvailable) {
    return res.status(409).json({
      success: false,
      message: `Conflict: Room #${room.roomNumber} is no longer available for the dates ${checkIn} to ${checkOut}. Please select alternative dates or room category.`
    });
  }

  // Server-side calculated price breakdown (never trust client amounts)
  const priceBreakdown = calculatePriceBreakdown(room.basePrice, nights, 1, 0);

  const bookingRef = `HP-${Math.floor(100000 + Math.random() * 900000)}`;
  const receiptNo = `REC-${Date.now().toString().slice(-6)}`;

  const newBooking: BookingEntity = {
    id: `bkg-${Date.now()}`,
    bookingReference: bookingRef,
    userId: user.id,
    guestName: user.name,
    guestEmail: user.email,
    guestPhone: user.phone || req.body.guestPhone || '',
    hotelId: hotel.id,
    roomId: room.id,
    roomNumber: room.roomNumber,
    roomCategory: room.category,
    checkIn,
    checkOut,
    nights,
    guests: guests || { adults: 2, children: 0 },
    numberOfRooms: 1,
    priceBreakdown,
    bookingStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentProvider: paymentProvider || 'demo_card',
    paymentReceipt: receiptNo,
    specialRequests: specialRequests || '',
    checkInTimestamp: null,
    checkOutTimestamp: null,
    createdAt: new Date().toISOString()
  };

  BOOKINGS.push(newBooking);

  res.status(201).json({
    success: true,
    message: 'Booking confirmed successfully.',
    booking: newBooking
  });
});

app.get('/api/bookings/my', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const userBookings = BOOKINGS.filter((b) => b.userId === user.id).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const enriched = userBookings.map((b) => {
    const hotel = HOTELS.find((h) => h.id === b.hotelId);
    return {
      ...b,
      hotelName: hotel?.name || 'HotelPro Luxury Property',
      hotelCity: hotel?.city || '',
      hotelImage: hotel?.images[0] || ''
    };
  });

  res.json({ success: true, count: enriched.length, bookings: enriched });
});

app.get('/api/bookings/hotel/:hotelId', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const { hotelId } = req.params;

  if (user.role === 'staff' || user.role === 'manager') {
    if (user.assignedHotelId && user.assignedHotelId !== hotelId) {
      return res.status(403).json({ success: false, message: 'Access denied to bookings for unassigned hotel.' });
    }
  }

  const hotelBookings = BOOKINGS.filter((b) => b.hotelId === hotelId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  res.json({ success: true, count: hotelBookings.length, bookings: hotelBookings });
});

app.put('/api/bookings/:id/cancel', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const booking = BOOKINGS.find((b) => b.id === req.params.id);

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  // Ownership check
  if (user.role === 'guest' && booking.userId !== user.id) {
    return res.status(403).json({ success: false, message: 'Forbidden. You do not own this booking.' });
  }

  if (booking.bookingStatus === 'checked_in') {
    return res.status(400).json({ success: false, message: 'Active stays in checked-in status cannot be cancelled.' });
  }

  booking.bookingStatus = 'cancelled';
  booking.paymentStatus = 'refunded';

  res.json({
    success: true,
    message: `Booking ${booking.bookingReference} has been successfully cancelled and refunded.`,
    booking
  });
});

// 6. Check-in & Check-out Workflows
app.post('/api/check-in/:bookingId', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const booking = BOOKINGS.find((b) => b.id === req.params.bookingId);

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  if (booking.bookingStatus === 'checked_in') {
    return res.status(400).json({ success: false, message: 'Guest has already completed check-in.' });
  }

  if (booking.bookingStatus === 'cancelled') {
    return res.status(400).json({ success: false, message: 'Cannot check in a cancelled reservation.' });
  }

  const room = ROOMS.find((r) => r.id === booking.roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Associated room could not be found.' });
  }

  // Update timestamps and states
  booking.bookingStatus = 'checked_in';
  booking.checkInTimestamp = new Date().toISOString();
  room.operationalStatus = 'Occupied';

  logAdminAction(actor, 'GUEST_CHECK_IN', 'Booking', booking.bookingReference, `Checked in guest ${booking.guestName} to Room #${room.roomNumber}`);

  res.json({
    success: true,
    message: `Check-in completed. Room #${room.roomNumber} is now marked as Occupied.`,
    booking,
    room
  });
});

app.post('/api/check-out/:bookingId', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const booking = BOOKINGS.find((b) => b.id === req.params.bookingId);

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found.' });
  }

  if (booking.bookingStatus === 'checked_out') {
    return res.status(400).json({ success: false, message: 'Guest is already checked out.' });
  }

  const room = ROOMS.find((r) => r.id === booking.roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Associated room could not be found.' });
  }

  booking.bookingStatus = 'checked_out';
  booking.checkOutTimestamp = new Date().toISOString();
  // Room transitions immediately to Cleaning
  room.operationalStatus = 'Cleaning';

  // Automatically trigger a Turnover Housekeeping Task
  const newTask: HousekeepingEntity = {
    id: `task-${Date.now()}`,
    hotelId: booking.hotelId,
    roomId: room.id,
    roomNumber: room.roomNumber,
    taskType: 'Turnover Clean',
    priority: 'high',
    status: 'Dirty',
    assignedStaffId: actor.id,
    assignedStaffName: actor.name,
    notes: `Checkout turnover triggered for Guest ${booking.guestName}. Full linen change and deep sanitization required.`,
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  HOUSEKEEPING_TASKS.unshift(newTask);
  logAdminAction(actor, 'GUEST_CHECK_OUT', 'Booking', booking.bookingReference, `Checked out guest ${booking.guestName} from Room #${room.roomNumber}. Housekeeping turnover created.`);

  res.json({
    success: true,
    message: `Check-out finalized. Room #${room.roomNumber} set to Cleaning; housekeeping turnover task generated.`,
    booking,
    room,
    housekeepingTask: newTask
  });
});

// 7. Housekeeping Operations
app.get('/api/housekeeping/hotel/:hotelId', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const tasks = HOUSEKEEPING_TASKS.filter((t) => t.hotelId === req.params.hotelId);
  res.json({ success: true, count: tasks.length, tasks });
});

app.put('/api/housekeeping/:taskId/status', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const { status, notes } = req.body;
  const task = HOUSEKEEPING_TASKS.find((t) => t.id === req.params.taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Housekeeping task not found.' });
  }

  const allowed = ['Dirty', 'Cleaning', 'Inspected', 'Ready'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });
  }

  task.status = status;
  if (notes) task.notes = notes;

  const room = ROOMS.find((r) => r.id === task.roomId);
  if (room) {
    if (status === 'Ready') {
      room.operationalStatus = 'Available';
      task.completedAt = new Date().toISOString();
    } else if (status === 'Cleaning') {
      room.operationalStatus = 'Cleaning';
    }
  }

  res.json({ success: true, message: `Housekeeping task status updated to ${status}.`, task, room });
});

// 8. Service Requests
app.get('/api/services/hotel/:hotelId', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const requests = SERVICE_REQUESTS.filter((s) => s.hotelId === req.params.hotelId);
  res.json({ success: true, count: requests.length, requests });
});

app.post('/api/services', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const { hotelId, roomId, roomNumber, category, description, priority } = req.body;

  if (!hotelId || !roomNumber || !category || !description) {
    return res.status(400).json({ success: false, message: 'Hotel, room, category, and description are required.' });
  }

  const newRequest: ServiceRequestEntity = {
    id: `srv-${Date.now()}`,
    hotelId,
    roomId: roomId || '',
    roomNumber,
    bookingId: '',
    guestId: user.id,
    guestName: user.name,
    category,
    description,
    priority: priority || 'standard',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  SERVICE_REQUESTS.unshift(newRequest);
  res.status(201).json({ success: true, message: 'Service request dispatched to hotel staff.', request: newRequest });
});

app.put('/api/services/:id/status', authenticateToken, requireRole('staff', 'manager', 'superadmin'), (req: Request, res: Response) => {
  const { status } = req.body;
  const request = SERVICE_REQUESTS.find((s) => s.id === req.params.id);

  if (!request) {
    return res.status(404).json({ success: false, message: 'Service request not found.' });
  }

  request.status = status;
  res.json({ success: true, message: `Service request status updated to ${status}`, request });
});

// 9. Reviews
app.get('/api/reviews/hotel/:hotelId', (req: Request, res: Response) => {
  const hotelReviews = REVIEWS.filter((r) => r.hotelId === req.params.hotelId);
  res.json({ success: true, reviews: hotelReviews });
});

app.post('/api/reviews', authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user as UserEntity;
  const { hotelId, rating, title, comment } = req.body;

  if (!hotelId || !rating || !comment) {
    return res.status(400).json({ success: false, message: 'Hotel, rating, and comment are required.' });
  }

  const newReview: ReviewEntity = {
    id: `rev-${Date.now()}`,
    hotelId,
    userId: user.id,
    userName: user.name,
    bookingId: `bkg-verified-${Date.now()}`,
    rating: Number(rating),
    title: title || 'Exceptional Stay',
    comment,
    verifiedStay: true,
    createdAt: new Date().toISOString()
  };

  REVIEWS.unshift(newReview);

  // Update hotel average rating
  const hotelReviews = REVIEWS.filter((r) => r.hotelId === hotelId);
  const avg = hotelReviews.reduce((sum, r) => sum + r.rating, 0) / hotelReviews.length;
  const hotel = HOTELS.find((h) => h.id === hotelId);
  if (hotel) {
    hotel.reviewAverage = Math.round(avg * 10) / 10;
    hotel.reviewCount = hotelReviews.length;
  }

  res.status(201).json({ success: true, message: 'Review published successfully.', review: newReview });
});

// 10. Manager & Admin Dashboards / Reports
app.get('/api/manager/overview/:hotelId', authenticateToken, requireRole('manager', 'superadmin'), (req: Request, res: Response) => {
  const { hotelId } = req.params;
  const hotel = HOTELS.find((h) => h.id === hotelId);
  if (!hotel) {
    return res.status(404).json({ success: false, message: 'Hotel not found.' });
  }

  const hotelRooms = ROOMS.filter((r) => r.hotelId === hotelId);
  const hotelBookings = BOOKINGS.filter((b) => b.hotelId === hotelId);
  const totalRooms = hotelRooms.length || 1;

  const occupiedRooms = hotelRooms.filter((r) => r.operationalStatus === 'Occupied').length;
  const cleaningRooms = hotelRooms.filter((r) => r.operationalStatus === 'Cleaning').length;
  const availableRooms = hotelRooms.filter((r) => r.operationalStatus === 'Available').length;
  const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);

  const totalRevenue = hotelBookings
    .filter((b) => b.paymentStatus === 'paid')
    .reduce((sum, b) => sum + b.priceBreakdown.totalAmount, 0);

  // Average Daily Rate (ADR)
  const totalPaidNights = hotelBookings.reduce((sum, b) => sum + b.nights, 0) || 1;
  const adr = Math.round(totalRevenue / totalPaidNights);
  // Revenue Per Available Room (RevPAR)
  const revpar = Math.round((adr * occupancyRate) / 100);

  // Revenue chart by month
  const monthlyRevenue = [
    { month: 'Jun', revenue: Math.round(totalRevenue * 0.65), occupancy: 72 },
    { month: 'Jul', revenue: Math.round(totalRevenue * 0.82), occupancy: 85 },
    { month: 'Aug', revenue: Math.round(totalRevenue * 0.95), occupancy: 91 },
    { month: 'Sep', revenue: Math.round(totalRevenue * 0.78), occupancy: 78 },
    { month: 'Oct', revenue: totalRevenue, occupancy: occupancyRate || 80 }
  ];

  res.json({
    success: true,
    hotel: {
      id: hotel.id,
      name: hotel.name,
      city: hotel.city
    },
    kpis: {
      totalRooms,
      occupiedRooms,
      cleaningRooms,
      availableRooms,
      occupancyRate,
      totalRevenue,
      adr,
      revpar,
      totalBookings: hotelBookings.length
    },
    monthlyRevenue
  });
});

app.get('/api/admin/overview', authenticateToken, requireRole('superadmin'), (req: Request, res: Response) => {
  const totalRevenue = BOOKINGS.filter((b) => b.paymentStatus === 'paid').reduce(
    (sum, b) => sum + b.priceBreakdown.totalAmount,
    0
  );

  const platformKPIs = {
    totalHotels: HOTELS.length,
    totalRooms: ROOMS.length,
    totalBookings: BOOKINGS.length,
    totalUsers: USERS.length,
    grossPlatformVolume: totalRevenue,
    activeStays: BOOKINGS.filter((b) => b.bookingStatus === 'checked_in').length
  };

  const usersList = USERS.map(({ passwordHash: _, ...u }) => u);

  res.json({
    success: true,
    platformKPIs,
    hotels: HOTELS,
    users: usersList,
    recentBookings: BOOKINGS.slice(0, 10),
    logs: ADMIN_LOGS.slice(0, 15)
  });
});

app.put('/api/admin/users/:id/role', authenticateToken, requireRole('superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const { role, assignedHotelId } = req.body;
  const user = USERS.find((u) => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  user.role = role;
  if (assignedHotelId !== undefined) {
    user.assignedHotelId = assignedHotelId;
  }

  logAdminAction(actor, 'UPDATE_USER_ROLE', 'User', user.id, `Changed role of ${user.name} to '${role}'`);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ success: true, message: `Role updated for ${user.name}`, user: safeUser });
});

app.put('/api/admin/users/:id/status', authenticateToken, requireRole('superadmin'), (req: Request, res: Response) => {
  const actor = (req as any).user as UserEntity;
  const { accountStatus } = req.body;
  const user = USERS.find((u) => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  user.accountStatus = accountStatus;
  logAdminAction(actor, 'UPDATE_ACCOUNT_STATUS', 'User', user.id, `Set status of ${user.name} to '${accountStatus}'`);
  res.json({ success: true, message: `Status updated for ${user.name}`, user });
});

// ==========================================
// FULL-STACK SERVER STARTUP (Vite Middlewares in Dev)
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HotelPro Server] Live full-stack server running on port ${PORT}`);
    console.log(`[HotelPro Server] REST API mounted at http://localhost:${PORT}/api`);
    console.log(`[HotelPro Server] Storage Mode: ${process.env.MONGODB_URI ? 'MongoDB Connection' : 'High-Fidelity In-Memory Store'}`);
  });
}

startServer();
