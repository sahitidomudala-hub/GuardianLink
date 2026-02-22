import React, { useState } from 'react';

const AIAssistant = ({ student }) => {
    const [question, setQuestion] = useState('');
    const [response, setResponse] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const askAI = async () => {
        if (!question.trim()) return;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey || apiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE' || apiKey === '') {
            setError('Please set a valid Gemini API key in the .env file and restart the dev server.');
            return;
        }

        setLoading(true);
        setError(null);
        setResponse(null);

        // Prepare context - ONLY parent-visible academic notes
        const visibleNotes = (student.notes || [])
            .filter(n => n.isParentVisible && !n.isConfidential)
            .map(n => n.content)
            .join('\n');

        const tasks = (student.tasks || [])
            .map(t => `- ${t.title} (${t.completed ? 'Completed' : 'Pending'})`)
            .join('\n');

        const prompt = `
You are a Mentor Assistant for GuardianLink. Your goal is to provide academic insights for mentors.
Strict Rules:
1. Use ONLY the provided student data. 
2. Do NOT invent missing data. If data is missing, respond: "Information not available in current student record."
3. Do NOT give emotional, medical, or mental health advice.
4. Focus ONLY on academic interventions and performance summaries.
5. Keep it concise and professional.
6. NEVER reveal confidential notes.
7. Use the student's actual numerical data for analysis.

Student Data:
Name: ${student.name}
Attendance: ${student.attendance}%
Marks: ${student.marks}%
Risk Level: ${student.atRisk ? 'At Risk' : 'Stable'}

Mentoring Tasks:
${tasks || 'None assigned'}

Academic Notes:
${visibleNotes || 'No academic notes recorded'}

Mentor's Question: "${question}"

Force this Exact Output Format:
Performance Summary:
Attendance: ${student.attendance}%
Risk Level: ${student.atRisk ? 'At-Risk' : 'Stable'}
[Brief summary of status]

Analysis:
[Strict data-driven analysis of why the student is in this state based on marks and attendance]

Recommended Academic Action:
[Specific academic steps for the mentor to take]
`;

        try {
            const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

            const res = await fetch(apiURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error.message || 'API Error');
            }

            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) {
                setResponse(aiText);
            } else {
                throw new Error('No response from AI assistant. Please try again.');
            }
        } catch (err) {
            setError(err.message);
            console.error('AI Assistant Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ai-assistant-container" style={{
            marginTop: '30px',
            padding: '24px',
            background: '#f8fbfc',
            borderRadius: '12px',
            border: '1px solid #e1e8ed',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    background: '#007bff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '20px'
                }}>
                    🤖
                </div>
                <div>
                    <h4 style={{ margin: 0, color: '#1a1a1a', fontSize: '18px' }}>Guardian AI Mentor Assistant</h4>
                    <span style={{ fontSize: '12px', color: '#666' }}>Powered by Gemini 2.0 Flash</span>
                </div>
            </div>

            <p style={{ fontSize: '14px', color: '#4a5568', marginBottom: '20px', lineHeight: '1.5' }}>
                Get instant academic analysis and intervention strategies for <strong>{student.name}</strong> based on attendance and marks.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Ask about performance trends or intervention ideas..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '2px solid #e2e8f0',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                    }}
                    disabled={loading}
                    onKeyPress={(e) => e.key === 'Enter' && askAI()}
                />
                <button
                    onClick={askAI}
                    className="btn btn-primary"
                    style={{
                        borderRadius: '8px',
                        padding: '0 24px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    disabled={loading || !question.trim()}
                >
                    {loading ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="loader-small"></span> Analyzing...
                        </span>
                    ) : 'Ask AI'}
                </button>
            </div>

            {error && (
                <div className="alert alert-danger" style={{ fontSize: '13px', borderRadius: '8px', border: 'none', background: '#fff5f5', color: '#c53030' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {response && (
                <div className="ai-response-box" style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                }}>
                    <div style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'inherit',
                        margin: 0,
                        color: '#2d3748',
                        fontSize: '15px',
                        lineHeight: '1.7'
                    }}>
                        {/* Formatting the response headers for better UI */}
                        {response.split('\n').map((line, i) => {
                            if (line.includes('Performance Summary:') || line.includes('Analysis:') || line.includes('Recommended Academic Action:')) {
                                return (
                                    <div key={i} style={{
                                        fontWeight: 'bold',
                                        color: '#2b6cb0',
                                        marginTop: i === 0 ? '0' : '20px',
                                        marginBottom: '8px',
                                        fontSize: '16px',
                                        borderBottom: '1px solid #edf2f7',
                                        paddingBottom: '4px'
                                    }}>
                                        {line}
                                    </div>
                                );
                            }
                            return <div key={i} style={{ marginBottom: '4px' }}>{line}</div>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAssistant;
