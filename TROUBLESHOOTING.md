# Troubleshooting Guide

## Issue: Blank Page on localhost

### Common Causes and Solutions

#### 1. Dependencies Not Installed
**Symptom**: Blank page, console errors about missing modules

**Solution**:
```bash
cd "/Users/seracamas/untitled folder"
npm install
```

#### 2. Browser Console Errors
**Check**: Open browser DevTools (F12 or Cmd+Option+I) and check the Console tab

**Common errors**:
- **"Cannot read property of undefined"**: Usually means a component import failed
- **"useNavigate() may be used only in the context of a Router component"**: Fixed in latest App.tsx
- **"Module not found"**: Run `npm install` again

#### 3. Port Already in Use
**Symptom**: Dev server won't start or shows port conflict

**Solution**:
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

#### 4. Build Errors
**Check**: Look at terminal output when running `npm run dev`

**Common fixes**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

#### 5. IndexedDB Issues
**Symptom**: App loads but data doesn't persist

**Solution**: 
- Check browser console for IndexedDB errors
- Clear browser storage: DevTools → Application → Storage → Clear site data
- Try in incognito/private mode

#### 6. React Router Issues
**Symptom**: Routes not working, 404 errors

**Solution**: 
- Ensure you're accessing `http://localhost:5173/` (not a subdirectory)
- Check that all routes are properly defined in App.tsx

### Debugging Steps

1. **Check Terminal Output**:
   ```bash
   npm run dev
   ```
   Look for any error messages or warnings

2. **Check Browser Console**:
   - Open DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

3. **Check React DevTools**:
   - Install React DevTools browser extension
   - Check component tree and props

4. **Verify Installation**:
   ```bash
   node --version  # Should be 18+
   npm --version   # Should be 9+
   ```

5. **Fresh Start**:
   ```bash
   # Remove all dependencies and reinstall
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

### Still Not Working?

1. **Check if dev server is running**:
   - Terminal should show: `Local: http://localhost:5173/`
   - If not, there's a build error

2. **Try a different browser**:
   - Chrome/Edge
   - Firefox
   - Safari

3. **Check file permissions**:
   ```bash
   ls -la "/Users/seracamas/untitled folder"
   ```

4. **Verify all files exist**:
   ```bash
   ls -la "/Users/seracamas/untitled folder/src"
   ```

### Getting Help

If none of these work, please provide:
1. Terminal output from `npm run dev`
2. Browser console errors (screenshot or copy/paste)
3. Node.js version: `node --version`
4. npm version: `npm --version`
