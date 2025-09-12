# 🏪 Local Life Platform

A full-stack web application for discovering and interacting with local businesses - restaurants, stores, and services. Built with React, Node.js, Express, and PostgreSQL.

![Local Life Platform](https://img.shields.io/badge/Status-Ready%20for%20Deployment-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![React](https://img.shields.io/badge/React-18-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-blue)

## ✨ Features

- 🗺️ **Interactive Map** with store locations and category filtering
- 🔍 **Smart Search** by name, category, or products
- 👤 **User Authentication** with secure login/registration
- 🛒 **Order Management** for restaurants and stores
- 📅 **Reservation System** for appointments and bookings
- 📱 **Responsive Design** works on desktop and mobile
- 🚚 **Delivery System** with driver assignment
- 👨‍💼 **Admin Dashboard** for managing orders and reservations
- 📊 **Order History** tracking for users
- 🎨 **Modern UI** with React Icons and beautiful styling

## 🚀 Quick Setup Guide

### Prerequisites

Before you start, make sure you have these installed on your computer:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **PostgreSQL** (version 13 or higher) - [Download here](https://www.postgresql.org/download/)
- **Git** (optional, but recommended) - [Download here](https://git-scm.com/)

### 📥 Step 1: Download and Extract

1. **Download** this project as a ZIP file from GitHub
2. **Extract** the ZIP file to a folder on your computer
3. **Open terminal/command prompt** and navigate to the extracted folder:
   ```bash
   cd path/to/local-life
   ```

### 🗄️ Step 2: Database Setup

1. **Start PostgreSQL** on your computer
2. **Create a new database**:
   ```sql
   CREATE DATABASE local_life;
   ```
3. **Run the database setup**:
   ```bash
   # Navigate to backend folder
   cd backend
   
   # Install dependencies first
   npm install
   
   # Run SQL files to create tables
   # Copy and paste the contents of these files into your PostgreSQL client:
   # - sql/001_create_tables.sql
   # - sql/002_categories.sql
   # - Any other SQL files in the sql/ folder
   ```

### ⚙️ Step 3: Environment Configuration

1. **Backend Configuration**:
   ```bash
   # In the backend folder, create a .env file
   cd backend
   ```
   
   Create a file named `.env` with this content:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/local_life
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:3000
   
   # Security
   ADMIN_CODE=780523
   JWT_SECRET=your-super-secret-random-string-here
   ```
   
   **Replace**:
   - `username` and `password` with your PostgreSQL credentials
   - `your-super-secret-random-string-here` with a random string

2. **Frontend Configuration**:
   ```bash
   # In the frontend folder, create a .env file
   cd ../frontend
   ```
   
   Create a file named `.env` with this content:
   ```env
   REACT_APP_API_URL=http://localhost:3001
   ```

### 📦 Step 4: Install Dependencies

```bash
# From the root folder (local-life)
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 🎯 Step 5: Run the Application

**Option 1: Run both frontend and backend together (Recommended)**
```bash
# From the root folder
npm run dev
```

**Option 2: Run them separately**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (in a new terminal window)
cd frontend
npm start
```

### 🌐 Step 6: Access Your Application

- **Frontend**: Open [http://localhost:3000](http://localhost:3000) in your browser
- **Backend API**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

## 👤 Getting Started

### Create Your First User
1. Go to [http://localhost:3000](http://localhost:3000)
2. Click "Sign Up" to create an account
3. Fill in your details and register

### Admin Access
- Use admin code: `780523` during registration for admin privileges
- Access admin dashboard after logging in as admin

### Test the Features
1. **Search for stores** using the search bar
2. **Filter by categories** using the checkboxes
3. **Click on map markers** to view store details
4. **Place orders** at restaurants
5. **Make reservations** at service businesses

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Run both frontend and backend
npm run dev:backend      # Run only backend
npm run dev:frontend     # Run only frontend

# Installation
npm run install:all      # Install all dependencies
npm run install:backend  # Install backend dependencies
npm run install:frontend # Install frontend dependencies

# Production
npm run build           # Build frontend for production
npm start              # Start backend in production mode
```

## 📁 Project Structure

```
local-life/
├── README.md                 # This file
├── DEPLOYMENT_GUIDE.md       # How to deploy to cloud
├── QUICK_START.md           # Quick deployment guide
├── package.json             # Root dependencies
├── netlify.toml             # Frontend deployment config
│
├── backend/                 # Node.js/Express API
│   ├── index.js            # Server entry point
│   ├── package.json        # Backend dependencies
│   ├── config/             # Configuration files
│   ├── routes/             # API endpoints
│   ├── middleware/         # Custom middleware
│   ├── sql/               # Database schema files
│   └── .env               # Environment variables (create this)
│
└── frontend/               # React application
    ├── package.json        # Frontend dependencies
    ├── public/            # Static assets
    ├── src/               # React source code
    │   ├── components/    # React components
    │   ├── config/        # API configuration
    │   ├── services/      # API services
    │   ├── utils/         # Utility functions
    │   └── App.js         # Main React component
    └── .env               # Environment variables (create this)
```

## 🚨 Troubleshooting

### Common Issues:

**1. "Cannot connect to database"**
- Make sure PostgreSQL is running
- Check your database credentials in `backend/.env`
- Ensure the database `local_life` exists

**2. "Port 3000 is already in use"**
- Close other applications using port 3000
- Or change the port in `frontend/package.json`

**3. "Module not found" errors**
- Run `npm install` in both backend and frontend folders
- Make sure you're using Node.js version 18 or higher

**4. "CORS errors" in browser**
- Check that `CORS_ORIGIN` in `backend/.env` matches your frontend URL
- Make sure both servers are running

**5. Search/Map not working**
- Check that the backend is running on port 3001
- Verify the database has been set up with the SQL files

### Getting Help:

1. Check the browser console for error messages
2. Check terminal/command prompt for server errors
3. Verify all environment variables are set correctly
4. Make sure all dependencies are installed

## 🌐 Deploy to Production

Ready to deploy your Local Life platform to the web? Check out our deployment guides:

- **📋 [Complete Deployment Guide](DEPLOYMENT_GUIDE.md)** - Step-by-step instructions
- **⚡ [Quick Start Guide](QUICK_START.md)** - 5-minute deployment

### Free Hosting Options:
- **Database**: [Neon](https://neon.tech) (Free PostgreSQL)
- **Backend**: [Railway](https://railway.app) (Free Node.js hosting)
- **Frontend**: [Netlify](https://netlify.com) (Free React hosting)

## 🤝 Contributing

This is an open-source project! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Icons provided by [React Icons](https://react-icons.github.io/react-icons/)
- Maps powered by [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/)

---

## 🎉 You're All Set!

Your Local Life platform should now be running locally. Explore the features, customize it to your needs, and when you're ready, deploy it to the cloud!

**Happy coding!** 🚀

---

*Need help? Check the troubleshooting section above or open an issue on GitHub.* 