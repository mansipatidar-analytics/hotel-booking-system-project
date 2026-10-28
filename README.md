# HotelPro India — Luxury Hotel Booking and Management System

**HotelPro India** is a full-stack, enterprise-grade hospitality management system specifically customized and localized for the **Indian hospitality market**. It features authentic Indian luxury destinations, Indian Rupee (`INR` / `₹`) pricing with realistic luxury tariffs, statutory 18% GST (9% CGST + 9% SGST), UPI and Razorpay payment options, Indian phone verification (`+91`), and strict 4-role governance.

---

## 🇮🇳 Key Indian Regional Localizations

1. **Authentic Indian Luxury Sanctuaries**:
   - **The Grand Lake Palace & Royal Heritage Sanctuary**, Lake Pichola, Udaipur, Rajasthan (₹16,500 – ₹62,000/night)
   - **The Leela Oceanfront Beach Resort & Private Villas**, Candolim Beach, Goa (₹22,000 – ₹58,000/night)
   - **The Himalayan Pine Sanctuary & Spa**, Naggar Road, Manali, Himachal Pradesh (₹18,000 – ₹45,000/night)
2. **Indian Rupee Currency (`₹` / `INR`)**:
   - All room tariffs, seasonal multipliers, resort fees, and invoices are quoted in `₹` formatted according to Indian numeral standards (`₹24,500`).
3. **Statutory 18% Hospitality GST (SAC Code 996311)**:
   - Full automated compliance with Section 31 of CGST Act, 2017.
   - Calculates 9% Central GST (CGST) and 9% State GST (SGST) per reservation.
   - Generates official GST Tax Folios with State Code, Place of Supply, and GSTIN: `08AAACH1234F1Z5`.
4. **Indian Mobile Verification (`+91`)**:
   - Guest and staff phone numbers conform to the 10-digit Indian standard prefixed with `+91` (e.g. `+91 98765 43210`).
5. **Indian Payment Gateways**:
   - Instant Virtual Payment Address (VPA / UPI) verification for Google Pay, PhonePe, Paytm, and BHIM.
   - Razorpay gateway sandbox for Net Banking and Indian Debit/Credit cards.
6. **Indian Concierge & In-Room Services**:
   - Kadak Masala Chai & Rajasthani Pyaaz Kachori
   - Ayurvedic Herbal Spa (Abhyanga Full-Body Massage)
   - Complimentary Sunset Lake Pichola Shikara Boat Transfers

---

## 👥 Four-Tier Role Governance & Personas

| Role | Indian Demo Persona | Mobile (+91) | Email | Primary Responsibilities |
|---|---|---|---|---|
| **Guest** | Aarav Sharma | `+91 98765 43210` | `aarav.sharma@example.com` | Search luxury sanctuaries, book rooms, view GST Tax Folios, request concierge services. |
| **Front Desk Staff** | Priya Patel | `+91 98765 43212` | `priya.staff@hotelpro.in` | Verify Aadhaar/Govt photo ID, process check-in/check-out, manage arrivals. |
| **Hotel Manager** | Vikramaditya Rao | `+91 98765 43211` | `vikram.manager@hotelpro.in` | Monitor INR revenue analytics, RevPAR, ADR, adjust suite tariffs, manage inventory. |
| **Super Admin** | Rajesh Verma | `+91 98765 43213` | `rajesh.admin@hotelpro.in` | National platform oversight, gross volume tracking, statutory GST logs, user auditing. |

---

## 🛠 Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React, Recharts
- **Backend**: Express.js REST API, JSON Web Tokens (JWT), bcrypt password hashing
- **Database Architecture**: Mongoose schemas with dual-mode MongoDB Atlas persistence & self-contained in-memory fallback
- **Testing**: Node.js test runner (`node:test`) for atomic date locking, Indian phone normalization, and 18% GST tax calculation.

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Run unit tests for booking engine & Indian GST
npx tsx --test src/utils/bookingEngine.test.ts

# Start the full-stack development server (Port 3000)
npm run dev
```

---

## 📜 Statutory GST Compliance Notice
HotelPro India complies with Ministry of Tourism hospitality guidelines and the Central Goods and Services Tax Act, 2017. All invoices issued display SAC 996311 (Accommodation in Hotels, Inns, and Guest Houses).
