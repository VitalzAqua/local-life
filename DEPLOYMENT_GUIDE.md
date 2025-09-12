# 🚀 Local Life Platform - Complete Deployment Guide

## 📋 Overview
This guide will help you deploy your Local Life platform using free cloud services:

- **Database**: Neon (Free PostgreSQL)
- **Backend**: Railway (Free Node.js hosting)
- **Frontend**: Netlify (Free React hosting)

## 🗃️ Step 1: Database Setup with Neon

### 1.1 Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub (recommended) or email
3. Click "Create new project"

### 1.2 Configure Database
1. **Project Name**: `local-life-db`
2. **Database Name**: `local_life`
3. **Region**: Choose closest to your users
4. Click "Create Project"

### 1.3 Get Connection String
1. In your Neon dashboard, go to "Connection Details"
2. Copy the connection string (looks like):
   ```
   postgresql://username:password@host.neon.tech/local_life?sslmode=require
   ```
3. **Save this!** You'll need it for backend deployment

### 1.4 Initialize Database Schema
You'll need to run your SQL files on Neon:
1. Go to "SQL Editor" in Neon dashboard
2. Run the contents of your `backend/sql/` files in order:
   - `001_create_tables.sql`
   - `002_categories.sql` 
   - Any other SQL files

## 🖥️ Step 2: Backend Deployment with Railway

### 2.1 Prepare Your Repository
Make sure your code is pushed to GitHub with all recent changes.

### 2.2 Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `local-life` repository
6. Select "Deploy Now"

### 2.3 Configure Environment Variables
In Railway dashboard:
1. Go to your project → Variables
2. Add these environment variables:

```env
DATABASE_URL=your_neon_connection_string_here
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-app-name.netlify.app
ADMIN_CODE=780523
JWT_SECRET=your-super-secret-random-string-here
```

**Important**: 
- Replace `your_neon_connection_string_here` with your actual Neon URL
- Replace `your-app-name.netlify.app` with your future Netlify domain
- Generate a strong JWT_SECRET (use [random string generator](https://www.random.org/strings/))

### 2.4 Set Build Configuration
Railway should auto-detect Node.js. If not:
1. Go to Settings → Deploy
2. Set **Root Directory**: `backend`
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`

### 2.5 Get Backend URL
After deployment, Railway will give you a URL like:
`https://your-app-name.up.railway.app`

**Save this URL!** You'll need it for frontend configuration.

## 🌐 Step 3: Frontend Deployment with Netlify

### 3.1 Create Environment File
Create `.env.production` in your `frontend/` directory:

```env
REACT_APP_API_URL=https://your-railway-backend-url
NODE_ENV=production
```

Replace `your-railway-backend-url` with your actual Railway backend URL.

### 3.2 Deploy on Netlify
1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click "New site from Git"
4. Choose your repository
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/build`

### 3.3 Configure Environment Variables
In Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add:
   - `REACT_APP_API_URL`: Your Railway backend URL
   - `NODE_ENV`: `production`

### 3.4 Enable Continuous Deployment
Netlify will automatically redeploy when you push to GitHub!

## 🔧 Step 4: Update CORS Settings

Once you have your Netlify URL (like `https://amazing-app-123.netlify.app`):

1. Go back to Railway dashboard
2. Update the `CORS_ORIGIN` environment variable with your Netlify URL
3. Restart your Railway deployment

## 🧪 Step 5: Testing Your Deployment

### 5.1 Test Backend Health
Visit: `https://your-railway-url/api/health`

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production"
}
```

### 5.2 Test Frontend
1. Visit your Netlify URL
2. Try searching for stores
3. Test user registration/login
4. Place a test order

## 🔒 Step 6: Security & Performance

### 6.1 Environment Security
- Never commit `.env` files to Git
- Use strong, unique passwords
- Regularly rotate JWT secrets

### 6.2 Database Security
- Neon provides SSL by default ✅
- Monitor connection limits (Neon free tier: 100 connections)

### 6.3 Performance Optimization
- Railway free tier: 500 hours/month
- Netlify free tier: 100GB bandwidth/month
- Consider upgrading if you exceed limits

## 🚨 Troubleshooting

### Common Issues:

1. **CORS Errors**: 
   - Check `CORS_ORIGIN` matches your Netlify URL exactly
   - Include `https://` in the URL

2. **Database Connection Failed**:
   - Verify Neon connection string
   - Check if database is active in Neon dashboard

3. **Frontend Can't Reach Backend**:
   - Check `REACT_APP_API_URL` environment variable
   - Ensure Railway app is running

4. **Build Failures**:
   - Check build logs in Railway/Netlify
   - Ensure all dependencies are in `package.json`

### Logs and Debugging:
- **Railway**: View logs in project dashboard
- **Netlify**: Check deploy logs in site dashboard
- **Neon**: Query history in SQL editor

## 🎉 Step 7: Going Live!

### 7.1 Custom Domain (Optional)
- **Netlify**: Add custom domain in Site settings
- **Railway**: Configure custom domain in project settings

### 7.2 SSL Certificates
- Both Netlify and Railway provide free SSL ✅

### 7.3 Monitoring
- Set up uptime monitoring (UptimeRobot is free)
- Monitor error logs regularly

## 💰 Cost Breakdown (Free Tiers)

| Service | Free Limits | Upgrade Cost |
|---------|-------------|--------------|
| Neon | 500MB storage, 100 connections | $19/month for more |
| Railway | 500 hours/month, 1GB RAM | $5/month for unlimited |
| Netlify | 100GB bandwidth, 300 build minutes | $19/month for more |

## 🎯 Next Steps

After deployment:
1. Set up monitoring and alerts
2. Configure backups (Neon has automatic backups)
3. Set up a CI/CD pipeline
4. Consider performance monitoring (Sentry, LogRocket)
5. Plan for scaling when you grow!

---

🎉 **Congratulations!** Your Local Life platform is now live and ready for users!

For questions or issues, check the troubleshooting section above or review service documentation:
- [Neon Docs](https://neon.tech/docs)
- [Railway Docs](https://docs.railway.app)
- [Netlify Docs](https://docs.netlify.com) 