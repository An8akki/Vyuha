import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

const CalendarWidget: React.FC = () => {
  const [date, setDate] = useState(new Date());

  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[date.getMonth()];
  const currentYear = date.getFullYear();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="cal-day empty"></div>);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = i === new Date().getDate() && date.getMonth() === new Date().getMonth();
    const hasEvent = [4, 12, 18, 24].includes(i);
    days.push(
      <div key={`day-${i}`} className={`cal-day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}`}>
        {i}
      </div>
    );
  }

  const prevMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1));
  const nextMonth = () => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1));

  return (
    <div className="card card-3d" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header" style={{ paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={18} color="var(--primary)" />
          <h3 className="card-title">Schedule</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ padding: 4 }}><ChevronLeft size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ padding: 4 }}><ChevronRight size={16} /></button>
        </div>
      </div>
      
      <div className="cal-header" style={{ display: 'flex', justifyContent: 'center', fontWeight: 700, marginBottom: 16 }}>
        {currentMonth} {currentYear}
      </div>
      
      <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 20 }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{d}</div>
        ))}
        {days}
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 12 }}>Upcoming</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
          <div><span style={{ fontWeight: 600 }}>10:30 AM</span> - Ward A Rounds</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8rem', marginTop: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--risk-high)' }} />
          <div><span style={{ fontWeight: 600 }}>01:00 PM</span> - Infection Control Meeting</div>
        </div>
      </div>

      <style>{`
        .cal-day {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          font-size: 0.85rem;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cal-day:not(.empty):not(.today):hover {
          background: var(--sky-blue);
          color: var(--primary);
        }
        .cal-day.today {
          background: var(--primary);
          color: white;
          font-weight: 700;
          box-shadow: 0 4px 10px rgba(72,199,186,0.3);
        }
        .cal-day.has-event:not(.today)::after {
          content: '';
          position: absolute;
          bottom: 2px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--primary);
        }
        .cal-day.has-event { position: relative; }
      `}</style>
    </div>
  );
};

export default CalendarWidget;
