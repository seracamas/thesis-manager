# Manual Database Fix Instructions

If the "Reset Database" button in Settings doesn't work, follow these steps to manually delete the database:

## Step-by-Step Instructions

### For Chrome/Edge:
1. **Press F12** (or right-click → Inspect)
2. **Click the "Application" tab** at the top
3. **In the left sidebar**, expand **"Storage"**
4. **Expand "IndexedDB"**
5. **Find "ResearchDatabase"**
6. **Right-click on "ResearchDatabase"**
7. **Select "Delete"**
8. **Refresh the page** (F5 or click the refresh button)

### For Firefox:
1. **Press F12** (or right-click → Inspect)
2. **Click the "Storage" tab** at the top
3. **In the left sidebar**, expand **"IndexedDB"**
4. **Find "ResearchDatabase"**
5. **Right-click on "ResearchDatabase"**
6. **Select "Delete All"**
7. **Refresh the page** (F5 or click the refresh button)

### For Safari:
1. **Enable Developer Menu**: Safari → Preferences → Advanced → Check "Show Develop menu"
2. **Press Cmd+Option+I** (or Develop → Show Web Inspector)
3. **Click the "Storage" tab**
4. **Expand "IndexedDB"**
5. **Find "ResearchDatabase"**
6. **Right-click and Delete**
7. **Refresh the page**

## After Deleting:

1. The page will automatically reload
2. The database will be recreated with the correct schema
3. You can now create interview requests without errors
4. All features will work normally

## Alternative: Clear All Site Data

If the above doesn't work, you can clear all site data:

1. **Press F12** → **Application** tab
2. **Click "Clear site data"** button (or "Clear storage")
3. **Check all boxes**
4. **Click "Clear site data"**
5. **Refresh the page**

**Note**: This will also clear your login session, so you'll need to log in again.
