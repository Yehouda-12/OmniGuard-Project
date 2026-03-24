import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import socket from '../socket';

/**
 * Hook מותאם אישית לניהול המצלמה וזיהוי פנים בזמן אמת.
 * ה-Hook דואג לאתחול המצלמה, דגימת פריימים כל 3 שניות, והשוואת פנים מול רשימת מורשים.
 *
 * @param {Object} props
 * @param {boolean} props.ready - האם המודלים של face-api טעונים ומוכנים.
 * @param {Array} props.authorizedFaces - רשימת דסקריפטורים (Descriptors) של פנים מורשות מהדאטה-בייס.
 * @param {string} props.userId - מזהה המשתמש הנוכחי לצורך שליחת התראות.
 * @returns {Object} { videoRef, canvasRef, faceCount }
 */
const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const recentAlertsRef = useRef([]);
  const [faceCount, setFaceCount] = useState(0);

  // אתחול המצלמה
  useEffect(() => {
    // אם המודלים עדיין לא נטענו, לא נפעיל את המצלמה כדי לחסוך משאבים
    if (!ready) return;

    let stream = null;

    // אם ניתנה כתובת של מצלמת IP, נטען התמונה מכתובת זו במקום לקבלת גישה למצלמת הוידאו המקומית
    if (ipCameraUrl) {
      if (imgRef.current) {
        imgRef.current.crossOrigin = 'anonymous'; // כדי למנוע Tainted Canvas
        imgRef.current.src = ipCameraUrl;
      }
      return;
    }

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    };

    startVideo();

    // פונקציית ניקוי (Cleanup): סגירת הזרם (Stream) כשהקומפוננטה יוצאת משימוש
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (ipCameraUrl && imgRef.current) {
        imgRef.current.src = '';
      }
    };
  }, [ready, ipCameraUrl]);

  // לוגיקת עיבוד פריימים והשוואת פנים
  useEffect(() => {
    if (!ready || !authorizedFaces) return;

    const intervalId = setInterval(async () => {
      // Performance and Memory leak fixes: Start TensorFlow scope to manage tensor memory
      faceapi.tf.engine().startScope();

      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let source = null;
        let width = 0;
      let height = 0;

      // מצב IP Camera: נטען מתוך IMG עם crossOrigin כדי למנוע "Tainted Canvas"
      if (ipCameraUrl) {
        if (!imgRef.current || !imgRef.current.complete) {
          return;
        }

        imgRef.current.crossOrigin = 'anonymous';
        source = imgRef.current;
        width = imgRef.current.naturalWidth;
        height = imgRef.current.naturalHeight;
      } else {
        // מצב Webcam: נטען מתוך וידאו מקומי
        if (
          !videoRef.current ||
          videoRef.current.paused ||
          videoRef.current.ended ||
          videoRef.current.videoWidth === 0 ||
          videoRef.current.videoHeight === 0
        ) {
          return;
        }

        source = videoRef.current;
        width = videoRef.current.videoWidth;
        height = videoRef.current.videoHeight;
      }

      if (!source || width === 0 || height === 0) return;

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // drawImage מתאים גם ל-VIDEO וגם ל-IMG
      ctx.drawImage(source, 0, 0, width, height);

      // זיהוי פנים וחישוב Descriptors באמצעות face-api
      const detections = await faceapi
        .detectAllFaces(source, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      setFaceCount(detections.length);

      if (detections.length > 0) {
        // Performance: Clean up old alerts from cooldown list (older than 30s)
        const COOLDOWN_MS = 30000;
        const now = Date.now();
        recentAlertsRef.current = recentAlertsRef.current.filter(alert => now - alert.timestamp < COOLDOWN_MS);

        detections.forEach((detection) => {
          let isMatchFound = false;
          for (const authorizedFace of authorizedFaces) {
            const authorizedDescriptor = new Float32Array(authorizedFace);
            const distance = faceapi.euclideanDistance(
              detection.descriptor,
              authorizedDescriptor
            );
            if (distance < 0.6) {
              isMatchFound = true;
              break;
            }
          }

          if (!isMatchFound) {
            // Check if this unknown face was recently alerted (distance < 0.6)
            const isRecent = recentAlertsRef.current.some(alert => 
              faceapi.euclideanDistance(detection.descriptor, alert.descriptor) < 0.6
            );

            if (isRecent) return; // Skip alert if in cooldown

            // Add new unknown face to recent alerts list
            recentAlertsRef.current.push({ descriptor: detection.descriptor, timestamp: now });

            console.warn('Unknown face detected! Sending alert...');
            // Performance and Memory leak fixes: Optimize image quality to reduce payload
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);

            const alertData = {
              userId: userId,
              image: imageBase64,
              cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
              timestamp: new Date().toISOString(),
              type: 'unknownFace',
              descriptor: Array.from(detection.descriptor),
              cameraId: cameraId
            };

            socket.emit('alert', alertData);
          }
        });
      }
      } finally {
        // Performance and Memory leak fixes: End scope to clean up tensors
        faceapi.tf.engine().endScope();
      }
    }, 5000); // Performance and Memory leak fixes: Update interval to 5000ms

    return () => clearInterval(intervalId);
  }, [ready, authorizedFaces, userId, ipCameraUrl]);

  return { videoRef, imgRef, canvasRef, faceCount };
};

export default useCamera;
