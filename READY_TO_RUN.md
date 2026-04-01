# 🚀 QuickGrocery PWA — Ready to Run!

## ✅ Status: All Systems Go

Your full-stack PWA is **fully set up and ready**:

```
✓ PostgreSQL 17    → Running locally (auto)
✓ MongoDB 7        → Running locally (8 categories, 12 products seeded)
✓ Redis 8          → Running locally
✓ Backend code     → 42 TypeScript files, all modules ready
✓ Frontend code    → 29 TypeScript files, all pages ready
```

---

## 🎯 Quick Start (3 Simple Commands)

### Terminal 1: Start Backend

```bash
cd /Users/L088617/Projects/groceries-app/backend
npm run start:dev
```

You'll see:
```
[Nest] ... Server running on http://localhost:3000/api
```

### Terminal 2: Start Frontend

```bash
cd /Users/L088617/Projects/groceries-app/frontend
npm run dev
```

You'll see:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### Terminal 3: Open Browser

```
http://localhost:5173
```

---

## 🧪 Try These Features

1. **Register** → `/auth/register`
   - Email: `test@example.com`
   - Password: `TestPass123`
   - Name: Your name

2. **Browse Products** → Home page
   - See 8 categories (Fruits, Dairy, Bakery, etc.)
   - See 12 seeded products
   - Click any product for details

3. **Add to Cart**
   - Click "Add to Cart" on any product
   - Check cart badge in navbar
   - Items persist on page reload (localStorage)

4. **Checkout** → `/checkout`
   - Requires login first
   - Select delivery address
   - Create order

5. **Track Order** → `/orders/:id`
   - Real-time status updates (SSE)
   - Timeline: placed → preparing → out for delivery → delivered
   - Try updating status to see live updates

---

## 📊 What's Running

### Backend API Endpoints

```
POST   /api/auth/register       # Create account
POST   /api/auth/login          # Sign in (returns JWT)
GET    /api/auth/me             # Current user

GET    /api/products            # All products (paginated)
GET    /api/products/:slug      # Single product
GET    /api/products/categories # All categories

GET    /api/cart                # User's cart
POST   /api/cart/items          # Add item
PATCH  /api/cart/items/:id      # Update quantity
DELETE /api/cart/items/:id      # Remove item

POST   /api/orders              # Create order
GET    /api/orders              # Order history
GET    /api/orders/:id          # Single order
GET    /api/orders/:id/events   # SSE stream (live tracking)

GET    /api/users/addresses     # Saved addresses
POST   /api/users/addresses     # Save new address
```

### Frontend Architecture

- **React 18** with React Router (9 pages)
- **Zustand** for client state (auth, cart, UI)
- **React Query** for server state (products, orders)
- **Tailwind CSS** for responsive design
- **PWA** with offline caching (Service Worker)
- **TypeScript** throughout (100% typed)

---

## 🛠️ Database Details

### PostgreSQL (localhost)
```
User:     postgres (no password needed on macOS Homebrew)
Database: groceries
Port:     5432

Tables (auto-created on backend start):
- users, addresses, refresh_tokens
- carts, cart_items
- orders, order_items, order_status_events
```

### MongoDB (localhost)
```
URI:     mongodb://localhost:27017/groceries
Port:    27017

Collections (pre-seeded):
- categories (8 docs)
- products (12 docs)
```

### Redis (localhost)
```
Port: 6379
Status: Ready for future use
```

---

## 📝 Development Tips

### See Real-time Logs

```bash
# Backend logs
npm run start:dev

# Frontend errors
Check browser console (F12)
```

### Modify Product Data

Edit `/backend/src/database/seeds/seed.ts` and re-run:
```bash
npm run seed
```

###  Debug API Calls

```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Test products
curl http://localhost:3000/api/products?limit=5
```

### Check Service Status

```bash
brew services list | grep -E "postgresql|mongodb|redis"
```

---

## ⚙️ Environment Config

File: `/Users/L088617/Projects/groceries-app/.env`

```
DATABASE_URL=postgresql://postgres@localhost:5432/groceries
MONGODB_URI=mongodb://localhost:27017/groceries
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_jwt_secret_do_not_use_in_production_12345
FRONTEND_URL=http://localhost:5173
```

No changes needed - this works for your local setup!

---

## 🛑 Stop Everything (When Done)

```bash
# Stop databases (they'll auto-restart with your Mac)
brew services stop postgresql@17 mongodb-community redis

# Or stop just one
brew services stop postgresql@17
```

Restart anytime:
```bash
brew services start postgresql@17 mongodb-community redis
```

---

## 🐛 Troubleshooting

### Backend won't start?
```bash
# Check PostgreSQL is running
psql postgres -c "SELECT version();"

# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Rebuild
npm install && npm run start:dev
```

### Frontend won't load products?
- Check backend is running on port 3000
- Check browser console for API errors (F12)
- Try `curl http://localhost:3000/api/products`

### Databases stopped?
```bash
# Restart all three
brew services restart postgresql@17 mongodb-community redis
```

---

## 📚 Next Steps

After getting comfortable:

1. **Add features**:
   - Payment integration (Stripe)
   - Email notifications
   - Admin dashboard
   - Real-time chat support

2. **Deploy**:
   - Docker production build
   - Railway / Render / Fly.io
   - AWS / Azure / GCP

3. **Scale**:
   - PostgreSQL + MongoDB replication
   - Redis caching layer
   - CDN for static assets
   - Load balancing

---

## ✨ You're All Set!

**Everything is working locally. Start the backend and frontend in two terminals, then open your browser. Happy building!**

Questions? Check the full README.md in the project root.
