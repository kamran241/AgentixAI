export const TIME_KEYS  = ['appointment_time','booking_time','time','slot','appointment_date','booking_date','date','order_date','created_at'];
export const NAME_KEYS  = ['customer_name','name','full_name','patient_name','client_name'];
export const PHONE_KEYS = ['customer_phone','phone','phone_number','mobile','contact'];
export const EMAIL_KEYS = ['customer_email','email','email_address'];

export function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]);
  }
  return null;
}

export function formatTime(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d)) return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { /* invalid date — return raw */ }
  return val;
}
