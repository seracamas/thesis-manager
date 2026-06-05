# Database Fix Instructions

## You DON'T need to create a database manually!

IndexedDB is automatically created by your browser. The issue is a schema version conflict that can be easily fixed.

## Quick Fix (Recommended)

1. **Go to Settings** (click "Settings" in the sidebar)
2. **Scroll down to "Database" section**
3. **Click "Reset Database" button**
4. **Confirm twice** (it will warn you that all data will be deleted)
5. **Wait for the page to refresh automatically**

After the reset, your database will be recreated with the correct schema and everything will work!

## What Happened?

When we added the new "Planning" feature with interview requests, we needed to add a new table to the database. Your existing database had the old schema, and there was a conflict when trying to upgrade it.

## Will I Lose My Data?

**Yes, resetting the database will delete ALL your data** including:
- Sources
- Notes
- Interviews
- Data files
- Journal entries
- Drafts
- Themes
- Activity history
- Interview requests

**If you have important data, export it first:**
1. Go to Settings
2. Look for "Export Data" or "Backup" option
3. Save the JSON file
4. After reset, you can import it back

## Alternative: Manual Database Reset

If the reset button doesn't work, you can manually clear the database:

1. **Open Browser Developer Tools** (Press F12)
2. **Go to Application tab** (Chrome) or **Storage tab** (Firefox)
3. **Find "IndexedDB" in the left sidebar**
4. **Expand it and find "ResearchDatabase"**
5. **Right-click on "ResearchDatabase"**
6. **Select "Delete" or "Clear"**
7. **Refresh the page** (F5)

## After Reset

Once the database is reset:
- All features will work normally
- You can start adding data again
- The interview scheduler will work
- No more schema errors!
