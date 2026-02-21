import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    addDoc,
    deleteDoc,
    onSnapshot,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function VideoCall({ meetingId, userId, userName, onClose }) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [participants, setParticipants] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('Initializing...');

    const localVideoRef = useRef(null);
    const peerConnections = useRef({});
    const unsubscribers = useRef([]);
    const callDocRef = useRef(null);
    const participantDocRef = useRef(null);

    // Initialize call
    useEffect(() => {
        initCall();
        return () => cleanup();
    }, []);

    // Attach local stream to video element
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    const initCall = async () => {
        try {
            // Get camera and mic
            setStatus('Requesting camera & microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);

            // Set up Firestore call document
            callDocRef.current = doc(db, 'calls', meetingId);
            const participantsCol = collection(callDocRef.current, 'participants');

            // Register self as participant
            participantDocRef.current = doc(participantsCol, userId);
            await setDoc(participantDocRef.current, {
                userId,
                userName,
                joinedAt: serverTimestamp()
            });

            setStatus('Waiting for others to join...');

            // Listen for participants
            const unsubParticipants = onSnapshot(participantsCol, (snapshot) => {
                const currentParticipants = {};
                snapshot.docs.forEach(d => {
                    const data = d.data();
                    currentParticipants[d.id] = data;
                });
                setParticipants(currentParticipants);

                // Handle new participants - create peer connections
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added' && change.doc.id !== userId) {
                        const remoteUserId = change.doc.id;
                        const remoteUserName = change.doc.data().userName;
                        createPeerConnection(remoteUserId, remoteUserName, stream);
                    }
                    if (change.type === 'removed' && change.doc.id !== userId) {
                        removePeerConnection(change.doc.id);
                    }
                });
            });

            unsubscribers.current.push(unsubParticipants);
        } catch (err) {
            console.error('Init call error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Camera/microphone access denied. Please allow access and try again.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera or microphone found on this device.');
            } else {
                setError('Failed to start call: ' + err.message);
            }
        }
    };

    const createPeerConnection = async (remoteUserId, remoteUserName, stream) => {
        if (peerConnections.current[remoteUserId]) return;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[remoteUserId] = pc;

        // Add local tracks to the connection
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
        });

        // Handle incoming remote tracks
        pc.ontrack = (event) => {
            setRemoteStreams(prev => ({
                ...prev,
                [remoteUserId]: {
                    stream: event.streams[0],
                    userName: remoteUserName
                }
            }));
            setStatus('Connected');
        };

        // Determine who creates the offer (alphabetically lower ID = caller)
        const isCaller = userId < remoteUserId;
        const pairId = isCaller
            ? `${userId}_${remoteUserId}`
            : `${remoteUserId}_${userId}`;

        const connectionDoc = doc(callDocRef.current, 'connections', pairId);
        const offerCandidatesCol = collection(connectionDoc, 'offerCandidates');
        const answerCandidatesCol = collection(connectionDoc, 'answerCandidates');

        if (isCaller) {
            // ICE candidates for caller
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    addDoc(offerCandidatesCol, event.candidate.toJSON());
                }
            };

            // Create offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await setDoc(connectionDoc, {
                offer: { type: offer.type, sdp: offer.sdp }
            });

            // Listen for answer
            const unsubAnswer = onSnapshot(connectionDoc, (snapshot) => {
                const data = snapshot.data();
                if (data?.answer && !pc.currentRemoteDescription) {
                    pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            });
            unsubscribers.current.push(unsubAnswer);

            // Listen for answer ICE candidates
            const unsubAnswerCandidates = onSnapshot(answerCandidatesCol, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
            unsubscribers.current.push(unsubAnswerCandidates);

        } else {
            // ICE candidates for callee
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    addDoc(answerCandidatesCol, event.candidate.toJSON());
                }
            };

            // Listen for offer
            const unsubOffer = onSnapshot(connectionDoc, async (snapshot) => {
                const data = snapshot.data();
                if (data?.offer && !pc.currentRemoteDescription) {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    await setDoc(connectionDoc, {
                        ...data,
                        answer: { type: answer.type, sdp: answer.sdp }
                    });
                }
            });
            unsubscribers.current.push(unsubOffer);

            // Listen for offer ICE candidates
            const unsubOfferCandidates = onSnapshot(offerCandidatesCol, (snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                });
            });
            unsubscribers.current.push(unsubOfferCandidates);
        }

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                removePeerConnection(remoteUserId);
            }
        };
    };

    const removePeerConnection = (remoteUserId) => {
        if (peerConnections.current[remoteUserId]) {
            peerConnections.current[remoteUserId].close();
            delete peerConnections.current[remoteUserId];
        }
        setRemoteStreams(prev => {
            const updated = { ...prev };
            delete updated[remoteUserId];
            return updated;
        });
    };

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsCameraOff(!isCameraOff);
        }
    };

    const cleanup = async () => {
        // Unsubscribe all listeners
        unsubscribers.current.forEach(unsub => unsub());
        unsubscribers.current = [];

        // Close all peer connections
        Object.values(peerConnections.current).forEach(pc => pc.close());
        peerConnections.current = {};

        // Stop local media tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }

        // Remove self from participants
        if (participantDocRef.current) {
            try {
                await deleteDoc(participantDocRef.current);
            } catch (e) {
                console.error('Cleanup error:', e);
            }
        }

        // Clean up connection docs if we're the last participant
        if (callDocRef.current) {
            try {
                const participantsSnap = await getDocs(
                    collection(callDocRef.current, 'participants')
                );
                if (participantsSnap.empty) {
                    // Clean up all connection documents
                    const connectionsSnap = await getDocs(
                        collection(callDocRef.current, 'connections')
                    );
                    for (const connDoc of connectionsSnap.docs) {
                        const offerCands = await getDocs(collection(connDoc.ref, 'offerCandidates'));
                        for (const c of offerCands.docs) await deleteDoc(c.ref);
                        const answerCands = await getDocs(collection(connDoc.ref, 'answerCandidates'));
                        for (const c of answerCands.docs) await deleteDoc(c.ref);
                        await deleteDoc(connDoc.ref);
                    }
                    await deleteDoc(callDocRef.current);
                }
            } catch (e) {
                console.error('Cleanup connections error:', e);
            }
        }
    };

    const handleEndCall = async () => {
        await cleanup();
        onClose();
    };

    const remoteCount = Object.keys(remoteStreams).length;
    const totalParticipants = Object.keys(participants).length;

    return (
        <div className="video-call-overlay">
            <div className="video-call-container">
                {/* Header */}
                <div className="video-call-header">
                    <span>📹 Video Call</span>
                    <span className="video-call-status">
                        {error ? '⚠️ Error' : status} · {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
                    </span>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ margin: '15px', marginBottom: 0 }}>
                        {error}
                        <button
                            className="btn btn-primary"
                            style={{ marginLeft: '15px', fontSize: '12px', padding: '4px 12px' }}
                            onClick={handleEndCall}
                        >
                            Close
                        </button>
                    </div>
                )}

                {/* Video Grid */}
                <div className={`video-grid video-grid-${Math.min(remoteCount + 1, 3)}`}>
                    {/* Local Video */}
                    <div className="video-tile">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={isCameraOff ? 'video-hidden' : ''}
                        />
                        {isCameraOff && (
                            <div className="video-placeholder">
                                <span className="video-placeholder-icon">📷</span>
                                <span>Camera Off</span>
                            </div>
                        )}
                        <div className="video-label">
                            {userName} (You) {isMuted && '🔇'}
                        </div>
                    </div>

                    {/* Remote Videos */}
                    {Object.entries(remoteStreams).map(([id, { stream, userName: name }]) => (
                        <RemoteVideo key={id} stream={stream} userName={name} />
                    ))}
                </div>

                {/* Controls */}
                <div className="call-controls">
                    <button
                        className={`call-control-btn ${isMuted ? 'call-control-active' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? '🔇' : '🎤'}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>
                    <button
                        className={`call-control-btn ${isCameraOff ? 'call-control-active' : ''}`}
                        onClick={toggleCamera}
                        title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
                    >
                        {isCameraOff ? '📷' : '📹'}
                        <span>{isCameraOff ? 'Camera On' : 'Camera Off'}</span>
                    </button>
                    <button
                        className="call-control-btn call-control-end"
                        onClick={handleEndCall}
                        title="End Call"
                    >
                        📞
                        <span>End Call</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Separate component for remote video to handle ref properly
function RemoteVideo({ stream, userName }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="video-tile">
            <video ref={videoRef} autoPlay playsInline />
            <div className="video-label">{userName}</div>
        </div>
    );
}

export default VideoCall;
