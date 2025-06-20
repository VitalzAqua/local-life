# ⚡ Quick Start Guide

## 🚀 Want to deploy your Local Life platform quickly? Follow these steps:

### Prerequisites
- GitHub account
- Basic understanding of web development
- Your code committed to a GitHub repository

### 🎯 5-Minute Deployment

1. **Database (2 minutes)**
   - Go to [neon.tech](https://neon.tech) → Sign up → Create project
   - Copy your connection string

2. **Backend (2 minutes)** 
   - Go to [railway.app](https://railway.app) → Connect GitHub → Deploy
   - Add environment variables (DATABASE_URL, NODE_ENV=production, etc.)

3. **Frontend (1 minute)**
   - Go to [netlify.com](https://netlify.com) → New site from Git
   - Set build directory to `frontend` and publish directory to `frontend/build`

### 🎉 That's it! Your app is live!

For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 💻 Local Development

### First Time Setup
```bash
# Install all dependencies
npm run install:all

# Start development servers
npm run dev
```

### URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health Check: http://localhost:3001/api/health

### Test User
- Email: `admin@example.com`
- Password: Create during registration
- Admin Code: `780523` (for admin access)

---

## 🛠️ Development Commands

```bash
# Development (both frontend and backend)
npm run dev

# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend

# Production build
npm run build

# Install dependencies
npm run install:all
```

---

## 📁 Project Structure

```
local-life/
├── backend/           # Node.js/Express API
│   ├── routes/       # API routes
│   ├── config/       # Configuration
│   ├── sql/          # Database schema
│   └── index.js      # Server entry point
├── frontend/          # React application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── build/        # Production build
└── docs/             # Documentation
```

---

## 🆘 Need Help?

1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions
2. Review logs in your deployment platforms
3. Test locally first: `npm run dev`
4. Check environment variables are set correctly

---

Happy coding! 🎉 