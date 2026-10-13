# BazaarX (Meri Local Bazaar)

A modern, full-stack hyperlocal on-demand marketplace platform built with React, Vite, TypeScript, Tailwind CSS, Supabase Realtime, and Firebase.

## Features
- **Hyperlocal Customer Commerce**: Multi-shop local shopping with PIN-code based delivery validation, instant cart, and atomic multi-seller order placement.
- **Village Delivery Rate Resolver**: Dynamic delivery charges based on PIN code and destination village/locality.
- **Seller Hub**: Shop management, live order tracking, product catalog with real-time deletion (`supabase.from('products').delete()`), and earnings wallet ledger.
- **Delivery Partner Fleet**: Order dispatching, real-time OTP verification on drop-off, earnings wallet, and automated UPI payout requests.
- **Synthesized Real-Time Alerts**: Dual-tone Web Audio chimes (cash register double-chime for orders, dispatch siren for riders) plus native browser device push notifications (`Notification` API).
- **Partner Hub (Super Admin)**: Complete control over shops, delivery partners, orders, payout approvals, platform fees, and live delivery assignments.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Motion
- **Backend & Database**: Supabase (PostgreSQL with Realtime WebSockets), Firebase Firestore & Authentication
- **Deployment Target**: Vercel (Single Page Application with `vercel.json` rewrites)

## Environment Variables for Vercel
Set these in your **Vercel Project Settings > Environment Variables**:
- `VITE_SUPABASE_URL`: `https://nnytbwjnhmhusrbfycju.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `sb_publishable_LiilPJx72MCRVpSkc6b_UQ_NAP7EZLT`
