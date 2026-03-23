import Camera from "../components/Camera"

export default function Dashboard({ user, onLogout }) {
  return (
    <div style={{ padding: 20, background: "#0a0a0a", minHeight: "100vh" }}>
      <Camera
        userId="test123"
        authorizedFaces={[]}
        ipCameraUrl="http://192.168.8.102:8080/video"
        cameraName="Salon"
      />
    </div>
  )
}