import React, { useState } from 'react';

function MeetingCalendar({ meetings }) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Build meeting lookup by day
    const meetingsByDay = {};
    (meetings || []).forEach(m => {
        const d = new Date(m.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
            const day = d.getDate();
            if (!meetingsByDay[day]) meetingsByDay[day] = [];
            meetingsByDay[day].push(m);
        }
    });

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const days = [];
    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        days.push(<td key={`empty-${i}`} style={cellStyle}></td>);
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        const hasMeeting = meetingsByDay[d];

        days.push(
            <td
                key={d}
                style={{
                    ...cellStyle,
                    background: hasMeeting ? '#e3f2fd' : isToday ? '#fff8e1' : 'white',
                    border: isToday ? '2px solid #ffc107' : '1px solid #eee',
                    position: 'relative'
                }}
                title={hasMeeting ? hasMeeting.map(m => `${m.agenda || 'Meeting'} (${m.status || 'pending'})`).join('\n') : ''}
            >
                <div style={{ fontWeight: isToday ? 'bold' : 'normal', color: isToday ? '#f57f17' : '#333' }}>
                    {d}
                </div>
                {hasMeeting && hasMeeting.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            fontSize: '10px',
                            padding: '1px 4px',
                            marginTop: '2px',
                            borderRadius: '3px',
                            background: m.status === 'accepted' ? '#c8e6c9' : m.status === 'rescheduled' ? '#fff9c4' : '#bbdefb',
                            color: '#333',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {m.agenda ? m.agenda.substring(0, 12) : 'Meeting'}
                    </div>
                ))}
            </td>
        );
    }

    // Build rows of 7
    const rows = [];
    let cells = [...days];
    while (cells.length % 7 !== 0) {
        cells.push(<td key={`pad-${cells.length}`} style={cellStyle}></td>);
    }
    for (let i = 0; i < cells.length; i += 7) {
        rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>);
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={prevMonth}
                >
                    ◀ Prev
                </button>
                <h4 style={{ margin: 0 }}>{monthName}</h4>
                <button
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={nextMonth}
                >
                    Next ▶
                </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <th key={day} style={{
                                padding: '8px',
                                textAlign: 'center',
                                background: '#f8f9fa',
                                borderBottom: '2px solid #dee2e6',
                                fontSize: '13px',
                                color: '#666'
                            }}>
                                {day}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>

            <div style={{ marginTop: '10px', display: 'flex', gap: '15px', fontSize: '12px', color: '#666' }}>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#bbdefb', borderRadius: '2px', marginRight: '4px' }}></span>Pending</span>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#c8e6c9', borderRadius: '2px', marginRight: '4px' }}></span>Accepted</span>
                <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fff9c4', borderRadius: '2px', marginRight: '4px' }}></span>Rescheduled</span>
            </div>
        </div>
    );
}

const cellStyle = {
    padding: '8px 4px',
    textAlign: 'center',
    verticalAlign: 'top',
    minHeight: '60px',
    height: '70px',
    border: '1px solid #eee'
};

export default MeetingCalendar;
