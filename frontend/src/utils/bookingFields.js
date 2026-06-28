export const TIME_KEYS  = ['appointment_time','booking_time','time','slot','appointment_date','booking_date','date','order_date','created_at'];
export const NAME_KEYS  = ['customer_name','name','full_name','patient_name','client_name','visitor_name','user_name'];
export const PHONE_KEYS = ['customer_phone','phone','phone_number','mobile','contact','contact_number'];
export const EMAIL_KEYS = ['customer_email','email','email_address','user_email','visitor_email','client_email','patient_email'];

export function pick(row, keys) {
  // exact key match first
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]);
  }
  return null;
}

export function pickEmail(row) {
  // try known keys first
  const exact = pick(row, EMAIL_KEYS);
  if (exact) return exact;
  // fallback: any key that contains 'email'
  const fallbackKey = Object.keys(row).find(k => k.toLowerCase().includes('email') && row[k]);
  return fallbackKey ? String(row[fallbackKey]) : null;
}

export function pickPhone(row) {
  const exact = pick(row, PHONE_KEYS);
  if (exact) return exact;
  const fallbackKey = Object.keys(row).find(k =>
    ['phone','mobile','contact'].some(w => k.toLowerCase().includes(w)) && row[k]
  );
  return fallbackKey ? String(row[fallbackKey]) : null;
}

export function formatTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { /* invalid date — return raw */ }
  return val;
}
