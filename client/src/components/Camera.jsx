import { useState, useEffect } from 'react';
import useFaceApi from '../hooks/useFaceApi';
import useCamera from '../hooks/useCamera';
import socket from '../socket';

const defaultTheme = {
  backgroundColor: '#0a0a0a',
  // Default border color
  borderColor: '#00c8ff',       // צבע גבול רגיל (כחול)
  hudColor: '#00ff88',          // צבע טקסט HUD (ירוק)
  alertColor: '#ff3355',        // צבע התראה (אדום)
  borderRadius: '8px',
  fontFamily: 'monospace',
  minHeight: '400px',
};

// Camera component that displays video feed and face detections.
const Camera = ({ userId, authorizedFaces, ipCameraUrl, cameraName, theme = {} }) => {
  const activeTheme = { ...defaultTheme, ...theme };

  const { ready, error: apiError } = useFaceApi();
  const { videoRef, imgRef, canvasRef, faceCount } = useCamera({
    ready,
    authorizedFaces,
    userId,
    ipCameraUrl,
  });

  const [isAlerting, setIsAlerting] = useState(false);

  // Listen for alert events from the socket to trigger a visual effect.
  useEffect(() => {
    const handleAlert = (data) => {
      setIsAlerting(true);
      setTimeout(() => setIsAlerting(false), 1000);
    };

    socket.on('alert', handleAlert);
    return () => socket.off('alert', handleAlert);
  }, []);

  // Functional Styles: Styles critical for element positioning (overlay).
  // `position: relative` on the container and `position: absolute` on the canvas
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
      <div style={hudStyle}>
        <div>LIVE - {cameraName || 'Unknown Camera'}</div>
        <div>DETECTIONS: {faceCount}</div>
      </div>

      {/* Dynamic switch between IMG (for IP cameras) and VIDEO (for webcams). */}
      {ipCameraUrl ? (<img ref={imgRef} src={ipCameraUrl} crossOrigin="anonymous" style={mediaStyle} alt="IP Stream" />) :
        (<video ref={videoRef} autoPlay muted playsInline style={mediaStyle} />)}

      /* Canvas layer for drawing face detections over the video */
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
};

export default Camera;