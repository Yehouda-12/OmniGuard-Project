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
const useCamera = ({ ready, authorizedFaces, userId }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [faceCount, setFaceCount] = useState(0);

  // אתחול המצלמה
  useEffect(() => {
    // אם המודלים עדיין לא נטענו, לא נפעיל את המצלמה כדי לחסוך משאבים
    if (!ready) return;

    let stream = null;

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
    };
  }, [ready]);

  // לוגיקת עיבוד פריימים והשוואת פנים
  useEffect(() => {
    if (!ready || !authorizedFaces) return;

    const intervalId = setInterval(async () => {
      if (
        videoRef.current &&
        canvasRef.current &&
        !videoRef.current.paused &&
        !videoRef.current.ended
      ) {
        // 1. לכידת הפריים הנוכחי מהוידאו לקנבס הנסתר
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const displaySize = { width: video.videoWidth, height: video.videoHeight };

        // התאמת גודל הקנבס לוידאו כדי שהציור יהיה מדויק
        canvas.width = displaySize.width;
        canvas.height = displaySize.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, displaySize.width, displaySize.height);

        // 2. זיהוי פנים וחישוב Descriptors באמצעות face-api
        // אנו משתמשים ב-TinyFaceDetector לביצועים מהירים בזמן אמת
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        setFaceCount(detections.length);

        if (detections.length > 0) {
          // 3. לוגיקת השוואה וזיהוי פולשים
          // עוברים על כל הפנים שזוהו בפריים הנוכחי
          detections.forEach((detection) => {
            let isMatchFound = false;

            // השוואה מול כל הפנים המורשות ברשימה
            // Euclidean Distance: מרחק קטן מ-0.6 נחשב להתאמה
            for (const authorizedFace of authorizedFaces) {
              // המרה ל-Float32Array למקרה שהמידע הגיע כמערך רגיל מה-DB
              const authorizedDescriptor = new Float32Array(authorizedFace);
              const distance = faceapi.euclideanDistance(
                detection.descriptor,
                authorizedDescriptor
              );

              if (distance < 0.6) {
                isMatchFound = true;
                break; // נמצאה התאמה, אין צורך להמשיך לבדוק
              }
            }

            // 4. אם הפנים לא מוכרות (אין התאמה לאף אחד ברשימה) - שליחת התראה
            if (!isMatchFound) {
              console.warn('Unknown face detected! Sending alert...');
              const imageBase64 = canvas.toDataURL('image/jpeg');

              const alertData = {
                userId: userId,
                image: imageBase64,
                cameraName: 'Webcam',
                timestamp: new Date().toISOString(),
              };

              socket.emit('alert', alertData);
            }
          });
        }
      }
    }, 3000); // הרצה כל 3 שניות כפי שהוגדר בדרישות הפרויקט

    return () => clearInterval(intervalId);
  }, [ready, authorizedFaces, userId]);

  return { videoRef, canvasRef, faceCount };
};

export default useCamera;
