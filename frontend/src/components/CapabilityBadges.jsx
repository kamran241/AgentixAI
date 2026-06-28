import { Package, Calendar, Truck } from 'lucide-react';

export default function CapabilityBadges({ caps, size = 10, className }) {
  if (!caps) return null;
  const wrapper = className
    ? { className }
    : { style: { display: 'flex', gap: '0.375rem', flexWrap: 'wrap' } };
  return (
    <div {...wrapper}>
      {caps.has_orders   && <span className="capability-badge badge-orders"><Package size={size} /> Orders</span>}
      {caps.has_bookings && <span className="capability-badge badge-bookings"><Calendar size={size} /> Bookings</span>}
      {caps.has_delivery && <span className="capability-badge badge-delivery"><Truck size={size} /> Delivery</span>}
    </div>
  );
}
