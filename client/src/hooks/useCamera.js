import { useRef, useEffect, useState } from 'react'
import * as faceapi from 'face-api.js'
import socket from '../socket'

const COOLDOWN_MS = 30000
const DETECT_INTERVAL_MS = 5000

const useCamera = ({ ready, authorizedFaces, userId, ipCameraUrl = null, cameraId = null }) => {
  const videoRef        = useRef(null)
  const imgRef          = useRef(null)
  const canvasRef       = useRef(null)
  const recentAlertsRef = useRef([])
  const isDetectingRef  = useRef(false) // prevent overlapping detections
  const timeoutRef      = useRef(null)

  const [faceCount, setFaceCount] = useState(0)

  // ── Start webcam ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || ipCameraUrl) return
    let stream = null

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 30 }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error('Webcam error:', err)
      }
    }

    startVideo()
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()) }
  }, [ready, ipCameraUrl])

  // ── Set IP camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !ipCameraUrl || !imgRef.current) return
    imgRef.current.crossOrigin = 'anonymous'
    imgRef.current.src = ipCameraUrl
    return () => { if (imgRef.current) imgRef.current.src = '' }
  }, [ready, ipCameraUrl])

  // ── Detection loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return

    // Use inputSize 128 instead of 224 — 3x faster, still accurate enough
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 128,
      scoreThreshold: 0.5
    })

    const detect = async () => {
      // Skip if previous detection is still running
      if (isDetectingRef.current) return
      isDetectingRef.current = true

      try {
        const canvas = canvasRef.current
        if (!canvas) return

        // ── Get source ──
        let source, width, height

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

        // ── Yield to browser before heavy computation ──
        // This lets the video frame render before we block the thread
        await new Promise(r => setTimeout(r, 0))

        // ── Draw frame ──
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d').drawImage(source, 0, 0, width, height)

        // ── Yield again before face detection ──
        await new Promise(r => setTimeout(r, 0))

        // ── Detect faces inside tf scope to prevent memory leak ──
        let detections = []
        faceapi.tf.engine().startScope()
        try {
          detections = await faceapi
            .detectAllFaces(source, options)
            .withFaceLandmarks()
            .withFaceDescriptors()
        } finally {
          faceapi.tf.engine().endScope()
        }

        setFaceCount(detections.length)
        if (detections.length === 0) return

        // ── Cooldown cleanup ──
        const now = Date.now()
        recentAlertsRef.current = recentAlertsRef.current.filter(
          e => now - e.timestamp < COOLDOWN_MS
        )

        // ── Check each face ──
        detections.forEach(detection => {
          // 1. Is this face authorized?
          if (authorizedFaces && authorizedFaces.length > 0) {
            for (const face of authorizedFaces) {
              const dist = faceapi.euclideanDistance(
                detection.descriptor,
                new Float32Array(face)
              )
              if (dist < 0.6) return // known face → skip
            }
          }

          // 2. Is this face in cooldown?
          const inCooldown = recentAlertsRef.current.some(e =>
            faceapi.euclideanDistance(detection.descriptor, e.descriptor) < 0.6
          )
          if (inCooldown) {
            console.log('Same face in cooldown — skipping')
            return
          }

          // 3. New unknown face → alert !
          console.warn('Unknown face → sending alert')

          recentAlertsRef.current.push({
            descriptor: detection.descriptor,
            timestamp: now
          })

          // Capture photo
          const imageBase64 = canvas.toDataURL('image/jpeg', 0.7)

          socket.emit('alert', {
            userId,
            image: imageBase64,
            cameraName: ipCameraUrl ? 'IP Camera' : 'Webcam',
            cameraId,
            timestamp: new Date().toISOString(),
            type: 'unknownFace',
            descriptor: Array.from(detection.descriptor)
          })
        })

      } catch (e) {
        console.error('Detection error:', e)
      } finally {
        isDetectingRef.current = false
      }
    }

    // Schedule detection every 5s
    // Using setTimeout loop instead of setInterval to prevent stacking
    const schedule = () => {
      timeoutRef.current = setTimeout(async () => {
        await detect()
        schedule() // reschedule after detection completes
      }, DETECT_INTERVAL_MS)
    }

    schedule()

    return () => {
      clearTimeout(timeoutRef.current)
      recentAlertsRef.current = []
      isDetectingRef.current = false
      try { faceapi.tf.disposeVariables() } catch (_) {}
    }
  }, [ready, authorizedFaces, userId, ipCameraUrl, cameraId])

  return { videoRef, imgRef, canvasRef, faceCount }
}

export default useCamera