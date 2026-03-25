



// import { useRef, useEffect, useState } from 'react';
// import * as faceapi from 'face-api.js';
// import socket from '../socket';

// /**
//  * Hook מותאם אישית לניהול המצלמה וזיהוי פנים בזמן אמת.
//  * ה-Hook דואג לאתחול המצלמה, דגימת פריימים כל 3 שניות, והשוואת פנים מול רשימת מורשים.
//  *
//  * @param {Object} props
//  * @param {boolean} props.ready - האם המודלים של face-api טעונים ומוכנים.
//  * @param {Array} props.authorizedFaces - רשימת דסקריפטורים (Descriptors) של פנים מורשות מהדאטה-בייס.
//  * @param {string} props.userId - מזהה המשתמש הנוכחי לצורך שליחת התראות.
//  * @returns {Object} { videoRef, canvasRef, faceCount }
//  */
// const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
//   const videoRef = useRef(null);
//   const imgRef = useRef(null);
//   const canvasRef = useRef(null);
//   const recentAlertsRef = useRef([]);
//   const isActive = useRef(true); // Performance: Control loop state to prevent memory leaks
//   const isProcessing = useRef(false); // Safety: Prevent overlapping detection cycles
//   const [faceCount, setFaceCount] = useState(0);

//   // אתחול המצלמה
//   useEffect(() => {
//     // אם המודלים עדיין לא נטענו, לא נפעיל את המצלמה כדי לחסוך משאבים
//     if (!ready) return;

//     let stream = null;

//     // אם ניתנה כתובת של מצלמת IP, נטען התמונה מכתובת זו במקום לקבלת גישה למצלמת הוידאו המקומית
//     if (ipCameraUrl) {
//       if (imgRef.current) {
//         imgRef.current.crossOrigin = 'anonymous'; // כדי למנוע Tainted Canvas
//         imgRef.current.src = ipCameraUrl;
//       }
//       return;
//     }

//     const startVideo = async () => {
//       try {
//         // Performance: Request stable resolution for fluidity
//         stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;
//         }
//       } catch (err) {
//         console.error('Error accessing webcam:', err);
//       }
//     };

//     startVideo();

//     // פונקציית ניקוי (Cleanup): סגירת הזרם (Stream) כשהקומפוננטה יוצאת משימוש
//     return () => {
//       if (stream) {
//         stream.getTracks().forEach((track) => track.stop());
//       }
//       if (ipCameraUrl && imgRef.current) {
//         imgRef.current.src = '';
//       }
//     };
//   }, [ready, ipCameraUrl, cameraId]);

//   // לוגיקת עיבוד פריימים והשוואת פנים
//   useEffect(() => {
//     if (!ready || !authorizedFaces) return;

//     // Performance: Ensure active state is true on mount
//     isActive.current = true;

//     const runDetection = async () => {
//       // Safety: Prevent overlap if previous cycle is still running
//       if (!isActive.current || isProcessing.current) return;
//       isProcessing.current = true;

//       try {
//         let detections = [];
//         let source = null;
//         let width = 0;
//         let height = 0;

//         const canvas = canvasRef.current;
//         if (!canvas) return;

//         // מצב IP Camera: נטען מתוך IMG עם crossOrigin כדי למנוע "Tainted Canvas"
//         if (ipCameraUrl) {
//           if (!imgRef.current || !imgRef.current.complete) {
//             return;
//           } else {
//             imgRef.current.crossOrigin = 'anonymous';
//             source = imgRef.current;
//             width = imgRef.current.naturalWidth;
//             height = imgRef.current.naturalHeight;
//           }
//         } else {
//           // מצב Webcam: נטען מתוך וידאו מקומי
//           if (
//             !videoRef.current ||
//             videoRef.current.paused ||
//             videoRef.current.ended ||
//             videoRef.current.videoWidth === 0 ||
//             videoRef.current.videoHeight === 0
//           ) {
//             return;
//           } else {
//             source = videoRef.current;
//             width = videoRef.current.videoWidth;
//             height = videoRef.current.videoHeight;
//           }
//         }

//         if (!source || width === 0 || height === 0) return;

//         // Smoothness Refactor: Yield to Main Thread to allow UI updates (video frame render) before heavy AI task
//         // This micro-delay ensures the browser isn't locked up during the detection cycle.
//         await new Promise(resolve => setTimeout(resolve, 0));

//         // Tensor Scope Management: Start scope to track tensor allocations
//         faceapi.tf.engine().startScope();
//         try {
//           // Performance: inputSize 128 optimized for speed
//           // זיהוי פנים וחישוב Descriptors באמצעות face-api
//           const results = await faceapi
//             .detectAllFaces(source, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 }))
//             .withFaceLandmarks()
//             .withFaceDescriptors();

//           setFaceCount(results.length);

//           // Memory Fix: Convert descriptors to standard Arrays IMMEDIATELY to avoid "Tensor is disposed"
//           detections = results.map(det => ({
//             descriptor: Array.from(det.descriptor)
//           }));
//         } catch (err) {
//           console.error('Detection error:', err);
//         } finally {
//           // Tensor Scope Management: Ensure scope is ended to clean up tensors
//           faceapi.tf.engine().endScope();
//         }

//         // Process logic outside of tensor scope to avoid memory issues
//         if (detections.length > 0) {
//           // Performance: Clean up old alerts from cooldown list (older than 30s)
//           const COOLDOWN_MS = 30000;
//           const now = Date.now();
//           recentAlertsRef.current = recentAlertsRef.current.filter(alert => now - alert.timestamp < COOLDOWN_MS);

//           detections.forEach((detection) => {
//             let isMatchFound = false;
//             for (const authorizedFace of authorizedFaces) {
//               const authorizedDescriptor = new Float32Array(authorizedFace);
//               const distance = faceapi.euclideanDistance(
//                 detection.descriptor,
//                 authorizedDescriptor
//               );
//               if (distance < 0.6) {
//                 isMatchFound = true;
//                 break;
//               }
//             }

//             if (!isMatchFound) {
//               // Check if this unknown face was recently alerted (distance < 0.6)
//               const isRecent = recentAlertsRef.current.some(alert => 
//                 faceapi.euclideanDistance(detection.descriptor, alert.descriptor) < 0.6
//               );

//               if (isRecent) return; // Skip alert if in cooldown

//               // Add new unknown face to recent alerts list
//               recentAlertsRef.current.push({ descriptor: detection.descriptor, timestamp: now });

//               console.warn('Unknown face detected! Sending alert...');
              
//               // Performance: Drawing Optimization - Only draw to canvas when actually alerting
//               const canvas = canvasRef.current;
//               if (canvas && source) {
//                 canvas.width = width;
//                 canvas.height = height;
//                 const ctx = canvas.getContext('2d');
//                 ctx.drawImage(source, 0, 0, width, height);
//                 const imageBase64 = canvas.toDataURL('image/jpeg', 0.6); // Performance: Quality 0.6

//                 const alertData = {
//                   userId: userId,
//                   image: imageBase64,
//                   cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
//                   timestamp: new Date().toISOString(),
//                   type: 'unknownFace',
//                   descriptor: detection.descriptor, // Already a standard Array
//                   cameraId: cameraId
//                 };

//                 socket.emit('alert', alertData);
//               }
//             }
//           });
//         }
//       } catch (err) {
//         console.error('General detection cycle error:', err);
//       } finally {
//         isProcessing.current = false;
//         // Performance: Schedule next detection recursively in finally block
//         if (isActive.current) {
//           setTimeout(runDetection, 5000);
//         }
//       }
//     };

//     runDetection();

//     return () => {
//       isActive.current = false;
//     };
//   }, [ready, authorizedFaces, userId, ipCameraUrl, cameraId]);

//   return { videoRef, imgRef, canvasRef, faceCount, cameraId };
// };

// export default useCamera;



import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import socket from '../socket';

const useCamera = ({
  ready,
  authorizedFaces,
  userId,
  ipCameraUrl = null,
  cameraId = null,
  cameraName = null,
}) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const recentAlertsRef = useRef([]);
  const recentKnownRef = useRef([]); // cooldown for known faces too
  const isActive = useRef(true);
  const isProcessing = useRef(false);
  const [faceCount, setFaceCount] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let stream = null;

    if (ipCameraUrl) {
      if (imgRef.current) {
        imgRef.current.crossOrigin = 'anonymous';
        imgRef.current.src = ipCameraUrl;
      }
      return;
    }

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    };

    startVideo();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (ipCameraUrl && imgRef.current) imgRef.current.src = '';
    };
  }, [ready, ipCameraUrl, cameraId]);

  useEffect(() => {
    if (!ready || !authorizedFaces) return;

    isActive.current = true;

    const runDetection = async () => {
      if (!isActive.current || isProcessing.current) return;
      isProcessing.current = true;

      try {
        let detections = [];
        let source = null;
        let width = 0;
        let height = 0;

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (ipCameraUrl) {
          if (!imgRef.current || !imgRef.current.complete) return;
          imgRef.current.crossOrigin = 'anonymous';
          source = imgRef.current;
          width = imgRef.current.naturalWidth;
          height = imgRef.current.naturalHeight;
        } else {
          if (
            !videoRef.current ||
            videoRef.current.paused ||
            videoRef.current.ended ||
            videoRef.current.videoWidth === 0 ||
            videoRef.current.videoHeight === 0
          ) return;
          source = videoRef.current;
          width = videoRef.current.videoWidth;
          height = videoRef.current.videoHeight;
        }

        if (!source || width === 0 || height === 0) return;

        await new Promise(resolve => setTimeout(resolve, 0));

        faceapi.tf.engine().startScope();
        try {
          const results = await faceapi
            .detectAllFaces(source, new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

          setFaceCount(results.length);

          detections = results.map(det => ({
            descriptor: Array.from(det.descriptor)
          }));
        } catch (err) {
          console.error('Detection error:', err);
        } finally {
          faceapi.tf.engine().endScope();
        }

        if (detections.length > 0) {
          const COOLDOWN_MS = 30000;
          const now = Date.now();

          // Clean cooldown lists
          recentAlertsRef.current = recentAlertsRef.current.filter(a => now - a.timestamp < COOLDOWN_MS);
          recentKnownRef.current  = recentKnownRef.current.filter(a => now - a.timestamp < COOLDOWN_MS);

          detections.forEach((detection) => {
            let isMatchFound = false;
            let matchedName = null;

            // Check against authorized faces
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

            // Capture image for both cases
            const captureImage = () => {
              if (!canvas || !source) return null;
              canvas.width = width;
              canvas.height = height;
              canvas.getContext('2d').drawImage(source, 0, 0, width, height);
              return canvas.toDataURL('image/jpeg', 0.6);
            };

            if (isMatchFound) {
              // ── Known face ──
              const inCooldown = recentKnownRef.current.some(a =>
                faceapi.euclideanDistance(detection.descriptor, a.descriptor) < 0.6
              );
              if (inCooldown) return;

              recentKnownRef.current.push({ descriptor: detection.descriptor, timestamp: now });
              console.log('✅ Known face detected');

              const imageBase64 = captureImage();
              if (imageBase64) {
                socket.emit('alert', {
                  userId,
                  image: imageBase64,
                  cameraName: cameraName || (ipCameraUrl ? 'IP Camera' : 'Webcam'),
                  timestamp: new Date().toISOString(),
                  type: 'knownFace',  // ← green in history, no email
                  descriptor: detection.descriptor,
                  cameraId
                });
              }

            } else {
              // ── Unknown face ──
              const inCooldown = recentAlertsRef.current.some(a =>
                faceapi.euclideanDistance(detection.descriptor, a.descriptor) < 0.6
              );
              if (inCooldown) return;

              recentAlertsRef.current.push({ descriptor: detection.descriptor, timestamp: now });
              console.warn('🚨 Unknown face detected!');

              const imageBase64 = captureImage();
              if (imageBase64) {
                socket.emit('alert', {
                  userId,
                  image: imageBase64,
                  cameraName: cameraName || (ipCameraUrl ? 'IP Camera' : 'Webcam'),
                  timestamp: new Date().toISOString(),
                  type: 'unknownFace',
                  descriptor: detection.descriptor,
                  cameraId
                });
              }
            }
          });
        }
      } catch (err) {
        console.error('General detection error:', err);
      } finally {
        isProcessing.current = false;
        if (isActive.current) {
          setTimeout(runDetection, 5000);
        }
      }
    };

    runDetection();

    return () => { isActive.current = false; };
  }, [ready, authorizedFaces, userId, ipCameraUrl, cameraId, cameraName]);

  return { videoRef, imgRef, canvasRef, faceCount };
};

export default useCamera;



