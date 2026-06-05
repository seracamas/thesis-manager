// Script to clear IndexedDB in browser console
// Run this in browser console if database is corrupted:
indexedDB.deleteDatabase('ResearchDatabase');
console.log('Database cleared. Refresh the page.');
