# Installation Guide

This document provides comprehensive setup instructions for the Svelte Google Maps application with performance optimizations and location services.

## Prerequisites

Before installing this application, ensure your system meets the following requirements:

### System Requirements

- **Node.js**: Version 18.0 or higher (LTS recommended)
- **npm**: Version 8.0 or higher (comes with Node.js)
- **Git**: Version 2.20 or higher
- **Modern Web Browser**: Chrome 88+, Firefox 85+, Safari 14+, or Edge 88+

### Browser Requirements

- **IndexedDB Support**: For persistent location storage
- **Geolocation API**: For GPS location services
- **ES6+ Support**: For modern JavaScript features
- **Service Worker Support**: For performance optimizations

### Google Maps API Requirements

- **Google Cloud Console Account**: For Maps JavaScript API access
- **API Key**: With Maps JavaScript API enabled
- **Domain Configuration**: API key configured for your domain

## Quick Start

### 1. Clone the Repository

```bash
# Clone the project repository
git clone <repository-url>
cd task-12f7b5f2-1a2d-4dfb-9408-3c6b4d4c8e1a

# Or if you have the project as a zip file
unzip project.zip
cd task-12f7b5f2-1a2d-4dfb-9408-3c6b4d4c8e1a
```

### 2. Install Dependencies

```bash
# Install all project dependencies
npm install

# Alternative package managers
# pnpm install
# yarn install
```

### 3. Environment Configuration

```bash
# Create environment configuration file
cp .env.example .env

# Edit the environment file with your Google Maps API key
# On Windows:
notepad .env

# On macOS/Linux:
nano .env
# or
vim .env
```

Add your Google Maps API key to the `.env` file:

```env
VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 4. Development Server

```bash
# Start the development server
npm run dev

# Start with automatic browser opening
npm run dev -- --open

# Start on specific port
npm run dev -- --port 3000

# Start with network access
npm run dev -- --host
```

The application will be available at:

- **Local**: http://localhost:5173
- **Network**: http://[your-ip]:5173 (if using --host)

## Production Deployment

### 1. Build for Production

```bash
# Create optimized production build
npm run build

# Verify build integrity
npm run check
```

### 2. Preview Production Build

```bash
# Preview the production build locally
npm run preview

# Preview on custom port
npm run preview -- --port 4173
```

### 3. Deploy to Production

#### Static Hosting (Recommended)

```bash
# Build for static deployment
npm run build

# The 'build' directory contains all static files
# Upload contents of 'build/' to your hosting provider
```

#### Docker Deployment

```dockerfile
# Create Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build Docker image
docker build -t svelte-maps-app .

# Run Docker container
docker run -p 80:80 svelte-maps-app
```

#### Node.js Server Deployment

```bash
# Install production dependencies
npm ci --only=production

# Build the application
npm run build

# Start the preview server (or use a process manager)
npm run preview

# For production with PM2
npm install -g pm2
pm2 start "npm run preview" --name "svelte-maps"
```

## Google Maps API Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable billing for the project

### 2. Enable Maps JavaScript API

```bash
# Using gcloud CLI (optional)
gcloud services enable maps-backend.googleapis.com
gcloud services enable maps-embed-backend.googleapis.com
gcloud services enable maps-frontend.googleapis.com
```

Or manually:

1. Navigate to "APIs & Services" > "Library"
2. Search for "Maps JavaScript API"
3. Click "Enable"

### 3. Create API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy the generated API key
4. (Recommended) Restrict the API key:
   - **Application restrictions**: HTTP referrers
   - **API restrictions**: Maps JavaScript API only

### 4. Configure API Key Restrictions

```bash
# Application restrictions (replace with your domains)
http://localhost:*
https://localhost:*
https://yourdomain.com/*
https://*.yourdomain.com/*

# API restrictions
Maps JavaScript API
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Required: Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Optional: Development Configuration
VITE_NODE_ENV=development
VITE_PORT=5173

# Optional: Application Configuration
VITE_APP_NAME=Svelte Maps Application
VITE_APP_VERSION=1.0.0

# Optional: Performance Monitoring
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=false

# Optional: Default Map Configuration
VITE_DEFAULT_MAP_CENTER_LAT=30.033
VITE_DEFAULT_MAP_CENTER_LNG=31.233
VITE_DEFAULT_MAP_ZOOM=10
```

## Development Commands

### Core Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Continuous type checking
npm run check:watch
```

### Code Quality Commands

```bash
# Format code with Prettier
npm run format

# Lint code with ESLint
npm run lint

# Fix linting issues automatically
npm run lint -- --fix

# Run all quality checks
npm run check && npm run lint
```

### Performance Analysis

```bash
# Build with bundle analysis
npm run build -- --analyze

# Run Lighthouse audit (requires Chrome)
npm run lighthouse

# Performance profiling
npm run profile
```

## Troubleshooting

### Common Issues

#### 1. Node.js Version Conflicts

```bash
# Check Node.js version
node --version

# Install Node Version Manager (nvm)
# Windows: https://github.com/coreybutler/nvm-windows
# macOS/Linux: https://github.com/nvm-sh/nvm

# Use correct Node.js version
nvm install 18
nvm use 18
```

#### 2. Package Installation Issues

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Use different package manager
npx pnpm install
# or
npx yarn install
```

#### 3. Google Maps API Issues

```bash
# Check API key in browser console
# Look for errors like:
# - "InvalidKeyMapError"
# - "RefererNotAllowedMapError"
# - "RequestDeniedMapError"

# Verify API key configuration
curl "https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY"
```

#### 4. Build Issues

```bash
# Clear build cache
rm -rf .svelte-kit build

# Clean and rebuild
npm run clean && npm run build

# Check for TypeScript errors
npm run check
```

#### 5. Performance Issues

```bash
# Check for memory leaks
node --inspect npm run dev

# Monitor build performance
npm run build -- --verbose

# Analyze bundle size
npm run build -- --analyze
```

### Environment-Specific Issues

#### Windows Issues

```powershell
# Enable execution policies for scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Use PowerShell instead of Command Prompt
# Install Windows Terminal for better experience
```

#### macOS Issues

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Fix permission issues
sudo chown -R $(whoami) ~/.npm
```

#### Linux Issues

```bash
# Install build essentials
sudo apt-get install build-essential

# Fix node-gyp issues
npm install -g node-gyp
```

## Performance Optimization

### Development Optimizations

```bash
# Enable fast refresh
export VITE_HMR=true

# Optimize development build
npm run dev -- --mode development.optimized

# Use SSD for node_modules
npm config set cache /path/to/ssd/cache
```

### Production Optimizations

```bash
# Enable all optimizations
npm run build -- --mode production

# Analyze bundle size
npm run build:analyze

# Generate performance report
npm run build:perf
```

## Security Considerations

### API Key Security

- Never commit API keys to version control
- Use environment variables for all secrets
- Restrict API keys to specific domains
- Monitor API usage regularly

### Application Security

```bash
# Audit dependencies for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Check for outdated packages
npm outdated
```

## Support and Resources

### Documentation

- [Project README](./README.md)
- [Performance Guide](./PERFORMANCE.md)
- [Implementation Strategies](./STRATEGIES.md)

### External Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [Vite Documentation](https://vitejs.dev/)

### Getting Help

1. Check the troubleshooting section above
2. Search existing issues in the project repository
3. Create a new issue with detailed information:
   - Node.js version (`node --version`)
   - npm version (`npm --version`)
   - Operating system
   - Error messages
   - Steps to reproduce

## Maintenance

### Regular Updates

```bash
# Check for package updates
npm outdated

# Update dependencies
npm update

# Update SvelteKit
npx @sveltejs/kit@latest update

# Update all packages to latest
npx npm-check-updates -u && npm install
```

### Health Checks

```bash
# Verify application health
npm run check && npm run lint && npm run build

# Performance benchmarking
npm run benchmark

# Security audit
npm audit && npm run security-check
```
