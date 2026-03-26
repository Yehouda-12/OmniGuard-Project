import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import socket from '../socket';

/**
 * Custom React hook for advanced surveillance orchestration.
 *
 * Logic Flow:
 * 1. Frame Capture: Manages dual-source streams (Webcam/IP) via local hardware or remote MJPEG endpoints.
 * 2. Asynchronous Frame Buffer: Implements non-blocking execution by yielding to the main thread prior to AI inference.
 * 3. Tensor Scope Management: Executes facial detection and descriptor extraction within isolated TensorFlow.js memory scopes.
 * 4. Face Matching: Utilizes Euclidean distance thresholding to classify entities against authorized facial data.
 * 5. Conditional Alerting: Orchestrates socket-driven alerting with independent cooldown state management for verified and unknown entities.
 *
 * @param {Object} props - Configuration properties for the surveillance engine.
 * @param {boolean} props.ready - Boolean flag indicating if face-api.js models are initialized.
 * @param {Array<number[]>} props.authorizedFaces - Array of authorized facial descriptors.
 * @param {string} props.userId - The unique identifier for the user session.
 * @param {string|null} [props.ipCameraUrl=null] - Optional source URL for an IP-based camera stream.
 * @param {string|null} [props.cameraId=null] - Unique identifier for the associated camera record.
 *
 * @returns {Object} { videoRef, imgRef, canvasRef, faceCount } - Refs for media elements and live detection metrics.
 */
const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const recentAlertsRef = useRef([]);
  const recentKnownRef = useRef([]); // Cooldown state management for verified identities
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

        // Release main thread to facilitate UI responsiveness
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

          // Cooldown cache maintenance
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

            // Asynchronous frame buffer capture
            const captureImage = () => {
              if (!canvas || !source) return null;
              canvas.width = width;
              canvas.height = height;
              canvas.getContext('2d').drawImage(source, 0, 0, width, height);
              return canvas.toDataURL('image/jpeg', 0.6);
            };

            if (isMatchFound) {
              // Known Entity Detection
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
                  cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
                  timestamp: new Date().toISOString(),
                  type: 'knownFace',  // ← green in history, no email
                  descriptor: detection.descriptor,
                  cameraId
                });
              }

            } else {
              // Unknown Entity Detection
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
                  cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
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
  }, [ready, authorizedFaces, userId, ipCameraUrl, cameraId]);

  return { videoRef, imgRef, canvasRef, faceCount };
};

export default useCamera;
