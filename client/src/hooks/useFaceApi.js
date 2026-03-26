import { useState, useEffect } from 'react';
import * as faceapi from 'face-api.js';

/** @constant {string} MODEL_URL - Remote endpoint for retrieving pre-trained CNN weights via a distributed CDN. */
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model';

/**
 * AI Infrastructure Initialization Hook.
 * 
 * Serves as the initialization layer for the OmniGuard system, managing the asynchronous 
 * lifecycle of neural network loading. This hook ensures all necessary vision models are 
 * resident in memory before the surveillance engine commences inference.
 *
 * @returns {Object} loadingState - Atomic state object serving as the single source of truth for AI initialization.
 * @returns {boolean} loadingState.ready - Indicates if the model weights are successfully loaded and the nets are ready for inference.
 * @returns {number} loadingState.progress - Quantifiable loading progress percentage (0-100).
 * @returns {string|null} loadingState.error - Detailed error message if a network failure occurs during model retrieval.
 */
const useFaceApi = () => {
  const [loadingState, setLoadingState] = useState({
    ready: false,
    progress: 0,
    error: null,
  });

  useEffect(() => {
    /**
     * Orchestrates parallelized loading of the vision models.
     */
    const loadModels = async () => {
      try {
        await Promise.all([
          // TinyFaceDetector: Optimized for real-time performance and bounding box localization.
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),

          // FaceLandmark68Net: Executes 68-point facial feature alignment for structural analysis.
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),

          // FaceRecognitionNet: Extracts 128-dimensional identity descriptors for entity matching.
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setLoadingState({ ready: true, progress: 100, error: null });
      } catch (err) {
        setLoadingState({
          ready: false,
          progress: 0,
          error: 'Failed to load face-api models.',
        });
        console.error('[AI_INFRA] Initialization failure:', err);
      }
    };

    loadModels();
  }, []);

  return loadingState;
};

export default useFaceApi;