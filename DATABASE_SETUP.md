# 🗄️ Database Setup Guide

## Your Neon Database Configuration

**Connection String**: 
```postgresql://neondb_owner:npg_JcXhu4D5BpzS@ep-ancient-bird-a59vx2lc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## 🚀 Quick Database Setup

### Step 1: Access Neon SQL Editor
1. Go to [console.neon.tech](https://console.neon.tech)
2. Select your project
3. Click on "SQL Editor"

### Step 2: Run SQL Files in Order

Copy and paste each SQL block below into the Neon SQL Editor and run them **in this exact order**:

#### 1️⃣ **Create Main Tables** (Run First)
```sql
-- Create stores table
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  attributes JSONB
);
CREATE INDEX idx_stores_location ON stores USING GIST(location);
CREATE INDEX idx_stores_category ON stores(category);
```

#### 2️⃣ **Create User & Order Tables** (Run Second)
```sql
-- Users table for customer accounts
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table for store orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    store_id INTEGER REFERENCES stores(id),
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Order items for items in each order
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    notes TEXT
);

-- Reservations table for store reservations
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    store_id INTEGER REFERENCES stores(id),
    reservation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    party_size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_store_id ON reservations(store_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
```

#### 3️⃣ **Create Delivery System** (Run Third)
```sql
-- Create drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    car TEXT NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create deliveries table
CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id),
    order_type TEXT NOT NULL CHECK (order_type IN ('eat_in', 'delivery')),
    customer_location TEXT, -- For delivery orders
    estimated_completion_time TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample drivers
INSERT INTO drivers (name, age, car, is_available) VALUES
('John Smith', 28, 'Honda Civic', true),
('Sarah Johnson', 32, 'Toyota Corolla', true),
('Mike Chen', 25, 'Nissan Sentra', true),
('Emily Davis', 29, 'Ford Focus', true),
('Alex Brown', 31, 'Mazda 3', true);

-- Create indexes for better performance
CREATE INDEX idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX idx_drivers_available ON drivers(is_available);
```

#### 4️⃣ **Add Sample Store Data** (Optional - Run Last)
⚠️ **Warning**: This is a large file (6000+ stores). Only run if you want sample data.

If you want sample stores, go to your project folder and copy the contents of `backend/sql/1000_stores.sql` into the SQL Editor.

## ✅ Verification

After running the SQL commands, verify your setup by running:

```sql
-- Check if all tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check sample data
SELECT COUNT(*) as store_count FROM stores;
SELECT COUNT(*) as driver_count FROM drivers;
```

You should see:
- **Tables**: `deliveries`, `drivers`, `order_items`, `orders`, `reservations`, `stores`, `users`
- **Drivers**: 5 sample drivers
- **Stores**: 0 (or 6000+ if you loaded sample data)

## 🔧 Environment Variables

Update your `backend/.env` file with:

```env
# Database Configuration (Use your Neon connection string)
DATABASE_URL=postgresql://neondb_owner:npg_JcXhu4D5BpzS@ep-ancient-bird-a59vx2lc-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Security
ADMIN_CODE=780523
JWT_SECRET=your-super-secret-random-string-here
```

## 🚀 Ready to Deploy!

Once your database is set up:

1. **Local Testing**: Use the connection string in your local `.env` file
2. **Railway Deployment**: Add the same connection string to Railway environment variables
3. **Production**: Your app will connect to the same Neon database from anywhere!

---

**Next Steps**: Follow the [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) to deploy your backend and frontend! 