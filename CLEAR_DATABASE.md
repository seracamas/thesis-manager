# Clear Database Instructions

If you encounter a "ConstraintError: An index with the specified name already exists" error, follow these steps:

## Quick Fix

1. Open your browser's Developer Console (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Run this command:
   ```javascript
   indexedDB.deleteDatabase('ResearchDatabase')
   ```
4. Refresh the page (F5 or Cmd+R)

The database will be recreated automatically with the correct schema.

## What This Does

This clears the IndexedDB database and allows it to be recreated with the correct schema. **Note: This will delete all your saved data** (sources, notes, interviews, etc.), so make sure to export your data first if you have important information.

## Export Data First (Recommended)

Before clearing the database, export your data:

1. Go to Settings in the app
2. Click "Export Data" to download a backup
3. Then follow the clear database steps above
4. After refreshing, you can import your data back from the backup file
