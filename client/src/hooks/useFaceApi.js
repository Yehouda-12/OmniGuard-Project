import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

/** CDN endpoint for pre-trained AI model weights */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';

/**
 * Custom hook for initializing and managing face-api.js model lifecycle.
 * Handles asynchronous asset loading and provides reactive status telemetry.
 * 
 * @returns {Object} { ready: boolean, progress: number, error: string|null }
 */
const useFaceApi = () => {
  /** Internal state tracking for model initialization */
  const [loadingState, setLoadingState] = useState({
    ready: false,
    progress: 0,
    error: null,
  });

  useEffect(() => {
    /** 
     * Orchestrates parallel loading of required neural network weights.
     * Implements TinyFaceDetector for bounding box localization,
     * FaceLandmark68Net for alignment, and FaceRecognitionNet for feature extraction.
     */
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setLoadingState({ ready: true, progress: 100, error: null });
      } catch (err) {
        setLoadingState({
          ready: false,
          progress: 0,
          error: 'Failed to load face-api models.',
        });
      }
    };

    loadModels();
  }, []);

  return loadingState;
};

export default useFaceApi;