import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import socket from '../socket';

/**
 * Custom hook for real-time camera management and face recognition.
 * Handles initialization, periodic frame sampling (3s), and face comparison.
 *
 * @param {Object} props
 * @param {boolean} props.ready - Indicates if face-api models are loaded.
 * @param {Array} props.authorizedFaces - List of authorized face descriptors.
 * @param {string} props.userId - Current user ID for alerts.
 * @returns {Object} { videoRef, imgRef, canvasRef, faceCount }
 */
const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null }) => {
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [faceCount, setFaceCount] = useState(0);

  useEffect(() => {
    if (!ready) return;

    let stream = null;

    // Handle IP Camera stream via IMG tag instead of local webcam.
    if (ipCameraUrl) {
      if (imgRef.current) {
        imgRef.current.crossOrigin = 'anonymous'; // Prevent Tainted Canvas errors.
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

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (ipCameraUrl && imgRef.current) {
        imgRef.current.src = '';
      }
    };
  }, [ready, ipCameraUrl]);

  useEffect(() => {
    if (!ready || !authorizedFaces) return;

    const intervalId = setInterval(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let source = null;
      let width = 0;
      let height = 0;

      // IP Camera mode: process image from IMG element.
      if (ipCameraUrl) {
        if (!imgRef.current || !imgRef.current.complete) {
          return;
        }

        imgRef.current.crossOrigin = 'anonymous';
        source = imgRef.current;
        width = imgRef.current.naturalWidth;
        height = imgRef.current.naturalHeight;
      } else {
        // Webcam mode: process frame from VIDEO element.
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

      // Draw current frame to canvas.
      ctx.drawImage(source, 0, 0, width, height);

      // Detect faces and compute descriptors.
      const detections = await faceapi
        .detectAllFaces(source, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      setFaceCount(detections.length);

      if (detections.length > 0) {
        detections.forEach((detection) => {
          let isMatchFound = false;
          for (const authorizedFace of authorizedFaces) {
            const authorizedDescriptor = new Float32Array(authorizedFace);
            // Calculate Euclidean distance for face matching.
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
            console.warn('Unknown face detected! Sending alert...');
            // Alert on unknown face (Base64 encoded).
            const imageBase64 = canvas.toDataURL('image/jpeg');

            const alertData = {
              userId: userId,
              image: imageBase64,
              cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
              timestamp: new Date().toISOString(),
            };

            socket.emit('alert', alertData);
          }
        });
      }
    }, 3000); // Sample every 3 seconds.

    return () => clearInterval(intervalId);
  }, [ready, authorizedFaces, userId, ipCameraUrl]);

  return { videoRef, imgRef, canvasRef, faceCount };
};

export default useCamera;
