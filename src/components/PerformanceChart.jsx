import React from 'react';

function PerformanceChart({ attendance, marks, history }) {
    const getColor = (value, type) => {
        if (type === 'attendance') {
            return value >= 85 ? '#28a745' : value >= 80 ? '#ffc107' : '#dc3545';
        }
        return value >= 75 ? '#28a745' : value >= 60 ? '#ffc107' : '#dc3545';
    };

    const chartWidth = 400;
    const chartHeight = 200;
    const barWidth = 80;
    const maxVal = 100;

    // Bar chart for current values
    const attBarHeight = (attendance / maxVal) * 150;
    const marksBarHeight = (marks / maxVal) * 150;

    // Trend line data
    const trendData = history && history.length > 1 ? history.slice(-6) : null;

    return (
        <div>
            {/* Current Performance Bars */}
            <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', alignItems: 'flex-end', marginBottom: '20px' }}>
                {/* Attendance Bar */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: getColor(attendance, 'attendance'),
                        marginBottom: '8px'
                    }}>
                        {attendance}%
                    </div>
                    <div style={{ position: 'relative', height: '160px', width: barWidth, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                            width: '100%',
                            height: '160px',
                            background: '#f0f0f0',
                            borderRadius: '8px 8px 4px 4px',
                            position: 'absolute',
                            bottom: 0
                        }}></div>
                        <div style={{
                            width: '100%',
                            height: `${attBarHeight}px`,
                            background: `linear-gradient(180deg, ${getColor(attendance, 'attendance')}dd, ${getColor(attendance, 'attendance')})`,
                            borderRadius: '8px 8px 4px 4px',
                            position: 'absolute',
                            bottom: 0,
                            transition: 'height 0.5s ease',
                            boxShadow: `0 0 10px ${getColor(attendance, 'attendance')}40`
                        }}></div>
                    </div>
                    <div style={{ marginTop: '8px', fontWeight: '600', color: '#555' }}>Attendance</div>
                </div>

                {/* Marks Bar */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: getColor(marks, 'marks'),
                        marginBottom: '8px'
                    }}>
                        {marks}%
                    </div>
                    <div style={{ position: 'relative', height: '160px', width: barWidth, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{
                            width: '100%',
                            height: '160px',
                            background: '#f0f0f0',
                            borderRadius: '8px 8px 4px 4px',
                            position: 'absolute',
                            bottom: 0
                        }}></div>
                        <div style={{
                            width: '100%',
                            height: `${marksBarHeight}px`,
                            background: `linear-gradient(180deg, ${getColor(marks, 'marks')}dd, ${getColor(marks, 'marks')})`,
                            borderRadius: '8px 8px 4px 4px',
                            position: 'absolute',
                            bottom: 0,
                            transition: 'height 0.5s ease',
                            boxShadow: `0 0 10px ${getColor(marks, 'marks')}40`
                        }}></div>
                    </div>
                    <div style={{ marginTop: '8px', fontWeight: '600', color: '#555' }}>Marks (GPA)</div>
                </div>
            </div>

            {/* Threshold Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px', color: '#888', marginBottom: '20px' }}>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#28a745', borderRadius: '50%', marginRight: '4px' }}></span>Good</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#ffc107', borderRadius: '50%', marginRight: '4px' }}></span>At Risk</span>
                <span><span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#dc3545', borderRadius: '50%', marginRight: '4px' }}></span>Critical</span>
            </div>

            {/* Trend Line Chart */}
            {trendData && (
                <div style={{ marginTop: '10px' }}>
                    <h4 style={{ marginBottom: '10px', color: '#555' }}>Trend Over Time</h4>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', maxWidth: '500px' }}>
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map(val => {
                            const y = chartHeight - 20 - (val / 100) * (chartHeight - 40);
                            return (
                                <g key={val}>
                                    <line x1="40" y1={y} x2={chartWidth - 10} y2={y} stroke="#eee" strokeWidth="1" />
                                    <text x="35" y={y + 4} textAnchor="end" fontSize="10" fill="#999">{val}</text>
                                </g>
                            );
                        })}

                        {/* Attendance line */}
                        <polyline
                            fill="none"
                            stroke="#007bff"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            points={trendData.map((d, i) => {
                                const x = 50 + (i / (trendData.length - 1)) * (chartWidth - 70);
                                const y = chartHeight - 20 - (d.attendance / 100) * (chartHeight - 40);
                                return `${x},${y}`;
                            }).join(' ')}
                        />
                        {/* Attendance dots */}
                        {trendData.map((d, i) => {
                            const x = 50 + (i / (trendData.length - 1)) * (chartWidth - 70);
                            const y = chartHeight - 20 - (d.attendance / 100) * (chartHeight - 40);
                            return <circle key={`a-${i}`} cx={x} cy={y} r="4" fill="#007bff" />;
                        })}

                        {/* Marks line */}
                        <polyline
                            fill="none"
                            stroke="#6f42c1"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            points={trendData.map((d, i) => {
                                const x = 50 + (i / (trendData.length - 1)) * (chartWidth - 70);
                                const y = chartHeight - 20 - (d.marks / 100) * (chartHeight - 40);
                                return `${x},${y}`;
                            }).join(' ')}
                        />
                        {/* Marks dots */}
                        {trendData.map((d, i) => {
                            const x = 50 + (i / (trendData.length - 1)) * (chartWidth - 70);
                            const y = chartHeight - 20 - (d.marks / 100) * (chartHeight - 40);
                            return <circle key={`m-${i}`} cx={x} cy={y} r="4" fill="#6f42c1" />;
                        })}

                        {/* Date labels */}
                        {trendData.map((d, i) => {
                            const x = 50 + (i / (trendData.length - 1)) * (chartWidth - 70);
                            return (
                                <text key={`l-${i}`} x={x} y={chartHeight - 2} textAnchor="middle" fontSize="9" fill="#999">
                                    {new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                </text>
                            );
                        })}
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '12px', marginTop: '5px' }}>
                        <span><span style={{ display: 'inline-block', width: '20px', height: '3px', background: '#007bff', marginRight: '5px', verticalAlign: 'middle' }}></span>Attendance</span>
                        <span><span style={{ display: 'inline-block', width: '20px', height: '3px', background: '#6f42c1', marginRight: '5px', verticalAlign: 'middle' }}></span>Marks</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PerformanceChart;
