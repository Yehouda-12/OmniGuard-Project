import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// Load models from CDN for better performance and availability.
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';

/**
 * Custom hook to load and manage face-api.js models.
 * Ensures models are loaded once on application startup.
 *
 * @returns {Object} { ready, progress, error }
 */
const useFaceApi = () => {
  const [loadingState, setLoadingState] = useState({
    ready: false,
    progress: 0,
    error: null,
  });

  useEffect(() => {
    const loadModels = async () => {
      try {
        // Load required models in parallel.
        await Promise.all([
          // Lightweight detector for bounding boxes.
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),

          // 68-point face landmarks detection.
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),

          // Computes face descriptors for recognition.
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setLoadingState({ ready: true, progress: 100, error: null });
      } catch (err) {
        setLoadingState({
          ready: false,
          progress: 0,
          error: 'Failed to load face-api models.',
        });
        console.error('Error loading face-api models:', err);
      }
    };

    loadModels();
  }, []);

  return loadingState;
};

export default useFaceApi;