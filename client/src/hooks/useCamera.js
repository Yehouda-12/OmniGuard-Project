import { useRef, useEffect, useState } from 'react'
import socket from '../socket'

const FRAME_INTERVAL_MS = 3000 // send a frame every 3 seconds

const useCamera = ({ ready, userId, ipCameraUrl = null, cameraId = null, cameraName = 'Camera' }) => {
  const videoRef       = useRef(null)
  const imgRef         = useRef(null)
  const canvasRef      = useRef(null)
  const isActiveRef    = useRef(true)
  const isProcessing   = useRef(false)
  const timeoutRef     = useRef(null)

  const [faceCount, setFaceCount] = useState(0)
  // const [isUnknown, setIsUnknown] = useState(false)

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

  // ── Frame sending loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return

    isActiveRef.current = true

    const sendFrame = async () => {
      if (!isActiveRef.current || isProcessing.current) return
      isProcessing.current = true

      try {
        const canvas = canvasRef.current
        if (!canvas) return

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

        // Draw frame to canvas
        canvas.width  = width
        canvas.height = height
        canvas.getContext('2d').drawImage(source, 0, 0, width, height)

        // Capture as base64
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.7)

        // Send to server for analysis
        socket.emit('frame', {
          userId,
          image:      imageBase64,
          cameraId,
          cameraName,
          timestamp:  new Date().toISOString(),
        })

      } catch (e) {
        console.error('Frame send error:', e)
      } finally {
        isProcessing.current = false
        if (isActiveRef.current) {
          timeoutRef.current = setTimeout(sendFrame, FRAME_INTERVAL_MS)
        }
      }
    }

    sendFrame()

    return () => {
      isActiveRef.current = false
      clearTimeout(timeoutRef.current)
    }
  }, [ready, userId, ipCameraUrl, cameraId, cameraName])

  // ── Listen for server results ─────────────────────────────────────────────
  // useEffect(() => {
  //   const handleResult = (data) => {
  //     setFaceCount(data.faceCount || 0)
  //     setIsUnknown(data.isUnknown || false)

  //     if (data.isUnknown) {
  //       console.warn('🚨 Unknown face detected by server!')
  //     }
  //   }

  //   socket.on('detection_result', handleResult)
  //   return () => socket.off('detection_result', handleResult)
  // }, [])

  return { videoRef, imgRef, canvasRef, faceCount }
}

export default useCamera