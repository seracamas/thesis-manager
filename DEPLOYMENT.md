# Deployment Guide

This guide covers deploying the Thesis Research Manager application to various platforms.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git repository (for version control)

## Build for Production

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build locally
npm run preview
```

The production build will be in the `dist` directory.

## Deployment Options

### Vercel (Recommended)

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   Or connect your GitHub repository to Vercel for automatic deployments.

3. **Configuration**:
   - The `vercel.json` file is already configured
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework: Vite

### Netlify

1. **Install Netlify CLI** (optional):
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod
   ```
   Or connect your GitHub repository to Netlify.

3. **Configuration**:
   - The `netlify.toml` file is already configured
   - Build command: `npm run build`
   - Publish directory: `dist`

### GitHub Pages

1. **Install gh-pages**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json**:
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     }
   }
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

4. **Update vite.config.ts**:
   ```typescript
   export default defineConfig({
     base: '/your-repo-name/',
     // ... rest of config
   })
   ```

### Docker

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine as build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=build /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create nginx.conf**:
   ```nginx
   server {
     listen 80;
     server_name localhost;
     root /usr/share/nginx/html;
     index index.html;

     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```

3. **Build and run**:
   ```bash
   docker build -t thesis-manager .
   docker run -p 80:80 thesis-manager
   ```

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
# API Keys (if needed)
VITE_API_KEY=your_api_key_here

# Feature Flags
VITE_ENABLE_ANALYTICS=false
```

**Note**: Environment variables must be prefixed with `VITE_` to be accessible in the browser.

## Performance Optimization

The build is already optimized with:
- Code splitting (React Router, Tiptap, utilities)
- Tree shaking
- Minification
- Asset optimization

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Build Errors

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist && npm run build`

### Routing Issues

- Ensure your hosting provider is configured for SPA routing (all routes redirect to index.html)
- Check `vercel.json` or `netlify.toml` for redirect rules

### Environment Variables Not Working

- Ensure variables are prefixed with `VITE_`
- Restart dev server after adding new variables
- Rebuild for production after changes

## Post-Deployment

1. Test all functionality
2. Verify IndexedDB works (data persists)
3. Check responsive design on mobile devices
4. Test keyboard shortcuts
5. Verify dark mode toggle
6. Test export/import functionality
