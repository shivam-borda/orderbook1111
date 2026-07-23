/**
 * migrate-ready-orders.js
 * 
 * One-time migration: sets type = 'ready' on the `orders` table
 * for all orders whose fabric_rows contain party_name = 'SHREENATH INDUSTRIES'.
 * 
 * Run once with:  node migrate-ready-orders.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) process.env[parts[0].trim()] = parts[1].trim();
  });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PARTY_NAME = 'SHREENATH INDUSTRIES';

async function run() {
  console.log('🔍 Fetching all fabric_rows for party:', PARTY_NAME);

  // 1. Find all order IDs that have SHREENATH INDUSTRIES in fabric_rows
  const { data: fabRows, error: fabErr } = await supabase
    .from('fabric_rows')
    .select('order_id')
    .ilike('party_name', PARTY_NAME);

  if (fabErr) {
    console.error('❌ Error fetching fabric_rows:', fabErr.message);
    process.exit(1);
  }

  const orderIds = [...new Set(fabRows.map(r => r.order_id))];
  console.log(`✅ Found ${orderIds.length} order(s) belonging to "${PARTY_NAME}":`, orderIds);

  if (orderIds.length === 0) {
    console.log('ℹ️  No orders to update. Exiting.');
    return;
  }

  // 2. Update type = 'ready' for those orders
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ type: 'ready' })
    .in('id', orderIds);

  if (updateErr) {
    console.error('❌ Error updating orders:', updateErr.message);
    console.log('');
    console.log('👉 IMPORTANT: If you get a column does not exist error, you need to');
    console.log('   add the "type" column to your Supabase "orders" table first:');
    console.log('');
    console.log('   Go to Supabase Dashboard → Table Editor → orders → Add Column:');
    console.log('   Name: type    Type: text    Default: pipeline');
    console.log('');
    process.exit(1);
  }

  console.log(`✅ Successfully marked ${orderIds.length} order(s) as type='ready'`);
}

run().catch(e => { console.error(e); process.exit(1); });
