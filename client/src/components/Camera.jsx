import { useState, useEffect } from 'react';
import useFaceApi from '../hooks/useFaceApi';
import useCamera from '../hooks/useCamera';
import socket from '../socket';

/**
 * Default visual design tokens.
 * Overridable via the 'theme' prop.
 */
const defaultTheme = {
  backgroundColor: '#0a0a0a',
  borderColor: '#00c8ff',       // Primary UI border
  hudColor: '#00ff88',          // HUD text color
  alertColor: '#ff3355',        // Critical alert color
  borderRadius: '8px',
  fontFamily: 'monospace',
  minHeight: '400px',
};

/**
 * Video stream display component with integrated facial recognition HUD.
 * Supports both local hardware and remote IP camera sources.
 */
const Camera = ({ userId, authorizedFaces, ipCameraUrl, cameraName, theme = {}, cameraId }) => {
  // Merge default tokens with custom theme overrides
  const activeTheme = { ...defaultTheme, ...theme };

  // AI Model status hook
  const { ready, error: apiError } = useFaceApi();
  
  /**
   * Initialize camera controller hook.
   * Provides refs for DOM elements and real-time detection telemetry.
   */
  const { videoRef, imgRef, canvasRef, faceCount } = useCamera({
    ready,
    authorizedFaces,
    userId,
    ipCameraUrl,
    cameraId
  });

  const [isAlerting, setIsAlerting] = useState(false);

  /** Socket event listener for visual alert triggering */
  useEffect(() => {
    const handleAlert = (data) => {
      // Trigger UI flash effect for 1000ms
      setIsAlerting(true);
      setTimeout(() => setIsAlerting(false), 1000);
    };

    socket.on('alert', handleAlert);
    return () => socket.off('alert', handleAlert);
  }, []);

  /**
   * Functional Layout Styles.
   * Core positioning for media elements and canvas overlays.
   */
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

  /**
   * Visual Styles.
   * Configurable styling derived from the active theme.
   */
  const visualStyles = {
    container: {
      backgroundColor: activeTheme.backgroundColor,
      borderRadius: activeTheme.borderRadius,
      minHeight: activeTheme.minHeight,
      fontFamily: activeTheme.fontFamily,
      border: isAlerting ? `2px solid ${activeTheme.alertColor}` : `2px solid ${activeTheme.borderColor}`,
      boxShadow: isAlerting ? `0 0 50px ${activeTheme.alertColor}80 inset` : 'none',
      transition: 'border 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
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
      {/* Heads-Up Display: Camera telemetry and metadata */}
      <div style={hudStyle}>
        <div>LIVE - {cameraName || 'Unknown Camera'}</div>
        <div>DETECTIONS: {faceCount}</div>
      </div>

      {/* 
          Dynamic source selection:
          Renders <img> for MJPEG/IP streams or <video> for local hardware access.
      */}
      {ipCameraUrl ? (
        <img ref={imgRef} src={ipCameraUrl} crossOrigin="anonymous" style={mediaStyle} alt="IP Stream" />
      ) : (
        <video ref={videoRef} autoPlay muted playsInline style={mediaStyle} />
      )}

      {/* Recognition Overlay: Used for rendering bounding boxes or landmarks */}
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
};

export default Camera;