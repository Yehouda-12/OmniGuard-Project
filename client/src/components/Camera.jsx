import { useState, useEffect } from 'react';
import useFaceApi from '../hooks/useFaceApi';
import useCamera from '../hooks/useCamera';
import socket from '../socket';

// הגדרת ערכי עיצוב ברירת מחדל (Design Tokens)
// ערכים אלו ניתנים לשינוי ע"י העברת prop 'theme' לקומפוננטה.
const defaultTheme = {
  backgroundColor: '#0a0a0a',
  borderColor: '#00c8ff',       // צבע גבול רגיל (כחול)
  hudColor: '#00ff88',          // צבע טקסט HUD (ירוק)
  alertColor: '#ff3355',        // צבע התראה (אדום)
  borderRadius: '8px',
  fontFamily: 'monospace',
  minHeight: '400px',
};

const Camera = ({ userId, authorizedFaces, ipCameraUrl, cameraName, theme = {} }) => {
  // איחוד ערכי ברירת המחדל עם הערכים שהתקבלו ב-prop
  const activeTheme = { ...defaultTheme, ...theme };

  // 1. Integration Logic
  const { ready, error: apiError } = useFaceApi();
  
  // חיבור ל-Hook של המצלמה שמחזיר הפניות (Refs) לאלמנטים של הוידאו/תמונה והקנבס,
  // וכן את מספר הפנים המזוהות בזמן אמת.
  const { videoRef, imgRef, canvasRef, faceCount } = useCamera({
    ready,
    authorizedFaces: authorizedFaces || [],
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

  // 3. UI & Styling Separation

  // סגנונות פונקציונליים (Functional Styles):
  // סגנונות אלו קריטיים למיקום האלמנטים (overlay) ולכן נשארים בתוך הקומפוננטה.
  // position: relative על הקונטיינר ו-position: absolute על הקנבס מבטיחים
  // שהציור של זיהוי הפנים יהיה מסונכרן בדיוק מעל הוידאו.
  const layoutStyles = {
    container: {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    },
    hudPosition: {
      position: 'absolute',
      top: '10px',
      left: '10px',
      zIndex: 10,
    }
  };

  // סגנונות ויזואליים (Visual Styles):
  // אלו הסגנונות שניתנים להגדרה מבחוץ (Configurable) דרך ה-theme.
  const visualStyles = {
    container: {
      backgroundColor: activeTheme.backgroundColor,
      borderRadius: activeTheme.borderRadius,
      minHeight: activeTheme.minHeight,
      fontFamily: activeTheme.fontFamily,
      // לוגיקה ויזואלית לשינוי גבול וצללית בזמן התראה
      border: isAlerting ? `2px solid ${activeTheme.alertColor}` : `2px solid ${activeTheme.borderColor}`,
      boxShadow: isAlerting ? `0 0 50px ${activeTheme.alertColor}80 inset` : 'none', // שימוש ב-Hex Alpha
      transition: 'border 0.2s, box-shadow 0.2s',
    },
    hud: {
      color: activeTheme.hudColor,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold',
    },
    media: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    }
  };

  // מיזוג הסגנונות
  const containerStyle = { ...layoutStyles.container, ...visualStyles.container };
  const hudStyle = { ...layoutStyles.hudPosition, ...visualStyles.hud };
  const canvasStyle = layoutStyles.overlay;
  const mediaStyle = visualStyles.media;

  if (!ready) {
    return (
      <div style={containerStyle}>
        <div style={{ color: activeTheme.borderColor }}>Initializing AI Models...</div>
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