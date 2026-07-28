/**
 * migrate-status-column.js
 * 
 * One-time setup script info for adding the `status` column to the Supabase `orders` table.
 */

console.log('--------------------------------------------------');
console.log('📌 Supabase Database Migration SQL Instructions');
console.log('--------------------------------------------------');
console.log('');
console.log('To permanently store order status (open/closed) in Supabase PostgreSQL:');
console.log('');
console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
console.log('2. Open your project → SQL Editor');
console.log('3. Run the following SQL command:');
console.log('');
console.log("   ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'open';");
console.log('');
console.log('--------------------------------------------------');
