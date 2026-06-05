# Authentication Guide

## Overview

The app now has password-based authentication. All routes are protected and require login to access.

## Default Login

**Default Password**: `thesis2024`

When you first open the app, you'll see a login page. Enter the default password to access the application.

## Changing Your Password

1. Log in with the default password
2. Navigate to **Settings** (in the sidebar)
3. Enter your current password
4. Enter your new password (minimum 6 characters)
5. Confirm your new password
6. Click "Change Password"

Your new password will be saved in your browser's localStorage.

## Security Notes

- **Password Storage**: Passwords are stored in browser localStorage (not encrypted)
- **Single User**: This is designed for single-user access
- **Session**: Your login persists until you log out or clear browser data
- **For Production**: Consider implementing proper authentication (OAuth, JWT, etc.) if you need multi-user support

## Logging Out

1. Go to **Settings**
2. Click the "Log Out" button

You'll be redirected to the login page.

## Resetting Password

If you forget your password:

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Local Storage** → your domain
4. Delete the `app-password` key
5. Refresh the page
6. Use the default password: `thesis2024`

## Important

⚠️ **Change the default password immediately after first login!**

The default password is visible in the code, so anyone with access to the codebase can see it. Change it to something secure.
