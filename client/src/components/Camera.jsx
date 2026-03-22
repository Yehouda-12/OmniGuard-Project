import { useState, useEffect } from 'react';
import useFaceApi from '../hooks/useFaceApi';
import useCamera from '../hooks/useCamera';
import socket from '../socket';

const Camera = ({ userId, authorizedFaces, ipCameraUrl, cameraName }) => {
  // 1. Integration Logic
  const { ready, error: apiError } = useFaceApi();
  
  // חיבור ל-Hook של המצלמה שמחזיר הפניות (Refs) לאלמנטים של הוידאו/תמונה והקנבס,
  // וכן את מספר הפנים המזוהות בזמן אמת.
  const { videoRef, imgRef, canvasRef, faceCount } = useCamera({
    ready,
    authorizedFaces,
    userId,
    ipCameraUrl,
  });

  const [isAlerting, setIsAlerting] = useState(false);

  // האזנה לאירוע התראה מהסוקט להפעלת אפקט ויזואלי
  useEffect(() => {
    const handleAlert = (data) => {
      // מפעיל את מצב ההתראה (הבהוב אדום) למשך שנייה אחת
      setIsAlerting(true);
      setTimeout(() => setIsAlerting(false), 1000);
    };

    socket.on('alert', handleAlert);
    return () => socket.off('alert', handleAlert);
  }, []);

  // 3. UI & Styling
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: '400px', // גובה מינימלי לתצוגה
    backgroundColor: '#0a0a0a',
    border: isAlerting ? '2px solid #ff3355' : '2px solid #00c8ff', // גבול אדום בהתראה, כחול במצב רגיל
    boxShadow: isAlerting ? '0 0 50px rgba(255, 51, 85, 0.5) inset' : 'none', // אפקט זוהר פנימי אדום בהתראה
    overflow: 'hidden',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'border 0.2s, box-shadow 0.2s',
    fontFamily: 'monospace', // פונט מונוספייס לפי הדרישות
  };

  const mediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };

  const canvasStyle = {
    position: 'absolute', // מיקום אבסולוטי כדי לשבת בדיוק על הוידאו
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none', // מאפשר קליקים לעבור דרך הקנבס אם צריך
  };

  const hudStyle = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    color: '#00ff88', // צבע ירוק זרחני לטקסט
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 'bold',
    zIndex: 10,
  };

  if (!ready) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#00c8ff' }}>Initializing AI Models...</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* HUD: תצוגה עילית של שם המצלמה וכמות זיהויים */}
      <div style={hudStyle}>
        <div>LIVE - {cameraName || 'Unknown Camera'}</div>
        <div>DETECTIONS: {faceCount}</div>
      </div>

      {/* החלפה דינמית בין תג IMG (למצלמות IP) לבין תג VIDEO (למצלמת רשת) */}
      {/* ההחלטה מתבצעת על בסיס קיום המשתנה ipCameraUrl */}
      {ipCameraUrl ? (
        <img ref={imgRef} src={ipCameraUrl} crossOrigin="anonymous" style={mediaStyle} alt="IP Stream" />
      ) : (
        <video ref={videoRef} autoPlay muted playsInline style={mediaStyle} />
      )}

      {/* שכבת הקנבס לציור זיהויי הפנים מעל הוידאו */}
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
};

export default Camera;