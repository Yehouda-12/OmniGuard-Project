import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import socket from '../socket';

/**
 * Custom hook for managing camera lifecycle and real-time facial recognition.
 * Handles hardware initialization, frame buffering, and descriptor comparison.
 * 
 * @param {Object} props
 * @param {boolean} props.ready - State indicating if AI models are loaded.
 * @param {Array} props.authorizedFaces - List of authorized face descriptors.
 * @param {string} props.userId - Current user identifier for event broadcasting.
 * @param {string|null} props.ipCameraUrl - Remote MJPEG/IP stream URL.
 * @param {string|null} props.cameraId - Database identifier for the camera.
 * @returns {Object} { videoRef, imgRef, canvasRef, faceCount }
 */
const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const recentAlertsRef = useRef([]);
  const recentKnownRef = useRef([]); // cooldown for known faces too
  const isActive = useRef(true);
  const isProcessing = useRef(false);
  const [faceCount, setFaceCount] = useState(0);

  /** Hardware Initialization Effect */
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

  /** Real-time Detection Loop */
  useEffect(() => {
    if (!ready || !authorizedFaces) return;

    isActive.current = true;

    /** Asynchronous detection cycle */
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

        // Yield to main thread to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 0));

        // Memory management: Start TensorFlow.js engine scope
        faceapi.tf.engine().startScope();
        try {
          // Execute detection with optimized input size
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
          // Ensure tensor disposal
          faceapi.tf.engine().endScope();
        }

        if (detections.length > 0) {
          const COOLDOWN_MS = 30000;
          const now = Date.now();

          // Filter stale entries from temporal cooldown buffers
          recentAlertsRef.current = recentAlertsRef.current.filter(a => now - a.timestamp < COOLDOWN_MS);
          recentKnownRef.current  = recentKnownRef.current.filter(a => now - a.timestamp < COOLDOWN_MS);

          detections.forEach((detection) => {
            let isMatchFound = false;

            // Compute Euclidean distance against authorized descriptor set
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

            /** Local canvas capture for event payloads */
            const captureImage = () => {
              if (!canvas || !source) return null;
              canvas.width = width;
              canvas.height = height;
              canvas.getContext('2d').drawImage(source, 0, 0, width, height);
              return canvas.toDataURL('image/jpeg', 0.6);
            };

            if (isMatchFound) {
              // Handle Known Identification
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
                  type: 'knownFace',
                  descriptor: detection.descriptor,
                  cameraId
                });
              }

            } else {
              // ── Unknown face ──
              // Handle Intrusion Detection
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
