import { useRef, useEffect, useState } from 'react'
import * as faceapi from 'face-api.js'
import socket from '../socket'

const COOLDOWN_MS = 30000 // 30 seconds per face
const DETECT_INTERVAL_MS = 5000 // analyze every 5 seconds

const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
  const videoRef  = useRef(null)
  const imgRef    = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef     = useRef(null)
  const recentAlertsRef = useRef([]) // { descriptor: Float32Array, timestamp: number }

  const [faceCount, setFaceCount] = useState(0)

  // ── Start webcam ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || ipCameraUrl) return

    let stream = null

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error('Error accessing webcam:', err)
      }
    }

    startVideo()

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [ready, ipCameraUrl])

  // ── Set IP camera src ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !ipCameraUrl || !imgRef.current) return
    imgRef.current.crossOrigin = 'anonymous'
    imgRef.current.src = ipCameraUrl

    return () => {
      if (imgRef.current) imgRef.current.src = ''
    }
  }, [ready, ipCameraUrl])

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5
    })

    const detect = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // ── Get source (webcam or IP camera) ──
      let source = null
      let width  = 0
      let height = 0

      if (ipCameraUrl) {
        const img = imgRef.current
        if (!img || !img.complete || img.naturalWidth === 0) return
        source = img
        width  = img.naturalWidth
        height = img.naturalHeight
      } else {
        const video = videoRef.current
        if (!video || video.paused || video.ended || video.videoWidth === 0) return
        source = video
        width  = video.videoWidth
        height = video.videoHeight
      }

      if (!source || width === 0 || height === 0) return

      // ── Draw frame to canvas ──
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d').drawImage(source, 0, 0, width, height)

      // ── Detect faces with memory cleanup ──
      let detections = []
      try {
        detections = await faceapi
          .detectAllFaces(source, options)
          .withFaceLandmarks()
          .withFaceDescriptors()
      } catch (e) {
        console.error('Detection error:', e)
        return
      } finally {
        // Clean up TensorFlow tensors to prevent memory leak
        try {
          faceapi.tf.engine().startScope()
          faceapi.tf.engine().endScope()
        } catch (_) {}
      }

      setFaceCount(detections.length)
      if (detections.length === 0) return

      const now = Date.now()

      // ── Clean up old cooldown entries ──
      recentAlertsRef.current = recentAlertsRef.current.filter(
        entry => now - entry.timestamp < COOLDOWN_MS
      )

      // ── Check each detected face ──
      detections.forEach(detection => {

        // 1. Check if face is authorized
        let isAuthorized = false
        if (authorizedFaces && authorizedFaces.length > 0) {
          for (const authorizedFace of authorizedFaces) {
            const authorizedDescriptor = new Float32Array(authorizedFace)
            const distance = faceapi.euclideanDistance(
              detection.descriptor,
              authorizedDescriptor
            )
            if (distance < 0.6) {
              isAuthorized = true
              break
            }
          }
        }

        if (isAuthorized) return // known face → no alert

        // 2. Check cooldown — same person already alerted recently?
        const alreadyAlerted = recentAlertsRef.current.some(entry => {
          const distance = faceapi.euclideanDistance(
            detection.descriptor,
            entry.descriptor
          )
          return distance < 0.6
        })

        if (alreadyAlerted) {
          console.log('Same face in cooldown — skipping alert')
          return
        }

        // 3. New unknown face → send alert
        console.warn('Unknown face detected! Sending alert...')

        // Add to cooldown
        recentAlertsRef.current.push({
          descriptor: detection.descriptor,
          timestamp: now
        })

        // Capture photo
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.7)

        // Send to server
        socket.emit('alert', {
          userId,
          image: imageBase64,
          cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
          cameraId: cameraId,
          timestamp: new Date().toISOString(),
          type: 'unknownFace',
          descriptor: Array.from(detection.descriptor) // for authorize feature
        })
      })
    }

    intervalRef.current = setInterval(detect, DETECT_INTERVAL_MS)

    return () => {
      clearInterval(intervalRef.current)
      recentAlertsRef.current = []
      // Clean up TensorFlow memory
      try { faceapi.tf.disposeVariables() } catch (_) {}
    }
  }, [ready, authorizedFaces, userId, ipCameraUrl, cameraId])

  return { videoRef, imgRef, canvasRef, faceCount }
}

export default useCamera
